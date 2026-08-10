/* =========================================================
   RPG Legend - js/main.js
   Ponto de entrada: cria o estado global, liga o menu
   principal (Novo Jogo / Continuar / Configuracoes /
   Creditos / Sair) e conecta os binds dos outros modulos.
   ========================================================= */
var RPG = window.RPG || {};

document.addEventListener('DOMContentLoaded', function(){
  var settingsReturnScreen='menu';

  // ---------- estado global ----------
  RPG.state = {
    screen: 'menu',
    hero: null,
    party: [],
    inventory: [],
    map: [], mapRows: 6, mapCols: 6, mapMode: 'city', floor: 1,
    pos: { x:0, y:0 }, mode: 'move',
    pendingTarget: null, pendingMonsterCell: null,
    quests: [],
    soundOn: true,
    musicVolume: 0.28
  };
  RPG.state.tutorial=RPG.Tutorial.create(true);

  // pre-renderiza a tela de criacao (ela fica oculta ate ser usada)
  RPG.UI.renderCreationScreen();

  // liga os controles compartilhados definidos em ui.js
  RPG.UI.bindKeyboard();
  RPG.UI.bindBackpack();
  RPG.UI.bindMerchantModal();
  RPG.UI.bindQuestModal();
  RPG.UI.bindDialogueControls();
  RPG.Tutorial.bind();

  document.getElementById('startAdventureBtn').addEventListener('click', RPG.UI.startAdventure);

  /* ================= MENU PRINCIPAL ================= */
  function requireOnlineAccount(){
    if(!RPG.Account||!RPG.Account.isReady()||!RPG.Account.currentUser()){if(RPG.Account)RPG.Account.open('Entre ou crie uma conta para jogar. O progresso agora é salvo somente na nuvem.');return false;}
    return true;
  }
  function refreshMenuButtons(){
    var online=RPG.Account&&RPG.Account.isReady()&&RPG.Account.currentUser();
    document.getElementById('btnCharacters').disabled=!online;
  }
  refreshMenuButtons();
  document.addEventListener('rpg-account-ready',refreshMenuButtons);

  document.getElementById('btnPlayTab').addEventListener('click',function(){
    var menu=document.getElementById('menuScreen'),collapsed=menu.classList.toggle('sidebar-collapsed');
    this.setAttribute('aria-expanded',collapsed?'false':'true');
  });

  /* ================= PERSONAGENS (slots) ================= */
  function escapeHtmlLocal(text){ return String(text||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function characterModalMessage(text){ document.getElementById('characterModalMessage').textContent=text||''; }
  function renderCharacterSlots(){
    var container=document.getElementById('characterSlots');
    container.innerHTML='';
    var chars=RPG.Account.characters(), max=RPG.Account.maxSlots();
    for(var slot=1; slot<=max; slot++){
      var found=chars.filter(function(c){ return c.slot===slot; })[0];
      var card=document.createElement('div');
      card.className='character-slot'+(found?' filled':'');
      if(found){
        card.innerHTML=
          '<div class="character-slot-head"><span class="character-slot-icon">'+(found.raceIcon||'🧑')+'</span>'+
          '<div><div class="character-slot-name">'+escapeHtmlLocal(found.name||'Aventureiro')+'</div>'+
          '<div class="character-slot-sub">'+(found.classIcon||'')+' '+escapeHtmlLocal(found.className||'')+'</div></div></div>'+
          '<div class="character-slot-meta">Nível '+(found.level||1)+' · Andar '+(found.floor||1)+'</div>'+
          '<div class="character-slot-actions">'+
            '<button class="rune-btn small" data-action="play" data-slot="'+slot+'">Jogar</button>'+
            '<button class="rune-btn ghost small" data-action="delete" data-slot="'+slot+'">Excluir</button>'+
          '</div>';
      }else{
        card.innerHTML=
          '<div class="character-slot-empty">Slot vazio</div>'+
          '<div class="character-slot-actions"><button class="rune-btn small" data-action="create" data-slot="'+slot+'">Criar Personagem</button></div>';
      }
      container.appendChild(card);
    }
    Array.prototype.forEach.call(container.querySelectorAll('button[data-action]'), function(btn){
      btn.addEventListener('click', function(){
        var slot=Number(btn.getAttribute('data-slot')), action=btn.getAttribute('data-action');
        if(action==='play') playCharacter(slot);
        else if(action==='create') createCharacterInSlot(slot);
        else if(action==='delete') deleteCharacterInSlot(slot);
      });
    });
  }
  async function openCharacterModal(){
    if(!requireOnlineAccount())return;
    characterModalMessage('Carregando personagens…');
    document.getElementById('characterModal').classList.remove('hidden');
    await RPG.Account.refreshCharacters();
    characterModalMessage('');
    renderCharacterSlots();
  }
  async function playCharacter(slot){
    characterModalMessage('Carregando…');
    var data=await RPG.Account.loadCharacterSave(slot);
    if(!data){ characterModalMessage('Não foi possível carregar esse personagem.'); return; }
    document.getElementById('characterModal').classList.add('hidden');
    RPG.UI.resumeSavedGame(data);
  }
  function createCharacterInSlot(slot){
    document.getElementById('characterModal').classList.add('hidden');
    RPG.state.slot=slot;
    RPG.UI.showScreen('creation');
    RPG.UI.renderCreationScreen();
  }
  async function deleteCharacterInSlot(slot){
    if(!window.confirm('Excluir esse personagem para sempre? Essa ação não pode ser desfeita.'))return;
    characterModalMessage('Excluindo…');
    var ok=await RPG.Account.resetCloud(slot);
    if(RPG.state.slot===slot){ RPG.Save.clear(); RPG.state.hero=null; }
    await RPG.Account.refreshCharacters();
    characterModalMessage(ok?'':'Não foi possível excluir esse personagem.');
    renderCharacterSlots();
  }
  document.getElementById('btnCharacters').addEventListener('click', openCharacterModal);
  document.getElementById('closeCharacterModalBtn').addEventListener('click', function(){ document.getElementById('characterModal').classList.add('hidden'); });

  // botao no cabecalho, disponivel durante o jogo: salva o progresso atual
  // e abre o gerenciador de personagens pra trocar ou criar outro.
  document.getElementById('newHeroBtn').addEventListener('click', async function(){
    if(!RPG.Account||!RPG.Account.currentUser())return;
    RPG.Save.save(RPG.state);
    await openCharacterModal();
  });

  document.getElementById('btnSettings').addEventListener('click', function(){
    settingsReturnScreen='menu';
    document.getElementById('soundToggle').checked = RPG.state.soundOn;
    RPG.UI.showScreen('settings');
  });
  document.getElementById('gameSettingsBtn').addEventListener('click', function(){
    settingsReturnScreen='game';
    document.getElementById('soundToggle').checked=RPG.state.soundOn;
    RPG.Save.save(RPG.state);
    RPG.UI.showScreen('settings');
  });
  document.getElementById('gameMainMenuBtn').addEventListener('click', function(){
    RPG.Save.save(RPG.state);
    if(RPG.Multiplayer&&RPG.Multiplayer.disconnect)RPG.Multiplayer.disconnect();
    refreshMenuButtons();
    RPG.UI.showScreen('menu');
  });
  document.getElementById('btnCredits').addEventListener('click', function(){
    RPG.UI.showScreen('credits');
  });
  document.getElementById('settingsBackBtn').addEventListener('click', function(){ RPG.UI.showScreen(settingsReturnScreen); });
  document.getElementById('creditsBackBtn').addEventListener('click', function(){ RPG.UI.showScreen('menu'); });

  document.getElementById('soundToggle').addEventListener('change', function(e){
    RPG.state.soundOn = e.target.checked;
    if(RPG.Music)RPG.Music.refresh();
    if(RPG.state.hero){ RPG.Save.save(RPG.state); }
  });
  document.getElementById('musicVolume').addEventListener('input',function(e){
    RPG.state.musicVolume=Math.max(0,Math.min(1,Number(e.target.value)/100));
    if(RPG.Music)RPG.Music.refresh();
    if(RPG.state.hero)RPG.Save.save(RPG.state);
  });

  document.getElementById('btnExitGame').addEventListener('click', function(){
    var note = document.getElementById('exitNote');
    try{ window.close(); }catch(e){}
    // a maioria dos navegadores bloqueia o fechamento de abas nao abertas por script;
    // nesse caso avisamos que e seguro fechar manualmente.
    note.classList.remove('hidden');
  });

  refreshMenuButtons();
  RPG.UI.showScreen('menu');
});
