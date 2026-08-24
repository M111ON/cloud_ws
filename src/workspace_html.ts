/* workspace_html.ts — HTML templates (double-quoted strings to avoid escaping) */

export function dashboardHtml(): string {
  const s: string[] = [];
  s.push("<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\">");
  s.push("<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">");
  s.push("<title>Cloud Workspace Pool</title><style>");
  // Animations
  s.push("@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}");
  s.push("@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}");
  s.push("@keyframes gaugeAnim{from{stroke-dashoffset:283}to{stroke-dashoffset:var(--target)}}");
  s.push("@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}");
  s.push("@keyframes starPop{0%{transform:scale(1)}50%{transform:scale(1.3)}100%{transform:scale(1)}}");
  s.push("@keyframes spin{to{transform:rotate(360deg)}}");
  // Base
  s.push("*{box-sizing:border-box;margin:0;padding:0}");
  s.push("body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#0a0a1a 0%,#0d1117 50%,#0a0a1a 100%);color:#e0e0e0;min-height:100vh}");
  s.push(".c{max-width:900px;margin:0 auto;padding:20px}");
  s.push("h1{font-size:1.8rem;margin-bottom:4px;color:#fff;background:linear-gradient(90deg,#6366f1,#a78bfa,#6366f1);background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 3s infinite linear}");
  s.push(".sub{color:#888;font-size:.85rem;margin-bottom:24px}");
  // Gauge stats
  s.push(".gs{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px}");
  s.push(".gc{background:rgba(26,26,42,.8);backdrop-filter:blur(10px);border:1px solid rgba(99,102,241,.15);border-radius:16px;padding:16px 8px;text-align:center;transition:all .3s ease;animation:fadeIn .6s ease both}");
  s.push(".gc:hover{transform:translateY(-4px);border-color:rgba(99,102,241,.4);box-shadow:0 8px 30px rgba(99,102,241,.15)}");
  s.push(".gauge{position:relative;width:80px;height:80px;margin:0 auto 8px}");
  s.push(".gauge svg{width:80px;height:80px;transform:rotate(-90deg)}");
  s.push(".gauge circle{fill:none;stroke-width:6;stroke-linecap:round}");
  s.push(".gauge .bg{stroke:rgba(255,255,255,.06)}");
  s.push(".gauge .fg{stroke:var(--gc);stroke-dasharray:283;animation:gaugeAnim 1.2s ease-out both}");
  s.push(".gauge .val{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:1.3rem;font-weight:700;color:#fff}");
  s.push(".gl{font-size:.7rem;color:#888;margin-top:2px}");
  // Action bar
  s.push(".ab{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}");
  s.push(".rf{padding:8px 18px;border:none;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.85rem;cursor:pointer;transition:all .2s}");
  s.push(".rf:hover{transform:translateY(-1px);box-shadow:0 4px 15px rgba(99,102,241,.4)}");
  // Workspace list
  s.push(".wl{display:flex;flex-direction:column;gap:12px}");
  s.push(".wc{background:rgba(26,26,42,.8);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px;cursor:pointer;transition:all .3s ease;animation:slideUp .5s ease both;position:relative;overflow:hidden}");
  s.push(".wc::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#6366f1,#a78bfa);opacity:0;transition:opacity .3s}");
  s.push(".wc:hover{border-color:rgba(99,102,241,.4);transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,0,0,.3)}.wc:hover::before{opacity:1}");
  s.push(".wc.cl{border-color:rgba(245,158,11,.3)}.wc.cl::before{background:linear-gradient(90deg,#f59e0b,#fbbf24);opacity:1}");
  s.push(".wc.st{border-color:rgba(239,68,68,.3)}.wc.st::before{background:linear-gradient(90deg,#ef4444,#f87171);opacity:1}");
  s.push(".wh{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}");
  s.push(".wn{font-size:1.05rem;font-weight:600;color:#fff}");
  s.push(".wb{display:flex;gap:6px;flex-wrap:wrap}");
  s.push(".ws{font-size:.65rem;padding:3px 10px;border-radius:20px;font-weight:500}");
  s.push(".ws.a{background:rgba(74,222,128,.12);color:#4ade80;border:1px solid rgba(74,222,128,.2)}");
  s.push(".ws.p{background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.2)}");
  s.push(".ws.c{background:rgba(245,158,11,.12);color:#fbbf24;border:1px solid rgba(245,158,11,.2)}");
  s.push(".ws.s{background:rgba(239,68,68,.12);color:#f87171;border:1px solid rgba(239,68,68,.2)}");
  s.push(".wm{display:flex;gap:12px;font-size:.75rem;color:#888;flex-wrap:wrap;margin-top:6px}");
  s.push(".wm span{display:flex;align-items:center;gap:4px}");
  s.push(".wl2{margin-top:8px;font-size:.75rem;color:#94a3b8}");
  s.push(".wl2 .ag{color:#fbbf24;font-weight:600;background:rgba(245,158,11,.1);padding:2px 8px;border-radius:8px}");
  s.push(".wa{margin-top:12px;display:flex;gap:6px;flex-wrap:wrap}");
  s.push(".wa button{padding:6px 14px;font-size:.75rem;border-radius:10px;background:rgba(255,255,255,.06);color:#ccc;border:1px solid rgba(255,255,255,.08);cursor:pointer;transition:all .2s}");
  s.push(".wa button:hover{background:rgba(99,102,241,.15);border-color:rgba(99,102,241,.3);color:#fff;transform:translateY(-1px)}");
  s.push(".wa button.del{color:#f87171;border-color:rgba(239,68,68,.2)}.wa button.del:hover{background:rgba(239,68,68,.15)}");
  s.push(".em{color:#666;text-align:center;padding:60px 20px;font-size:.95rem;animation:fadeIn .5s ease}");
  s.push(".er{color:#f87171;font-size:.85rem;margin:8px 0;padding:10px 14px;background:rgba(239,68,68,.1);border-radius:10px;border:1px solid rgba(239,68,68,.2)}");
  s.push(".ld{color:#888;font-size:.85rem;display:flex;align-items:center;gap:8px}");
  s.push(".ld::before{content:'';width:16px;height:16px;border:2px solid rgba(99,102,241,.3);border-top-color:#6366f1;border-radius:50%;animation:spin .8s linear infinite}");
  s.push("@media(max-width:640px){.gs{grid-template-columns:repeat(3,1fr)}.gauge{width:60px;height:60px}.gauge svg{width:60px;height:60px}.gauge .val{font-size:1rem}}");
  // Nav bar
  s.push(".nav{display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap}");
  s.push(".nav a{padding:6px 14px;border-radius:8px;background:rgba(26,26,42,.8);border:1px solid rgba(255,255,255,.08);color:#888;font-size:.78rem;text-decoration:none;transition:all .15s;white-space:nowrap;backdrop-filter:blur(10px)}");
  s.push(".nav a:hover{color:#e0e0e0;border-color:rgba(99,102,241,.4);background:rgba(99,102,241,.15)}");
  s.push(".nav a.cur{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-color:#6366f1}");
  // Tabs
  s.push(".tabs{display:flex;gap:4px;margin-bottom:20px;flex-wrap:wrap}");
  s.push(".tab{padding:10px 18px;border-radius:12px;background:rgba(26,26,42,.8);border:1px solid rgba(255,255,255,.08);color:#888;cursor:pointer;font-size:.85rem;transition:all .2s;backdrop-filter:blur(10px)}");
  s.push(".tab:hover{color:#ccc;border-color:rgba(99,102,241,.3)}");
  s.push(".tab.ac{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-color:#6366f1;box-shadow:0 4px 15px rgba(99,102,241,.3)}");
  s.push(".panel{display:none}.panel.ac{display:block;animation:fadeIn .3s ease}");
  // Search
  s.push(".sbox{display:flex;gap:8px;margin-bottom:16px}");
  s.push(".sbox input{flex:1;padding:12px 16px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.03);color:#fff;font-size:.95rem;outline:none;transition:border-color .2s}");
  s.push(".sbox input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.15)}");
  s.push(".sbox button{padding:12px 24px;border:none;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.95rem;cursor:pointer;transition:all .2s}");
  s.push(".sbox button:hover{transform:translateY(-1px);box-shadow:0 4px 15px rgba(99,102,241,.4)}");
  s.push(".sres{display:flex;flex-direction:column;gap:10px}");
  s.push(".sri{background:rgba(26,26,42,.8);border:1px solid rgba(99,102,241,.15);border-radius:12px;padding:14px;animation:slideUp .3s ease both}");
  s.push(".sri .src{font-size:.7rem;color:#6366f1;margin-bottom:4px}");
  s.push(".sri .srt{font-size:.85rem;color:#ccc;line-height:1.5;white-space:pre-wrap;word-break:break-word}");
  s.push(".sri .srt b{color:#a78bfa;font-weight:600}");
  // Feedback panel
  s.push(".fb-panel{background:rgba(26,26,42,.8);border:1px solid rgba(99,102,241,.15);border-radius:16px;padding:20px;animation:slideUp .3s ease}");
  s.push(".fb-panel h3{font-size:1rem;color:#fff;margin-bottom:16px}");
  s.push(".fb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px}");
  s.push(".fb-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:14px;text-align:center}");
  s.push(".fb-card .fb-num{font-size:1.5rem;font-weight:700;color:#6366f1}");
  s.push(".fb-card .fb-lbl{font-size:.75rem;color:#888;margin-top:4px}");
  s.push(".fb-list{display:flex;flex-direction:column;gap:8px}");
  s.push(".fb-item{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px;display:flex;justify-content:space-between;align-items:center}");
  s.push(".fb-item .fb-cat{font-size:.75rem;padding:3px 10px;border-radius:20px;background:rgba(99,102,241,.15);color:#a78bfa}");
  s.push(".fb-stars-row{display:flex;gap:2px;font-size:.9rem;color:#fbbf24}");
  s.push("</style></head><body><div class=\"c\">");
  s.push("<h1>&#9889; Cloud Workspace Pool</h1>");
  s.push("<p class=\"sub\">Active workspaces &mdash; loaded state, no search needed</p>");
  s.push("<div class=\"nav\"><a href=\"/\">Search</a><a href=\"/admin\">Admin</a><a href=\"/workspace\" class=\"cur\">Pool</a></div>");
  s.push("<div class=\"gs\" id=\"stats\"></div>");
  // Tabs
  s.push("<div class=\"tabs\">");
  s.push("<div class=\"tab ac\" onclick=\"showTab(0)\">&#x1f4ca; Pool</div>");
  s.push("<div class=\"tab\" onclick=\"showTab(1)\">&#x1f50d; Search</div>");
  s.push("<div class=\"tab\" onclick=\"showTab(2)\">&#11088; Feedback</div>");
  s.push("</div>");
  // Pool panel
  s.push("<div class=\"panel ac\" id=\"p0\">");
  s.push("<div class=\"ab\"><button class=\"rf\" onclick=\"loadPool()\">&#x21bb; Refresh</button></div>");
  s.push("<div id=\"status\"></div>");
  s.push("<div id=\"workspaces\" class=\"wl\"></div>");
  s.push("</div>");
  // Search panel
  s.push("<div class=\"panel\" id=\"p1\">");
  s.push("<div class=\"sbox\"><input type=\"text\" id=\"sq\" placeholder=\"Search memories...\" onkeydown=\"if(event.key==='Enter')doSearch()\"><button onclick=\"doSearch()\">Search</button></div>");
  s.push("<div id=\"sstat\"></div>");
  s.push("<div id=\"sres\" class=\"sres\"></div>");
  s.push("</div>");
  // Feedback panel
  s.push("<div class=\"panel\" id=\"p2\">");
  s.push("<div class=\"fb-panel\" id=\"fbpanel\"><h3>&#11088; Feedback Summary</h3><div id=\"fbcontent\"><div class=\"ld\">Loading...</div></div></div>");
  s.push("</div>");
  s.push("</div><script>");
  // JavaScript (no template literals — all string concat)
  s.push("var W=location.origin;");
  s.push("var st=document.getElementById('status');");
  s.push("var wsEl=document.getElementById('workspaces');");
  s.push("var statsEl=document.getElementById('stats');");
  s.push("var now=Date.now();");
  s.push("function ta(ts){if(!ts)return'never';var m=Math.round((now-ts)/60000);if(m<60)return m+'m ago';var h=Math.round(m/60);if(h<24)return h+'h ago';return Math.round(h/24)+'d ago';}");
  s.push("function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML;}");
  s.push("function ak(){var k=localStorage.getItem('CF_MEMORY_KEY')||prompt('API key:')||'';if(k)localStorage.setItem('CF_MEMORY_KEY',k);return k;}");
  s.push("function ah(json){var h=json?{'Content-Type':'application/json'}:{};var k=ak();if(k)h['X-API-Key']=k;return h;}");
  s.push("function gauge(val,max,color){var pct=Math.min(val/max,1);var off=283-(283*pct);return '<div class=\"gauge\" style=\"--gc:'+color+'\"><svg viewBox=\"0 0 100 100\"><circle class=\"bg\" cx=\"50\" cy=\"50\" r=\"45\"/><circle class=\"fg\" cx=\"50\" cy=\"50\" r=\"45\" style=\"stroke:'+color+';--target:'+off+'\"/></svg><div class=\"val\">'+val+'</div></div>'}");
  // Tab switching
  s.push("function showTab(i){document.querySelectorAll('.tab').forEach(function(t,j){t.className='tab'+(j===i?' ac':'')});document.querySelectorAll('.panel').forEach(function(p,j){p.className='panel'+(j===i?' ac':'')});if(i===0)loadPool();if(i===2)loadFeedback();}");
  // Search
  s.push("async function doSearch(){");
  s.push("var q=document.getElementById('sq').value.trim();if(!q)return;");
  s.push("var ss=document.getElementById('sstat');ss.className='ld';ss.innerHTML='Searching...';document.getElementById('sres').innerHTML='';");
  s.push("try{var r=await fetch(W+'/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:q,k:10})});");
  s.push("var d=await r.json();if(d.error)throw new Error(d.error);");
  s.push("var rs=d.results||[];ss.className='';ss.innerHTML=rs.length+' result(s)';");
  s.push("document.getElementById('sres').innerHTML=rs.map(function(h,i){");
  s.push("var txt=(h.context||h.text||'').substring(0,500);");
  s.push("return '<div class=\"sri\" style=\"animation-delay:'+(i*0.05)+'s\"><div class=\"src\">'+esc(h.source_file)+' \u00b7 score: '+h.score.toFixed(3)+'</div><div class=\"srt\">'+esc(txt)+'</div></div>';");
  s.push("}).join('');}catch(e){document.getElementById('sstat').innerHTML='<div class=\"er\">'+esc(e.message)+'</div>';}}");
  // Feedback summary
  s.push("async function loadFeedback(){var el=document.getElementById('fbcontent');el.innerHTML='Loading...';");
  s.push("try{var r=await fetch(W+'/workspace/feedback/summary?days=30');var d=await r.json();");
  s.push("if(!d.ok)throw new Error(d.error||'Failed');var h='';");
  s.push("h+='<div class=\"fb-grid\">';");
  s.push("h+='<div class=\"fb-card\"><div class=\"fb-num\">'+d.total+'</div><div class=\"fb-lbl\">Total</div></div>';");
  s.push("h+='<div class=\"fb-card\"><div class=\"fb-num\">'+d.avg_rating+'</div><div class=\"fb-lbl\">Avg Rating</div></div>';");
  s.push("h+='<div class=\"fb-card\"><div class=\"fb-num\">'+d.days+'</div><div class=\"fb-lbl\">Days</div></div>';");
  s.push("h+='</div>';");
  s.push("if(d.by_category&&d.by_category.length){h+='<p style=\"color:#ccc;font-size:.85rem;margin:12px 0 8px\">By Category:</p><div class=\"fb-list\">';");
  s.push("d.by_category.forEach(function(c){h+='<div class=\"fb-item\"><span class=\"fb-cat\">'+esc(c.category)+'</span><span style=\"color:#888;font-size:.8rem\">'+c.count+' reviews, avg '+c.avg_rating+'</span></div>';});");
  s.push("h+='</div>';}");
  s.push("el.innerHTML=h;}catch(e){el.innerHTML='Error: '+esc(e.message);}}");
  // Pool loader
  s.push("async function loadPool(){");
  s.push("st.innerHTML='<div class=\"ld\">Loading...</div>';wsEl.innerHTML='';");
  s.push("try{");
  s.push("var a=await fetch(W+'/workspace/list?status=active').then(function(r){return r.json()});");
  s.push("var p=await fetch(W+'/workspace/list?status=paused').then(function(r){return r.json()});");
  s.push("var ps=await fetch(W+'/workspace/pool-status').then(function(r){return r.json()}).catch(function(){return null});");
  s.push("var ac=a.count||0,pc=p.count||0;");
  s.push("var tf=(a.workspaces||[]).reduce(function(s2,w){return s2+(w.file_count||0)},0);");
  s.push("var cc=(ps&&ps.claimed||[]).length,sc=(ps&&ps.potentially_stale||[]).length;");
  s.push("var labels=['Active','Paused','Claimed','Stale','Files'];var vals=[ac,pc,cc,sc,tf];var colors=['#4ade80','#fbbf24','#f59e0b','#ef4444','#6366f1'];var maxes=[20,20,10,10,100];");
  s.push("statsEl.innerHTML=labels.map(function(l,i){return '<div class=\"gc\">'+gauge(vals[i],maxes[i],colors[i])+'<div class=\"gl\">'+l+'</div></div>';}).join('');");
  s.push("st.innerHTML='';");
  s.push("var all=(a.workspaces||[]).concat(p.workspaces||[]);");
  s.push("if(!all.length){wsEl.innerHTML='<div class=\"em\">No workspaces yet.</div>';return;}");
  s.push("var cm={},sm={};");
  s.push("(ps&&ps.claimed||[]).forEach(function(c){cm[c.id]=c});");
  s.push("(ps&&ps.potentially_stale||[]).forEach(function(s3){sm[s3.id]=s3});");
  s.push("wsEl.innerHTML=all.map(function(ws){");
  s.push("var u=ta(ws.updated_at),cl=cm[ws.id],st2=sm[ws.id];");
  s.push("var cc2=cl?'cl':(st2?'st':'');");
  s.push("var b='<span class=\"ws '+ws.status+'\">'+ws.status+'</span>';");
  s.push("if(cl)b+='<span class=\"ws c\">&#x1f511; '+esc(cl.claimed_by)+'</span>';");
  s.push("if(st2)b+='<span class=\"ws s\">&#9888; idle '+st2.idle_hours+'h</span>';");
  s.push("var lc='';");
  s.push("if(cl){lc='<div class=\"wl2\">Claimed by <span class=\"ag\">'+esc(cl.claimed_by)+'</span> ('+cl.claimed_ago_min+'min ago)</div>';}");
  s.push("return '<div class=\"wc '+cc2+'\" onclick=\"loadWs(\\''+ws.id+'\\')\">'");
  s.push("+'<div class=\"wh\"><span class=\"wn\">'+esc(ws.name)+'</span><div class=\"wb\">'+b+'</div></div>'");
  s.push("+'<div class=\"wm\"><span>&#x1f4c4; '+(ws.file_count||0)+' files</span>'");
  s.push("+'<span>&#x1f527; '+(ws.variable_count||0)+' vars</span>'");
  s.push("+'<span>&#x1f4cb; '+(ws.decision_count||0)+' decisions</span>'");
  s.push("+'<span>&#x1f4cc; '+(ws.next_step_count||0)+' steps</span></div>'");
  s.push("+'<div class=\"wm\"><span>&#x1f550; '+u+'</span></div>'+lc");
  s.push("+'<div id=\"ws-detail-'+ws.id+'\"></div></div>';");
  s.push("}).join('');");
  s.push("}catch(e){st.innerHTML='<div class=\"er\">Error: '+esc(e.message)+'</div>';}}");
  s.push("async function loadWs(id){");
  s.push("var el=document.getElementById('ws-detail-'+id);");
  s.push("if(el.innerHTML){el.innerHTML='';return;}");
  s.push("el.innerHTML='<div class=\"ld\">Loading...</div>';");
  s.push("try{var r=await fetch(W+'/workspace/'+id);var d=await r.json();");
  s.push("if(!d.ok)throw new Error(d.error);var ws=d.workspace,s2=ws.state||{};");
  s.push("var h='<div style=\"margin-top:12px;animation:slideUp .3s ease\">';");
  // Files section
  s.push("var files=s2.files||{};var fkeys=Object.keys(files);");
  s.push("if(fkeys.length){h+='<div style=\"margin-bottom:12px\"><div style=\"font-size:.8rem;color:#6366f1;margin-bottom:6px;font-weight:600\">&#x1f4c4; Files ('+fkeys.length+')</div>';");
  s.push("fkeys.forEach(function(k){h+='<div style=\"background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:8px 12px;margin-bottom:6px\"><div style=\"font-size:.75rem;color:#a78bfa;margin-bottom:4px\">'+esc(k)+'</div><pre style=\"margin:0;font-size:.75rem;color:#888;white-space:pre-wrap;max-height:120px;overflow:auto\">'+esc(files[k].substring(0,500))+'</pre></div>';});");
  s.push("h+='</div>';}");
  // Variables section
  s.push("var vars=s2.variables||{};var vkeys=Object.keys(vars);");
  s.push("if(vkeys.length){h+='<div style=\"margin-bottom:12px\"><div style=\"font-size:.8rem;color:#8b5cf6;margin-bottom:6px;font-weight:600\">&#x1f527; Variables ('+vkeys.length+')</div>';");
  s.push("vkeys.forEach(function(k){h+='<div style=\"display:flex;justify-content:space-between;align-items:center;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.15);border-radius:8px;padding:8px 12px;margin-bottom:4px\"><span style=\"font-size:.8rem;color:#a78bfa\">'+esc(k)+'</span><span style=\"font-size:.8rem;color:#ccc\">'+esc(vars[k])+'</span></div>';});");
  s.push("h+='</div>';}");
  // Decisions section
  s.push("var decs=s2.decisions||{};var dkeys=Object.keys(decs);");
  s.push("if(dkeys.length){h+='<div style=\"margin-bottom:12px\"><div style=\"font-size:.8rem;color:#06b6d4;margin-bottom:6px;font-weight:600\">&#x1f4cb; Decisions ('+dkeys.length+')</div>';");
  s.push("dkeys.forEach(function(k){h+='<div style=\"background:rgba(6,182,212,.08);border:1px solid rgba(6,182,212,.15);border-radius:8px;padding:8px 12px;margin-bottom:4px\"><div style=\"font-size:.7rem;color:#22d3ee;margin-bottom:2px\">'+esc(k)+'</div><div style=\"font-size:.8rem;color:#ccc\">'+esc(decs[k])+'</div></div>';});");
  s.push("h+='</div>';}");
  // Next steps section
  s.push("var steps=s2.next_steps||[];");
  s.push("if(steps.length){h+='<div style=\"margin-bottom:12px\"><div style=\"font-size:.8rem;color:#10b981;margin-bottom:6px;font-weight:600\">&#x1f4cc; Next Steps ('+steps.length+')</div>';");
  s.push("steps.forEach(function(s3,i){h+='<div style=\"display:flex;align-items:center;gap:8px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.15);border-radius:8px;padding:8px 12px;margin-bottom:4px\"><span style=\"font-size:.7rem;color:#34d399;min-width:20px\">'+(i+1)+'</span><span style=\"font-size:.8rem;color:#ccc\">'+esc(s3)+'</span></div>';});");
  s.push("h+='</div>';}");
  // Context section
  s.push("var ctx=s2.context||'';");
  s.push("if(ctx){h+='<div style=\"margin-bottom:12px\"><div style=\"font-size:.8rem;color:#f59e0b;margin-bottom:6px;font-weight:600\">&#x1f4dd; Context</div>';");
  s.push("h+='<div style=\"background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.15);border-radius:8px;padding:10px 12px;font-size:.85rem;color:#ccc\">'+esc(ctx)+'</div></div>';}");
  s.push("h+='</div>';");
  // Action buttons
  s.push("h+='<div class=\"wa\">'");
  s.push("+'<button onclick=\"doHb(\\''+id+'\\')\">&#10084; Heartbeat</button> '");
  s.push("+'<button onclick=\"doCl(\\''+id+'\\')\">&#x1f511; Claim</button> '");
  s.push("+'<button onclick=\"doRl(\\''+id+'\\')\">&#x1f513; Release</button> '");
  s.push("+'<button onclick=\"doSc(\\''+id+'\\')\">&#x1f50d; Search</button> '");
  s.push("+'<button onclick=\"doDl(\\''+id+'\\')\" style=\"color:#f87171\">&#x1f5d1; Delete</button></div>';");
  s.push("el.innerHTML=h;}catch(e){el.innerHTML='<div class=\"er\">'+esc(e.message)+'</div>';}}");
  s.push("async function doHb(id){try{await fetch(W+'/workspace/'+id+'/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agent:'dashboard'})});loadPool();}catch(e){alert(e.message);}}");
  s.push("async function doCl(id){var a=prompt('Agent name:');if(!a)return;try{var r=await fetch(W+'/workspace/'+id+'/claim',{method:'POST',headers:ah(true),body:JSON.stringify({agent:a})});var d=await r.json();if(!d.ok)alert(d.error);else loadPool();}catch(e){alert(e.message);}}");
  s.push("async function doRl(id){var a=prompt('Agent name:');if(!a)return;try{var r=await fetch(W+'/workspace/'+id+'/release',{method:'POST',headers:ah(true),body:JSON.stringify({agent:a})});var d=await r.json();if(!d.ok)alert(d.error);else loadPool();}catch(e){alert(e.message);}}");
  s.push("async function doSc(id){var q=prompt('Search query:');if(!q)return;try{var r=await fetch(W+'/workspace/'+id+'/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:q,k:20})});var d=await r.json();if(!d.ok)return alert(d.error);var rs=d.results||[];if(!rs.length)return alert('No matches');var m=rs.map(function(r2){return '['+r2.category+'] '+r2.key+'\\n  '+r2.snippet}).join('\\n\\n');alert(rs.length+' match(es):\\n\\n'+m);}catch(e){alert(e.message);}}");
  s.push("async function doDl(id){if(!confirm('DELETE '+id+'?'))return;try{var r=await fetch(W+'/workspace/'+id+'/delete',{method:'POST',headers:ah(false)});var d=await r.json();if(!d.ok)alert(d.error);else loadPool();}catch(e){alert(e.message);}}");
  s.push("loadPool();");
  s.push("</script></body></html>");
  return s.join("");
}

export function editorHtml(): string {
  const s: string[] = [];
  s.push("<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\">");
  s.push("<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">");
  s.push("<title>Workspace Editor</title><style>");
  s.push("*{box-sizing:border-box;margin:0;padding:0}");
  s.push("body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0;min-height:100vh}");
  s.push(".c{max-width:900px;margin:0 auto;padding:16px}");
  s.push("h1{font-size:1.5rem;margin-bottom:4px;color:#fff}");
  s.push(".sub{color:#888;font-size:.85rem;margin-bottom:16px}");
  s.push(".tabs{display:flex;gap:4px;margin-bottom:16px}");
  s.push(".tab{padding:8px 16px;border-radius:8px;background:#1a1a1a;border:1px solid #333;color:#888;cursor:pointer;font-size:.85rem}");
  s.push(".tab.ac{background:#6366f1;color:#fff;border-color:#6366f1}");
  s.push(".p{display:none}");
  s.push(".p.ac{display:block}");
  s.push("label{display:block;font-size:.8rem;color:#888;margin-bottom:4px;margin-top:12px}");
  s.push("input,textarea,select{width:100%;padding:10px 12px;border:1px solid #333;border-radius:8px;background:#1a1a1a;color:#fff;font-size:.9rem;font-family:inherit;outline:none}");
  s.push("input:focus,textarea:focus{border-color:#6366f1}");
  s.push("textarea{min-height:120px;resize:vertical}");
  s.push("button{padding:10px 20px;border:none;border-radius:8px;background:#6366f1;color:#fff;font-size:.9rem;cursor:pointer;margin-top:12px}");
  s.push("button:active{background:#4f46e5}");
  s.push("button.sec{background:#374151}");
  s.push(".msg{margin-top:8px;padding:8px 12px;border-radius:6px;font-size:.8rem}");
  s.push(".msg.ok{background:#064e3b;color:#4ade80}");
  s.push(".msg.er{background:#450a0a;color:#f87171}");
  s.push(".ws-sel{display:flex;gap:8px;margin-bottom:16px}");
  s.push(".ws-sel select{flex:1}");
  // Nav bar
  s.push(".nav{display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap}");
  s.push(".nav a{padding:6px 14px;border-radius:8px;background:#1a1a1a;border:1px solid #333;color:#888;font-size:.78rem;text-decoration:none;transition:all .15s;white-space:nowrap}");
  s.push(".nav a:hover{color:#e0e0e0;border-color:#4338ca;background:#1e1b4b}");
  s.push(".nav a.cur{background:#6366f1;color:#fff;border-color:#6366f1}");
  s.push("</style></head><body><div class=\"c\">");
  s.push("<h1>&#9999;&#65039; Workspace Editor</h1>");
  s.push("<p class=\"sub\">Create, edit, and push workspace state from browser</p>");
  s.push("<div class=\"nav\"><a href=\"/\">Search</a><a href=\"/admin\">Admin</a><a href=\"/workspace\">Pool</a></div>");
  s.push("<div class=\"tabs\">");
  s.push("<div class=\"tab ac\" onclick=\"showTab(0)\">Create</div>");
  s.push("<div class=\"tab\" onclick=\"showTab(1)\">Edit</div>");
  s.push("<div class=\"tab\" onclick=\"showTab(2)\">Variables</div>");
  s.push("<div class=\"tab\" onclick=\"showTab(3)\">Decisions</div>");
  s.push("<div class=\"tab\" onclick=\"showTab(4)\">Steps</div>");
  s.push("</div>");
  // Create tab
  s.push("<div id=\"p0\" class=\"p ac\">");
  s.push("<label>Workspace Name</label><input type=\"text\" id=\"ws-name\" placeholder=\"e.g. DWGLS-refactor\">");
  s.push("<label>Label (optional)</label><input type=\"text\" id=\"ws-label\" placeholder=\"e.g. project\">");
  s.push("<label>Initial File Path</label><input type=\"text\" id=\"ws-fp\" placeholder=\"e.g. src/main.ts\">");
  s.push("<label>Initial File Content</label><textarea id=\"ws-fc\" placeholder=\"// file content...\"></textarea>");
  s.push("<button onclick=\"doCreate()\">Create Workspace</button>");
  s.push("<div id=\"mc\"></div></div>");
  // Edit tab
  s.push("<div id=\"p1\" class=\"p\"><div class=\"ws-sel\"><select id=\"ew\"><option value=\"\">Select workspace...</option></select>");
  s.push("<button class=\"sec\" onclick=\"loadEw()\">Load</button></div>");
  s.push("<div id=\"ec\" style=\"display:none\"><label>File Path</label><input type=\"text\" id=\"efp\" placeholder=\"path/to/file\">");
  s.push("<label>File Content</label><textarea id=\"efc\" rows=\"10\"></textarea>");
  s.push("<button onclick=\"doSaveFile()\">Save File</button>");
  s.push("<div id=\"me\"></div></div></div>");
  // Variables tab
  s.push("<div id=\"p2\" class=\"p\"><div class=\"ws-sel\"><select id=\"vw\"><option value=\"\">Select workspace...</option></select>");
  s.push("<button class=\"sec\" onclick=\"loadVw()\">Load</button></div>");
  s.push("<div id=\"vc\" style=\"display:none\"><label>Key</label><input type=\"text\" id=\"vk\" placeholder=\"key\">");
  s.push("<label>Value</label><input type=\"text\" id=\"vv\" placeholder=\"value\">");
  s.push("<button onclick=\"doAddVar()\">Add Variable</button>");
  s.push("<pre id=\"vl\" style=\"margin-top:12px;padding:10px;background:#111;border-radius:6px;font-size:.8rem;max-height:300px;overflow:auto\"></pre>");
  s.push("<div id=\"mv\"></div></div></div>");
  // Decisions tab
  s.push("<div id=\"p3\" class=\"p\"><div class=\"ws-sel\"><select id=\"dw\"><option value=\"\">Select workspace...</option></select>");
  s.push("<button class=\"sec\" onclick=\"loadDw()\">Load</button></div>");
  s.push("<div id=\"dc\" style=\"display:none\"><label>Decision ID</label><input type=\"text\" id=\"di\" placeholder=\"dec_001\">");
  s.push("<label>Description</label><textarea id=\"dd\" placeholder=\"What was decided...\"></textarea>");
  s.push("<button onclick=\"doAddDec()\">Record Decision</button>");
  s.push("<pre id=\"dl\" style=\"margin-top:12px;padding:10px;background:#111;border-radius:6px;font-size:.8rem;max-height:300px;overflow:auto\"></pre>");
  s.push("<div id=\"md\"></div></div></div>");
  // Steps tab
  s.push("<div id=\"p4\" class=\"p\"><div class=\"ws-sel\"><select id=\"sw\"><option value=\"\">Select workspace...</option></select>");
  s.push("<button class=\"sec\" onclick=\"loadSw()\">Load</button></div>");
  s.push("<div id=\"sc2\" style=\"display:none\"><label>Add Next Step</label><input type=\"text\" id=\"stx\" placeholder=\"What to do next...\">");
  s.push("<button onclick=\"doAddStep()\">Add Step</button>");
  s.push("<ol id=\"sl\" style=\"margin-top:12px;padding-left:20px;font-size:.85rem\"></ol>");
  s.push("<div id=\"ms\"></div></div></div>");
  s.push("</div><script>");
  // JavaScript
  s.push("var W=location.origin,cWs=null;");
  s.push("function showTab(i){document.querySelectorAll('.tab').forEach(function(t,j){t.className='tab'+(j===i?' ac':'')});document.querySelectorAll('.p').forEach(function(p,j){p.className='p'+(j===i?' ac':'')});}");
  s.push("function showM(id,m,ok){document.getElementById(id).innerHTML='<div class=\"msg '+(ok?'ok':'er')+'\">'+m+'</div>';setTimeout(function(){document.getElementById(id).innerHTML='';},4000);}");
  s.push("function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML;}");
  s.push("function ak(){var k=localStorage.getItem('CF_MEMORY_KEY')||prompt('API key:')||'';if(k)localStorage.setItem('CF_MEMORY_KEY',k);return k;}");
  s.push("function ah(json){var h=json?{'Content-Type':'application/json'}:{};var k=ak();if(k)h['X-API-Key']=k;return h;}");
  s.push("async function refreshLists(){try{var r=await fetch(W+'/workspace/list?status=active');var d=await r.json();var wss=d.workspaces||[];var o='<option value=\"\">Select workspace...</option>';['ew','vw','dw','sw'].forEach(function(id){document.getElementById(id).innerHTML=o+wss.map(function(w){return '<option value=\"'+w.id+'\">'+w.name+'</option>';}).join('');});}catch(e){}}");
  s.push("async function doCreate(){var n=document.getElementById('ws-name').value.trim();if(!n)return showM('mc','Name required',false);var lb=document.getElementById('ws-label').value.trim()||undefined;var fp=document.getElementById('ws-fp').value.trim();var fc=document.getElementById('ws-fc').value;var body={name:n,label:lb,state:{}};if(fp&&fc){body.state.files={};body.state.files[fp]=fc;}try{var r=await fetch(W+'/workspace/create',{method:'POST',headers:ah(true),body:JSON.stringify(body)});var d=await r.json();if(d.ok){showM('mc','Created: '+d.workspace.id,true);refreshLists();}else showM('mc',d.error,false);}catch(e){showM('mc',e.message,false);}}");
  s.push("async function loadEw(){var id=document.getElementById('ew').value;if(!id)return;try{var r=await fetch(W+'/workspace/'+id);var d=await r.json();if(!d.ok)throw new Error(d.error);cWs=d.workspace;document.getElementById('ec').style.display='';var files=cWs.state.files||{};var keys=Object.keys(files);if(keys.length>0){document.getElementById('efp').value=keys[0];document.getElementById('efc').value=files[keys[0]];}showM('me','Loaded: '+cWs.name+' ('+keys.length+' files)',true);}catch(e){showM('me',e.message,false);}}");
  s.push("async function doSaveFile(){if(!cWs)return;var fp=document.getElementById('efp').value.trim();var fc=document.getElementById('efc').value;if(!fp)return showM('me','Path required',false);try{var body={state:{files:{}}};body.state.files[fp]=fc;var r=await fetch(W+'/workspace/'+cWs.id,{method:'POST',headers:ah(true),body:JSON.stringify(body)});var d=await r.json();if(d.ok){cWs=d.workspace;showM('me','Saved '+fp,true);}else showM('me',d.error,false);}catch(e){showM('me',e.message,false);}}");
  s.push("async function loadVw(){var id=document.getElementById('vw').value;if(!id)return;try{var r=await fetch(W+'/workspace/'+id);var d=await r.json();if(!d.ok)throw new Error(d.error);cWs=d.workspace;document.getElementById('vc').style.display='';document.getElementById('vl').textContent=JSON.stringify(cWs.state.variables||{},null,2);}catch(e){showM('mv',e.message,false);}}");
  s.push("async function doAddVar(){if(!cWs)return;var k=document.getElementById('vk').value.trim();var v=document.getElementById('vv').value.trim();if(!k)return showM('mv','Key required',false);try{var body={state:{variables:{}}};body.state.variables[k]=v;var r=await fetch(W+'/workspace/'+cWs.id,{method:'POST',headers:ah(true),body:JSON.stringify(body)});var d=await r.json();if(d.ok){cWs=d.workspace;document.getElementById('vl').textContent=JSON.stringify(cWs.state.variables||{},null,2);showM('mv','Saved '+k,true);}else showM('mv',d.error,false);}catch(e){showM('mv',e.message,false);}}");
  s.push("async function loadDw(){var id=document.getElementById('dw').value;if(!id)return;try{var r=await fetch(W+'/workspace/'+id);var d=await r.json();if(!d.ok)throw new Error(d.error);cWs=d.workspace;document.getElementById('dc').style.display='';document.getElementById('dl').textContent=JSON.stringify(cWs.state.decisions||{},null,2);}catch(e){showM('md',e.message,false);}}");
  s.push("async function doAddDec(){if(!cWs)return;var id2=document.getElementById('di').value.trim();var desc=document.getElementById('dd').value.trim();if(!id2||!desc)return showM('md','ID and description required',false);try{var body={state:{decisions:{}}};body.state.decisions[id2]=desc;var r=await fetch(W+'/workspace/'+cWs.id,{method:'POST',headers:ah(true),body:JSON.stringify(body)});var d=await r.json();if(d.ok){cWs=d.workspace;document.getElementById('dl').textContent=JSON.stringify(cWs.state.decisions||{},null,2);showM('md','Recorded: '+id2,true);}else showM('md',d.error,false);}catch(e){showM('md',e.message,false);}}");
  s.push("async function loadSw(){var id=document.getElementById('sw').value;if(!id)return;try{var r=await fetch(W+'/workspace/'+id);var d=await r.json();if(!d.ok)throw new Error(d.error);cWs=d.workspace;document.getElementById('sc2').style.display='';renderSteps();}catch(e){showM('ms',e.message,false);}}");
  s.push("function renderSteps(){var steps=cWs&&cWs.state?cWs.state.next_steps||[]:[];document.getElementById('sl').innerHTML=steps.map(function(s2){return '<li>'+esc(s2)+'</li>';}).join('');}");
  s.push("async function doAddStep(){if(!cWs)return;var txt=document.getElementById('stx').value.trim();if(!txt)return;var steps=(cWs.state.next_steps||[]).concat([txt]);try{var body={state:{next_steps:steps}};var r=await fetch(W+'/workspace/'+cWs.id,{method:'POST',headers:ah(true),body:JSON.stringify(body)});var d=await r.json();if(d.ok){cWs=d.workspace;renderSteps();document.getElementById('stx').value='';showM('ms','Added step',true);}else showM('ms',d.error,false);}catch(e){showM('ms',e.message,false);}}");
  s.push("refreshLists();");
  s.push("</script></body></html>");
  return s.join("");
}
