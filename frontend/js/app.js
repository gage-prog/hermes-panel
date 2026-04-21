/**
 * Hermes Panel - Main App Controller
 */
const App = {
    async init() {
        this.bindLoginEvents();
        this.bindLogout();
        this.bindModalClose();

        // Check existing auth
        if (API.token) {
            try {
                await API.checkAuth();
                this.showApp();
            } catch {
                this.showLogin();
            }
        } else {
            this.showLogin();
        }
    },

    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-shell').classList.add('hidden');
        document.getElementById('pin-input').value = '';
        document.getElementById('pin-input').focus();
    },

    showApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');
        Router.init();
        this.startAlertPolling();
    },

    bindLoginEvents() {
        const pinInput = document.getElementById('pin-input');
        const loginBtn = document.getElementById('pin-submit');
        const errorEl = document.getElementById('login-error');

        const doLogin = async () => {
            const pin = pinInput.value.trim();
            if (!pin) return;
            errorEl.classList.add('hidden');
            loginBtn.disabled = true;
            loginBtn.textContent = 'Unlocking...';
            try {
                const res = await API.login(pin);
                API.setToken(res.token);
                this.showApp();
            } catch (err) {
                errorEl.textContent = 'Invalid PIN. Try again.';
                errorEl.classList.remove('hidden');
                pinInput.value = '';
                pinInput.focus();
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Unlock';
            }
        };

        loginBtn.addEventListener('click', doLogin);
        pinInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doLogin();
        });
    },

    bindLogout() {
        document.getElementById('logout-btn').addEventListener('click', async () => {
            try { await API.logout(); } catch {}
            API.clearToken();
            this.showLogin();
        });
    },

    bindModalClose() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') UI.closeModal();
        });
    },

    // Poll for alert count to update badge
    startAlertPolling() {
        const updateBadge = async () => {
            try {
                const data = await API.dashboard();
                const badge = document.getElementById('alert-badge');
                const count = data.alerts.unacknowledged;
                if (count > 0) {
                    badge.textContent = count;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            } catch {}
        };
        updateBadge();
        setInterval(updateBadge, 30000); // Every 30s
    }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
