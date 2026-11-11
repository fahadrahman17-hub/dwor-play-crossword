const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000;
const server=http.createServer((req,res)=>{
 const f=req.url.split('?')[0].startsWith('/crossword')?'crossword.html':'index.html';
 fs.readFile(path.join(__dirname,'public',f),(e,d)=>{res.writeHead(e?404:200,{'Content-Type':'text/html; charset=utf-8'});res.end(e?'Not found':d)})});
const wss=new WebSocketServer({noServer:true,maxPayload:16384});
const cw=require('./crossword-server')();
server.on('upgrade',(req,sock,head)=>{const w=req.url.startsWith('/cw')?cw:wss;w.handleUpgrade(req,sock,head,x=>w.emit('connection',x,req))});
const games={};
const norm=x=>x.trim().toLowerCase().replace(/\s+/g,' ');
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function scramble(w){const c=w.split(''),ix=c.map((x,i)=>x===' '?-1:i).filter(i=>i>=0),L=ix.map(i=>c[i]);
 if(new Set(L).size<2)return w;let o;do{o=shuffle(L)}while(o.join('')===L.join(''));ix.forEach((p,k)=>c[p]=o[k]);return c.join('')}
const send=(ws,o)=>{if(ws.readyState===1)ws.send(JSON.stringify(o))};
const snap=G=>({p:G.phase,n:G.names,ok:G.ok,sk:G.sk,t:G.t,left:G.left,sw:G.sw,h:G.h,m:G.m,mo:G.mo,lk:G.lock,c:G.code,sec:G.sec,mode:G.mode,rev:G.rev,ty:G.ty||'',wl:G.list.length,
 mem:G.names.map((_,i)=>[...G.cl].filter(c=>c.team===i).map(c=>c.nick)),watch:[...G.cl].filter(c=>c.team<0).length});
function bc(G){G.seen=Date.now();const s=snap(G);const a=G.phase==='play'&&G.rev&&G.q[G.w]?G.q[G.w].w:null;const pub={...s,ty:'',m:G.m?(G.mo?'✓ Correct! +1 for '+G.names[G.t]:'✗ Wrong answer.'):''};
 for(const c of G.cl){const full=c.host||(c.team>=0&&c.team===G.t);send(c,{t:'state',s:full?s:pub,you:{host:c.host,team:c.team},a:c.host?a:null})}}
function nextWord(G){if(G.w>=G.q.length){endTurn(G);return}const c=G.q[G.w];G.sw=scramble(c.w);G.h=c.h;G.lock=false;G.rev=false;G.ty=''}
function judge(G,g){if(G.phase!=='play'||G.lock)return;const raw=String(g).trim();g=norm(g);if(!g)return;const c=G.q[G.w];G.ty='';
 if(g===norm(c.w)){G.list=G.list.filter(x=>x!==c);G.ok[G.t]++;G.w++;G.m='✓ Correct answer! They typed “'+raw+'”. +1 for '+G.names[G.t];G.mo=true;nextWord(G)}
 else{G.lock=true;G.sk[G.t]++;G.m='✗ Wrong answer! They typed “'+raw+'”. The right answer is: '+c.w.toUpperCase();G.mo=false;clearTimeout(G.pend);G.pend=setTimeout(()=>adv(G),3500)}
 bc(G)}
function adv(G){clearTimeout(G.pend);if(!G.lock)return;G.lock=false;G.w++;G.m='';nextWord(G);bc(G)}
function skip(G){if(G.phase!=='play')return;if(G.lock){adv(G);return}G.sk[G.t]++;G.w++;G.m='';nextWord(G);bc(G)}
function endTurn(G){clearTimeout(G.pend);G.lock=false;G.m='';G.sw='';G.rev=false;G.t++;
 if(G.t>=G.names.length||!G.list.length){G.t=Math.min(G.t,G.names.length-1);G.phase='end'}else G.phase='ready';bc(G)}
