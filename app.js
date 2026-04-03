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

    window.supabaseClient?.auth?.onAuthStateChange((event, session) => {
        const hasUser = !!(session && session.user);
        document.querySelectorAll('.template-btn-auth').forEach(btn => {
            btn.style.display = hasUser ? 'block' : 'none';
        });
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

    document.getElementById('openClientModalBtn')?.addEventListener('click', () => document.getElementById('clientModal').classList.add('show'));
    document.getElementById('closeClientModal')?.addEventListener('click', () => document.getElementById('clientModal').classList.remove('show'));
    
    document.getElementById('profileBtn')?.addEventListener('click', () => { 
        window.closeSideMenu(); 
        document.getElementById('profileModal').classList.add('show'); 
    });
    document.getElementById('closeProfileModal')?.addEventListener('click', () => document.getElementById('profileModal').classList.remove('show'));

    document.getElementById('openStarterTemplatesBtn')?.addEventListener('click', () => {
        const list = document.getElementById('starter-template-list');
        list.innerHTML = (window.starterTemplates || []).map(t => `
            <div style="padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 10px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1);" 
                 onclick="window.loadStarterTemplate('${t.id}')">
                <span style="font-weight:bold; color:#38bdf8;">${t.name}</span>
            </div>
        `).join('');
        document.getElementById('starterTemplateModal').classList.add('show');
    });

    window.loadStarterTemplate = function(id) {
        const t = (window.starterTemplates || []).find(x => x.id === id);
        if (t) {
            window.loadState(t.data);
            window.saveState();
            document.getElementById('results-view').classList.replace('active-view', 'hidden-view'); 
            document.getElementById('setup-view').classList.replace('hidden-view', 'active-view');
            window.scrollTo(0,0);
        }
        document.getElementById('starterTemplateModal').classList.remove('show');
    }

    const materialsBtn = document.getElementById('materialsBtn');
    const materialsModal = document.getElementById('materialsModal');
    const closeMaterialsModal = document.getElementById('closeMaterialsModal');
    const catManageSelect = document.getElementById('cat-manage-select');
    const materialsManageList = document.getElementById('materials-manage-list');
    const saveMaterialsBtn = document.getElementById('saveMaterialsBtn');

    if(materialsBtn) materialsBtn.addEventListener('click', () => {
        window.closeSideMenu();
        materialsModal.classList.add('show');
        catManageSelect.innerHTML = window.categories.map(c => `<option value="${c}">${window.categoryNames[c]}</option>`).join('');
        renderManageList();
    });
    
    if(closeMaterialsModal) closeMaterialsModal.addEventListener('click', () => materialsModal.classList.remove('show'));
    if(catManageSelect) catManageSelect.addEventListener('change', renderManageList);

    function renderManageList() {
        const cat = catManageSelect.value;
        const items = window.materialsDb[cat] || [];
        materialsManageList.innerHTML = items.filter(i => !i.id.startsWith('custom_')).map(i => {
            const safeName = String(i.name).replace(/[&<>'"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[m]);
            return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
                <span style="font-size:0.9rem; flex:1; padding-right:10px;">${safeName}</span>
                <div class="unit-wrapper icon-prefix" style="max-width:120px;">
                    <span class="prefix">$</span>
                    <input type="number" class="glass-input mat-price-edit" data-cat="${cat}" data-name="${safeName}" data-unit="${i.unit}" value="${parseFloat(i.price).toFixed(2)}" style="padding:8px; padding-left:25px; font-size:0.9rem !important;">
                </div>
            </div>
            `;
        }).join('');
    }

    if(saveMaterialsBtn) saveMaterialsBtn.addEventListener('click', async () => {
        saveMaterialsBtn.textContent = 'Saving...';
        const inputs = materialsManageList.querySelectorAll('.mat-price-edit');
        for(let inp of inputs) {
            const price = parseFloat(inp.value);
            const name = inp.dataset.name;
            const cat = inp.dataset.cat;
            const unit = inp.dataset.unit;
            
            const defaultItem = window.materialsDb[cat].find(i => i.name === name);
            if(defaultItem && defaultItem.price !== price) {
                defaultItem.price = price;
                await saveCustomMaterialToCloud(cat, name, price, unit);
            }
        }
        saveMaterialsBtn.textContent = 'Saved!';
        setTimeout(() => {
            saveMaterialsBtn.textContent = 'Save Prices';
            materialsModal.classList.remove('show');
        }, 1000);
    });

    async function saveCustomMaterialToCloud(category, name, price, unit) {
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
    }

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
                } else {
                    if (!window.materialsDb[mat.category].find(m => m.id === `custom_${mat.id}`)) {
                        window.materialsDb[mat.category].push({
                            id: `custom_${mat.id}`,
                            name: `${mat.name}`,
                            unit: mat.unit,
                            price: parseFloat(mat.price)
                        });
                    }
                }
            });
        }
    };

    window.fetchClients = async function() {
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
    };

    window.fetchUserProfile = async function() {
        if (!window.currentUser || !window.supabaseClient) return;
        const { data, error } = await window.supabaseClient
            .from('users')
            .select('company_name, phone, address, payment_link, logo_data, custom_terms')
            .eq('id', window.currentUser.id)
            .single();

        if (data && !error) {
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

    document.getElementById('client-select')?.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        if(selectedOption) {
            localStorage.setItem('im_clientName', selectedOption.textContent);
            localStorage.setItem('im_clientAddress', selectedOption.dataset.address || '');
        }
        window.saveState();
    });

    document.getElementById('btn-save-client')?.addEventListener('click', async () => {
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
            await window.fetchClients(); 
        }
    });

    document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
        const paymentLinkInput = document.getElementById('payment-link');
        const compInput = document.getElementById('meta-company');
        const compPhoneInput = document.getElementById('meta-company-phone');
        const compAddressInput = document.getElementById('meta-company-address');
        const termsInput = document.getElementById('profile-custom-terms');

        if (paymentLinkInput) localStorage.setItem('im_payment_link', paymentLinkInput.value);
        if (compInput) localStorage.setItem('im_global_company', compInput.value);
        if (compPhoneInput) localStorage.setItem('im_global_phone', compPhoneInput.value);
        if (compAddressInput) localStorage.setItem('im_global_address', compAddressInput.value);
        if (termsInput) localStorage.setItem('im_custom_terms', termsInput.value);

        if (window.currentUser && window.supabaseClient) {
            const logoData = localStorage.getItem('im_logo');
            await window.supabaseClient.from('users').upsert({
                id: window.currentUser.id,
                company_name: compInput ? compInput.value : '',
                phone: compPhoneInput ? compPhoneInput.value : '',
                address: compAddressInput ? compAddressInput.value : '',
                payment_link: paymentLinkInput ? paymentLinkInput.value : '',
                logo_data: logoData || '',
                custom_terms: termsInput ? termsInput.value : ''
            });
        }
        
        document.getElementById('profileModal').classList.remove('show');
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
                    localStorage.setItem('im_logo', base64);
                    logoPreview.src = base64;
                    logoPreview.style.display = 'block';
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('closeCloseoutModal')?.addEventListener('click', () => document.getElementById('closeoutModal').classList.remove('show'));

    const resetBtn = document.getElementById('resetBidBtn');
    if(resetBtn) {
        resetBtn.onclick = () => { 
            if(confirm("Clear this bid and start fresh?")) { 
                window.currentBidId = null;
                document.querySelectorAll('#setup-view input[type="text"], #setup-view input[type="number"], #setup-view input[type="date"], #setup-view textarea').forEach(el => el.value = '');
                document.getElementById('client-select').value = '';
                window.categories.concat(['labor']).forEach(c => { 
                    const container = document.getElementById(`${c}-rows-container`); 
                    if(container) container.innerHTML = ''; 
                });
                const subsContainer = document.getElementById('subs-rows-container');
                if (subsContainer) subsContainer.innerHTML = '';
                
                document.getElementById('closed-banner').style.display = 'none';
                document.getElementById('setup-view').classList.replace('hidden-view', 'active-view');
                document.getElementById('results-view').classList.replace('active-view', 'hidden-view');
                document.getElementById('editBtn').style.display = 'block';
                document.getElementById('payment-signature-section').style.display = 'block';
                document.querySelectorAll('.add-row-btn, .remove-row-btn, .add-shape-btn, .remove-shape-btn').forEach(el => el.style.display = '');

                window.saveState();
            } 
        };
    }

    const editBtn = document.getElementById('editBtn');
    if(editBtn) {
        editBtn.onclick = () => { 
            document.getElementById('results-view').classList.replace('active-view', 'hidden-view'); 
            setTimeout(() => document.getElementById('setup-view').classList.replace('hidden-view', 'active-view'), 300); 
        };
    }

    document.getElementById('manualSaveBtn')?.addEventListener('click', async () => {
        const manualSaveBtn = document.getElementById('manualSaveBtn');
        manualSaveBtn.textContent = 'Saving...';
        await window.saveBidToCloud(0, false);
        manualSaveBtn.textContent = 'Saved!';
        setTimeout(() => manualSaveBtn.textContent = 'Save Bid', 2000);
    });

    document.getElementById('setup-view')?.addEventListener('input', (e) => { 
        if(e.target.closest('.calc-row')) { 
            const row = e.target.closest('.calc-row'); 
            if(row.dataset.category) window.calculateRowQuantity(row, row.dataset.category); 
        } 
        window.saveState(); 
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
            if (o.dataset.value === 'CUSTOM') { 
                c.style.display = 'none'; 
                row.querySelector('.custom-mat-wrapper').style.display = 'flex'; 
            } else { 
                row.querySelector('.price-input').value = parseFloat(o.dataset.price).toFixed(2); 
                row.querySelector('.unit').textContent = o.dataset.unit + 's'; 
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
            const html = cat === 'paint' 
                ? `<div class="shape-row"><div class="shape-inputs"><div class="unit-wrapper"><input type="number" class="glass-input d-l" placeholder="Length"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-h" placeholder="Height"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-coats" value="1" placeholder="Coats"><span class="unit">ct</span></div></div><button class="remove-shape-btn">Del</button></div>` 
                : `<div class="shape-row"><div class="shape-inputs"><div class="unit-wrapper"><input type="number" class="glass-input d-l" placeholder="Length"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-w" placeholder="Width"><span class="unit">ft</span></div><div class="unit-wrapper"><input type="number" class="glass-input d-d" placeholder="Depth"><span class="unit">in</span></div></div><button class="remove-shape-btn">Del</button></div>`;
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

    ['concrete', 'gravel', 'mulch', 'topsoil'].forEach(cat => {
        const wasteBtn = document.getElementById(`${cat}-waste-check`);
        if(wasteBtn) {
            wasteBtn.addEventListener('change', () => {
                document.querySelectorAll(`#${cat}-rows-container .calc-row`).forEach(row => window.calculateRowQuantity(row, cat));
                window.saveState();
            });
        }
    });
    
    ['gravel-compaction-check', 'topsoil-settling-check', 'mulch-settling-check'].forEach(id => {
        const btn = document.getElementById(id);
        if(btn) {
            btn.addEventListener('change', () => {
                const cat = id.split('-')[0];
                document.querySelectorAll(`#${cat}-rows-container .calc-row`).forEach(row => window.calculateRowQuantity(row, cat));
                window.saveState();
            });
        }
    });

    window.addEventListener('focus', () => {
        if (window.currentUser && window.supabaseClient && typeof window.renderDownloadOptions === 'function') {
            window.supabaseClient.from('users').select('subscription_status').eq('id', window.currentUser.id).maybeSingle()
                .then(({data, error}) => {
                    if (!error && data) {
                        window.renderDownloadOptions();
                    }
                });
        }
    });

    fetch('materials.json')
        .then(res => res.json())
        .then(data => { 
            window.materialsDb = data; 
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
        appTitle.textContent = globalComp + ' Estimates';
    }
    if (globalPhone && compPhoneInput) compPhoneInput.value = globalPhone;
    if (globalAddress && compAddressInput) compAddressInput.value = globalAddress;
    if (savedPaymentLink && paymentLinkInput) paymentLinkInput.value = savedPaymentLink;
    if (savedTerms && termsInput) termsInput.value = savedTerms;

    compInput?.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        appTitle.textContent = val ? val + ' Estimates' : 'Never Underbid Again';
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
