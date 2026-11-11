const {WebSocketServer}=require('ws');
module.exports=function(){
const wss=new WebSocketServer({noServer:true,maxPayload:262144});
const games={};
const send=(ws,s)=>{if(ws.readyState===1)ws.send(s)};
const K=(r,c)=>r+','+c;
const norm=x=>String(x||'').toUpperCase().replace(/[^\p{L}]/gu,'');
const int=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
const last=t=>t.words.reduce((m,w)=>w.done?Math.max(m,w.at):m,0);
const solved=t=>t.words.filter(w=>w.done).length;
const wrong=t=>t.log.filter(l=>!l.ok).length;
function mkTeam(p,seen){
 const name=String(p&&p.name||'Team').slice(0,24),ws=[];
 for(const x of (Array.isArray(p&&p.words)?p.words:[]).slice(0,60)){
  const w=norm(x.w);if(w.length<2||w.length>30||!int(x.r,0,200)||!int(x.c,0,200)||(x.d!==0&&x.d!==1))continue;
  if(seen.has(w))return {err:'The word '+w+' is used by more than one team.'};
  seen.add(w);ws.push({w,q:String(x.q||'').slice(0,140),r:x.r,c:x.c,d:x.d})}
 if(!ws.length)return {err:name+' has no words.'};
 const R0=Math.min(...ws.map(x=>x.r)),C0=Math.min(...ws.map(x=>x.c));ws.forEach(x=>{x.r-=R0;x.c-=C0});
 const g=new Map();
 for(const x of ws)for(let k=0;k<x.w.length;k++){const key=K(x.r+(x.d?k:0),x.c+(x.d?0:k));if(g.has(key)&&g.get(key)!==x.w[k])return {err:'Letters clash in '+name+'.'};g.set(key,x.w[k])}
 const rows=Math.max(...ws.map(x=>x.r+(x.d?x.w.length:1))),cols=Math.max(...ws.map(x=>x.c+(x.d?1:x.w.length))),nums=new Map();
 [...new Set(ws.map(x=>K(x.r,x.c)))].map(s=>s.split(',').map(Number)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]).forEach((rc,i)=>nums.set(K(rc[0],rc[1]),i+1));
 ws.forEach(x=>{x.num=nums.get(K(x.r,x.c));x.len=x.w.length;x.done=false;x.at=0;x.by=''});
 return {t:{name,rows,cols,words:ws,log:[],fin:null}}}
function make(d){
 const ps=Array.isArray(d.puzzles)?d.puzzles.slice(0,12):[];if(!ps.length)return {err:'No teams.'};
 const seen=new Set(),teams=[];
 for(const p of ps){const r=mkTeam(p,seen);if(r.err)return r;teams.push(r.t)}
 let code;do{code=Math.random().toString(36).slice(2,6).padEnd(4,'x')}while(games[code]);
 const G={code,key:Math.random().toString(36).slice(2),teams,limit:Math.min(90,Math.max(1,+d.limit||15))*60,first:!!d.first,phase:'lobby',t0:0,rank:[],tied:[],cl:new Set(),seen:Date.now()};
 G.timer=setInterval(()=>{if(G.phase==='play'&&Date.now()-G.t0>=G.limit*1000)endGame(G)},1000);
 games[code]=G;return {G}}
const detail=(t,reveal)=>({rows:t.rows,cols:t.cols,words:t.words.map(w=>({num:w.num,d:w.d,q:w.q,len:w.len,r:w.r,c:w.c,done:w.done,w:(w.done||reveal)?w.w:undefined})),log:reveal?t.log:t.log.slice(-40)});
function bc(G){G.seen=Date.now();const end=G.phase==='end';
 const sj=JSON.stringify({p:G.phase,c:G.code,lim:G.limit,first:G.first,t0:G.t0,now:Date.now(),tn:G.teams.map(t=>t.name),
  sum:G.teams.map((t,i)=>({s:solved(t),t:t.words.length,x:wrong(t),f:t.fin,m:[...G.cl].filter(c=>c.team===i).map(c=>c.nick)})),
  d:G.teams.map(t=>detail(t,end)),rank:G.rank,tied:G.tied,watch:[...G.cl].filter(c=>c.team<0&&!c.host).length});
 for(const c of G.cl)send(c,'{"t":"state","s":'+sj+',"you":'+JSON.stringify({host:c.host,team:c.team})+'}')}
