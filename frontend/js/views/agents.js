/**
 * Agents View
 */
Router.register('agents', async (container, params) => {
    if (params.id) return renderAgentDetail(container, params.id);

    const agents = await API.getAgents();
    container.innerHTML = `
        <div class="view-header">
            <h1 class="view-title">Agents</h1>
            <button class="btn btn-primary" id="add-agent-btn">+ Add Agent</button>
        </div>
        ${agents.length > 0 ? `
            <div class="card">
                <div class="table-wrap">
                    <table>
                        <thead><tr>
                            <th>Name</th><th>Type</th><th>Model</th><th>Status</th><th>Last Seen</th><th>Actions</th>
                        </tr></thead>
                        <tbody>
                            ${agents.map(a => `
                                <tr class="clickable-row" data-id="${a.id}">
                                    <td><strong>${a.name}</strong><br><span style="font-size:0.75rem;color:var(--text-muted)">${a.id}</span></td>
                                    <td>${a.type}</td>
                                    <td style="font-family:var(--font-mono);font-size:0.8rem">${a.model || '—'}</td>
                                    <td>${UI.statusBadge(a.status)}</td>
                                    <td style="font-size:0.8rem">${UI.timeAgo(a.last_seen)}</td>
                                    <td class="btn-group">
                                        <button class="btn btn-sm btn-ghost chat-btn" data-id="${a.id}" title="Chat">◈</button>
                                        <button class="btn btn-sm btn-ghost del-btn" data-id="${a.id}" data-name="${a.name}" title="Delete">✕</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        ` : UI.emptyState('⬡', 'No agents registered yet')}
    `;

    // Events
    document.getElementById('add-agent-btn').addEventListener('click', () => showAgentForm());
    container.querySelectorAll('.clickable-row').forEach(r => {
        r.addEventListener('click', (e) => {
            if (e.target.closest('.btn')) return;
            location.hash = `agents/${r.dataset.id}`;
        });
    });
    container.querySelectorAll('.chat-btn').forEach(b => {
        b.addEventListener('click', () => { location.hash = `chat?agent=${b.dataset.id}`; });
    });
    container.querySelectorAll('.del-btn').forEach(b => {
        b.addEventListener('click', () => {
            UI.confirmDelete(`agent "${b.dataset.name}"`, async () => {
                await API.deleteAgent(b.dataset.id);
                Router.navigate('agents');
            });
        });
    });
});

async function renderAgentDetail(container, id) {
    const agent = await API.getAgent(id);
    container.innerHTML = `
        <div class="detail-back"><a href="#agents">← Back to Agents</a></div>
        <div class="detail-header">
            <div class="view-header">
                <h1 class="view-title">${agent.name}</h1>
                <div class="btn-group">
                    <button class="btn btn-sm" id="edit-agent-btn">Edit</button>
                    <button class="btn btn-sm" onclick="location.hash='chat?agent=${id}'">Chat</button>
                </div>
            </div>
            <div class="detail-meta">
                <span class="detail-meta-item">ID: ${agent.id}</span>
                <span class="detail-meta-item">${UI.statusBadge(agent.status)}</span>
                <span class="detail-meta-item">Type: ${agent.type}</span>
                <span class="detail-meta-item">Model: ${agent.model || '—'}</span>
                <span class="detail-meta-item">Provider: ${agent.provider || '—'}</span>
            </div>
        </div>
        <div class="grid-2">
            <div class="card section">
                <div class="card-header"><span class="card-title">Assigned Tasks</span></div>
                ${agent.tasks.length > 0 ? `<table>
                    <thead><tr><th>Title</th><th>Status</th><th>Priority</th></tr></thead>
                    <tbody>${agent.tasks.map(t => `
                        <tr><td>${t.title}</td><td>${UI.statusBadge(t.status)}</td><td>${UI.priorityLabel(t.priority)}</td></tr>
                    `).join('')}</tbody>
                </table>` : UI.emptyState('☐', 'No tasks assigned')}
            </div>
            <div class="card section">
                <div class="card-header"><span class="card-title">Activity</span></div>
                ${agent.activity.length > 0 ? `<ul class="activity-list">
                    ${agent.activity.map(a => `
                        <li class="activity-item">
                            <span class="activity-time">${UI.timeAgo(a.timestamp)}</span>
                            <span class="activity-detail">${a.detail}</span>
                        </li>
                    `).join('')}
                </ul>` : UI.emptyState('◎', 'No activity')}
            </div>
        </div>
    `;
    document.getElementById('edit-agent-btn').addEventListener('click', () => showAgentForm(agent));
}

function showAgentForm(existing = null) {
    UI.showModal(`
        <h3 style="margin-bottom:1rem">${existing ? 'Edit' : 'Add'} Agent</h3>
        <div class="form-group">
            <label class="form-label">Name</label>
            <input class="form-input" id="f-name" value="${existing?.name || ''}" placeholder="e.g. code-reviewer">
        </div>
        <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-select" id="f-type">
                <option value="subagent" ${existing?.type==='subagent'?'selected':''}>Subagent</option>
                <option value="cron" ${existing?.type==='cron'?'selected':''}>Cron Job</option>
                <option value="watcher" ${existing?.type==='watcher'?'selected':''}>Watcher</option>
                <option value="tool" ${existing?.type==='tool'?'selected':''}>Tool</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Model</label>
            <input class="form-input" id="f-model" value="${existing?.model || ''}" placeholder="e.g. claude-sonnet-4">
        </div>
        <div class="form-group">
            <label class="form-label">Provider</label>
            <input class="form-input" id="f-provider" value="${existing?.provider || ''}" placeholder="e.g. anthropic">
        </div>
        ${existing ? `<div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="f-status">
                <option value="idle" ${existing.status==='idle'?'selected':''}>Idle</option>
                <option value="active" ${existing.status==='active'?'selected':''}>Active</option>
                <option value="busy" ${existing.status==='busy'?'selected':''}>Busy</option>
                <option value="error" ${existing.status==='error'?'selected':''}>Error</option>
            </select>
        </div>` : ''}
        <div class="btn-group" style="justify-content:flex-end;margin-top:1.5rem">
            <button class="btn" onclick="UI.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="save-agent-btn">Save</button>
        </div>
    `);
    document.getElementById('save-agent-btn').addEventListener('click', async () => {
        const data = {
            name: document.getElementById('f-name').value,
            type: document.getElementById('f-type').value,
            model: document.getElementById('f-model').value,
            provider: document.getElementById('f-provider').value,
        };
        if (!data.name) return alert('Name is required');
        if (existing) {
            data.status = document.getElementById('f-status').value;
            await API.updateAgent(existing.id, data);
        } else {
            await API.createAgent(data);
        }
        UI.closeModal();
        Router.navigate(existing ? `agents/${existing.id}` : 'agents', existing ? {id: existing.id} : {});
    });
}
