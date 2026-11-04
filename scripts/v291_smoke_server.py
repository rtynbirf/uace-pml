#!/usr/bin/env python3
# Смоук-стенд v29.0.1: enforce-TT + виртуализированная лента (60) + Shadow DOM + стриминг
# + список из 6 чатов для сценариев Стоп/resume/фильтр. Любой путь отдаёт страницу.
import http.server, socketserver, sys

PAGE = """<!doctype html><html><head><meta charset="utf-8"><title>Стенд v29.0.1</title>
<style>
 .sidebar{position:fixed;left:0;top:0;bottom:0;width:220px;overflow:auto;border-right:1px solid #bbb}
 .sidebar a{display:block;padding:8px 12px;color:#0451a5}
 main{margin-left:240px;padding:10px}
 #toolbar button{margin-right:8px}
 #virt{height:360px;overflow-y:auto;position:relative;border:1px solid #999;width:600px}
 #virtSpacer{position:relative;width:100%}
 .vitem{position:absolute;left:0;right:0;height:56px;padding:6px;border-bottom:1px solid #ddd;box-sizing:border-box}
 .msg{padding:8px;border:1px solid #ddd;margin:6px 0;max-width:600px}
</style></head>
<body>
<nav class="sidebar" id="sidebar">
  <a href="/c/aaaaaaaa-1">Чат один</a><a href="/c/aaaaaaaa-2">Чат два</a><a href="/c/aaaaaaaa-3">Чат три</a>
  <a href="/c/aaaaaaaa-4">Чат четыре</a><a href="/c/aaaaaaaa-5">Чат пять</a><a href="/c/aaaaaaaa-6">служебный-чат</a>
</nav>
<main id="main">
  <div id="toolbar">
    <button data-key="virt">Лента-60 (виртуализация)</button>
    <button data-key="shadow">Тень</button>
    <button data-key="stream">Стрим</button>
  </div>
  <div id="feed"></div>
</main>
<script>
/* H13: мёртвые ключи ДО загрузки юзерскрипта — миграция обязана их вычистить */
try { localStorage.setItem('uaice_strip','1'); localStorage.setItem('uaice_zipinner','1'); localStorage.setItem('uaice_evening','1'); localStorage.setItem('uaice_fsz','1'); localStorage.setItem('uaice_motion','1'); } catch(e){}
/* перехват скачиваний для проверки экспортов */
window.__DL__ = []; window.__DL_TEXT__ = []; window.__DL_DONE__ = 0;
(function(){
  const oc = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(o){ const u = oc(o); window.__DL__.push({url:u, size:o&&o.size, type:o&&o.type}); return u; };
  document.addEventListener('click', function(e){
    const a = e.target.closest && e.target.closest('a[download]');
    if (a) { e.preventDefault(); e.stopPropagation();
      fetch(a.href).then(r=>r.blob()).then(b=>new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.readAsText(b);}))
        .then(t=>{ window.__DL_TEXT__.push({name:a.getAttribute('download'), text:String(t)}); window.__DL_DONE__++; });
    }
  }, true);
})();
const FEEDS = { 'aaaaaaaa-1': 5, 'aaaaaaaa-2': 4, 'aaaaaaaa-3': 6, 'aaaaaaaa-4': 4, 'aaaaaaaa-5': 5, 'aaaaaaaa-6': 3 };
let streamTimer = null;
function renderChat(key){
  const feed = document.getElementById('feed');
  feed.replaceChildren();
  if (streamTimer) { clearInterval(streamTimer); streamTimer = null; }
  if (key === 'virt') return buildVirt(feed);
  if (key === 'shadow') return buildShadow(feed);
  if (key === 'stream') return buildStream(feed);
  const n = FEEDS[key] || 4;
  for (let i=1;i<=n;i++){
    const d = document.createElement('div');
    d.setAttribute('data-message-author-role', i%2 ? 'user' : 'assistant');
    const pp = document.createElement('p');
    pp.textContent = 'Чат '+key+' сообщение №'+i+' — '+(i%2?'вопрос про тест.':'ответ с деталями теста.');
    d.appendChild(pp); feed.appendChild(d);
  }
}
function buildVirt(feed){
  const wrap = document.createElement('div'); wrap.id='virt';
  const spacer = document.createElement('div'); spacer.id='virtSpacer'; spacer.style.height='3600px';
  wrap.appendChild(spacer); feed.appendChild(wrap);
  const H=56;
  function paint(){
    const st = wrap.scrollTop;
    const first = Math.max(0, Math.floor(st/H)-2), last = Math.min(59, Math.ceil((st+wrap.clientHeight)/H)+2);
    spacer.replaceChildren();
    for(let i=first;i<=last;i++){
      const d=document.createElement('div'); d.className='vitem'; d.style.top=(i*H)+'px';
      d.setAttribute('data-message-author-role', i%2 ? 'assistant' : 'user');
      d.textContent='Сообщение №'+(i+1)+' виртуализированной ленты — текст для проверки автоскролла H6.';
      spacer.appendChild(d);
    }
  }
  wrap.addEventListener('scroll', paint); paint();
}
function buildShadow(feed){
  const host=document.createElement('div'); host.id='shadowHost'; feed.appendChild(host);
  const sr=host.attachShadow({mode:'open'});
  const inner=document.createElement('div'); inner.className='chat-container';
  for(let i=1;i<=6;i++){ const d=document.createElement('div'); d.setAttribute('data-message-author-role', i%2?'user':'assistant'); const pp=document.createElement('p'); pp.textContent='Теневое сообщение №'+i+' — захват из Shadow DOM (H5).'; d.appendChild(pp); inner.appendChild(d); }
  sr.appendChild(inner);
}
function buildStream(feed){
  let i=0;
  streamTimer=setInterval(function(){ i++; const d=document.createElement('div'); d.setAttribute('data-message-author-role', i%2?'user':'assistant'); const pp=document.createElement('p'); pp.textContent='Стрим-сообщение №'+i+' из 10 (H7).'; d.appendChild(pp); feed.appendChild(d); if(i>=10){clearInterval(streamTimer);streamTimer=null;} },400);
}
function route(){
  let key = location.pathname.replace('/c/','') || 'one';
  document.title = 'Чат: '+key+' — Стенд v29.0.1';
  renderChat(key);
}
document.getElementById('sidebar').addEventListener('click', function(e){
  const a=e.target.closest('a'); if(!a) return; e.preventDefault();
  history.pushState({},'',a.getAttribute('href')); route();
});
document.getElementById('toolbar').addEventListener('click', function(e){
  const b=e.target.closest('button'); if(!b) return;
  history.pushState({},'', '/c/'+b.getAttribute('data-key')); route();
});
addEventListener('popstate', route);
route();
if (window.trustedTypes && trustedTypes.createPolicy) { try { trustedTypes.createPolicy('test-host-default', { createHTML: function(s){ return String(s); } }); } catch(e){} }
</script>
<script>
INJECT
</script>
</body></html>"""

src = open('/home/z/my-project/download/uace-pml-v29.0.1-evidence.user.js', encoding='utf-8').read()
i = src.find('(function () {')
if i < 0: sys.exit('IIFE не найден')
html = PAGE.replace('INJECT', src[i:])
open('/home/z/my-project/scripts/v291_smoke_page.html', 'w', encoding='utf-8').write(html)
print('page built, bytes:', len(html))

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        body = html.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        # имитация gemini: enforce Trusted Types
        self.send_header('Content-Security-Policy', "require-trusted-types-for 'script'")
        self.end_headers()
        self.wfile.write(body)

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', 8792), H) as httpd:
    print('serving on 8792')
    httpd.serve_forever()
