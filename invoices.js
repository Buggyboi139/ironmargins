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
        const statusText = inv.is_paid ? 'PAID' : 'UNPAID';
        const dueDate = new Date(inv.due_date).toLocaleDateString();
        const safeName = window.escapeHTML(inv.client_name);
        const safeProject = window.escapeHTML(inv.project_name);
        const companyName = window.escapeHTML(localStorage.getItem('im_global_company') || 'Your Company');
        const mailSubject = encodeURIComponent(`Invoice: ${inv.project_name} — ${typeLabel}`);
        const mailBody = encodeURIComponent(`Hi ${inv.client_name},\n\nThis is an invoice for ${inv.project_name}.\n\nType: ${typeLabel}\nAmount Due: $${amt}\nDue Date: ${dueDate}\n\nThank you,\n${companyName}`);
        const clientEmail = window.escapeHTML(localStorage.getItem('im_clientEmail') || '');
        return `
        <div style="flex: 1 1 calc(50% - 6px); min-width: 260px; background: rgba(255,255,255,0.03); border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); padding: 20px; display: flex; flex-direction: column; gap: 10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:0.75rem; font-weight:700; color:${statusColor}; text-transform:uppercase; letter-spacing:1px;">${statusText}</span>
                <span style="font-size:0.75rem; color:var(--text-muted);">${window.escapeHTML(inv.invoice_number)}</span>
            </div>
            <div>
                <div style="font-weight:700; font-size:1.1rem; color:#f8fafc;">${safeName}</div>
                <div style="font-size:0.85rem; color:var(--text-muted);">${safeProject}</div>
            </div>
            <div style="font-size:0.85rem; color:var(--text-muted);">${typeLabel} — Due ${dueDate}</div>
            <div style="font-size:1.4rem; font-weight:800; color:#f8fafc;">$${amt}</div>
            <div style="display:flex; gap:8px; margin-top:auto; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05);">
                <button onclick="window.toggleInvoicePaid('${inv.id}', ${!inv.is_paid})" class="secondary-btn" style="flex:1; padding:10px; border-radius:10px; font-size:0.85rem; color:${inv.is_paid ? '#fb7185' : '#10b981'}; border-color:${inv.is_paid ? 'rgba(251,113,133,0.3)' : 'rgba(16,185,129,0.3)'}; background:${inv.is_paid ? 'rgba(251,113,133,0.1)' : 'rgba(16,185,129,0.1)'};">
                    ${inv.is_paid ? '↩ Unpaid' : '✓ Mark Paid'}
                </button>
                <a href="mailto:${clientEmail}?subject=${mailSubject}&body=${mailBody}" class="secondary-btn" style="padding:10px 14px; border-radius:10px; display:flex; align-items:center; justify-content:center; text-decoration:none; color:#38bdf8; border-color:rgba(56,189,248,0.3); background:rgba(56,189,248,0.1);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0 -1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                </a>
                <button onclick="window.deleteInvoice('${inv.id}')" class="secondary-btn" style="padding:10px 14px; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#fb7185; border-color:rgba(251,113,133,0.3); background:rgba(251,113,133,0.1);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
