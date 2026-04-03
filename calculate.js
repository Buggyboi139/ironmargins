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

            const { count } = await window.supabaseClient
                .from('bids')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', window.currentUser.id);

            const { data } = await window.supabaseClient
                .from('users')
                .select('subscription_status')
                .eq('id', window.currentUser.id)
                .maybeSingle();

            const subStatus = data && data.subscription_status ? String(data.subscription_status).toLowerCase().trim() : '';
            const metaSubStatus = window.currentUser.user_metadata?.subscription_status ? String(window.currentUser.user_metadata.subscription_status).toLowerCase().trim() : '';
            
            const isSubActive = ['active', 'trialing'].includes(subStatus) || ['active', 'trialing'].includes(metaSubStatus);
            const isTempActive = localStorage.getItem('im_temp_sub_active') === 'true';

            const savedBidsCount = count || 0;
            const isEditingExistingFreeBid = window.currentBidId && savedBidsCount <= 3;
            const isUnderFreeLimit = !window.currentBidId && savedBidsCount < 3;
            const isFreeTierValid = isUnderFreeLimit || isEditingExistingFreeBid;

            if (isSubActive || isTempActive || isFreeTierValid) {
                
                let btnText = "Review & Generate Proposal";
                if (!isSubActive && !isTempActive) {
                    const currentBidNum = window.currentBidId ? savedBidsCount : savedBidsCount + 1;
                    btnText = `Review & Generate (Free Bid ${currentBidNum}/3)`;
                }

                downloadBtn.textContent = btnText;
                downloadBtn.style.background = "linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%)";
                downloadBtn.style.border = "none";
                downloadBtn.style.color = "#0f172a";
                downloadBtn.style.display = 'block';
                
                downloadBtn.onclick = async () => {
                    saveDataForPdf();
                    const totalAmount = parseFloat(localStorage.getItem('im_grandTotal')) || 0;
                    
                    const saveSuccess = await window.saveBidToCloud(totalAmount, false);
                    if (saveSuccess !== false) {
                        window.location.href = './success';
                    } else {
                        alert("Unable to save bid. You may have reached your free tier limit.");
                    }
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
                    
                    const checkoutUrl = new URL('https://buy.stripe.com/bJefZj3KD32BdlU6ka0co03');
                    checkoutUrl.searchParams.set('client_reference_id', window.currentUser.id);
                    window.location.href = checkoutUrl.toString();
                };
            }
        };
