/* =========================================================
   RPG Legend - js/combat.js
   Rolagem de dados (3D), escolha enfrentar/fugir, poderes de
   classe, afinidade de arma, procs de arma e resolucao do
   combate. Uma sala pode ter mais de um monstro na fila --
   o combate encadeia automaticamente ate a sala ficar limpa.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Combat = (function(){

  var rolling = false;

  function rnd(n){ return Math.floor(Math.random()*n); }
  function currentMonster(cell){ return RPG.Monsters.ensureClass(cell.monsters[cell.monsterIndex]); }

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
        infoEl.innerHTML = 'Resultado em <b>d'+sides+'</b>: <b>'+result+'</b>' + (crit? ' &mdash; Acerto Crítico!' : (fail? ' &mdash; Falha Critica!' : ''));
        var logLine = document.createElement('div');
        logLine.innerHTML = '<span>d'+sides+'</span> &rarr; ' + result + (crit? ' (crítico)':'') + (fail? ' (falha)':'');
        var logEl = document.getElementById('rollLog');
        logEl.insertBefore(logLine, logEl.firstChild);
        while(logEl.children.length > 12){ logEl.removeChild(logEl.lastChild); }
        RPG.UI.logEvent('Você rolou <b>d'+sides+'</b> e tirou <b>'+result+'</b>.');
        rolling = false;
        if(callback){ callback(result); }
      }
    }, 55);
  }

  function fleeBonus(hero, monster){
    var d = hero.derived || RPG.Player.getDerived(hero);
    var diff = d.velocidade - monster.speed;
    var bonus = diff >= 5 ? 2 : (diff > 0 ? 1 : 0);
    if(RPG.Player.hasDebuffEffect(hero, 'fleePenalty')) bonus -= 2;
    return bonus;
  }

  /* ---------- afinidade de arma / calculo de dano ---------- */

  function weaponAffinityPct(hero){
    var weapon = hero.equip.arma;
    if(!weapon) return 100;
    var cls = RPG.Player.classByName(hero.className);
    if(!cls || !cls.affinity || cls.affinity[weapon.templateId]==null) return 100;
    return cls.affinity[weapon.templateId];
  }

  function weaponAtkContribution(hero, affinity){
    var weapon = hero.equip.arma;
    return weapon ? Math.round((weapon.stats.ataque||0) * affinity/100) : 0;
  }

  function otherEquipAtk(hero){
    var sum = 0;
    ['secundaria','armadura','acessorio'].forEach(function(slot){
      var it = hero.equip[slot];
      if(it && it.stats.ataque){
        var pct=100,cls=RPG.Player.classByName(hero.className);
        if(slot==='secundaria' && cls && cls.affinity && cls.affinity[it.templateId]!=null)pct=cls.affinity[it.templateId];
        sum += Math.round(it.stats.ataque*pct/100);
      }
    });
    return sum;
  }

  /* ---------- procs de arma (efeito unico por tipo) ---------- */

  function applyWeaponProc(hero, monster){
    var weapon = hero.equip.arma;
    if(!weapon || !weapon.proc) return null;
    if(Math.random() >= weapon.proc.chance) return null;
    var eff = weapon.proc.effect;
    var d = hero.derived || RPG.Player.getDerived(hero);
    monster.status = monster.status || {};
    if(eff==='queimadura'){ monster.status.queimadura = { turns:3, dmg: Math.max(2, Math.round(d.dmgFisico*0.3)) }; }
    else if(eff==='sangramento'){ monster.status.sangramento = { turns:3, dmg: Math.max(2, Math.round(d.dmgFisico*0.25)) }; }
    else if(eff==='atordoar'){ monster.status.atordoado = (monster.status.atordoado||0) + 1; }
    else if(eff==='mana_gratis'){ hero.mp = Math.min(hero.maxMp, hero.mp+6); }
    else if(eff==='cura_no_acerto'){ hero.hp = Math.min(hero.maxHp, hero.hp + Math.max(3, Math.round(d.curaBonus*0.5)+4)); }
    RPG.UI.logEvent('<b>'+weapon.name+'</b> ativa: '+weapon.proc.label+'!');
    return weapon.proc;
  }

  /* dano continuo (queimadura/sangramento) no inicio de cada rodada */
  function tickMonsterDot(cell){
    var monster = currentMonster(cell);
    if(!monster.status) return false;
    var total = 0;
    ['queimadura','sangramento','veneno'].forEach(function(key){
      var s = monster.status[key];
      if(s && s.turns>0){
        monster.hp -= s.dmg; total += s.dmg; s.turns--;
        if(s.turns<=0) delete monster.status[key];
      }
    });
    if(total>0){
      RPG.Effects.floatText(document.getElementById('combatScene'), '-'+total, 'dmg');
      RPG.UI.logEvent('Efeitos contínuos causam '+total+' de dano ao '+monster.name+'.');
    }
    return monster.hp<=0;
  }

  /* Companheiros agem automaticamente depois do heroi. Isso mantem o
     modo equipe simples, mas faz a escolha mudar de verdade o combate. */
  function applyPartyTurn(cell){
    var party = RPG.state.party || [];
    var monster = currentMonster(cell);
    var total = 0;
    party.forEach(function(member){
      if(member.hp <= 0 || monster.hp <= 0) return;
      var stance=member.stance||'equilibrada';
      var isCleric=member.className==='Clérigo' || member.className==='Clerigo';
      if(stance==='suporte' && Math.random()<(isCleric?0.65:0.4)){
        var heal=Math.max(4,Math.round((member.attrs ? member.attrs.sabedoria : 8)*0.7));
        RPG.state.hero.hp=Math.min(RPG.state.hero.maxHp,RPG.state.hero.hp+heal);
        RPG.UI.logEvent(member.name+' usa '+(isCleric?'Prece Curativa':'Primeiros Socorros')+' e recupera '+heal+' de Vida do herói.');
        return;
      }
      var hitChance=stance==='agressiva'?0.88:(stance==='defensiva'?0.72:0.82);
      if(Math.random() < hitChance){
        var dmg = Math.max(2, (member.attack || 5) + rnd(5));
        if(stance==='agressiva') dmg=Math.round(dmg*1.3);
        if(stance==='defensiva' || stance==='suporte') dmg=Math.round(dmg*0.8);
        if(member.className==='Mago') dmg=Math.round(dmg*1.2);
        if(member.className==='Ladino' && Math.random()<0.25){ dmg=Math.round(dmg*1.65); RPG.UI.logEvent(member.name+' ativa Ataque Furtivo!'); }
        if((member.className==='Bárbaro' || member.className==='Barbaro') && member.hp<member.maxHp/2) dmg=Math.round(dmg*1.35);
        if(member.className==='Arqueiro' && Math.random()<0.25){ dmg=Math.round(dmg*1.5); RPG.UI.logEvent(member.name+' acerta um Tiro Crítico!'); }
        monster.status=monster.status||{};
        if(member.className==='Necromante'&&Math.random()<0.3){monster.status.enfraquecido={turns:2,amount:.2};RPG.UI.logEvent(member.name+' enfraquece o inimigo.');}
        if(member.className==='Druida'&&Math.random()<0.3){monster.status.veneno={turns:3,dmg:Math.max(2,Math.round(dmg*.2))};RPG.UI.logEvent(member.name+' envenena o inimigo.');}
        if(member.className==='Monge'&&Math.random()<0.22){monster.status.atordoado=(monster.status.atordoado||0)+1;RPG.UI.logEvent(member.name+' atordoa o inimigo.');}
        if(member.className==='Bardo'&&Math.random()<0.3){monster.status.vulneravel={turns:2,amount:.15};RPG.UI.logEvent(member.name+' deixa o inimigo vulnerável.');}
        if((member.className==='Caçador'||member.className==='Cacador')&&Math.random()<0.3){monster.status.sangramento={turns:3,dmg:Math.max(2,Math.round(dmg*.2))};RPG.UI.logEvent(member.name+' causa sangramento.');}
        if(member.className==='Paladino'&&Math.random()<0.25){var paladinHeal=Math.max(3,Math.round(dmg*.2));RPG.state.hero.hp=Math.min(RPG.state.hero.maxHp,RPG.state.hero.hp+paladinHeal);RPG.UI.logEvent(member.name+' restaura '+paladinHeal+' de Vida do herói.');}
        monster.hp -= dmg;
        total += dmg;
        RPG.UI.logEvent(member.name+' acerta '+monster.name+' e causa '+dmg+' de dano.');
      } else {
        RPG.UI.logEvent(member.name+' erra o ataque contra '+monster.name+'.');
      }
    });
    if(total>0){ RPG.Effects.floatText(document.getElementById('combatScene'), 'Equipe -'+total, 'crit'); }
    RPG.UI.renderHero();
    return monster.hp <= 0;
  }

  function tickHeroStatus(){
    var hero = RPG.state.hero;
    hero.buffs = hero.buffs || {};
    if(hero.buffs.poisonTurns>0){
      var dmg = hero.buffs.poisonDmg || 2;
      hero.hp = Math.max(0, hero.hp-dmg);
      hero.buffs.poisonTurns--;
      RPG.UI.logEvent('O veneno causa '+dmg+' de dano em você.');
      RPG.UI.renderHero();
      if(hero.hp<=0){ handleDefeat(); return true; }
    }
    return false;
  }

  function modifyDamageByAffinity(monster, dmg, type){
    if(monster.weakness===type) dmg = Math.round(dmg*1.25);
    if(monster.resistance===type) dmg = Math.round(dmg*0.8);
    if(monster.status && monster.status.vulneravel && monster.status.vulneravel.turns>0){dmg=Math.round(dmg*(1+(monster.status.vulneravel.amount||0.2)));monster.status.vulneravel.turns--;if(monster.status.vulneravel.turns<=0)delete monster.status.vulneravel;}
    if(monster.guardHits>0){dmg=Math.max(1,Math.round(dmg*.65));monster.guardHits--;RPG.UI.logEvent(monster.classPower+' reduz o dano recebido.');}
    return Math.max(1,dmg);
  }

  function triggerEnemyClassPower(monster,hero){
    if(!monster.enemyClass||monster.attackCount%3!==0)return 1;
    RPG.UI.logEvent(monster.classIcon+' <b>'+monster.classPower+'</b> é ativado!');
    if(monster.enemyClass.indexOf('Brutamontes')>=0)return 1.7;
    if(monster.enemyClass.indexOf('Assassino')>=0){monster.poisonStrike=true;return 1.4;}
    if(monster.enemyClass.indexOf('Xamã')>=0){var heal=Math.max(4,Math.round(monster.maxHp*.14));monster.hp=Math.min(monster.maxHp,monster.hp+heal);RPG.UI.logEvent(monster.name+' recupera '+heal+' de Vida.');return 1;}
    if(monster.enemyClass.indexOf('Guardião')>=0){monster.guardHits=2;return 1;}
    if(monster.enemyClass.indexOf('Feiticeiro')>=0){var drain=Math.min(hero.mp,Math.max(4,Math.round(monster.dmg*.6)));hero.mp-=drain;RPG.UI.logEvent(monster.name+' drena '+drain+' de Mana.');return 1.3;}
    return 1;
  }

  function applyPowerStatus(power, monster, derived){
    if(!power.status) return;
    monster.status = monster.status || {};
    if(power.status==='atordoado') monster.status.atordoado=(monster.status.atordoado||0)+(power.turns||1);
    else if(power.status==='veneno' || power.status==='sangramento' || power.status==='queimadura') monster.status[power.status]={turns:power.turns||3,dmg:Math.max(2,Math.round(Math.max(derived.dmgMagico,derived.dmgFisico)*(power.dotRatio||0.2)))};
    else monster.status[power.status]={turns:power.turns||3,amount:power.amount||0.2};
    RPG.UI.logEvent(monster.name+' sofre o efeito <b>'+power.status+'</b>.');
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
    var groupMsg = cell.monsters.length>1 ? ('Um grupo de '+cell.monsters.length+' criaturas aparece! O que você faz?') : ('Um '+monster.name+' aparece! O que você faz?');
    var danger = monster.dmg <= 5 ? 'Baixo' : (monster.dmg <= 10 ? 'Medio' : 'Alto');
    function combatLabel(value){ return { fisico:'físico', magico:'mágico', nenhuma:'nenhuma' }[value] || value; }
    var info = '<div class="enemy-preview">'+
      '<span>Vida <b>'+monster.hp+'</b></span><span>Dano <b>'+monster.dmg+' ('+danger+')</b></span><span>Velocidade <b>'+monster.speed+'</b></span><span>Classe <b>'+monster.classIcon+' '+monster.enemyClass+'</b></span>'+
      '<span>Fraqueza <b>'+combatLabel(monster.weakness)+'</b></span><span>Resistência <b>'+combatLabel(monster.resistance)+'</b></span>'+
      '<span class="enemy-ability">Habilidade <b>'+monster.ability+'</b>: '+monster.abilityDesc+'</span>'+
      '<span class="enemy-ability">Poder da classe <b>'+monster.classPower+'</b>: '+monster.classPowerDesc+'</span>'+
      (monster.isBoss ? '<span class="enemy-ability boss-info">Especial <b>'+monster.bossAbility+'</b>: '+monster.bossAbilityDesc+'</span>' : '')+
      '<span>Recompensa <b>'+monster.xp+' XP / '+monster.gold+' ouro</b></span></div>';
    RPG.UI.setSceneMessage(groupMsg+info);
    RPG.UI.logEvent((monster.isBoss?'Um CHEFE surge: ':'Um <b>')+monster.name+(monster.isBoss?'!':'</b> surge no caminho.'));
    RPG.UI.renderControls();
    if(RPG.Multiplayer)RPG.Multiplayer.broadcastAction('encounter',{x:cell.x,y:cell.y});
  }

  function attemptFlee(cell, phase){
    var state = RPG.state;
    var monster = currentMonster(cell);
    var bonus = fleeBonus(state.hero, monster);
    RPG.UI.setSceneMessage('Você tenta fugir da criatura...');
    rollDie(20, function(result){
      var total = result + bonus;
      var success = total >= 12;
      if(success){
        RPG.UI.logEvent('Você rolou '+result+(bonus? ' (+'+bonus+' por velocidade)':'')+' e fugiu com sucesso.');
        if(phase === 'combat'){ exitCombat(cell, false); }
        else {
          state.mode = 'move'; state.pendingMonsterCell = null;
          RPG.UI.setSceneMessage('Você se afasta antes que a criatura reaja.');
          document.getElementById('npcCard').style.display = 'none';
          RPG.UI.renderControls();
        }
      } else {
        RPG.UI.logEvent('Você rolou '+result+(bonus? ' (+'+bonus+' por velocidade)':'')+' e não conseguiu fugir.');
        if(phase === 'pre'){
          RPG.UI.setSceneMessage('A fuga falha! A criatura parte para cima de você.');
          startCombat(cell);
        } else {
          if(tickMonsterDot(cell)){ handleMonsterDefeated(cell); return; }
          applyMonsterHit(cell);
          updateCombatPanel(cell);
        }
      }
    });
  }

  function applyMonsterHit(cell){
    var state = RPG.state;
    var hero = state.hero;
    var monster = currentMonster(cell);
    hero.buffs = hero.buffs || {};

    if(monster.status && monster.status.atordoado > 0){
      monster.status.atordoado--;
      RPG.UI.setSceneMessage('O '+monster.name+' está atordoado e não consegue atacar!');
      RPG.UI.logEvent('O '+monster.name+' perde o turno, atordoado.');
      return;
    }

    monster.attackCount = (monster.attackCount||0)+1;
    if(monster.isBoss && !monster.isMainBoss && monster.hp <= monster.maxHp/2 && !monster.rageTriggered){
      monster.rageTriggered = true;
      monster.dmg += 3;
      RPG.UI.logEvent('<b>'+monster.bossAbility+'</b>: o chefe entra em fúria e aumenta seu dano!');
    }
    var attackMult = 1;
    if(monster.status && monster.status.enfraquecido && monster.status.enfraquecido.turns>0){attackMult*=1-(monster.status.enfraquecido.amount||0.25);monster.status.enfraquecido.turns--;}
    if(monster.status && monster.status.lento && monster.status.lento.turns>0){if(Math.random()<(monster.status.lento.amount||0.2)){monster.status.lento.turns--;RPG.UI.logEvent(monster.name+' está lento e perde o ataque.');return;}monster.status.lento.turns--;}
    if(monster.behavior==='agressivo' && Math.random()<0.25){ attackMult=1.45; RPG.UI.logEvent(monster.ability+' aumenta a força do golpe!'); }
    if(monster.behavior==='lento' && monster.attackCount%3===0){ attackMult=1.7; RPG.UI.logEvent(monster.ability+' acerta com grande impacto!'); }
    if(monster.isMainBoss && monster.attackCount%3===0){ attackMult=1.9; RPG.UI.logEvent('<b>'+monster.bossAbility+'</b> é ativado!'); }
    attackMult*=triggerEnemyClassPower(monster,hero);

    var livingParty = (state.party || []).filter(function(m){ return m.hp > 0; });
    var defenders=livingParty.filter(function(m){ return (m.stance||'equilibrada')==='defensiva' || m.className==='Guerreiro'; });
    var targetPool=null;
    if(defenders.length && Math.random()<0.55) targetPool=defenders;
    else if(livingParty.length && Math.random()<0.3) targetPool=livingParty;
    if(targetPool){
      var target = targetPool[rnd(targetPool.length)];
      var partyDmg = Math.max(1, Math.round(((1+rnd(6)) + monster.dmg - 1)*attackMult));
      target.hp = Math.max(0, target.hp - partyDmg);
      RPG.UI.logEvent('O '+monster.name+' ataca '+target.name+' e causa '+partyDmg+' de dano.'+(target.hp<=0?' O companheiro caiu!':''));
      RPG.UI.setSceneMessage(target.hp<=0 ? target.name+' caiu em combate!' : 'A criatura ataca '+target.name+'!');
      RPG.UI.renderHero();
      return;
    }

    var d = hero.derived || RPG.Player.getDerived(hero);
    var dodge = d.esquiva + (hero.buffs.esquivaTurns>0 ? (hero.buffs.esquivaAmount||0) : 0);
    if(hero.buffs.esquivaTurns>0) hero.buffs.esquivaTurns--;
    if(Math.random()*100 < dodge){
      RPG.UI.setSceneMessage('Você esquiva do ataque do '+monster.name+'!');
      RPG.UI.logEvent('Você esquiva do ataque do '+monster.name+'.');
      return;
    }

    var bonus = RPG.Player.equipmentBonus(hero);
    var dmg = Math.max(1, Math.round(((1+rnd(6)) + monster.dmg - Math.floor((bonus.defesa||0)/3) - Math.floor(d.resistMagica/4))*attackMult));
    if(RPG.Player.hasDebuffEffect(hero, 'fireVulnerability') && (monster.behavior==='magico' || monster.name.indexOf('Fogo')>=0)){
      dmg = Math.max(1, Math.round(dmg*1.25));
    }
    if(RPG.Player.hasDebuffEffect(hero, 'physicalVulnerability')) dmg=Math.max(1,Math.round(dmg*1.2));
    if(hero.buffs.shield > 0){
      dmg = Math.max(1, Math.round(dmg*(1-hero.buffs.shield)));
      hero.buffs.shield = 0;
      RPG.UI.logEvent('O escudo arcano absorve parte do golpe.');
    }
    hero.hp = Math.max(0, hero.hp - dmg);
    if(monster.poisonStrike){monster.poisonStrike=false;hero.buffs.poisonTurns=3;hero.buffs.poisonDmg=Math.max(2,Math.round(monster.dmg*.35));RPG.UI.logEvent('A Lâmina Tóxica envenena você.');}
    if(monster.behavior==='venenoso' && Math.random()<0.35){
      hero.buffs.poisonTurns = 3; hero.buffs.poisonDmg = Math.max(2,Math.round(Math.floor(monster.dmg/3)*(RPG.Player.hasDebuffEffect(hero,'poisonVulnerability')?1.5:1)));
      RPG.UI.logEvent(monster.ability+' envenena você por 3 turnos!');
    }
    if(monster.behavior==='magico' && Math.random()<0.35){
      var drained = Math.min(hero.mp, 3+Math.floor(monster.dmg/3));
      hero.mp -= drained;
      RPG.UI.logEvent(monster.ability+' drena '+drained+' de Mana.');
    }
    RPG.UI.renderHero();
    RPG.Effects.shakeElement(document.getElementById('playerPanel'));
    RPG.Effects.floatText(document.getElementById('combatScene'), '-'+dmg, 'dmg');
    RPG.Effects.playSfx('hit');
    RPG.UI.setSceneMessage('A criatura acerta um golpe ('+dmg+' de dano)!');
    RPG.UI.logEvent('O '+monster.name+' causa '+dmg+' de dano em você.');
    if(hero.hp <= 0){ handleDefeat(); }
  }

  function handleDefeat(){
    var state = RPG.state;
    state.hero.hp = Math.max(1, Math.floor(state.hero.maxHp*0.3));
    RPG.UI.renderHero();
    RPG.Effects.playSfx('defeat');
    RPG.UI.logEvent('<b>Você quase morreu!</b> Seus aliados o arrastam de volta para a cidade mais próxima.');
    (state.party||[]).forEach(function(m){ m.hp = Math.max(1, Math.floor(m.maxHp*0.3)); });
    state.mode = 'move';
    state.pendingMonsterCell = null;
    document.getElementById('sceneText').classList.remove('hidden');
    document.getElementById('combatScene').classList.add('hidden');
    RPG.UI.enterCity();
    RPG.Save.save(state);
  }

  function startCombat(cell){
    var state = RPG.state;
    state.mode = 'combat';
    state.pendingMonsterCell = cell;
    state.hero.buffs = {};
    if(state.hero.npcBlessing && state.hero.npcBlessing.combats>0){
      state.hero.buffs.esquivaTurns=999;
      state.hero.buffs.esquivaAmount=state.hero.npcBlessing.dodge;
      state.hero.npcBlessing.combats--;
      RPG.UI.logEvent('A bênção recebida concede +'+state.hero.npcBlessing.dodge+'% de Esquiva neste combate.');
      if(state.hero.npcBlessing.combats<=0) delete state.hero.npcBlessing;
    }
    document.getElementById('sceneText').classList.add('hidden');
    document.getElementById('combatScene').classList.remove('hidden');
    RPG.UI.setSceneMessage('O combate começa! Ataque, use um poder ou tente fugir.');
    renderCombatScene(cell);
    if(RPG.Tutorial)RPG.Tutorial.event('combat');
    RPG.UI.renderControls();
    if(RPG.Multiplayer) RPG.Multiplayer.sync();
  }

  function powerButtonsHtml(hero){
    if(!hero.powers || !hero.powers.length) return '';
    var html = '<div class="power-row">';
    hero.powers.forEach(function(p, i){
      var shownCost=Math.ceil(p.cost*(RPG.Player.hasDebuffEffect(hero,'manaCostPenalty')?1.2:1));
      var canUse = hero.mp >= shownCost;
      html += '<button class="power-btn'+(canUse?'':' disabled')+'" data-idx="'+i+'">'+p.icon+' '+p.name+' <span class="mp-cost">('+shownCost+' MP)</span></button>';
    });
    html += '</div>';
    return html;
  }

  function renderCombatScene(cell){
    var hero = RPG.state.hero;
    var monster = currentMonster(cell);
    var el = document.getElementById('combatScene');
    el.className = 'combat-scene' + (monster.isBoss ? ' boss' : '');
    var progress = cell.monsters.length>1 ? ('<div class="cs-hp">Inimigo '+(cell.monsterIndex+1)+' de '+cell.monsters.length+'</div>') : '';
    var statusTags = '';
    if(monster.status){
      Object.keys(monster.status).forEach(function(k){
        var labels = { queimadura:'\ud83d\udd25 Queimando', sangramento:'\ud83e\ude78 Sangrando', veneno:'\u2623\ufe0f Envenenado', atordoado:'\ud83d\udcab Atordoado', enfraquecido:'\ud83d\udcc9 Enfraquecido', vulneravel:'\ud83c\udfaf Vulnerável', lento:'\u2744\ufe0f Lento' };
        statusTags += '<span class="status-tag">'+(labels[k]||k)+'</span>';
      });
    }
    var mageAttack=hero.className==='Mago';
    el.innerHTML =
      '<div class="cs-icon">'+monster.icon+'</div>'+
      '<div class="cs-name">'+monster.name+(monster.isBoss?' \ud83d\udc51':'')+'</div>'+
      '<div class="cs-hp enemy-class-line">'+monster.classIcon+' '+monster.enemyClass+' · '+monster.classPower+'</div>'+
      progress +
      '<div class="cs-hp">Vida da criatura: '+Math.max(0,monster.hp)+' / '+monster.maxHp+'</div>'+
      (statusTags ? '<div class="status-tags">'+statusTags+'</div>' : '') +
      '<div class="combat-actions">'+
        (mageAttack?'<button class="attack" id="combatAttackBtn" '+(hero.mp<5?'disabled':'')+'>Ataque Mágico (d20 · 5 MP)</button><button class="attack staff-attack" id="combatPhysicalBtn">Ataque Físico (d20)</button>':'<button class="attack" id="combatAttackBtn">Atacar (d20)</button>')+
        '<button class="flee" id="combatFleeBtn">Fugir da Batalha</button>'+
      '</div>'+
      powerButtonsHtml(hero);
    document.getElementById('combatAttackBtn').addEventListener('click', function(){
      rollDie(20, function(result){ resolveAttack(cell,result,mageAttack?'magic':'normal'); });
    });
    var physicalBtn=document.getElementById('combatPhysicalBtn');if(physicalBtn)physicalBtn.addEventListener('click',function(){rollDie(20,function(result){resolveAttack(cell,result,'physical');});});
    document.getElementById('combatFleeBtn').addEventListener('click', function(){
      attemptFlee(cell, 'combat');
    });
    Array.prototype.forEach.call(el.querySelectorAll('.power-btn'), function(btn){
      btn.addEventListener('click', function(){
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        usePower(cell, hero.powers[idx]);
      });
    });
  }

  function updateCombatPanel(cell){ renderCombatScene(cell); }

  function resolveAttack(cell, roll, attackStyle){
    var state = RPG.state;
    var hero = state.hero;
    if(tickHeroStatus()) return;
    hero.buffs = hero.buffs || {};
    var isMage=hero.className==='Mago',magicalAttack=isMage&&attackStyle==='magic',magicAttackCost=5;
    if(magicalAttack){if(hero.mp<magicAttackCost){RPG.UI.setSceneMessage('Mana insuficiente. Use o ataque físico.');updateCombatPanel(cell);return;}hero.mp-=magicAttackCost;RPG.UI.renderHero();}
    var monster = currentMonster(cell);
    var d = hero.derived || RPG.Player.getDerived(hero);
    var bonus = RPG.Player.equipmentBonus(hero);
    var affinity = weaponAffinityPct(hero);
    var guaranteedCrit = !!hero.buffs.critNext;
    var hitTarget = 11;
    if(hero.buffs.precisaoTurns>0){ hitTarget = Math.max(4, hitTarget - Math.floor((hero.buffs.precisaoAmount||0)/5)); }
    var weapon = hero.equip.arma;
    if(RPG.Player.hasDebuffEffect(hero, 'rangedPenalty') && weapon && (weapon.templateId==='arco' || weapon.templateId==='cajado')){
      hitTarget += 2;
    }
    var hit = roll >= hitTarget || guaranteedCrit;
    if(hit && !guaranteedCrit && roll!==20 && monster.behavior==='agil' && Math.random()<0.15){
      hit = false;
      RPG.UI.logEvent(monster.ability+' permite que '+monster.name+' evite seu ataque.');
    }
    if(hit){
      var forcaMult = hero.buffs.forcaTurns>0 ? (1+(hero.buffs.forcaAmount||0)) : 1;
      var base = 3+rnd(6),dmg;
      if(magicalAttack){dmg=Math.round(base+d.dmgMagico+weaponAtkContribution(hero,affinity)+otherEquipAtk(hero));dmg=modifyDamageByAffinity(monster,dmg,'magico');}
      else {var physicalBase=isMage&&attackStyle==='physical'?Math.round(d.dmgFisico*.5):d.dmgFisico;dmg=Math.round((base+physicalBase+weaponAtkContribution(hero,affinity)+otherEquipAtk(hero))*forcaMult);dmg=modifyDamageByAffinity(monster,dmg,'fisico');}
      var critChance = (d.critico + (bonus.critico||0))/100;
      var isCrit = guaranteedCrit || Math.random() < critChance || roll === 20;
      if(isCrit){ dmg = Math.round(dmg*1.6); }
      monster.hp -= dmg;
      RPG.Effects.floatText(document.getElementById('combatScene'), (isCrit?'CRITICO! ':'')+'-'+dmg, isCrit?'crit':'dmg');
      RPG.Effects.playSfx(isCrit?'crit':'hit');
      RPG.UI.logEvent('Você acerta o '+monster.name+' causando '+dmg+' de dano '+(magicalAttack?'mágico':'físico')+(isCrit?' (crítico!)':'')+(affinity<100?' (afinidade de arma '+affinity+'%)':'')+'.');
      RPG.UI.setSceneMessage(isCrit ? 'Golpe crítico! Você causa '+dmg+' de dano.' : 'Golpe certeiro! Você causa '+dmg+' de dano.');
      hero.buffs.critNext = false;
      if(hero.buffs.precisaoTurns>0) hero.buffs.precisaoTurns--;
      if(hero.buffs.forcaTurns>0) hero.buffs.forcaTurns--;
      applyWeaponProc(hero, monster);
      if(monster.hp <= 0){ handleMonsterDefeated(cell); return; }
    } else {
      RPG.Effects.playSfx('miss');
      RPG.UI.setSceneMessage('Você erra o ataque!');
      if(hero.buffs.precisaoTurns>0) hero.buffs.precisaoTurns--;
      if(hero.buffs.forcaTurns>0) hero.buffs.forcaTurns--;
    }
    if(applyPartyTurn(cell)){ handleMonsterDefeated(cell); return; }
    if(tickMonsterDot(cell)){ handleMonsterDefeated(cell); return; }
    applyMonsterHit(cell);
    updateCombatPanel(cell);
    if(RPG.Multiplayer) RPG.Multiplayer.commit();
  }

  function usePower(cell, power){
    var state = RPG.state;
    var hero = state.hero;
    if(tickHeroStatus()) return;
    var manaCost=Math.ceil(power.cost*(RPG.Player.hasDebuffEffect(hero,'manaCostPenalty')?1.2:1));
    if(hero.mp < manaCost){
      RPG.UI.setSceneMessage('Mana insuficiente para usar '+power.name+'.');
      return;
    }
    hero.buffs = hero.buffs || {};
    hero.mp -= manaCost;
    var d = hero.derived || RPG.Player.getDerived(hero);
    var monster = currentMonster(cell);
    var msg = '';

    if(power.type === 'dano_fisico' || power.type === 'dano_magico'){
      var base = power.type === 'dano_fisico' ? d.dmgFisico : d.dmgMagico;
      var dmg = Math.round(base*power.power) + rnd(6);
      dmg = modifyDamageByAffinity(monster,dmg,power.type==='dano_magico'?'magico':'fisico');
      monster.hp -= dmg;
      applyPowerStatus(power,monster,d);
      if(power.healRatio){var drainHeal=Math.max(1,Math.round(dmg*power.healRatio));hero.hp=Math.min(hero.maxHp,hero.hp+drainHeal);}
      RPG.Effects.floatText(document.getElementById('combatScene'), power.icon+' -'+dmg, power.type==='dano_magico'?'crit':'dmg');
      RPG.Effects.playSfx('crit');
      msg = 'Você usa '+power.name+' e causa '+dmg+' de dano!';
      RPG.UI.logEvent(msg);
      RPG.UI.renderHero();
      if(monster.hp <= 0){ RPG.UI.setSceneMessage(msg); handleMonsterDefeated(cell); return; }
    } else if(power.type === 'cura'){
      var heal = Math.round((10*power.power + d.curaBonus)*(RPG.Player.hasDebuffEffect(hero,'healingPenalty')?0.75:1));
      hero.hp = Math.min(hero.maxHp, hero.hp+heal);
      var allyHeal=Math.max(1,Math.round(heal*.7));
      (state.party||[]).forEach(function(member){if(member.hp>0)member.hp=Math.min(member.maxHp,member.hp+allyHeal);});
      if(RPG.Multiplayer)RPG.Multiplayer.healTeam(allyHeal);
      msg = 'Você usa '+power.name+' e recupera '+heal+' de Vida. A equipe recupera '+allyHeal+'.';
      RPG.UI.logEvent(msg);
      RPG.UI.renderHero();
    } else if(power.type === 'buff_crit'){
      hero.buffs.critNext = true;
      msg = 'Você se prepara: o próximo ataque será um crítico garantido.';
      RPG.UI.renderHero();
    } else if(power.type === 'buff_precisao'){
      hero.buffs.precisaoTurns = power.turns; hero.buffs.precisaoAmount = power.amount;
      msg = 'Sua precisão aumenta pelos próximos '+power.turns+' ataques.';
      RPG.UI.renderHero();
    } else if(power.type === 'buff_forca'){
      hero.buffs.forcaTurns = power.turns; hero.buffs.forcaAmount = power.amount;
      msg = 'Seu dano físico aumenta pelos próximos '+power.turns+' ataques.';
      RPG.UI.renderHero();
    } else if(power.type === 'buff_esquiva'){
      hero.buffs.esquivaTurns = power.turns; hero.buffs.esquivaAmount = power.amount;
      msg = 'Sua chance de esquiva aumenta por um tempo.';
      RPG.UI.renderHero();
    } else if(power.type === 'escudo'){
      hero.buffs.shield = power.amount;
      msg = 'Uma barreira arcana irá absorver o próximo golpe recebido.';
      RPG.UI.renderHero();
    }

    RPG.UI.setSceneMessage(msg);
    if(applyPartyTurn(cell)){ handleMonsterDefeated(cell); return; }
    if(tickMonsterDot(cell)){ handleMonsterDefeated(cell); return; }
    applyMonsterHit(cell);
    updateCombatPanel(cell);
    if(RPG.Multiplayer) RPG.Multiplayer.commit();
  }

  function advanceAfterBoss(defeatedBossName){
    var state=RPG.state;state.floor++;var nextStart=RPG.Dungeon.generate(state);RPG.UI.resetPlayerToStart(nextStart);
    state.mode='move';state.pendingMonsterCell=null;state.hero.buffs={};document.getElementById('sceneText').classList.remove('hidden');document.getElementById('combatScene').classList.add('hidden');document.getElementById('npcCard').style.display='none';
    RPG.UI.renderMap();RPG.UI.renderControls();RPG.UI.setSceneMessage('O chefe foi derrotado! O caminho se abre e o grupo avança automaticamente para o <b>Andar '+state.floor+'</b>.');RPG.UI.logEvent('Após vencer <b>'+(defeatedBossName||'o chefe')+'</b>, o grupo avança automaticamente para o Andar '+state.floor+'.');RPG.Save.save(state);
  }

  function handleMonsterDefeated(cell){
    var state = RPG.state;
    var monster = currentMonster(cell);
    state.hero.killCount = (state.hero.killCount||0) + 1;
    RPG.Quests.onMonsterKilled(state);
    RPG.Effects.playSfx('victory');
    state.hero.gold += monster.gold;
    if(RPG.Multiplayer){
      RPG.Multiplayer.grantSharedXP(monster.xp);
      RPG.Multiplayer.grantSharedGold(monster.gold);
    }
    var xpRes = RPG.Player.gainXP(state.hero, monster.xp);
    RPG.UI.logEvent('Você derrotou <b>'+monster.name+'</b>! Todos os heróis recebem +'+monster.xp+' XP e +'+monster.gold+' ouro.');
    RPG.UI.renderHero();
    if(xpRes.leveledUp){ RPG.UI.onLevelUp(xpRes.levels); }

    if(cell.monsterIndex + 1 < cell.monsters.length){
      cell.monsterIndex++;
      var next = currentMonster(cell);
      RPG.UI.setSceneMessage('Mais um inimigo entra na luta: '+next.name+'!');
      RPG.UI.logEvent('<b>'+next.name+'</b> aparece para continuar a briga.');
      renderCombatScene(cell);
      RPG.Save.save(state);
      return;
    }

    cell.beaten = true;
    (state.party||[]).forEach(function(member){
      if(member.temporary) member.combatsLeft--;
    });
    var departing=(state.party||[]).filter(function(member){ return member.temporary && member.combatsLeft<=0; });
    departing.forEach(function(member){ RPG.UI.logEvent(member.name+' se despede da equipe após cumprir sua promessa.'); });
    state.party=(state.party||[]).filter(function(member){ return !member.temporary || member.combatsLeft>0; });
    var gotLoot = false, lootItem = null;
    var lootChance = cell.type==='boss' ? 0.95 : 0.5;
    if(Math.random() < lootChance){
      lootItem = RPG.Items.randomItem({ floor: state.floor });
      RPG.Inventory.addItem(state, lootItem);
      RPG.Quests.onItemCollected(state);
      RPG.UI.logEvent('Encontrou <b>'+lootItem.name+'</b> ('+lootItem.rarityLabel+') após a batalha.');
      gotLoot = true;
    }
    var bonusMsg = '';
    if(cell.bonusTreasure){
      if(cell.bonusTreasure.gold){
        state.hero.gold += cell.bonusTreasure.gold;
        RPG.UI.logEvent('Com a sala livre de perigo, você encontra mais <b>'+cell.bonusTreasure.gold+' de ouro</b> escondido.');
        bonusMsg = ' Você também encontra ouro escondido na sala.';
      } else if(cell.bonusTreasure.item){
        RPG.Inventory.addItem(state, cell.bonusTreasure.item);
        RPG.UI.logEvent('Com a sala livre de perigo, você encontra <b>'+cell.bonusTreasure.item.name+'</b> escondido.');
        bonusMsg = ' Você também encontra um item escondido na sala.';
      }
      RPG.UI.renderHero();
    }
    if(cell.type==='boss'){
      var defeatedBossName=monster.name;
      if(RPG.Multiplayer&&RPG.Multiplayer.session.connected&&RPG.Multiplayer.session.role!==1){exitCombat(cell,true,lootItem,bonusMsg);RPG.Multiplayer.requestBossAdvance(defeatedBossName);return;}
      advanceAfterBoss(defeatedBossName);return;
    }
    RPG.Save.save(state);
    exitCombat(cell, true, lootItem, bonusMsg);
  }

  function exitCombat(cell, victory, lootItem, bonusMsg){
    var state = RPG.state;
    state.mode = 'move';
    state.pendingMonsterCell = null;
    state.hero.buffs = {};
    document.getElementById('sceneText').classList.remove('hidden');
    document.getElementById('combatScene').classList.add('hidden');
    document.getElementById('npcCard').style.display = 'none';
    if(victory){
      RPG.UI.setSceneMessage('Você venceu a batalha!' +
        (lootItem ? ' Encontrou <b>'+lootItem.name+'</b>: <span class="item-found-desc">'+lootItem.desc+'</span>' : '') +
        (bonusMsg||''));
    }
    else { RPG.UI.setSceneMessage('Você escapa da batalha, ofegante.'); }
    RPG.UI.renderMap();
    RPG.UI.renderControls();
    RPG.Save.save(state);
  }

  return {
    rollDie: rollDie,
    weaponAffinityPct: weaponAffinityPct,
    startEncounterChoice: startEncounterChoice, attemptFlee: attemptFlee,
    startCombat: startCombat, resolveAttack: resolveAttack, usePower: usePower,advanceAfterBoss:advanceAfterBoss,
    refresh: updateCombatPanel
  };
})();
