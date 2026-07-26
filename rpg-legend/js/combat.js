/* =========================================================
   RPG Legend - js/combat.js
   Mesa de dados (rolagem 3D), escolha enfrentar/fugir e a
   resolucao do combate propriamente dito.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Combat = (function(){

  var DICE = [4,6,8,10,12,20,100];
  var rolling = false;

  function rnd(n){ return Math.floor(Math.random()*n); }

  function buildDiceRow(){
    var row = document.getElementById('diceRow');
    row.innerHTML = '';
    DICE.forEach(function(sides){
      var btn = document.createElement('div');
      btn.className = 'die-btn';
      btn.innerHTML = '<div class="lbl">d'+sides+'</div>';
      btn.addEventListener('click', function(){ rollDie(sides); });
      row.appendChild(btn);
    });
  }

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
    var npcCard = document.getElementById('npcCard');
    npcCard.style.display = 'flex';
    document.getElementById('npcPortrait').textContent = cell.monster.icon;
    document.getElementById('npcName').textContent = cell.monster.name;
    document.getElementById('npcRole').textContent = cell.monster.isBoss ? 'Chefe' : 'Encontro Hostil';
    document.getElementById('dialogueBox').textContent = 'Um '+cell.monster.name+' aparece! O que voce faz?';
    RPG.UI.logEvent((cell.monster.isBoss?'Um CHEFE surge: ':'Um <b>')+cell.monster.name+(cell.monster.isBoss?'!':'</b> surge no caminho.'));
    RPG.UI.renderControls();
  }

  function attemptFlee(cell, phase){
    var state = RPG.state;
    var bonus = fleeBonus(state.hero, cell.monster);
    document.getElementById('dialogueBox').textContent = 'Voce tenta fugir da criatura...';
    rollDie(20, function(result){
      var total = result + bonus;
      var success = total >= 12;
      if(success){
        RPG.UI.logEvent('Voce rolou '+result+(bonus? ' (+'+bonus+' por velocidade)':'')+' e fugiu com sucesso.');
        if(phase === 'combat'){ exitCombat(cell, false); }
        else {
          state.mode = 'move'; state.pendingMonsterCell = null;
          document.getElementById('dialogueBox').textContent = 'Voce se afasta antes que a criatura reaja.';
          document.getElementById('npcCard').style.display = 'none';
          RPG.UI.renderControls();
        }
      } else {
        RPG.UI.logEvent('Voce rolou '+result+(bonus? ' (+'+bonus+' por velocidade)':'')+' e nao conseguiu fugir.');
        if(phase === 'pre'){
          document.getElementById('dialogueBox').textContent = 'A fuga falha! A criatura parte para cima de voce.';
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
    var bonus = RPG.Player.equipmentBonus(state.hero);
    var dmg = Math.max(1, (1+rnd(6)) + cell.monster.dmg - Math.floor((bonus.defesa||0)/3));
    state.hero.hp = Math.max(0, state.hero.hp - dmg);
    RPG.UI.renderHero();
    RPG.Effects.shakeElement(document.getElementById('playerPanel'));
    RPG.Effects.floatText(document.getElementById('combatScene'), '-'+dmg, 'dmg');
    RPG.Effects.playSfx('hit');
    document.getElementById('dialogueBox').textContent = 'A criatura acerta um golpe ('+dmg+' de dano)!';
    RPG.UI.logEvent('O '+cell.monster.name+' causa '+dmg+' de dano em voce.');
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
    document.getElementById('mapGrid').classList.remove('hidden');
    document.getElementById('combatScene').classList.add('hidden');
    RPG.UI.enterCity();
  }

  function startCombat(cell){
    var state = RPG.state;
    state.mode = 'combat';
    state.pendingMonsterCell = cell;
    if(cell.monsterHp === undefined){ cell.monsterHp = cell.monster.hp; cell.monsterMaxHp = cell.monster.hp; }
    document.getElementById('mapGrid').classList.add('hidden');
    document.getElementById('combatScene').classList.remove('hidden');
    document.getElementById('dialogueBox').textContent = 'O combate comeca! Role o dado para atacar ou tente fugir.';
    renderCombatScene(cell);
    RPG.UI.renderControls();
  }

  function renderCombatScene(cell){
    var el = document.getElementById('combatScene');
    el.className = 'combat-scene' + (cell.monster.isBoss ? ' boss' : '');
    el.innerHTML =
      '<div class="cs-icon">'+cell.monster.icon+'</div>'+
      '<div class="cs-name">'+cell.monster.name+(cell.monster.isBoss?' \ud83d\udc51':'')+'</div>'+
      '<div class="cs-hp">Vida da criatura: '+Math.max(0,cell.monsterHp)+' / '+cell.monsterMaxHp+'</div>'+
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
    var bonus = RPG.Player.equipmentBonus(state.hero);
    var hit = roll >= 11;
    if(hit){
      var critChance = 0.05 + (bonus.critico||0)/100;
      var isCrit = Math.random() < critChance || roll === 20;
      var dmg = 3+rnd(6) + (bonus.ataque||0) + Math.max(0, RPG.Player.attrMod(state.hero.attrs.forca));
      if(isCrit){ dmg = Math.round(dmg*1.6); }
      cell.monsterHp -= dmg;
      RPG.Effects.floatText(document.getElementById('combatScene'), (isCrit?'CRITICO! ':'')+'-'+dmg, isCrit?'crit':'dmg');
      RPG.Effects.playSfx(isCrit?'crit':'hit');
      RPG.UI.logEvent('Voce acerta o '+cell.monster.name+' causando '+dmg+' de dano'+(isCrit?' (critico!)':'')+'.');
      document.getElementById('dialogueBox').textContent = isCrit ? 'Golpe critico! Voce causa '+dmg+' de dano.' : 'Golpe certeiro! Voce causa '+dmg+' de dano.';
      if(cell.monsterHp <= 0){ endCombatVictory(cell); return; }
    } else {
      RPG.Effects.playSfx('miss');
      document.getElementById('dialogueBox').textContent = 'Voce erra o ataque!';
      applyMonsterHit(cell);
    }
    updateCombatPanel(cell);
  }

  function endCombatVictory(cell){
    var state = RPG.state;
    cell.beaten = true;
    state.hero.killCount = (state.hero.killCount||0) + 1;
    RPG.Quests.onMonsterKilled(state);
    RPG.UI.logEvent('Voce derrotou o <b>'+cell.monster.name+'</b>!');
    RPG.Effects.playSfx('victory');

    state.hero.gold += cell.monster.gold;
    var xpRes = RPG.Player.gainXP(state.hero, cell.monster.xp);
    RPG.UI.logEvent('+'+cell.monster.xp+' XP, +'+cell.monster.gold+' ouro.');

    var lootChance = cell.monster.isBoss ? 0.95 : 0.5;
    var gotLoot = Math.random() < lootChance;
    if(gotLoot){
      var loot = RPG.Items.randomItem({ floor: state.floor });
      RPG.Inventory.addItem(state, loot);
      RPG.Quests.onItemCollected(state);
      RPG.UI.logEvent('Encontrou <b>'+loot.name+'</b> ('+loot.rarityLabel+') apos a batalha.');
    }
    RPG.UI.renderHero();
    if(xpRes.leveledUp){ RPG.UI.onLevelUp(xpRes.levels); }
    exitCombat(cell, true, gotLoot);
  }

  function exitCombat(cell, victory, gotLoot){
    var state = RPG.state;
    state.mode = 'move';
    state.pendingMonsterCell = null;
    document.getElementById('mapGrid').classList.remove('hidden');
    document.getElementById('combatScene').classList.add('hidden');
    document.getElementById('npcCard').style.display = 'none';
    if(victory){ document.getElementById('dialogueBox').textContent = 'Voce venceu a batalha!' + (gotLoot? ' Encontrou um item entre os destrocos.':''); }
    else { document.getElementById('dialogueBox').textContent = 'Voce escapa da batalha, ofegante.'; }
    RPG.UI.renderMap();
    RPG.UI.renderControls();
  }

  return {
    buildDiceRow: buildDiceRow, rollDie: rollDie,
    startEncounterChoice: startEncounterChoice, attemptFlee: attemptFlee,
    startCombat: startCombat, resolveAttack: resolveAttack
  };
})();
