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
            
            if (isIOS) {
                prompt.querySelector('p').innerHTML = 'Install IronMargins! Tap the <strong>Share</strong> icon at the bottom of Safari, then select <strong>Add to Home Screen</strong>. <br><br><a href="/pwa" style="color:#38bdf8; text-decoration:underline;">See how to install</a>';
            } else if (isChrome) {
                prompt.querySelector('p').innerHTML = 'Install IronMargins! Open your browser menu and select <strong>Add to Home screen</strong>. <br><br><a href="/pwa" style="color:#38bdf8; text-decoration:underline;">See how to install</a>';
            } else {
                prompt.querySelector('p').innerHTML = 'For the best mobile experience, please install this app using <strong>Google Chrome</strong> or Safari. <br><br><a href="/pwa" style="color:#38bdf8; text-decoration:underline;">Learn why and how</a>';
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

    if (!localStorage.getItem('im_cookies_accepted')) {
        document.getElementById('cookieBanner').style.display = 'block';
    }
    document.getElementById('acceptCookiesBtn').addEventListener('click', () => {
        localStorage.setItem('im_cookies_accepted', 'true');
        document.getElementById('cookieBanner').style.display = 'none';
    });

    let materialsDb = {};
    const categories =['wood', 'paint', 'electrical', 'plumbing', 'fixtures', 'concrete', 'gravel', 'mulch', 'topsoil', 'demo'];
    
    const categoryNames = {
        wood: 'Construction Lumber', paint: 'Paint & Finishes', elec: 'Electrical & Wire', plumb: 'Plumbing & Pipe', fix: 'Fixtures & Cabinetry', conc: 'Concrete & Flatwork', grav: 'Gravel & Rock', mulch: 'Mulch & Landscape', soil: 'Topsoil & Dirt', demo: 'Demo & Hauls'
    };

    const sessionCustomSaved = new Set();
    let isQuickMode = true;
    let currentBidId = null;
    let autoSaveTimer = null;

    fetch('materials.json').then(res => res.json()).then(async data => { 
        materialsDb = data; 
        if (window.currentUser) await fetchCustomMaterials();
        initApp(); 
    }).catch(() => initApp());

    const markupSlider = document.getElementById('markupSlider');
    const markupDisplay = document.getElementById('markupDisplay');

    async function fetchCustomMaterials() {
        if (!window.supabaseClient || !window.currentUser) return;
        const { data, error } = await window.supabaseClient
            .from('custom_materials')
            .select('*')
            .eq('user_id', window.currentUser.id);
            
        if (data && !error) {
            data.forEach(mat => {
                if (!materialsDb[mat.category]) materialsDb[mat.category] =[];
                if (!materialsDb[mat.category].find(m => m.id === `custom_${mat.id}`)) {
                    materialsDb[mat.category].push({
                        id: `custom_${mat.id}`,
                        name: `⭐ ${mat.name}`,
                        unit: mat.unit,
                        price: parseFloat(mat.price)
                    });
                }
            });
        }
    }

    async function saveCustomMaterialToCloud(category, name, price, unit) {
        if (!window.currentUser || !window.supabaseClient) return;
        const uniqueKey = `${category}_${name}_${price}`;
        if (sessionCustomSaved.has(uniqueKey)) return;

        const payload = { user_id: window.currentUser.id, category, name, price, unit };
        const { error } = await window.supabaseClient.from('custom_materials').insert([payload]);
        if (!error) sessionCustomSaved.add(uniqueKey);
    }

    async function fetchClients() {
        if (!window.currentUser || !window.supabaseClient) return;
        
        const { data, error } = await window.supabaseClient
            .from('clients')
            .select('id, name, address, phone')
            .eq('user_id', window.currentUser.id)
            .order('name');

        if (data && !error) {
            const clientSelect = document.getElementById('client-select');
            const currentValue = clientSelect.value;
            clientSelect.innerHTML = '<option value="">Select a Client...</option>';
            data.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = client.name;
                option.dataset.address = client.address || '';
                clientSelect.appendChild(option);
            });
            if (currentValue) clientSelect.value = currentValue;
        }
    }

    window.fetchUserProfile = async function() {
        if (!window.currentUser || !window.supabaseClient) return;
        const { data, error } = await window.supabaseClient
            .from('users')
            .select('company_name, phone, address, payment_link, logo_data')
            .eq('id', window.currentUser.id)
            .single();

        if (data && !error) {
            if (data.company_name) localStorage.setItem('im_global_company', data.company_name);
            if (data.phone) localStorage.setItem('im_global_phone', data.phone);
            if (data.address) localStorage.setItem('im_global_address', data.address);
            if (data.payment_link) localStorage.setItem('im_payment_link', data.payment_link);
            if (data.logo_data) localStorage.setItem('im_logo', data.logo_data);

            const compInput = document.getElementById('meta-company');
            const compPhoneInput = document.getElementById('meta-company-phone');
            const compAddressInput = document.getElementById('meta-company-address');
            const paymentLinkInput = document.getElementById('payment-link');
            const appTitle = document.getElementById('app-main-title');
            const logoPreview = document.getElementById('logo-preview');

            if (compInput && data.company_name) compInput.value = data.company_name;
            if (appTitle && data.company_name) appTitle.textContent = data.company_name + ' Estimates';
            if (compPhoneInput && data.phone) compPhoneInput.value = data.phone;
            if (compAddressInput && data.address) compAddressInput.value = data.address;
            if (paymentLinkInput && data.payment_link) paymentLinkInput.value = data.payment_link;
            if (logoPreview && data.logo_data) {
                logoPreview.src = data.logo_data;
                logoPreview.style.display = 'block';
            }
        }
    };

    document.getElementById('client-select').addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        if(selectedOption) {
            localStorage.setItem('im_clientName', selectedOption.textContent);
            localStorage.setItem('im_clientAddress', selectedOption.dataset.address || '');
        }
        saveState();
    });

    document.getElementById('openClientModalBtn').addEventListener('click', () => document.getElementById('clientModal').classList.add('show'));
    document.getElementById('closeClientModal').addEventListener('click', () => document.getElementById('clientModal').classList.remove('show'));

    document.getElementById('btn-save-client').addEventListener('click', async () => {
        const name = document.getElementById('new-client-name').value;
        const address = document.getElementById('new-client-address').value;
        const phone = document.getElementById('new-client-phone').value;

        if (!name) return alert('Client Name is required.');

        const payload = { user_id: window.currentUser.id, name, address, phone };
        const { error } = await window.supabaseClient.from('clients').insert([payload]);

        if (!error) {
            document.getElementById('clientModal').classList.remove('show');
            document.getElementById('new-client-name').value = '';
            document.getElementById('new-client-address').value = '';
            document.getElementById('new-client-phone').value = '';
            await fetchClients(); 
        }
    });

    window.refreshSavedBids = async function() {
        const container = document.getElementById('savedBidsContainer');
        const dropdown = document.getElementById('savedBidsDropdown');
        
        if (!window.currentUser || !window.supabaseClient) {
            container.style.display = 'none';
            return;
        }

        await window.fetchUserProfile();
        await fetchClients();

        container.style.display = 'block';
        dropdown.innerHTML = '<div class="dropdown-empty">Loading bids...</div>';

        const { data, error } = await window.supabaseClient
            .from('bids')
            .select('id, project_name, created_at, clients(name)')
            .eq('user_id', window.currentUser.id)
            .order('created_at', { ascending: false });

        if (error) {
            dropdown.innerHTML = '<div class="dropdown-empty">Failed to load bids.</div>';
            return;
        }

        if (!data || data.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-empty">No saved bids yet.</div>';
            return;
        }

        let html = '';
        data.forEach(bid => {
            const dateStr = new Date(bid.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            const client = (bid.clients && bid.clients.name) ? bid.clients.name : 'Draft Client';
            const project = bid.project_name || 'Unnamed Project';
            
            html += `
                <div class="nav-bid-item" onclick="handleLoadBid('${bid.id}')">
                    <span class="bid-title">${client} - ${project}</span>
                    <span class="bid-date">${dateStr}</span>
                </div>
            `;
        });
        dropdown.innerHTML = html;
    };

    window.handleLoadBid = async function(bidId) {
        document.getElementById('savedBidsDropdown').classList.remove('show');
        await window.loadBidFromCloud(bidId);
        
        document.getElementById('results-view').classList.replace('active-view', 'hidden-view'); 
        document.getElementById('setup-view').classList.replace('hidden-view', 'active-view');
        window.scrollTo(0,0);
    };

    document.getElementById('savedBidsBtn').addEventListener('click', (e) => {
        e.stopPropagation(); 
        document.getElementById('savedBidsDropdown').classList.toggle('show');
    });

    document.getElementById('profileBtn').addEventListener('click', () => document.getElementById('profileModal').classList.add('show'));
    document.getElementById('closeProfileModal').addEventListener('click', () => document.getElementById('profileModal').classList.remove('show'));
    
    document.getElementById('saveProfileBtn').addEventListener('click', async () => {
        const paymentLinkInput = document.getElementById('payment-link');
        const compInput = document.getElementById('meta-company');
        const compPhoneInput = document.getElementById('meta-company-phone');
        const compAddressInput = document.getElementById('meta-company-address');

        if (paymentLinkInput) localStorage.setItem('im_payment_link', paymentLinkInput.value);
        if (compInput) localStorage.setItem('im_global_company', compInput.value);
        if (compPhoneInput) localStorage.setItem('im_global_phone', compPhoneInput.value);
        if (compAddressInput) localStorage.setItem('im_global_address', compAddressInput.value);

        if (window.currentUser && window.supabaseClient) {
            const logoData = localStorage.getItem('im_logo');
            await window.supabaseClient.from('users').update({
                company_name: compInput ? compInput.value : '',
                phone: compPhoneInput ? compPhoneInput.value : '',
                address: compAddressInput ? compAddressInput.value : '',
                payment_link: paymentLinkInput ? paymentLinkInput.value : '',
                logo_data: logoData || ''
            }).eq('id', window.currentUser.id);
        }
        
        document.getElementById('profileModal').classList.remove('show');
        if (typeof window.renderDownloadOptions === 'function') window.renderDownloadOptions();
    });

    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('savedBidsDropdown');
        if (dropdown && dropdown.classList.contains('show') && !e.target.closest('#savedBidsContainer')) dropdown.classList.remove('show');
        if (!e.target.closest('.custom-select-container')) document.querySelectorAll('.custom-select-dropdown.show').forEach(el => el.classList.remove('show'));
    });

    function saveState(skipAutosave = false) {
        const state = { categories: {}, labor:[], meta: {} };
        
        document.querySelectorAll('#setup-view .glass-input[id^="meta-"], #setup-view #client-select, #setup-view input[type="checkbox"], #setup-view input[type="radio"]:checked, #markupSlider').forEach(el => {
            const key = el.id || el.name || el.value;
            state.meta[key] = el.type === 'checkbox' ? el.checked : el.value;
        });

        categories.forEach(cat => {
            state.categories[cat] =[];
            const container = document.getElementById(`${cat}-rows-container`);
            if (container) {
                container.querySelectorAll('.calc-row').forEach(row => {
                    const item = row.querySelector('.item-select').value;
                    const customName = row.querySelector('.custom-mat-input').value;
                    const qty = row.querySelector('.qty-input').value;
                    const price = row.querySelector('.price-input').value;
                    const shapes =[];
                    row.querySelectorAll('.shape-row').forEach(s => {
                        shapes.push({
                            l: s.querySelector('.d-l')?.value || '',
                            w: s.querySelector('.d-w')?.value || '',
                            h: s.querySelector('.d-h')?.value || '',
                            d: s.querySelector('.d-d')?.value || '',
                            coats: s.querySelector('.d-coats')?.value || ''
                        });
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
                    name: row.querySelector('.glass-input[type="text"]').value,
                    qty: row.querySelector('.qty-input').value,
                    price: row.querySelector('.price-input').value
                });
            });
        }

        localStorage.setItem('im_v5_data', JSON.stringify(state));

        if (!skipAutosave && window.currentUser) {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = setTimeout(() => {
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

    window.saveBidToCloud = async function(totalAmount = 0, isAutosaving = false) {
        if (!window.currentUser || !window.supabaseClient) return false;

        if (!isAutosaving) saveState(true);

        const stateStr = localStorage.getItem('im_v5_data') || '{}';
        const bidData = JSON.parse(stateStr);

        const clientId = document.getElementById('client-select').value;
        const parsedClientId = parseInt(clientId, 10);
        const projectName = document.getElementById('meta-project').value || 'Draft Project';

        const payload = {
            user_id: window.currentUser.id,
            client_id: isNaN(parsedClientId) ? null : parsedClientId,
            project_name: projectName,
            total_amount: totalAmount,
            bid_data: bidData
        };

        try {
            if (currentBidId) {
                await window.supabaseClient.from('bids').update(payload).eq('id', currentBidId);
            } else {
                const { data, error } = await window.supabaseClient.from('bids').insert([payload]).select().single();
                if (error) throw error;
                if (data) currentBidId = data.id;
                if (window.refreshSavedBids) window.refreshSavedBids();
            }
            if (window.gtag && !isAutosaving) window.gtag('event', 'save_bid');
            return true;
        } catch (error) {
            return false;
        }
    };

    window.loadBidFromCloud = async function(bidId) {
        if (!window.supabaseClient) return;
        
        const { data, error } = await window.supabaseClient.from('bids').select('*').eq('id', bidId).single();
        if (error || !data) return;

        currentBidId = data.id;
        document.getElementById('client-select').value = data.client_id || '';
        document.getElementById('meta-project').value = data.project_name === 'Draft Project' ? '' : data.project_name;

        if (data.bid_data) loadState(data.bid_data);
    };

    const manualSaveBtn = document.getElementById('manualSaveBtn');
    if (manualSaveBtn) {
        manualSaveBtn.addEventListener('click', async () => {
            manualSaveBtn.textContent = 'Saving...';
            await window.saveBidToCloud(0, false);
            manualSaveBtn.textContent = 'Saved!';
            setTimeout(() => manualSaveBtn.textContent = 'Save Bid', 2000);
        });
    }

    function loadState(dataOverride) {
        const dataStr = localStorage.getItem('im_v5_data');
        if (!dataStr && !dataOverride) return;
        const state = dataOverride || JSON.parse(dataStr);
        if (!state) return;

        if (state.meta) {
            Object.keys(state.meta).forEach(key => {
                const el = document.getElementById(key) || document.querySelector(`input[name="${key}"][value="${state.meta[key]}"]`) || document.querySelector(`input[value="${key}"]`);
                if (el) {
                    if (el.type === 'checkbox' || el.type === 'radio') el.checked = state.meta[key];
                    else el.value = state.meta[key];
                }
            });
        }

        const laborContainer = document.getElementById('labor-rows-container');
        if (laborContainer && state.labor) {
            laborContainer.innerHTML = '';
            state.labor.forEach(l => {
                addLaborRow(l.type);
                const row = laborContainer.lastElementChild;
                row.querySelector('.glass-input[type="text"]').value = l.name;
                row.querySelector('.qty-input').value = l.qty;
                row.querySelector('.price-input').value = l.price;
            });
        }

        if (state.categories) {
            categories.forEach(cat => {
                const container = document.getElementById(`${cat}-rows-container`);
                if (container && state.categories[cat]) {
                    container.innerHTML = '';
                    state.categories[cat].forEach(c => {
                        addMaterialRow(cat, `${cat}-rows-container`);
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
                            row.querySelector('.price-input').disabled = false;
                        } else {
                            row.querySelector('.price-input').disabled = document.querySelector('input[name="est_mode"]:checked').value === 'quick';
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
            if(t.checked) d.classList.add('active'); else d.classList.remove('active'); 
        });
        markupDisplay.textContent = markupSlider.value + '%';
    }

    function calculateRowQuantity(row, cat) {
        const shapes = row.querySelectorAll('.shape-row'); if (shapes.length === 0) return;
        let total = 0;
        
        if (cat === 'paint') { shapes.forEach(s => total += (parseFloat(s.querySelector('.d-l').value)||0) * (parseFloat(s.querySelector('.d-h').value)||0) * (parseFloat(s.querySelector('.d-coats').value)||1)); row.querySelector('.qty-input').value = Math.ceil((total * 1.1) / 350); return; }
        shapes.forEach(s => total += ((parseFloat(s.querySelector('.d-l').value)||0) * (parseFloat(s.querySelector('.d-w').value)||0) * (parseFloat(s.querySelector('.d-d').value)||0)/12)/27);
        
        const itemId = row.querySelector('.item-select').value;
        const unit = itemId === 'CUSTOM' ? 'qty' : (materialsDb[cat]?.find(i => i.id === itemId)?.unit || 'qty');
        
        let wasteFactor = 1.0;
        const wasteBox = document.getElementById(`${cat}-waste-check`);
        if (wasteBox && wasteBox.checked) wasteFactor += 0.1;

        if (cat === 'gravel') {
            const compactionBox = document.getElementById('gravel-compaction-check');
            if (compactionBox && compactionBox.checked) wasteFactor += 0.2;
        }
        
        if (cat === 'topsoil') {
            const settlingBox = document.getElementById('topsoil-settling-check');
            if (settlingBox && settlingBox.checked) wasteFactor += 0.1;
        }

        if (cat === 'mulch') {
            const settlingBox = document.getElementById('mulch-settling-check');
            if (settlingBox && settlingBox.checked) wasteFactor += 0.1;
        }
        
        let final = total * wasteFactor;
        
        if (cat === 'concrete' && unit === 'bag') {
            if (itemId.includes('60lb')) final *= 60;
            else if (itemId.includes('50lb')) final *= 72;
            else final *= 45;
        } else if (cat === 'mulch' && unit === 'bag') {
            final *= 13.5;
        } else if (cat === 'topsoil' && unit === 'bag') {
            final *= 36;
        } else if (unit === 'ton') {
            final *= (cat === 'topsoil' ? 1.2 : 1.4);
        }
        
        row.querySelector('.qty-input').value = final.toFixed(1);
    }

    function addMaterialRow(cat, containerId) {
        if (window.gtag) window.gtag('event', 'add_to_cart', { item_category: cat });
        const items = materialsDb[cat] ||[];
        let opts = items.map(i => `<div class="custom-option" data-value="${i.id}" data-price="${i.price}" data-unit="${i.unit}">${i.name}</div>`).join('');
        opts += `<div class="custom-option custom-escape" data-value="CUSTOM" data-price="0" data-unit="qty">➕ Custom Material...</div>`;
        const def = items[0] || {name: 'Select...', price: 0, unit: 'qty', id: ''};
        const shapes =['concrete', 'gravel', 'mulch', 'topsoil', 'paint'].includes(cat) ? `<div class="shapes-container"><div class="shapes-list"></div><button class="add-shape-btn">+ Add Area</button></div>` : '';
        document.getElementById(containerId).insertAdjacentHTML('beforeend', `
            <div class="calc-row" data-category="${cat}">
                <div class="input-row">
                    <div class="input-group" style="flex:2;">
                        <label>Material/Item</label>
                        <div class="custom-select-container"><div class="custom-select-trigger glass-input"><span class="custom-select-text">${def.name}</span><span class="custom-select-arrow">▼</span></div><div class="custom-select-dropdown">${opts}</div><input type="hidden" class="item-select" value="${def.id}"></div>
                        <div class="custom-mat-wrapper" style="display:none;"><input type="text" class="glass-input custom-mat-input" placeholder="Name..."><button class="reset-mat-btn">↺</button></div>
                    </div>
                    <div class="input-group"><label>Amount</label><div class="unit-wrapper"><input type="number" class="glass-input qty-input" value="1" step="0.1"><span class="unit">${def.unit}s</span></div></div>
                    <div class="input-group"><label>Cost</label><div class="unit-wrapper icon-prefix"><span class="prefix">$</span><input type="number" class="glass-input price-input" value="${parseFloat(def.price).toFixed(2)}" ${isQuickMode ? 'disabled' : ''}></div></div>
                    <button class="remove-row-btn">×</button>
                </div>${shapes}
            </div>`);
        saveState();
    }

    function addLaborRow(type) {
        if (window.gtag) window.gtag('event', 'add_to_cart', { item_category: 'labor_' + type });
        const container = document.getElementById('labor-rows-container');
        const isVehicle = type === 'vehicle';
        const html = `
            <div class="calc-row labor-entry" data-type="${type}">
                <div class="input-row">
                    <div class="input-group" style="flex:2;"><label>${isVehicle ? 'Vehicle / Run Name' : 'Crew Member Name'}</label><input type="text" class="glass-input" placeholder="${isVehicle ? 'Service Truck' : 'Lead Builder'}"></div>
                    <div class="input-group"><label>${isVehicle ? 'Miles' : 'Hours'}</label><div class="unit-wrapper"><input type="number" class="glass-input qty-input" value="${isVehicle ? 0 : 40}"><span class="unit">${isVehicle ? 'mi' : 'hrs'}</span></div></div>
                    <div class="input-group"><label>${isVehicle ? 'IRS Rate' : 'Hourly Rate'}</label><div class="unit-wrapper icon-prefix"><span class="prefix">$</span><input type="number" class="glass-input price-input" value="${isVehicle ? 0.67 : 65.00}"></div></div>
                    <button class="remove-row-btn">×</button>
                </div>
            </div>`;
        container.insertAdjacentHTML('beforeend', html);
        saveState();
    }

    function initApp() {
        const compInput = document.getElementById('meta-company');
        const compPhoneInput = document.getElementById('meta-company-phone');
        const compAddressInput = document.getElementById('meta-company-address');
        const paymentLinkInput = document.getElementById('payment-link');
        const appTitle = document.getElementById('app-main-title');
        
        const globalComp = localStorage.getItem('im_global_company');
        const globalPhone = localStorage.getItem('im_global_phone');
        const globalAddress = localStorage.getItem('im_global_address');
        const savedPaymentLink = localStorage.getItem('im_payment_link');

        if (globalComp) {
            compInput.value = globalComp;
            appTitle.textContent = globalComp + ' Estimates';
        }
        if (globalPhone) compPhoneInput.value = globalPhone;
        if (globalAddress) compAddressInput.value = globalAddress;
        if (savedPaymentLink && paymentLinkInput) paymentLinkInput.value = savedPaymentLink;

        compInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            appTitle.textContent = val ? val + ' Estimates' : 'Never Underbid Again';
            localStorage.setItem('im_global_company', val);
        });
        compPhoneInput.addEventListener('input', (e) => localStorage.setItem('im_global_phone', e.target.value.trim()));
        compAddressInput.addEventListener('input', (e) => localStorage.setItem('im_global_address', e.target.value.trim()));

        isQuickMode = document.querySelector('input[name="est_mode"]:checked').value === 'quick';

        const savedLogo = localStorage.getItem('im_logo');
        const logoPreview = document.getElementById('logo-preview');
        if (savedLogo) {
            logoPreview.src = savedLogo;
            logoPreview.style.display = 'block';
        }

        document.getElementById('logo-upload').addEventListener('change', function() {
            const file = this.files[0];
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
                        localStorage.setItem('im_logo', base64);
                        logoPreview.src = base64;
                        logoPreview.style.display = 'block';
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        document.querySelectorAll('input[name="est_mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                isQuickMode = e.target.value === 'quick';
                if (window.gtag) window.gtag('event', 'select_content', { content_type: 'mode', item_id: e.target.value });
                document.querySelectorAll('.calc-row').forEach(row => {
                    const priceInput = row.querySelector('.price-input');
                    const itemSelect = row.querySelector('.item-select');
                    const cat = row.dataset.category;
                    
                    if (priceInput) {
                        if (itemSelect && itemSelect.value === 'CUSTOM') {
                            priceInput.disabled = false;
                        } else {
                            priceInput.disabled = isQuickMode;
                            if (isQuickMode && cat && materialsDb[cat]) {
                                const def = materialsDb[cat].find(i => i.id === itemSelect.value);
                                if (def) {
                                    priceInput.value = parseFloat(def.price).toFixed(2);
                                }
                            }
                        }
                    }
                    if (cat) calculateRowQuantity(row, cat);
                });
                saveState();
            });
        });

        document.querySelectorAll('.collapsible').forEach(h => h.onclick = () => h.parentElement.classList.toggle('collapsed'));
        
        markupSlider.oninput = (e) => markupDisplay.textContent = e.target.value + '%';['concrete', 'gravel', 'mulch', 'topsoil'].forEach(cat => {
            const wasteBtn = document.getElementById(`${cat}-waste-check`);
            if(wasteBtn) {
                wasteBtn.addEventListener('change', () => {
                    document.querySelectorAll(`#${cat}-rows-container .calc-row`).forEach(row => calculateRowQuantity(row, cat));
                    saveState();
                });
            }
        });['gravel-compaction-check', 'topsoil-settling-check', 'mulch-settling-check'].forEach(id => {
            const btn = document.getElementById(id);
            if(btn) {
                btn.addEventListener('change', (e) => {
                    const cat = id.split('-')[0];
                    document.querySelectorAll(`#${cat}-rows-container .calc-row`).forEach(row => calculateRowQuantity(row, cat));
                    saveState();
                });
            }
        });

        document.querySelectorAll('.module-toggle').forEach(t => t.addEventListener('change', (e) => {
            const d = document.getElementById(e.target.getAttribute('data-target'));
            if (e.target.checked) { 
                d.classList.add('active'); 
                if (d.querySelectorAll('.calc-row').length === 0) { 
                    if(e.target.value === 'labor') addLaborRow('person'); 
                    else addMaterialRow(e.target.value, `${e.target.value}-rows-container`); 
                } 
            } else {
                d.classList.remove('active');
            }
            saveState();
        }));
        
        document.getElementById('setup-view').addEventListener('input', (e) => { 
            if(e.target.closest('.calc-row')) { 
                const row = e.target.closest('.calc-row'); 
                if(row.dataset.category) calculateRowQuantity(row, row.dataset.category); 
            } 
            saveState(); 
        });

        document.getElementById('setup-view').addEventListener('click', (e) => {
            const row = e.target.closest('.calc-row');
            if (e.target.closest('.custom-select-trigger')) { 
                const d = e.target.closest('.custom-select-container').querySelector('.custom-select-dropdown'); 
                document.querySelectorAll('.custom-select-dropdown.show').forEach(el => el !== d && el.classList.remove('show')); 
                d.classList.toggle('show'); 
            }
            if (e.target.closest('.custom-option')) {
                const o = e.target.closest('.custom-option'), c = o.closest('.custom-select-container');
                c.querySelector('.custom-select-text').textContent = o.textContent; 
                c.querySelector('.item-select').value = o.dataset.value;
                if (o.dataset.value === 'CUSTOM') { 
                    c.style.display = 'none'; 
                    row.querySelector('.custom-mat-wrapper').style.display = 'flex'; 
                    row.querySelector('.price-input').disabled = false; 
                } else { 
                    row.querySelector('.price-input').value = parseFloat(o.dataset.price).toFixed(2); 
                    row.querySelector('.unit').textContent = o.dataset.unit + 's'; 
                    row.querySelector('.price-input').disabled = isQuickMode; 
                }
                calculateRowQuantity(row, row.dataset.category); 
                o.parentElement.classList.remove('show'); 
                saveState();
            }
            if (e.target.closest('.reset-mat-btn')) { 
                row.querySelector('.custom-mat-wrapper').style.display = 'none'; 
                row.querySelector('.custom-select-container').style.display = 'block'; 
                saveState(); 
            }
            
            if (e.target.classList.contains('add-shape-btn')) {
                const cat = row.dataset.category;
                const html = cat === 'paint' 
                    ? `<div class="shape-row"><div class="shape-inputs"><div class="unit-wrapper"><input type="number" class="glass-input d-l" placeholder="Length"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-h" placeholder="Height"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-coats" value="1" placeholder="Coats"><span class="unit">ct</span></div></div><button class="remove-shape-btn">&times;</button></div>` 
                    : `<div class="shape-row"><div class="shape-inputs"><div class="unit-wrapper"><input type="number" class="glass-input d-l" placeholder="Length"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-w" placeholder="Width"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-d" placeholder="Depth"><span class="unit">in</span></div></div><button class="remove-shape-btn">&times;</button></div>`;
                row.querySelector('.shapes-list').insertAdjacentHTML('beforeend', html); 
                saveState();
            }
            if (e.target.classList.contains('remove-shape-btn')) { 
                e.target.closest('.shape-row').remove(); 
                calculateRowQuantity(row, row.dataset.category); 
                saveState(); 
            }
            if (e.target.classList.contains('remove-row-btn')) { 
                e.target.closest('.calc-row').remove(); 
                saveState(); 
            }
        });
        
        document.getElementById('add-laborer-btn').onclick = () => addLaborRow('person');
        document.getElementById('add-vehicle-btn').onclick = () => addLaborRow('vehicle');
        categories.forEach(c => document.getElementById(`add-${c}-btn`).onclick = () => addMaterialRow(c, `${c}-rows-container`));
        
        loadState();
    }

    document.getElementById('calculateBtn').onclick = () => {
        let raw = 0, cons = 0;
        let csvData = "Category,Item/Name,Quantity,Unit,Unit Price,Total Cost\n";
        const csvEscape = (text) => `"${(text||'').replace(/"/g, '""')}"`;

        const getCost = (catId, catKey) => {
            let c = 0; const el = document.getElementById(catId);
            if (el && el.closest('.module-container').classList.contains('active')) { 
                el.querySelectorAll('.calc-row').forEach(r => {
                    const isCustom = r.querySelector('.item-select').value === 'CUSTOM';
                    const name = isCustom ? r.querySelector('.custom-mat-input').value : r.querySelector('.custom-select-text').textContent;
                    const qty = parseFloat(r.querySelector('.qty-input').value)||0;
                    const price = parseFloat(r.querySelector('.price-input').value)||0;
                    const unit = r.querySelector('.unit').textContent.replace('s', ''); 
                    
                    if (isCustom && name && price > 0) {
                        saveCustomMaterialToCloud(catKey, name, price, unit);
                    }

                    if (qty > 0) csvData += `${categoryNames[catKey]},${csvEscape(name)},${qty},${unit},${price},${qty*price}\n`;
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
        if (document.querySelector('input[value="labor"]')?.checked) {
            document.querySelectorAll('.labor-entry').forEach(entry => {
                const name = entry.querySelector('.glass-input[type="text"]').value || 'Labor/Vehicle';
                const qty = parseFloat(entry.querySelector('.qty-input').value)||0;
                const price = parseFloat(entry.querySelector('.price-input').value)||0;
                const unit = entry.dataset.type === 'vehicle' ? 'mi' : 'hrs';
                if (qty > 0) csvData += `Labor,${csvEscape(name)},${qty},${unit},${price},${qty*price}\n`;
                baseLabor += qty * price;
            });
        }

        const laborBurden = document.getElementById('labor-burden-check')?.checked ? baseLabor * 0.25 : 0;
        const laborTotal = baseLabor + laborBurden;

        const breakeven = raw + cons + laborTotal;
        const markupPct = parseFloat(markupSlider.value) / 100;
        const markup = breakeven * markupPct; 
        const mult = 1 + markupPct; 

        const taxRate = parseFloat(document.getElementById('meta-tax').value) || 0;
        const taxAmount = (raw + cons) * (taxRate / 100);
        const materialsCostForClient = (raw + cons) * mult;

        localStorage.setItem('im_csvData', csvData);

        const format = (n) => '$' + n.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        const total = breakeven + markup + taxAmount;
        if(window.gtag) window.gtag('event', 'generate_lead', { currency: 'USD', value: total });

        document.getElementById('res-project-title').textContent = document.getElementById('meta-project').value || "Project Estimate";
        document.getElementById('res-contractor-profit').textContent = format(markup);
        
        let contractorHTML = '';
        contractorHTML += `<div class="item-row" style="border-bottom: 1px dashed var(--border-glass); padding-bottom: 12px; margin-bottom: 12px; font-weight: 700; font-size: 1.1rem; color: #f8fafc;"><span>Total Breakeven Cost</span> <span>-${format(breakeven)}</span></div>`;
        contractorHTML += `<div class="item-row" style="color: #34d399; font-weight: 700; margin-bottom: 15px;"><span>Built-in Markup (${markupSlider.value}%)</span> <span>+${format(markup)}</span></div>`;
        
        if (baseLabor > 0) contractorHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Total Base Labor & Fleet</span> <span>-${format(baseLabor)}</span></div>`;
        if (laborBurden > 0) contractorHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Labor Burden (Taxes/Ins)</span> <span>-${format(laborBurden)}</span></div>`;
        for (const [key, val] of Object.entries(costs)) {
            if (val > 0) contractorHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• ${categoryNames[key]}</span> <span>-${format(val)}</span></div>`;
        }
        if (cons > 0) contractorHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Shop Consumables</span> <span>-${format(cons)}</span></div>`;
        document.getElementById('dynamic-breakdown').innerHTML = contractorHTML;

        document.getElementById('res-client-total').textContent = format(total);

        let clientHTML = '';
        clientHTML += `<div class="item-row" style="font-weight: 700; font-size: 1.15rem; padding-bottom: 5px;"><span>Total Bid</span> <span>${format(total)}</span></div>`;
        clientHTML += `<div class="item-row" style="color: #38bdf8; font-weight: 700; margin-bottom: 15px; border-bottom: 1px dashed var(--border-glass); padding-bottom: 15px;"><span>50% Deposit Due</span> <span>${format(total * 0.5)}</span></div>`;
        
        if (laborTotal > 0) {
            clientHTML += `<div class="item-row" style="font-weight: 600;"><span>Project Labor & Fleet</span> <span>${format(baseLabor * mult)}</span></div>`;
            if (laborBurden > 0) clientHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Burden & Insurance</span> <span>${format(laborBurden * mult)}</span></div>`;
        }
        
        clientHTML += `<div class="item-row" style="font-weight: 600; padding-top: 5px;"><span>Itemized Materials & Supplies</span> <span>${format(materialsCostForClient)}</span></div>`;
        
        for (const [key, val] of Object.entries(costs)) {
            if (val > 0) clientHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• ${categoryNames[key]}</span> <span>${format(val * mult)}</span></div>`;
        }
        if (cons > 0) clientHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Shop Consumables</span> <span>${format(cons * mult)}</span></div>`;
        
        if (taxAmount > 0) {
            clientHTML += `<div class="item-row" style="font-size: 0.95rem; padding: 6px 0; border: none; color: var(--text-muted);"><span>• Estimated Sales Tax (${taxRate}%)</span> <span>${format(taxAmount)}</span></div>`;
        }

        document.getElementById('client-dynamic-breakdown').innerHTML = clientHTML;
        
        document.getElementById('setup-view').classList.replace('active-view', 'hidden-view');
        setTimeout(() => { document.getElementById('results-view').classList.replace('hidden-view', 'active-view'); window.scrollTo(0,0); }, 300);

        window.renderDownloadOptions = async function() {
            const downloadBtn = document.getElementById('downloadPdfTrigger');
            const parent = downloadBtn.parentElement;
            
            let warningEl = document.getElementById('branding-warning');
            if (!localStorage.getItem('im_global_company')) {
                if (!warningEl) {
                    warningEl = document.createElement('div');
                    warningEl.id = 'branding-warning';
                    warningEl.innerHTML = `⚠️ <strong>Your PDF is currently unbranded.</strong><br>Click here to add your Company Name & Logo to the top.`;
                    warningEl.style.cssText = "background: rgba(251, 113, 133, 0.1); border: 1px solid #fb7185; color: #fb7185; padding: 15px; border-radius: 12px; margin-top: 25px; margin-bottom: -10px; font-size: 0.95rem; cursor: pointer; text-align: left; line-height: 1.4;";
                    warningEl.onclick = () => document.getElementById('profileModal').classList.add('show');
                    parent.insertBefore(warningEl, downloadBtn);
                } else {
                    warningEl.style.display = 'block';
                }
            } else if (warningEl) {
                warningEl.style.display = 'none';
            }

            if (!window.currentUser) {
                downloadBtn.textContent = "Sign in to Download PDF";
                downloadBtn.style.background = "transparent";
                downloadBtn.style.border = "1px solid var(--border-glass)";
                downloadBtn.style.color = "var(--text-main)";
                downloadBtn.style.display = 'block';
                downloadBtn.onclick = () => {
                    document.getElementById('authModal').classList.add('show');
                };
                return;
            }

            const { data, error } = await window.supabaseClient
                .from('users')
                .select('subscription_status')
                .eq('id', window.currentUser.id)
                .single();

            const isDbActive = data && data.subscription_status === 'active';
            const isTempActive = localStorage.getItem('im_temp_sub_active') === 'true';

            if (isDbActive || isTempActive) {
                downloadBtn.textContent = "Download Official PDF";
                downloadBtn.style.background = "linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%)";
                downloadBtn.style.border = "none";
                downloadBtn.style.color = "#0f172a";
                downloadBtn.style.display = 'block';
                
                downloadBtn.onclick = async () => {
                    saveDataForPdf();
                    await window.saveBidToCloud(total, false);
                    window.location.href = './success';
                };
            } else {
                downloadBtn.textContent = "Subscribe to Download ($19.99/mo)";
                downloadBtn.style.background = "var(--gradient-primary)";
                downloadBtn.style.border = "none";
                downloadBtn.style.color = "#0f172a";
                downloadBtn.style.display = 'block';
                
                downloadBtn.onclick = async () => {
                    if(!localStorage.getItem('im_global_company') && !confirm("Your PDF doesn't have a Company Name set. Continue anyway?")) {
                        document.getElementById('profileModal').classList.add('show');
                        return;
                    }
                    if(window.gtag) window.gtag('event', 'begin_checkout', { currency: 'USD', value: 19.99, items:[{item_id: 'pro_sub'}] });
                    saveDataForPdf();
                    await window.saveBidToCloud(total, false);
                    const checkoutUrl = new URL('https://buy.stripe.com/3cI4gB94XcDba9I7oe0co00');
                    checkoutUrl.searchParams.set('client_reference_id', window.currentUser.id);
                    window.location.href = checkoutUrl.toString();
                };
            }
        };

        window.renderDownloadOptions();

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
    };
    
    document.getElementById('resetBidBtn').onclick = () => { 
        if(confirm("Clear this bid and start fresh?")) { 
            currentBidId = null;
            document.querySelectorAll('#setup-view input[type="text"], #setup-view input[type="number"], #setup-view input[type="date"]').forEach(el => el.value = '');
            document.getElementById('client-select').value = '';
            categories.concat(['labor']).forEach(c => {
                const container = document.getElementById(`${c}-rows-container`);
                if(container) container.innerHTML = '';
            });
            saveState();
        } 
    };
    
    document.getElementById('editBtn').onclick = () => { 
        document.getElementById('results-view').classList.replace('active-view', 'hidden-view'); 
        setTimeout(() => document.getElementById('setup-view').classList.replace('hidden-view', 'active-view'), 300); 
    };

    document.getElementById('exportCSVBtn').onclick = () => {
        if(window.gtag) window.gtag('event', 'file_download', { file_extension: 'csv', file_name: 'Material_Run_List' });
        const csv = localStorage.getItem('im_csvData') || 'No data generated';
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'Material_Run_List.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    window.addEventListener('focus', () => {
        if (window.currentUser && window.supabaseClient && typeof window.renderDownloadOptions === 'function') {
            window.supabaseClient.from('users').select('subscription_status').eq('id', window.currentUser.id).single()
                .then(({data, error}) => {
                    if (!error && data) {
                        window.renderDownloadOptions();
                    }
                });
        }
    });
});
