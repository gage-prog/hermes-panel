// Hermes Panel Dashboard JavaScript

const API_BASE = '';
const REFRESH_INTERVAL = 5000; // 5 seconds
let refreshTimer = null;
let selectedSessionId = null;

// =============================================================================
// Initialization
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initClock();
    startAutoRefresh();
    loadInitialData();
});

function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            
            // Update tab buttons
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update content
            contents.forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${target}`).classList.add('active');
            
            // Load tab-specific data
            switch (target) {
                case 'chat':
                    refreshSessions();
                    break;
                case 'agents':
                    refreshAgents();
                    break;
                case 'projects':
                    refreshProjects();
                    break;
            }
        });
    });
}

function initClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleTimeString();
}

// =============================================================================
// Auto Refresh
// =============================================================================

function startAutoRefresh() {
    let countdown = REFRESH_INTERVAL / 1000;
    
    refreshTimer = setInterval(() => {
        countdown = REFRESH_INTERVAL / 1000;
        document.getElementById('refreshCountdown').textContent = countdown;
        
        const activeTab = document.querySelector('.nav-tab.active')?.dataset.tab;
        if (activeTab === 'chat') refreshSessions();
        else if (activeTab === 'agents') refreshAgents();
    }, REFRESH_INTERVAL);
}

function loadInitialData() {
    loadSystemStats();
    refreshSessions();
    updateConnectionStatus('connected');
}

// =============================================================================
// System Stats
// =============================================================================

async function loadSystemStats() {
    try {
        const res = await fetch(`${API_BASE}/api/system/stats`);
        const data = await res.json();
        
        document.getElementById('totalSessions').textContent = data.total_sessions || 0;
        document.getElementById('totalMessages').textContent = data.total_messages || 0;
        document.getElementById('totalSkills').textContent = data.total_skills || 0;
    } catch (err) {
        console.error('Error loading system stats:', err);
        updateConnectionStatus('error');
    }
}

// =============================================================================
// Chat Tab
// =============================================================================

async function refreshSessions() {
    try {
        const res = await fetch(`${API_BASE}/api/chat/sessions`);
        const data = await res.json();
        
        const container = document.getElementById('sessionsList');
        
        if (!data.sessions || data.sessions.length === 0) {
            container.innerHTML = '<div class="empty-state">No sessions found</div>';
            return;
        }
        
        container.innerHTML = data.sessions.map(session => `
            <div class="session-item ${session.id === selectedSessionId ? 'active' : ''}" 
                 onclick="selectSession('${session.id}')">
                <div class="session-title">${escapeHtml(session.title || session.id.slice(0, 8))}</div>
                <div class="session-meta">
                    <span class="session-source">${escapeHtml(session.source)}</span>
                    <span>${formatTime(session.started_at)}</span>
                    <span>${session.message_count || 0} msgs</span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading sessions:', err);
    }
}

async function selectSession(sessionId) {
    selectedSessionId = sessionId;
    
    // Update active state in list
    document.querySelectorAll('.session-item').forEach(item => {
        item.classList.toggle('active', item.onclick.toString().includes(sessionId));
    });
    
    document.getElementById('chatTitle').textContent = `Session: ${sessionId.slice(0, 8)}...`;
    
    try {
        const res = await fetch(`${API_BASE}/api/chat/session/${sessionId}`);
        const data = await res.json();
        
        const container = document.getElementById('messagesList');
        
        if (!data.messages || data.messages.length === 0) {
            container.innerHTML = '<div class="empty-state">No messages in this session</div>';
            return;
        }
        
        container.innerHTML = data.messages.map(msg => `
            <div class="message ${msg.role}">
                <div class="message-header">${msg.role} • ${formatTime(msg.timestamp)}</div>
                <div class="message-content">${escapeHtml(msg.content || '')}</div>
                ${msg.tool_name ? `
                    <div class="message-tool">
                        Tool: ${escapeHtml(msg.tool_name)}
                    </div>
                ` : ''}
            </div>
        `).join('');
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        console.error('Error loading messages:', err);
    }
}

// =============================================================================
// Agents Tab
// =============================================================================

async function refreshAgents() {
    await Promise.all([
        loadActiveAgents(),
        loadAgentsHistory()
    ]);
}

