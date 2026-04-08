window.isPro = false;
window.bidCount = 0;
window.materialsDb = {};
window.categories = ['wood', 'paint', 'electrical', 'plumbing', 'fixtures', 'concrete', 'gravel', 'mulch', 'topsoil', 'demo'];
window.categoryNames = { wood: 'Construction Lumber', paint: 'Paint & Finishes', electrical: 'Electrical & Wire', plumbing: 'Plumbing & Pipe', fixtures: 'Fixtures & Cabinetry', concrete: 'Concrete & Flatwork', gravel: 'Gravel & Rock', mulch: 'Mulch & Landscape', topsoil: 'Topsoil & Dirt', demo: 'Demo & Hauls' };
window.sessionCustomSaved = new Set();
window.autoSaveTimer = null;
window.tempTemplateData = [];
window.lastCloudState = null;

window.escapeHTML = function(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[match]);
};

window.saveCustomMaterialToCloud = async function(category, name, price, unit) {
    if (!window.currentUser || !window.supabaseClient) return;
    const uniqueKey = `${category}_${name}_${price}`;
    if (window.sessionCustomSaved.has(uniqueKey)) return;

    const { data } = await window.supabaseClient.from('custom_materials')
        .select('id').eq('user_id', window.currentUser.id).eq('category', category).eq('name', name).maybeSingle();
    
    if (data) {
        await window.supabaseClient.from('custom_materials').update({ price, unit }).eq('id', data.id);
    } else {
        await window.supabaseClient.from('custom_materials').insert([{ user_id: window.currentUser.id, category, name, price, unit }]);
    }
    window.sessionCustomSaved.add(uniqueKey);
};

window.calculateRowQuantity = function(row, cat) {
    const shapes = row.querySelectorAll('.shape-row');
    if (shapes.length === 0) return;

    const itemId = row.querySelector('.item-select').value;
    const itemData = window.materialsDb[cat]?.find(i => i.id === itemId);
    const unit = itemData?.unit || 'qty';
    const isCustom = itemId === 'CUSTOM';

    let total = 0;
    if (cat === 'paint') {
        shapes.forEach(s => {
            const dl = s.querySelector('.d-l');
            const dh = s.querySelector('.d-h');
            const dc = s.querySelector('.d-coats');
            const l = dl ? (parseFloat(dl.value) || 0) : 0;
            const h = dh ? (parseFloat(dh.value) || 0) : 0;
            const c = dc ? (parseFloat(dc.value) || 1) : 1;
            total += (l * h * c);
        });

        const coverage = isCustom ? 350 : (itemData?.coverage || 350);
        let wasteFactor = 1.0;
        const wasteBox = document.getElementById(`paint-waste-check`);
        if (wasteBox && wasteBox.checked) {
            const pct = parseFloat(document.getElementById('paint-waste-pct')?.value) || 10;
            wasteFactor += (pct / 100);
        }

        row.querySelector('.qty-input').value = Math.ceil((total * wasteFactor) / coverage);
        return;
    }

    shapes.forEach(s => {
        const dl = s.querySelector('.d-l');
        const dw = s.querySelector('.d-w');
        const dd = s.querySelector('.d-d');
        const l = dl ? (parseFloat(dl.value) || 0) : 0;
        const w = dw ? (parseFloat(dw.value) || 0) : 0;
        const d = dd ? (parseFloat(dd.value) || 0) : 0;
        total += (l * w * (d / 12)) / 27;
    });

    let wasteFactor = 1.0;
    const wasteBox = document.getElementById(`${cat}-waste-check`);
    if (wasteBox && wasteBox.checked) {
        const pct = parseFloat(document.getElementById(`${cat}-waste-pct`)?.value) || 10;
        wasteFactor += (pct / 100);
    }

    if (cat === 'gravel' && document.getElementById('gravel-compaction-check')?.checked) {
        const pct = parseFloat(document.getElementById('gravel-compaction-pct')?.value) || 20;
        wasteFactor += (pct / 100);
    }
    if (cat === 'topsoil' && document.getElementById('topsoil-settling-check')?.checked) {
        const pct = parseFloat(document.getElementById('topsoil-settling-pct')?.value) || 10;
        wasteFactor += (pct / 100);
    }
    if (cat === 'mulch' && document.getElementById('mulch-settling-check')?.checked) {
        const pct = parseFloat(document.getElementById('mulch-settling-pct')?.value) || 10;
        wasteFactor += (pct / 100);
    }

    let final = total * wasteFactor;

    if (cat === 'concrete' && unit === 'bag') {
        if (itemId.includes('60lb')) final *= 60;
        else if (itemId.includes('50lb')) final *= 72;
        else final *= 45;
    } else if (cat === 'mulch' && unit === 'bag') { final *= 13.5; }
      else if (cat === 'topsoil' && unit === 'bag') { final *= 36; }
      else if (unit === 'ton') {
          const density = isCustom ? 1.4 : (itemData?.density || 1.4);
          final *= density;
      }

    row.querySelector('.qty-input').value = final.toFixed(1);
}

window.addMaterialRow = function(cat, containerId) {
    if (window.gtag) window.gtag('event', 'add_to_cart', { item_category: cat });
    const items = window.materialsDb[cat] || [];
    let opts = items.map(i => {
        const displayName = i.isNationalAvg ? `${i.name} - National Avg` : i.name;
        return `<div class="custom-option" data-value="${i.id}" data-price="${i.price}" data-unit="${i.unit}" data-unverified="${i.isNationalAvg ? 'true' : 'false'}">${window.escapeHTML(displayName)}</div>`;
    }).join('');
    opts += `<div class="custom-option custom-escape" data-value="CUSTOM" data-price="0" data-unit="qty">+ Custom Material...</div>`;
    
    const def = items[0] || {name: 'Select...', price: 0, unit: 'qty', id: '', isNationalAvg: false};
    const defaultNameDisplay = def.isNationalAvg ? `${def.name} - National Avg` : def.name;
    const inputColorStyle = def.isNationalAvg ? 'color: #fbbf24;' : '';
    const warningIcon = def.isNationalAvg ? `<span class="price-warning" title="National Avg - Verify Local Cost" style="position: absolute; right: 8px; pointer-events: none;">⚠️</span>` : '';
    const shapes = ['concrete', 'gravel', 'mulch', 'topsoil', 'paint'].includes(cat) ? `<div class="shapes-container"><div class="shapes-list"></div><button class="add-shape-btn">+ Add Area</button></div>` : '';

    document.getElementById(containerId).insertAdjacentHTML('beforeend', `
        <div class="calc-row" data-category="${cat}">
            <div class="input-row">
                <div class="input-group" style="flex:2;">
                    <label>Material/Item</label>
                    <div class="custom-select-container"><div class="custom-select-trigger glass-input"><span class="custom-select-text">${window.escapeHTML(defaultNameDisplay)}</span><span class="custom-select-arrow">▼</span></div><div class="custom-select-dropdown">${opts}</div><input type="hidden" class="item-select" value="${def.id}"></div>
                    <div class="custom-mat-wrapper" style="display:none;"><input type="text" class="glass-input custom-mat-input" placeholder="Name..."><button class="reset-mat-btn">↺</button></div>
                </div>
                <div class="input-group"><label>Amount</label><div class="unit-wrapper"><input type="number" class="glass-input qty-input" value="1" step="0.1"><span class="unit">${def.unit}s</span></div></div>
                <div class="input-group"><label>Cost</label><div class="unit-wrapper icon-prefix"><span class="prefix">$</span><input type="number" class="glass-input price-input" value="${parseFloat(def.price).toFixed(2)}" style="padding-right: 25px; ${inputColorStyle}">${warningIcon}</div></div>
                <button class="remove-row-btn" title="Remove Item"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>${shapes}
        </div>`);
    window.saveState();
}

