/* RPG Legend Multiplayer - relay com validação autoritativa de perfis. */
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');

const port = Number(process.env.PORT || 8080);
const root = path.resolve(__dirname, '..');
const rooms = new Map();
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};

function clamp(value,min,max){value=Number(value);return Number.isFinite(value)?Math.max(min,Math.min(max,value)):min;}
function integer(value,min,max){return Math.floor(clamp(value,min,max));}
function clone(value){return JSON.parse(JSON.stringify(value));}
function xpForLevel(level){return 40+(level-1)*35;}
function equipmentStat(hero,key,cap){
  let total=0;const equip=hero&&hero.equip||{};
  ['arma','armadura','acessorio'].forEach(slot=>{const item=equip[slot];if(item&&item.stats)total+=integer(item.stats[key],0,cap);});
  return Math.min(total,cap);
}
function sanitizeParty(party){
  return (Array.isArray(party)?party:[]).slice(0,2).map(member=>{
    const clean=clone(member||{});clean.maxHp=integer(clean.maxHp,1,1000);clean.hp=integer(clean.hp,0,clean.maxHp);
    clean.attack=integer(clean.attack,1,250);clean.combatsLeft=clean.temporary?integer(clean.combatsLeft,0,10):clean.combatsLeft;
    return clean;
  });
}
function sanitizeHero(candidate,record){
  const hero=clone(candidate||{});const previous=record&&record.hero;
  const previousLevel=previous?integer(previous.level,1,500):1;
  hero.level=previous?integer(hero.level,previousLevel,previousLevel+5):1;
  const keys=['forca','destreza','constituicao','intelecto','sabedoria','carisma'];
  hero.attrs=hero.attrs||{};
  keys.forEach(key=>hero.attrs[key]=integer(hero.attrs[key],1,previous?99:20));
  const total=keys.reduce((sum,key)=>sum+hero.attrs[key],0);
  const baseline=record&&record.baseAttrs?record.baseAttrs:Math.min(total,100);
  const allowedTotal=baseline+Math.max(0,hero.level-1)*2;
  if(total>allowedTotal){
    let excess=total-allowedTotal;
    keys.slice().reverse().forEach(key=>{const cut=Math.min(excess,Math.max(0,hero.attrs[key]-1));hero.attrs[key]-=cut;excess-=cut;});
  }
  const equipCap=500+hero.level*50;
  const calculatedHp=20+hero.level*5+hero.attrs.constituicao*10+equipmentStat(hero,'vida',equipCap);
  const calculatedMp=10+hero.level*2+hero.attrs.intelecto*5+equipmentStat(hero,'mana',equipCap);
  hero.maxHp=calculatedHp;hero.maxMp=calculatedMp;
  hero.hp=integer(hero.hp,0,calculatedHp);hero.mp=integer(hero.mp,0,calculatedMp);
  hero.xpNext=xpForLevel(hero.level);hero.xp=integer(hero.xp,0,hero.xpNext-1);
  hero.attrPoints=integer(hero.attrPoints,0,Math.max(0,(hero.level-1)*2));
  hero.gold=previous?integer(hero.gold,0,integer(previous.gold,0,100000000)+5000):integer(hero.gold,0,100);
  hero.killCount=previous?integer(hero.killCount,integer(previous.killCount,0,1000000),integer(previous.killCount,0,1000000)+20):0;
  if(hero.derived){hero.derived.maxHp=calculatedHp;hero.derived.maxMp=calculatedMp;}
  return {hero,baseAttrs:baseline};
}
function sanitizeProfile(profile,oldRecord){
  const result=sanitizeHero(profile&&profile.hero,oldRecord);
  return {name:String(profile&&profile.name||'Aventureiro').slice(0,20),hero:result.hero,inventory:Array.isArray(profile&&profile.inventory)?clone(profile.inventory).slice(0,120):[],party:sanitizeParty(profile&&profile.party),baseAttrs:result.baseAttrs};
}
function publicProfiles(room){
  const result={};Object.keys(room.profiles).forEach(role=>{const p=room.profiles[role];result[role]={name:p.name,hero:p.hero,inventory:p.inventory,party:p.party};});return result;
}
function sanitizeState(data,room,role){
  const state=clone(data||{});const incoming=state.profiles&&state.profiles[role];
  if(incoming)room.profiles[role]=sanitizeProfile(incoming,room.profiles[role]);
  state.profiles=publicProfiles(room);
  state.floor=integer(state.floor,1,10000);state.mapRows=integer(state.mapRows,1,12);state.mapCols=integer(state.mapCols,1,12);
  // Na exploração, somente o criador da sala conduz posição, andar e local.
  // O convidado ainda pode atualizar combate, perfil e interações compartilhadas.
  if(role!==1&&room.state){state.pos=clone(room.state.pos);state.floor=room.state.floor;state.mapMode=room.state.mapMode;state.mapRows=room.state.mapRows;state.mapCols=room.state.mapCols;}
  if(Array.isArray(state.map))state.map=state.map.slice(0,12).map(row=>Array.isArray(row)?row.slice(0,12):[]);
  return state;
}

