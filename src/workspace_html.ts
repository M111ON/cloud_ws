/* workspace_html.ts — HTML templates (double-quoted strings to avoid escaping) */

export function dashboardHtml(): string {
  const s: string[] = [];
  s.push("<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\">");
  s.push("<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">");
  s.push("<title>Cloud Workspace Pool</title><style>");
  // Reset
  s.push("*{box-sizing:border-box;margin:0;padding:0}");
  s.push("body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#0a0a1a 0%,#0d1117 50%,#0a0a1a 100%);color:#e0e0e0;min-height:100vh;overflow-x:hidden}");
  // Animations
  s.push("@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}");
  s.push("@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}");
  s.push("@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}");
  s.push("@keyframes gaugeAnim{from{stroke-dashoffset:283}to{stroke-dashoffset:var(--target)}}");
  s.push("@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}");
  s.push("@keyframes glow{0%,100%{box-shadow:0 0 5px rgba(99,102,241,.3)}50%{box-shadow:0 0 20px rgba(99,102,241,.6)}}");
  s.push("@keyframes starPop{0%{transform:scale(1)}50%{transform:scale(1.3)}100%{transform:scale(1)}}");
  s.push("@keyframes ripple{0%{transform:scale(0);opacity:1}100%{transform:scale(2.5);opacity:0}}");
  // Layout
  s.push(".c{max-width:900px;margin:0 auto;padding:20px}");
  s.push("h1{font-size:1.8rem;margin-bottom:4px;color:#fff;background:linear-gradient(90deg,#6366f1,#a78bfa,#6366f1);background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 3s infinite linear}");
  s.push(".sub{color:#888;font-size:.85rem;margin-bottom:24px}");
  // Gauge stats row
  s.push(".gs{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px}");
  s.push(".gc{background:rgba(26,26,42,.8);backdrop-filter:blur(10px);border:1px solid rgba(99,102,241,.15);border-radius:16px;padding:16px 8px;text-align:center;transition:all .3s ease;animation:fadeIn .6s ease both}");
  s.push(".gc:nth-child(1){animation-delay:.1s}.gc:nth-child(2){animation-delay:.2s}.gc:nth-child(3){animation-delay:.3s}.gc:nth-child(4){animation-delay:.4s}.gc:nth-child(5){animation-delay:.5s}");
  s.push(".gc:hover{transform:translateY(-4px);border-color:rgba(99,102,241,.4);box-shadow:0 8px 30px rgba(99,102,241,.15)}");
  s.push(".gauge{position:relative;width:80px;height:80px;margin:0 auto 8px}");
  s.push(".gauge svg{width:80px;height:80px;transform:rotate(-90deg)}");
  s.push(".gauge circle{fill:none;stroke-width:6;stroke-linecap:round}");
  s.push(".gauge .bg{stroke:rgba(255,255,255,.06)}");
  s.push(".gauge .fg{stroke:var(--gc);stroke-dasharray:283;animation:gaugeAnim 1.2s ease-out both;transition:stroke-dashoffset .8s ease}");
  s.push(".gauge .val{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:1.3rem;font-weight:700;color:#fff}");
  s.push(".gl{font-size:.7rem;color:#888;margin-top:2px}");
  // Action bar
  s.push(".ab{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}");
  s.push(".rf{padding:8px 18px;border:none;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.85rem;cursor:pointer;transition:all .2s;position:relative;overflow:hidden}");
  s.push(".rf:hover{transform:translateY(-1px);box-shadow:0 4px 15px rgba(99,102,241,.4)}");
  s.push(".rf:active{transform:translateY(0)}");
  // Feedback widget
  s.push(".fb{background:rgba(26,26,42,.8);backdrop-filter:blur(10px);border:1px solid rgba(99,102,241,.15);border-radius:16px;padding:20px;margin-bottom:24px;animation:slideUp .5s ease both;animation-delay:.3s}");
  s.push(".fb h3{font-size:.95rem;color:#fff;margin-bottom:12px;display:flex;align-items:center;gap:8px}");
  s.push(".fb .stars{display:flex;gap:6px;margin-bottom:12px}");
  s.push(".fb .star{font-size:1.8rem;cursor:pointer;color:#333;transition:all .2s;display:inline-block}");
  s.push(".fb .star.on{color:#fbbf24;text-shadow:0 0 10px rgba(251,191,36,.5);animation:starPop .3s ease}");
  s.push(".fb .star:hover{color:#f59e0b;transform:scale(1.15)}");
  s.push(".fb textarea{width:100%;padding:10px 14px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.03);color:#ccc;font-size:.85rem;font-family:inherit;resize:vertical;min-height:60px;outline:none;transition:border-color .2s}");
  s.push(".fb textarea:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.15)}");
  s.push(".fb .fb-row{display:flex;gap:8px;margin-top:10px;align-items:center}");
  s.push(".fb .fb-row select{padding:8px 12px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.05);color:#ccc;font-size:.85rem;outline:none}");
  s.push(".fb .fb-row button{padding:8px 18px;border:none;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.85rem;cursor:pointer;transition:all .2s}");
  s.push(".fb .fb-row button:hover{transform:translateY(-1px);box-shadow:0 4px 15px rgba(99,102,241,.4)}");
  s.push(".fb .fb-msg{font-size:.8rem;margin-top:8px;transition:all .3s}");
  s.push(".fb .fb-msg.ok{color:#4ade80}.fb .fb-msg.er{color:#f87171}");
  // Workspace list
  s.push(".wl{display:flex;flex-direction:column;gap:12px}");
  s.push(".wc{background:rgba(26,26,42,.8);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px;cursor:pointer;transition:all .3s ease;animation:slideUp .5s ease both;position:relative;overflow:hidden}");
  s.push(".wc::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#6366f1,#a78bfa);opacity:0;transition:opacity .3s}");
  s.push(".wc:hover{border-color:rgba(99,102,241,.4);transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,0,0,.3)}.wc:hover::before{opacity:1}");
  s.push(".wc.cl{border-color:rgba(245,158,11,.3)}.wc.cl::before{background:linear-gradient(90deg,#f59e0b,#fbbf24);opacity:1}");
  s.push(".wc.st{border-color:rgba(239,68,68,.3)}.wc.st::before{background:linear-gradient(90deg,#ef4444,#f87171);opacity:1}");
  s.push(".wh{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}");
  s.push(".wn{font-size:1.05rem;font-weight:600;color:#fff;display:flex;align-items:center;gap:8px}");
  s.push(".wn .icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0}");
  s.push(".wn .icon.a{background:rgba(74,222,128,.15);color:#4ade80}.wn .icon.p{background:rgba(251,191,36,.15);color:#fbbf24}");
  s.push(".wb{display:flex;gap:6px;flex-wrap:wrap}");
  s.push(".ws{font-size:.65rem;padding:3px 10px;border-radius:20px;font-weight:500;letter-spacing:.3px}");
  s.push(".ws.a{background:rgba(74,222,128,.12);color:#4ade80;border:1px solid rgba(74,222,128,.2)}");
  s.push(".ws.p{background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.2)}");
  s.push(".ws.c{background:rgba(245,158,11,.12);color:#fbbf24;border:1px solid rgba(245,158,11,.2)}");
  s.push(".ws.s{background:rgba(239,68,68,.12);color:#f87171;border:1px solid rgba(239,68,68,.2)}");
  // Stat bars
  s.push(".sbar{display:flex;gap:12px;margin:10px 0;flex-wrap:wrap}");
  s.push(".sb{flex:1;min-width:60px}");
  s.push(".sb-h{display:flex;justify-content:space-between;font-size:.7rem;color:#888;margin-bottom:4px}");
  s.push(".sb-track{height:4px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden}");
  s.push(".sb-fill{height:100%;border-radius:4px;transition:width .8s ease;animation:fadeIn .8s ease both}");
  s.push(".sb-fill.files{background:linear-gradient(90deg,#6366f1,#a78bfa)}.sb-fill.vars{background:linear-gradient(90deg,#8b5cf6,#c084fc)}");
  s.push(".sb-fill.decs{background:linear-gradient(90deg,#06b6d4,#22d3ee)}.sb-fill.steps{background:linear-gradient(90deg,#10b981,#34d399)}");
  // Time + lifecycle
  s.push(".wm{display:flex;gap:12px;font-size:.75rem;color:#888;flex-wrap:wrap;margin-top:6px}");
  s.push(".wm span{display:flex;align-items:center;gap:4px}");
  s.push(".wl2{margin-top:8px;font-size:.75rem;color:#94a3b8;display:flex;align-items:center;gap:6px}");
  s.push(".wl2 .ag{color:#fbbf24;font-weight:600;background:rgba(245,158,11,.1);padding:2px 8px;border-radius:8px}");
  // Action buttons
  s.push(".wa{margin-top:12px;display:flex;gap:6px;flex-wrap:wrap}");
  s.push(".wa button{padding:6px 14px;font-size:.75rem;border-radius:10px;background:rgba(255,255,255,.06);color:#ccc;border:1px solid rgba(255,255,255,.08);cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:4px}");
  s.push(".wa button:hover{background:rgba(99,102,241,.15);border-color:rgba(99,102,241,.3);color:#fff;transform:translateY(-1px)}");
  s.push(".wa button.del{color:#f87171;border-color:rgba(239,68,68,.2)}.wa button.del:hover{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.4)}");
  // Detail panel
  s.push(".det{margin-top:12px;animation:slideUp .3s ease}");
  s.push(".det summary{cursor:pointer;color:#6366f1;font-size:.85rem;font-weight:500;padding:8px 0;list-style:none;display:flex;align-items:center;gap:6px}");
  s.push(".det summary::-webkit-details-marker{display:none}");
  s.push(".det summary::before{content:'▸';transition:transform .2s;display:inline-block}");
  s.push(".det[open] summary::before{transform:rotate(90deg)}");
  s.push(".det pre{margin-top:8px;padding:14px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.06);border-radius:10px;font-size:.8rem;overflow-x:auto;max-height:280px;overflow-y:auto;color:#a5b4fc;line-height:1.5}");
  // States
  s.push(".em{color:#666;text-align:center;padding:60px 20px;font-size:.95rem;animation:fadeIn .5s ease}");
  s.push(".er{color:#f87171;font-size:.85rem;margin:8px 0;padding:10px 14px;background:rgba(239,68,68,.1);border-radius:10px;border:1px solid rgba(239,68,68,.2)}");
  s.push(".ld{color:#888;font-size:.85rem;display:flex;align-items:center;gap:8px}");
  s.push(".ld::before{content:'';width:16px;height:16px;border:2px solid rgba(99,102,241,.3);border-top-color:#6366f1;border-radius:50%;animation:spin .8s linear infinite}");
  s.push("@keyframes spin{to{transform:rotate(360deg)}}");
  // Responsive
  s.push("@media(max-width:640px){.gs{grid-template-columns:repeat(3,1fr)}.gauge{width:60px;height:60px}.gauge svg{width:60px;height:60px}.gauge .val{font-size:1rem}}");
  s.push("</style></head><body><div class=\"c\">");
  s.push("<h1>&#9889; Cloud Workspace Pool</h1>");
  s.push("<p class=\"sub\">Active workspaces &mdash; loaded state, no search needed</p>");
  // Gauge stats (5 columns)
  s.push("<div class=\"gs\" id=\"stats\"></div>");
  // Action bar + Feedback
  s.push("<div class=\"ab\"><button class=\"rf\" onclick=\"loadPool()\">&#x21bb; Refresh</button></div>");
  s.push("<div class=\"fb\" id=\"fb-widget\">"
    + "<h3>&#11088; Rate your experience</h3>"
    + "<div class=\"stars\" id=\"fb-stars\">"
    + "<span class=\"star\" onclick=\"setFbRating(1)\">&#9733;</span>"
    + "<span class=\"star\" onclick=\"setFbRating(2)\">&#9733;</span>"
    + "<span class=\"star\" onclick=\"setFbRating(3)\">&#9733;</span>"
    + "<span class=\"star\" onclick=\"setFbRating(4)\">&#9733;</span>"
    + "<span class=\"star\" onclick=\"setFbRating(5)\">&#9733;</span>"
    + "</div>"
    + "<textarea id=\"fb-comment\" placeholder=\"Optional comment...\"></textarea>"
    + "<div class=\"fb-row\">"
    + "<select id=\"fb-cat\"><option value=\"general\">General</option><option value=\"usability\">Usability</option><option value=\"performance\">Performance</option><option value=\"bug\">Bug</option><option value=\"feature\">Feature request</option></select>"
    + "<button onclick=\"submitFb()\">Submit</button>"
    + "</div>"
    + "<div class=\"fb-msg\" id=\"fb-msg\"></div>"
    + "</div>");
  s.push("<div id=\"status\"></div>");
  s.push("<div id=\"workspaces\" class=\"wl\"></div>");
  s.push("</div><script>");
  // JavaScript
  s.push("var W=location.origin;");
  s.push("var st=document.getElementById('status');");
  s.push("var wsEl=document.getElementById('workspaces');");
  s.push("var statsEl=document.getElementById('stats');");
  s.push("var now=Date.now();");
  // Helpers
  s.push("function ta(ts){if(!ts)return'never';var m=Math.round((now-ts)/60000);if(m<60)return m+'m ago';var h=Math.round(m/60);if(h<24)return h+'h ago';return Math.round(h/24)+'d ago';}");
  s.push("function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML;}");
  s.push("function ak(){var k=localStorage.getItem('CF_MEMORY_KEY')||prompt('API key:')||'';if(k)localStorage.setItem('CF_MEMORY_KEY',k);return k;}");
  s.push("function ah(json){var h=json?{'Content-Type':'application/json'}:{};var k=ak();if(k)h['X-API-Key']=k;return h;}");
  // Gauge SVG builder
  s.push("function gauge(val,max,color){var pct=Math.min(val/max,1);var offset=283-(283*pct);return '<div class=\"gauge\" style=\"--gc:'+color+'\"><svg viewBox=\"0 0 100 100\"><circle class=\"bg\" cx=\"50\" cy=\"50\" r=\"45\"/><circle class=\"fg\" cx=\"50\" cy=\"50\" r=\"45\" style=\"stroke:'+color+';--target:'+offset+'\"/></svg><div class=\"val\">'+val+'</div></div>'}");
  // Feedback
  s.push("var fbRating=0;");
  s.push("function setFbRating(r){fbRating=r;var stars=document.querySelectorAll('#fb-stars .star');stars.forEach(function(s2,i){s2.className='star'+(i<r?' on':'');});}");
  s.push("async function submitFb(){");
  s.push("if(!fbRating)return;var c=document.getElementById('fb-comment').value.trim();");
  s.push("var cat=document.getElementById('fb-cat').value;");
  s.push("var el=document.getElementById('fb-msg');");
  s.push("try{var r=await fetch(W+'/workspace/feedback',{method:'POST',headers:ah(true),body:JSON.stringify({rating:fbRating,category:cat,comment:c||undefined,agent:'dashboard'})});var d=await r.json();");
  s.push("if(d.ok){el.className='fb-msg ok';el.textContent='\\u2713 Feedback submitted (rating: '+fbRating+'/5)';fbRating=0;setFbRating(0);document.getElementById('fb-comment').value='';}");
  s.push("else{el.className='fb-msg er';el.textContent=d.error||'Error';}}");
  s.push("catch(e){el.className='fb-msg er';el.textContent=e.message;}");
  s.push("setTimeout(function(){el.textContent='';el.className='fb-msg';},4000);}");
  // Load pool
  s.push("async function loadPool(){");
  s.push("st.innerHTML='<div class=\"ld\">Loading...</div>';wsEl.innerHTML='';");
  s.push("try{");
  s.push("var a=await fetch(W+'/workspace/list?status=active').then(function(r){return r.json()});");
  s.push("var p=await fetch(W+'/workspace/list?status=paused').then(function(r){return r.json()});");
  s.push("var ps=await fetch(W+'/workspace/pool-status').then(function(r){return r.json()}).catch(function(){return null});");
  s.push("var ac=a.count||0,pc=p.count||0;");
  s.push("var tf=(a.workspaces||[]).reduce(function(s2,w){return s2+(w.file_count||0)},0);");
  s.push("var cc=(ps&&ps.claimed||[]).length,sc=(ps&&ps.potentially_stale||[]).length;");
  // Render gauge stats
  s.push("statsEl.innerHTML="
    + "gauge(ac,20,'#4ade80')"
    + "+gauge(pc,20,'#fbbf24')"
    + "+gauge(cc,10,'#f59e0b')"
    + "+gauge(sc,10,'#ef4444')"
    + "+gauge(tf,100,'#6366f1')"
    + "+'<div class=\"gc\"><div class=\"gl\">Active</div></div>'"
    + "+'<div class=\"gc\"><div class=\"gl\">Paused</div></div>'"
    + "+'<div class=\"gc\"><div class=\"gl\">Claimed</div></div>'"
    + "+'<div class=\"gc\"><div class=\"gl\">Stale</div></div>'"
    + "+'<div class=\"gc\"><div class=\"gl\">Files</div></div>';"
  );
  // Fix: put labels inside gauges
  s.push("var gcs=statsEl.querySelectorAll('.gc');var vals=[ac,pc,cc,sc,tf];");
  s.push("gcs.forEach(function(g,i){var gl=g.querySelector('.gl');if(!gl)return;var label=['Active','Paused','Claimed','Stale','Files'][i];g.innerHTML=gauge(vals[i],i<4?20:100,['#4ade80','#fbbf24','#f59e0b','#ef4444','#6366f1'][i])+'<div class=\"gl\">'+label+'</div>';});");
  s.push("st.innerHTML='';");
  // Workspace cards
  s.push("var all=(a.workspaces||[]).concat(p.workspaces||[]);");
  s.push("if(!all.length){wsEl.innerHTML='<div class=\"em\">No workspaces yet. Create one to get started.</div>';return;}");
  s.push("var cm={},sm={};");
  s.push("(ps&&ps.claimed||[]).forEach(function(c){cm[c.id]=c});");
  s.push("(ps&&ps.potentially_stale||[]).forEach(function(s3){sm[s3.id]=s3});");
  s.push("wsEl.innerHTML=all.map(function(ws,idx){");
  s.push("var u=ta(ws.updated_at),cl=cm[ws.id],st2=sm[ws.id];");
  s.push("var cc2=cl?'cl':(st2?'st':'');");
  s.push("var iconCls=ws.status==='active'?'a':'p';");
  s.push("var b='<span class=\"ws '+ws.status+'\">'+ws.status+'</span>';");
  s.push("if(cl)b+='<span class=\"ws c\">&#x1f511; '+esc(cl.claimed_by)+'</span>';");
  s.push("if(st2)b+='<span class=\"ws s\">&#9888; idle '+st2.idle_hours+'h</span>';");
  s.push("var lc='';");
  s.push("if(cl){lc='<div class=\"wl2\">Claimed by <span class=\"ag\">'+esc(cl.claimed_by)+'</span> ('+cl.claimed_ago_min+'min ago)</div>';} ");
  // Stat bars (files, vars, decisions, steps)
  s.push("var maxF=20,maxV=10,maxD=10,maxS=10;");
  s.push("var fc=ws.file_count||0,vc=ws.variable_count||0,dc=ws.decision_count||0,sc2=ws.next_step_count||0;");
  s.push("var bars='<div class=\"sbar\">'"
    +"+'<div class=\"sb\"><div class=\"sb-h\"><span>&#x1f4c4; Files</span><span>'+fc+'</span></div><div class=\"sb-track\"><div class=\"sb-fill files\" style=\"width:'+Math.min(fc/maxF*100,100)+'%\"></div></div></div>'"
    +"+'<div class=\"sb\"><div class=\"sb-h\"><span>&#x1f527; Vars</span><span>'+vc+'</span></div><div class=\"sb-track\"><div class=\"sb-fill vars\" style=\"width:'+Math.min(vc/maxV*100,100)+'%\"></div></div></div>'"
    +"+'<div class=\"sb\"><div class=\"sb-h\"><span>&#x1f4cb; Decisions</span><span>'+dc+'</span></div><div class=\"sb-track\"><div class=\"sb-fill decs\" style=\"width:'+Math.min(dc/maxD*100,100)+'%\"></div></div></div>'"
    +"+'<div class=\"sb\"><div class=\"sb-h\"><span>&#x1f4cc; Steps</span><span>'+sc2+'</span></div><div class=\"sb-track\"><div class=\"sb-fill steps\" style=\"width:'+Math.min(sc2/maxS*100,100)+'%\"></div></div></div>'"
    +"+'</div>';");
  s.push("return '<div class=\"wc '+cc2+'\" onclick=\"loadWs(\\''+ws.id+'\\')\" style=\"animation-delay:'+(idx*0.08)+'s\">'"
    +"+'<div class=\"wh\"><span class=\"wn\"><span class=\"icon \"+iconCls+\">"+(ws.status==='active'?"&#9889;":"&#9208;")+"</span>"+esc(ws.name)+"</span><div class=\"wb\">"+b+"</div></div>'"
    +"+bars"
    +"+'<div class=\"wm\"><span>&#x1f550; "+u+"</span></div>'+lc"
    +"+'<div id=\"ws-detail-"+ws.id+"\"></div></div>';"
  );
  s.push("}).join('');");
  s.push("}catch(e){st.innerHTML='<div class=\"er\">Error: '+esc(e.message)+'</div>';}}");
  // Load workspace detail
  s.push("async function loadWs(id){");
  s.push("var el=document.getElementById('ws-detail-'+id);");
  s.push("if(el.innerHTML){el.innerHTML='';return;}");
  s.push("el.innerHTML='<div class=\"ld\">Loading...</div>';");
  s.push("try{var r=await fetch(W+'/workspace/'+id);var d=await r.json();");
  s.push("if(!d.ok)throw new Error(d.error);var ws=d.workspace,s2=ws.state||{};");
  // Render state as a nice detail panel
  s.push("var h='<div class=\"det\"><details open><summary>&#x1f4e6; State Bundle</summary><pre>'+JSON.stringify(s2,null,2)+'</pre></details></div>';");
  s.push("h+='<div class=\"wa\">'"
    + "<button onclick=\"doHb('"+id+"')\">&#10084; Heartbeat</button> "
    + "<button onclick=\"doCl('"+id+"')\">&#x1f511; Claim</button> "
    + "<button onclick=\"doRl('"+id+"')\">&#x1f513; Release</button> "
    + "<button onclick=\"doSc('"+id+"')\">&#x1f50d; Search</button> "
    + "<button onclick=\"doDl('"+id+"')\" class=\"del\">&#x1f5d1; Delete</button></div>';");
  s.push("el.innerHTML=h;}catch(e){el.innerHTML='<div class=\"er\">'+esc(e.message)+'</div>';}}");
  // Actions
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
  s.push("body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#0a0a1a 0%,#0d1117 50%,#0a0a1a 100%);color:#e0e0e0;min-height:100vh}");
  s.push("@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}");
  s.push("@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}");
  s.push(".c{max-width:900px;margin:0 auto;padding:20px}");
  s.push("h1{font-size:1.8rem;margin-bottom:4px;color:#fff;background:linear-gradient(90deg,#6366f1,#a78bfa,#6366f1);background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 3s infinite linear}");
  s.push("@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}");
  s.push(".sub{color:#888;font-size:.85rem;margin-bottom:20px}");
  s.push(".tabs{display:flex;gap:4px;margin-bottom:20px;flex-wrap:wrap}");
  s.push(".tab{padding:10px 18px;border-radius:12px;background:rgba(26,26,42,.8);border:1px solid rgba(255,255,255,.08);color:#888;cursor:pointer;font-size:.85rem;transition:all .2s;backdrop-filter:blur(10px)}");
  s.push(".tab:hover{color:#ccc;border-color:rgba(99,102,241,.3)}");
  s.push(".tab.ac{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-color:#6366f1;box-shadow:0 4px 15px rgba(99,102,241,.3)}");
  s.push(".p{display:none;animation:slideUp .3s ease}.p.ac{display:block}");
  s.push("label{display:block;font-size:.8rem;color:#888;margin-bottom:4px;margin-top:14px}");
  s.push("input,textarea,select{width:100%;padding:10px 14px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.03);color:#fff;font-size:.9rem;font-family:inherit;outline:none;transition:border-color .2s}");
  s.push("input:focus,textarea:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.15)}");
  s.push("textarea{min-height:120px;resize:vertical}");
  s.push("button{padding:10px 22px;border:none;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.9rem;cursor:pointer;margin-top:14px;transition:all .2s}");
  s.push("button:hover{transform:translateY(-1px);box-shadow:0 4px 15px rgba(99,102,241,.4)}");
  s.push("button:active{transform:translateY(0)}");
  s.push("button.sec{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)}");
  s.push("button.sec:hover{background:rgba(99,102,241,.15);border-color:rgba(99,102,241,.3)}");
  s.push(".msg{margin-top:10px;padding:10px 14px;border-radius:10px;font-size:.8rem;animation:fadeIn .3s ease}");
  s.push(".msg.ok{background:rgba(74,222,128,.1);color:#4ade80;border:1px solid rgba(74,222,128,.2)}");
  s.push(".msg.er{background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.2)}");
  s.push(".ws-sel{display:flex;gap:8px;margin-bottom:16px}");
  s.push(".ws-sel select{flex:1}");
  s.push("pre{padding:14px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.06);border-radius:10px;font-size:.8rem;max-height:300px;overflow:auto;color:#a5b4fc;line-height:1.5}");
  s.push("</style></head><body><div class=\"c\">");
  s.push("<h1>&#9999;&#65039; Workspace Editor</h1>");
  s.push("<p class=\"sub\">Create, edit, and push workspace state from browser</p>");
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
  s.push("<label>Template</label><select id=\"ws-tpl\"><option value=\"blank\">Blank</option><option value=\"project\">Project (dev)</option><option value=\"research\">Research</option><option value=\"meeting\">Meeting notes</option></select>");
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
  s.push("<pre id=\"vl\"></pre>");
  s.push("<div id=\"mv\"></div></div></div>");
  // Decisions tab
  s.push("<div id=\"p3\" class=\"p\"><div class=\"ws-sel\"><select id=\"dw\"><option value=\"\">Select workspace...</option></select>");
  s.push("<button class=\"sec\" onclick=\"loadDw()\">Load</button></div>");
  s.push("<div id=\"dc\" style=\"display:none\"><label>Decision ID</label><input type=\"text\" id=\"di\" placeholder=\"dec_001\">");
  s.push("<label>Description</label><textarea id=\"dd\" placeholder=\"What was decided...\"></textarea>");
  s.push("<button onclick=\"doAddDec()\">Record Decision</button>");
  s.push("<pre id=\"dl\"></pre>");
  s.push("<div id=\"md\"></div></div></div>");
  // Steps tab
  s.push("<div id=\"p4\" class=\"p\"><div class=\"ws-sel\"><select id=\"sw\"><option value=\"\">Select workspace...</option></select>");
  s.push("<button class=\"sec\" onclick=\"loadSw()\">Load</button></div>");
  s.push("<div id=\"sc2\" style=\"display:none\"><label>Add Next Step</label><input type=\"text\" id=\"stx\" placeholder=\"What to do next...\">");
  s.push("<button onclick=\"doAddStep()\">Add Step</button>");
  s.push("<ol id=\"sl\"></ol>");
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
  s.push("async function doCreate(){var n=document.getElementById('ws-name').value.trim();if(!n)return showM('mc','Name required',false);var lb=document.getElementById('ws-label').value.trim()||undefined;var tp=document.getElementById('ws-tpl').value;var fp=document.getElementById('ws-fp').value.trim();var fc=document.getElementById('ws-fc').value;var body={name:n,label:lb,template:tp,state:{}};if(fp&&fc){body.state.files={};body.state.files[fp]=fc;}try{var r=await fetch(W+'/workspace/create',{method:'POST',headers:ah(true),body:JSON.stringify(body)});var d=await r.json();if(d.ok){showM('mc','Created: '+d.workspace.id,true);refreshLists();}else showM('mc',d.error,false);}catch(e){showM('mc',e.message,false);}}");
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
