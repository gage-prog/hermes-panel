/**
 * Hermes Panel - Shared UI Components
 */
const UI = {
    statusBadge(status) {
        return `<span class="status status-${status}"><span class="status-dot"></span> ${status}</span>`;
    },

    priorityLabel(p) {
        return `<span class="priority-${p}">${p}</span>`;
    },

    timeAgo(ts) {
        if (!ts) return '—';
        const d = new Date(ts + 'Z');
        const now = new Date();
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
        return `${Math.floor(diff/86400)}d ago`;
    },

    formatTime(ts) {
        if (!ts) return '—';
        const d = new Date(ts + 'Z');
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    progressBar(done, total) {
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
                <span style="font-size:0.75rem;color:var(--text-muted)">${pct}% (${done}/${total})</span>`;
    },

    showModal(html) {
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        content.innerHTML = html;
        overlay.classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    },

    confirmDelete(name, onConfirm) {
        this.showModal(`
            <h3 style="margin-bottom:1rem">Delete ${name}?</h3>
            <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:1.5rem">This action cannot be undone.</p>
            <div class="btn-group" style="justify-content:flex-end">
                <button class="btn" onclick="UI.closeModal()">Cancel</button>
                <button class="btn btn-danger" id="confirm-delete-btn">Delete</button>
            </div>
        `);
        document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
            await onConfirm();
            this.closeModal();
        });
    },

    emptyState(icon, message) {
        return `<div class="empty-state"><div class="empty-state-icon">${icon}</div><p>${message}</p></div>`;
    },

    alertLevelIcon(level) {
        const icons = { error: '🔴', warning: '🟡', info: '🔵', success: '🟢' };
        return icons[level] || '⚪';
    }
};

// Close modal on overlay click
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') UI.closeModal();
});
