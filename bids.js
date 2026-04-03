window.currentBidId = null;
window.activeCloseoutBidId = null;
window.activeCloseoutBidData = {};

window.refreshSavedBids = async function() {
    const recentList = document.getElementById('recentBidsList');
    const moreList = document.getElementById('moreBidsList');
    const showMoreBtn = document.getElementById('showMoreBidsBtn');
    
    if (!window.currentUser || !window.supabaseClient) {
        recentList.innerHTML = '<div class="dropdown-empty">Sign in to see saved bids</div>';
        showMoreBtn.style.display = 'none';
        moreList.innerHTML = '';
        return;
    }

    if (window.fetchUserProfile) await window.fetchUserProfile();
    if (window.fetchClients) await window.fetchClients();

    recentList.innerHTML = '<div class="dropdown-empty">Loading bids...</div>';

    const { data, error } = await window.supabaseClient
        .from('bids')
        .select('id, project_name, created_at, clients(name)')
        .eq('user_id', window.currentUser.id)
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        recentList.innerHTML = '<div class="dropdown-empty">No saved bids yet.</div>';
        showMoreBtn.style.display = 'none';
        moreList.innerHTML = '';
        return;
    }

    const buildHtml = (bidsArray) => {
        let html = '';
        bidsArray.forEach(bid => {
            const dateStr = new Date(bid.created_at).toLocaleDateString();
            const client = (bid.clients && bid.clients.name) ? bid.clients.name : 'Draft Client';
            const project = bid.project_name || 'Unnamed Project';
            
            html += `
                <div class="nav-bid-item">
                    <div onclick="window.handleLoadBid('${bid.id}')" style="flex:1; cursor:pointer;">
                        <span class="bid-title">${client} - ${project}</span>
                        <span class="bid-date">${dateStr}</span>
                    </div>
                    <div class="bid-actions">
                        <button onclick="window.duplicateBid('${bid.id}'); event.stopPropagation();" class="bid-action-btn" style="color:#38bdf8;" title="Duplicate">⎘</button>
                        <button onclick="window.openCloseout('${bid.id}'); event.stopPropagation();" class="bid-action-btn" style="color:#34d399;" title="Close Out">✓</button>
                        <button onclick="window.deleteBid('${bid.id}'); event.stopPropagation();" class="bid-action-btn" style="color:#fb7185;" title="Delete">×</button>
                    </div>
                </div>`;
        });
        return html;
    };

    recentList.innerHTML = buildHtml(data.slice(0, 3));

    if (data.length > 3) {
        showMoreBtn.style.display = 'block';
        moreList.innerHTML = buildHtml(data.slice(3));
        showMoreBtn.onclick = () => {
            const isHidden = moreList.style.display === 'none';
            moreList.style.display = isHidden ? 'block' : 'none';
            showMoreBtn.textContent = isHidden ? 'Show Less ▴' : 'Show More ▾';
        };
    } else {
        showMoreBtn.style.display = 'none';
        moreList.innerHTML = '';
    }
};

window.handleLoadBid = async function(bidId) {
    if (window.closeSideMenu) window.closeSideMenu();
    await window.loadBidFromCloud(bidId);
    document.getElementById('results-view').classList.replace('active-view', 'hidden-view'); 
    document.getElementById('setup-view').classList.replace('hidden-view', 'active-view');
    window.scrollTo(0,0);
};

window.duplicateBid = async function(bidId) {
    if (window.closeSideMenu) window.closeSideMenu();
    await window.loadBidFromCloud(bidId);
    window.currentBidId = null; 
    const projInput = document.getElementById('meta-project');
    if(projInput.value) projInput.value = projInput.value + ' (Copy)';
    window.saveState();
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
    window.activeCloseoutBidData = data.bid_data || {};

    let estMat = 0;
    let estLab = 0;

    if (data.bid_data.categories) {
        Object.values(data.bid_data.categories).forEach(cat => {
            cat.forEach(item => { estMat += (parseFloat(item.qty)||0) * (parseFloat(item.price)||0); });
        });
    }
    if (data.bid_data.labor) {
        data.bid_data.labor.forEach(item => { estLab += (parseFloat(item.qty)||0) * (parseFloat(item.price)||0); });
    }

    const totalBid = data.total_amount || 0;
    const estTotalCost = estMat + estLab;

    document.getElementById('closeout-bid-info').textContent = data.project_name || 'Unnamed Project';
    document.getElementById('closeout-est-bid').textContent = `$${totalBid.toFixed(2)}`;
    document.getElementById('closeout-est-cost').textContent = `$${estTotalCost.toFixed(2)}`;

    const matInput = document.getElementById('closeout-actual-mat');
    const labInput = document.getElementById('closeout-actual-lab');
    const profitDisplay = document.getElementById('closeout-actual-profit');
    const notesInput = document.getElementById('closeout-notes');

    matInput.value = window.activeCloseoutBidData.actuals?.materials || '';
    labInput.value = window.activeCloseoutBidData.actuals?.labor || '';
    notesInput.value = window.activeCloseoutBidData.actuals?.notes || '';

    const updateProfit = () => {
        const actMat = parseFloat(matInput.value) || 0;
        const actLab = parseFloat(labInput.value) || 0;
        const actProfit = totalBid - (actMat + actLab);
        profitDisplay.textContent = `$${actProfit.toFixed(2)}`;
        profitDisplay.style.color = actProfit >= 0 ? '#10b981' : '#fb7185';
    };

    matInput.oninput = updateProfit;
    labInput.oninput = updateProfit;
    updateProfit();
};

window.submitCloseout = async function() {
    if (!window.activeCloseoutBidId) return;

    const actMat = parseFloat(document.getElementById('closeout-actual-mat').value) || 0;
    const actLab = parseFloat(document.getElementById('closeout-actual-lab').value) || 0;
    const actNotes = document.getElementById('closeout-notes').value;
    const totalBid = parseFloat(document.getElementById('closeout-est-bid').textContent.replace('$', '')) || 0;
    const actProfit = totalBid - (actMat + actLab);

    window.activeCloseoutBidData.actuals = {
        materials: actMat,
        labor: actLab,
        profit: actProfit,
        notes: actNotes
    };

    const { error } = await window.supabaseClient.from('bids').update({
        bid_data: window.activeCloseoutBidData
    }).eq('id', window.activeCloseoutBidId);

    if (!error) {
        document.getElementById('closeoutModal').classList.remove('show');
    }
};

window.saveBidToCloud = async function(totalAmount = 0, isAutosaving = false) {
    if (!window.currentUser || !window.supabaseClient) return false;

    if (!window.currentBidId) {
        const { count, error: countError } = await window.supabaseClient
            .from('bids').select('*', { count: 'exact', head: true }).eq('user_id', window.currentUser.id);
        
        const { data: subData } = await window.supabaseClient.from('users').select('subscription_status').eq('id', window.currentUser.id).maybeSingle();
        
        const isSubActive = subData && subData.subscription_status && String(subData.subscription_status).toLowerCase().trim() === 'active';
        const isActive = isSubActive || localStorage.getItem('im_temp_sub_active') === 'true';

        if (!countError && count >= 3 && !isActive) {
            if (!isAutosaving) {
                document.getElementById('profileModal').classList.add('show');
            }
            return false;
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

    try {
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
