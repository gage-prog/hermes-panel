/**
 * Projects View
 */
Router.register('projects', async (container, params) => {
    if (params.id) return renderProjectDetail(container, params.id);

    const projects = await API.getProjects();
    container.innerHTML = `
        <div class="view-header">
            <h1 class="view-title">Projects</h1>
            <button class="btn btn-primary" id="add-project-btn">+ New Project</button>
        </div>
        ${projects.length > 0 ? `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1rem">
                ${projects.map(p => {
                    const stats = p.task_stats || {};
                    const total = Object.values(stats).reduce((a,b)=>a+b, 0);
                    const done = stats.completed || 0;
                    return `
                    <div class="card" style="cursor:pointer" onclick="location.hash='projects/${p.id}'">
                        <div class="card-header">
                            <span class="card-title">${p.name}</span>
                            ${UI.statusBadge(p.status)}
                        </div>
                        <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.75rem;min-height:2rem">${p.description || 'No description'}</p>
                        <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-muted);margin-bottom:0.5rem">
                            <span>Priority: ${UI.priorityLabel(p.priority)}</span>
                            <span>${total} tasks</span>
                        </div>
                        ${total > 0 ? UI.progressBar(done, total) : ''}
                        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.5rem">
                            Created ${UI.timeAgo(p.created_at)}
                        </div>
                    </div>`;
                }).join('')}
            </div>
        ` : UI.emptyState('▦', 'No projects yet')}
    `;
    document.getElementById('add-project-btn').addEventListener('click', () => showProjectForm());
});

async function renderProjectDetail(container, id) {
    const project = await API.getProject(id);
    const tasks = project.tasks || [];
    const done = tasks.filter(t => t.status === 'completed').length;

    container.innerHTML = `
        <div class="detail-back"><a href="#projects">← Back to Projects</a></div>
        <div class="detail-header">
            <div class="view-header">
                <h1 class="view-title">${project.name}</h1>
                <div class="btn-group">
                    <button class="btn btn-sm" id="edit-project-btn">Edit</button>
                    <button class="btn btn-sm btn-danger" id="del-project-btn">Delete</button>
                </div>
            </div>
            <div class="detail-meta">
                ${UI.statusBadge(project.status)}
                <span class="detail-meta-item">Priority: ${UI.priorityLabel(project.priority)}</span>
                <span class="detail-meta-item">Created: ${UI.timeAgo(project.created_at)}</span>
            </div>
            ${project.description ? `<p style="margin-top:0.75rem;font-size:0.9rem;color:var(--text-secondary)">${project.description}</p>` : ''}
        </div>
        <div class="card section">
            <div class="card-header">
                <span class="card-title">Tasks (${tasks.length})</span>
                <button class="btn btn-sm btn-primary" id="add-task-to-project">+ Add Task</button>
            </div>
            ${tasks.length > 0 ? `
                <div style="margin-bottom:1rem">${UI.progressBar(done, tasks.length)}</div>
                <table>
                    <thead><tr><th>Title</th><th>Agent</th><th>Status</th><th>Priority</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${tasks.map(t => `
                            <tr>
                                <td>${t.title}</td>
                                <td style="font-size:0.8rem">${t.agent_name || '—'}</td>
                                <td>${UI.statusBadge(t.status)}</td>
                                <td>${UI.priorityLabel(t.priority)}</td>
                                <td>
                                    <select class="form-select" style="width:auto;padding:0.2rem 0.4rem;font-size:0.75rem" data-task-id="${t.id}" onchange="quickUpdateTaskStatus(this)">
                                        <option value="pending" ${t.status==='pending'?'selected':''}>pending</option>
                                        <option value="in_progress" ${t.status==='in_progress'?'selected':''}>in_progress</option>
                                        <option value="completed" ${t.status==='completed'?'selected':''}>completed</option>
                                        <option value="cancelled" ${t.status==='cancelled'?'selected':''}>cancelled</option>
                                    </select>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : UI.emptyState('☐', 'No tasks in this project yet')}
        </div>
    `;

    document.getElementById('edit-project-btn').addEventListener('click', () => showProjectForm(project));
    document.getElementById('del-project-btn').addEventListener('click', () => {
        UI.confirmDelete(`project "${project.name}"`, async () => {
            await API.deleteProject(id);
            location.hash = 'projects';
        });
    });
    document.getElementById('add-task-to-project').addEventListener('click', () => showTaskForm({ project_id: id }));
}

// Global helper for inline status update
window.quickUpdateTaskStatus = async function(el) {
    await API.updateTask(el.dataset.taskId, { status: el.value });
};

function showProjectForm(existing = null) {
    UI.showModal(`
        <h3 style="margin-bottom:1rem">${existing ? 'Edit' : 'New'} Project</h3>
        <div class="form-group">
            <label class="form-label">Name</label>
            <input class="form-input" id="f-name" value="${existing?.name || ''}">
        </div>
        <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" id="f-desc">${existing?.description || ''}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Priority</label>
            <select class="form-select" id="f-priority">
                <option value="low" ${existing?.priority==='low'?'selected':''}>Low</option>
                <option value="medium" ${existing?.priority==='medium'?'selected':''}>Medium</option>
                <option value="high" ${existing?.priority==='high'?'selected':''}>High</option>
            </select>
        </div>
        ${existing ? `<div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="f-status">
                <option value="active" ${existing.status==='active'?'selected':''}>Active</option>
                <option value="completed" ${existing.status==='completed'?'selected':''}>Completed</option>
                <option value="archived" ${existing.status==='archived'?'selected':''}>Archived</option>
            </select>
        </div>` : ''}
        <div class="btn-group" style="justify-content:flex-end;margin-top:1.5rem">
            <button class="btn" onclick="UI.closeModal()">Cancel</button>
            <button class="btn btn-primary" id="save-project-btn">Save</button>
        </div>
    `);
    document.getElementById('save-project-btn').addEventListener('click', async () => {
        const data = {
            name: document.getElementById('f-name').value,
            description: document.getElementById('f-desc').value,
            priority: document.getElementById('f-priority').value,
        };
        if (!data.name) return alert('Name is required');
        if (existing) {
            data.status = document.getElementById('f-status').value;
            await API.updateProject(existing.id, data);
            location.hash = `projects/${existing.id}`;
        } else {
            const res = await API.createProject(data);
            location.hash = `projects/${res.id}`;
        }
        UI.closeModal();
    });
}