function make(d){
 let list=String(d.words||'').slice(0,8000).split('\n').map(l=>l.trim()).filter(Boolean).slice(0,500).map(l=>{const i=l.indexOf(',');return i<0?{w:l,h:''}:{w:l.slice(0,i).trim(),h:l.slice(i+1).trim()}}).filter(x=>x.w).filter((x,i,a)=>a.findIndex(y=>y.w.toLowerCase()===x.w.toLowerCase())===i);
 if(!list.length)return null;
 const names=(Array.isArray(d.names)?d.names:[]).slice(0,8).map((n,i)=>String(n||'').trim().slice(0,20)||'Team '+(i+1));
 while(names.length<2)names.push('Team '+(names.length+1));
 let code;do{code=Math.random().toString(36).slice(2,6).padEnd(4,'x')}while(games[code]);
 const G={code,key:Math.random().toString(36).slice(2),names,list:d.shuf?shuffle(list):list,orig:list,shuf:!!d.shuf,sec:Math.round(Math.min(30,Math.max(0.5,+d.sec||3))*60),
  ok:names.map(()=>0),sk:names.map(()=>0),mode:d.mode==='say'?'say':'type',rev:false,phase:'lobby',t:0,w:0,left:0,sw:'',h:'',m:'',mo:false,lock:false,q:[],cl:new Set(),seen:Date.now()};
 G.timer=setInterval(()=>{if(G.phase==='play'){G.left--;if(G.left<=0)endTurn(G);else bc(G)}},1000);
 games[code]=G;return G}
wss.on('connection',ws=>{
 ws.team=-1;ws.host=false;ws.nick='Player';ws.G=null;
 ws.on('message',raw=>{let d;try{d=JSON.parse(raw)}catch(e){return}
  const G=ws.G;
  if(d.t==='create'){const g=make(d);if(!g)return send(ws,{t:'err',msg:'Please add at least one word.'});
   ws.G=g;ws.host=true;g.cl.add(ws);send(ws,{t:'created',code:g.code,key:g.key});bc(g);return}
  if(d.t==='join'){const g=games[String(d.code||'').toLowerCase()];if(!g)return send(ws,{t:'err',msg:'Game not found. Check the code.',gone:true});
   ws.G=g;ws.nick=String(d.nick||'Player').slice(0,16);ws.host=d.key===g.key;ws.team=Number.isInteger(d.team)&&d.team>=0&&d.team<g.names.length?d.team:-1;
   g.cl.add(ws);bc(g);return}
  if(!G)return;
  if(d.t==='team'&&Number.isInteger(d.i)&&d.i>=-1&&d.i<G.names.length&&(G.phase==='lobby'||G.phase==='ready'||ws.team<0)){ws.team=d.i;bc(G)}
  else if(d.t==='start'&&ws.host&&G.phase==='lobby'){G.phase='ready';G.t=0;bc(G)}
  else if(d.t==='go'&&ws.host&&G.phase==='ready'){G.q=G.list.slice();G.w=0;G.left=G.sec;G.m='';G.phase='play';nextWord(G);bc(G)}
  else if(d.t==='typing'&&G.phase==='play'&&G.mode==='type'&&!G.lock&&(ws.team===G.t||ws.host)){G.ty=String(d.v||'').slice(0,60);bc(G)}
  else if(d.t==='guess'&&G.phase==='play'&&G.mode==='type'&&(ws.team===G.t||ws.host))judge(G,String(d.g||'').slice(0,60));
  else if(d.t==='skip'&&(ws.host||(G.mode==='type'&&ws.team===G.t)))skip(G);
  else if(d.t==='check'&&ws.host&&G.phase==='play'&&G.mode==='say'&&!G.rev){G.rev=true;bc(G)}
  else if(d.t==='mark'&&ws.host&&G.phase==='play'&&G.mode==='say'&&G.rev){const c=G.q[G.w];
   if(d.ok){G.list=G.list.filter(x=>x!==c);G.ok[G.t]++;G.m='✓ Correct! +1';G.mo=true}else{G.sk[G.t]++;G.m='✗ Wrong. The word was '+c.w.toUpperCase();G.mo=false}
   G.w++;nextWord(G);bc(G)}
  else if(d.t==='again'&&ws.host&&G.phase==='end'){G.ok=G.names.map(()=>0);G.sk=G.names.map(()=>0);G.t=0;G.w=0;G.phase='lobby';G.list=G.shuf?shuffle(G.orig):G.orig;bc(G)}
 });
 ws.on('close',()=>{if(ws.G){ws.G.cl.delete(ws);bc(ws.G)}});
});
setInterval(()=>{for(const c in games){const G=games[c];if(!G.cl.size&&Date.now()-G.seen>30*60e3){clearInterval(G.timer);delete games[c]}}},10*60e3);
server.listen(PORT,()=>console.log('DWOR running on port '+PORT));
