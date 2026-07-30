/* =========================================================
   RPG Legend - js/city.js
   Geracao da cidade inicial como salas conectadas por portas
   (loja, ferreiro, taverna, quadro de missoes, NPCs e o
   portao da masmorra).
   ========================================================= */
var RPG = window.RPG || {};

RPG.City = (function(){

  var NPC_TEMPLATES = [
    { name:"Velho Ferreiro Bram", role:"Ferreiro", icon:"\ud83d\udd28", lines:[
      "Ah, um aventureiro... Minha forja anda fria, mas ainda faco bons trabalhos.",
      "Cuidado com as galerias mais fundas. Ouvi rugidos vindos de la ontem a noite.",
      "Se encontrar minerio raro por ai, traga para mim. Faco um bom preco."] },
    { name:"Erma, a Vidente", role:"Mistica", icon:"\ud83d\udd2e", lines:[
      "As sombras sussurram seu nome, viajante...",
      "Vejo tres caminhos a sua frente: um de ferro, um de fogo, e um de silencio.",
      "Escolha com sabedoria. Nem todo tesouro vale o preco cobrado."] },
    { name:"Capitao Doran", role:"Guarda da Cidade", icon:"\ud83e\udee1", lines:[
      "Parado! ...Ah, e apenas um aventureiro. Pode passar.",
      "A masmorra fica logo adiante. Ja perdemos batedores la esta semana.",
      "Cada andar que voce descer sera mais perigoso que o anterior. Va com cuidado."] }
  ];

  function pickNpc(){ return NPC_TEMPLATES[Math.floor(Math.random()*NPC_TEMPLATES.length)]; }

  function generate(state){
    var rows = state.mapRows, cols = state.mapCols;
    var res = RPG.MapUtil.generateRoomGraph(rows, cols, 11);
    var pool = res.rooms.slice(1).sort(function(){ return Math.random()-0.5; });
    function place(type, count){ for(var i=0;i<count && pool.length;i++){ pool.pop().type = type; } }
    place('npc', 2);
    place('shop', 1);
    place('blacksmith', 1);
    place('tavern', 1);
    place('questboard', 1);
    if(pool.length){ pool.pop().type = 'gate'; }

    res.rooms.forEach(function(cell){
      if(cell.type === 'npc'){ cell.npc = pickNpc(); }
    });

    state.map = res.grid;
    state.mapMode = 'city';
    document.getElementById('locationTag').textContent = 'Cidade Inicial';
    RPG.UI.setLegend([
      ['\ud83d\ude80','Inicio'], ['\ud83e\uddd9','NPC'], ['\ud83c\udff5','Vendedor'],
      ['\ud83d\udd28','Ferreiro'], ['\ud83c\udf7a','Taverna'], ['\ud83d\udcdc','Missoes'], ['\ud83c\udf1f','Portao da Masmorra']
    ]);
    return res.start;
  }

  function iconFor(cell){
    if(cell.type==='npc') return '\ud83e\uddd9';
    if(cell.type==='shop') return '\ud83c\udff5';
    if(cell.type==='blacksmith') return '\ud83d\udd28';
    if(cell.type==='tavern') return '\ud83c\udf7a';
    if(cell.type==='questboard') return '\ud83d\udcdc';
    if(cell.type==='gate') return '\ud83c\udf1f';
    if(cell.type==='start') return '\ud83d\ude80';
    return '';
  }

  function shortLabel(cell){
    return { npc:'um NPC', shop:'uma loja', blacksmith:'a forja de um ferreiro',
      tavern:'uma taverna', questboard:'um quadro de missoes', gate:'o portao da masmorra',
      start:'o ponto de partida', normal:'uma sala vazia' }[cell.type] || 'uma sala';
  }

  function roomDesc(cell){
    return { npc:'Um morador da cidade esta por aqui.', shop:'Um vendedor organiza suas mercadorias.',
      blacksmith:'O calor da forja aquece o ar; um ferreiro trabalha o metal.',
      tavern:'Risadas e cheiro de cerveja escapam pela porta entreaberta.',
      questboard:'Um quadro coberto de pergaminhos e anuncios esta afixado na parede.',
      gate:'Um portao de pedra antiga marca a entrada da masmorra.',
      start:'Este foi o ponto onde voce chegou a cidade.',
      normal:'Uma pracinha tranquila, sem nada de especial.' }[cell.type] || '';
  }

  function entryText(cell){
    if(cell.type==='npc') return 'Voce avista '+cell.npc.name+'. Deseja se aproximar e conversar?';
    if(cell.type==='shop') return 'Um vendedor itinerante oferece suas mercadorias. Deseja negociar?';
    if(cell.type==='blacksmith') return 'A forja do ferreiro esta acesa. Deseja ver os equipamentos?';
    if(cell.type==='tavern') return 'Uma taverna aconchegante convida a um descanso. Deseja entrar?';
    if(cell.type==='questboard') return 'Um quadro de missoes esta afixado na parede. Deseja ver os anuncios?';
    if(cell.type==='gate') return 'Um portao misterioso leva a masmorra. Deseja atravessar?';
    return 'Deseja entrar?';
  }

  // Trata a entrada do jogador em uma sala da cidade. Retorna true se tratou.
  function handleEnter(state, cell){
    if(cell.type==='npc'){ RPG.UI.openDialogueWithNPC(cell.npc); return true; }
    if(cell.type==='shop'){ RPG.Shop.open(state, cell, 'shop'); RPG.Effects.playSfx('door'); return true; }
    if(cell.type==='blacksmith'){ RPG.Shop.open(state, cell, 'blacksmith'); RPG.Effects.playSfx('door'); return true; }
    if(cell.type==='tavern'){
      var h = state.hero; h.hp = h.maxHp; h.mp = h.maxMp; RPG.UI.renderHero();
      RPG.UI.showSimpleDialogue('\ud83c\udf7a','Taverna','Voce descansa por uma noite. Vida e mana totalmente restauradas.');
      RPG.UI.logEvent('Voce descansou na <b>taverna</b> e recuperou as forcas.');
      RPG.Effects.playSfx('gold');
      return true;
    }
    if(cell.type==='questboard'){ RPG.Quests.openBoard(state); RPG.UI.showSimpleDialogue('\ud83d\udcdc','Quadro de Missoes','Voce le os anuncios afixados no quadro.'); return true; }
    if(cell.type==='gate'){ RPG.UI.enterDungeon(); return true; }
    if(cell.type==='start'){ RPG.UI.showSimpleDialogue('\ud83d\ude80','Ponto de Partida','Foi aqui que sua jornada comecou.'); return true; }
    return false;
  }

  return { generate: generate, iconFor: iconFor, entryText: entryText, handleEnter: handleEnter, shortLabel: shortLabel, roomDesc: roomDesc };
})();
