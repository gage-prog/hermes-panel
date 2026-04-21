/**
 * Chat View
 */
Router.register('chat', async (container) => {
    const agents = await API.getAgents();

    // Check if agent is specified in hash
    const hashParams = new URLSearchParams(location.hash.split('?')[1] || '');
    const preselectedAgent = hashParams.get('agent') || (agents.length > 0 ? agents[0].id : null);

    container.innerHTML = `
        <div class="view-header">
            <h1 class="view-title">Agent Chat</h1>
        </div>
        <div class="chat-layout">
            <div class="chat-sidebar">
                ${agents.length > 0 ? agents.map(a => `
                    <div class="chat-agent-item ${a.id === preselectedAgent ? 'active' : ''}" data-agent-id="${a.id}">
                        <div>
                            <div class="chat-agent-name">${a.name}</div>
                            <div class="chat-agent-status">${a.status} · ${a.type}</div>
                        </div>
                    </div>
                `).join('') : '<div style="padding:1rem;font-size:0.8rem;color:var(--text-muted)">No agents. Add one first.</div>'}
            </div>
            <div class="chat-main">
                <div class="chat-header" id="chat-header">
                    ${preselectedAgent ? agents.find(a => a.id === preselectedAgent)?.name || 'Select agent' : 'Select an agent'}
                </div>
                <div class="chat-messages" id="chat-messages">
                    ${!preselectedAgent ? UI.emptyState('◈', 'Select an agent to start chatting') : '<div style="text-align:center;color:var(--text-muted);padding:2rem">Loading...</div>'}
                </div>
                <div class="chat-input-area">
                    <input class="chat-input" id="chat-input" placeholder="Type a message..." ${!preselectedAgent ? 'disabled' : ''}>
                    <button class="btn btn-primary" id="chat-send" ${!preselectedAgent ? 'disabled' : ''}>Send</button>
                </div>
            </div>
        </div>
    `;

    let currentAgentId = preselectedAgent;

    // Load messages for an agent
    async function loadChat(agentId) {
        currentAgentId = agentId;
        const agent = agents.find(a => a.id === agentId);
        document.getElementById('chat-header').textContent = agent?.name || agentId;
        document.getElementById('chat-input').disabled = false;
        document.getElementById('chat-send').disabled = false;

        // Update active state
        container.querySelectorAll('.chat-agent-item').forEach(el => {
            el.classList.toggle('active', el.dataset.agentId === agentId);
        });

        const msgs = await API.getChat(agentId);
        const msgContainer = document.getElementById('chat-messages');
        if (msgs.length === 0) {
            msgContainer.innerHTML = UI.emptyState('◈', 'No messages yet. Say hello!');
        } else {
            msgContainer.innerHTML = msgs.map(m => `
                <div class="chat-msg ${m.sender}">
                    <div>${escapeHtml(m.content)}</div>
                    <div class="chat-msg-time">${UI.formatTime(m.timestamp)}</div>
                </div>
            `).join('');
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }
    }

    // Send message
    async function sendMessage() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text || !currentAgentId) return;

        input.value = '';
        const msgContainer = document.getElementById('chat-messages');

        // Optimistic add
        msgContainer.innerHTML += `<div class="chat-msg user"><div>${escapeHtml(text)}</div><div class="chat-msg-time">now</div></div>`;
        msgContainer.scrollTop = msgContainer.scrollHeight;

        await API.sendChat(currentAgentId, text);

        // Reload to get agent response
        await loadChat(currentAgentId);
    }

    // Events
    container.querySelectorAll('.chat-agent-item').forEach(el => {
        el.addEventListener('click', () => loadChat(el.dataset.agentId));
    });

    document.getElementById('chat-send').addEventListener('click', sendMessage);
    document.getElementById('chat-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Load initial chat
    if (preselectedAgent) loadChat(preselectedAgent);
});

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}
