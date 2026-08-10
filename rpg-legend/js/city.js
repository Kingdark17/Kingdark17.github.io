/* =========================================================
   RPG Legend - js/city.js
   Geracao da cidade inicial como salas conectadas por portas
   (loja, ferreiro, taverna, quadro de missoes, NPCs e o
   portao da masmorra).
   ========================================================= */
var RPG = window.RPG || {};

RPG.City = (function(){

  var NPC_TEMPLATES = [
    { name:"Velho Ferreiro Bram", role:"Ferreiro", service:'barter', icon:"\ud83d\udd28", lines:[
      "Ah, um aventureiro... Minha forja anda fria, mas ainda faço bons trabalhos.",
      "Cuidado com as galerias mais fundas. Ouvi rugidos vindos de lá ontem à noite.",
      "Se encontrar minério raro por aí, traga para mim. Faço um bom preço."] },
    { name:"Erma, a Vidente", role:"Mística", service:'blessing', icon:"\ud83d\udd2e", lines:[
      "As sombras sussurram seu nome, viajante...",
      "Vejo três caminhos à sua frente: um de ferro, um de fogo e um de silêncio.",
      "Escolha com sabedoria. Nem todo tesouro vale o preço cobrado."] },
    { name:"Capitão Doran", role:"Guarda da Cidade", service:'recruit', icon:"\ud83e\udee1", lines:[
      "Parado! ...Ah, é apenas um aventureiro. Pode passar.",
      "A masmorra fica logo adiante. Já perdemos batedores lá esta semana.",
      "Cada andar que você descer será mais perigoso que o anterior. Vá com cuidado."] }
  ];

  function pickNpc(index){
    var source=NPC_TEMPLATES[index % NPC_TEMPLATES.length];
    return { name:source.name, role:source.role, service:source.service, icon:source.icon, lines:source.lines.slice(), serviceUsed:false };
  }

  // Layout fixo da cidade (mesmo mapa para todos os jogadores, sempre).
  // Coordenadas relativas ao centro da grade 6x6 (start em 3,3).
  var LAYOUT = [
    { x:3, y:3, type:'start' },
    { x:3, y:2, type:'normal' },
    { x:3, y:1, type:'gate' },
    { x:2, y:3, type:'shop' },
    { x:1, y:3, type:'blacksmith' },
    { x:4, y:3, type:'tavern' },
    { x:5, y:3, type:'questboard' },
    { x:3, y:4, type:'npc', npcIndex:0 },
    { x:3, y:5, type:'npc', npcIndex:1 },
    { x:2, y:2, type:'normal' },
    { x:4, y:2, type:'normal' }
  ];
  var LAYOUT_DOORS = [
    [3,3,'N'], [3,2,'N'], [3,3,'W'], [2,3,'W'],
    [3,3,'E'], [4,3,'E'], [3,3,'S'], [3,4,'S'],
    [3,2,'W'], [3,2,'E']
  ];

  function buildFixedGraph(rows, cols){
    var grid = [];
    for(var y=0;y<rows;y++){
      var row = [];
      for(var x=0;x<cols;x++){ row.push({ type:'void', x:x, y:y, doors:{} }); }
      grid.push(row);
    }
    var DIR_VECTORS = { N:{x:0,y:-1}, S:{x:0,y:1}, W:{x:-1,y:0}, E:{x:1,y:0} };
    var DIR_OPP = { N:'S', S:'N', E:'W', W:'E' };
    LAYOUT.forEach(function(spec){
      var cell = grid[spec.y][spec.x];
      cell.type = spec.type;
      if(spec.type === 'npc'){ cell.npc = pickNpc(spec.npcIndex); }
    });
    LAYOUT_DOORS.forEach(function(entry){
      var x=entry[0], y=entry[1], dir=entry[2];
      var v = DIR_VECTORS[dir];
      var cell = grid[y][x];
      var target = grid[y+v.y][x+v.x];
      cell.doors[dir] = true;
      target.doors[DIR_OPP[dir]] = true;
    });
    var rooms = LAYOUT.map(function(spec){ return grid[spec.y][spec.x]; });
    var start = grid[3][3];
    return { grid: grid, rooms: rooms, start: start };
  }

  function generate(state){
    var rows = state.mapRows, cols = state.mapCols;
    var res = buildFixedGraph(rows, cols);

    state.map = res.grid;
    state.mapMode = 'city';
    refreshPresentation();
    return res.start;
  }

  function refreshPresentation(){
    document.getElementById('locationTag').textContent = 'Cidade Inicial';
    RPG.UI.setLegend([
      ['\ud83d\ude80','Início'], ['\ud83e\uddd9','NPC'], ['\ud83c\udff5','Vendedor'],
      ['\ud83d\udd28','Ferreiro'], ['\ud83c\udf7a','Taverna'], ['\ud83d\udcdc','Missões'], ['\ud83c\udf1f','Portão da Masmorra']
    ]);
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
      tavern:'uma taverna', questboard:'um quadro de missões', gate:'o portão da masmorra',
      start:'o ponto de partida', normal:'uma sala vazia' }[cell.type] || 'uma sala';
  }

  function roomDesc(cell){
    return { npc:'Um morador da cidade está por aqui.', shop:'Um vendedor organiza suas mercadorias.',
      blacksmith:'O calor da forja aquece o ar; um ferreiro trabalha o metal.',
      tavern:'Risadas e cheiro de cerveja escapam pela porta entreaberta.',
      questboard:'Um quadro coberto de pergaminhos e anúncios está afixado na parede.',
      gate:'Um portão de pedra antiga marca a entrada da masmorra.',
      start:'Este foi o ponto onde você chegou à cidade.',
      normal:'Uma pracinha tranquila, sem nada de especial.' }[cell.type] || '';
  }

  function entryText(cell){
    if(cell.type==='npc') return 'Você avista '+cell.npc.name+'. Deseja se aproximar e conversar?';
    if(cell.type==='shop') return 'Um vendedor itinerante oferece suas mercadorias. Deseja negociar?';
    if(cell.type==='blacksmith') return 'A forja do ferreiro está acesa. Deseja ver os equipamentos?';
    if(cell.type==='tavern') return 'Uma taverna aconchegante convida a um descanso. Deseja entrar?';
    if(cell.type==='questboard') return 'Um quadro de missões está afixado na parede. Deseja ver os anúncios?';
    if(cell.type==='gate') return 'Um portão misterioso leva à masmorra. Deseja atravessar?';
    return 'Deseja entrar?';
  }

  // Trata a entrada do jogador em uma sala da cidade. Retorna true se tratou.
  function handleEnter(state, cell){
    if(cell.type==='npc'){ RPG.UI.openDialogueWithNPC(cell.npc); return true; }
    if(cell.type==='shop'){ RPG.Shop.open(state, cell, 'shop'); RPG.Effects.playSfx('door'); return true; }
    if(cell.type==='blacksmith'){ RPG.Shop.open(state, cell, 'blacksmith'); RPG.Effects.playSfx('door'); return true; }
    if(cell.type==='tavern'){
      var h = state.hero; h.hp = h.maxHp; h.mp = h.maxMp;
      (state.party||[]).forEach(function(m){ m.hp = m.maxHp; });
      RPG.UI.renderHero();
      RPG.UI.showSimpleDialogue('\ud83c\udf7a','Taverna','Você descansa por uma noite. Vida e mana totalmente restauradas.');
      RPG.UI.logEvent('Você descansou na <b>taverna</b> e recuperou as forças.');
      RPG.Effects.playSfx('gold');
      return true;
    }
    if(cell.type==='questboard'){ RPG.Quests.openBoard(state); RPG.UI.showSimpleDialogue('\ud83d\udcdc','Quadro de Missões','Você lê os anúncios afixados no quadro.'); return true; }
    if(cell.type==='gate'){ RPG.UI.enterDungeon(); return true; }
    if(cell.type==='start'){ RPG.UI.showSimpleDialogue('\ud83d\ude80','Ponto de Partida','Foi aqui que sua jornada começou.'); return true; }
    return false;
  }

  return { generate: generate, refreshPresentation:refreshPresentation, iconFor: iconFor, entryText: entryText, handleEnter: handleEnter, shortLabel: shortLabel, roomDesc: roomDesc };
})();
