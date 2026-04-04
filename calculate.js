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

window.saveDataForPdf = function() {
    const displayEl = document.getElementById('client-display-name');
    const idEl = document.getElementById('client-id');
    
    const clientName = displayEl && displayEl.textContent !== 'None' && displayEl.textContent !== '+' && displayEl.textContent !== '' ? displayEl.textContent : 'Client';
    let clientAddress = '';
    
    if (idEl && idEl.value && window.clientsDb) {
        const cObj = window.clientsDb.find(c => c.id == idEl.value);
        if (cObj && cObj.address) clientAddress = cObj.address;
    }

    localStorage.setItem('im_clientName', clientName);
    localStorage.setItem('im_clientAddress', clientAddress);
    localStorage.setItem('im_projectName', document.getElementById('meta-project').value || 'Project');
}

window.renderDownloadOptions = async function() {
    const downloadBtn = document.getElementById('downloadPdfTrigger');
    if(!downloadBtn) return;
    const parent = downloadBtn.parentElement;

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

    const isPro = window.isPro;

    let warningEl = document.getElementById('branding-warning');
    if (isPro && !localStorage.getItem('im_global_company')) {
        if (!warningEl) {
            warningEl = document.createElement('div');
            warningEl.id = 'branding-warning';
            warningEl.innerHTML = `<strong>Your PDF is currently unbranded.</strong><br>Click here to add your Company Name & Logo to the top.`;
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

    downloadBtn.textContent = isPro ? "Review & Generate Proposal" : "Review & Generate (Watermarked)";
    downloadBtn.style.background = "linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%)";
    downloadBtn.style.border = "none";
    downloadBtn.style.color = "#0f172a";
    downloadBtn.style.display = 'block';
    
    downloadBtn.onclick = async () => {
        window.saveDataForPdf();
        const totalAmount = parseFloat(localStorage.getItem('im_grandTotal')) || 0;
        
        let saveAllowed = true;
        if (!window.isPro && window.bidCount >= 3 && !window.currentBidId) {
            saveAllowed = false; 
        } else {
            await window.saveBidToCloud(totalAmount, false);
        }
        
        if (window.currentBidId) {
            localStorage.setItem('im_current_bid_id', window.currentBidId);
        }
        window.location.href = './success';
    };
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('deposit-pct').addEventListener('input', window.updatePaymentSchedule);
    document.getElementById('progress-payments').addEventListener('input', window.updatePaymentSchedule);

    document.getElementById('calculateBtn').onclick = () => {
        let raw = 0, cons = 0;
        let csvData = "Product/Service,Description,Quantity,Rate,Amount\n";
        const csvEscape = (text) => `"${(text||'').replace(/"/g, '""')}"`;

        const getCost = (catId) => {
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
        
        const costs = { wood: getCost('wood-rows-container'), paint: getCost('paint-rows-container'), electrical: getCost('electrical-rows-container'), plumbing: getCost('plumbing-rows-container'), fixtures: getCost('fixtures-rows-container'), concrete: getCost('concrete-rows-container'), gravel: getCost('gravel-rows-container'), mulch: getCost('mulch-rows-container'), topsoil: getCost('topsoil-rows-container'), demo: getCost('demo-rows-container') };
        raw = Object.values(costs).reduce((a, b) => a + b, 0);
        
        if (document.getElementById('wood-consumables-check')?.checked) cons += costs.wood * ((parseFloat(document.getElementById('wood-consumables-pct')?.value) || 5) / 100);
        if (document.getElementById('paint-consumables-check')?.checked) cons += costs.paint * ((parseFloat(document.getElementById('paint-consumables-pct')?.value) || 5) / 100);
        if (document.getElementById('electrical-consumables-check')?.checked) cons += costs.electrical * ((parseFloat(document.getElementById('electrical-consumables-pct')?.value) || 5) / 100);
        if (document.getElementById('plumbing-consumables-check')?.checked) cons += costs.plumbing * ((parseFloat(document.getElementById('plumbing-consumables-pct')?.value) || 5) / 100);
        if (document.getElementById('fixtures-consumables-check')?.checked) cons += costs.fixtures * ((parseFloat(document.getElementById('fixtures-consumables-pct')?.value) || 5) / 100);
        
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

        let subTotal = 0;
        let subsList = [];
        if (document.querySelector('input[value="subs"]')?.checked) {
            document.querySelectorAll('.sub-entry').forEach(entry => {
                const name = entry.querySelector('.sub-name').value || 'Subcontractor';
                const desc = entry.querySelector('.sub-desc').value || 'Scope of work';
                const price = parseFloat(entry.querySelector('.sub-price').value) || 0;
                subTotal += price;
                if (price > 0) {
                    csvData += `Subcontractor,${csvEscape(name + " - " + desc)},1,${price},${price}\n`;
                    subsList.push({ name, desc, price });
                }
            });
        }

        const laborBurdenPct = document.getElementById('labor-burden-check')?.checked ? (parseFloat(document.getElementById('labor-burden-pct')?.value) || 25) / 100 : 0;
        const laborBurden = baseLabor * laborBurdenPct;
        const laborTotal = baseLabor + laborBurden;

        const breakeven = raw + cons + laborTotal + subTotal;
        const markupPct = parseFloat(document.getElementById('markupSlider').value) / 100;
        const markup = breakeven * markupPct; 
        const mult = 1 + markupPct; 

        const taxRate = parseFloat(document.getElementById('meta-tax').value) || 0;
        const materialsCostForClient = (raw + cons) * mult;
        const taxAmount = materialsCostForClient * (taxRate / 100);

        localStorage.setItem('im_csvData', csvData);
        localStorage.setItem('im_laborByPhase', JSON.stringify(laborByPhase));
        localStorage.setItem('im_subs', JSON.stringify(subsList));

        const format = (n) => '$' + n.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        const total = breakeven + markup + taxAmount;
        localStorage.setItem('im_grandTotal', total);

        localStorage.setItem('im_costs', JSON.stringify(costs));
        localStorage.setItem('im_cons', cons);
        localStorage.setItem('im_raw', raw);
        localStorage.setItem('im_markupPct', markupPct);
        localStorage.setItem('im_baseLabor', baseLabor);
        localStorage.setItem('im_laborBurden', laborBurden);
        localStorage.setItem('im_taxRate', taxRate);
        localStorage.setItem('im_taxAmount', taxAmount);
        
        document.getElementById('res-project-title').textContent = document.getElementById('meta-project').value || "Project Estimate";
        document.getElementById('res-contractor-profit').textContent = format(markup);
        
        let contractorHTML = `<div class="item-row" style="border-bottom: 1px dashed var(--border-glass); padding-bottom: 12px; margin-bottom: 12px; font-weight: 700; font-size: 1.1rem; color: #f8fafc;"><span>Total Breakeven Cost</span> <span>-${format(breakeven)}</span></div>`;
        contractorHTML += `<div class="item-row" style="color: #34d399; font-weight: 700; margin-bottom: 15px;"><span>Built-in Markup (${markupPct * 100}%)</span> <span>+${format(markup)}</span></div>`;
        
        if (baseLabor > 0) contractorHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Total Base Labor & Fleet</span> <span>-${format(baseLabor)}</span></div>`;
        if (laborBurden > 0) contractorHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Labor Burden (Taxes/Ins)</span> <span>-${format(laborBurden)}</span></div>`;
        if (subTotal > 0) contractorHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Subcontractors</span> <span>-${format(subTotal)}</span></div>`;
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
                if (cost > 0) clientHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• ${phase}</span> <span>${format(cost * mult)}</span></div>`;
            }
            if (laborBurden > 0) clientHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Burden & Insurance</span> <span>${format(laborBurden * mult)}</span></div>`;
        }
        
        if (subTotal > 0) {
            clientHTML += `<div class="item-row" style="font-weight: 600; padding-top: 15px;"><span>Subcontracted Services</span> <span>${format(subTotal * mult)}</span></div>`;
            subsList.forEach(s => {
                clientHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• ${s.name}</span> <span>${format(s.price * mult)}</span></div>`;
            });
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

        setTimeout(() => { 
            document.getElementById('results-view').classList.replace('hidden-view', 'active-view'); 
            
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            
        }, 300);

        if (typeof window.renderDownloadOptions === 'function') window.renderDownloadOptions();
    };

    document.getElementById('exportCSVBtn').onclick = () => {
        if (!window.isPro) return window.triggerUpgradeModal('QuickBooks CSV Export');
        
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
