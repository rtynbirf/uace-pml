#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""TT-стенд: страница с enforce-CSP require-trusted-types-for 'script' (имитация gemini.google.com)
и контрольная страница без CSP. Юзерскрипт инлайнится в <head> (как инъекция Tampermonkey main-world)."""
import sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

PORT = 8901
D = '/home/z/my-project/download/'
NEW = open(D + 'uace-pml-v28.3.0-unified.user.js', encoding='utf-8').read()
OLD = open(D + 'uace-pml-v28.2.2-unified.user.js', encoding='utf-8').read()

def chat_page(script):
    return """<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>TT Test — fake chat</title>
<style>
 body{font-family:system-ui;margin:0;display:flex;background:#fff}
 nav{width:220px;background:#f6f6f6;padding:10px}
 main{flex:1;padding:16px;max-width:720px}
 .item{padding:10px;border-radius:8px;margin:2px 0;cursor:pointer}
 .item:hover{background:#ececec}
 .msg{margin:10px 0;padding:10px;border-radius:10px}
 .user{background:#e8f0fe}.model{background:#f1f3f4}
 .think{color:#5f6368;font-size:13px;border-left:3px solid #dadce0;padding-left:8px}
 .scroll{position:fixed;right:0;top:56px;bottom:0;left:220px;overflow-y:auto}
 header{position:fixed;top:0;left:0;right:0;height:56px;background:#fff;border-bottom:1px solid #dadce0;z-index:9}
</style>
<script>__SCRIPT__</script>
</head><body>
<header><h1 style="font-size:18px;margin:14px 20px">Fake Chat (TT-page)</h1></header>
<nav><div class="item">Чат 1</div><div class="item">Чат 2</div><div class="item">Чат 3</div><div class="item">Чат 4</div><div class="item">Чат 5</div></nav>
<main><div class="scroll">
 <div class="msg user">Привет! Это тестовое сообщение пользователя.</div>
 <div class="msg model"><div class="think">Размышления модели для теста thinking.</div>Привет! Это ответ модели с <b>разметкой</b> и кодом: <pre><code>const x = 42;</code></pre></div>
 <div class="msg user">Второй вопрос пользователя про экспорт PDF.</div>
 <div class="msg model">Второй ответ модели. Проверка печати: таблица стилей .msg должна применяться.</div>
 <div class="msg user">Третий вопрос.</div>
 <div class="msg model">Третий ответ.</div>
</div></main>
</body></html>""".replace('__SCRIPT__', script)

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query, keep_blank_values=True)
        tt = ('tt' in (u.path or ''))
        which = 'old' if q.get('old') else 'new'
        if u.path == '/health':
            self.send_response(200); self.send_header('Content-Type', 'text/plain'); self.end_headers()
            self.wfile.write(b'ok'); return
        body = chat_page(OLD if which == 'old' else NEW)
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        if tt:
            # имитация gemini.google.com: TT enforce + разрешённые скрипты/стили
            self.send_header('Content-Security-Policy',
                "require-trusted-types-for 'script'; script-src * 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; frame-src 'self' blob:;")
        self.end_headers()
        self.wfile.write(body.encode('utf-8'))

if __name__ == '__main__':
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), H)
    print('serving on %d' % PORT); sys.stdout.flush()
    srv.serve_forever()
