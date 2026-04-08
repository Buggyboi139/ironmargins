window.fetchInvoices = async function(filter = 'all') {
    if (!window.currentUser || !window.supabaseClient) return;
    let query = window.supabaseClient
        .from('invoices')
        .select('*')
        .eq('user_id', window.currentUser.id)
        .order('created_at', { ascending: false });
    if (filter === 'paid') query = query.eq('is_paid', true);
    if (filter === 'unpaid') query = query.eq('is_paid', false);
    const list = document.getElementById('invoices-list');
    if (!list) return;
    
    const { data, error } = await query;
    
    if (error) {
        list.innerHTML = `<div class="dropdown-empty" style="color:#fb7185;">Error loading invoices: ${error.message}</div>`;
        return;
    }
    
    if (!data) return;
    if (data.length === 0) {
        list.innerHTML = `<div class="dropdown-empty" style="width:100%;">No invoices yet. Generate a proposal to create invoices.</div>`;
        return;
    }
    list.innerHTML = data.map(inv => {
        const amt = parseFloat(inv.amount).toLocaleString(undefined, {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });
        const typeLabel = inv.invoice_type === 'deposit' ? 'Deposit' : inv.invoice_type === 'final' ? 'Final Balance' : 'Progress Payment';
        const statusColor = inv.is_paid ? '#10b981' : '#fb7185';
        const statusBg = inv.is_paid ? 'rgba(16,185,129,0.1)' : 'rgba(251,113,133,0.1)';
        const statusText = inv.is_paid ? 'PAID' : 'DUE';
        const dueDate = new Date(inv.due_date).toLocaleDateString();
        const safeName = window.escapeHTML(inv.client_name);
        const safeProject = window.escapeHTML(inv.project_name);
        
        // Build the email template
        const companyName = window.escapeHTML(localStorage.getItem('im_global_company') || 'Your Company');
        const clientEmail = window.escapeHTML(localStorage.getItem('im_clientEmail') || '');
        const paymentLink = localStorage.getItem('im_payment_link');
        const paymentText = paymentLink ? `\n\nYou can pay securely online here: ${paymentLink}` : '';
        
        const mailSubject = encodeURIComponent(`Invoice: ${inv.project_name} — ${typeLabel}`);
        const mailBody = encodeURIComponent(`Hi ${inv.client_name},\n\nThis is an invoice for ${inv.project_name}.\n\nInvoice #: ${inv.invoice_number}\nType: ${typeLabel}\nAmount Due: $${amt}\nDue Date: ${dueDate}${paymentText}\n\nThank you,\n${companyName}`);

        return `
        <div style="flex: 1 1 100%; background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); padding: 24px; display: flex; flex-direction: column; gap: 15px; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusColor}40; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; display: inline-flex; align-items: center; gap: 6px;">
                    <div style="width:6px; height:6px; border-radius:50%; background:${statusColor};"></div>
                    ${statusText}
                </div>
                <span style="font-size:0.85rem; font-weight: 600; color:var(--text-muted); font-family: monospace;">#${window.escapeHTML(inv.invoice_number)}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 15px;">
                <div>
                    <div style="font-weight:800; font-size:1.3rem; color:#f8fafc; margin-bottom: 4px;">${safeName}</div>
                    <div style="font-size:0.95rem; color:#38bdf8; font-weight: 600;">${safeProject}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size:1.8rem; font-weight:900; color:#f8fafc; letter-spacing: -0.5px;">$${amt}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted);">${typeLabel}</div>
                </div>
            </div>

            <div style="font-size:0.85rem; color:var(--text-muted); display: flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                Due Date: <strong style="color: #f8fafc;">${dueDate}</strong>
            </div>

            <div style="display:flex; gap:10px; margin-top:auto; padding-top:20px; border-top:1px dashed rgba(255,255,255,0.08);">
                <button onclick="window.toggleInvoicePaid('${inv.id}', ${!inv.is_paid})" class="secondary-btn" style="flex:2; padding:12px; border-radius:10px; font-weight: 700; font-size:0.9rem; color:${inv.is_paid ? '#fb7185' : '#10b981'}; border-color:${inv.is_paid ? 'rgba(251,113,133,0.3)' : 'rgba(16,185,129,0.3)'}; background:${inv.is_paid ? 'rgba(251,113,133,0.05)' : 'rgba(16,185,129,0.05)'};">
                    ${inv.is_paid ? '↩ Mark as Unpaid' : '✓ Mark as Paid'}
                </button>
                <a href="mailto:${clientEmail}?subject=${mailSubject}&body=${mailBody}" class="secondary-btn" style="flex: 1; padding:12px; border-radius:10px; display:flex; align-items:center; justify-content:center; gap: 6px; text-decoration:none; font-weight: 600; font-size:0.9rem; color:#38bdf8; border-color:rgba(56,189,248,0.3); background:rgba(56,189,248,0.05);">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0 -1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                    Send
                </a>
                <button onclick="window.deleteInvoice('${inv.id}')" class="secondary-btn" style="padding:12px; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#94a3b8; border-color: transparent; background: transparent;" title="Delete Invoice">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>`;
    }).join('');
};

window.toggleInvoicePaid = async function(id, newStatus) {
    const update = { is_paid: newStatus };
    if (newStatus) update.paid_date = new Date().toISOString().split('T')[0];
    else update.paid_date = null;
    await window.supabaseClient.from('invoices').update(update).eq('id', id);
    window.fetchInvoices(window._currentInvoiceFilter || 'all');
};

window.deleteInvoice = async function(id) {
    if (!confirm('Delete this invoice?')) return;
    await window.supabaseClient.from('invoices').delete().eq('id', id);
    window.fetchInvoices(window._currentInvoiceFilter || 'all');
};

window.filterInvoices = function(filter) {
    window._currentInvoiceFilter = filter;
    document.querySelectorAll('#invoices-filter .menu-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase() === filter);
    });
    window.fetchInvoices(filter);
};
