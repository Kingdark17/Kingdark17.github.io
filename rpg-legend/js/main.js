/* =========================================================
   RPG Legend - js/main.js
   Ponto de entrada: cria o estado global, liga o menu
   principal (Novo Jogo / Continuar / Configuracoes /
   Creditos / Sair) e conecta os binds dos outros modulos.
   ========================================================= */
var RPG = window.RPG || {};

document.addEventListener('DOMContentLoaded', function(){

  // ---------- estado global ----------
  RPG.state = {
    screen: 'menu',
    hero: null,
    party: [],
    inventory: [],
    map: [], mapRows: 8, mapCols: 10, mapMode: 'city', floor: 1,
    pos: { x:0, y:0 }, facing: 'down', mode: 'move',
    pendingTarget: null, pendingMonsterCell: null,
    quests: [],
    soundOn: true
  };

  // pre-renderiza a tela de criacao (ela fica oculta ate ser usada)
  RPG.UI.renderCreationScreen();

  // liga os controles compartilhados definidos em ui.js
  RPG.UI.bindKeyboard();
  RPG.UI.bindBackpack();
  RPG.UI.bindMerchantModal();
  RPG.UI.bindQuestModal();
  RPG.UI.bindDialogueControls();

  document.getElementById('startAdventureBtn').addEventListener('click', RPG.UI.startAdventure);

  // botao no cabecalho, disponivel durante o jogo, volta para a criacao
  document.getElementById('newHeroBtn').addEventListener('click', function(){
    RPG.Save.clear();
    RPG.UI.showScreen('creation');
    RPG.UI.renderCreationScreen();
  });

  /* ================= MENU PRINCIPAL ================= */
  function refreshContinueButton(){
    document.getElementById('btnContinueGame').disabled = !RPG.Save.hasSave();
  }
  refreshContinueButton();

  document.getElementById('btnNewGame').addEventListener('click', function(){
    RPG.Save.clear();
    RPG.UI.showScreen('creation');
    RPG.UI.renderCreationScreen();
  });

  document.getElementById('btnContinueGame').addEventListener('click', function(){
    var data = RPG.Save.load();
    if(!data || !data.hero) return;
    var state = RPG.state;
    state.hero = data.hero;
    state.party = data.party || [];
    state.inventory = data.inventory || [];
    state.quests = data.quests || [];
    state.floor = data.floor || 1;
    state.mapMode = data.mapMode || 'city';
    state.soundOn = data.soundOn !== undefined ? data.soundOn : true;
    document.getElementById('soundToggle').checked = state.soundOn;

    RPG.UI.showScreen('game');
    RPG.Combat.buildDiceRow();
    document.getElementById('rollLog').innerHTML = '';
    document.getElementById('rollDie').textContent = '-';
    document.getElementById('rollDie').className = 'roll-die';
    document.getElementById('rollInfo').textContent = 'Escolha um dado para rolar.';
    document.getElementById('logList').innerHTML = '';
    RPG.UI.renderHero();

    // regenera o local salvo sem resetar o andar (enterDungeon/enterCity
    // sempre comecam do andar 1, entao aqui chamamos os geradores direto)
    var startCell = (state.mapMode === 'dungeon') ? RPG.Dungeon.generate(state) : RPG.City.generate(state);
    RPG.UI.resetPlayerToStart(startCell);
    document.getElementById('combatScene').classList.add('hidden');
    document.getElementById('mapGrid').classList.remove('hidden');
    RPG.UI.renderMap();
    RPG.UI.renderControls();
    RPG.UI.resetDialogue();
    RPG.UI.logEvent('Bem-vindo de volta, <b>'+state.hero.name+'</b>! Continuando de onde parou.');
  });

  document.getElementById('btnSettings').addEventListener('click', function(){
    document.getElementById('soundToggle').checked = RPG.state.soundOn;
    RPG.UI.showScreen('settings');
  });
  document.getElementById('btnCredits').addEventListener('click', function(){
    RPG.UI.showScreen('credits');
  });
  document.getElementById('settingsBackBtn').addEventListener('click', function(){ RPG.UI.showScreen('menu'); });
  document.getElementById('creditsBackBtn').addEventListener('click', function(){ RPG.UI.showScreen('menu'); });

  document.getElementById('soundToggle').addEventListener('change', function(e){
    RPG.state.soundOn = e.target.checked;
    if(RPG.state.hero){ RPG.Save.save(RPG.state); }
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
