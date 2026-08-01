/* Servidor relay simples para RPG Legend Multiplayer. */
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');

const port = Number(process.env.PORT || 8080);
const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const rooms = new Map();

const server = http.createServer((req,res)=>{
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  if(!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){
    res.writeHead(404); res.end('Não encontrado'); return;
  }
  res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({server});
function send(ws,data){if(ws.readyState===1)ws.send(JSON.stringify(data));}
function relay(room,sender,data){(rooms.get(room)||[]).forEach(client=>{if(client!==sender)send(client,data);});}
wss.on('connection',ws=>{
  ws.on('message',raw=>{
    let data; try{data=JSON.parse(raw.toString());}catch(e){return;}
    const room=String(data.room||'').toUpperCase().slice(0,6); if(!room)return;
    if(data.type==='create'){
      if(rooms.has(room) && rooms.get(room).length){send(ws,{type:'error',message:'Sala já existe.'});return;}
      rooms.set(room,[ws]); ws.room=room; ws.role=1; send(ws,{type:'created',room}); return;
    }
    if(data.type==='join'){
      const clients=rooms.get(room);
      if(!clients || !clients.length){send(ws,{type:'error',message:'Sala não encontrada.'});return;}
      if(clients.length>=2){send(ws,{type:'error',message:'Sala cheia.'});return;}
      clients.push(ws); ws.room=room; ws.role=2; relay(room,ws,{type:'hello',room,name:data.name,role:2}); return;
    }
    if(ws.room===room) relay(room,ws,data);
  });
  ws.on('close',()=>{
    if(!ws.room)return; const clients=(rooms.get(ws.room)||[]).filter(c=>c!==ws);
    if(clients.length){rooms.set(ws.room,clients);clients.forEach(c=>send(c,{type:'peer-left',room:ws.room}));}else rooms.delete(ws.room);
  });
});
server.listen(port,()=>console.log(`RPG Legend disponível em http://localhost:${port}`));
