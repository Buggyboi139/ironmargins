window.currentBidId = null;
window.activeCloseoutBidId = null;
window.activeCloseoutBidData = {};
window._isSavingBid = false;

const escapeHTML = (str) => String(str).replace(/[&<>'"]/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[match]);

window.switchBidTab = function(tab) {
    document.getElementById('tab-active').classList.toggle('active', tab === 'active');
    document.getElementById('tab-closed').classList.toggle('active', tab === 'closed');
    document.getElementById('activeBidsList').style.display = tab === 'active' ? 'block' : 'none';
    document.getElementById('closedBidsList').style.display = tab === 'closed' ? 'block' : 'none';
};

window.refreshSavedBids = async function() {
    const activeList = document.getElementById('activeBidsList');
    const closedList = document.getElementById('closedBidsList');
    
    if (!window.currentUser || !window.supabaseClient) {
        activeList.innerHTML = '<div class="dropdown-empty">Sign in to see saved bids</div>';
        closedList.innerHTML = '';
        return;
    }

    if (window.fetchUserProfile) await window.fetchUserProfile();
    if (window.fetchClients) await window.fetchClients();

    activeList.innerHTML = '<div class="dropdown-empty">Loading bids...</div>';

    const { data, error } = await window.supabaseClient
        .from('bids')
        .select('id, project_name, created_at, status, actual_profit, pdf_url, clients(name)')
        .eq('user_id', window.currentUser.id)
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        activeList.innerHTML = '<div class="dropdown-empty">No saved bids yet.</div>';
        closedList.innerHTML = '<div class="dropdown-empty">No closed jobs yet.</div>';
        return;
    }

    const buildHtml = (bidsArray, isClosed) => {
        let html = '';
        bidsArray.forEach(bid => {
            const dateStr = new Date(bid.created_at).toLocaleDateString();
            const client = escapeHTML((bid.clients && bid.clients.name) ? bid.clients.name : 'Draft Client');
            const project = escapeHTML(bid.project_name || 'Unnamed Project');
            
            if (isClosed) {
                const profitColor = parseFloat(bid.actual_profit) >= 0 ? '#10b981' : '#fb7185';
                html += `
                    <div class="nav-bid-item" onclick="window.handleLoadBid('${bid.id}')" style="cursor:pointer; flex-direction:column; align-items:flex-start;">
                        <div style="display:flex; justify-content:space-between; width:100%;">
                            <span class="bid-title">${client} - ${project}</span>
                            <span style="color:${profitColor}; font-weight:700; font-size:0.9rem;">$${parseFloat(bid.actual_profit||0).toFixed(2)}</span>
                        </div>
                        <span class="bid-date">${dateStr}</span>
                    </div>`;
            } else {
                html += `
                    <div class="nav-bid-item">
                        <div onclick="window.handleLoadBid('${bid.id}')" style="flex:1; cursor:pointer;">
                            <span class="bid-title">${client} - ${project}</span>
                            <span class="bid-date">${dateStr}</span>
                        </div>
                        <div class="bid-actions">
                            <button onclick="window.duplicateBid('${bid.id}'); event.stopPropagation();" class="bid-action-btn" style="color:#38bdf8;" title="Duplicate">Dup</button>
                            <button onclick="window.openCloseout('${bid.id}'); event.stopPropagation();" class="bid-action-btn" style="color:#34d399;" title="Close Out">Close</button>
                            <button onclick="window.deleteBid('${bid.id}'); event.stopPropagation();" class="bid-action-btn" style="color:#fb7185;" title="Delete">Del</button>
                        </div>
                    </div>`;
            }
        });
        return html || `<div class="dropdown-empty">No ${isClosed ? 'closed' : 'active'} bids.</div>`;
    };

    const activeBids = data.filter(b => b.status === 'active');
    const closedBids = data.filter(b => b.status === 'closed');

    activeList.innerHTML = buildHtml(activeBids, false);
    closedList.innerHTML = buildHtml(closedBids, true);
};

window.handleLoadBid = async function(bidId) {
    if (window.closeSideMenu) window.closeSideMenu();
    
    const { data, error } = await window.supabaseClient.from('bids').select('*').eq('id', bidId).single();
    if (error || !data) return;

    window.currentBidId = data.id;
    document.getElementById('client-select').value = data.client_id || '';
    document.getElementById('meta-project').value = data.project_name === 'Draft Project' ? '' : data.project_name;

    if (data.bid_data) window.loadState(data.bid_data);
    
    document.getElementById('closed-banner').style.display = 'none';
    document.getElementById('editBtn').style.display = 'block';
    document.getElementById('payment-signature-section').style.display = 'block';
    document.querySelectorAll('.add-row-btn, .remove-row-btn, .add-shape-btn, .remove-shape-btn').forEach(el => el.style.display = '');

    if (data.status === 'closed') {
        setTimeout(() => {
            const calculateBtn = document.getElementById('calculateBtn');
            if (calculateBtn) calculateBtn.click();
            
            document.getElementById('editBtn').style.display = 'none';
            document.getElementById('payment-signature-section').style.display = 'none';
            document.querySelectorAll('.add-row-btn, .remove-row-btn, .add-shape-btn, .remove-shape-btn').forEach(el => el.style.display = 'none');
            
            const banner = document.getElementById('closed-banner');
            banner.style.display = 'flex';
            banner.querySelector('#closed-profit-val').textContent = `$${parseFloat(data.actual_profit||0).toFixed(2)}`;
            banner.querySelector('#closed-profit-val').style.color = parseFloat(data.actual_profit) >= 0 ? '#10b981' : '#fb7185';
            
            const pdfBtn = banner.querySelector('#closed-view-pdf');
            if (data.pdf_url) {
                pdfBtn.style.display = 'inline-block';
                pdfBtn.onclick = () => window.open(data.pdf_url, '_blank');
            } else {
                pdfBtn.style.display = 'none';
            }
        }, 100);
    } else {
        document.getElementById('results-view').classList.replace('active-view', 'hidden-view'); 
        document.getElementById('setup-view').classList.replace('hidden-view', 'active-view');
        window.scrollTo(0,0);
    }
};

window.duplicateBid = async function(bidId) {
    if (window.closeSideMenu) window.closeSideMenu();
    await window.loadBidFromCloud(bidId);
    window.currentBidId = null; 
    const projInput = document.getElementById('meta-project');
    if(projInput.value) projInput.value = projInput.value + ' (Copy)';
    window.saveState();
    
    document.getElementById('closed-banner').style.display = 'none';
    document.getElementById('editBtn').style.display = 'block';
    document.getElementById('payment-signature-section').style.display = 'block';
    document.querySelectorAll('.add-row-btn, .remove-row-btn, .add-shape-btn, .remove-shape-btn').forEach(el => el.style.display = '');

    document.getElementById('results-view').classList.replace('active-view', 'hidden-view'); 
    document.getElementById('setup-view').classList.replace('hidden-view', 'active-view');
    window.scrollTo(0,0);
};

window.deleteBid = async function(bidId) {
    if (!confirm("Permanently delete this bid?")) return;
    
    const { error } = await window.supabaseClient.from('bids').delete().eq('id', bidId);
    if (!error) {
        if (window.currentBidId === bidId) window.currentBidId = null;
        window.refreshSavedBids();
    }
};

window.openCloseout = async function(bidId) {
    document.getElementById('closeoutModal').classList.add('show');
    const { data, error } = await window.supabaseClient.from('bids').select('*').eq('id', bidId).single();
    if (error || !data) return;

    window.activeCloseoutBidId = bidId;

    let estMat = 0;
    let estLab = 0;
    let estSub = 0;

    if (data.bid_data.categories) {
        Object.values(data.bid_data.categories).forEach(cat => {
            cat.forEach(item => { estMat += (parseFloat(item.qty)||0) * (parseFloat(item.price)||0); });
        });
    }
    if (data.bid_data.labor) {
        data.bid_data.labor.forEach(item => { estLab += (parseFloat(item.qty)||0) * (parseFloat(item.price)||0); });
    }
    if (data.bid_data.subs) {
        data.bid_data.subs.forEach(item => { estSub += (parseFloat(item.price)||0); });
    }

    const totalBid = data.total_amount || 0;
    const estTotalCost = estMat + estLab + estSub;

    document.getElementById('closeout-bid-info').textContent = data.project_name || 'Unnamed Project';
    document.getElementById('closeout-est-bid').textContent = `$${totalBid.toFixed(2)}`;
    document.getElementById('closeout-est-cost').textContent = `$${estTotalCost.toFixed(2)}`;

    const matInput = document.getElementById('closeout-actual-mat');
    const labInput = document.getElementById('closeout-actual-lab');
    const subInput = document.getElementById('closeout-actual-sub');
    const notesInput = document.getElementById('closeout-notes');
    const profitDisplay = document.getElementById('closeout-actual-profit');

    matInput.value = data.actual_materials || '';
    labInput.value = data.actual_labor || '';
    subInput.value = data.actual_subs || '';
    notesInput.value = data.closeout_notes || '';

    const updateProfit = () => {
        const actMat = parseFloat(matInput.value) || 0;
        const actLab = parseFloat(labInput.value) || 0;
        const actSub = parseFloat(subInput.value) || 0;
        const actProfit = totalBid - (actMat + actLab + actSub);
        profitDisplay.textContent = `$${actProfit.toFixed(2)}`;
        profitDisplay.style.color = actProfit >= 0 ? '#10b981' : '#fb7185';
    };

    matInput.oninput = updateProfit;
    labInput.oninput = updateProfit;
    subInput.oninput = updateProfit;
    updateProfit();
};

window.submitCloseout = async function() {
    if (!window.activeCloseoutBidId) return;

    const actMat = parseFloat(document.getElementById('closeout-actual-mat').value) || 0;
    const actLab = parseFloat(document.getElementById('closeout-actual-lab').value) || 0;
    const actSub = parseFloat(document.getElementById('closeout-actual-sub').value) || 0;
    const actNotes = document.getElementById('closeout-notes').value;
    const totalBid = parseFloat(document.getElementById('closeout-est-bid').textContent.replace('$', '')) || 0;
    const actProfit = totalBid - (actMat + actLab + actSub);

    const { error } = await window.supabaseClient.from('bids').update({
        status: 'closed',
        actual_materials: actMat,
        actual_labor: actLab,
        actual_subs: actSub,
        actual_profit: actProfit,
        closeout_notes: actNotes
    }).eq('id', window.activeCloseoutBidId);

    if (!error) {
        document.getElementById('closeoutModal').classList.remove('show');
        document.getElementById('resetBidBtn').click();
        window.refreshSavedBids();
        window.switchBidTab('closed');
    }
};

window.saveBidToCloud = async function(totalAmount = 0, isAutosaving = false) {
    if (!window.currentUser || !window.supabaseClient) return false;
    if (window._isSavingBid) return false;
    window._isSavingBid = true;

    try {
        if (!window.currentBidId) {
            const { count, error: countError } = await window.supabaseClient
                .from('bids').select('*', { count: 'exact', head: true }).eq('user_id', window.currentUser.id);
            
            const { data: subData } = await window.supabaseClient.from('users').select('subscription_status').eq('id', window.currentUser.id).maybeSingle();
            
            const subStatus = subData && subData.subscription_status ? String(subData.subscription_status).toLowerCase().trim() : '';
            const metaSubStatus = window.currentUser.user_metadata?.subscription_status ? String(window.currentUser.user_metadata.subscription_status).toLowerCase().trim() : '';
            
            const isSubActive = ['active', 'trialing'].includes(subStatus) || ['active', 'trialing'].includes(metaSubStatus);
            const isActive = isSubActive || localStorage.getItem('im_temp_sub_active') === 'true';

            if (!countError && count >= 3 && !isActive) {
                if (!isAutosaving) {
                    alert("You have reached your limit of 3 free bids. Please upgrade to Pro to generate more estimates.");
                }
                return "LIMIT_REACHED";
            }
        }

        if (!isAutosaving) window.saveState(true);

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

        if (window.currentBidId) {
            await window.supabaseClient.from('bids').update(payload).eq('id', window.currentBidId);
        } else {
            const { data, error } = await window.supabaseClient.from('bids').insert([payload]).select().single();
            if (error) throw error;
            if (data) window.currentBidId = data.id;
            if (window.refreshSavedBids) window.refreshSavedBids();
        }
        if (window.gtag && !isAutosaving) window.gtag('event', 'save_bid');
        return true;
    } catch (error) {
        return false;
    } finally {
        window._isSavingBid = false;
    }
};

window.loadBidFromCloud = async function(bidId) {
    if (!window.supabaseClient) return;
    const { data, error } = await window.supabaseClient.from('bids').select('*').eq('id', bidId).single();
    if (error || !data) return;

    window.currentBidId = data.id;
    document.getElementById('client-select').value = data.client_id || '';
    document.getElementById('meta-project').value = data.project_name === 'Draft Project' ? '' : data.project_name;

    if (data.bid_data) window.loadState(data.bid_data);
};
