/* =========================================================
   RPG Legend - js/dungeon.js
   Geracao de cada andar da masmorra como salas conectadas por
   portas. Mais andares = mais salas, mais monstros por sala
   (as vezes ate 3 na mesma sala) e monstros mais fortes.
   Chefes a cada 5/10 andares. Salas de monstro podem esconder
   um bonus extra que so aparece depois de limpar tudo.
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

  function rnd(n){ return Math.floor(Math.random()*n); }
  function isBossFloor(floor){ return floor % 5 === 0; }

  // Quantos monstros aparecem juntos numa sala (as vezes mais de um).
  function monsterGroupSize(floor){
    var n = 1;
    if(Math.random() < 0.35) n = 2;
    if(floor >= 4 && Math.random() < 0.2) n = 3;
    return Math.min(3, n);
  }

  function generate(state){
    var rows = state.mapRows, cols = state.mapCols;
    var floor = state.floor;
    var roomCount = Math.min(22, 9 + floor);
    var res = RPG.MapUtil.generateRoomGraph(rows, cols, roomCount);
    var pool = res.rooms.slice(1).sort(function(){ return Math.random()-0.5; });
    function place(type, count){ var out=[]; for(var i=0;i<count && pool.length;i++){ var c=pool.pop(); c.type=type; out.push(c);} return out; }

    place('npc', 1 + (Math.random()<0.5?1:0));
    place('treasure', 2 + Math.min(3, Math.floor(floor/3)));

    var monsterRoomCount = Math.min(pool.length - 2, 3 + Math.floor((floor-1)*1.3));
    var monsterRooms = place('monster', Math.max(2, monsterRoomCount));
    monsterRooms.forEach(function(cell){
      var groupSize = monsterGroupSize(floor);
      cell.monsters = [];
      for(var i=0;i<groupSize;i++){
        var m = RPG.Monsters.generate(floor);
        m.maxHp = m.hp;
        cell.monsters.push(m);
      }
      cell.monsterIndex = 0;
      cell.beaten = false;
      // sala com mais de um inimigo tem chance de esconder uma recompensa extra
      if(groupSize > 1 && Math.random() < 0.5){
        cell.bonusTreasure = Math.random() < 0.5
          ? { gold: 10 + floor*3 + rnd(15) }
          : { item: RPG.Items.randomItem({ floor: floor }) };
      }
    });

    if(isBossFloor(floor)){
      var bossRoom = place('boss', 1)[0];
      if(bossRoom){
        var boss = RPG.Monsters.generateBoss(floor);
        boss.maxHp = boss.hp;
        bossRoom.monsters = [boss];
        bossRoom.monsterIndex = 0;
        bossRoom.beaten = false;
      }
    }

    place('stairs', 1);
    place('exit', 1);

    res.rooms.forEach(function(cell){
      if(cell.type === 'npc'){ cell.npc = NPC_TEMPLATES[rnd(NPC_TEMPLATES.length)]; }
      if(cell.type === 'treasure'){
        cell.giveGold = Math.random() < 0.5;
        cell.item = cell.giveGold ? null : RPG.Items.randomItem({ floor: floor });
        cell.collected = false;
      }
    });

    state.map = res.grid;
    state.mapMode = 'dungeon';
    document.getElementById('locationTag').textContent = 'Masmorra \u2014 Andar ' + floor + (isBossFloor(floor) ? ' \u2694\ufe0f Andar de Chefe' : '');
    RPG.UI.setLegend([
      ['\ud83d\ude80','Inicio'], ['\ud83e\uddd9','NPC'], ['\ud83c\udf81','Tesouro'],
      ['\ud83d\udc7e','Monstro'], ['\ud83d\udc51','Chefe'], ['\u2b07\ufe0f','Escadas'], ['\ud83d\udeaa','Saida']
    ]);
    RPG.Quests.onFloorReached(state);
    return res.start;
  }

  function iconFor(cell){
    if(cell.type==='npc') return '\ud83e\uddd9';
    if(cell.type==='treasure') return cell.collected ? '' : '\ud83c\udf81';
    if(cell.type==='monster') return cell.beaten ? '' : (cell.monsters[0].icon);
    if(cell.type==='boss') return cell.beaten ? '' : '\ud83d\udc51';
    if(cell.type==='stairs') return '\u2b07\ufe0f';
    if(cell.type==='exit') return '\ud83d\udeaa';
    if(cell.type==='start') return '\ud83d\ude80';
    return '';
  }

  function shortLabel(cell){
    if(cell.type==='monster') return cell.beaten ? 'os restos de uma batalha' : (cell.monsters.length>1 ? 'um grupo de criaturas' : 'uma criatura hostil');
    if(cell.type==='boss') return cell.beaten ? 'um covil agora silencioso' : 'uma presenca poderosa e perigosa';
    return { npc:'alguem parado por perto', treasure: cell.collected?'um bau ja vazio':'um bau fechado',
      stairs:'escadas descendo', exit:'o caminho de volta a cidade', start:'o ponto de partida',
      normal:'uma sala vazia' }[cell.type] || 'uma sala';
  }

  function roomDesc(cell){
    if(cell.type==='monster'){
      if(cell.beaten) return 'Os restos da batalha ainda marcam o chao desta sala.';
      return cell.monsters.length>1
        ? (cell.monsters.length+' criaturas bloqueiam o caminho, observando cada movimento seu.')
        : '<b>'+cell.monsters[0].name+'</b> bloqueia o caminho, observando cada movimento seu.';
    }
    if(cell.type==='boss') return cell.beaten ? 'O covil do guardiao agora esta silencioso e vazio.' : 'Uma presenca imensa e hostil domina esta camara: <b>'+cell.monsters[0].name+'</b>.';
    return { npc:'Alguem esta parado por aqui.', treasure: cell.collected?'Um bau vazio jaz aberto no chao.':'Um bau de madeira reforcada repousa alguns passos a frente.',
      stairs:'Escadas de pedra descem para a escuridao, mais fundo na masmorra.',
      exit:'Um caminho iluminado sobe de volta em direcao a cidade.',
      start:'Foi aqui que voce chegou a este andar.',
      normal:'O ar aqui e frio e cheira a pedra umida. Nada de especial nesta sala.' }[cell.type] || '';
  }

  function entryText(cell){
    if(cell.type==='npc') return 'Voce avista '+cell.npc.name+'. Deseja se aproximar e conversar?';
    if(cell.type==='treasure') return 'Um bau esta logo a frente. Deseja abri-lo?';
    if(cell.type==='monster') return (cell.monsters.length>1 ? 'Varias criaturas bloqueiam' : 'Uma criatura bloqueia') + ' o caminho. Deseja entrar na sala?';
    if(cell.type==='boss') return 'Uma presenca poderosa emana desta sala. Deseja enfrentar o guardiao?';
    if(cell.type==='stairs') return 'Escadas descem para um andar mais profundo da masmorra. Deseja descer?';
    if(cell.type==='exit') return 'Um caminho leva de volta a cidade. Deseja sair da masmorra?';
    return 'Deseja entrar na sala?';
  }

  // Trata a entrada do jogador em uma sala da masmorra. Retorna true se tratou.
  function handleEnter(state, cell){
    if(cell.type==='npc'){ RPG.UI.openDialogueWithNPC(cell.npc); return true; }
    if(cell.type==='treasure'){
      if(!cell.collected){
        cell.collected = true;
        if(cell.giveGold){
          var goldAmt = 8 + rnd(18) + state.floor*2;
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

  return { generate: generate, iconFor: iconFor, entryText: entryText, handleEnter: handleEnter, isBossFloor: isBossFloor, shortLabel: shortLabel, roomDesc: roomDesc };
})();
