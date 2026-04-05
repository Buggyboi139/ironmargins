window.generateInvoices = async function(bidId) {
    if (!window.currentUser || !window.supabaseClient || !window.isPro) return;
    const { data: existingInvoices } = await window.supabaseClient.from('invoices').select('invoice_type, is_paid').eq('bid_id', bidId).eq('is_paid', true);
    if (existingInvoices && existingInvoices.length > 0) {
        alert('Cannot regenerate invoices: Payments have already been recorded.');
        return;
    }
    await window.supabaseClient.from('invoices').delete().eq('bid_id', bidId);
    const total = Math.round((parseFloat(localStorage.getItem('im_grandTotal')) || 0) * 100);
    const depPct = parseFloat(document.getElementById('deposit-pct').value) || 0;
    const progQty = parseInt(document.getElementById('progress-payments').value) || 0;
    const clientName = localStorage.getItem('im_clientName') || 'Client';
    const projectName = localStorage.getItem('im_projectName') || 'Project';
    const depAmtCents = Math.round(total * (depPct / 100));
    let remAmtCents = total - depAmtCents;
    const baseProgAmtCents = progQty > 0 ? Math.floor(remAmtCents / progQty) : 0;
    const today = new Date();
    const invoices = [];
    let invoiceNum = 1;
    const baseInvStr = `INV-${Math.floor(Date.now() / 1000)}`;
    if (depAmtCents > 0) {
        invoices.push({
            user_id: window.currentUser.id,
            bid_id: bidId,
            client_name: clientName,
            project_name: projectName,
            invoice_number: `${baseInvStr}-${invoiceNum}`,
            invoice_type: 'deposit',
            amount: depAmtCents / 100,
            due_date: today.toISOString().split('T')[0],
            is_paid: false
        });
        invoiceNum++;
    }
    for (let i = 0; i < progQty; i++) {
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + (30 * (i + 1)));
        let currentProgAmtCents = baseProgAmtCents;
        if (i === progQty - 1) {
            currentProgAmtCents = remAmtCents;
        }
        remAmtCents -= currentProgAmtCents;
        invoices.push({
            user_id: window.currentUser.id,
            bid_id: bidId,
            client_name: clientName,
            project_name: projectName,
            invoice_number: `${baseInvStr}-${invoiceNum}`,
            invoice_type: i === progQty - 1 ? 'final' : 'progress',
            amount: currentProgAmtCents / 100,
            due_date: dueDate.toISOString().split('T')[0],
            is_paid: false
        });
        invoiceNum++;
    }
    if (progQty === 0 && remAmtCents > 0) {
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + 30);
        invoices.push({
            user_id: window.currentUser.id,
            bid_id: bidId,
            client_name: clientName,
            project_name: projectName,
            invoice_number: `${baseInvStr}-${invoiceNum}`,
            invoice_type: 'final',
            amount: remAmtCents / 100,
            due_date: dueDate.toISOString().split('T')[0],
            is_paid: false
        });
    }
    if (invoices.length > 0) {
        await window.supabaseClient.from('invoices').insert(invoices);
    }
};

window.saveDataForPdf = function() {
    const displayEl = document.getElementById('client-display-name');
    const idEl = document.getElementById('client-id');
    const clientName = displayEl && displayEl.textContent !== 'None' && displayEl.textContent !== '+' && displayEl.textContent !== '' ? displayEl.textContent : 'Client';
    let clientAddress = '';
    let clientEmail = '';
    if (idEl && idEl.value && window.clientsDb) {
        const cObj = window.clientsDb.find(c => c.id == idEl.value);
        if (cObj) {
            if (cObj.address) clientAddress = cObj.address;
            if (cObj.email) clientEmail = cObj.email;
        }
    }
    localStorage.setItem('im_clientName', clientName);
    localStorage.setItem('im_clientAddress', clientAddress);
    localStorage.setItem('im_clientEmail', clientEmail);
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
            await window.generateInvoices(window.currentBidId);
            localStorage.setItem('im_current_bid_id', window.currentBidId);
        }
        window.location.href = './success';
    };
};
