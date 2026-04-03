window.updatePaymentSchedule = function() {
    const total = parseFloat(localStorage.getItem('im_grandTotal')) || 0;
    const depPct = parseFloat(document.getElementById('deposit-pct').value) || 0;
    const progQty = parseInt(document.getElementById('progress-payments').value) || 0;
    
    const depAmt = total * (depPct / 100);
    const remAmt = total - depAmt;
    const progAmt = progQty > 0 ? remAmt / progQty : 0;

    let text = `Deposit: $${depAmt.toFixed(2)}`;
    if (progQty > 0) {
        text += ` • Plus ${progQty} payment(s) of $${progAmt.toFixed(2)}`;
    } else if (remAmt > 0) {
        text += ` • Plus Final Balance of $${remAmt.toFixed(2)}`;
    }
    
    document.getElementById('schedule-preview').textContent = text;
    localStorage.setItem('im_depAmt', depAmt);
    localStorage.setItem('im_progQty', progQty);
    localStorage.setItem('im_progAmt', progAmt);
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('deposit-pct').addEventListener('input', window.updatePaymentSchedule);
    document.getElementById('progress-payments').addEventListener('input', window.updatePaymentSchedule);

    document.getElementById('calculateBtn').onclick = () => {
        let raw = 0, cons = 0;
        let csvData = "Product/Service,Description,Quantity,Rate,Amount\n";
        const csvEscape = (text) => `"${(text||'').replace(/"/g, '""')}"`;

        const getCost = (catId, catKey) => {
            let c = 0; const el = document.getElementById(catId);
            if (el && el.closest('.module-container').classList.contains('active')) { 
                el.querySelectorAll('.calc-row').forEach(r => {
                    const itemSelect = r.querySelector('.item-select').value;
                    const isCustom = itemSelect === 'CUSTOM';
                    const name = isCustom ? r.querySelector('.custom-mat-input').value : r.querySelector('.custom-select-text').textContent;
                    const qty = parseFloat(r.querySelector('.qty-input').value)||0;
                    const price = parseFloat(r.querySelector('.price-input').value)||0;
                    
                    if (qty > 0) csvData += `Materials,${csvEscape(name)},${qty},${price},${qty*price}\n`;
                    c += qty * price;
                }); 
            }
            return c;
        };
        
        const costs = { wood: getCost('wood-rows-container', 'wood'), paint: getCost('paint-rows-container', 'paint'), elec: getCost('electrical-rows-container', 'elec'), plumb: getCost('plumbing-rows-container', 'plumb'), fix: getCost('fixtures-rows-container', 'fix'), conc: getCost('concrete-rows-container', 'conc'), grav: getCost('gravel-rows-container', 'grav'), mulch: getCost('mulch-rows-container', 'mulch'), soil: getCost('topsoil-rows-container', 'soil'), demo: getCost('demo-rows-container', 'demo') };
        raw = Object.values(costs).reduce((a, b) => a + b, 0);
        
        if (document.getElementById('wood-consumables-check')?.checked) cons += costs.wood * 0.05;
        if (document.getElementById('paint-consumables-check')?.checked) cons += costs.paint * 0.05;
        if (document.getElementById('electrical-consumables-check')?.checked) cons += costs.elec * 0.05;
        if (document.getElementById('plumbing-consumables-check')?.checked) cons += costs.plumb * 0.05;
        if (document.getElementById('fixtures-consumables-check')?.checked) cons += costs.fix * 0.05;
        
        let baseLabor = 0;
        let laborByPhase = {};

        if (document.querySelector('input[value="labor"]')?.checked) {
            document.querySelectorAll('.labor-entry').forEach(entry => {
                const name = entry.querySelector('.glass-input[type="text"]').value || 'Labor/Vehicle';
                const qty = parseFloat(entry.querySelector('.qty-input').value)||0;
                const price = parseFloat(entry.querySelector('.price-input').value)||0;
                const phase = entry.querySelector('.phase-select')?.value || 'General';
                
                const cost = qty * price;
                if (qty > 0) csvData += `Labor,${csvEscape(name)} [${phase}],${qty},${price},${cost}\n`;
                
                baseLabor += cost;
                if(!laborByPhase[phase]) laborByPhase[phase] = 0;
                laborByPhase[phase] += cost;
            });
        }

        const laborBurden = document.getElementById('labor-burden-check')?.checked ? baseLabor * 0.25 : 0;
        const laborTotal = baseLabor + laborBurden;

        const breakeven = raw + cons + laborTotal;
        const markupPct = parseFloat(document.getElementById('markupSlider').value) / 100;
        const markup = breakeven * markupPct; 
        const mult = 1 + markupPct; 

        const taxRate = parseFloat(document.getElementById('meta-tax').value) || 0;
        const taxAmount = (raw + cons) * (taxRate / 100);
        const materialsCostForClient = (raw + cons) * mult;

        localStorage.setItem('im_csvData', csvData);
        localStorage.setItem('im_laborByPhase', JSON.stringify(laborByPhase));

        const format = (n) => '$' + n.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        const total = breakeven + markup + taxAmount;
        localStorage.setItem('im_grandTotal', total);
        
        document.getElementById('res-project-title').textContent = document.getElementById('meta-project').value || "Project Estimate";
        document.getElementById('res-contractor-profit').textContent = format(markup);
        
        let contractorHTML = `<div class="item-row" style="border-bottom: 1px dashed var(--border-glass); padding-bottom: 12px; margin-bottom: 12px; font-weight: 700; font-size: 1.1rem; color: #f8fafc;"><span>Total Breakeven Cost</span> <span>-${format(breakeven)}</span></div>`;
        contractorHTML += `<div class="item-row" style="color: #34d399; font-weight: 700; margin-bottom: 15px;"><span>Built-in Markup (${markupPct * 100}%)</span> <span>+${format(markup)}</span></div>`;
        
        if (baseLabor > 0) contractorHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Total Base Labor & Fleet</span> <span>-${format(baseLabor)}</span></div>`;
        if (laborBurden > 0) contractorHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Labor Burden (Taxes/Ins)</span> <span>-${format(laborBurden)}</span></div>`;
        for (const[key, val] of Object.entries(costs)) {
            if (val > 0) contractorHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• ${window.categoryNames[key]}</span> <span>-${format(val)}</span></div>`;
        }
        if (cons > 0) contractorHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Shop Consumables</span> <span>-${format(cons)}</span></div>`;
        document.getElementById('dynamic-breakdown').innerHTML = contractorHTML;

        document.getElementById('res-client-total').textContent = format(total);

        let clientHTML = `<div class="item-row" style="font-weight: 700; font-size: 1.15rem; padding-bottom: 5px;"><span>Total Bid</span> <span>${format(total)}</span></div>`;
        
        if (baseLabor > 0) {
            clientHTML += `<div class="item-row" style="font-weight: 600; padding-top: 15px; border-top: 1px dashed var(--border-glass);"><span>Project Labor & Fleet</span> <span>${format(baseLabor * mult)}</span></div>`;
            for (const [phase, cost] of Object.entries(laborByPhase)) {
                if (cost > 0) clientHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• ${phase} Phase</span> <span>${format(cost * mult)}</span></div>`;
            }
            if (laborBurden > 0) clientHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Burden & Insurance</span> <span>${format(laborBurden * mult)}</span></div>`;
        }
        
        clientHTML += `<div class="item-row" style="font-weight: 600; padding-top: 15px;"><span>Itemized Materials & Supplies</span> <span>${format(materialsCostForClient)}</span></div>`;
        
        for (const [key, val] of Object.entries(costs)) {
            if (val > 0) clientHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• ${window.categoryNames[key]}</span> <span>${format(val * mult)}</span></div>`;
        }
        if (cons > 0) clientHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Shop Consumables</span> <span>${format(cons * mult)}</span></div>`;
        if (taxAmount > 0) clientHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Estimated Sales Tax (${taxRate}%)</span> <span>${format(taxAmount)}</span></div>`;

        document.getElementById('client-dynamic-breakdown').innerHTML = clientHTML;
        
        window.updatePaymentSchedule();
        
        document.getElementById('setup-view').classList.replace('active-view', 'hidden-view');
        setTimeout(() => { document.getElementById('results-view').classList.replace('hidden-view', 'active-view'); window.scrollTo(0,0); }, 300);

        window.renderDownloadOptions = async function() {
            const downloadBtn = document.getElementById('downloadPdfTrigger');
            if(!downloadBtn) return;
            const parent = downloadBtn.parentElement;
            
            let warningEl = document.getElementById('branding-warning');
            if (!localStorage.getItem('im_global_company')) {
                if (!warningEl) {
                    warningEl = document.createElement('div');
                    warningEl.id = 'branding-warning';
                    warningEl.innerHTML = `⚠️ <strong>Your PDF is currently unbranded.</strong><br>Click here to add your Company Name & Logo to the top.`;
                    warningEl.style.cssText = "background: rgba(251, 113, 133, 0.1); border: 1px solid #fb7185; color: #fb7185; padding: 15px; border-radius: 12px; margin-top: 25px; margin-bottom: 25px; font-size: 0.95rem; cursor: pointer; text-align: left; line-height: 1.4;";
                    warningEl.onclick = () => {
                        const pm = document.getElementById('profileModal');
                        if(pm) pm.classList.add('show');
                    };
                    parent.insertBefore(warningEl, downloadBtn);
                } else {
                    warningEl.style.display = 'block';
                }
            } else if (warningEl) {
                warningEl.style.display = 'none';
            }

            if (!window.currentUser) {
                downloadBtn.textContent = "Sign in to Generate Proposal";
                downloadBtn.style.background = "transparent";
                downloadBtn.style.border = "1px solid var(--border-glass)";
                downloadBtn.style.color = "var(--text-main)";
                downloadBtn.style.display = 'block';
                downloadBtn.onclick = () => {
                    const am = document.getElementById('authModal');
                    if(am) am.classList.add('show');
                };
                return;
            }

            const { data, error } = await window.supabaseClient
                .from('users')
                .select('subscription_status')
                .eq('id', window.currentUser.id)
                .maybeSingle();

            const isDbActive = data && data.subscription_status === 'active';
            const isTempActive = localStorage.getItem('im_temp_sub_active') === 'true';

            if (isDbActive || isTempActive) {
                downloadBtn.textContent = "Review & Generate Proposal";
                downloadBtn.style.background = "linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%)";
                downloadBtn.style.border = "none";
                downloadBtn.style.color = "#0f172a";
                downloadBtn.style.display = 'block';
                
                downloadBtn.onclick = async () => {
                    saveDataForPdf();
                    const totalAmount = parseFloat(localStorage.getItem('im_grandTotal')) || 0;
                    await window.saveBidToCloud(totalAmount, false);
                    window.location.href = './success';
                };
            } else {
                downloadBtn.textContent = "Subscribe to Generate ($12.99/mo)";
                downloadBtn.style.background = "var(--gradient-primary)";
                downloadBtn.style.border = "none";
                downloadBtn.style.color = "#0f172a";
                downloadBtn.style.display = 'block';
                
                downloadBtn.onclick = async () => {
                    if(!localStorage.getItem('im_global_company') && !confirm("Your PDF doesn't have a Company Name set. Continue anyway?")) {
                        const pm = document.getElementById('profileModal');
                        if(pm) pm.classList.add('show');
                        return;
                    }
                    if(window.gtag) window.gtag('event', 'begin_checkout', { currency: 'USD', value: 12.99, items:[{item_id: 'pro_sub'}] });
                    saveDataForPdf();
                    const totalAmount = parseFloat(localStorage.getItem('im_grandTotal')) || 0;
                    await window.saveBidToCloud(totalAmount, false);
                    const checkoutUrl = new URL('https://buy.stripe.com/bJefZj3KD32BdlU6ka0co03');
                    checkoutUrl.searchParams.set('client_reference_id', window.currentUser.id);
                    window.location.href = checkoutUrl.toString();
                };
            }
        };

        function saveDataForPdf() {
            const clientSelect = document.getElementById('client-select');
            const selectedOption = clientSelect.options[clientSelect.selectedIndex];
            localStorage.setItem('im_clientName', selectedOption && selectedOption.value ? selectedOption.textContent : 'Client');
            localStorage.setItem('im_clientAddress', selectedOption ? (selectedOption.dataset.address || '') : '');
            localStorage.setItem('im_projectName', document.getElementById('meta-project').value || 'Project');
            localStorage.setItem('im_costs', JSON.stringify(costs));
            localStorage.setItem('im_cons', cons);
            localStorage.setItem('im_raw', raw);
            localStorage.setItem('im_markupPct', markupPct);
            localStorage.setItem('im_baseLabor', baseLabor);
            localStorage.setItem('im_laborBurden', laborBurden);
            localStorage.setItem('im_taxRate', taxRate);
            localStorage.setItem('im_taxAmount', taxAmount);
        }

        if (typeof window.renderDownloadOptions === 'function') window.renderDownloadOptions();
    };

    document.getElementById('exportCSVBtn').onclick = () => {
        const csv = localStorage.getItem('im_csvData') || 'No data generated';
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', 'QuickBooks_Import.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
});
