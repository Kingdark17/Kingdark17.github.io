/* RPG Legend - multiplayer cooperativo experimental.
   BroadcastChannel funciona entre abas. WebSocket usa server/server.js. */
var RPG = window.RPG || {};

RPG.Multiplayer = (function(){
  var session={connected:false,room:'',name:'',role:0,turn:1,transport:null,remote:false,applying:false,players:1};
  var originalSave=RPG.Save.save;

  function code(){
    var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out='';
    for(var i=0;i<6;i++) out+=chars[Math.floor(Math.random()*chars.length)];
    return out;
  }
  function message(text,error){
    var el=document.getElementById('multiplayerMessage');
    if(el){ el.textContent=text; el.style.color=error?'#e28a8a':'var(--parchment-dim)'; }
  }
  function status(){
    var el=document.getElementById('multiplayerStatus'); if(!el)return;
    el.classList.toggle('hidden',!session.connected);
    el.classList.toggle('my-turn',session.connected&&session.turn===session.role);
    el.classList.toggle('waiting-turn',session.connected&&session.turn!==session.role);
    if(session.connected) el.textContent='Sala '+session.room+' · Jogador '+session.role+' · '+(session.turn===session.role?'SUA VEZ':'aguardando parceiro');
  }
  function snapshot(){
    if(!RPG.state || !RPG.state.hero)return null;
    var s=RPG.state;
    return {hero:s.hero,party:s.party,inventory:s.inventory,quests:s.quests,floor:s.floor,mapMode:s.mapMode,map:s.map,mapRows:s.mapRows,mapCols:s.mapCols,pos:s.pos,mode:s.mode,pendingTarget:s.pendingTarget,pendingMonsterPos:s.pendingMonsterCell?{x:s.pendingMonsterCell.x,y:s.pendingMonsterCell.y}:null,soundOn:s.soundOn};
  }
  function send(payload){
    if(!session.transport)return;
    payload.room=session.room;
    if(session.remote && session.transport.readyState===1) session.transport.send(JSON.stringify(payload));
    else if(!session.remote) session.transport.postMessage(payload);
  }
  function renderRemote(){
    var s=RPG.state;
    RPG.UI.showScreen('game');
    RPG.UI.renderHero(); RPG.UI.renderMap(); RPG.UI.renderControls();
    if(s.mode==='combat' && s.pendingMonsterCell){
      document.getElementById('sceneText').classList.add('hidden');
      document.getElementById('combatScene').classList.remove('hidden');
      if(RPG.Combat.refresh) RPG.Combat.refresh(s.pendingMonsterCell);
    }else{
      document.getElementById('combatScene').classList.add('hidden');
      document.getElementById('sceneText').classList.remove('hidden');
      RPG.UI.updateSceneText();
    }
  }
  function applyState(data){
    if(!data || !data.hero)return;
    session.applying=true;
    var s=RPG.state;
    ['hero','party','inventory','quests','floor','mapMode','map','mapRows','mapCols','pos','mode','pendingTarget','soundOn'].forEach(function(k){ if(data[k]!==undefined)s[k]=data[k]; });
    s.pendingMonsterCell=null;
    if(data.pendingMonsterPos && s.map[data.pendingMonsterPos.y]) s.pendingMonsterCell=s.map[data.pendingMonsterPos.y][data.pendingMonsterPos.x];
    originalSave(s); renderRemote(); session.applying=false;
  }
  function receive(msg){
    if(!msg || msg.room!==session.room)return;
    if(msg.type==='hello' && session.role===1){
      session.players=2; send({type:'welcome',state:snapshot(),turn:session.turn}); status();
      message(msg.name+' entrou na sala.');
    }else if(msg.type==='welcome' && session.role===2){
      session.players=2; session.turn=msg.turn||1; applyState(msg.state); status();
      message('Conectado! A aventura foi sincronizada.');
    }else if(msg.type==='state' && msg.role!==session.role){
      session.turn=msg.turn||session.turn; applyState(msg.state); status();
    }else if(msg.type==='error'){
      message(msg.message||'Erro na sala multiplayer.',true);
    }else if(msg.type==='peer-left') message('O outro jogador desconectou.',true);
  }
  function openTransport(server,onOpen){
    if(server){
      try{
        session.remote=true; var ws=new WebSocket(server); session.transport=ws;
        ws.onopen=onOpen; ws.onmessage=function(e){ try{receive(JSON.parse(e.data));}catch(err){} };
        ws.onerror=function(){message('Não foi possível conectar ao servidor.',true);};
        ws.onclose=function(){message('Conexão encerrada.',true);};
      }catch(e){message('Endereço do servidor inválido.',true);}
    }else{
      session.remote=false; session.transport=new BroadcastChannel('rpg-legend-'+session.room);
      session.transport.onmessage=function(e){receive(e.data);}; onOpen();
    }
  }
  function connect(create){
    var name=(document.getElementById('multiplayerName').value||'Aventureiro').trim();
    var room=(document.getElementById('multiplayerRoom').value||'').trim().toUpperCase();
    var server=(document.getElementById('multiplayerServer').value||'').trim();
    if(create && !room){room=code(); document.getElementById('multiplayerRoom').value=room;}
    if(!room){message('Digite o código da sala.',true);return;}
    if(typeof BroadcastChannel==='undefined' && !server){message('Este navegador exige o servidor multiplayer.',true);return;}
    session.room=room; session.name=name; session.role=create?1:2; session.turn=1; session.connected=true;
    openTransport(server,function(){
      if(session.remote) send({type:create?'create':'join',name:name,role:session.role});
      else if(!create) send({type:'hello',name:name,role:2});
      message(create?'Sala criada: '+room+'. Envie este código ao parceiro.':'Procurando a sala '+room+'...'); status();
    });
  }
  function commit(){
    if(!session.connected || session.applying || !RPG.state || !RPG.state.hero)return;
    session.turn=session.role===1?2:1;
    send({type:'state',state:snapshot(),turn:session.turn,role:session.role}); status();
  }
  function canAct(){return !session.connected || session.turn===session.role;}
  function guard(e){
    if(!session.connected || canAct())return;
    var target=e.target;
    if(target && (target.closest('#multiplayerModal') || target.closest('#multiplayerStatus')))return;
    var blockedMenuAction=target && (target.id==='btnNewGame' || target.id==='btnContinueGame' || target.id==='startAdventureBtn');
    if(blockedMenuAction || (RPG.state && (RPG.state.screen==='game' || RPG.state.screen==='creation'))){
      e.preventDefault(); e.stopImmediatePropagation(); message('Aguarde a vez do outro jogador.',true);
    }
  }
  function init(){
    var configuredServer=(window.RPG_MULTIPLAYER_CONFIG&&window.RPG_MULTIPLAYER_CONFIG.serverUrl)||'';
    if(configuredServer) document.getElementById('multiplayerServer').value=configuredServer;
    document.getElementById('btnMultiplayer').addEventListener('click',function(){document.getElementById('multiplayerModal').classList.remove('hidden');});
    document.getElementById('closeMultiplayerBtn').addEventListener('click',function(){document.getElementById('multiplayerModal').classList.add('hidden');});
    document.getElementById('createRoomBtn').addEventListener('click',function(){connect(true);});
    document.getElementById('joinRoomBtn').addEventListener('click',function(){connect(false);});
    document.addEventListener('click',guard,true); document.addEventListener('keydown',guard,true);
  }
  RPG.Save.save=function(state){var result=originalSave(state);if(!session.applying)commit();return result;};
  document.addEventListener('DOMContentLoaded',init);
  return {commit:commit,canAct:canAct,session:session};
})();
