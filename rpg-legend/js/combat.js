/* =========================================================
   RPG Legend - js/combat.js
   Rolagem de dados (3D), escolha enfrentar/fugir e resolucao
   do combate. Uma sala pode ter mais de um monstro na fila —
   o combate encadeia automaticamente ate a sala ficar limpa.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Combat = (function(){

  var rolling = false;

  function rnd(n){ return Math.floor(Math.random()*n); }
  function currentMonster(cell){ return cell.monsters[cell.monsterIndex]; }

  function rollDie(sides, callback){
    if(rolling) return;
    rolling = true;
    var dieEl = document.getElementById('rollDie');
    var infoEl = document.getElementById('rollInfo');
    dieEl.className = 'roll-die spinning';
    infoEl.innerHTML = 'Rolando <b>d'+sides+'</b>...';
    var ticks = 0;
    var maxTicks = 9 + rnd(5);
    var interval = setInterval(function(){
      dieEl.textContent = 1 + rnd(sides);
      ticks++;
      if(ticks >= maxTicks){
        clearInterval(interval);
        var result = 1 + rnd(sides);
        dieEl.textContent = result;
        dieEl.className = 'roll-die settled';
        var crit = (sides===20 && result===20);
        var fail = (sides===20 && result===1);
        infoEl.innerHTML = 'Resultado em <b>d'+sides+'</b>: <b>'+result+'</b>' + (crit? ' &mdash; Acerto Critico!' : (fail? ' &mdash; Falha Critica!' : ''));
        var logLine = document.createElement('div');
        logLine.innerHTML = '<span>d'+sides+'</span> &rarr; ' + result + (crit? ' (critico)':'') + (fail? ' (falha)':'');
        var logEl = document.getElementById('rollLog');
        logEl.insertBefore(logLine, logEl.firstChild);
        while(logEl.children.length > 12){ logEl.removeChild(logEl.lastChild); }
        RPG.UI.logEvent('Voce rolou <b>d'+sides+'</b> e tirou <b>'+result+'</b>.');
        rolling = false;
        if(callback){ callback(result); }
      }
    }, 55);
  }

  function fleeBonus(hero, monster){
    var diff = hero.attrs.destreza - monster.speed;
    if(diff >= 5) return 2;
    if(diff > 0) return 1;
    return 0;
  }

  function startEncounterChoice(cell){
    var state = RPG.state;
    state.mode = 'encounter';
    state.pendingMonsterCell = cell;
    var monster = currentMonster(cell);
    var npcCard = document.getElementById('npcCard');
    npcCard.style.display = 'flex';
    document.getElementById('npcPortrait').textContent = monster.icon;
    document.getElementById('npcName').textContent = cell.monsters.length>1 ? (monster.name+' (+'+(cell.monsters.length-1)+')') : monster.name;
    document.getElementById('npcRole').textContent = monster.isBoss ? 'Chefe' : 'Encontro Hostil';
    var groupMsg = cell.monsters.length>1 ? ('Um grupo de '+cell.monsters.length+' criaturas aparece! O que voce faz?') : ('Um '+monster.name+' aparece! O que voce faz?');
    RPG.UI.setSceneMessage(groupMsg);
    RPG.UI.logEvent((monster.isBoss?'Um CHEFE surge: ':'Um <b>')+monster.name+(monster.isBoss?'!':'</b> surge no caminho.'));
    RPG.UI.renderControls();
  }

  function attemptFlee(cell, phase){
    var state = RPG.state;
    var monster = currentMonster(cell);
    var bonus = fleeBonus(state.hero, monster);
    RPG.UI.setSceneMessage('Voce tenta fugir da criatura...');
    rollDie(20, function(result){
      var total = result + bonus;
      var success = total >= 12;
      if(success){
        RPG.UI.logEvent('Voce rolou '+result+(bonus? ' (+'+bonus+' por velocidade)':'')+' e fugiu com sucesso.');
        if(phase === 'combat'){ exitCombat(cell, false); }
        else {
          state.mode = 'move'; state.pendingMonsterCell = null;
          RPG.UI.setSceneMessage('Voce se afasta antes que a criatura reaja.');
          document.getElementById('npcCard').style.display = 'none';
          RPG.UI.renderControls();
        }
      } else {
        RPG.UI.logEvent('Voce rolou '+result+(bonus? ' (+'+bonus+' por velocidade)':'')+' e nao conseguiu fugir.');
        if(phase === 'pre'){
          RPG.UI.setSceneMessage('A fuga falha! A criatura parte para cima de voce.');
          startCombat(cell);
        } else {
          applyMonsterHit(cell);
          updateCombatPanel(cell);
        }
      }
    });
  }

  function applyMonsterHit(cell){
    var state = RPG.state;
    var monster = currentMonster(cell);
    var bonus = RPG.Player.equipmentBonus(state.hero);
    var dmg = Math.max(1, (1+rnd(6)) + monster.dmg - Math.floor((bonus.defesa||0)/3));
    state.hero.hp = Math.max(0, state.hero.hp - dmg);
    RPG.UI.renderHero();
    RPG.Effects.shakeElement(document.getElementById('playerPanel'));
    RPG.Effects.floatText(document.getElementById('combatScene'), '-'+dmg, 'dmg');
    RPG.Effects.playSfx('hit');
    RPG.UI.setSceneMessage('A criatura acerta um golpe ('+dmg+' de dano)!');
    RPG.UI.logEvent('O '+monster.name+' causa '+dmg+' de dano em voce.');
    if(state.hero.hp <= 0){ handleDefeat(); }
  }

  function handleDefeat(){
    var state = RPG.state;
    state.hero.hp = Math.max(1, Math.floor(state.hero.maxHp*0.3));
    RPG.UI.renderHero();
    RPG.Effects.playSfx('defeat');
    RPG.UI.logEvent('<b>Voce quase morreu!</b> Seus aliados te arrastam de volta para a cidade mais proxima.');
    state.mode = 'move';
    state.pendingMonsterCell = null;
    document.getElementById('sceneText').classList.remove('hidden');
    document.getElementById('combatScene').classList.add('hidden');
    RPG.UI.enterCity();
  }

  function startCombat(cell){
    var state = RPG.state;
    state.mode = 'combat';
    state.pendingMonsterCell = cell;
    document.getElementById('sceneText').classList.add('hidden');
    document.getElementById('combatScene').classList.remove('hidden');
    RPG.UI.setSceneMessage('O combate comeca! Role o dado para atacar ou tente fugir.');
    renderCombatScene(cell);
    RPG.UI.renderControls();
  }

  function renderCombatScene(cell){
    var monster = currentMonster(cell);
    var el = document.getElementById('combatScene');
    el.className = 'combat-scene' + (monster.isBoss ? ' boss' : '');
    var progress = cell.monsters.length>1 ? ('<div class="cs-hp">Inimigo '+(cell.monsterIndex+1)+' de '+cell.monsters.length+'</div>') : '';
    el.innerHTML =
      '<div class="cs-icon">'+monster.icon+'</div>'+
      '<div class="cs-name">'+monster.name+(monster.isBoss?' \ud83d\udc51':'')+'</div>'+
      progress +
      '<div class="cs-hp">Vida da criatura: '+Math.max(0,monster.hp)+' / '+monster.maxHp+'</div>'+
      '<div class="combat-actions">'+
        '<button class="attack" id="combatAttackBtn">Atacar (d20)</button>'+
        '<button class="flee" id="combatFleeBtn">Fugir da Batalha</button>'+
      '</div>';
    document.getElementById('combatAttackBtn').addEventListener('click', function(){
      rollDie(20, function(result){ resolveAttack(cell, result); });
    });
    document.getElementById('combatFleeBtn').addEventListener('click', function(){
      attemptFlee(cell, 'combat');
    });
  }

  function updateCombatPanel(cell){ renderCombatScene(cell); }

  function resolveAttack(cell, roll){
    var state = RPG.state;
    var monster = currentMonster(cell);
    var bonus = RPG.Player.equipmentBonus(state.hero);
    var hit = roll >= 11;
    if(hit){
      var critChance = 0.05 + (bonus.critico||0)/100;
      var isCrit = Math.random() < critChance || roll === 20;
      var dmg = 3+rnd(6) + (bonus.ataque||0) + Math.max(0, RPG.Player.attrMod(state.hero.attrs.forca));
      if(isCrit){ dmg = Math.round(dmg*1.6); }
      monster.hp -= dmg;
      RPG.Effects.floatText(document.getElementById('combatScene'), (isCrit?'CRITICO! ':'')+'-'+dmg, isCrit?'crit':'dmg');
      RPG.Effects.playSfx(isCrit?'crit':'hit');
      RPG.UI.logEvent('Voce acerta o '+monster.name+' causando '+dmg+' de dano'+(isCrit?' (critico!)':'')+'.');
      RPG.UI.setSceneMessage(isCrit ? 'Golpe critico! Voce causa '+dmg+' de dano.' : 'Golpe certeiro! Voce causa '+dmg+' de dano.');
      if(monster.hp <= 0){ handleMonsterDefeated(cell); return; }
    } else {
      RPG.Effects.playSfx('miss');
      RPG.UI.setSceneMessage('Voce erra o ataque!');
      applyMonsterHit(cell);
    }
    updateCombatPanel(cell);
  }

  function handleMonsterDefeated(cell){
    var state = RPG.state;
    var monster = currentMonster(cell);
    state.hero.killCount = (state.hero.killCount||0) + 1;
    RPG.Quests.onMonsterKilled(state);
    RPG.Effects.playSfx('victory');
    state.hero.gold += monster.gold;
    var xpRes = RPG.Player.gainXP(state.hero, monster.xp);
    RPG.UI.logEvent('Voce derrotou <b>'+monster.name+'</b>! +'+monster.xp+' XP, +'+monster.gold+' ouro.');
    RPG.UI.renderHero();
    if(xpRes.leveledUp){ RPG.UI.onLevelUp(xpRes.levels); }

    if(cell.monsterIndex + 1 < cell.monsters.length){
      cell.monsterIndex++;
      var next = currentMonster(cell);
      RPG.UI.setSceneMessage('Mais um inimigo entra na luta: '+next.name+'!');
      RPG.UI.logEvent('<b>'+next.name+'</b> aparece para continuar a briga.');
      renderCombatScene(cell);
      return;
    }

    cell.beaten = true;
    var gotLoot = false, lootItem = null;
    var lootChance = cell.type==='boss' ? 0.95 : 0.5;
    if(Math.random() < lootChance){
      lootItem = RPG.Items.randomItem({ floor: state.floor });
      RPG.Inventory.addItem(state, lootItem);
      RPG.Quests.onItemCollected(state);
      RPG.UI.logEvent('Encontrou <b>'+lootItem.name+'</b> ('+lootItem.rarityLabel+') apos a batalha.');
      gotLoot = true;
    }
    var bonusMsg = '';
    if(cell.bonusTreasure){
      if(cell.bonusTreasure.gold){
        state.hero.gold += cell.bonusTreasure.gold;
        RPG.UI.logEvent('Com a sala livre de perigo, voce encontra mais <b>'+cell.bonusTreasure.gold+' de ouro</b> escondido.');
        bonusMsg = ' Voce tambem encontra ouro escondido na sala.';
      } else if(cell.bonusTreasure.item){
        RPG.Inventory.addItem(state, cell.bonusTreasure.item);
        RPG.UI.logEvent('Com a sala livre de perigo, voce encontra <b>'+cell.bonusTreasure.item.name+'</b> escondido.');
        bonusMsg = ' Voce tambem encontra um item escondido na sala.';
      }
      RPG.UI.renderHero();
    }
    exitCombat(cell, true, gotLoot, bonusMsg);
  }

  function exitCombat(cell, victory, gotLoot, bonusMsg){
    var state = RPG.state;
    state.mode = 'move';
    state.pendingMonsterCell = null;
    document.getElementById('sceneText').classList.remove('hidden');
    document.getElementById('combatScene').classList.add('hidden');
    document.getElementById('npcCard').style.display = 'none';
    if(victory){ RPG.UI.setSceneMessage('Voce venceu a batalha!' + (gotLoot? ' Encontrou um item entre os destrocos.':'') + (bonusMsg||'')); }
    else { RPG.UI.setSceneMessage('Voce escapa da batalha, ofegante.'); }
    RPG.UI.renderMap();
    RPG.UI.renderControls();
  }

  return {
    rollDie: rollDie,
    startEncounterChoice: startEncounterChoice, attemptFlee: attemptFlee,
    startCombat: startCombat, resolveAttack: resolveAttack
  };
})();
