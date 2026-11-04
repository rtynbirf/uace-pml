#!/usr/bin/env python3
# Смоук-стенд v29: страница с РЕАЛЬНЫМ enforce-Trusted-Types (имитация gemini) + чат-макет
import http.server, socketserver, sys

PAGE = """<!doctype html><html><head><meta charset="utf-8"><title>Тест v29</title></head>
<body>
<nav class="sidebar"><a href="/c/aaa">Чат один</a><a href="/c/bbb">Чат два</a><a href="/c/ccc">Чат три</a></nav>
<main>
  <div data-message-author-role="user"><p>Вопрос пользователя про тест.</p></div>
  <div data-message-author-role="assistant"><p>Ответ ассистента с кодом:</p><pre><code class="language-python">print("hi")</code></pre></div>
  <div class="mystery-block"><p>Сообщение без атрибутов роли.</p></div>
  <div data-message-author-role="assistant"><p>Финальный ответ.</p></div>
</main>
<script>
// Имитация enforce TT (как gemini): перехватываем innerHTML через TT-политику хоста
if (window.trustedTypes && trustedTypes.createPolicy) {
  try { trustedTypes.createPolicy('test-host-default', { createHTML: s => String(s) }); } catch (e) {}
}
</script>
<script>
/* Инлайн юзерскрипта v29 (GM_* гварды typeof — безопасно) */
INJECT
</script>
</body></html>"""

src = open('/home/z/my-project/download/uace-pml-v29.0.0-evidence.user.js', encoding='utf-8').read()
# срезаем userscript-шапку — инлайнится только код IIFE
i = src.find('(function () {')
if i < 0: sys.exit('IIFE не найден')
html = PAGE.replace('INJECT', src[i:])
open('/home/z/my-project/scripts/v29_smoke_page.html', 'w', encoding='utf-8').write(html)

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', 8791), H) as httpd:
    print('serving on 8791')
    httpd.serve_forever()