function endGame(G){if(G.phase!=='play')return;G.phase='end';
 const key=t=>[t.fin===null?1:0,t.fin||0,-solved(t),last(t),wrong(t)];
 const cmp=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0};
 const ord=G.teams.map((t,i)=>i).sort((a,b)=>cmp(key(G.teams[a]),key(G.teams[b])));
 G.rank=ord;G.tied=ord.filter(i=>cmp(key(G.teams[i]),key(G.teams[ord[0]]))===0);bc(G)}
const err=(ws,msg,gone)=>send(ws,JSON.stringify({t:'err',msg,gone}));
wss.on('connection',ws=>{
 ws.team=-1;ws.host=false;ws.nick='Player';ws.G=null;
 ws.on('message',raw=>{let d;try{d=JSON.parse(raw)}catch(e){return}
  const G=ws.G;
  if(d.t==='create'){const r=make(d);if(r.err)return err(ws,r.err);
   ws.G=r.G;ws.host=true;r.G.cl.add(ws);send(ws,JSON.stringify({t:'created',code:r.G.code,key:r.G.key}));bc(r.G);return}
  if(d.t==='join'){const g=games[String(d.code||'').toLowerCase()];if(!g)return err(ws,'Game not found. Check the code.',true);
   ws.G=g;ws.nick=String(d.nick||'Player').slice(0,16);ws.host=d.key===g.key;ws.team=Number.isInteger(d.team)&&d.team>=0&&d.team<g.teams.length?d.team:-1;
   g.cl.add(ws);bc(g);return}
  if(!G)return;
  if(d.t==='team'&&Number.isInteger(d.i)&&d.i>=-1&&d.i<G.teams.length&&(G.phase==='lobby'||ws.team<0)){ws.team=d.i;bc(G)}
  else if(d.t==='start'&&ws.host&&G.phase==='lobby'){G.phase='play';G.t0=Date.now();bc(G)}
  else if(d.t==='end'&&ws.host)endGame(G);
  else if(d.t==='again'&&ws.host&&G.phase==='end'){G.teams.forEach(t=>{t.log=[];t.fin=null;t.words.forEach(w=>{w.done=false;w.at=0;w.by=''})});G.phase='lobby';G.rank=[];G.tied=[];bc(G)}
  else if(d.t==='submit'&&G.phase==='play'&&ws.team>=0&&ws.team<G.teams.length){
   const t=G.teams[ws.team];if(t.fin!==null)return;
   const wd=t.words.find(x=>x.num===d.n&&x.d===d.d);if(!wd||wd.done)return;
   const g=norm(d.g).slice(0,40);if(!g)return;
   const now=Date.now(),el=now-G.t0,ok=g===wd.w;
   t.log.push({ts:now,el,n:wd.num,d:wd.d,g,ok,nick:ws.nick});if(t.log.length>600)t.log.shift();
   if(ok){wd.done=true;wd.at=el;if(t.words.every(x=>x.done)){t.fin=el;if(G.first||G.teams.every(x=>x.fin!==null))return endGame(G)}}
   bc(G)}
 });
 ws.on('close',()=>{if(ws.G){ws.G.cl.delete(ws);bc(ws.G)}});
});
setInterval(()=>{for(const c in games){const G=games[c];if(!G.cl.size&&Date.now()-G.seen>30*60e3){clearInterval(G.timer);delete games[c]}}},10*60e3);
return wss};
