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

  // botao no cabecalho, disponivel durante o jogo, volta para a criacao
  document.getElementById('newHeroBtn').addEventListener('click', async function(){
    if(!RPG.Account||!RPG.Account.currentUser())return;
    if(!window.confirm('Criar outro personagem apagará o personagem atual desta conta. Deseja continuar?'))return;
    if(!(await RPG.Account.resetCloud()))return;
    RPG.Save.clear();
    RPG.UI.showScreen('creation');
    RPG.UI.renderCreationScreen();
  });

  /* ================= MENU PRINCIPAL ================= */
  function requireOnlineAccount(){
    if(!RPG.Account||!RPG.Account.isReady()||!RPG.Account.currentUser()){if(RPG.Account)RPG.Account.open('Entre ou crie uma conta para jogar. O progresso agora é salvo somente na nuvem.');return false;}
    return true;
  }
  function refreshContinueButton(){
    var online=RPG.Account&&RPG.Account.isReady()&&RPG.Account.currentUser();
    document.getElementById('btnNewGame').disabled=!online;
    document.getElementById('btnContinueGame').disabled = !(online&&RPG.Account.hasCloudSave()&&RPG.Save.hasSave());
  }
  refreshContinueButton();
  document.addEventListener('rpg-account-ready',refreshContinueButton);
  document.addEventListener('rpg-cloud-save-ready',refreshContinueButton);

  document.getElementById('btnPlayTab').addEventListener('click',function(){
    var menu=document.getElementById('menuScreen'),collapsed=menu.classList.toggle('sidebar-collapsed');
    this.setAttribute('aria-expanded',collapsed?'false':'true');
  });

  document.getElementById('btnNewGame').addEventListener('click', async function(){
    if(!requireOnlineAccount())return;
    if(RPG.Account.hasCloudSave()&&!window.confirm('Criar um novo personagem substituirá o personagem atual desta conta após o primeiro salvamento. Deseja continuar?'))return;
    if(RPG.Account.hasCloudSave()&&!(await RPG.Account.resetCloud()))return;
    RPG.Save.clear();
    RPG.UI.showScreen('creation');
    RPG.UI.renderCreationScreen();
  });

  document.getElementById('btnContinueGame').addEventListener('click', function(){
    if(!requireOnlineAccount()||!RPG.Account.hasCloudSave())return;
    RPG.UI.resumeSavedGame(RPG.Save.load());
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
    refreshContinueButton();
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

  refreshContinueButton();
  RPG.UI.showScreen('menu');
});