window.addLaborRow = function(type) {
    if (window.gtag) window.gtag('event', 'add_to_cart', { item_category: 'labor_' + type });
    const container = document.getElementById('labor-rows-container');
    const isVehicle = type === 'vehicle';
    const defaultPhase = isVehicle ? 'Travel' : 'General';
    const xIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    const phaseSelect = `
        <div class="input-group">
            <label>Phase</label>
            <select class="glass-input phase-select">
                ${['Phase 1','Phase 2','Phase 3','Phase 4','Phase 5','Travel','General','Other']
                  .map(p => `<option value="${p}" ${p === defaultPhase ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
        </div>`;

    const html = `
        <div class="calc-row labor-entry" data-type="${type}">
            <div class="input-row">
                ${phaseSelect}
                <div class="input-group" style="flex:2;"><label>${isVehicle ? 'Vehicle / Run Name' : 'Crew Member Name'}</label><input type="text" class="glass-input" placeholder="${isVehicle ? 'Service Truck' : 'Lead Builder'}"></div>
                <div class="input-group"><label>${isVehicle ? 'Miles' : 'Hours'}</label><div class="unit-wrapper"><input type="number" class="glass-input qty-input" value="${isVehicle ? 0 : 40}"><span class="unit">${isVehicle ? 'mi' : 'hrs'}</span></div></div>
                <div class="input-group"><label>${isVehicle ? 'IRS Rate' : 'Hourly Rate'}</label><div class="unit-wrapper icon-prefix"><span class="prefix">$</span><input type="number" class="glass-input price-input" value="${isVehicle ? 0.67 : 65.00}"></div></div>
                <button class="remove-row-btn" title="Remove Labor">${xIcon}</button>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
    window.saveState();
}

window.addSubRow = function() {
    if (window.gtag) window.gtag('event', 'add_to_cart', { item_category: 'subcontractor' });
    const container = document.getElementById('subs-rows-container');
    const xIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    const html = `
        <div class="calc-row sub-entry">
            <div class="input-row">
                <div class="input-group"><label>Subcontractor Name</label><input type="text" class="glass-input sub-name" placeholder="e.g. ABC Electric"></div>
                <div class="input-group" style="flex:2;"><label>Scope Description</label><input type="text" class="glass-input sub-desc" placeholder="e.g. Wire 3 new outlets"></div>
                <div class="input-group"><label>Flat Quote</label><div class="unit-wrapper icon-prefix"><span class="prefix">$</span><input type="number" class="glass-input sub-price" value="0"></div></div>
                <button class="remove-row-btn" title="Remove Sub">${xIcon}</button>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
    window.saveState();
}

window.saveState = function(skipAutosave = false) {
    const state = { categories: {}, labor: [], subs: [], meta: {} };

    document.querySelectorAll('#setup-view .glass-input[id^="meta-"], #setup-view #client-id, #setup-view #client-display-name, #setup-view input[type="checkbox"], #markupSlider, #setup-view .inline-pct').forEach(el => {
        const key = el.id || (el.classList.contains('module-toggle') ? 'toggle-' + el.value : el.name);
        state.meta[key] = el.type === 'checkbox' ? el.checked : (el.id === 'client-display-name' ? el.textContent : el.value);
    });

    window.categories.forEach(cat => {
        state.categories[cat] = [];
        const container = document.getElementById(`${cat}-rows-container`);
        if (container) {
            container.querySelectorAll('.calc-row').forEach(row => {
                const item = row.querySelector('.item-select').value;
                const customName = row.querySelector('.custom-mat-input').value;
                const qty = row.querySelector('.qty-input').value;
                const price = row.querySelector('.price-input').value;
                const shapes = [];
                row.querySelectorAll('.shape-row').forEach(s => {
                    shapes.push({ l: s.querySelector('.d-l')?.value || '', w: s.querySelector('.d-w')?.value || '', h: s.querySelector('.d-h')?.value || '', d: s.querySelector('.d-d')?.value || '', coats: s.querySelector('.d-coats')?.value || '' });
                });
                state.categories[cat].push({ item, customName, qty, price, shapes });
            });
        }
    });

    const laborContainer = document.getElementById('labor-rows-container');
    if (laborContainer) {
        laborContainer.querySelectorAll('.calc-row').forEach(row => {
            state.labor.push({
                type: row.dataset.type,
                phase: row.querySelector('.phase-select').value,
                name: row.querySelector('.glass-input[type="text"]').value,
                qty: row.querySelector('.qty-input').value,
                price: row.querySelector('.price-input').value
            });
        });
    }

    const subsContainer = document.getElementById('subs-rows-container');
    if (subsContainer) {
        subsContainer.querySelectorAll('.calc-row').forEach(row => {
            state.subs.push({
                name: row.querySelector('.sub-name').value,
                desc: row.querySelector('.sub-desc').value,
                price: row.querySelector('.sub-price').value
            });
        });
    }

    const stateString = JSON.stringify(state);

    try {
        localStorage.setItem('im_v5_data', stateString);
    } catch (e) {
    }

    if (!skipAutosave && window.currentUser && window.saveBidToCloud) {
        if (window.lastCloudState === stateString) return;

        clearTimeout(window.autoSaveTimer);

        window.autoSaveTimer = setTimeout(() => {
            const manualSaveBtn = document.getElementById('manualSaveBtn');
            if (manualSaveBtn) manualSaveBtn.textContent = 'Autosaving...';

            window.saveBidToCloud(0, true).then((success) => {
                if (success && success !== "LIMIT_REACHED") {
                    window.lastCloudState = stateString;

                    if (manualSaveBtn) {
                        manualSaveBtn.textContent = 'Saved!';
                        setTimeout(() => { manualSaveBtn.textContent = 'Save Bid'; }, 2000);
                    }
                } else if (manualSaveBtn && !window.isPro && window.bidCount >= 3 && !window.currentBidId) {
                    manualSaveBtn.textContent = 'Unlock Unlimited Bids';
                }
            });
        }, 10000);
    }
}

window.loadState = function(dataOverride) {
    const dataStr = localStorage.getItem('im_v5_data');
    if (!dataStr && !dataOverride) return;

    if (!dataOverride) window.lastCloudState = dataStr;

    const state = dataOverride || JSON.parse(dataStr);
    if (!state) return;

    if (dataOverride) {
        document.querySelectorAll('.module-toggle').forEach(t => t.checked = false);
    }

    if (state.meta) {
        Object.keys(state.meta).forEach(key => {
            let el = document.getElementById(key);
            if (!el && key.startsWith('toggle-')) el = document.querySelector(`input.module-toggle[value="${key.replace('toggle-', '')}"]`);
            if (!el) el = document.querySelector(`input[name="${key}"]`);
            if (!el) el = document.querySelector(`input[value="${key}"]`);
            if (el) {
                if (el.type === 'checkbox') el.checked = state.meta[key];
                else if (el.id === 'client-display-name') el.textContent = state.meta[key];
                else el.value = state.meta[key];
            }
        });
    }

    const laborContainer = document.getElementById('labor-rows-container');
    if (laborContainer && state.labor && state.labor.length > 0) {
        const t = document.querySelector(`input.module-toggle[value="labor"]`);
        if (t) t.checked = true;
        laborContainer.innerHTML = '';
        state.labor.forEach(l => {
            window.addLaborRow(l.type);
            const row = laborContainer.lastElementChild;
            row.querySelector('.phase-select').value = l.phase || 'General';
            row.querySelector('.glass-input[type="text"]').value = l.name;
            row.querySelector('.qty-input').value = l.qty;
            row.querySelector('.price-input').value = l.price;
        });
    }

    const subsContainer = document.getElementById('subs-rows-container');
    if (subsContainer && state.subs && state.subs.length > 0) {
        const t = document.querySelector(`input.module-toggle[value="subs"]`);
        if (t) t.checked = true;
        subsContainer.innerHTML = '';
        state.subs.forEach(s => {
            window.addSubRow();
            const row = subsContainer.lastElementChild;
            row.querySelector('.sub-name').value = s.name;
            row.querySelector('.sub-desc').value = s.desc;
            row.querySelector('.sub-price').value = s.price;
        });
    }

    const xIconSmall = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

    if (state.categories) {
        window.categories.forEach(cat => {
            const container = document.getElementById(`${cat}-rows-container`);
            if (container && state.categories[cat] && state.categories[cat].length > 0) {
                const t = document.querySelector(`input.module-toggle[value="${cat}"]`);
                if (t) t.checked = true;
                container.innerHTML = '';
                state.categories[cat].forEach(c => {
                    window.addMaterialRow(cat, `${cat}-rows-container`);
                    const row = container.lastElementChild;

                    const opt = row.querySelector(`.custom-option[data-value="${c.item}"]`);
                    if (opt) {
                        row.querySelector('.custom-select-text').textContent = opt.textContent;
                        row.querySelector('.item-select').value = c.item;
                        row.querySelector('.unit').textContent = opt.dataset.unit + 's';
                        if (opt.dataset.unverified === 'true') {
                            row.querySelector('.price-input').style.color = '#fbbf24';
                            const wrapper = row.querySelector('.price-input').closest('.unit-wrapper');
                            if(!wrapper.querySelector('.price-warning')) {
                                wrapper.insertAdjacentHTML('beforeend', `<span class="price-warning" title="National Avg - Verify Local Cost" style="position: absolute; right: 8px; pointer-events: none;">⚠️</span>`);
                            }
                        }
                    }

                    if (c.item === 'CUSTOM') {
                        row.querySelector('.custom-select-container').style.display = 'none';
                        row.querySelector('.custom-mat-wrapper').style.display = 'flex';
                        row.querySelector('.custom-mat-input').value = c.customName;
                        row.querySelector('.price-input').style.color = '';
                        const warning = row.querySelector('.price-warning');
                        if (warning) warning.remove();
                    }

                    row.querySelector('.qty-input').value = c.qty;
                    row.querySelector('.price-input').value = c.price;

                    if (c.shapes && c.shapes.length > 0) {
                        c.shapes.forEach(s => {
                            const html = cat === 'paint'
                                ? `<div class="shape-row"><div class="shape-inputs"><div class="unit-wrapper"><input type="number" class="glass-input d-l" value="${s.l}" placeholder="Length"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-h" value="${s.h}" placeholder="Height"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-coats" value="${s.coats}" placeholder="Coats"><span class="unit">ct</span></div></div><button class="remove-shape-btn" title="Remove Area">${xIconSmall}</button></div>`
                                : `<div class="shape-row"><div class="shape-inputs"><div class="unit-wrapper"><input type="number" class="glass-input d-l" value="${s.l}" placeholder="Length"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-w" value="${s.w}" placeholder="Width"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-d" value="${s.d}" placeholder="Depth"><span class="unit">in</span></div></div><button class="remove-shape-btn" title="Remove Area">${xIconSmall}</button></div>`;
                            row.querySelector('.shapes-list').insertAdjacentHTML('beforeend', html);
                        });
                    }
                });
            }
        });
    }

    document.querySelectorAll('.module-toggle').forEach(t => {
        const d = document.getElementById(t.getAttribute('data-target'));
        if(t.checked && d) {
            d.classList.add('active');
            d.classList.remove('collapsed');
        }
        else if(d) d.classList.remove('active');
    });

    const markupDisplay = document.getElementById('markupDisplay');
    const markupSlider = document.getElementById('markupSlider');
    if(markupDisplay && markupSlider) {
        markupDisplay.textContent = markupSlider.value + '%';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isMobile && !isStandalone) {
        const prompt = document.getElementById('pwa-prompt');
        if (prompt && !localStorage.getItem('im_pwa_dismissed')) {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
            prompt.style.display = 'block';
            
            const pText = prompt.querySelector('p');
            if (pText) {
                if (isIOS) {
                    pText.innerHTML = 'Install IronMargins! Tap the <strong>Share</strong> icon at the bottom of Safari, then select <strong>Add to Home Screen</strong>. <br><br><a href="/pwa" style="color:#38bdf8; text-decoration:underline;">See how to install</a>';
                } else if (isChrome) {
                    pText.innerHTML = 'Install IronMargins! Open your browser menu and select <strong>Add to Home screen</strong>. <br><br><a href="/pwa" style="color:#38bdf8; text-decoration:underline;">See how to install</a>';
                } else {
                    pText.innerHTML = 'For the best mobile experience, please install this app using <strong>Google Chrome</strong> or Safari. <br><br><a href="/pwa" style="color:#38bdf8; text-decoration:underline;">Learn why and how</a>';
                }
            }
        }
    }

    const closePwaBtn = document.querySelector('.close-pwa');
    if (closePwaBtn) {
        closePwaBtn.addEventListener('click', async (e) => {
            e.target.closest('.pwa-prompt').style.display = 'none';
            localStorage.setItem('im_pwa_dismissed', 'true');
            if (window.currentUser && window.supabaseClient) {
                try {
                    await window.supabaseClient.auth.updateUser({
                        data: { pwa_dismissed: true }
                    });
                } catch(err) {}
            }
        });
    }

    const cookieBanner = document.getElementById('cookieBanner');
    const acceptCookiesBtn = document.getElementById('acceptCookiesBtn');
    
    if (!localStorage.getItem('im_cookies_accepted') && cookieBanner) {
        cookieBanner.style.display = 'block';
    }
    
    if (acceptCookiesBtn) {
        acceptCookiesBtn.addEventListener('click', () => {
            localStorage.setItem('im_cookies_accepted', 'true');
            if (cookieBanner) cookieBanner.style.display = 'none';
        });
    }

    window.supabaseClient?.auth?.onAuthStateChange((event, session) => {
        const hasUser = !!(session && session.user);
        
        const saveTemplateBtn = document.getElementById('saveAsTemplateBtn');
        if (saveTemplateBtn) saveTemplateBtn.style.display = hasUser ? 'block' : 'none';
        
        const manualSaveBtn = document.getElementById('manualSaveBtn');
        if (manualSaveBtn) manualSaveBtn.style.display = hasUser ? 'block' : 'none';

        const myTemplatesSideBtn = document.getElementById('myTemplatesSideBtn');
        if (myTemplatesSideBtn) myTemplatesSideBtn.style.display = hasUser ? 'block' : 'none';

        const invoicesSideBtn = document.getElementById('invoicesSideBtn');
        if (invoicesSideBtn) invoicesSideBtn.style.display = hasUser ? 'block' : 'none';

        if (hasUser && typeof window.fetchUserProfile === 'function') {
            window.fetchUserProfile();
        }
    });

    document.getElementById('agreePricingBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('agreePricingBtn');
        btn.textContent = 'Saving...';
        btn.disabled = true;
        if (window.currentUser) {
            await window.supabaseClient.from('users').update({ pricing_agreed: true }).eq('id', window.currentUser.id);
        }
        document.getElementById('pricingAgreementModal').classList.remove('show');
    });

    const sideMenu = document.getElementById('sideMenu');
    const sideMenuOverlay = document.getElementById('sideMenuOverlay');
    
    window.closeSideMenu = () => { 
        sideMenu?.classList.remove('show');
        sideMenuOverlay?.classList.remove('show'); 
    };
    
    document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
        sideMenu?.classList.add('show'); 
        sideMenuOverlay?.classList.add('show');
    });
    
    document.getElementById('closeSideMenuBtn')?.addEventListener('click', window.closeSideMenu);
    sideMenuOverlay?.addEventListener('click', window.closeSideMenu);

    document.getElementById('invoicesSideBtn')?.addEventListener('click', () => {
        window.closeSideMenu();
        if (window.filterInvoices) window.filterInvoices('unpaid'); 
        document.getElementById('invoicesModal')?.classList.add('show');
    });
    document.getElementById('closeInvoicesModal')?.addEventListener('click', () => {
        document.getElementById('invoicesModal')?.classList.remove('show');
    });

    document.getElementById('openClientModalBtn')?.addEventListener('click', () => {
        if(window.resetClientForm) window.resetClientForm();
        document.getElementById('clientModal')?.classList.add('show');
    });
    document.getElementById('closeClientModal')?.addEventListener('click', () => {
        document.getElementById('clientModal')?.classList.remove('show');
    });
    
    document.getElementById('profileBtn')?.addEventListener('click', () => { 
        window.closeSideMenu(); 
        document.getElementById('profileModal')?.classList.add('show'); 
    });
    document.getElementById('closeProfileModal')?.addEventListener('click', () => {
        document.getElementById('profileModal')?.classList.remove('show');
    });

    document.getElementById('manageClientsSideBtn')?.addEventListener('click', () => { 
        window.closeSideMenu(); 
        if(window.resetClientForm) window.resetClientForm();
        document.getElementById('clientModal')?.classList.add('show'); 
    });

    document.getElementById('myTemplatesSideBtn')?.addEventListener('click', () => {
        window.closeSideMenu();
        if(window.fetchMyTemplates) window.fetchMyTemplates();
        document.getElementById('myTemplatesModal')?.classList.add('show');
    });
    document.getElementById('closeMyTemplatesModal')?.addEventListener('click', () => {
        document.getElementById('myTemplatesModal')?.classList.remove('show');
    });

    document.getElementById('openStarterTemplatesBtn')?.addEventListener('click', () => {
        const list = document.getElementById('starter-template-list');
        if (list) {
            const templates = window.starterTemplates || [];
            const grouped = templates.reduce((acc, t) => {
                const cat = t.category || 'Uncategorized';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(t);
                return acc;
            }, {});
    
            let html = '';
            for (const [category, items] of Object.entries(grouped)) {
                html += `<div onclick="const content = this.nextElementSibling; const icon = this.querySelector('span'); if(content.style.display === 'none') { content.style.display = 'block'; icon.textContent = '▼'; } else { content.style.display = 'none'; icon.textContent = '▶'; }" 
                              style="margin-top: 15px; margin-bottom: 10px; font-weight: 800; color: #f8fafc; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                            ${category} <span style="font-size: 0.75rem; color: #94a3b8;">▶</span>
                         </div>`;
                
                html += `<div style="display: none;">`;
                html += items.map(t => `
                    <div style="padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1);" 
                         onclick="window.loadStarterTemplate('${t.id}')">
                        <span style="font-weight:bold; color:#38bdf8;">${window.escapeHTML(t.name)}</span>
                    </div>
                `).join('');
                html += `</div>`;
            }
            list.innerHTML = html || '<div style="color: var(--text-muted); text-align: center; padding: 15px;">No templates available.</div>';
        }
        document.getElementById('starterTemplateModal')?.classList.add('show');
    });

    window.loadStarterTemplate = function(id) {
        const t = (window.starterTemplates || []).find(x => x.id === id);
        if (t) {
            window.currentBidId = null;
            const cId = document.getElementById('client-id');
            const cDisp = document.getElementById('client-display-name');
            const proj = document.getElementById('meta-project');
            if(cId) cId.value = '';
            if(cDisp) cDisp.textContent = '+';
            if(proj) proj.value = '';

            window.loadState(t.data);
            window.saveState();
            document.getElementById('results-view')?.classList.replace('active-view', 'hidden-view'); 
            document.getElementById('setup-view')?.classList.replace('hidden-view', 'active-view');
            window.scrollTo(0,0);
        }
        document.getElementById('starterTemplateModal')?.classList.remove('show');
    }

    window.saveFullTemplate = async function() {
        if (!window.currentUser || !window.supabaseClient) return alert('Sign in to save templates.');
        if (!window.isPro) return window.triggerUpgradeModal('Custom Templates');
        
        const name = prompt('Enter a name for this new template:');
        if (!name) return;

        window.saveState(true);
        const stateStr = localStorage.getItem('im_v5_data') || '{}';
        const bidData = JSON.parse(stateStr);
        
        if(bidData.meta) {
            delete bidData.meta['client-id'];
            delete bidData.meta['client-display-name'];
            delete bidData.meta['meta-project'];
        }

        const btn = document.getElementById('saveAsTemplateBtn');
        if(btn) btn.textContent = 'Saving...';

        const { error } = await window.supabaseClient.from('user_templates').insert([{
            user_id: window.currentUser.id,
            name: name,
            template_data: bidData
        }]);

        if (error) alert('Error saving template: ' + error.message);
        
        if(btn) {
            btn.textContent = 'Saved!';
            setTimeout(() => btn.textContent = 'Save as Custom Template', 2000);
        }
    };

    document.getElementById('saveAsTemplateBtn')?.addEventListener('click', window.saveFullTemplate);

    window.fetchMyTemplates = async function() {
        if (!window.currentUser || !window.supabaseClient) return;
        const { data, error } = await window.supabaseClient.from('user_templates').select('*').eq('user_id', window.currentUser.id).order('created_at', { ascending: false });
        if (!error && data) {
            window.myTemplatesDb = data;
            const list = document.getElementById('my-templates-list');
            if (!list) return;
            
            if (data.length === 0) {
                list.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 15px;">No custom templates saved yet.</div>';
                return;
            }

            const editIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
            const delIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

            list.innerHTML = data.map(t => {
                const safeName = window.escapeHTML(t.name);
                const jsSafeName = (t.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
                return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; flex-direction:column; min-width: 0; padding-right: 10px; cursor: pointer; flex: 1;" onclick="window.loadMyTemplate('${t.id}')">
                        <span style="font-weight:600; color:#38bdf8; font-size:0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safeName}</span>
                    </div>
                    <div style="display:flex; gap:8px; flex-shrink: 0;">
                        <button onclick="window.renameMyTemplate('${t.id}', '${jsSafeName}')" class="secondary-btn" style="padding: 8px; border-radius: 8px; display:flex; align-items:center; justify-content:center; color:#38bdf8; border-color:rgba(56,189,248,0.3); background:rgba(56,189,248,0.1);" title="Rename">${editIcon}</button>
                        <button onclick="window.deleteMyTemplate('${t.id}')" class="secondary-btn" style="padding: 8px; border-radius: 8px; display:flex; align-items:center; justify-content:center; color:#fb7185; border-color:rgba(251,113,133,0.3); background:rgba(251,113,133,0.1);" title="Delete">${delIcon}</button>
                    </div>
                </div>`;
            }).join('');
        }
    };

    window.loadMyTemplate = function(id) {
        const t = (window.myTemplatesDb || []).find(x => x.id === id);
        if (t && t.template_data) {
            window.currentBidId = null;
            const cId = document.getElementById('client-id');
            const cDisp = document.getElementById('client-display-name');
            const proj = document.getElementById('meta-project');
            if(cId) cId.value = '';
            if(cDisp) cDisp.textContent = '+';
            if(proj) proj.value = '';
            window.loadState(t.template_data);
            window.saveState();
            document.getElementById('results-view')?.classList.replace('active-view', 'hidden-view');
            document.getElementById('setup-view')?.classList.replace('hidden-view', 'active-view');
            window.scrollTo(0,0);
        }
        document.getElementById('myTemplatesModal')?.classList.remove('show');
    };

    window.renameMyTemplate = async function(id, currentName) {
        const newName = prompt("Rename template:", currentName);
        if (!newName || newName === currentName) return;
        const { error } = await window.supabaseClient.from('user_templates').update({ name: newName }).eq('id', id);
        if (!error) window.fetchMyTemplates();
    };

    window.deleteMyTemplate = async function(id) {
        if (!confirm("Delete this template? This cannot be undone.")) return;
        const { error } = await window.supabaseClient.from('user_templates').delete().eq('id', id);
        if (!error) window.fetchMyTemplates();
    };

    const materialsBtn = document.getElementById('materialsBtn');
    const materialsModal = document.getElementById('materialsModal');
    const closeMaterialsModal = document.getElementById('closeMaterialsModal');
    const catManageSelect = document.getElementById('cat-manage-select');
    const materialsManageList = document.getElementById('materials-manage-list');
    const saveMaterialsBtn = document.getElementById('saveMaterialsBtn');

    if(materialsBtn) materialsBtn.addEventListener('click', () => {
        window.closeSideMenu();
        if(materialsModal) materialsModal.classList.add('show');
        if(catManageSelect) {
            catManageSelect.innerHTML = window.categories.map(c => `<option value="${c}">${window.categoryNames[c]}</option>`).join('');
            renderManageList();
        }
    });
    
    if(closeMaterialsModal) closeMaterialsModal.addEventListener('click', () => materialsModal?.classList.remove('show'));
    if(catManageSelect) catManageSelect.addEventListener('change', renderManageList);

    function renderManageList() {
        if(!catManageSelect || !materialsManageList) return;
        const cat = catManageSelect.value;
        const items = window.materialsDb[cat] || [];
        materialsManageList.innerHTML = items.map(i => {
            const safeName = window.escapeHTML(i.name);
            const attrName = window.escapeHTML(i.name);
            return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; gap: 15px; margin-bottom: 8px;">
                <span style="font-size:0.9rem; flex:1 1 auto; min-width:0; word-break: break-word; line-height: 1.3;">${safeName}</span>
                <div class="unit-wrapper icon-prefix" style="flex:0 0 110px; width: 110px; max-width:110px;">
                    <span class="prefix" style="left: 12px;">$</span>
                    <input type="number" class="glass-input mat-price-edit" data-cat="${cat}" data-name="${attrName}" data-unit="${i.unit}" value="${parseFloat(i.price).toFixed(2)}" style="padding:10px 10px 10px 26px; font-size:0.9rem !important; width: 100%; box-sizing: border-box;">
                </div>
            </div>
            `;
        }).join('');
    }

    const addCustomMatBtn = document.getElementById('addCustomMatBtn');
    if(addCustomMatBtn) addCustomMatBtn.addEventListener('click', async () => {
        if (!window.isPro) return window.triggerUpgradeModal('Custom Material Saving');
        
        const nameInput = document.getElementById('new-mat-name');
        const priceInput = document.getElementById('new-mat-price');
        const unitSelect = document.getElementById('new-mat-unit');
        const cat = catManageSelect.value;
        
        const name = nameInput.value.trim();
        const price = parseFloat(priceInput.value);
        
        if(!name || isNaN(price)) return alert("Please enter a valid material name and price.");
        
        addCustomMatBtn.textContent = 'Adding...';
        
        if (!window.materialsDb[cat]) window.materialsDb[cat] = [];
        window.materialsDb[cat].push({
            id: `custom_${Date.now()}`,
            name: name,
            unit: unitSelect.value,
            price: price,
            isNationalAvg: false
        });

        await window.saveCustomMaterialToCloud(cat, name, price, unitSelect.value);
        
        nameInput.value = '';
        priceInput.value = '';
        addCustomMatBtn.textContent = 'Add Material';
        renderManageList();
    });

    if(saveMaterialsBtn) saveMaterialsBtn.addEventListener('click', async () => {
        if (!window.isPro) return window.triggerUpgradeModal('Custom Material Saving');
        
        saveMaterialsBtn.textContent = 'Saving...';
        const inputs = materialsManageList?.querySelectorAll('.mat-price-edit') || [];
        for(let inp of inputs) {
            const price = parseFloat(inp.value);
            const name = inp.dataset.name;
            const cat = inp.dataset.cat;
            const unit = inp.dataset.unit;
            
            const defaultItem = window.materialsDb[cat]?.find(i => i.name === name);
            if(defaultItem && defaultItem.price !== price) {
                defaultItem.price = price;
                await window.saveCustomMaterialToCloud(cat, name, price, unit);
            }
        }
        saveMaterialsBtn.textContent = 'Saved!';
        setTimeout(() => {
            saveMaterialsBtn.textContent = 'Save Prices';
            materialsModal?.classList.remove('show');
        }, 1000);
    });

    window.fetchCustomMaterials = async function() {
        if (!window.supabaseClient || !window.currentUser) return;
        const { data, error } = await window.supabaseClient
            .from('custom_materials')
            .select('*')
            .eq('user_id', window.currentUser.id);
            
        if (data && !error) {
            data.forEach(mat => {
                if (!window.materialsDb[mat.category]) window.materialsDb[mat.category] = [];
                const existingDefault = window.materialsDb[mat.category].find(m => m.name === mat.name);
                if (existingDefault) {
                    existingDefault.price = parseFloat(mat.price);
                    existingDefault.isNationalAvg = false;
                } else {
                    if (!window.materialsDb[mat.category].find(m => m.id === `custom_${mat.id}`)) {
                        window.materialsDb[mat.category].push({
                            id: `custom_${mat.id}`,
                            name: `${mat.name}`,
                            unit: mat.unit,
                            price: parseFloat(mat.price),
                            isNationalAvg: false
                        });
                    }
                }
            });
        }
    };

    window.resetClientForm = function() {
        const ids = ['edit-client-id', 'new-client-name', 'new-client-phone', 'new-client-address', 'new-client-email', 'new-client-notes'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const titleField = document.getElementById('client-form-title');
        if(titleField) titleField.textContent = 'Add New Client';
        const saveBtn = document.getElementById('btn-save-client');
        if(saveBtn) saveBtn.textContent = 'Save Client';
        const cancelBtn = document.getElementById('btn-cancel-edit-client');
        if(cancelBtn) cancelBtn.style.display = 'none';
    };

    window.editClient = function(id) {
        const client = window.clientsDb?.find(c => c.id == id);
        if (!client) return;
        const setVal = (elId, val) => {
            const el = document.getElementById(elId);
            if (el) el.value = val || '';
        };
        setVal('edit-client-id', client.id);
        setVal('new-client-name', client.name);
        setVal('new-client-phone', client.phone);
        setVal('new-client-address', client.address);
        setVal('new-client-email', client.email);
        setVal('new-client-notes', client.notes);
        
        const titleField = document.getElementById('client-form-title');
        if (titleField) titleField.textContent = 'Edit Client';
        
        const saveBtn = document.getElementById('btn-save-client');
        if (saveBtn) saveBtn.textContent = 'Update Client';
        
        const cancelBtn = document.getElementById('btn-cancel-edit-client');
        if (cancelBtn) cancelBtn.style.display = 'block';
        
        document.getElementById('add-client-container').style.display = 'block';
        document.getElementById('client-limit-banner').style.display = 'none';
    };

    window.deleteClient = async function(id) {
        if(!confirm("Delete this client? This cannot be undone.")) return;
        const { error } = await window.supabaseClient.from('clients').delete().eq('id', id);
        if(!error) {
            window.fetchClients();
            const activeClientId = document.getElementById('client-id');
            if (activeClientId && activeClientId.value === id) {
                activeClientId.value = '';
                const displayInput = document.getElementById('client-display-name');
                if (displayInput) displayInput.textContent = '+';
                localStorage.removeItem('im_clientName');
                localStorage.removeItem('im_clientAddress');
                window.saveState();
            }
        }
        else alert("Error deleting client: " + error.message);
    };

    window.fetchClients = async function() {
        if (!window.currentUser || !window.supabaseClient) return;
        const { data, error } = await window.supabaseClient
            .from('clients')
            .select('id, name, address, phone, email, notes')
            .eq('user_id', window.currentUser.id)
            .order('name');

        if (data && !error) {
            window.clientsDb = data; 
            const manageList = document.getElementById('client-manage-list');
            let manageHtml = '';
            
            const editIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
            const delIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
            const selectIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

            data.forEach(client => {
                const safeName = window.escapeHTML(client.name);
                const contactSubtitle = [client.email, client.phone, client.address].filter(Boolean).map(window.escapeHTML).join(' • ') || 'No details';

                manageHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; flex-direction:column; min-width: 0; padding-right: 10px; cursor: pointer; flex: 1;" onclick="window.selectClient('${client.id}')">
                        <span style="font-weight:600; color:#f8fafc; font-size:0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safeName}</span>
                        <span style="color:var(--text-muted); font-size:0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${contactSubtitle}</span>
                    </div>
                    <div style="display:flex; gap:8px; flex-shrink: 0;">
                        <button onclick="window.selectClient('${client.id}')" class="secondary-btn" style="padding: 8px; border-radius: 8px; display:flex; align-items:center; justify-content:center; color:#10b981; border-color:rgba(16,185,129,0.3); background:rgba(16,185,129,0.1);" title="Select Client">${selectIcon}</button>
                        <button onclick="window.editClient('${client.id}')" class="secondary-btn" style="padding: 8px; border-radius: 8px; display:flex; align-items:center; justify-content:center; color:#38bdf8; border-color:rgba(56,189,248,0.3); background:rgba(56,189,248,0.1);" title="Edit">${editIcon}</button>
                        <button onclick="window.deleteClient('${client.id}')" class="secondary-btn" style="padding: 8px; border-radius: 8px; display:flex; align-items:center; justify-content:center; color:#fb7185; border-color:rgba(251,113,133,0.3); background:rgba(251,113,133,0.1);" title="Delete">${delIcon}</button>
                    </div>
                </div>`;
            });

            if (data.length === 0) {
                manageHtml = '<div style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 15px;">No clients saved yet.</div>';
            }
            if (manageList) manageList.innerHTML = manageHtml;

            const clientLimitCounter = document.getElementById('client-limit-counter');
            if (clientLimitCounter) {
                if (!window.isPro) {
                    clientLimitCounter.style.display = 'block';
                    clientLimitCounter.textContent = `${data.length}/3 Free Clients`;
                } else {
                    clientLimitCounter.style.display = 'none';
                }
            }

            const addContainer = document.getElementById('add-client-container');
            const limitBanner = document.getElementById('client-limit-banner');
            if (!window.isPro && data.length >= 3) {
                if (addContainer) addContainer.style.display = 'none';
                if (limitBanner) limitBanner.style.display = 'block';
            } else {
                if (addContainer) addContainer.style.display = 'block';
                if (limitBanner) limitBanner.style.display = 'none';
            }
        }
    };

    window.selectClient = function(id) {
        const client = window.clientsDb?.find(c => c.id == id);
        if (client) {
            const idInput = document.getElementById('client-id');
            const displayInput = document.getElementById('client-display-name');
            if (idInput) idInput.value = client.id;
            if (displayInput) displayInput.textContent = client.name;
            localStorage.setItem('im_clientName', client.name);
            localStorage.setItem('im_clientAddress', client.address || '');
            window.saveState();
            document.getElementById('clientModal')?.classList.remove('show');
        }
    };

    window.fetchUserProfile = async function() {
        if (!window.currentUser || !window.supabaseClient) return;
        const { data, error } = await window.supabaseClient
            .from('users')
            .select('company_name, phone, address, payment_link, logo_data, custom_terms, subscription_status, pricing_agreed')
            .eq('id', window.currentUser.id)
            .single();

        if (data && !error) {
            if (data.pricing_agreed === false) {
                document.getElementById('pricingAgreementModal').classList.add('show');
            }

            window.isPro = ['active', 'trialing'].includes(String(data.subscription_status).toLowerCase().trim());
            localStorage.setItem('im_is_pro', window.isPro ? 'true' : 'false');
            
            if (data.company_name) localStorage.setItem('im_global_company', data.company_name);
            if (data.phone) localStorage.setItem('im_global_phone', data.phone);
            if (data.address) localStorage.setItem('im_global_address', data.address);
            if (data.payment_link) localStorage.setItem('im_payment_link', data.payment_link);
            if (data.logo_data) localStorage.setItem('im_logo', data.logo_data);
            if (data.custom_terms) localStorage.setItem('im_custom_terms', data.custom_terms);

            const compInput = document.getElementById('meta-company');
            const compPhoneInput = document.getElementById('meta-company-phone');
            const compAddressInput = document.getElementById('meta-company-address');
            const paymentLinkInput = document.getElementById('payment-link');
            const termsInput = document.getElementById('profile-custom-terms');
            const appTitle = document.getElementById('app-main-title');
            const logoPreview = document.getElementById('logo-preview');

            if (compInput && data.company_name) compInput.value = data.company_name;
            if (appTitle && data.company_name) appTitle.textContent = data.company_name + ' Estimates';
            if (compPhoneInput && data.phone) compPhoneInput.value = data.phone;
            if (compAddressInput && data.address) compAddressInput.value = data.address;
            if (paymentLinkInput && data.payment_link) paymentLinkInput.value = data.payment_link;
            if (termsInput && data.custom_terms) termsInput.value = data.custom_terms;
            if (logoPreview && data.logo_data) {
                logoPreview.src = data.logo_data;
                logoPreview.style.display = 'block';
            }
        }
    };

    document.getElementById('btn-save-client')?.addEventListener('click', async () => {
        if (!window.currentUser || !window.supabaseClient) {
            return alert('You must be signed in to save clients to your CRM.');
        }

        const idField = document.getElementById('edit-client-id');
        const id = idField ? idField.value : null;

        if (!id && !window.isPro && window.clientsDb && window.clientsDb.length >= 3) {
            return window.triggerUpgradeModal('Unlimited Clients');
        }

        const name = document.getElementById('new-client-name')?.value;
        const address = document.getElementById('new-client-address')?.value;
        const phone = document.getElementById('new-client-phone')?.value;
        const email = document.getElementById('new-client-email')?.value || '';
        const notes = document.getElementById('new-client-notes')?.value || '';

        if (!name) return alert('Client Name is required.');

        const btn = document.getElementById('btn-save-client');
        const origText = btn.textContent;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            const payload = { user_id: window.currentUser.id, name, address, phone, email, notes };
            
            let error;
            if (id) {
                const res = await window.supabaseClient.from('clients').update(payload).eq('id', id);
                error = res.error;
            } else {
                const res = await window.supabaseClient.from('clients').insert([payload]);
                error = res.error;
            }

            if (!error) {
                if(window.resetClientForm) window.resetClientForm();
                await window.fetchClients(); 
            } else {
                alert('Database Error: ' + error.message);
            }
        } catch (err) {
            alert('Network or execution error: ' + err.message);
        } finally {
            if (btn) {
                btn.textContent = origText;
                btn.disabled = false;
            }
        }
    });

    document.getElementById('btn-cancel-edit-client')?.addEventListener('click', () => {
        if(window.resetClientForm) window.resetClientForm();
        if (!window.isPro && window.clientsDb && window.clientsDb.length >= 3) {
            document.getElementById('add-client-container').style.display = 'none';
            document.getElementById('client-limit-banner').style.display = 'block';
        }
    });

    document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('saveProfileBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        const paymentLinkInput = document.getElementById('payment-link');
        const compInput = document.getElementById('meta-company');
        const compPhoneInput = document.getElementById('meta-company-phone');
        const compAddressInput = document.getElementById('meta-company-address');
        const termsInput = document.getElementById('profile-custom-terms');

        if (paymentLinkInput) localStorage.setItem('im_payment_link', paymentLinkInput.value);
        if (compInput) {
            localStorage.setItem('im_global_company', compInput.value);
            const appTitle = document.getElementById('app-main-title');
            if (appTitle) appTitle.textContent = compInput.value ? compInput.value + ' Estimates' : 'Never Underbid Again';
        }
        if (compPhoneInput) localStorage.setItem('im_global_phone', compPhoneInput.value);
        if (compAddressInput) localStorage.setItem('im_global_address', compAddressInput.value);
        if (termsInput) localStorage.setItem('im_custom_terms', termsInput.value);

        if (window.currentUser && window.supabaseClient) {
            const logoData = localStorage.getItem('im_logo');
            const { error } = await window.supabaseClient.from('users').upsert({
                id: window.currentUser.id,
                company_name: compInput ? compInput.value : '',
                phone: compPhoneInput ? compPhoneInput.value : '',
                address: compAddressInput ? compAddressInput.value : '',
                payment_link: paymentLinkInput ? paymentLinkInput.value : '',
                logo_data: logoData || '',
                custom_terms: termsInput ? termsInput.value : ''
            });

            if (error) {
                alert("Failed to save profile to cloud: " + error.message);
                btn.textContent = originalText;
                btn.disabled = false;
                return; 
            }
        }
        
        btn.textContent = 'Saved!';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
            document.getElementById('profileModal')?.classList.remove('show');
        }, 800);

        if (typeof window.renderDownloadOptions === 'function') window.renderDownloadOptions();
    });

    document.getElementById('logo-upload')?.addEventListener('change', function() {
        const file = this.files[0];
        const logoPreview = document.getElementById('logo-preview');
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 300; 
                    const scaleSize = MAX_WIDTH / img.width;
                    
                    if (scaleSize < 1) {
                        canvas.width = MAX_WIDTH;
                        canvas.height = img.height * scaleSize;
                    } else {
                        canvas.width = img.width;
                        canvas.height = img.height;
                    }
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const base64 = canvas.toDataURL('image/png', 0.8);
                    try {
                        localStorage.setItem('im_logo', base64);
                    } catch (err) {
                        alert('Storage limit reached. Cannot save logo.');
                    }
                    if (logoPreview) {
                        logoPreview.src = base64;
                        logoPreview.style.display = 'block';
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('closeCloseoutModal')?.addEventListener('click', () => {
        document.getElementById('closeoutModal')?.classList.remove('show');
    });

    const resetBtn = document.getElementById('resetBidBtn');
    if(resetBtn) {
        resetBtn.onclick = () => { 
            if(confirm("Clear this bid and start fresh?")) { 
                window.currentBidId = null;
                document.querySelectorAll('#setup-view input[type="text"], #setup-view input[type="number"]:not(.inline-pct), #setup-view input[type="date"], #setup-view textarea').forEach(el => el.value = '');
                
                const clientIdEl = document.getElementById('client-id');
                const clientDispEl = document.getElementById('client-display-name');
                if (clientIdEl) clientIdEl.value = '';
                if (clientDispEl) clientDispEl.textContent = '+';
                
                window.categories.concat(['labor']).forEach(c => { 
                    const container = document.getElementById(`${c}-rows-container`); 
                    if(container) container.innerHTML = ''; 
                });
                const subsContainer = document.getElementById('subs-rows-container');
                if (subsContainer) subsContainer.innerHTML = '';
                
                const banner = document.getElementById('closed-banner');
                if (banner) banner.style.display = 'none';
                
                document.getElementById('setup-view')?.classList.replace('hidden-view', 'active-view');
                document.getElementById('results-view')?.classList.replace('active-view', 'hidden-view');
                
                const editBtn = document.getElementById('editBtn');
                if (editBtn) editBtn.style.display = 'block';
                
                const sigSection = document.getElementById('payment-signature-section');
                if (sigSection) sigSection.style.display = 'block';
                
                document.querySelectorAll('.add-row-btn, .remove-row-btn, .add-shape-btn, .remove-shape-btn').forEach(el => el.style.display = '');

                window.saveState();
            } 
        };
    }

    const editBtn = document.getElementById('editBtn');
    if(editBtn) {
        editBtn.onclick = () => { 
            document.getElementById('results-view')?.classList.replace('active-view', 'hidden-view'); 
            setTimeout(() => document.getElementById('setup-view')?.classList.replace('hidden-view', 'active-view'), 300); 
        };
    }

    document.getElementById('manualSaveBtn')?.addEventListener('click', async () => {
        if (!window.isPro && window.bidCount >= 3 && !window.currentBidId) {
            return window.triggerUpgradeModal('Unlimited Saved Bids');
        }
        const manualSaveBtn = document.getElementById('manualSaveBtn');
        if (manualSaveBtn) {
            manualSaveBtn.textContent = 'Saving...';
            await window.saveBidToCloud(0, false);
            manualSaveBtn.textContent = 'Saved!';
            setTimeout(() => manualSaveBtn.textContent = 'Save Bid', 2000);
        }
    });

    document.getElementById('setup-view')?.addEventListener('input', (e) => { 
        if(e.target.closest('.calc-row')) { 
            const row = e.target.closest('.calc-row'); 
            if (e.target.classList.contains('price-input')) {
                e.target.style.color = '';
                const warning = e.target.closest('.unit-wrapper')?.querySelector('.price-warning');
                if (warning) warning.remove();
            }
            if(row.dataset.category) window.calculateRowQuantity(row, row.dataset.category); 
        } 
        if (e.target.classList.contains('inline-pct')) {
            const module = e.target.closest('.module-container');
            if (module) {
                const cat = module.id.replace('module-', '');
                if (window.categories.includes(cat)) {
                    document.querySelectorAll(`#${cat}-rows-container .calc-row`).forEach(row => window.calculateRowQuantity(row, cat));
                }
            }
        }
        window.saveState(); 
    });

    document.getElementById('setup-view')?.addEventListener('change', async (e) => {
        if (e.target.classList.contains('custom-mat-input') || e.target.classList.contains('price-input')) {
            const row = e.target.closest('.calc-row');
            if (!row || !row.dataset.category) return;
            const wrapper = row.querySelector('.custom-mat-wrapper');
            if (wrapper && wrapper.style.display !== 'none') {
                const cat = row.dataset.category;
                const name = row.querySelector('.custom-mat-input')?.value.trim();
                const price = parseFloat(row.querySelector('.price-input')?.value);
                const unitText = row.querySelector('.unit')?.textContent || 'qty';
                const unit = unitText.replace(/s$/, '');
                
                if (name && !isNaN(price)) {
                    if (!window.materialsDb[cat]) window.materialsDb[cat] = [];
                    let existing = window.materialsDb[cat].find(m => m.name === name);
                    if (existing) {
                        existing.price = price;
                        existing.isNationalAvg = false;
                    } else {
                        window.materialsDb[cat].push({
                            id: `custom_${Date.now()}`,
                            name: name,
                            unit: unit,
                            price: price,
                            isNationalAvg: false
                        });
                    }
                    if (window.saveCustomMaterialToCloud) {
                        await window.saveCustomMaterialToCloud(cat, name, price, unit);
                    }
                }
            }
        }
    });

    document.getElementById('setup-view')?.addEventListener('click', (e) => {
        const row = e.target.closest('.calc-row');
        if (!row) return;
        
        if (e.target.closest('.custom-select-trigger')) { 
            const d = e.target.closest('.custom-select-container').querySelector('.custom-select-dropdown');
            document.querySelectorAll('.custom-select-dropdown.show').forEach(el => el !== d && el.classList.remove('show')); 
            d.classList.toggle('show'); 
        }
        if (e.target.closest('.custom-option')) {
            const o = e.target.closest('.custom-option');
            const c = o.closest('.custom-select-container');
            c.querySelector('.custom-select-text').textContent = o.textContent; 
            c.querySelector('.item-select').value = o.dataset.value;
            const priceInput = row.querySelector('.price-input');
            if (o.dataset.value === 'CUSTOM') { 
                c.style.display = 'none'; 
                row.querySelector('.custom-mat-wrapper').style.display = 'flex'; 
                priceInput.style.color = '';
                const warning = row.querySelector('.price-warning');
                if (warning) warning.remove();
            } else { 
                priceInput.value = parseFloat(o.dataset.price).toFixed(2); 
                row.querySelector('.unit').textContent = o.dataset.unit + 's'; 
                const isUnverified = o.dataset.unverified === 'true';
                const wrapper = priceInput.closest('.unit-wrapper');
                if(isUnverified) {
                    priceInput.style.color = '#fbbf24';
                    if(!wrapper.querySelector('.price-warning')) {
                        wrapper.insertAdjacentHTML('beforeend', `<span class="price-warning" title="National Avg - Verify Local Cost" style="position: absolute; right: 8px; pointer-events: none;">⚠️</span>`);
                    }
                } else {
                    priceInput.style.color = '';
                    const warning = wrapper.querySelector('.price-warning');
                    if (warning) warning.remove();
                }
            }
            window.calculateRowQuantity(row, row.dataset.category); 
            o.parentElement.classList.remove('show'); 
            window.saveState();
        }
        if (e.target.closest('.reset-mat-btn')) { 
            row.querySelector('.custom-mat-wrapper').style.display = 'none'; 
            row.querySelector('.custom-select-container').style.display = 'block'; 
            window.saveState(); 
        }
        if (e.target.classList.contains('remove-shape-btn') || e.target.classList.contains('remove-row-btn')) { 
            e.target.closest(e.target.classList.contains('remove-row-btn') ? '.calc-row' : '.shape-row').remove(); 
            window.saveState(); 
        }
        if (e.target.classList.contains('add-shape-btn')) {
            const cat = row.dataset.category;
            const xIconSmall = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
            
            const html = cat === 'paint' 
                ? `<div class="shape-row"><div class="shape-inputs"><div class="unit-wrapper"><input type="number" class="glass-input d-l" placeholder="Length"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-h" placeholder="Height"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-coats" value="1" placeholder="Coats"><span class="unit">ct</span></div></div><button class="remove-shape-btn" title="Remove Area">${xIconSmall}</button></div>` 
                : `<div class="shape-row"><div class="shape-inputs"><div class="unit-wrapper"><input type="number" class="glass-input d-l" placeholder="Length"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-w" placeholder="Width"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-d" placeholder="Depth"><span class="unit">in</span></div></div><button class="remove-shape-btn" title="Remove Area">${xIconSmall}</button></div>`;
            row.querySelector('.shapes-list').insertAdjacentHTML('beforeend', html);
            window.saveState();
        }
    });

    const laborBtn = document.getElementById('add-laborer-btn');
    if(laborBtn) laborBtn.onclick = () => window.addLaborRow('person');
    
    const vehicleBtn = document.getElementById('add-vehicle-btn');
    if(vehicleBtn) vehicleBtn.onclick = () => window.addLaborRow('vehicle');
    
    const subBtn = document.getElementById('add-sub-btn');
    if(subBtn) subBtn.onclick = () => window.addSubRow();
    
    window.categories.forEach(c => {
        const btn = document.getElementById(`add-${c}-btn`);
        if (btn) btn.onclick = () => window.addMaterialRow(c, `${c}-rows-container`);
    });

    window.addEventListener('focus', () => {
        if (window.currentUser && window.supabaseClient && typeof window.renderDownloadOptions === 'function') {
            window.supabaseClient.from('users').select('subscription_status').eq('id', window.currentUser.id).maybeSingle()
                .then(({data, error}) => {
                    if (!error && data) {
                        window.isPro = ['active', 'trialing'].includes(String(data.subscription_status).toLowerCase().trim()) || localStorage.getItem('im_temp_sub_active') === 'true';
                        localStorage.setItem('im_is_pro', window.isPro ? 'true' : 'false');
                        window.renderDownloadOptions();
                    }
                });
        }
    });

    fetch('materials.json')
        .then(res => res.json())
        .then(async data => { 
            for (let cat in data) {
                data[cat].forEach(item => item.isNationalAvg = true);
            }
            window.materialsDb = data; 
            if (window.currentUser && window.supabaseClient) {
                await window.fetchCustomMaterials();
            }
            window.initApp(); 
        })
        .catch(() => window.initApp());

    fetch('templates.json')
        .then(res => res.json())
        .then(data => { window.starterTemplates = data; })
        .catch(() => { window.starterTemplates = []; });
});

window.initApp = function() {
    const compInput = document.getElementById('meta-company');
    const compPhoneInput = document.getElementById('meta-company-phone');
    const compAddressInput = document.getElementById('meta-company-address');
    const paymentLinkInput = document.getElementById('payment-link');
    const termsInput = document.getElementById('profile-custom-terms');
    const appTitle = document.getElementById('app-main-title');
    
    const globalComp = localStorage.getItem('im_global_company');
    const globalPhone = localStorage.getItem('im_global_phone');
    const globalAddress = localStorage.getItem('im_global_address');
    const savedPaymentLink = localStorage.getItem('im_payment_link');
    const savedTerms = localStorage.getItem('im_custom_terms');

    if (globalComp && compInput) {
        compInput.value = globalComp;
        if (appTitle) appTitle.textContent = globalComp + ' Estimates';
    }
    if (globalPhone && compPhoneInput) compPhoneInput.value = globalPhone;
    if (globalAddress && compAddressInput) compAddressInput.value = globalAddress;
    if (savedPaymentLink && paymentLinkInput) paymentLinkInput.value = savedPaymentLink;
    if (savedTerms && termsInput) termsInput.value = savedTerms;

    compInput?.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (appTitle) appTitle.textContent = val ? val + ' Estimates' : 'Never Underbid Again';
        localStorage.setItem('im_global_company', val);
    });
    
    compPhoneInput?.addEventListener('input', (e) => localStorage.setItem('im_global_phone', e.target.value.trim()));
    compAddressInput?.addEventListener('input', (e) => localStorage.setItem('im_global_address', e.target.value.trim()));
    termsInput?.addEventListener('input', (e) => localStorage.setItem('im_custom_terms', e.target.value.trim()));

    const savedLogo = localStorage.getItem('im_logo');
    const logoPreview = document.getElementById('logo-preview');
    if (savedLogo && logoPreview) {
        logoPreview.src = savedLogo;
        logoPreview.style.display = 'block';
    }

    window.loadState();
    
    document.querySelectorAll('.collapsible').forEach(h => h.onclick = () => h.parentElement.classList.toggle('collapsed'));
    
    document.querySelectorAll('.module-toggle').forEach(t => t.addEventListener('change', (e) => {
        const d = document.getElementById(e.target.getAttribute('data-target'));
        if (!d) return;
        
        if (e.target.checked) { 
            d.classList.add('active'); 
            d.classList.remove('collapsed');
            if (d.querySelectorAll('.calc-row').length === 0) { 
                if (e.target.value === 'labor') window.addLaborRow('person');
                else if (e.target.value === 'subs') window.addSubRow();
                else window.addMaterialRow(e.target.value, `${e.target.value}-rows-container`); 
            } 
        } else { 
            d.classList.remove('active'); 
        }
        window.saveState();
    }));

    const markupSlider = document.getElementById('markupSlider');
    const markupDisplay = document.getElementById('markupDisplay');
    if(markupSlider && markupDisplay) {
        markupSlider.oninput = (e) => markupDisplay.textContent = e.target.value + '%';
    }
}