const server=http.createServer((req,res)=>{
  const requestPath=decodeURIComponent((req.url||'/').split('?')[0]);
  if(requestPath==='/health'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({online:true,rooms:rooms.size,validation:true}));return;}
  const relative=requestPath==='/'?'index.html':requestPath.replace(/^\/+/, '');const file=path.resolve(root,relative);
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){
    if(requestPath==='/'){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});res.end('RPG Legend Multiplayer: servidor protegido online');return;}
    res.writeHead(404);res.end('Não encontrado');return;
  }
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});

const wss=new WebSocketServer({server,maxPayload:512*1024});
function send(ws,data){if(ws.readyState===1)ws.send(JSON.stringify(data));}
function relay(room,sender,data){room.clients.forEach(client=>{if(client!==sender)send(client,data);});}
wss.on('connection',ws=>{
  ws.rate={time:Date.now(),count:0};
  ws.on('message',raw=>{
    const now=Date.now();if(now-ws.rate.time>1000)ws.rate={time:now,count:0};if(++ws.rate.count>30){send(ws,{type:'error',message:'Muitas ações em pouco tempo.'});return;}
    let data;try{data=JSON.parse(raw.toString());}catch(e){return;}
    const code=String(data.room||'').toUpperCase().slice(0,6);if(!code)return;
    if(data.type==='create'){
      if(rooms.has(code)&&rooms.get(code).clients.length){send(ws,{type:'error',message:'Sala já existe.'});return;}
      rooms.set(code,{clients:[ws],profiles:{},state:null});ws.room=code;ws.role=1;send(ws,{type:'created',room:code});return;
    }
    if(data.type==='join'){
      const room=rooms.get(code);if(!room||!room.clients.length){send(ws,{type:'error',message:'Sala não encontrada.'});return;}
      if(room.clients.length>=2){send(ws,{type:'error',message:'Sala cheia.'});return;}
      room.clients.push(ws);ws.room=code;ws.role=2;relay(room,ws,{type:'hello',room:code,name:String(data.name||'Aventureiro').slice(0,20),role:2});return;
    }
    const room=rooms.get(code);if(!room||ws.room!==code||!ws.role)return;
    data.role=ws.role;
    if(data.type==='profile'){
      room.profiles[ws.role]=sanitizeProfile(data.profile,room.profiles[ws.role]);
      data.profile=publicProfiles(room)[ws.role];relay(room,ws,data);send(ws,{type:'profile-accepted',room:code,role:ws.role,profile:data.profile});return;
    }
    if(data.type==='welcome'){
      if(ws.role!==1)return;
      if(data.state)room.state=sanitizeState(data.state,room,1);
      data.state=room.state;data.profiles=publicProfiles(room);relay(room,ws,data);return;
    }
    if(data.type==='state'){
      room.state=sanitizeState(data.state,room,ws.role);data.state=room.state;relay(room,ws,data);
      send(ws,{type:'authoritative',room:code,state:room.state,turn:data.turn,role:ws.role});return;
    }
    if(data.type==='move-lock'){if(ws.role===1)relay(room,ws,data);return;}
    if(data.type==='ui-action'){
      const allowed=['shop','npc','simple','event','questboard','encounter'];if(!allowed.includes(data.action))return;
      const p=data.payload&&typeof data.payload==='object'?data.payload:{};
      data.payload={x:integer(p.x,-1,11),y:integer(p.y,-1,11),kind:p.kind==='blacksmith'?'blacksmith':'shop'};
      if(data.action==='simple'){data.payload.icon=String(p.icon||'').slice(0,8);data.payload.title=String(p.title||'').replace(/[<>]/g,'').slice(0,60);data.payload.text=String(p.text||'').replace(/[<>]/g,'').slice(0,500);}
      if(data.action==='npc'&&p.npc){data.payload.npc={name:String(p.npc.name||'NPC').replace(/[<>]/g,'').slice(0,50),role:String(p.npc.role||'').replace(/[<>]/g,'').slice(0,50),service:String(p.npc.service||'').slice(0,20),icon:String(p.npc.icon||'').slice(0,8),lines:(Array.isArray(p.npc.lines)?p.npc.lines:[]).slice(0,10).map(line=>String(line).replace(/[<>]/g,'').slice(0,300)),serviceUsed:!!p.npc.serviceUsed};}
      relay(room,ws,data);return;
    }
    if(data.type==='team-heal'){data.amount=integer(data.amount,0,500);relay(room,ws,data);return;}
    if(data.type==='boss-advance-request'&&ws.role===2&&room.state&&room.state.floor%5===0){
      const defeated=(room.state.map||[]).some(row=>(row||[]).some(cell=>cell&&cell.type==='boss'&&cell.beaten));
      if(defeated)relay(room,ws,{type:'boss-advance',room:code,role:2,bossName:String(data.bossName||'o chefe').replace(/[<>]/g,'').slice(0,80)});
      return;
    }
  });
  ws.on('close',()=>{
    if(!ws.room)return;const room=rooms.get(ws.room);if(!room)return;room.clients=room.clients.filter(client=>client!==ws);
    if(room.clients.length){room.clients.forEach(client=>send(client,{type:'peer-left',room:ws.room}));}else rooms.delete(ws.room);
  });
});
server.listen(port,()=>console.log(`RPG Legend protegido disponível na porta ${port}`));
