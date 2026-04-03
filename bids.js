window.currentBidId = null;

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
    } else {
        alert("Failed to delete bid: " + error.message);
    }
};

window.openCloseout = function(bidId) {
    alert('Closeout functionality coming soon!');
    // The HTML is wired up in index.html, logic will attach to #closeoutModal
};

window.saveBidToCloud = async function(totalAmount = 0, isAutosaving = false) {
    if (!window.currentUser || !window.supabaseClient) return false;

    // FREE TIER LIMIT LOGIC
    if (!window.currentBidId) {
        const { count, error: countError } = await window.supabaseClient
            .from('bids').select('*', { count: 'exact', head: true }).eq('user_id', window.currentUser.id);
        
        const { data: subData } = await window.supabaseClient.from('users').select('subscription_status').eq('id', window.currentUser.id).maybeSingle();
        const isActive = (subData && subData.subscription_status === 'active') || localStorage.getItem('im_temp_sub_active') === 'true';

        if (!countError && count >= 3 && !isActive) {
            if (!isAutosaving) {
                alert("Free Tier Limit Reached: You have 3 saved bids. Upgrade to Pro for unlimited bids and PDF generation.");
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
