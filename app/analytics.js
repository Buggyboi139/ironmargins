window.openJobProfit = async function(bidId) {
    const { data, error } = await window.supabaseClient.from('bids').select('*').eq('id', bidId).single();
    if (error || !data) return;
    const taxAmount = data.bid_data?.taxAmount || 0;
    const totalBid = (data.total_amount || 0) - taxAmount;
    const actMat = parseFloat(data.actual_materials) || 0;
    const actLab = parseFloat(data.actual_labor) || 0;
    const actSub = parseFloat(data.actual_subs) || 0;
    const actTotal = actMat + actLab + actSub;
    const profit = parseFloat(data.actual_profit) || 0;
    const margin = totalBid > 0 ? ((profit / totalBid) * 100).toFixed(1) : '0.0';
    const profitColor = profit >= 0 ? '#10b981' : '#fb7185';
    const fmt = (n) => '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const title = document.getElementById('profit-modal-title');
    title.textContent = data.project_name || 'Job Profit/Loss';
    const content = document.getElementById('profit-modal-content');
    content.innerHTML = `
        <div style="text-align:center; padding:20px 0 25px;">
            <div style="font-size:0.85rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Actual Profit</div>
            <div style="font-size:2.8rem; font-weight:800; color:${profitColor};">${profit >= 0 ? '' : '-'}${fmt(profit)}</div>
            <div style="font-size:1rem; color:${profitColor}; font-weight:600;">${margin}% margin</div>
        </div>
        <div style="background:rgba(0,0,0,0.3); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; justify-content:space-between; font-size:0.95rem;">
                <span style="color:var(--text-muted);">Client bid (excl. tax)</span>
                <span style="font-weight:700;">${fmt(totalBid)}</span>
            </div>
            <div style="border-top:1px solid rgba(255,255,255,0.05); padding-top:12px; display:flex; justify-content:space-between; font-size:0.95rem;">
                <span style="color:var(--text-muted);">Actual materials</span>
                <span style="color:#fb7185; font-weight:600;">-${fmt(actMat)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.95rem;">
                <span style="color:var(--text-muted);">Actual labor</span>
                <span style="color:#fb7185; font-weight:600;">-${fmt(actLab)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.95rem;">
                <span style="color:var(--text-muted);">Actual subs</span>
                <span style="color:#fb7185; font-weight:600;">-${fmt(actSub)}</span>
            </div>
            <div style="border-top:1px dashed rgba(255,255,255,0.1); padding-top:12px; display:flex; justify-content:space-between; font-size:0.95rem; font-weight:700;">
                <span>Total actual cost</span>
                <span>-${fmt(actTotal)}</span>
            </div>
        </div>
        ${data.closeout_notes ? `
        <div style="margin-top:20px; padding:15px; background:rgba(255,255,255,0.03); border-radius:12px; border:1px solid rgba(255,255,255,0.05);">
            <div style="font-size:0.8rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; margin-bottom:8px;">Notes</div>
            <div style="font-size:0.9rem; color:#cbd5e1; line-height:1.5;">${window.escapeHTML(data.closeout_notes)}</div>
        </div>` : ''}
    `;
    document.getElementById('profitModal')?.classList.add('show');
};

window.openAnalytics = async function() {
    if (!window.isPro) {
        return window.triggerUpgradeModal('Business Analytics');
    }
    const { data, error } = await window.supabaseClient.from('bids').select('project_name, actual_profit, actual_materials, actual_labor, actual_subs, total_amount, bid_data, created_at').eq('user_id', window.currentUser.id).eq('status', 'closed').order('created_at', { ascending: true });
    if (error || !data || data.length === 0) {
        alert('No closed jobs yet. Close out a job to see analytics.');
        return;
    }
    let totalRevenue = 0;
    let totalProfit = 0;
    data.forEach(bid => {
        const tax = bid.bid_data?.taxAmount || 0;
        totalRevenue += (bid.total_amount || 0) - tax;
        totalProfit += parseFloat(bid.actual_profit) || 0;
    });
    const avgMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';
    const fmt = (n) => '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const summary = document.getElementById('analytics-summary');
    summary.innerHTML = `
        <div style="background:rgba(0,0,0,0.3); padding:16px; border-radius:12px; text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; letter-spacing:1px;">Total Revenue</div>
            <div style="font-size:1.5rem; font-weight:800; color:#f8fafc; margin-top:5px;">${fmt(totalRevenue)}</div>
        </div>
        <div style="background:rgba(0,0,0,0.3); padding:16px; border-radius:12px; text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; letter-spacing:1px;">Total Profit</div>
            <div style="font-size:1.5rem; font-weight:800; color:${totalProfit >= 0 ? '#10b981' : '#fb7185'}; margin-top:5px;">${totalProfit >= 0 ? '' : '-'}${fmt(totalProfit)}</div>
        </div>
        <div style="background:rgba(0,0,0,0.3); padding:16px; border-radius:12px; text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; letter-spacing:1px;">Avg Margin</div>
            <div style="font-size:1.5rem; font-weight:800; color:#38bdf8; margin-top:5px;">${avgMargin}%</div>
        </div>
    `;
    const labels = [];
    const cumulative = [];
    let runningTotal = 0;
    data.forEach(bid => {
        const date = new Date(bid.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        runningTotal += parseFloat(bid.actual_profit) || 0;
        labels.push(date);
        cumulative.push(Math.round(runningTotal));
    });
    if (window._profitChartInstance) {
        window._profitChartInstance.destroy();
    }
    const canvas = document.getElementById('profitChart');
    canvas.style.height = '250px';
    window._profitChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cumulative Profit',
                data: cumulative,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#10b981',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const val = ctx.raw;
                            const sign = val >= 0 ? '' : '-';
                            return `${sign}$${Math.abs(val).toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: 'rgba(255,255,255,0.5)',
                        callback: (v) => {
                            const sign = v < 0 ? '-' : '';
                            return `${sign}$${Math.abs(v).toLocaleString()}`;
                        }
                    }
                }
            }
        }
    });
    document.getElementById('analyticsModal')?.classList.add('show');
};
