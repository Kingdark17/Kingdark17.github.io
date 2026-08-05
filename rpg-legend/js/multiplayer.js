/* RPG Legend - salas online para dois jogadores. */
var RPG = window.RPG || {};

RPG.Multiplayer = (function(){
  var session={connected:false,room:'',name:'',role:0,turn:1,transport:null,applying:false,applyingAction:false,players:1,profiles:{},pendingState:null,guestCreating:false,moveLockedUntil:0};
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
  function accountProfile(){var user=RPG.Account&&RPG.Account.currentUser?RPG.Account.currentUser():null;return user?{username:user.username,avatarUrl:user.avatarUrl||'',frame:user.frame||'none',nameColor:user.nameColor||'#e8d7a5',pet:user.pet||'none'}:null;}
  function captureProfile(){
    if(!RPG.state||!RPG.state.hero||!session.role)return;
    session.profiles[session.role]={name:session.name,publicProfile:accountProfile(),hero:RPG.state.hero,inventory:RPG.state.inventory||[],party:RPG.state.party||[]};
    renderProfiles();
  }
  function openPublicProfile(profile){var info=profile&&profile.publicProfile||{},modal=document.getElementById('publicProfileModal'),card=document.getElementById('publicProfileCard'),avatar=document.getElementById('publicProfileAvatar'),name=document.getElementById('publicProfileName'),pet=document.getElementById('publicProfilePet');name.textContent=info.username||(profile&&profile.hero&&profile.hero.name)||profile.name||'Aventureiro';name.classList.toggle('rgb-name',info.nameColor==='rainbow');name.style.color=info.nameColor==='rainbow'?'':(info.nameColor||'#e8d7a5');card.setAttribute('data-frame',info.frame||'none');avatar.classList.toggle('hidden',!info.avatarUrl);if(info.avatarUrl)avatar.src=info.avatarUrl;pet.textContent=info.pet&&info.pet!=='none'?(RPG.Pets?RPG.Pets.icon(info.pet):'🐾')+' Pet equipado: '+info.pet:'Nenhum pet equipado.';modal.classList.remove('hidden');}
  function renderProfiles(){var list=document.getElementById('multiplayerProfiles');if(!list)return;list.innerHTML='';Object.keys(session.profiles).forEach(function(role){var profile=session.profiles[role],info=profile.publicProfile||{},card=document.createElement('button');card.type='button';card.className='item-card rune-btn ghost';card.textContent=(info.pet&&info.pet!=='none'&&RPG.Pets?RPG.Pets.icon(info.pet)+' ':'')+(info.username||(profile.hero&&profile.hero.name)||profile.name||'Jogador')+(parseInt(role,10)===session.role?' (você)':'');card.classList.toggle('rgb-name',info.nameColor==='rainbow');card.style.color=info.nameColor==='rainbow'?'':(info.nameColor||'');card.onclick=function(){openPublicProfile(profile);};list.appendChild(card);});}
  function snapshot(){
    if(!RPG.state||!RPG.state.hero)return null;captureProfile();var s=RPG.state;
    return {profiles:session.profiles,quests:s.quests,floor:s.floor,mapMode:s.mapMode,map:s.map,mapRows:s.mapRows,mapCols:s.mapCols,pos:s.pos,mode:s.mode,pendingTarget:s.pendingTarget,pendingMonsterPos:s.pendingMonsterCell?{x:s.pendingMonsterCell.x,y:s.pendingMonsterCell.y}:null,soundOn:s.soundOn};
  }
  function mergeProfiles(incoming){Object.keys(incoming||{}).forEach(function(role){session.profiles[role]=incoming[role];});renderProfiles();}
  function renderRemote(){
    var s=RPG.state;RPG.UI.showScreen('game');RPG.UI.renderHero();RPG.UI.renderMap();RPG.UI.renderControls();
    if(!document.getElementById('merchantModal').classList.contains('hidden')&&RPG.Shop.refresh)RPG.Shop.refresh(s);
    if(!document.getElementById('questModal').classList.contains('hidden'))RPG.Quests.renderBoard(s);
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
    else if(msg.type==='profile'&&msg.role!==session.role){session.profiles[msg.role]=msg.profile;session.players=2;renderProfiles();message(msg.profile.hero.name+' está pronto para jogar.');}
    else if(msg.type==='profile-accepted'&&msg.role===session.role){session.profiles[msg.role]=msg.profile;renderProfiles();}
    else if(msg.type==='authoritative'&&msg.role===session.role){session.turn=msg.turn||session.turn;applyState(msg.state);status();}
    else if(msg.type==='state'&&msg.role!==session.role){
      var oldPos=RPG.state&&RPG.state.pos?{x:RPG.state.pos.x,y:RPG.state.pos.y}:null;
      session.turn=msg.turn||session.turn;applyState(msg.state);status();
      if(oldPos&&msg.state&&msg.state.pos&&(oldPos.x!==msg.state.pos.x||oldPos.y!==msg.state.pos.y)){
        var dx=msg.state.pos.x-oldPos.x,dy=msg.state.pos.y-oldPos.y;
        var direction=dy<0?'Norte':(dy>0?'Sul':(dx>0?'Leste':'Oeste'));
        var mover=(session.profiles[msg.role]&&session.profiles[msg.role].hero&&session.profiles[msg.role].hero.name)||'Seu parceiro';
        RPG.UI.logEvent('<b>'+mover+'</b> conduziu o grupo para '+direction+'.');
      }
    }
    else if(msg.type==='move-lock'&&msg.role!==session.role){session.moveLockedUntil=Math.max(session.moveLockedUntil,Date.now()+700);}
    else if(msg.type==='ui-action'&&msg.role!==session.role){
      session.applyingAction=true;
      var action=msg.action||{},payload=msg.payload||{},cell=payload.x!=null&&RPG.state.map[payload.y]?RPG.state.map[payload.y][payload.x]:null;
      if(action==='shop'&&cell)RPG.Shop.open(RPG.state,cell,payload.kind||'shop');
      else if(action==='npc'&&payload.npc)RPG.UI.openDialogueWithNPC(payload.npc);
      else if(action==='simple')RPG.UI.showSimpleDialogue(payload.icon,payload.title,payload.text);
      else if(action==='event'&&cell)RPG.Events.open(RPG.state,cell);
      else if(action==='questboard')RPG.Quests.openBoard(RPG.state);
      else if(action==='encounter'&&cell)RPG.Combat.startEncounterChoice(cell);
      session.applyingAction=false;
    }
    else if(msg.type==='team-heal'&&msg.role!==session.role){
      var heal=Math.max(0,Math.min(500,Math.floor(msg.amount||0)));
      if(RPG.state.hero){RPG.state.hero.hp=Math.min(RPG.state.hero.maxHp,RPG.state.hero.hp+heal);(RPG.state.party||[]).forEach(function(member){member.hp=Math.min(member.maxHp,member.hp+Math.round(heal*.7));});RPG.UI.renderHero();RPG.Save.save(RPG.state);RPG.UI.logEvent('O poder de cura do parceiro restaura '+heal+' de Vida.');}
    }
    else if(msg.type==='boss-advance'&&session.role===1){RPG.Combat.advanceAfterBoss(String(msg.bossName||'o chefe'));}
    else if(msg.type==='error')message(msg.message||'Erro na sala multiplayer.',true);
    else if(msg.type==='peer-left')message('O outro jogador desconectou.',true);
  }
  async function connect(create){
    if(RPG.Save&&RPG.Save.isImportedBackup&&RPG.Save.isImportedBackup()){message('Backups importados são apenas offline. Carregue o progresso oficial da conta ou inicie um novo jogo para entrar no multiplayer.',true);return;}
    if(!RPG.Account||!RPG.Account.isReady()||!RPG.Account.currentUser()){message('Entre em uma conta e aguarde o progresso da nuvem para acessar o multiplayer.',true);return;}
    if(RPG.Save.hasSave()&&!(await RPG.Account.verifyOfficial())){message('Este progresso não possui uma assinatura oficial válida. Abra a Conta e carregue o progresso da nuvem.',true);return;}
    var server=(window.RPG_MULTIPLAYER_CONFIG&&window.RPG_MULTIPLAYER_CONFIG.serverUrl)||'';
    var name=(document.getElementById('multiplayerName').value||'Aventureiro').trim();
    var room=(document.getElementById('multiplayerRoom').value||'').trim().toUpperCase();
    if(!server){message('O servidor online ainda não foi configurado.',true);return;}
    if(create){room=code();document.getElementById('multiplayerRoom').value=room;}else if(!room){message('Digite o código da sala.',true);return;}
    session.room=room;session.name=name;session.role=create?1:2;session.turn=1;session.connected=true;status();
    try{
      var ws=new WebSocket(server);session.transport=ws;
      ws.onopen=function(){send({type:create?'create':'join',name:name,role:session.role,accountToken:(RPG.Account&&RPG.Account.token?RPG.Account.token():'')});message(create?'Criando sala...':'Procurando a sala '+room+'...');};
      ws.onmessage=function(e){try{receive(JSON.parse(e.data));}catch(err){}};
      ws.onerror=function(){message('Não foi possível conectar ao servidor.',true);};
      ws.onclose=function(){message('Conexão encerrada.',true);};
    }catch(e){message('Servidor multiplayer inválido.',true);}
  }
  function finishGuestCreation(state){
    session.guestCreating=false;session.profiles[2]={name:session.name,publicProfile:accountProfile(),hero:state.hero,inventory:state.inventory||[],party:state.party||[]};
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
  function broadcastAction(action,payload){if(session.connected&&!session.applyingAction)send({type:'ui-action',action:action,payload:payload||{}});}
  function healTeam(amount){if(session.connected)send({type:'team-heal',amount:Math.max(0,Math.floor(amount||0))});}
  function requestBossAdvance(name){if(session.connected)send({type:'boss-advance-request',bossName:String(name||'o chefe').slice(0,80)});}
  function disconnect(){
    if(session.transport){try{session.transport.close();}catch(e){}}
    session.connected=false;session.transport=null;session.room='';session.role=0;session.players=1;session.profiles={};session.pendingState=null;session.guestCreating=false;
    status();
  }
  function canAct(){return !session.connected||session.turn===session.role;}
  function beginMove(){
    if(!session.connected)return true;
    if(session.role!==1){message('O dono da sala guia a exploração. Você participa das interações e batalhas.',true);return false;}
    if(Date.now()<session.moveLockedUntil){message('O grupo já está se movimentando.',true);return false;}
    session.moveLockedUntil=Date.now()+700;
    send({type:'move-lock',role:session.role});
    return true;
  }
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
    document.getElementById('closePublicProfileBtn').addEventListener('click',function(){document.getElementById('publicProfileModal').classList.add('hidden');});
    document.addEventListener('click',guard,true);document.addEventListener('keydown',guard,true);
  }
  RPG.Save.save=function(state){var result=originalSave(state);if(!session.applying)sync(false);return result;};
  document.addEventListener('DOMContentLoaded',init);
  return {commit:commit,sync:function(){sync(false);},disconnect:disconnect,broadcastAction:broadcastAction,healTeam:healTeam,requestBossAdvance:requestBossAdvance,canAct:canAct,beginMove:beginMove,grantSharedXP:grantSharedXP,grantSharedGold:grantSharedGold,isGuestCreating:function(){return session.guestCreating;},finishGuestCreation:finishGuestCreation,session:session};
})();
