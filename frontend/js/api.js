/**
 * Hermes Panel - API Client
 * Handles all communication with the backend.
 */
const API = {
    token: localStorage.getItem('hermes_token') || '',

    setToken(t) {
        this.token = t;
        localStorage.setItem('hermes_token', t);
    },

    clearToken() {
        this.token = '';
        localStorage.removeItem('hermes_token');
    },

    async request(method, path, body = null) {
        const opts = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            }
        };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(`/api${path}`, opts);
        if (res.status === 401) {
            this.clearToken();
            App.showLogin();
            throw new Error('Unauthorized');
        }
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Request failed' }));
            throw new Error(err.detail || 'Request failed');
        }
        return res.json();
    },

    get(path) { return this.request('GET', path); },
    post(path, body) { return this.request('POST', path, body); },
    patch(path, body) { return this.request('PATCH', path, body); },
    delete(path) { return this.request('DELETE', path); },

    // Auth
    login(pin) { return this.post('/auth/login', { pin }); },
    logout() { return this.post('/auth/logout'); },
    checkAuth() { return this.get('/auth/check'); },

    // Dashboard
    dashboard() { return this.get('/dashboard'); },

    // Agents
    getAgents() { return this.get('/agents'); },
    getAgent(id) { return this.get(`/agents/${id}`); },
    createAgent(data) { return this.post('/agents', data); },
    updateAgent(id, data) { return this.patch(`/agents/${id}`, data); },
    deleteAgent(id) { return this.delete(`/agents/${id}`); },

    // Projects
    getProjects() { return this.get('/projects'); },
    getProject(id) { return this.get(`/projects/${id}`); },
    createProject(data) { return this.post('/projects', data); },
    updateProject(id, data) { return this.patch(`/projects/${id}`, data); },
    deleteProject(id) { return this.delete(`/projects/${id}`); },

    // Tasks
    getTasks(params = {}) {
        const q = new URLSearchParams(params).toString();
        return this.get(`/tasks${q ? '?' + q : ''}`);
    },
    createTask(data) { return this.post('/tasks', data); },
    updateTask(id, data) { return this.patch(`/tasks/${id}`, data); },
    deleteTask(id) { return this.delete(`/tasks/${id}`); },

    // Chat
    getChat(agentId, limit = 50) { return this.get(`/chat/${agentId}?limit=${limit}`); },
    sendChat(agentId, content) { return this.post(`/chat/${agentId}`, { content }); },

    // Alerts
    getAlerts() { return this.get('/alerts'); },
    createAlert(data) { return this.post('/alerts', data); },
    ackAlert(id) { return this.post(`/alerts/${id}/acknowledge`); },

    // Activity
    getActivity(limit = 50) { return this.get(`/activity?limit=${limit}`); },
};
