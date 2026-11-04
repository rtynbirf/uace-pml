#!/usr/bin/env python3
"""Генератор визуального стенда preview-v271.html: страница-имитация чата + инлайн userscript v27.1.
   Параметры URL до загрузки скрипта пишутся в localStorage: ?theme=auto|light|dark|warm&fsz=14."""
import pathlib

ROOT = pathlib.Path("/home/z/my-project")
US = (ROOT / "download/UACE-v27.1.0-HUMAN-FIRST.user.js").read_text(encoding="utf-8")
assert "</script" not in US, "userscript содержит закрывающий тег — инлайн невозможен"
assert "<!--" not in US, "userscript содержит HTML-комментарий — инлайн рискован"

HTML = """<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Стенд UACE v27.1 HUMAN-FIRST</title>
<style>
  body{font:16px/1.7 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;margin:0;padding:44px 48px;background:#eef0f4;color:#26262e;}
  .chat{max-width:720px;display:flex;flex-direction:column;gap:14px;}
  .msg{padding:12px 16px;border-radius:12px;max-width:78%;}
  .user{align-self:end;background:#d7e3f4;}
  .ai{align-self:start;background:#ffffff;border:1px solid #d9d9e0;}
  h1{font-size:20px;margin:0 0 6px;}
  .hint{color:#55555c;font-size:14px;margin:0 0 22px;}
  .space{height:52vh;}
</style>
<script>
  // Тема/кегль форсируются из URL ДО загрузки userscript
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('theme')) localStorage.setItem('uaice_theme', q.get('theme'));
    if (q.get('fsz')) localStorage.setItem('uaice_fsz', q.get('fsz'));
    if (q.get('clear') === '1') ['uaice_theme','uaice_fsz','uaice_motion','uaice_evening'].forEach(function(k){ localStorage.removeItem(k); });
  } catch (e) {}
</script>
</head>
<body>
<h1>Стенд визуальной проверки — UACE v27.1 HUMAN-FIRST</h1>
<p class="hint">Параметры: <code>?theme=light|dark|warm</code> (пусто = авто), <code>&amp;fsz=13..18</code>. Панель справа внизу.</p>
<div class="chat">
  <div class="msg user">Проверка панели поверх обычной страницы: системный акцент + переключатель режима.</div>
  <div class="msg ai">Панель UACE должна окраситься в акцент системы и переключаться симпатичным тумблером.</div>
</div>
<div class="space"></div>
<script>
__US__
</script>
</body>
</html>"""

out = ROOT / "scripts/preview-v271.html"
out.write_text(HTML.replace("__US__", US), encoding="utf-8")
print("OK ->", out, "bytes:", out.stat().st_size)
