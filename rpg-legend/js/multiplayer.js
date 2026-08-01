/* RPG Legend - salas online para dois jogadores. */
var RPG = window.RPG || {};

RPG.Multiplayer = (function(){
  var session={connected:false,room:'',name:'',role:0,turn:1,transport:null,applying:false,players:1,profiles:{},pendingState:null,guestCreating:false};
  var originalSave=RPG.Save.save;

  function code(){var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',out='';for(var i=0;i<6;i++)out+=chars[Math.floor(Math.random()*chars.length)];return out;}
  function message(text,error){var el=document.getElementById('multiplayerMessage');if(el){el.textContent=text;el.style.color=error?'#e28a8a':'var(--parchment-dim)';}}
  function status(){
    var el=document.getElementById('multiplayerStatus');if(!el)return;
    var inCombat=RPG.state&&RPG.state.mode==='combat';
    el.classList.toggle('hidden',!session.connected);
    el.classList.toggle('my-turn',session.connected&&(!inCombat||session.turn===session.role));
    el.classList.toggle('waiting-turn',session.connected&&inCombat&&session.turn!==session.role);
    if(session.connected)el.textContent='Sala '+session.room+' · '+(inCombat?(session.turn===session.role?'SUA VEZ NA BATALHA':'vez do parceiro na batalha'):'EXPLORAÇÃO LIVRE');
  }
  function send(payload){if(session.transport&&session.transport.readyState===1){payload.room=session.room;session.transport.send(JSON.stringify(payload));}}
  function captureProfile(){
    if(!RPG.state||!RPG.state.hero||!session.role)return;
    session.profiles[session.role]={name:session.name,hero:RPG.state.hero,inventory:RPG.state.inventory||[],party:RPG.state.party||[]};
  }
  function snapshot(){
    if(!RPG.state||!RPG.state.hero)return null;captureProfile();var s=RPG.state;
    return {profiles:session.profiles,quests:s.quests,floor:s.floor,mapMode:s.mapMode,map:s.map,mapRows:s.mapRows,mapCols:s.mapCols,pos:s.pos,mode:s.mode,pendingTarget:s.pendingTarget,pendingMonsterPos:s.pendingMonsterCell?{x:s.pendingMonsterCell.x,y:s.pendingMonsterCell.y}:null,soundOn:s.soundOn};
  }
  function mergeProfiles(incoming){Object.keys(incoming||{}).forEach(function(role){session.profiles[role]=incoming[role];});}
  function renderRemote(){
    var s=RPG.state;RPG.UI.showScreen('game');RPG.UI.renderHero();RPG.UI.renderMap();RPG.UI.renderControls();
    if(s.mode==='combat'&&s.pendingMonsterCell){document.getElementById('sceneText').classList.add('hidden');document.getElementById('combatScene').classList.remove('hidden');if(RPG.Combat.refresh)RPG.Combat.refresh(s.pendingMonsterCell);}
    else{document.getElementById('combatScene').classList.add('hidden');document.getElementById('sceneText').classList.remove('hidden');RPG.UI.updateSceneText();}
  }
  function applyState(data){
    if(!data||!data.map)return;session.applying=true;
    mergeProfiles(data.profiles);
    var own=session.profiles[session.role];if(!own){session.pendingState=data;session.applying=false;return;}
    var s=RPG.state;
    ['quests','floor','mapMode','map','mapRows','mapCols','pos','mode','pendingTarget','soundOn'].forEach(function(k){if(data[k]!==undefined)s[k]=data[k];});
    s.hero=own.hero;s.inventory=own.inventory||[];s.party=own.party||[];s.pendingMonsterCell=null;
    if(data.pendingMonsterPos&&s.map[data.pendingMonsterPos.y])s.pendingMonsterCell=s.map[data.pendingMonsterPos.y][data.pendingMonsterPos.x];
    originalSave(s);renderRemote();session.applying=false;
  }
  function beginCharacterCreation(guest){
    session.guestCreating=guest;document.getElementById('multiplayerModal').classList.add('hidden');
    RPG.UI.showScreen('creation');RPG.UI.renderCreationScreen();
  }
  function receive(msg){
    if(!msg||msg.room!==session.room)return;
    if(msg.type==='created'){message('Sala criada: '+session.room+'. Crie seu herói e envie o código ao parceiro.');beginCharacterCreation(false);}
    else if(msg.type==='hello'&&session.role===1){session.players=2;send({type:'welcome',state:snapshot(),profiles:session.profiles,turn:session.turn});status();message(msg.name+' entrou e está criando um personagem.');}
    else if(msg.type==='welcome'&&session.role===2){session.players=2;session.turn=msg.turn||1;mergeProfiles(msg.profiles);session.pendingState=msg.state||null;status();message('Sala encontrada. Agora crie seu personagem.');beginCharacterCreation(true);}
    else if(msg.type==='profile'&&msg.role!==session.role){session.profiles[msg.role]=msg.profile;session.players=2;message(msg.profile.hero.name+' está pronto para jogar.');}
    else if(msg.type==='state'&&msg.role!==session.role){session.turn=msg.turn||session.turn;applyState(msg.state);status();}
    else if(msg.type==='error')message(msg.message||'Erro na sala multiplayer.',true);
    else if(msg.type==='peer-left')message('O outro jogador desconectou.',true);
  }
  function connect(create){
    var server=(window.RPG_MULTIPLAYER_CONFIG&&window.RPG_MULTIPLAYER_CONFIG.serverUrl)||'';
    var name=(document.getElementById('multiplayerName').value||'Aventureiro').trim();
    var room=(document.getElementById('multiplayerRoom').value||'').trim().toUpperCase();
    if(!server){message('O servidor online ainda não foi configurado.',true);return;}
    if(create){room=code();document.getElementById('multiplayerRoom').value=room;}else if(!room){message('Digite o código da sala.',true);return;}
    session.room=room;session.name=name;session.role=create?1:2;session.turn=1;session.connected=true;status();
    try{
      var ws=new WebSocket(server);session.transport=ws;
      ws.onopen=function(){send({type:create?'create':'join',name:name,role:session.role});message(create?'Criando sala...':'Procurando a sala '+room+'...');};
      ws.onmessage=function(e){try{receive(JSON.parse(e.data));}catch(err){}};
      ws.onerror=function(){message('Não foi possível conectar ao servidor.',true);};
      ws.onclose=function(){message('Conexão encerrada.',true);};
    }catch(e){message('Servidor multiplayer inválido.',true);}
  }
  function finishGuestCreation(state){
    session.guestCreating=false;session.profiles[2]={name:session.name,hero:state.hero,inventory:state.inventory||[],party:state.party||[]};
    send({type:'profile',role:2,profile:session.profiles[2]});
    if(session.pendingState){var pending=session.pendingState;session.pendingState=null;pending.profiles=pending.profiles||{};pending.profiles[2]=session.profiles[2];applyState(pending);}
    else{RPG.UI.showScreen('menu');message('Personagem pronto. Aguardando o criador iniciar a aventura.');}
    status();
  }
  function sync(switchCombatTurn){
    if(!session.connected||session.applying||!RPG.state||!RPG.state.hero)return;
    if(switchCombatTurn)session.turn=session.role===1?2:1;
    send({type:'state',state:snapshot(),turn:session.turn,role:session.role});status();
  }
  function commit(){sync(true);}
  function canAct(){return !session.connected||session.turn===session.role;}
  function grantSharedXP(amount){
    if(!session.connected)return;
    Object.keys(session.profiles).forEach(function(role){
      if(parseInt(role,10)===session.role)return;
      var profile=session.profiles[role];
      if(profile&&profile.hero)RPG.Player.gainXP(profile.hero,amount);
    });
  }
  function grantSharedGold(amount){
    if(!session.connected)return;
    Object.keys(session.profiles).forEach(function(role){
      if(parseInt(role,10)===session.role)return;
      var profile=session.profiles[role];
      if(profile&&profile.hero)profile.hero.gold=(profile.hero.gold||0)+amount;
    });
  }
  function guard(e){
    if(!session.connected||!RPG.state||RPG.state.mode!=='combat'||canAct())return;var target=e.target;
    if(target&&(target.closest('#multiplayerModal')||target.closest('#multiplayerStatus')))return;
    if(session.guestCreating)return;
    if(RPG.state.screen==='game'){e.preventDefault();e.stopImmediatePropagation();message('Aguarde a vez do outro jogador na batalha.',true);}
  }
  function init(){
    document.getElementById('btnMultiplayer').addEventListener('click',function(){document.getElementById('multiplayerModal').classList.remove('hidden');});
    document.getElementById('closeMultiplayerBtn').addEventListener('click',function(){document.getElementById('multiplayerModal').classList.add('hidden');});
    document.getElementById('createRoomBtn').addEventListener('click',function(){connect(true);});
    document.getElementById('joinRoomBtn').addEventListener('click',function(){connect(false);});
    document.addEventListener('click',guard,true);document.addEventListener('keydown',guard,true);
  }
  RPG.Save.save=function(state){var result=originalSave(state);if(!session.applying)sync(false);return result;};
  document.addEventListener('DOMContentLoaded',init);
  return {commit:commit,sync:function(){sync(false);},canAct:canAct,grantSharedXP:grantSharedXP,grantSharedGold:grantSharedGold,isGuestCreating:function(){return session.guestCreating;},finishGuestCreation:finishGuestCreation,session:session};
})();
