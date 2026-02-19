/**
 * rz-chat.js — AI Chat Widget for resistancezero.com
 * Floating chat bubble (bottom-right), purple theme.
 * Streams responses from /api/chat via Server-Sent Events.
 */
(function () {
  'use strict';

  const API_BASE = 'https://bfrfranco-github-io-586770625232.us-central1.run.app';
  const MAX_MESSAGES = 20; // Keep last 20 messages in memory

  // ─── State ──────────────────────────────────────────────────────────────────
  let isOpen = false;
  let isStreaming = false;
  let messages = []; // { role: 'user'|'assistant', content: string }

  // ─── Styles ─────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #rz-chat-widget * { box-sizing: border-box; font-family: 'Inter', system-ui, sans-serif; }

    #rz-chat-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #7c3aed, #4f46e5);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(124,58,237,0.45);
      z-index: 9998;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    #rz-chat-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(124,58,237,0.6);
    }
    #rz-chat-fab svg { width: 26px; height: 26px; fill: white; transition: opacity 0.2s; }
    #rz-chat-fab.open svg.icon-chat { display: none; }
    #rz-chat-fab.open svg.icon-close { display: block !important; }
    #rz-chat-fab svg.icon-close { display: none; }

    #rz-chat-window {
      position: fixed;
      bottom: 92px;
      right: 24px;
      width: 360px;
      max-width: calc(100vw - 32px);
      height: 520px;
      max-height: calc(100vh - 120px);
      background: #0f172a;
      border: 1px solid rgba(124,58,237,0.3);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.15);
      display: flex;
      flex-direction: column;
      z-index: 9999;
      transform: scale(0.92) translateY(16px);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease;
      overflow: hidden;
    }
    #rz-chat-window.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    #rz-chat-header {
      padding: 14px 16px;
      background: linear-gradient(135deg, rgba(124,58,237,0.25), rgba(79,70,229,0.15));
      border-bottom: 1px solid rgba(124,58,237,0.2);
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    #rz-chat-header .avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, #7c3aed, #4f46e5);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; flex-shrink: 0;
    }
    #rz-chat-header .info { flex: 1; min-width: 0; }
    #rz-chat-header .name {
      font-size: 0.88rem; font-weight: 600; color: #e2e8f0; line-height: 1.2;
    }
    #rz-chat-header .status {
      font-size: 0.72rem; color: #94a3b8;
      display: flex; align-items: center; gap: 4px; margin-top: 1px;
    }
    #rz-chat-header .status-dot {
      width: 6px; height: 6px; border-radius: 50%; background: #22c55e;
    }
    #rz-chat-clear {
      background: none; border: none; cursor: pointer; padding: 4px;
      color: #64748b; font-size: 0.72rem; transition: color 0.2s;
    }
    #rz-chat-clear:hover { color: #94a3b8; }

    #rz-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }
    #rz-chat-messages::-webkit-scrollbar { width: 4px; }
    #rz-chat-messages::-webkit-scrollbar-track { background: transparent; }
    #rz-chat-messages::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.3); border-radius: 2px; }

    .rz-msg {
      max-width: 85%;
      padding: 10px 13px;
      border-radius: 12px;
      font-size: 0.84rem;
      line-height: 1.5;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    .rz-msg.user {
      align-self: flex-end;
      background: linear-gradient(135deg, #7c3aed, #4f46e5);
      color: #fff;
      border-bottom-right-radius: 3px;
    }
    .rz-msg.assistant {
      align-self: flex-start;
      background: rgba(30,41,59,0.9);
      color: #cbd5e1;
      border: 1px solid rgba(124,58,237,0.15);
      border-bottom-left-radius: 3px;
    }
    .rz-msg.assistant.streaming::after {
      content: '▋';
      display: inline-block;
      animation: blink 0.8s step-end infinite;
      margin-left: 2px;
      color: #7c3aed;
    }
    @keyframes blink { 50% { opacity: 0; } }

    .rz-welcome {
      text-align: center;
      padding: 20px 12px;
      color: #475569;
      font-size: 0.8rem;
      line-height: 1.6;
    }
    .rz-welcome strong { color: #7c3aed; display: block; font-size: 0.9rem; margin-bottom: 6px; }

    #rz-chat-input-area {
      padding: 12px;
      border-top: 1px solid rgba(124,58,237,0.15);
      display: flex;
      gap: 8px;
      align-items: flex-end;
      flex-shrink: 0;
      background: rgba(15,23,42,0.9);
    }
    #rz-chat-input {
      flex: 1;
      background: rgba(30,41,59,0.8);
      border: 1px solid rgba(124,58,237,0.2);
      border-radius: 10px;
      padding: 9px 12px;
      color: #e2e8f0;
      font-size: 0.84rem;
      resize: none;
      min-height: 38px;
      max-height: 100px;
      outline: none;
      transition: border-color 0.2s;
      line-height: 1.4;
    }
    #rz-chat-input:focus { border-color: rgba(124,58,237,0.5); }
    #rz-chat-input::placeholder { color: #475569; }

    #rz-chat-send {
      width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
      background: linear-gradient(135deg, #7c3aed, #4f46e5);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: opacity 0.2s, transform 0.15s;
    }
    #rz-chat-send:hover { opacity: 0.85; transform: scale(1.05); }
    #rz-chat-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    #rz-chat-send svg { width: 17px; height: 17px; fill: white; }

    #rz-chat-footer {
      text-align: center;
      padding: 5px 12px 8px;
      font-size: 0.67rem;
      color: #334155;
      flex-shrink: 0;
    }
    #rz-chat-footer a { color: #475569; text-decoration: none; }
    #rz-chat-footer a:hover { color: #7c3aed; }

    @media (max-width: 420px) {
      #rz-chat-window { right: 12px; left: 12px; width: auto; bottom: 80px; }
      #rz-chat-fab { bottom: 16px; right: 16px; }
    }
  `;
  document.head.appendChild(style);

  // ─── DOM ────────────────────────────────────────────────────────────────────
  const widget = document.createElement('div');
  widget.id = 'rz-chat-widget';
  widget.innerHTML = `
    <button id="rz-chat-fab" aria-label="Open AI chat">
      <svg class="icon-chat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
      </svg>
      <svg class="icon-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>

    <div id="rz-chat-window" role="dialog" aria-label="AI Chat Assistant">
      <div id="rz-chat-header">
        <div class="avatar">🤖</div>
        <div class="info">
          <div class="name">RZ Assistant</div>
          <div class="status"><span class="status-dot"></span> Ask me anything</div>
        </div>
        <button id="rz-chat-clear" title="Clear conversation">Clear</button>
      </div>
      <div id="rz-chat-messages">
        <div class="rz-welcome">
          <strong>Hi! I'm the RZ Assistant 👋</strong>
          Ask me about Bagus's articles on data center engineering, his background, or anything on this site.
        </div>
      </div>
      <div id="rz-chat-input-area">
        <textarea id="rz-chat-input" placeholder="Ask about articles, Bagus, or data centers…" rows="1"></textarea>
        <button id="rz-chat-send" aria-label="Send message">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      <div id="rz-chat-footer">Powered by Claude · <a href="https://resistancezero.com" target="_blank">resistancezero.com</a></div>
    </div>
  `;
  document.body.appendChild(widget);

  // ─── Element refs ────────────────────────────────────────────────────────────
  const fab = document.getElementById('rz-chat-fab');
  const win = document.getElementById('rz-chat-window');
  const msgContainer = document.getElementById('rz-chat-messages');
  const input = document.getElementById('rz-chat-input');
  const sendBtn = document.getElementById('rz-chat-send');
  const clearBtn = document.getElementById('rz-chat-clear');

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function scrollToBottom() {
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function addMessage(role, content) {
    const el = document.createElement('div');
    el.className = `rz-msg ${role}`;
    el.textContent = content;
    msgContainer.appendChild(el);
    scrollToBottom();
    return el;
  }

  function setStreaming(state) {
    isStreaming = state;
    sendBtn.disabled = state;
    input.disabled = state;
  }

  function autoResize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  }

  // ─── Toggle open/close ───────────────────────────────────────────────────────
  function toggleChat() {
    isOpen = !isOpen;
    win.classList.toggle('open', isOpen);
    fab.classList.toggle('open', isOpen);
    if (isOpen) {
      setTimeout(() => input.focus(), 250);
    }
  }

  fab.addEventListener('click', toggleChat);

  // ─── Clear conversation ──────────────────────────────────────────────────────
  clearBtn.addEventListener('click', () => {
    messages = [];
    msgContainer.innerHTML = `
      <div class="rz-welcome">
        <strong>Hi! I'm the RZ Assistant 👋</strong>
        Ask me about Bagus's articles on data center engineering, his background, or anything on this site.
      </div>
    `;
  });

  // ─── Send message ────────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isStreaming) return;

    // Add to history and display
    messages.push({ role: 'user', content: text });
    if (messages.length > MAX_MESSAGES) messages = messages.slice(-MAX_MESSAGES);
    addMessage('user', text);

    input.value = '';
    input.style.height = 'auto';
    setStreaming(true);

    // Create assistant message bubble
    const assistantEl = document.createElement('div');
    assistantEl.className = 'rz-msg assistant streaming';
    assistantEl.textContent = '';
    msgContainer.appendChild(assistantEl);
    scrollToBottom();

    let fullResponse = '';

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'delta') {
              fullResponse += data.text;
              assistantEl.textContent = fullResponse;
              scrollToBottom();
            } else if (data.type === 'error') {
              assistantEl.textContent = data.message;
            } else if (data.type === 'done') {
              break;
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      assistantEl.textContent = err.message.includes('Failed to fetch')
        ? 'Connection error. Please check your connection and try again.'
        : `Error: ${err.message}`;
    }

    assistantEl.classList.remove('streaming');

    if (fullResponse) {
      messages.push({ role: 'assistant', content: fullResponse });
      if (messages.length > MAX_MESSAGES) messages = messages.slice(-MAX_MESSAGES);
    }

    setStreaming(false);
    input.focus();
  }

  sendBtn.addEventListener('click', sendMessage);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  input.addEventListener('input', autoResize);

  // ─── Close on Escape ─────────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) toggleChat();
  });

})();
