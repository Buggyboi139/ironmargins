window.materialsDb = {};
window.categories = ['wood', 'paint', 'electrical', 'plumbing', 'fixtures', 'concrete', 'gravel', 'mulch', 'topsoil', 'demo'];
window.categoryNames = { wood: 'Construction Lumber', paint: 'Paint & Finishes', elec: 'Electrical & Wire', plumb: 'Plumbing & Pipe', fix: 'Fixtures & Cabinetry', conc: 'Concrete & Flatwork', grav: 'Gravel & Rock', mulch: 'Mulch & Landscape', soil: 'Topsoil & Dirt', demo: 'Demo & Hauls' };
window.sessionCustomSaved = new Set();
window.autoSaveTimer = null;
window.tempTemplateData = [];

window.calculateRowQuantity = function(row, cat) {
    const shapes = row.querySelectorAll('.shape-row'); 
    if (shapes.length === 0) return;
    
    let total = 0;
    if (cat === 'paint') { 
        shapes.forEach(s => total += (parseFloat(s.querySelector('.d-l').value)||0) * (parseFloat(s.querySelector('.d-h').value)||0) * (parseFloat(s.querySelector('.d-coats').value)||1)); 
        row.querySelector('.qty-input').value = Math.ceil((total * 1.1) / 350); 
        return; 
    }
    
    shapes.forEach(s => total += ((parseFloat(s.querySelector('.d-l').value)||0) * (parseFloat(s.querySelector('.d-w').value)||0) * (parseFloat(s.querySelector('.d-d').value)||0)/12)/27);
    
    const itemId = row.querySelector('.item-select').value;
    const unit = itemId === 'CUSTOM' ? 'qty' : (window.materialsDb[cat]?.find(i => i.id === itemId)?.unit || 'qty');
    
    let wasteFactor = 1.0;
    const wasteBox = document.getElementById(`${cat}-waste-check`);
    if (wasteBox && wasteBox.checked) wasteFactor += 0.1;

    if (cat === 'gravel' && document.getElementById('gravel-compaction-check')?.checked) wasteFactor += 0.2;
    if (cat === 'topsoil' && document.getElementById('topsoil-settling-check')?.checked) wasteFactor += 0.1;
    if (cat === 'mulch' && document.getElementById('mulch-settling-check')?.checked) wasteFactor += 0.1;
    
    let final = total * wasteFactor;
    
    if (cat === 'concrete' && unit === 'bag') {
        if (itemId.includes('60lb')) final *= 60;
        else if (itemId.includes('50lb')) final *= 72;
        else final *= 45;
    } else if (cat === 'mulch' && unit === 'bag') { final *= 13.5; } 
      else if (cat === 'topsoil' && unit === 'bag') { final *= 36; } 
      else if (unit === 'ton') { final *= (cat === 'topsoil' ? 1.2 : 1.4); }
    
    row.querySelector('.qty-input').value = final.toFixed(1);
}

window.addMaterialRow = function(cat, containerId) {
    if (window.gtag) window.gtag('event', 'add_to_cart', { item_category: cat });
    const items = window.materialsDb[cat] || [];
    let opts = items.map(i => `<div class="custom-option" data-value="${i.id}" data-price="${i.price}" data-unit="${i.unit}">${i.name}</div>`).join('');
    opts += `<div class="custom-option custom-escape" data-value="CUSTOM" data-price="0" data-unit="qty">+ Custom Material...</div>`;
    const def = items[0] || {name: 'Select...', price: 0, unit: 'qty', id: ''};
    const shapes = ['concrete', 'gravel', 'mulch', 'topsoil', 'paint'].includes(cat) ? `<div class="shapes-container"><div class="shapes-list"></div><button class="add-shape-btn">+ Add Area</button></div>` : '';
    
    document.getElementById(containerId).insertAdjacentHTML('beforeend', `
        <div class="calc-row" data-category="${cat}">
            <div class="input-row">
                <div class="input-group" style="flex:2;">
                    <label>Material/Item</label>
                    <div class="custom-select-container"><div class="custom-select-trigger glass-input"><span class="custom-select-text">${def.name}</span><span class="custom-select-arrow">▼</span></div><div class="custom-select-dropdown">${opts}</div><input type="hidden" class="item-select" value="${def.id}"></div>
                    <div class="custom-mat-wrapper" style="display:none;"><input type="text" class="glass-input custom-mat-input" placeholder="Name..."><button class="reset-mat-btn">↺</button></div>
                </div>
                <div class="input-group"><label>Amount</label><div class="unit-wrapper"><input type="number" class="glass-input qty-input" value="1" step="0.1"><span class="unit">${def.unit}s</span></div></div>
                <div class="input-group"><label>Cost</label><div class="unit-wrapper icon-prefix"><span class="prefix">$</span><input type="number" class="glass-input price-input" value="${parseFloat(def.price).toFixed(2)}"></div></div>
                <button class="remove-row-btn">×</button>
            </div>${shapes}
        </div>`);
    window.saveState();
}

