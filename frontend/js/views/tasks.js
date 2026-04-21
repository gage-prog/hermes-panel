/**
 * Tasks View
 */
Router.register('tasks', async (container) => {
    const [tasks, agents, projects] = await Promise.all([
        API.getTasks(), API.getAgents(), API.getProjects()
    ]);

    container.innerHTML = `
        <div class="view-header">
            <h1 class="view-title">Tasks</h1>
            <button class="btn btn-primary" id="add-task-btn">+ New Task</button>
        </div>

        <div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap">
            <button class="btn btn-sm filter-btn active" data-filter="all">All (${tasks.length})</button>
            <button class="btn btn-sm filter-btn" data-filter="pending">Pending (${tasks.filter(t=>t.status==='pending').length})</button>
            <button class="btn btn-sm filter-btn" data-filter="in_progress">In Progress (${tasks.filter(t=>t.status==='in_progress').length})</button>
            <button class="btn btn-sm filter-btn" data-filter="completed">Completed (${tasks.filter(t=>t.status==='completed').length})</button>
            <button class="btn btn-sm filter-btn" data-filter="cancelled">Cancelled (${tasks.filter(t=>t.status==='cancelled').length})</button>
        </div>

        <div class="card">
            ${tasks.length > 0 ? `
                <div class="table-wrap">
                    <table id="tasks-table">
                        <thead><tr>
                            <th>Title</th><th>Project</th><th>Agent</th><th>Status</th><th>Priority</th><th>Created</th><th>Actions</th>
                        </tr></thead>
                        <tbody>
                            ${tasks.map(t => `
                                <tr data-status="${t.status}">
                                    <td><strong>${t.title}</strong>${t.description ? `<br><span style="font-size:0.75rem;color:var(--text-muted)">${t.description.slice(0,80)}</span>` : ''}</td>
                                    <td style="font-size:0.8rem">${t.project_name ? `<a href="#projects/${t.project_id}">${t.project_name}</a>` : '—'}</td>
                                    <td style="font-size:0.8rem">${t.agent_name ? `<a href="#agents/${t.agent_id}">${t.agent_name}</a>` : '—'}</td>
                                    <td>
                                        <select class="form-select" style="width:auto;padding:0.2rem 0.4rem;font-size:0.75rem" data-task-id="${t.id}" onchange="quickUpdateTaskStatus(this)">
                                            <option value="pending" ${t.status==='pending'?'selected':''}>pending</option>
                                            <option value="in_progress" ${t.status==='in_progress'?'selected':''}>in_progress</option>
                                            <option value="completed" ${t.status==='completed'?'selected':''}>completed</option>
                                            <option value="cancelled" ${t.status==='cancelled'?'selected':''}>cancelled</option>
                                        </select>
                                    </td>
                                    <td>${UI.priorityLabel(t.priority)}</td>
                                    <td style="font-size:0.8rem">${UI.timeAgo(t.created_at)}</td>
                                    <td>
                                        <button class="btn btn-sm btn-ghost del-task" data-id="${t.id}" data-name="${t.title}">✕</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : UI.emptyState('☐', 'No tasks yet')}
        </div>
    `;

    // Filter buttons
    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            document.querySelectorAll('#tasks-table tbody tr').forEach(row => {
                row.style.display = (filter === 'all' || row.dataset.status === filter) ? '' : 'none';
            });
        });
    });

    // Add task
    document.getElementById('add-task-btn').addEventListener('click', () => showTaskForm({}, agents, projects));

    // Delete
    container.querySelectorAll('.del-task').forEach(b => {
        b.addEventListener('click', () => {
            UI.confirmDelete(`task "${b.dataset.name}"`, async () => {
                await API.deleteTask(b.dataset.id);
                Router.navigate('tasks');
            });
        });
    });
});

// Shared task form (used by tasks and projects views)
window.showTaskForm = function(defaults = {}, agents = null, projects = null) {
    const loadAndShow = async () => {
        if (!agents) agents = await API.getAgents();
        if (!projects) projects = await API.getProjects();

        UI.showModal(`
            <h3 style="margin-bottom:1rem">New Task</h3>
            <div class="form-group">
                <label class="form-label">Title</label>
                <input class="form-input" id="f-title" placeholder="Task title">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-textarea" id="f-desc" placeholder="Optional description"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Project</label>
                <select class="form-select" id="f-project">
                    <option value="">None</option>
                    ${projects.map(p => `<option value="${p.id}" ${defaults.project_id===p.id?'selected':''}>${p.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Assign Agent</label>
                <select class="form-select" id="f-agent">
                    <option value="">Unassigned</option>
                    ${agents.map(a => `<option value="${a.id}" ${defaults.agent_id===a.id?'selected':''}>${a.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Priority</label>
                <select class="form-select" id="f-priority">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                </select>
            </div>
            <div class="btn-group" style="justify-content:flex-end;margin-top:1.5rem">
                <button class="btn" onclick="UI.closeModal()">Cancel</button>
                <button class="btn btn-primary" id="save-task-btn">Create</button>
            </div>
        `);

        document.getElementById('save-task-btn').addEventListener('click', async () => {
            const data = {
                title: document.getElementById('f-title').value,
                description: document.getElementById('f-desc').value,
                project_id: document.getElementById('f-project').value || null,
                agent_id: document.getElementById('f-agent').value || null,
                priority: document.getElementById('f-priority').value,
            };
            if (!data.title) return alert('Title is required');
            await API.createTask(data);
            UI.closeModal();
            // Refresh current view
            Router.handleHash();
        });
    };
    loadAndShow();
};
