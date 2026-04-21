/**
 * Alerts View
 */
Router.register('alerts', async (container) => {
    const alerts = await API.getAlerts();

    container.innerHTML = `
        <div class="view-header">
            <h1 class="view-title">Alerts</h1>
            <button class="btn btn-primary" id="add-alert-btn">+ Create Alert</button>
        </div>

        ${alerts.length > 0 ? `
            <div style="display:flex;gap:0.5rem;margin-bottom:1rem">
                <button class="btn btn-sm" id="ack-all-btn">Acknowledge All</button>
            </div>
            ${alerts.map(a => `
                <div class="alert-item alert-level-${a.level} ${a.acknowledged ? 'acknowledged' : ''}" data-id="${a.id}">
                    <span class="alert-icon">${UI.alertLevelIcon(a.level)}</span>
                    <div class="alert-body">
                        <div class="alert-title">${a.title}</div>
                        ${a.detail ? `<div class="alert-detail">${a.detail}</div>` : ''}
                        <div class="alert-meta">${UI.timeAgo(a.created_at)} · ${a.level} ${a.acknowledged ? '· acknowledged' : ''}</div>
                    </div>
                    ${!a.acknowledged ? `<button class="btn btn-sm btn-ghost ack-btn" data-id="${a.id}" title="Acknowledge">✓</button>` : ''}
                </div>
            `).join('')}
        ` : UI.emptyState('✓', 'No alerts')}
    `;

    // Acknowledge single
    container.querySelectorAll('.ack-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await API.ackAlert(btn.dataset.id);
            Router.navigate('alerts');
        });
    });

    // Acknowledge all
    document.getElementById('ack-all-btn')?.addEventListener('click', async () => {
        const unacked = alerts.filter(a => !a.acknowledged);
        await Promise.all(unacked.map(a => API.ackAlert(a.id)));
        Router.navigate('alerts');
    });

    // Create alert
    document.getElementById('add-alert-btn').addEventListener('click', () => {
        UI.showModal(`
            <h3 style="margin-bottom:1rem">Create Alert</h3>
            <div class="form-group">
                <label class="form-label">Title</label>
                <input class="form-input" id="f-title" placeholder="Alert title">
            </div>
            <div class="form-group">
                <label class="form-label">Detail</label>
                <textarea class="form-textarea" id="f-detail" placeholder="Optional details"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Level</label>
                <select class="form-select" id="f-level">
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                    <option value="success">Success</option>
                </select>
            </div>
            <div class="btn-group" style="justify-content:flex-end;margin-top:1.5rem">
                <button class="btn" onclick="UI.closeModal()">Cancel</button>
                <button class="btn btn-primary" id="save-alert-btn">Create</button>
            </div>
        `);
        document.getElementById('save-alert-btn').addEventListener('click', async () => {
            const data = {
                title: document.getElementById('f-title').value,
                detail: document.getElementById('f-detail').value,
                level: document.getElementById('f-level').value,
            };
            if (!data.title) return alert('Title is required');
            await API.createAlert(data);
            UI.closeModal();
            Router.navigate('alerts');
        });
    });
});
