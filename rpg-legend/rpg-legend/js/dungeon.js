/* =========================================================
   RPG Legend - js/dungeon.js
   Geracao de cada andar da masmorra: mais monstros e mais
   fortes a cada nivel, chefes a cada 5/10 andares, escadas.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Dungeon = (function(){

  var NPC_TEMPLATES = [
    { name:"Erma, a Vidente", role:"Mistica Errante", icon:"\ud83d\udd2e", lines:[
      "Voce se aventura fundo demais, ou nao o bastante o suficiente...",
      "Os corredores mudam quando ninguem observa.",
      "Cuidado com o que dorme nas profundezas."] },
    { name:"Prisioneiro Esquecido", role:"Sobrevivente", icon:"\ud83e\uddcd", lines:[
      "Voce... voce e real? Ha quanto tempo estou aqui...",
      "Os monstros ficam mais fortes quanto mais fundo voce vai. Tome cuidado.",
      "Se encontrar a saida, corra e nao olhe para tras."] }
  ];

  function isBossFloor(floor){ return floor % 5 === 0; }

  function generate(state){
    var rows = state.mapRows, cols = state.mapCols;
    var floor = state.floor;
    var res = RPG.MapUtil.carveWalk(rows, cols, 0.45);
    var grid = res.grid, floorCells = res.floorCells;
    floorCells[0].type = 'start';

    var pool = floorCells.slice(1).sort(function(){ return Math.random()-0.5; });
    function place(type, count){ for(var i=0;i<count && pool.length;i++){ pool.pop().type = type; } }

    place('npc', 1 + (Math.random()<0.5?1:0));
    place('treasure', 2 + Math.min(3, Math.floor(floor/3)));

    var monsterCount = 3 + (floor-1)*2; // mais inimigos a cada andar
    if(isBossFloor(floor)){ monsterCount = Math.max(2, monsterCount - 2); place('boss', 1); }
    place('monster', monsterCount);

    place('stairs', 1);
    place('exit', 1);

    grid.forEach(function(row){ row.forEach(function(cell){
      if(cell.type === 'npc'){ cell.npc = NPC_TEMPLATES[Math.floor(Math.random()*NPC_TEMPLATES.length)]; }
      if(cell.type === 'treasure'){
        cell.giveGold = Math.random() < 0.5;
        cell.item = cell.giveGold ? null : RPG.Items.randomItem({ floor: floor });
        cell.collected = false;
      }
      if(cell.type === 'monster'){ cell.monster = RPG.Monsters.generate(floor); cell.beaten = false; }
      if(cell.type === 'boss'){ cell.monster = RPG.Monsters.generateBoss(floor); cell.beaten = false; }
    }); });

    state.map = grid;
    state.mapMode = 'dungeon';
    document.getElementById('locationTag').textContent = 'Masmorra \u2014 Andar ' + floor + (isBossFloor(floor) ? ' \u2694\ufe0f Andar de Chefe' : '');
    RPG.UI.setLegend([
      ['\ud83d\ude80','Inicio'], ['\ud83e\uddd9','NPC'], ['\ud83c\udf81','Tesouro'],
      ['\ud83d\udc7e','Monstro'], ['\ud83d\udc51','Chefe'], ['\u2b07\ufe0f','Escadas'], ['\ud83d\udeaa','Saida']
    ]);
    RPG.Quests.onFloorReached(state);
    return floorCells[0];
  }

  function iconFor(cell){
    if(cell.type==='npc') return '\ud83e\uddd9';
    if(cell.type==='treasure') return cell.collected ? '' : '\ud83c\udf81';
    if(cell.type==='monster') return cell.beaten ? '' : '\ud83d\udc7e';
    if(cell.type==='boss') return cell.beaten ? '' : '\ud83d\udc51';
    if(cell.type==='stairs') return '\u2b07\ufe0f';
    if(cell.type==='exit') return '\ud83d\udeaa';
    if(cell.type==='start') return '\ud83d\ude80';
    return '';
  }

  function entryText(cell){
    if(cell.type==='npc') return 'Voce avista '+cell.npc.name+'. Deseja se aproximar e conversar?';
    if(cell.type==='treasure') return 'Um bau esta logo a frente. Deseja abri-lo?';
    if(cell.type==='monster') return 'Uma criatura bloqueia o caminho. Deseja entrar na sala?';
    if(cell.type==='boss') return 'Uma presenca poderosa emana desta sala. Deseja enfrentar o guardiao?';
    if(cell.type==='stairs') return 'Escadas descem para um andar mais profundo da masmorra. Deseja descer?';
    if(cell.type==='exit') return 'Um caminho leva de volta a cidade. Deseja sair da masmorra?';
    return 'Deseja entrar na sala?';
  }

  // Trata a entrada do jogador em uma celula da masmorra. Retorna true se tratou.
  function handleEnter(state, cell){
    if(cell.type==='npc'){ RPG.UI.openDialogueWithNPC(cell.npc); return true; }
    if(cell.type==='treasure'){
      if(!cell.collected){
        cell.collected = true;
        if(cell.giveGold){
          var goldAmt = 8 + Math.floor(Math.random()*18) + state.floor*2;
          state.hero.gold += goldAmt;
          RPG.UI.showSimpleDialogue('\ud83c\udf81','Bau Encontrado','Voce encontra '+goldAmt+' moedas de ouro dentro do bau.');
          RPG.UI.logEvent('Voce encontrou <b>'+goldAmt+' de ouro</b> em um bau.');
          RPG.Effects.playSfx('gold');
        } else {
          RPG.Inventory.addItem(state, cell.item);
          RPG.Quests.onItemCollected(state);
          RPG.UI.showSimpleDialogue('\ud83c\udf81','Bau Encontrado', cell.item.name+' foi adicionado a sua mochila.');
          RPG.UI.logEvent('Voce encontrou <b>'+cell.item.name+'</b> em um bau.');
          RPG.Effects.playSfx('buy');
        }
        RPG.UI.renderHero();
        RPG.UI.renderMap();
      } else {
        RPG.UI.showSimpleDialogue('\ud83c\udf81','Bau Vazio','Este bau ja foi revistado.');
      }
      return true;
    }
    if(cell.type==='monster' || cell.type==='boss'){
      if(!cell.beaten){ RPG.Combat.startEncounterChoice(cell); }
      else { RPG.UI.showSimpleDialogue('\ud83d\udc7e','Sala Vazia','Nao ha mais nada aqui.'); }
      return true;
    }
    if(cell.type==='stairs'){
      state.floor++;
      var startCell = generate(state);
      RPG.UI.resetPlayerToStart(startCell);
      RPG.UI.renderMap();
      RPG.UI.renderControls();
      RPG.UI.logEvent('Voce desce para o <b>Andar '+state.floor+'</b> da masmorra.');
      RPG.UI.showSimpleDialogue('\u2b07\ufe0f','Escadas','Voce desce mais fundo na masmorra. O ar fica mais pesado...');
      RPG.Effects.playSfx('door');
      return true;
    }
    if(cell.type==='exit'){ RPG.UI.enterCity(); return true; }
    if(cell.type==='start'){ RPG.UI.showSimpleDialogue('\ud83d\ude80','Ponto de Partida','Foi aqui que voce chegou neste andar.'); return true; }
    return false;
  }

  return { generate: generate, iconFor: iconFor, entryText: entryText, handleEnter: handleEnter, isBossFloor: isBossFloor };
})();
