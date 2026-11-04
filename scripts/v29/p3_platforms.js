
/* ══════════════ L3 PLATFORMS — 36 адаптеров (порт v28.3.0, поле проверено) ══════════════ */
/* ПРАВИЛО v29: platform.role(el) = уровень улик «platform-selector». Поле
   strictAlternation зарезервировано: только явное полевое доказательство (§5). */
const PLATFORMS = [
  { name: 'ChatGPT', hosts: [/(^|\.)(chatgpt\.com|chat\.openai\.com)$/], msgSelectors: ['[data-message-author-role]', 'article[data-testid^="conversation-turn"]'], roleAttr: 'data-message-author-role', chatUrlPattern: '/c/{id}', sidebarSelectors: ['#stage-slideover-sidebar', 'nav[aria-label*="Chat" i]', 'nav', 'aside'] },
  { name: 'Claude', hosts: [/(^|\.)claude\.ai$/], msgSelectors: ['[data-testid="user-message"]', '[data-testid="assistant-message"]', '.font-claude-message', '.font-user-message'], role: el => el.matches('[data-testid="user-message"], .font-user-message') ? 'user' : 'assistant', chatUrlPattern: '/chat/{id}' },
  { name: 'Gemini', hosts: [/(^|\.)gemini\.google\.com$|(^|\.)bard\.google\.com$/], msgSelectors: ['user-query', 'model-response', 'conversation-turn', 'ms-chat-turn'], role: el => { const t = el.tagName.toLowerCase(); if (t === 'user-query') return 'user'; if (t === 'model-response') return 'assistant'; return /user|query|human/i.test(el.className || '') ? 'user' : 'assistant'; }, chatUrlPattern: '/app/{id}', sidebarSelectors: ['side-navigation-v2', 'bard-sidenav', 'mat-sidenav'] },
  { name: 'Google AI Studio', hosts: [/(^|\.)aistudio\.google\.com$/], msgSelectors: ['[data-test-id="user-message"]', '[data-test-id="model-message"]', 'ms-chat-turn'], role: el => (el.getAttribute('data-role') || '') === 'user' ? 'user' : 'assistant' },
  { name: 'DeepSeek', hosts: [/(^|\.)deepseek\.com$/], msgSelectors: ['[class*="message"]', '[class*="_message"]'], role: el => /user|human|query/i.test(el.className || '') ? 'user' : 'assistant', chatUrlPattern: '/a/chat/s/{id}', sidebarSelectors: ['aside', 'nav', '[class*="sidebar"]', '[class*="sider"]', '[class*="history"]'] },
  { name: 'Qwen', hosts: [/(^|\.)qwen\.ai$|(^|\.)tongyi\.aliyun\.com$/], msgSelectors: ['[class*="_message"]', '[data-message-role]', '[class*="chat-message"]', '[class*="markdown"]'], role: el => { const c = (el.className || '') + ' ' + (el.getAttribute('data-message-role') || '') + ' ' + (el.getAttribute('data-role') || ''); if (/user|human|question/i.test(c)) return 'user'; if (/assistant|bot|ai|model|response/i.test(c)) return 'assistant'; return 'unknown'; }, chatUrlPattern: '/c/{id}', sidebarSelectors: ['.sidebar-side', '.session-list-wrapper', 'a[aria-label="chat-item"]', 'a.chat-item-drag-link', '[class*="sidebar"]', 'aside', 'nav'] },
  { name: 'Kimi', hosts: [/(^|\.)kimi\.moonshot\.cn$|(^|\.)kimi\.ai$|(^|\.)kimi\.com$/], msgSelectors: ['.segment', '.segment-container', '[class*="message"]'], role: el => /user|human/i.test((el.className || '') + ' ' + (el.getAttribute('data-role') || '')) ? 'user' : 'assistant', sidebarSelectors: ['aside', 'nav', '.next-sidebar', '[class*="sidebar"]'] },
  { name: 'MiniMax', hosts: [/(^|\.)minimax\.io$|(^|\.)minimaxi\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat-item"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Mistral Le Chat', hosts: [/(^|\.)mistral\.ai$/], msgSelectors: ['[data-message-role]', '[class*="Message"]', '[class*="message"]'], role: el => { const r = el.getAttribute('data-message-role') || ''; if (/user/i.test(r)) return 'user'; if (/assistant/i.test(r)) return 'assistant'; return /user/i.test(el.className || '') ? 'user' : 'assistant'; } },
  { name: 'Groq', hosts: [/(^|\.)groq\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'OpenRouter', hosts: [/(^|\.)openrouter\.ai$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'HuggingChat', hosts: [/(^|\.)huggingface\.co$/], path: /^\/chat/, msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'NVIDIA NIM', hosts: [/(^|\.)build\.nvidia\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Z.ai', hosts: [/(^|\.)z\.ai$|(^|\.)chatglm\.cn$|(^|\.)space-z\.ai$/], msgSelectors: ['[data-role="user"]', '[data-role="assistant"]', '[data-message-role]', '[class*="UserMessage"]', '[class*="AssistantMessage"]', '[class*="message"]', '[class*="chat-message"]'], role: el => { const e = el.getAttribute('data-role') || el.getAttribute('data-message-role') || ''; if (e) return /user|human/i.test(e) ? 'user' : 'assistant'; return /user|human/i.test(el.className || '') ? 'user' : 'assistant'; }, chatUrlPattern: '/c/{id}', sidebarSelectors: ['.chat-aside', '.chat-history-list', '[class*="chat-aside"]', '[class*="chat-history"]', 'aside', 'nav'] },
  { name: 'Pollinations', hosts: [/(^|\.)pollinations\.ai$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Puter', hosts: [/(^|\.)puter\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Open WebUI', hosts: [/openwebui/, /^localhost(?::\d+)?$/, /^127\.0\.0\.1(?::\d+)?$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Cloudflare AI', hosts: [/(^|\.)playground\.ai\.cloudflare\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Grok', hosts: [/(^|\.)grok\.com$/], msgSelectors: ['[class*="message"]', '[class*="message-bubble"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant', chatUrlPattern: '/c/{id}', sidebarSelectors: ['aside', 'nav', '[class*="sidebar"]', '[class*="sidebar-group"]'] },
  { name: 'Microsoft Copilot', hosts: [/(^|\.)copilot\.microsoft\.com$/], msgSelectors: ['[class*="message"]', '[class*="turn"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Perplexity', hosts: [/(^|\.)perplexity\.ai$/], msgSelectors: ['[class*="query"]', '[class*="answer"]', '[class*="message"]'], role: el => /query|user|human/i.test(el.className || '') ? 'user' : 'assistant', chatUrlHints: [/\/search\//] },
  { name: 'Poe', hosts: [/(^|\.)poe\.com$/], msgSelectors: ['[class*="human-message"]', '[class*="chat-message"]', '[class*="message"]'], role: el => /human|user/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Character.ai', hosts: [/(^|\.)character\.ai$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'You.com', hosts: [/(^|\.)you\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Doubao', hosts: [/(^|\.)doubao\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Tencent Yuanbao', hosts: [/(^|\.)yuanbao\.tencent\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Meta AI', hosts: [/(^|\.)meta\.ai$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Yandex Alice AI', hosts: [/(^|\.)alice\.yandex\.ru$/], msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Yandex Alice (path)', hosts: [/(^|\.)yandex\.(ru|com)$|^ya\.ru$/], path: /\/alice/i, msgSelectors: ['[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'Dola', hosts: [/(^|\.)dola\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat-message"]'], role: el => { const c = (el.className || '').toLowerCase(); if (/user|human|question/i.test(c)) return 'user'; if (/bot|assistant|ai|response|reply/i.test(c)) return 'assistant'; return 'unknown'; }, chatUrlPattern: '/chat/{id}', sidebarSelectors: ['#flow_chat_sidebar', 'nav[class*="panel-"]', '[class*="conversation-item"]', 'nav', 'aside'] },
  { name: 'LM Arena', hosts: [/(^|\.)lmarena\.ai$|(^|\.)chat\.lmarena\.ai$/], msgSelectors: ['[data-message-author-role]', '[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'NotebookLM', hosts: [/(^|\.)notebooklm\.google\.com$/], msgSelectors: ['[class*="message"]', '[class*="chat-turn"]', '[class*="response"]'], role: el => /user|query|question/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'GitHub Copilot', hosts: [/(^|\.)github\.com$/], path: /\/copilot/i, msgSelectors: ['[data-testid="chat-message"]', '[class*="ChatMessage"]', '[class*="message"]'], role: el => { const t = (el.getAttribute('data-testid') || '') + ' ' + el.className; return /user/i.test(t) ? 'user' : 'assistant'; } },
  { name: 'Coze', hosts: [/(^|\.)coze\.com$|(^|\.)coze\.cn$/], msgSelectors: ['[class*="message"]', '[class*="chat-item"]', '[class*="ChatItem"]'], role: el => /user|human|question/i.test(el.className || '') ? 'user' : 'assistant', sidebarSelectors: ['aside', 'nav', '[class*="session"]', '[class*="history"]'] },
  { name: 'Phind', hosts: [/(^|\.)phind\.com$/], msgSelectors: ['[class*="message"]', '[class*="Question"]', '[class*="Answer"]'], role: el => /question|user|human/i.test(el.className || '') ? 'user' : 'assistant' },
  { name: 'v0 (Vercel)', hosts: [/(^|\.)v0\.dev$/], msgSelectors: ['[data-testid="message"]', '[class*="message"]', '[class*="chat"]'], role: el => /user|human/i.test(el.className || '') ? 'user' : 'assistant' }
];
function getPlatform() {
  const host = location.host, path = location.pathname;
  for (const p of PLATFORMS) {
    let ok = false;
    for (const re of p.hosts) { try { if (re.test(host)) { ok = true; break; } } catch (e) { journal.debug('platform', 'host-re-fail', p.name); } }
    if (!ok) continue;
    if (p.path) { try { if (!p.path.test(path)) continue; } catch (e) { journal.debug('platform', 'path-re-fail', p.name); } }
    return p;
  }
  return null;
}
/* chatId из шаблона платформы '/c/{id}' → канонический ключ (§18) */
function chatIdFrom(platform, url) {
  try {
    const u = new URL(url);
    if (platform && platform.chatUrlPattern) {
      const tmpl = platform.chatUrlPattern.split('/').filter(Boolean);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= tmpl.length) {
        let id = null, ok = true;
        for (let i = 0; i < tmpl.length; i++) { if (tmpl[i] === '{id}') id = parts[i]; else if (parts[i] !== tmpl[i]) { ok = false; break; } }
        if (ok && id) return id;
      }
    }
    return null;
  } catch (e) { return null; }
}
const canonicalKey = (platformName, url) => {
  let origin = '';
  try { origin = new URL(url).origin; } catch (e) { origin = 'origin?'; }
  const id = chatIdFrom(platformName ? PLATFORMS.find(p => p.name === platformName) : null, url);
  return (platformName || 'unknown') + '|' + origin + '|' + (id || 'url:' + fnv1aHex(url || ''));
};
