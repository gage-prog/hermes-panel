/**
 * Dashboard View
 */
Router.register('dashboard', async (container) => {
    const data = await API.dashboard();
    const t = data.tasks;
    const taskTotal = t.pending + t.in_progress + t.completed;

    container.innerHTML = `
        <div class="view-header">
            <h1 class="view-title">Dashboard</h1>
            <span style="font-size:0.8rem;color:var(--text-muted)">${new Date().toLocaleDateString(undefined, {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</span>
        </div>

        <div class="stat-grid">
            <div class="card stat-card">
                <div class="stat-value" style="color:var(--accent)">${data.agents.total}</div>
                <div class="stat-label">Total Agents</div>
                <div class="stat-sub">${data.agents.active} active</div>
            </div>
            <div class="card stat-card">
                <div class="stat-value" style="color:var(--success)">${data.projects.active}</div>
                <div class="stat-label">Active Projects</div>
                <div class="stat-sub">${data.projects.total} total</div>
            </div>
            <div class="card stat-card">
                <div class="stat-value" style="color:var(--warning)">${t.in_progress}</div>
                <div class="stat-label">Tasks In Progress</div>
                <div class="stat-sub">${t.pending} pending · ${t.completed} done</div>
            </div>
            <div class="card stat-card">
                <div class="stat-value" style="color:var(--accent);font-size:1.1rem">${data.system?.model || 'unknown'}</div>
                <div class="stat-label">Active Model</div>
                <div class="stat-sub">${data.system?.provider || ''} · v${data.system?.version || '?'}</div>
            </div>
            <div class="card stat-card">
                <div class="stat-value" style="color:${data.alerts.unacknowledged > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${data.alerts.unacknowledged}</div>
                <div class="stat-label">Open Alerts</div>
                <div class="stat-sub">unacknowledged</div>
            </div>
        </div>

        <div class="grid-2">
            <div class="card section">
                <div class="card-header">
                    <span class="card-title">Task Progress</span>
                </div>
                ${taskTotal > 0 ? `
                    ${UI.progressBar(t.completed, taskTotal)}
                    <div style="display:flex;gap:1rem;margin-top:0.75rem;font-size:0.8rem">
                        <span style="color:var(--info)">● ${t.pending} pending</span>
                        <span style="color:var(--warning)">● ${t.in_progress} active</span>
                        <span style="color:var(--success)">● ${t.completed} done</span>
                    </div>
                ` : UI.emptyState('☐', 'No tasks yet')}
            </div>

            <div class="card section">
                <div class="card-header">
                    <span class="card-title">Alerts</span>
                    <a href="#alerts" style="font-size:0.8rem">View all →</a>
                </div>
                ${data.alerts.recent.length > 0 ? data.alerts.recent.map(a => `
                    <div class="alert-item alert-level-${a.level}" style="padding:0.5rem;margin-bottom:0.4rem">
                        <span class="alert-icon">${UI.alertLevelIcon(a.level)}</span>
                        <div class="alert-body">
                            <div class="alert-title">${a.title}</div>
                            <div class="alert-meta">${UI.timeAgo(a.created_at)}</div>
                        </div>
                    </div>
                `).join('') : UI.emptyState('✓', 'All clear')}
            </div>
        </div>

        <div class="card section" style="margin-top:1rem">
            <div class="card-header">
                <span class="card-title">Recent Activity</span>
                <span style="font-size:0.8rem;color:var(--text-muted)">${data.recent_activity.length} events</span>
            </div>
            ${data.recent_activity.length > 0 ? `
                <ul class="activity-list">
                    ${data.recent_activity.map(a => `
                        <li class="activity-item">
                            <span class="activity-time">${UI.timeAgo(a.timestamp)}</span>
                            <span class="activity-detail">
                                ${a.agent_name ? `<span class="activity-agent">${a.agent_name}</span> · ` : ''}
                                ${a.detail}
                            </span>
                        </li>
                    `).join('')}
                </ul>
            ` : UI.emptyState('◎', 'No activity yet')}
        </div>
    `;
});