async function loadActiveAgents() {
    try {
        const res = await fetch(`${API_BASE}/api/agents/active`);
        const data = await res.json();
        
        const container = document.getElementById('activeAgentsGrid');
        
        if (!data.agents || data.agents.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; padding: 40px;">
                    No active agents running
                </div>
            `;
            return;
        }
        
        container.innerHTML = data.agents.map(agent => `
            <div class="agent-card">
                <div class="agent-card-header">
                    <span class="agent-name">${escapeHtml(agent.name || 'Agent')}</span>
                    <span class="agent-status active">Active</span>
                </div>
                <div class="agent-task">${escapeHtml(agent.task || 'Processing...')}</div>
                <div class="agent-meta">
                    <span>Started: ${formatTime(agent.registered_at)}</span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading active agents:', err);
    }
}

async function loadAgentsHistory() {
    try {
        const res = await fetch(`${API_BASE}/api/agents/history`);
        const data = await res.json();
        
        const tbody = document.getElementById('agentsHistoryBody');
        
        if (!data.history || data.history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-muted">No agent history</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.history.map(item => `
            <tr>
                <td><code>${item.id.slice(0, 8)}...</code></td>
                <td>${escapeHtml(item.source)}</td>
                <td>${escapeHtml(item.model || '-')}</td>
                <td>${formatTime(item.started_at)}</td>
                <td>${item.message_count || 0}</td>
                <td>${item.tool_call_count || 0}</td>
                <td>
                    <span class="agent-status ${item.ended_at ? 'pending' : 'active'}">
                        ${item.ended_at ? 'Completed' : 'Running'}
                    </span>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Error loading agents history:', err);
    }
}

// =============================================================================
// Projects Tab
// =============================================================================

async function refreshProjects() {
    await Promise.all([
        loadProjects(),
        loadCronJobs()
    ]);
}

async function loadProjects() {
    try {
        const res = await fetch(`${API_BASE}/api/projects/list`);
        const data = await res.json();
        
        document.getElementById('skillsCount').textContent = data.total_skills || 0;
        document.getElementById('contextFilesCount').textContent = data.context_files?.length || 0;
        
        const container = document.getElementById('skillsCategories');
        
        if (!data.projects || data.projects.length === 0) {
            container.innerHTML = '<div class="empty-state">No skills found</div>';
            return;
        }
        
        container.innerHTML = data.projects.map(cat => `
            <div class="category-card">
                <div class="category-name">
                    ${getCategoryIcon(cat.category)}
                    ${escapeHtml(cat.category)}
                    <span class="category-count">${cat.count}</span>
                </div>
                <div class="category-skills">
                    ${cat.skills.slice(0, 5).map(s => escapeHtml(s.name)).join(', ')}
                    ${cat.skills.length > 5 ? ` +${cat.skills.length - 5} more` : ''}
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading projects:', err);
    }
}

async function loadCronJobs() {
    try {
        const res = await fetch(`${API_BASE}/api/cron/jobs`);
        const data = await res.json();
        
        document.getElementById('cronJobsCount').textContent = data.count || 0;
        
        const container = document.getElementById('cronJobsList');
        
        if (!data.jobs || data.jobs.length === 0) {
            container.innerHTML = '<div class="empty-state">No cron jobs scheduled</div>';
            return;
        }
        
        container.innerHTML = data.jobs.map(job => `
            <div class="cron-job-item">
                <span class="cron-job-name">${escapeHtml(job.name || 'Unnamed Job')}</span>
                <span class="cron-job-schedule">${escapeHtml(job.schedule || job.pattern || 'once')}</span>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error loading cron jobs:', err);
    }
}

function getCategoryIcon(category) {
    const icons = {
        'software-development': '💻',
        'data-science': '📊',
        'mlops': '🤖',
        'research': '🔬',
        'creative': '🎨',
        'productivity': '⚡',
        'devops': '🔧',
        'gaming': '🎮',
        'social-media': '📱',
        'email': '📧',
        'media': '🎬',
        'smart-home': '🏠',
        'leisure': '🎉',
        'autonomous-ai-agents': '🚀',
        'default': '📁'
    };
    return icons[category] || icons['default'];
}

// =============================================================================
// Utilities
// =============================================================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    if (!timestamp) return '-';
    
    try {
        // Handle Unix timestamp (seconds)
        if (typeof timestamp === 'number' || !isNaN(timestamp)) {
            const date = new Date(timestamp * 1000);
            return date.toLocaleString();
        }
        
        // Handle ISO string
        const date = new Date(timestamp);
        return date.toLocaleString();
    } catch {
        return String(timestamp).slice(0, 19);
    }
}

function updateConnectionStatus(status) {
    const dot = document.querySelector('.status-dot');
    const text = document.querySelector('.status-text');
    
    dot.className = 'status-dot';
    
    switch (status) {
        case 'connected':
            dot.classList.add('connected');
            text.textContent = 'Connected';
            break;
        case 'error':
            dot.classList.add('error');
            text.textContent = 'Disconnected';
            break;
        default:
            text.textContent = 'Connecting...';
    }
}
