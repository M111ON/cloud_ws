/* admin_html.ts — combined admin dashboard: pool + editor + query cache */

export function adminHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Cloud Workspace Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0a;color:#e0e0e0;min-height:100vh}
.c{max-width:1000px;margin:0 auto;padding:16px}
h1{font-size:1.5rem;margin-bottom:4px;color:#fff}
.sub{color:#888;font-size:.85rem;margin-bottom:14px}
.tabs{display:flex;gap:4px;margin-bottom:16px}
.tab{padding:8px 18px;border-radius:8px;background:#1a1a1a;border:1px solid #333;color:#888;cursor:pointer;font-size:.85rem;user-select:none}
.tab.ac{background:#6366f1;color:#fff;border-color:#6366f1}
.p{display:none}.p.ac{display:block}
button{padding:7px 14px;border:none;border-radius:8px;background:#6366f1;color:#fff;font-size:.82rem;cursor:pointer;transition:opacity .15s}
button:hover{opacity:.88}
button:active{transform:translateY(1px)}
button.del{background:#7f1d1d;color:#fca5a5}
button.sec{background:#374151}
input,textarea,select{width:100%;padding:8px 12px;border:1px solid #333;border-radius:8px;background:#141414;color:#fff;font-size:.85rem;font-family:inherit;outline:none}
input:focus,textarea:focus,select:focus{border-color:#6366f1}
textarea{resize:vertical}
label{display:block;font-size:.72rem;color:#888;margin:8px 0 2px}
.tb{display:flex;gap:8px;margin-bottom:12px;align-items:center;flex-wrap:wrap}
.tb input[type=text],.tb select{flex:1;min-width:140px;margin:0}
.tb .grow{flex:1}
.ps{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.sc{background:#1a1a1a;border:1px solid #222;border-radius:10px;padding:12px 14px;flex:1;min-width:70px;text-align:center}
.sn{font-size:1.6rem;font-weight:700;color:#6366f1}
.sl{font-size:.7rem;color:#888;margin-top:2px}
.wl{display:flex;flex-direction:column;gap:8px}
.row{display:flex;align-items:center;gap:10px;background:#1a1a1a;border:1px solid #222;border-radius:10px;padding:12px 14px;cursor:pointer;transition:border-color .15s}
.row:hover{border-color:#6366f1}
.row.cl{border-color:#f59e0b}.row.st{border-color:#ef4444}
.rname{flex:1;min-width:0;font-weight:600;color:#fff}
.rname .rid{display:block;font-size:.65rem;color:#666;font-weight:400;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rbadges{display:flex;gap:5px;flex-wrap:wrap}
.bg{font-size:.62rem;padding:2px 8px;border-radius:12px;white-space:nowrap}
.bg.active{background:#1e293b;color:#4ade80}
.bg.paused{background:#1e293b;color:#fbbf24}
.bg.archived{background:#1e293b;color:#94a3b8}
.bg.c{background:#422006;color:#fbbf24}
.bg.s{background:#450a0a;color:#f87171}
.rcnts{display:flex;gap:8px;font-size:.72rem;color:#888;white-space:nowrap}
.rupd{font-size:.7rem;color:#555;white-space:nowrap}
.editbtn{background:#374151;padding:5px 12px;font-size:.72rem}
/* bulk ops */
.bulk{display:none;align-items:center;gap:8px;padding:8px 12px;background:#1e1b4b;border:1px solid #4338ca;border-radius:10px;margin-bottom:10px;flex-wrap:wrap}
.bulk.show{display:flex}
.bulk .selcnt{font-size:.78rem;color:#a5b4fc;white-space:nowrap}
.bulk button{padding:5px 11px;font-size:.72rem}
.rcb{width:16px;height:16px;cursor:pointer;accent-color:#6366f1;flex:none;margin:0}
.rcb.wr{width:18px;height:18px}
/* project groups */
.pgrp{margin-bottom:14px}
.pgh{display:flex;align-items:center;gap:10px;background:#151518;border:1px solid #26262b;border-radius:10px;padding:10px 14px;cursor:pointer;user-select:none}
.pgh:hover{border-color:#6366f1}
.pgname{font-weight:700;color:#e2e8f0;flex:none}
.pgstats{flex:1;font-size:.72rem;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pgstats b{color:#4ade80}
.pgstats .pk{color:#fbbf24}
.pgstats .pk.st{color:#f87171}
.pgbtns{display:flex;gap:4px;flex:none}
.gb{padding:3px 8px;font-size:.68rem}
.pgarrow{color:#666;font-size:.7rem;flex:none}
.pgbody{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.edprojrow{display:flex;align-items:center;gap:8px;padding:8px 16px;border-bottom:1px solid #222}
.edprojrow select{flex:1;margin:0}
.edpl{font-size:.72rem;color:#888;white-space:nowrap}
/* editor modal */
.ov{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;padding:4vh 16px;z-index:50;overflow-y:auto}
.modal{background:#101014;border:1px solid #2a2a2a;border-radius:14px;width:100%;max-width:760px;box-shadow:0 20px 60px rgba(0,0,0,.6)}
.modal.small{max-width:440px}
.mh{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 16px;border-bottom:1px solid #222}
.mh .t{flex:1;min-width:0}
.edname{width:auto;min-width:180px;max-width:100%;font-size:1rem;font-weight:600;padding:4px 8px}
.edid{display:block;font-size:.68rem;color:#666;font-family:monospace;margin-top:4px}
.x{background:#1a1a1a;border:1px solid #333;color:#aaa;font-size:1rem;padding:4px 10px;border-radius:8px;flex:none}
.edacts{display:flex;gap:6px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid #222}
.edacts button{padding:5px 11px;font-size:.72rem}
.edacts button.sec{background:#1e293b;color:#cbd5e1}
.edtabs{display:flex;gap:2px;padding:0 16px;border-bottom:1px solid #222}
.etab{padding:8px 12px;font-size:.8rem;color:#888;cursor:pointer;border-bottom:2px solid transparent;user-select:none}
.etab.ac{color:#818cf8;border-bottom-color:#6366f1}
#edBody{padding:14px 16px;max-height:58vh;overflow-y:auto}
.addf,.addv,.addd{display:grid;gap:6px;margin-bottom:12px}
.addf{grid-template-columns:1fr 1.6fr auto}
.addv{grid-template-columns:1fr 1fr auto}
.addd{grid-template-columns:1fr 1.6fr auto}
.addf textarea{min-height:60px}
.frow{display:grid;grid-template-columns:1fr 2fr auto;gap:6px;margin-bottom:6px;align-items:start}
.vrow{display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin-bottom:6px;align-items:center}
.drow{display:grid;grid-template-columns:1fr 2fr auto;gap:6px;margin-bottom:6px;align-items:center}
.frow textarea{min-height:64px}
.rowbtns{display:flex;gap:4px;flex-direction:column}
.rowbtns button{padding:4px 9px;font-size:.68rem;white-space:nowrap}
.srow{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 10px;background:#1a1a1a;border-radius:6px;margin-bottom:4px;font-size:.84rem}
.srow button{padding:3px 9px;font-size:.68rem}
.ctxrow{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:start}
.em{color:#666;text-align:center;padding:24px;font-size:.85rem}
.er{color:#f87171;font-size:.84rem;margin:8px 0}
.ld{color:#888;font-size:.84rem;padding:20px;text-align:center}
.wa{display:flex;gap:6px;flex-wrap:wrap}
/* cache */
.cstats{color:#666;font-size:.74rem;margin:6px 2px 10px}
table{width:100%;border-collapse:collapse;font-size:.8rem}
th,td{text-align:left;padding:8px;border-bottom:1px solid #222;vertical-align:middle}
th{color:#94a3b8;font-size:.66rem;text-transform:uppercase}
th.sort{cursor:pointer;user-select:none}
td.cq{max-width:360px;word-break:break-word}
td.n{white-space:nowrap;text-align:right}
td .dbtn{padding:3px 9px;font-size:.66rem}
td .csel{width:auto}
/* memory search */
.sres{display:flex;flex-direction:column;gap:10px}
.sres-item{background:#1a1a1a;border:1px solid #222;border-radius:10px;padding:12px 14px}
.sres-h{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}
.sres-src{font-size:.68rem;color:#818cf8;word-break:break-all}
.sres-score{font-size:.66rem;background:#1e1e2e;color:#a0a0ff;padding:2px 8px;border-radius:12px;flex-shrink:0}
.sres-text{font-size:.8rem;line-height:1.5;color:#ccc;white-space:pre-wrap;word-break:break-word;max-height:280px;overflow-y:auto}
/* toast + confirm */
#toasts{position:fixed;bottom:16px;right:16px;display:flex;flex-direction:column;gap:8px;z-index:100}
.toast{padding:10px 16px;border-radius:10px;font-size:.82rem;box-shadow:0 8px 24px rgba(0,0,0,.5);animation:tin .2s ease;max-width:320px}
.toast.ok{background:#064e3b;border:1px solid #10b981;color:#6ee7b7}
.toast.er{background:#450a0a;border:1px solid #ef4444;color:#fca5a5}
.toast.out{opacity:0;transition:opacity .3s}
@keyframes tin{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}
.cfmsg{color:#e0e0e0;font-size:.85rem;padding:6px 16px 2px;line-height:1.5}
.mft{display:flex;gap:8px;justify-content:flex-end;padding:14px 16px}
.mft button{padding:6px 14px}
.kbar{display:flex;gap:8px;align-items:center;margin-bottom:14px;background:#111;border:1px solid #222;border-radius:10px;padding:8px 10px}
.kbar input{flex:1;margin:0}
.kbar button{padding:5px 11px;font-size:.72rem}
#kmsg{font-size:.72rem;color:#888;white-space:nowrap}
.help{margin-top:24px;background:#111;border:1px solid #222;border-radius:12px;overflow:hidden}
/* nav bar */
.nav{display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap}
.nav a{padding:6px 14px;border-radius:8px;background:#1a1a1a;border:1px solid #252525;color:#888;font-size:.78rem;text-decoration:none;transition:all .15s;white-space:nowrap}
.nav a:hover{color:#e0e0e0;border-color:#4338ca;background:#1e1b4b}
.nav a.cur{background:#6366f1;color:#fff;border-color:#6366f1}
.help-h{padding:10px 16px;font-size:.8rem;color:#94a3b8;cursor:pointer;user-select:none;display:flex;justify-content:space-between;align-items:center}
.help-h:hover{color:#818cf8}
#helpBody{padding:0 16px 14px;display:block}
.hg{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.hc{background:#1a1a1a;border:1px solid #222;border-radius:8px;padding:8px 10px;font-size:.72rem;color:#aaa;line-height:1.45}
.hc b{color:#e0e0e0}
.hc code{color:#818cf8;background:#0a0a0a;padding:0 4px;border-radius:4px;font-size:.68rem}
@media (max-width:640px){
  .frow,.vrow,.drow,.addf,.addv,.addd{grid-template-columns:1fr}
  .rowbtns{flex-direction:row}
  .rcnts{display:none}
  .rupd{display:none}
}
</style>
</head>
<body>
<div class="c">
  <h1>&#9889; Cloud Workspace Admin</h1>
  <p class="sub">Pool + state editor + query cache</p>

  <div class="nav">
    <a href="/" title="Search cloud memory">Search</a>
    <a href="/admin" class="cur">Admin</a>
    <a href="/workspace" title="Pool dashboard with gauges">Pool</a>
  </div>

  <div class="kbar" id="kbar" style="display:none">
    <input id="akey" type="password" placeholder="API key (X-API-Key)">
    <button onclick="doSaveKey()">Save</button>
    <button class="sec" onclick="doTestKey()">Test</button>
    <button class="del" onclick="doClearKey()">Clear</button>
    <span id="kmsg"></span>
  </div>

  <div class="tabs">
    <div class="tab ac" onclick="showTab(0)">Pool</div>
    <div class="tab" onclick="showTab(1)">Query Cache</div>
    <div class="tab" onclick="showTab(2)">&#128269; Search</div>
    <div style="flex:1"></div>
    <button class="sec" style="padding:4px 10px;font-size:.7rem" onclick="toggleKbar()">&#9881; API Key</button>
  </div>

  <div id="p0" class="p ac">
    <div class="tb">
      <input type="text" id="qFilter" placeholder="&#128269; Search workspaces..." oninput="FILTER.q=this.value;renderPool()">
      <select id="stFilter" style="flex:none;width:auto" onchange="FILTER.st=this.value;renderPool()">
        <option value="all">All status</option>
        <option value="active">Active</option>
        <option value="paused">Paused</option>
        <option value="archived">Archived</option>
      </select>
      <button class="sec" onclick="loadPool()">Refresh</button>
      <button onclick="openCreate()">+ New</button>
      <button class="sec" onclick="openProjCreate()">+ Project</button>
    </div>
    <div class="bulk" id="bulkBar">
      <input type="checkbox" class="rcb wr" id="selAllWs" onclick="toggleSelAllWs()">
      <span class="selcnt" id="selCnt">0 selected</span>
      <button onclick="bulkPause()">Pause</button>
      <button onclick="bulkResume()">Resume</button>
      <button onclick="bulkArchive()">Archive</button>
      <button onclick="bulkMoveProj()">Move to Project</button>
      <button class="del" onclick="bulkDelete()">Delete</button>
    </div>
    <div class="ps" id="stats"></div>
    <div id="status"></div>
    <div id="workspaces" class="wl"></div>
  </div>

  <div id="p1" class="p">
    <div class="tb">
      <input type="text" id="cFilter" placeholder="&#128269; Filter queries..." oninput="FILTER.cq=this.value;renderCache()">
      <button class="sec" onclick="loadCache()">Refresh</button>
      <button class="sec" onclick="clearSelected()">Clear selected</button>
      <button class="del" onclick="clearAll()">Clear all</button>
    </div>
    <div class="cstats" id="cacheStats"></div>
    <div id="cacheMsg"></div>
    <table id="cacheTable">
      <thead><tr>
        <th style="width:28px"><input type="checkbox" class="csel" id="selAll" onclick="toggleSelAll()"></th>
        <th class="sort" onclick="sortCache('q')">Query</th>
        <th class="sort n" onclick="sortCache('size')">Size</th>
        <th class="sort n" onclick="sortCache('hits')">Hits</th>
        <th class="sort n" onclick="sortCache('ts')">Age</th>
        <th style="width:70px"></th>
      </tr></thead>
      <tbody></tbody>
    </table>
  </div>

  <div id="p2" class="p">
    <div class="tb">
      <input type="text" id="mQuery" placeholder="&#128269; Search memories..." onkeydown="if(event.key==='Enter')doMemSearch()">
      <button onclick="doMemSearch()">Search</button>
      <button class="sec" onclick="clearMemSearch()">Clear</button>
    </div>
    <div id="mStatus" class="cstats"></div>
    <div id="mResults" class="sres"></div>
  </div>

  <div class="help">
    <div class="help-h" onclick="toggleHelp()">&#128161; What is what? <span id="helpArrow">&#9660;</span></div>
    <div id="helpBody">
      <div class="hg">
        <div class="hc"><b>Pool</b><br>พื้นที่ทำงานของ AI agent &mdash; แต่ละ workspace เก็บ state แยกกัน (files / variables / decisions / steps / context)</div>
        <div class="hc"><b>Files</b><br>ไฟล์ที่ agent เขียนระหว่างทำงาน คล้ายไฟล์ในโปรเจกต์</div>
        <div class="hc"><b>Variables</b><br>ค่าข้อเท็จจริงสั้นๆ รูปแบบ key = value</div>
        <div class="hc"><b>Decisions</b><br>บันทึกการตัดสินใจสำคัญ + เหตุผล &mdash; ว่าทำไมถึงเลือกแบบนั้น</div>
        <div class="hc"><b>Steps</b><br>รายการงานถัดไปที่วางแผนไว้ (เรียงลำดับ)</div>
        <div class="hc"><b>Context</b><br>บริบท/สรุปโดยรวมของ workspace นั้น</div>
        <div class="hc"><b>Heartbeat</b><br>ส่งสัญญาณว่า agent ยังทำงานอยู่ กัน lease ไม่ให้หมดอายุ</div>
        <div class="hc"><b>Claim / Release</b><br>ขอ / คืนสิทธิ์แก้ไข workspace &mdash; กันการเขียนชนกันระหว่าง agents</div>
        <div class="hc"><b>Checkpoint</b><br>สแนปช็อตสถานะ workspace เก็บเป็นประวัติย้อนหลัง</div>
        <div class="hc"><b>Archive / Delete</b><br>เก็บถาวร / ลบทิ้งถาวร (Delete ไม่สามารถกู้คืนได้)</div>
        <div class="hc"><b>Query Cache</b><br>แคชผลลัพธ์การค้นหา (/search) เพื่อให้ query ซ้ำเร็วขึ้น &mdash; ล้างได้ถ้าอยากได้พื้นที่</div>
        <div class="hc"><b>API Key</b><br>คีย์สำหรับเขียนข้อมูล &mdash; ค่าตรงกับ secret <code>API_KEY</code> ของ worker</div>
      </div>
    </div>
  </div>
</div>

<!-- editor modal -->
<div id="edOverlay" class="ov" style="display:none">
  <div class="modal">
    <div class="mh">
      <div class="t">
        <input class="edname" id="edName" placeholder="workspace name">
        <span class="edid" id="edId"></span>
      </div>
      <div class="rbadges" id="edBadges" style="margin:0 8px"></div>
      <button class="x" onclick="closeEditor()" title="Close">&#10005;</button>
    </div>
    <div class="edacts" id="edActs"></div>
    <div class="edprojrow"><label class="edpl">Project (nest):</label><select id="edProj" onchange="assignProj()"></select></div>
    <div class="edtabs">
      <div class="etab ac" data-t="0" onclick="edTab(0)">Files</div>
      <div class="etab" data-t="1" onclick="edTab(1)">Variables</div>
      <div class="etab" data-t="2" onclick="edTab(2)">Decisions</div>
      <div class="etab" data-t="3" onclick="edTab(3)">Steps</div>
      <div class="etab" data-t="4" onclick="edTab(4)">Context</div>
    </div>
    <div id="edBody"></div>
  </div>
</div>

<!-- confirm modal -->
<div id="cfOverlay" class="ov" style="display:none;align-items:center">
  <div class="modal small">
    <div class="mh"><b>Confirm</b><button class="x" onclick="cfNo()">&#10005;</button></div>
    <div id="cfMsg" class="cfmsg"></div>
    <div class="mft"><button class="sec" onclick="cfNo()">Cancel</button><button class="del" onclick="cfYes()">Confirm</button></div>
  </div>
</div>

<!-- checkpoint modal -->
<div id="ckOverlay" class="ov" style="display:none;align-items:center">
  <div class="modal small">
    <div class="mh"><b>Create Checkpoint</b><button class="x" onclick="ckCancel()">&#10005;</button></div>
    <div style="padding:12px 16px 0">
      <label>Fact summary (optional)</label>
      <textarea id="ckFact" placeholder="What did this session conclude / extract?" style="min-height:70px"></textarea>
    </div>
    <div class="mft"><button class="sec" onclick="ckCancel()">Cancel</button><button onclick="doCkNow()">Create Checkpoint</button></div>
  </div>
</div>

<!-- create modal -->
<div id="crOverlay" class="ov" style="display:none;align-items:center">
  <div class="modal small">
    <div class="mh"><b>New Workspace</b><button class="x" onclick="crCancel()">&#10005;</button></div>
    <div style="padding:12px 16px 0">
      <label>Name</label><input id="crName" placeholder="workspace name" onkeydown="if(event.key==='Enter')doCreate()">
      <label>Label (optional)</label><input id="crLabel" placeholder="tag">
      <label>Project (optional)</label><select id="crProj"><option value="">(unsorted)</option></select>
      <label>Initial file path (optional)</label><input id="crFp" placeholder="src/main.ts">
      <label>Initial file content</label><textarea id="crFc"></textarea>
    </div>
    <div class="mft"><button class="sec" onclick="crCancel()">Cancel</button><button onclick="doCreate()">Create</button></div>
  </div>
</div>

<div id="toasts"></div>

<!-- project modal (create / rename) -->
<div id="prOverlay" class="ov" style="display:none;align-items:center">
  <div class="modal small">
    <div class="mh"><b id="prTitle">New Project</b><button class="x" onclick="prCancel()">&#10005;</button></div>
    <div style="padding:12px 16px 0">
      <label>Name</label><input id="prName" placeholder="project name (nest)" onkeydown="if(event.key==='Enter')doProjSave()">
      <label>Description (optional)</label><input id="prDesc" placeholder="what is this project?">
    </div>
    <div class="mft"><button class="sec" onclick="prCancel()">Cancel</button><button onclick="doProjSave()">Save</button></div>
  </div>
</div>

<script>
var W=location.origin;
var AGENT='admin';
var CUR=null;
var ETAB=0;
var FILTER={q:'',st:'all',cq:'',csort:'ts',cdir:-1};
var ALL=[];
var POOL=null;
var PROJS=[];
var UNGR=null;
var PROJCOL={};
var PRMODE='create';
var PRID='';
var CACHE=[];
var SEL={};
var SEL_WS={};

function $(id){return document.getElementById(id);}
function esc(t){var d=document.createElement('div');d.textContent=(t==null?'':String(t));return d.innerHTML;}
function ta(ts){if(!ts)return'never';var m=Math.round((Date.now()-ts)/60000);if(m<60)return m+'m';var h=Math.round(m/60);if(h<24)return h+'h';return Math.round(h/24)+'d';}
function kb(n){return(n/1024).toFixed(1)+' KB';}
function trunc(t,n){t=String(t);return t.length>n?t.slice(0,n)+'...':t;}
function ak(){var k=localStorage.getItem('CF_MEMORY_KEY');if(k)return k;var m=prompt('API key:');if(m){localStorage.setItem('CF_MEMORY_KEY',m);return m;}return '';}
function ah(json){var h=json?{'Content-Type':'application/json'}:{};var k=ak();if(k)h['X-API-Key']=k;return h;}
function toast(msg,ok){var t=document.createElement('div');t.className='toast '+(ok?'ok':'er');t.textContent=msg;$('toasts').appendChild(t);setTimeout(function(){t.classList.add('out');setTimeout(function(){t.remove();},350);},3000);}
function askConfirm(msg){return new Promise(function(res){window.__cfRes=res;$('cfMsg').textContent=msg;$('cfOverlay').style.display='flex';});}
function cfYes(){var r=window.__cfRes;$('cfOverlay').style.display='none';if(typeof r==='function')r(true);else r(true);}
function cfNo(){var r=window.__cfRes;$('cfOverlay').style.display='none';if(typeof r==='function')r(false);else r(false);}

function showTab(i){
  var ts=document.querySelectorAll('.tab');
  for(var j=0;j<ts.length;j++)ts[j].className='tab'+(j===i?' ac':'');
  var ps=document.querySelectorAll('.p');
  for(var k=0;k<ps.length;k++)ps[k].className='p'+(k===i?' ac':'');
  if(i===1)loadCache();
  if(i===2)setTimeout(function(){var q=$('mQuery');if(q)q.focus();},50);
}
function toggleKbar(){var b=$('kbar');b.style.display=b.style.display==='none'?'flex':'none';}

// ── Memory search ──
async function doMemSearch(){
  var q=($('mQuery').value||'').trim();
  if(!q)return toast('Type a query',false);
  var st=$('mStatus'),rs=$('mResults');
  st.innerHTML='<span class="ld">Searching...</span>';
  rs.innerHTML='';
  try{
    var r=await fetch(W+'/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:q,k:8})});
    var d=await r.json();
    if(!r.ok)throw new Error(d.error||r.status);
    var res=d.results||[];
    st.innerHTML=res.length+' results'+(d.cached?' (cached)':'');
    rs.innerHTML=res.map(function(h){
      var src=esc(h.source_file||'');
      var sc=h.score!=null?String(h.score.toFixed(3)):'';
      var body=esc((h.context||h.text||'').substring(0,2000));
      return '<div class="sres-item"><div class="sres-h"><span class="sres-src">'+src+'</span><span class="sres-score">'+sc+'</span></div><div class="sres-text">'+body+'</div></div>';
    }).join('');
  }catch(e){st.innerHTML='<span class="er">Error: '+esc(e.message)+'</span>';}
}
function clearMemSearch(){$('mQuery').value='';$('mStatus').innerHTML='';$('mResults').innerHTML='';$('mQuery').focus();}

// ── API key ──
function doSaveKey(){var k=$('akey').value.trim();if(!k)return toast('Key empty',false);localStorage.setItem('CF_MEMORY_KEY',k);toast('Key saved',true);}
function doTestKey(){var k=$('akey').value.trim()||localStorage.getItem('CF_MEMORY_KEY');if(!k)return toast('No key',false);localStorage.setItem('CF_MEMORY_KEY',k);fetch(W+'/admin/cache',{headers:{'X-API-Key':k}}).then(function(r){toast(r.status===200?'Key OK':(r.status===401?'Unauthorized (bad key)':'Status '+r.status),r.status===200);}).catch(function(e){toast(e.message,false);});}
function doClearKey(){localStorage.removeItem('CF_MEMORY_KEY');$('akey').value='';toast('Key cleared',true);}

// ── Pool ──
async function loadPool(){
  var st=$('status');
  st.innerHTML='<div class="ld">Loading...</div>';
  try{
    var lists=await Promise.all([
      fetch(W+'/workspace/list?status=active').then(function(r){return r.json()}),
      fetch(W+'/workspace/list?status=paused').then(function(r){return r.json()}),
      fetch(W+'/workspace/list?status=archived').then(function(r){return r.json()})
    ]);
    ALL=[].concat(lists[0].workspaces||[]).concat(lists[1].workspaces||[]).concat(lists[2].workspaces||[]);
    POOL=await fetch(W+'/workspace/pool-status').then(function(r){return r.json()}).catch(function(){return null});
    var pr=await fetch(W+'/projects').then(function(r){return r.json()}).catch(function(){return null});
    PROJS=(pr&&pr.projects)||[];UNGR=(pr&&pr.unsorted)||null;
    st.innerHTML='';
    renderPool();
  }catch(e){st.innerHTML='<div class="er">Error: '+esc(e.message)+'</div>';}
}
function renderPool(){
  var wsEl=$('workspaces');
  var statsEl=$('stats');
  var ac=0,pc=0,ar=0,cc=0,sc=0,tf=0;
  ALL.forEach(function(w){
    if(w.status==='active')ac++;else if(w.status==='paused')pc++;else ar++;
    tf+=w.file_count||0;
  });
  if(POOL){cc=(POOL.claimed||[]).length;sc=(POOL.potentially_stale||[]).length;}
  statsEl.innerHTML=
    '<div class="sc"><div class="sn">'+ac+'</div><div class="sl">Active</div></div>'+
    '<div class="sc"><div class="sn">'+pc+'</div><div class="sl">Paused</div></div>'+
    '<div class="sc"><div class="sn">'+ar+'</div><div class="sl">Archived</div></div>'+
    '<div class="sc"><div class="sn">'+cc+'</div><div class="sl">Claimed</div></div>'+
    '<div class="sc"><div class="sn">'+sc+'</div><div class="sl">Stale</div></div>'+
    '<div class="sc"><div class="sn">'+tf+'</div><div class="sl">Files</div></div>';
  var q=FILTER.q.toLowerCase();
  var list=ALL.filter(function(w){
    if(FILTER.st!=='all'&&w.status!==FILTER.st)return false;
    if(q&&w.name.toLowerCase().indexOf(q)===-1)return false;
    return true;
  });
  if(!list.length){wsEl.innerHTML='<div class="em">No workspaces match.</div>';return;}
  var cm={},sm={};
  if(POOL){POOL.claimed.forEach(function(c){cm[c.id]=c});POOL.potentially_stale.forEach(function(s){sm[s.id]=s});}
  // group by project
  var groups={},order=[];
  list.forEach(function(w){
    var pid=w.project_id||'';
    if(!groups[pid]){groups[pid]={proj:null,rows:[]};order.push(pid);}
    groups[pid].rows.push(w);
  });
  var byId={};PROJS.forEach(function(p){byId[p.id]=p;});
  // include empty projects (no matching workspaces) so creating a project gives feedback
  PROJS.forEach(function(p){
    if(!groups[p.id]){groups[p.id]={proj:p,rows:[]};}
  });
  var html='';
  // unsorted group first, then projects
  var pids=order.filter(function(pid){return pid===''||byId[pid];});
  PROJS.forEach(function(p){if(order.indexOf(p.id)===-1)pids.push(p.id);});
  var pidsSeen={};pids=pids.filter(function(pid){if(pidsSeen[pid])return false;pidsSeen[pid]=true;return true;});
  pids.forEach(function(pid){
    var g=groups[pid];
    if(pid===''){g.proj=UNGR?{name:UNGR.name,active:UNGR.active,paused:UNGR.paused,claimed:UNGR.claimed,stale:UNGR.stale,workspace_count:UNGR.workspace_count}:{name:'(unsorted)',active:0,paused:0,claimed:0,stale:0,workspace_count:g.rows.length};}
    else g.proj=byId[pid];
    var open2=PROJCOL[pid]!==false;
    var st2=g.proj.workspace_count!=null?g.proj.workspace_count:g.rows.length;
    html+='<div class="pgrp">'+
      '<div class="pgh" onclick="toggleProj(\\''+pid+'\\')">'+
      '<span class="pgname">'+esc(g.proj.name||'(unnamed)')+'</span>'+
      '<span class="pgstats">'+st2+' session'+(st2===1?'':'s')+' &middot; <b>'+(g.proj.active||0)+'</b> active &middot; '+(g.proj.paused||0)+' paused &middot; <span class="pk">'+(g.proj.claimed||0)+' claimed</span>'+(g.proj.stale?' &middot; <span class="pk st">'+(g.proj.stale||0)+' stale</span>':'')+'</span>'+
      '<span class="pgbtns">'+(pid?'<button class="sec gb" onclick="event.stopPropagation();openProjEdit(\\''+pid+'\\')">&#9998;</button><button class="del gb" onclick="event.stopPropagation();delProj(\\''+pid+'\\')">&#128465;</button>':'')+'</span>'+
      '<span class="pgarrow">'+(open2?'&#9660;':'&#9654;')+'</span>'+
      '</div>'+
      '<div class="pgbody" id="pgb-'+pid+'"'+(open2?'':' style="display:none"')+'>'+
      g.rows.map(function(ws){
        var cl=cm[ws.id],sl=sm[ws.id],cls=cl?'cl':(sl?'st':'');
        var bd='<span class="bg '+ws.status+'">'+ws.status+'</span>';
        if(cl)bd+='<span class="bg c">&#128273; '+esc(cl.claimed_by)+'</span>';
        if(sl)bd+='<span class="bg s">&#9888; '+sl.idle_hours+'h</span>';
        return '<div class="row '+cls+'" onclick="openEditor(\\''+ws.id+'\\')">'+
          '<input type="checkbox" class="rcb" onclick="event.stopPropagation();toggleWsSel(\\''+ws.id+'\\')"'+(SEL_WS[ws.id]?' checked':'')+'>'+
          '<div class="rname">'+esc(ws.name)+'<span class="rid">'+ws.id+'</span></div>'+
          '<div class="rbadges">'+bd+'</div>'+
          '<div class="rcnts">'+(ws.file_count||0)+'f &middot; '+(ws.variable_count||0)+'v &middot; '+(ws.decision_count||0)+'d &middot; '+(ws.next_step_count||0)+'s</div>'+
          '<div class="rupd">'+ta(ws.updated_at)+'</div>'+
          '<button class="editbtn" onclick="event.stopPropagation();openEditor(\\''+ws.id+'\\')">Edit</button>'+
          '</div>';
      }).join('')+
      '</div></div>';
  });
  wsEl.innerHTML=html;
}

// ── Bulk ops ──
function toggleWsSel(id){
  if(SEL_WS[id])delete SEL_WS[id];else SEL_WS[id]=true;
  updateBulkBar();
}
function toggleSelAllWs(){
  var c=$('selAllWs').checked;
  SEL_WS={};
  if(c)ALL.forEach(function(w){
    if(FILTER.st==='all'||w.status===FILTER.st)SEL_WS[w.id]=true;
  });
  updateBulkBar();
  renderPool();
}
function updateBulkBar(){
  var n=Object.keys(SEL_WS).length;
  $('selCnt').textContent=n+' selected';
  $('bulkBar').className='bulk'+(n?' show':'');
}
function selIds(){return Object.keys(SEL_WS);}
async function bulkOp(label,fn){
  var ids=selIds();
  if(!ids.length)return toast('Select workspaces first',false);
  if(!await askConfirm(label+' '+ids.length+' workspace'+(ids.length>1?'s':'')+'?'))return;
  var ok=0,er=0;
  for(var i=0;i<ids.length;i++){
    try{await fn(ids[i]);ok++;}
    catch(e){er++;}
  }
  toast(label+': '+ok+' ok'+(er?', '+er+' failed':''),er===0);
  SEL_WS={};updateBulkBar();loadPool();
}
function bulkPause(){bulkOp('Pause',function(id){return fetch(W+'/workspace/'+id,{method:'POST',headers:ah(true),body:JSON.stringify({status:'paused',agent:AGENT})}).then(function(r){return r.json()}).then(function(d){if(!d.ok)throw new Error(d.error)});});}
function bulkResume(){bulkOp('Resume',function(id){return fetch(W+'/workspace/'+id,{method:'POST',headers:ah(true),body:JSON.stringify({status:'active',agent:AGENT})}).then(function(r){return r.json()}).then(function(d){if(!d.ok)throw new Error(d.error)});});}
function bulkArchive(){bulkOp('Archive',function(id){return fetch(W+'/workspace/'+id+'/archive',{method:'POST',headers:ah(false)}).then(function(r){return r.json()}).then(function(d){if(!d.ok)throw new Error(d.error)});});}
function bulkDelete(){bulkOp('Delete',function(id){return fetch(W+'/workspace/'+id+'/delete',{method:'POST',headers:ah(false)}).then(function(r){return r.json()}).then(function(d){if(!d.ok)throw new Error(d.error)});});}
function bulkMoveProj(){
  var ids=selIds();
  if(!ids.length)return toast('Select workspaces first',false);
  var opts='<option value="">(unsorted)</option>';
  PROJS.forEach(function(p){opts+='<option value="'+p.id+'">'+esc(p.name)+'</option>';});
  $('cfMsg').innerHTML='<label style="font-size:.82rem;color:#ccc;display:block;margin-bottom:6px">Move '+ids.length+' workspace'+(ids.length>1?'s':'')+' to project:</label><select id="bulkProjSel" style="width:100%;padding:8px;border:1px solid #333;border-radius:8px;background:#141414;color:#fff">'+opts+'</select>';
  $('cfOverlay').style.display='flex';
  window.__cfRes=function(yes){
    $('cfOverlay').style.display='none';
    if(!yes)return;
    var pid=$('bulkProjSel').value||null;
    bulkOp('Move to project',function(id){
      return fetch(W+'/workspace/'+id,{method:'POST',headers:ah(true),body:JSON.stringify({project_id:pid,agent:AGENT})}).then(function(r){return r.json()}).then(function(d){if(!d.ok)throw new Error(d.error)});
    });
  };
}

// ── Projects ──
function toggleProj(pid){PROJCOL[pid]=PROJCOL[pid]===false?true:false;var b=$('pgb-'+pid);if(b)b.style.display=PROJCOL[pid]?'':'none';var p=document.getElementById('pgb-'+pid);var h=p&&p.parentNode.querySelector('.pgarrow');if(h)h.innerHTML=PROJCOL[pid]?'&#9660;':'&#9654;';}
function prCancel(){PRMODE='create';PRID='';$('prOverlay').style.display='none';}
function openProjCreate(){PRMODE='create';PRID='';$('prTitle').textContent='New Project';$('prName').value='';$('prDesc').value='';$('prOverlay').style.display='flex';$('prName').focus();}
function openProjEdit(id){PRMODE='edit';PRID=id;var p=null;PROJS.forEach(function(x){if(x.id===id)p=x;});$('prTitle').textContent='Edit Project';$('prName').value=p?p.name:'';$('prDesc').value=(p&&p.description)||'';$('prOverlay').style.display='flex';$('prName').focus();}
async function doProjSave(){
  var n=$('prName').value.trim();
  if(!n)return toast('Name required',false);
  var desc=$('prDesc').value.trim();
  try{
    var r,body={name:n,description:desc||undefined};
    if(PRMODE==='create')r=await fetch(W+'/projects',{method:'POST',headers:ah(true),body:JSON.stringify(body)});
    else r=await fetch(W+'/projects/'+PRID,{method:'POST',headers:ah(true),body:JSON.stringify(body)});
    var d=await r.json();
    if(!d.ok)throw new Error(d.error);
    prCancel();
    toast(PRMODE==='create'?'Project created':'Project saved',true);
    loadPool();
  }catch(e){toast(e.message,false);}
}
function delProj(id){
  askConfirm('Delete project? Its workspaces become (unsorted). Workspace data is NOT deleted.').then(async function(yes){
    if(!yes)return;
    try{
      var r=await fetch(W+'/projects/'+id,{method:'DELETE',headers:ah(false)});
      var d=await r.json();
      if(!d.ok)throw new Error(d.error);
      toast('Project deleted',true);
      loadPool();
    }catch(e){toast(e.message,false);}
  });
}

// ── Editor ──
function openEditor(id){
  CUR=id;ETAB=0;
  var ov=$('edOverlay');
  ov.style.display='flex';
  $('edBody').innerHTML='<div class="ld">Loading...</div>';
  renderEdTabs();
  refreshEditor();
}
function closeEditor(){CUR=null;$('edOverlay').style.display='none';}
function renderEdTabs(){var ts=document.querySelectorAll('.etab');for(var i=0;i<ts.length;i++)ts[i].className='etab'+(i===ETAB?' ac':'');}
function edTab(i){ETAB=i;renderEdTabs();renderEdTab();}
function renderEdTab(){
  if(ETAB===0)edFiles();
  else if(ETAB===1)edVars();
  else if(ETAB===2)edDecs();
  else if(ETAB===3)edSteps();
  else edCtx();
}
function renderEdHeader(){
  var ws=SEL[CUR];if(!ws)return;
  $('edName').value=ws.name||'';
  $('edId').textContent=ws.id+' &middot; label: '+(ws.label||'-');
  var bd='<span class="bg '+ws.status+'">'+ws.status+'</span>';
  if(ws.claimed_by)bd+='<span class="bg c">&#128273; '+esc(ws.claimed_by)+'</span>';
  $('edBadges').innerHTML=bd;
  var popts='<option value="">(unsorted)</option>';
  PROJS.forEach(function(p){popts+='<option value="'+p.id+'"'+(ws.project_id===p.id?' selected':'')+'>'+esc(p.name)+'</option>';});
  popts+='<option value="__new">+ New project...</option>';
  $('edProj').innerHTML=popts;
  $('edProj').value=ws.project_id||'';
  var acts='';
  if(ws.status==='active')acts+='<button onclick="doPause()">Pause</button>';
  else if(ws.status==='paused')acts+='<button class="sec" onclick="doResume()">Resume</button>';
  acts+='<button class="sec" onclick="doHb()">Heartbeat</button>';
  if(!ws.claimed_by)acts+='<button class="sec" onclick="doCl()">Claim</button>';
  else acts+='<button class="sec" onclick="doRl()">Release</button>';
  acts+='<button class="sec" onclick="openCk()">Checkpoint</button>';
  acts+='<button class="sec" onclick="saveMeta()">Save Name</button>';
  if(ws.status!=='archived')acts+='<button class="sec" onclick="doArch()">Archive</button>';
  acts+='<button class="del" onclick="doDel()">Delete</button>';
  $('edActs').innerHTML=acts;
}
function assignProj(){
  var v=$('edProj').value;
  if(v==='__new'){openProjCreate();$('edProj').value=SEL[CUR].project_id||'';return;}
  var pid=v||null;
  postUpdate({project_id:pid,agent:AGENT}).then(function(ok){
    if(ok)toast(pid?'Assigned to project':'Unassigned',true);
  });
}
async function refreshEditor(){
  try{
    var r=await fetch(W+'/workspace/'+CUR);
    var d=await r.json();
    if(!d.ok)throw new Error(d.error);
    SEL[CUR]=d.workspace;
    renderEdHeader();
    renderEdTab();
    loadPool();
  }catch(e){$('edBody').innerHTML='<div class="er">'+esc(e.message)+'</div>';}
}
async function postUpdate(body){
  try{
    var r=await fetch(W+'/workspace/'+CUR,{method:'POST',headers:ah(true),body:JSON.stringify(body)});
    var d=await r.json();
    if(!d.ok)throw new Error(d.error);
    refreshEditor();
    return true;
  }catch(e){toast('Error: '+e.message,false);return false;}
}

// files
function edFiles(){
  var ws=SEL[CUR],s=ws.state||{},files=s.files||{},h='';
  h+='<div class="addf"><input id="edNewFp" placeholder="file path e.g. src/main.ts" onkeydown="if(event.key===\\'Enter\\')addFile()"><textarea id="edNewFc" placeholder="file content..."></textarea><button onclick="addFile()">+ Add</button></div>';
  var keys=Object.keys(files);
  if(!keys.length)h+='<div class="em">No files yet.</div>';
  keys.forEach(function(fp){
    h+='<div class="frow" data-orig="'+esc(fp)+'">'+
      '<input class="fpath" value="'+esc(fp)+'">'+
      '<textarea class="fcontent">'+esc(files[fp])+'</textarea>'+
      '<div class="rowbtns"><button onclick="saveFileRow(this)">Save</button><button class="del" onclick="rmFile(this)">Del</button></div></div>';
  });
  $('edBody').innerHTML=h;
}
async function addFile(){
  var fp=$('edNewFp').value.trim();
  if(!fp)return toast('Path required',false);
  var body={state:{files:{}},agent:AGENT};
  body.state.files[fp]=$('edNewFc').value;
  if(await postUpdate(body))toast('Added '+fp,true);
}
async function saveFileRow(btn){
  var row=btn.closest('.frow'),fp=row.querySelector('.fpath').value.trim(),fc=row.querySelector('.fcontent').value,orig=row.getAttribute('data-orig');
  if(!fp)return toast('Path required',false);
  var body={state:{files:{}},agent:AGENT};
  body.state.files[fp]=fc;
  if(orig&&orig!==fp)body.remove={files:[orig]};
  if(await postUpdate(body))toast('Saved '+fp,true);
}
async function rmFile(btn){
  var row=btn.closest('.frow'),orig=row.getAttribute('data-orig');
  askConfirm('Remove file "'+orig+'"?').then(async function(yes){
    if(!yes)return;
    if(await postUpdate({remove:{files:[orig]},agent:AGENT}))toast('Removed '+orig,true);
  });
}

// variables
function edVars(){
  var ws=SEL[CUR],s=ws.state||{},vars=s.variables||{},h='';
  h+='<div class="addv"><input id="edNewVk" placeholder="key" onkeydown="if(event.key===\\'Enter\\')addVar()"><input id="edNewVv" placeholder="value"><button onclick="addVar()">+ Add</button></div>';
  var keys=Object.keys(vars);
  if(!keys.length)h+='<div class="em">No variables yet.</div>';
  keys.forEach(function(k){
    h+='<div class="vrow" data-orig="'+esc(k)+'">'+
      '<input class="vkey" value="'+esc(k)+'">'+
      '<input class="vval" value="'+esc(vars[k])+'">'+
      '<div class="rowbtns"><button onclick="saveVarRow(this)">Save</button><button class="del" onclick="rmVar(this)">Del</button></div></div>';
  });
  $('edBody').innerHTML=h;
}
async function addVar(){
  var k=$('edNewVk').value.trim();
  if(!k)return toast('Key required',false);
  var body={state:{variables:{}},agent:AGENT};
  body.state.variables[k]=$('edNewVv').value;
  if(await postUpdate(body))toast('Added '+k,true);
}
async function saveVarRow(btn){
  var row=btn.closest('.vrow'),k=row.querySelector('.vkey').value.trim(),v=row.querySelector('.vval').value,orig=row.getAttribute('data-orig');
  if(!k)return toast('Key required',false);
  var body={state:{variables:{}},agent:AGENT};
  body.state.variables[k]=v;
  if(orig&&orig!==k)body.remove={variables:[orig]};
  if(await postUpdate(body))toast('Saved '+k,true);
}
async function rmVar(btn){
  var row=btn.closest('.vrow'),orig=row.getAttribute('data-orig');
  askConfirm('Remove variable "'+orig+'"?').then(async function(yes){
    if(!yes)return;
    if(await postUpdate({remove:{variables:[orig]},agent:AGENT}))toast('Removed '+orig,true);
  });
}

// decisions
function edDecs(){
  var ws=SEL[CUR],s=ws.state||{},decs=s.decisions||{},h='';
  h+='<div class="addd"><input id="edNewDi" placeholder="id" onkeydown="if(event.key===\\'Enter\\')addDec()"><input id="edNewDd" placeholder="description"><button onclick="addDec()">+ Add</button></div>';
  var keys=Object.keys(decs);
  if(!keys.length)h+='<div class="em">No decisions yet.</div>';
  keys.forEach(function(k){
    h+='<div class="drow" data-orig="'+esc(k)+'">'+
      '<input class="dkey" value="'+esc(k)+'">'+
      '<input class="dval" value="'+esc(decs[k])+'">'+
      '<div class="rowbtns"><button onclick="saveDecRow(this)">Save</button><button class="del" onclick="rmDec(this)">Del</button></div></div>';
  });
  $('edBody').innerHTML=h;
}
async function addDec(){
  var k=$('edNewDi').value.trim();
  if(!k)return toast('Decision id required',false);
  var body={state:{decisions:{}},agent:AGENT};
  body.state.decisions[k]=$('edNewDd').value;
  if(await postUpdate(body))toast('Added '+k,true);
}
async function saveDecRow(btn){
  var row=btn.closest('.drow'),k=row.querySelector('.dkey').value.trim(),v=row.querySelector('.dval').value,orig=row.getAttribute('data-orig');
  if(!k)return toast('Decision id required',false);
  var body={state:{decisions:{}},agent:AGENT};
  body.state.decisions[k]=v;
  if(orig&&orig!==k)body.remove={decisions:[orig]};
  if(await postUpdate(body))toast('Saved '+k,true);
}
async function rmDec(btn){
  var row=btn.closest('.drow'),orig=row.getAttribute('data-orig');
  askConfirm('Remove decision "'+orig+'"?').then(async function(yes){
    if(!yes)return;
    if(await postUpdate({remove:{decisions:[orig]},agent:AGENT}))toast('Removed '+orig,true);
  });
}

// steps
function edSteps(){
  var ws=SEL[CUR],s=ws.state||{},steps=s.next_steps||[],h='';
  h+='<div class="addv"><input id="edNewStep" placeholder="next step..." onkeydown="if(event.key===\\'Enter\\')addStep()"><span></span><button onclick="saveSteps()">Save All</button></div>';
  if(!steps.length)h+='<div class="em">No steps yet.</div>';
  steps.forEach(function(st,i){
    h+='<div class="srow"><span>'+esc(st)+'</span><button class="del" onclick="rmStep('+i+')">Del</button></div>';
  });
  $('edBody').innerHTML=h;
}
function addStep(){
  var inp=$('edNewStep'),t=inp.value.trim();
  if(!t)return;
  SEL[CUR].state.next_steps=SEL[CUR].state.next_steps||[];
  SEL[CUR].state.next_steps.push(t);
  inp.value='';
  edSteps();
}
function rmStep(i){
  SEL[CUR].state.next_steps.splice(i,1);
  edSteps();
}
async function saveSteps(){
  var steps=SEL[CUR].state.next_steps||[];
  if(await postUpdate({state:{next_steps:steps},agent:AGENT}))toast('Steps saved ('+steps.length+')',true);
}

// context
function edCtx(){
  var ws=SEL[CUR],s=ws.state||{};
  $('edBody').innerHTML='<div class="ctxrow"><textarea id="edCtx" style="min-height:160px">'+esc(s.context||'')+'</textarea><button onclick="saveCtx()">Save</button></div>';
}
async function saveCtx(){
  if(await postUpdate({state:{context:$('edCtx').value},agent:AGENT}))toast('Context saved',true);
}

// meta
async function saveMeta(){
  var n=$('edName').value.trim();
  if(!n)return toast('Name required',false);
  if(await postUpdate({name:n,agent:AGENT}))toast('Name saved',true);
}

// lifecycle
async function doHb(){try{await fetch(W+'/workspace/'+CUR+'/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agent:AGENT})});toast('Heartbeat sent',true);refreshEditor();}catch(e){toast(e.message,false);}}
async function doCl(){try{var r=await fetch(W+'/workspace/'+CUR+'/claim',{method:'POST',headers:ah(true),body:JSON.stringify({agent:AGENT})});var d=await r.json();if(!d.ok)throw new Error(d.error);toast('Claimed',true);refreshEditor();}catch(e){toast(e.message,false);}}
async function doRl(){try{var r=await fetch(W+'/workspace/'+CUR+'/release',{method:'POST',headers:ah(true),body:JSON.stringify({agent:AGENT})});var d=await r.json();if(!d.ok)throw new Error(d.error);toast('Released',true);refreshEditor();}catch(e){toast(e.message,false);}}
async function doPause(){if(await postUpdate({status:'paused',agent:AGENT}))toast('Paused',true);}
async function doResume(){if(await postUpdate({status:'active',agent:AGENT}))toast('Resumed',true);}
function openCk(){$('ckFact').value='';$('ckOverlay').style.display='flex';}
function ckCancel(){$('ckOverlay').style.display='none';}
async function doCkNow(){
  var fs=$('ckFact').value.trim();
  try{
    var r=await fetch(W+'/workspace/'+CUR+'/checkpoint',{method:'POST',headers:ah(true),body:JSON.stringify({fact_summary:fs,agent:AGENT})});
    var d=await r.json();
    if(!d.ok)throw new Error(d.error);
    $('ckOverlay').style.display='none';
    toast('Checkpoint '+d.checkpoint.id+' ('+d.checkpoint.facts_extracted+' facts)',true);
  }catch(e){toast(e.message,false);}
}
async function doArch(){
  askConfirm('Archive workspace "'+(SEL[CUR]&&SEL[CUR].name||CUR)+'"?').then(async function(yes){
    if(!yes)return;
    try{
      var r=await fetch(W+'/workspace/'+CUR+'/archive',{method:'POST',headers:ah(false)});
      var d=await r.json();
      if(!d.ok)throw new Error(d.error);
      toast('Archived',true);closeEditor();loadPool();
    }catch(e){toast(e.message,false);}
  });
}
async function doDel(){
  askConfirm('PERMANENTLY DELETE workspace "'+(SEL[CUR]&&SEL[CUR].name||CUR)+'"? This cannot be undone.').then(async function(yes){
    if(!yes)return;
    try{
      var r=await fetch(W+'/workspace/'+CUR+'/delete',{method:'POST',headers:ah(false)});
      var d=await r.json();
      if(!d.ok)throw new Error(d.error);
      toast('Deleted',true);closeEditor();loadPool();
    }catch(e){toast(e.message,false);}
  });
}

// create
function openCreate(){
  var opts='<option value="">(unsorted)</option>';
  PROJS.forEach(function(p){opts+='<option value="'+p.id+'">'+esc(p.name)+'</option>';});
  $('crProj').innerHTML=opts;
  $('crOverlay').style.display='flex';$('crName').focus();
}
function crCancel(){$('crOverlay').style.display='none';}
async function doCreate(){
  var n=$('crName').value.trim();
  if(!n)return toast('Name required',false);
  var lb=$('crLabel').value.trim()||undefined;
  var pid=$('crProj').value||null;
  var fp=$('crFp').value.trim(),fc=$('crFc').value;
  var body={name:n,label:lb,project_id:pid,state:{}};
  if(fp&&fc){body.state.files={};body.state.files[fp]=fc;}
  try{
    var r=await fetch(W+'/workspace/create',{method:'POST',headers:ah(true),body:JSON.stringify(body)});
    var d=await r.json();
    if(!d.ok)throw new Error(d.error);
    $('crOverlay').style.display='none';
    toast('Created '+d.workspace.id.slice(0,8),true);
    loadPool();
  }catch(e){toast(e.message,false);}
}

// ── Query cache ──
async function loadCache(){
  var tb=document.querySelector('#cacheTable tbody');
  tb.innerHTML='<tr><td colspan="6" class="ld">Loading...</td></tr>';
  try{
    var r=await fetch(W+'/admin/cache',{headers:ah(false)});
    if(r.status===401){tb.innerHTML='';$('cacheStats').innerHTML='';$('cacheMsg').innerHTML='<div class="er">Unauthorized - enter your API key (&#9881; top right)</div>';return;}
    var d=await r.json();
    if(!d.ok)throw new Error(d.error);
    CACHE=d.entries||[];
    $('cacheStats').textContent=d.count+' cached queries &middot; '+kb(d.total_size)+' total';
    renderCache();
  }catch(e){tb.innerHTML='';$('cacheMsg').innerHTML='<div class="er">'+esc(e.message)+'</div>';}
}
function sortCache(k){
  if(FILTER.csort===k)FILTER.cdir=-FILTER.cdir;
  else{FILTER.csort=k;FILTER.cdir=-1;}
  renderCache();
}
function renderCache(){
  var tb=document.querySelector('#cacheTable tbody');
  var q=FILTER.cq.toLowerCase();
  var list=CACHE.filter(function(e){return !q||e.q.toLowerCase().indexOf(q)!==-1;});
  list.sort(function(a,b){
    var av=a[FILTER.csort],bv=b[FILTER.csort];
    if(av==null)av=0;if(bv==null)bv=0;
    return (av<bv?-1:av>bv?1:0)*FILTER.cdir;
  });
  $('selAll').checked=false;
  if(!list.length){tb.innerHTML='<tr><td colspan="6" class="em">No entries'+(q?' match':' - cache is empty')+'.</td></tr>';return;}
  tb.innerHTML=list.map(function(e){
    return '<tr><td><input type="checkbox" class="csel" value="'+e.hash+'"></td>'+
      '<td class="cq" title="'+esc(e.q)+'">'+esc(trunc(e.q,140))+'</td>'+
      '<td class="n">'+kb(e.size)+'</td><td class="n">'+e.hits+'</td><td class="n">'+ta(e.ts)+'</td>'+
      '<td><button class="del dbtn" onclick="clearOne(\\''+e.hash+'\\')">Clear</button></td></tr>';
  }).join('');
}
function toggleSelAll(){
  var cbs=document.querySelectorAll('.csel:checked');
  var all=cbs.length===document.querySelectorAll('table tbody .csel').length;
  document.querySelectorAll('table tbody .csel').forEach(function(c){c.checked=!all;});
}
function checkedHashes(){
  return Array.prototype.map.call(document.querySelectorAll('table tbody .csel:checked'),function(c){return c.value;});
}
function clearSelected(){
  var ids=checkedHashes();
  if(!ids.length)return toast('Select entries first',false);
  askConfirm('Clear '+ids.length+' cached queries?').then(function(yes){
    if(!yes)return;
    Promise.all(ids.map(function(h){
      return fetch(W+'/admin/cache/clear',{method:'POST',headers:ah(true),body:JSON.stringify({hash:h})});
    })).then(function(){toast('Cleared '+ids.length+' entries',true);loadCache();}).catch(function(e){toast(e.message,false);});
  });
}
async function clearOne(hash){
  askConfirm('Clear this cached query?').then(async function(yes){
    if(!yes)return;
    try{
      var r=await fetch(W+'/admin/cache/clear',{method:'POST',headers:ah(true),body:JSON.stringify({hash:hash})});
      var d=await r.json();
      if(!d.ok)throw new Error(d.error);
      toast('Cleared',true);loadCache();
    }catch(e){toast(e.message,false);}
  });
}
async function clearAll(){
  askConfirm('Clear ALL cached query results?').then(async function(yes){
    if(!yes)return;
    try{
      var r=await fetch(W+'/admin/cache/clear',{method:'POST',headers:ah(true),body:JSON.stringify({})});
      var d=await r.json();
      if(!d.ok)throw new Error(d.error);
      toast('Cleared all ('+d.cleared+')',true);loadCache();
    }catch(e){toast(e.message,false);}
  });
}

// misc
function toggleHelp(){var b=$('helpBody'),a=$('helpArrow');var open=b.style.display==='none';b.style.display=open?'block':'none';a.innerHTML=open?'&#9660;':'&#9654;';}
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    if($('cfOverlay').style.display==='flex')cfNo();
    else if($('ckOverlay').style.display==='flex')ckCancel();
    else if($('prOverlay').style.display==='flex')prCancel();
    else if($('crOverlay').style.display==='flex')crCancel();
    else if(CUR)closeEditor();
  }
});

var storedKey=localStorage.getItem('CF_MEMORY_KEY');
if(storedKey)$('akey').value=storedKey;
loadPool();
</script>
</body>
</html>`;
}