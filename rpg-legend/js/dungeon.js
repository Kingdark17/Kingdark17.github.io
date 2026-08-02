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
    { name:"Erma, a Vidente", role:"Mística Errante", service:'reveal', icon:"\ud83d\udd2e", lines:[
      "Você se aventura fundo demais — ou talvez não o bastante...",
      "Os corredores mudam quando ninguém observa.",
      "Cuidado com o que dorme nas profundezas."] },
    { name:"Prisioneiro Esquecido", role:"Sobrevivente", service:'heal', icon:"\ud83e\uddcd", lines:[
      "Você... você é real? Há quanto tempo estou aqui...",
      "Os monstros ficam mais fortes quanto mais fundo você vai. Tome cuidado.",
      "Se encontrar a saída, corra e não olhe para trás."] }
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
    // Gera novamente quando não existem pelo menos duas salas que sejam
    // distantes tanto pelo caminho real quanto visualmente na grade. Antes,
    // uma sala podia ter rota longa, mas ainda aparecer colada ao jogador.
    var res,distances,distantRooms=[],attempts=0,branchCount=0;
    function startBranch(cell){
      var current=cell,guard=0;
      while((distances[current.x+','+current.y]||0)>1 && guard++<100){
        var currentDistance=distances[current.x+','+current.y];
        var previous=null;
        Object.keys(current.doors||{}).some(function(dir){
          var v=RPG.MapUtil.DIR_VECTORS[dir],candidate=res.grid[current.y+v.y][current.x+v.x];
          if(distances[candidate.x+','+candidate.y]===currentDistance-1){previous=candidate;return true;}
          return false;
        });
        if(!previous)break;
        current=previous;
      }
      return current.x+','+current.y;
    }
    while(attempts<80 && distantRooms.length<2){
      attempts++;
      res=RPG.MapUtil.generateRoomGraph(rows,cols,roomCount);
      distances=RPG.MapUtil.distancesFrom(res.grid,res.start,cols,rows);
      distantRooms=res.rooms.slice(1).filter(function(cell){
        var pathDistance=distances[cell.x+','+cell.y]||0;
        var visualDistance=Math.abs(cell.x-res.start.x)+Math.abs(cell.y-res.start.y);
        return pathDistance>=4 && visualDistance>=3;
      });
      distantRooms.forEach(function(cell){cell.startBranch=startBranch(cell);});
      var branches={};distantRooms.forEach(function(cell){branches[cell.startBranch]=true;});
      branchCount=Object.keys(branches).length;
    }
    var pool = res.rooms.slice(1).sort(function(){ return Math.random()-0.5; });
    // Fallback defensivo para grades muito pequenas ou saves modificados.
    if(distantRooms.length<2){
      distantRooms=pool.filter(function(cell){return (distances[cell.x+','+cell.y]||0)>=3;});
      distantRooms.forEach(function(cell){cell.startBranch=startBranch(cell);});
    }
    distantRooms=distantRooms.slice().sort(function(a,b){
      var pathDiff=(distances[b.x+','+b.y]||0)-(distances[a.x+','+a.y]||0);
      if(pathDiff)return pathDiff;
      var aVisual=Math.abs(a.x-res.start.x)+Math.abs(a.y-res.start.y);
      var bVisual=Math.abs(b.x-res.start.x)+Math.abs(b.y-res.start.y);
      return bVisual-aVisual;
    });
    function reserveDistant(type,otherBranch){
      var pickIndex=0;
      if(otherBranch){
        pickIndex=distantRooms.findIndex(function(candidate){return candidate.startBranch!==otherBranch;});
        if(pickIndex<0)pickIndex=0;
      }
      var cell=distantRooms.splice(pickIndex,1)[0];
      if(!cell)return null;
      var index=pool.indexOf(cell);
      if(index>=0)pool.splice(index,1);
      cell.type=type;
      cell.distanceFromStart=distances[cell.x+','+cell.y]||0;
      return cell;
    }
    // As duas rotas importantes ficam entre as salas mais distantes. Assim o
    // jogador precisa explorar o andar antes de descer ou voltar à cidade.
    var stairsRoom=reserveDistant('stairs');
    reserveDistant('exit',stairsRoom&&stairsRoom.startBranch);
    function place(type, count){ var out=[]; for(var i=0;i<count && pool.length;i++){ var c=pool.pop(); c.type=type; out.push(c);} return out; }

    place('npc', 1 + (Math.random()<0.5?1:0));
    place('event', 1 + (floor>=4 && Math.random()<0.4 ? 1 : 0));
    place('treasure', 2 + Math.min(3, Math.floor(floor/3)));

    // Sempre reserva salas para escada e saida; em andares de chefe,
    // reserva uma terceira sala para o chefe.
    var reservedRooms = isBossFloor(floor) ? 1 : 0;
    var monsterRoomCount = Math.min(pool.length - reservedRooms, 3 + Math.floor((floor-1)*1.3));
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

    res.rooms.forEach(function(cell){
      if(cell.type === 'npc'){
        var sourceNpc=NPC_TEMPLATES[rnd(NPC_TEMPLATES.length)];
        cell.npc={ name:sourceNpc.name, role:sourceNpc.role, service:sourceNpc.service, icon:sourceNpc.icon, lines:sourceNpc.lines.slice(), serviceUsed:false };
      }
      if(cell.type === 'event'){ cell.event = RPG.Events.random(); cell.resolved = false; }
      if(cell.type === 'treasure'){
        cell.giveGold = Math.random() < 0.5;
        cell.item = cell.giveGold ? null : RPG.Items.randomItem({ floor: floor });
        cell.collected = false;
      }
    });

    state.map = res.grid;
    state.mapMode = 'dungeon';
    refreshPresentation(state);
    RPG.Quests.onFloorReached(state);
    return res.start;
  }

  function refreshPresentation(state){
    var floor=state.floor;
    document.getElementById('locationTag').textContent = 'Masmorra \u2014 Andar ' + floor + (isBossFloor(floor) ? ' \u2694\ufe0f Andar de Chefe' : '');
    RPG.UI.setLegend([
      ['\ud83d\ude80','Início'], ['\ud83e\uddd9','NPC'], ['\ud83c\udf81','Tesouro'],
      ['\ud83d\udc7e','Monstro'], ['\ud83d\udc51','Chefe'], ['\u2b07\ufe0f','Escadas'], ['\ud83d\udeaa','Saída']
      ,['\u2753','Evento']
    ]);
  }

  function iconFor(cell){
    if(cell.type==='npc') return '\ud83e\uddd9';
    if(cell.type==='treasure') return cell.collected ? '' : '\ud83c\udf81';
    if(cell.type==='monster') return cell.beaten ? '' : (cell.monsters[0].icon);
    if(cell.type==='boss') return cell.beaten ? '' : '\ud83d\udc51';
    if(cell.type==='event') return cell.resolved ? '' : '\u2753';
    if(cell.type==='stairs') return '\u2b07\ufe0f';
    if(cell.type==='exit') return '\ud83d\udeaa';
    if(cell.type==='start') return '\ud83d\ude80';
    return '';
  }

  function shortLabel(cell){
    if(cell.type==='monster') return cell.beaten ? 'os restos de uma batalha' : (cell.monsters.length>1 ? 'um grupo de criaturas' : 'uma criatura hostil');
    if(cell.type==='boss') return cell.beaten ? 'um covil agora silencioso' : 'uma presença poderosa e perigosa';
    if(cell.type==='event') return cell.resolved ? 'vestígios de um acontecimento' : 'algo incomum';
    return { npc:'alguém parado por perto', treasure: cell.collected?'um baú já vazio':'um baú fechado',
      stairs:'escadas descendo', exit:'o caminho de volta à cidade', start:'o ponto de partida',
      normal:'uma sala vazia' }[cell.type] || 'uma sala';
  }

  function roomDesc(cell){
    if(cell.type==='monster'){
      if(cell.beaten) return 'Os restos da batalha ainda marcam o chão desta sala.';
      return cell.monsters.length>1
        ? (cell.monsters.length+' criaturas bloqueiam o caminho, observando cada movimento seu.')
        : '<b>'+cell.monsters[0].name+'</b> bloqueia o caminho, observando cada movimento seu.';
    }
    if(cell.type==='boss') return cell.beaten ? 'O covil do guardião agora está silencioso e vazio.' : 'Uma presença imensa e hostil domina esta câmara: <b>'+cell.monsters[0].name+'</b>.';
    if(cell.type==='event') return cell.resolved ? 'O acontecimento desta sala já chegou ao fim.' : 'Algo incomum nesta sala convida a uma escolha.';
    return { npc:'Alguém está parado por aqui.', treasure: cell.collected?'Um baú vazio jaz aberto no chão.':'Um baú de madeira reforçada repousa alguns passos à frente.',
      stairs:'Escadas de pedra descem para a escuridão, mais fundo na masmorra.',
      exit:'Um caminho iluminado sobe de volta em direção à cidade.',
      start:'Foi aqui que você chegou a este andar.',
      normal:'O ar aqui é frio e cheira a pedra úmida. Nada de especial nesta sala.' }[cell.type] || '';
  }

  function entryText(cell){
    if(cell.type==='npc') return 'Você avista '+cell.npc.name+'. Deseja se aproximar e conversar?';
    if(cell.type==='treasure') return 'Um baú está logo à frente. Deseja abri-lo?';
    if(cell.type==='monster') return (cell.monsters.length>1 ? 'Várias criaturas bloqueiam' : 'Uma criatura bloqueia') + ' o caminho. Deseja entrar na sala?';
    if(cell.type==='boss') return 'Uma presença poderosa emana desta sala. Deseja enfrentar o guardião?';
    if(cell.type==='event') return 'Algo incomum aguarda nesta sala. Deseja investigar?';
    if(cell.type==='stairs') return 'Escadas descem para um andar mais profundo da masmorra. Deseja descer?';
    if(cell.type==='exit') return 'Um caminho leva de volta à cidade. Deseja sair da masmorra?';
    return 'Deseja entrar na sala?';
  }

  // Trata a entrada do jogador em uma sala da masmorra. Retorna true se tratou.
  function handleEnter(state, cell){
    if(cell.type==='npc'){ RPG.UI.openDialogueWithNPC(cell.npc); return true; }
    if(cell.type==='event'){ RPG.Events.open(state, cell); return true; }
    if(cell.type==='treasure'){
      if(!cell.collected){
        cell.collected = true;
        if(cell.giveGold){
          var goldAmt = 8 + rnd(18) + state.floor*2;
          state.hero.gold += goldAmt;
          RPG.UI.showSimpleDialogue('\ud83c\udf81','Baú Encontrado','Você encontra '+goldAmt+' moedas de ouro dentro do baú.');
          RPG.UI.logEvent('Você encontrou <b>'+goldAmt+' de ouro</b> em um baú.');
          RPG.Effects.playSfx('gold');
        } else {
          RPG.Inventory.addItem(state, cell.item);
          RPG.Quests.onItemCollected(state);
          RPG.UI.showSimpleDialogue('\ud83c\udf81','Baú Encontrado','<b>'+cell.item.name+'</b> foi adicionado à sua mochila.<br><span class="item-found-desc">'+cell.item.desc+'</span>');
          RPG.UI.logEvent('Você encontrou <b>'+cell.item.name+'</b> em um baú.');
          RPG.Effects.playSfx('buy');
        }
        RPG.UI.renderHero();
        RPG.UI.renderMap();
      } else {
        RPG.UI.showSimpleDialogue('\ud83c\udf81','Baú Vazio','Este baú já foi revistado.');
      }
      return true;
    }
    if(cell.type==='monster' || cell.type==='boss'){
      if(!cell.beaten){ RPG.Combat.startEncounterChoice(cell); }
      else { RPG.UI.showSimpleDialogue('\ud83d\udc7e','Sala Vazia','Não há mais nada aqui.'); }
      return true;
    }
    if(cell.type==='stairs'){
      state.floor++;
      var startCell = generate(state);
      RPG.UI.resetPlayerToStart(startCell);
      RPG.UI.renderMap();
      RPG.UI.renderControls();
      RPG.UI.logEvent('Você desce para o <b>Andar '+state.floor+'</b> da masmorra.');
      RPG.UI.showSimpleDialogue('\u2b07\ufe0f','Escadas','Você desce mais fundo na masmorra. O ar fica mais pesado...');
      RPG.Effects.playSfx('door');
      return true;
    }
    if(cell.type==='exit'){ RPG.UI.enterCity(); return true; }
    if(cell.type==='start'){ RPG.UI.showSimpleDialogue('\ud83d\ude80','Ponto de Partida','Foi aqui que você chegou neste andar.'); return true; }
    return false;
  }

  return { generate: generate, refreshPresentation:refreshPresentation, iconFor: iconFor, entryText: entryText, handleEnter: handleEnter, isBossFloor: isBossFloor, shortLabel: shortLabel, roomDesc: roomDesc };
})();
