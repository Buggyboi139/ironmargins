window.saveBidToCloud = async function(totalAmount = 0, isAutosaving = false) {
    if (!window.currentUser || !window.supabaseClient) return false;

    // Enforcement of 3 Free bids limit before saving a brand new bid
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