window.addLaborRow = function(type) {
    if (window.gtag) window.gtag('event', 'add_to_cart', { item_category: 'labor_' + type });
    const container = document.getElementById('labor-rows-container');
    const isVehicle = type === 'vehicle';
    const defaultPhase = isVehicle ? 'Travel' : 'General';
    
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
                <button class="remove-row-btn">×</button>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
    window.saveState();
}

window.addSubRow = function() {
    if (window.gtag) window.gtag('event', 'add_to_cart', { item_category: 'subcontractor' });
    const container = document.getElementById('subs-rows-container');
    const html = `
        <div class="calc-row sub-entry">
            <div class="input-row">
                <div class="input-group"><label>Subcontractor Name</label><input type="text" class="glass-input sub-name" placeholder="e.g. ABC Electric"></div>
                <div class="input-group" style="flex:2;"><label>Scope Description</label><input type="text" class="glass-input sub-desc" placeholder="e.g. Wire 3 new outlets"></div>
                <div class="input-group"><label>Flat Quote</label><div class="unit-wrapper icon-prefix"><span class="prefix">$</span><input type="number" class="glass-input sub-price" value="0"></div></div>
                <button class="remove-row-btn">×</button>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
    window.saveState();
}

window.saveState = function(skipAutosave = false) {
    const state = { categories: {}, labor: [], subs: [], meta: {} };
    
    document.querySelectorAll('#setup-view .glass-input[id^="meta-"], #setup-view #client-select, #setup-view input[type="checkbox"], #markupSlider').forEach(el => {
        const key = el.id || el.name || el.value;
        state.meta[key] = el.type === 'checkbox' ? el.checked : el.value;
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

    localStorage.setItem('im_v5_data', JSON.stringify(state));

    if (!skipAutosave && window.currentUser && window.saveBidToCloud) {
        clearTimeout(window.autoSaveTimer);
        window.autoSaveTimer = setTimeout(() => {
            const manualSaveBtn = document.getElementById('manualSaveBtn');
            if (manualSaveBtn) manualSaveBtn.textContent = 'Autosaving...';
            window.saveBidToCloud(0, true).then((success) => {
                if (manualSaveBtn && success) {
                    manualSaveBtn.textContent = 'Saved!';
                    setTimeout(() => { manualSaveBtn.textContent = 'Save Bid'; }, 2000);
                }
            });
        }, 3000);
    }
}

window.loadState = function(dataOverride) {
    const dataStr = localStorage.getItem('im_v5_data');
    if (!dataStr && !dataOverride) return;
    const state = dataOverride || JSON.parse(dataStr);
    if (!state) return;

    if (state.meta) {
        Object.keys(state.meta).forEach(key => {
            const el = document.getElementById(key) || document.querySelector(`input[value="${key}"]`);
            if (el) {
                if (el.type === 'checkbox') el.checked = state.meta[key];
                else el.value = state.meta[key];
            }
        });
    }

    const laborContainer = document.getElementById('labor-rows-container');
    if (laborContainer && state.labor) {
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
    if (subsContainer && state.subs) {
        subsContainer.innerHTML = '';
        state.subs.forEach(s => {
            window.addSubRow();
            const row = subsContainer.lastElementChild;
            row.querySelector('.sub-name').value = s.name;
            row.querySelector('.sub-desc').value = s.desc;
            row.querySelector('.sub-price').value = s.price;
        });
    }

    if (state.categories) {
        window.categories.forEach(cat => {
            const container = document.getElementById(`${cat}-rows-container`);
            if (container && state.categories[cat]) {
                container.innerHTML = '';
                state.categories[cat].forEach(c => {
                    window.addMaterialRow(cat, `${cat}-rows-container`);
                    const row = container.lastElementChild;
                    
                    const opt = row.querySelector(`.custom-option[data-value="${c.item}"]`);
                    if (opt) {
                        row.querySelector('.custom-select-text').textContent = opt.textContent;
                        row.querySelector('.item-select').value = c.item;
                        row.querySelector('.unit').textContent = opt.dataset.unit + 's';
                    }
                    
                    if (c.item === 'CUSTOM') {
                        row.querySelector('.custom-select-container').style.display = 'none';
                        row.querySelector('.custom-mat-wrapper').style.display = 'flex';
                        row.querySelector('.custom-mat-input').value = c.customName;
                    }
                    
                    row.querySelector('.qty-input').value = c.qty;
                    row.querySelector('.price-input').value = c.price;

                    if (c.shapes && c.shapes.length > 0) {
                        c.shapes.forEach(s => {
                            const html = cat === 'paint' 
                                ? `<div class="shape-row"><div class="shape-inputs"><div class="unit-wrapper"><input type="number" class="glass-input d-l" value="${s.l}" placeholder="Length"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-h" value="${s.h}" placeholder="Height"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-coats" value="${s.coats}" placeholder="Coats"><span class="unit">ct</span></div></div><button class="remove-shape-btn">&times;</button></div>` 
                                : `<div class="shape-row"><div class="shape-inputs"><div class="unit-wrapper"><input type="number" class="glass-input d-l" value="${s.l}" placeholder="Length"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-w" value="${s.w}" placeholder="Width"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-d" value="${s.d}" placeholder="Depth"><span class="unit">in</span></div></div><button class="remove-shape-btn">&times;</button></div>`;
                            row.querySelector('.shapes-list').insertAdjacentHTML('beforeend', html);
                        });
                    }
                });
            }
        });
    }

    document.querySelectorAll('.module-toggle').forEach(t => { 
        const d = document.getElementById(t.getAttribute('data-target')); 
        if(t.checked && d) d.classList.add('active'); 
        else if(d) d.classList.remove('active'); 
    });
    
    const markupDisplay = document.getElementById('markupDisplay');
    const markupSlider = document.getElementById('markupSlider');
    if(markupDisplay && markupSlider) {
        markupDisplay.textContent = markupSlider.value + '%';
    }
}

window.saveAsTemplate = async function(category) {
    if (!window.currentUser || !window.supabaseClient) {
        alert("Sign in to save reusable material templates.");
        return;
    }
    const name = prompt(`Save as Template\nEnter a name for this ${window.categoryNames[category]} assembly:`);
    if (!name) return;

    const container = document.getElementById(`${category}-rows-container`);
    const rows = container.querySelectorAll('.calc-row');
    const items = [];

    rows.forEach(row => {
        items.push({
            item_id: row.querySelector('.item-select').value,
            custom_name: row.querySelector('.custom-mat-input').value,
            qty: row.querySelector('.qty-input').value,
            price: row.querySelector('.price-input').value
        });
    });

    const payload = {
        user_id: window.currentUser.id,
        name: name,
        category: category,
        items: items
    };

    const { error } = await window.supabaseClient.from('assemblies').insert([payload]);
    if (error) {
        alert("Error saving template: " + error.message);
    } else {
        const btn = document.querySelector(`.save-template-btn[data-category="${category}"]`);
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'Saved!';
            setTimeout(() => btn.textContent = originalText, 2000);
        }
    }
}

window.loadTemplate = async function(category) {
    if (!window.currentUser || !window.supabaseClient) return;
    const modal = document.getElementById('templateModal');
    const list = document.getElementById('template-list');
    list.innerHTML = 'Loading...';
    modal.classList.add('show');

    const { data, error } = await window.supabaseClient.from('assemblies').select('*').eq('category', category).eq('user_id', window.currentUser.id);
    
    if (error || !data || data.length === 0) {
        list.innerHTML = '<div style="padding: 15px; color: var(--text-muted);">No templates found.</div>';
        return;
    }

    list.innerHTML = data.map(t => `
        <div style="padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1);" 
             onclick="window.applyTemplate('${category}', ${t.id})">
            <span style="font-weight:bold; color:#38bdf8;">${t.name}</span>
        </div>
    `).join('');
    
    window.tempTemplateData = data;
}

window.applyTemplate = function(category, id) {
    const template = window.tempTemplateData.find(t => t.id === id);
    if (!template) return;

    const containerId = `${category}-rows-container`;
    template.items.forEach(item => {
        window.addMaterialRow(category, containerId);
        const container = document.getElementById(containerId);
        const row = container.lastElementChild;

        const opt = row.querySelector(`.custom-option[data-value="${item.item_id}"]`);
        if (opt) {
            row.querySelector('.custom-select-text').textContent = opt.textContent;
            row.querySelector('.item-select').value = item.item_id;
            row.querySelector('.unit').textContent = opt.dataset.unit + 's';
        }
        if (item.item_id === 'CUSTOM') {
            row.querySelector('.custom-select-container').style.display = 'none';
            row.querySelector('.custom-mat-wrapper').style.display = 'flex';
            row.querySelector('.custom-mat-input').value = item.custom_name;
        }
        
        row.querySelector('.qty-input').value = item.qty;
        row.querySelector('.price-input').value = item.price;
        window.calculateRowQuantity(row, category);
    });

    document.getElementById('templateModal').classList.remove('show');
    window.saveState();
}
