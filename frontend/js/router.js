/**
 * Hermes Panel - Simple Hash Router
 */
const Router = {
    views: {},
    currentView: null,

    register(name, renderFn) {
        this.views[name] = renderFn;
    },

    async navigate(viewName, params = {}) {
        const container = document.getElementById('view-container');
        if (!container) return;

        // Update nav active state
        document.querySelectorAll('.nav-link').forEach(el => {
            el.classList.toggle('active', el.dataset.view === viewName.split('/')[0]);
        });

        const renderFn = this.views[viewName];
        if (renderFn) {
            container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted)">Loading...</div>';
            try {
                this.currentView = viewName;
                await renderFn(container, params);
            } catch (err) {
                console.error('View render error:', err);
                container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠</div><p>Error loading view: ${err.message}</p></div>`;
            }
        } else {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">?</div><p>View "${viewName}" not found</p></div>`;
        }
    },

    init() {
        window.addEventListener('hashchange', () => this.handleHash());
        this.handleHash();
    },

    handleHash() {
        const hash = location.hash.slice(1) || 'dashboard';
        const [view, ...rest] = hash.split('/');
        const params = {};
        if (rest.length) params.id = rest.join('/');
        this.navigate(view, params);
    }
};
