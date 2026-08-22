/* =========================================================
   RPG Legend - js/ui.js
   Cola tudo: renderizacao da ficha, exploracao com neblina,
   controles de movimento, dialogo e modais.
   ========================================================= */
var RPG = window.RPG || {};

RPG.UI = (function(){

  var creation = { name:"", race:null, cls:null, powers:[], debuff:null, mode:"solo" };

  function rnd(n){ return Math.floor(Math.random()*n); }
  function pick(arr){ return arr[rnd(arr.length)]; }

  /* ================= LOG ================= */
  function logEvent(html){
    var list = document.getElementById('logList');
    if(!list) return;
    var div = document.createElement('div');
    div.className = 'log-item';
    div.innerHTML = html;
    list.insertBefore(div, list.firstChild);
    while(list.children.length > 80){ list.removeChild(list.lastChild); }
  }

  /* ================= CREATION SCREEN ================= */
  function buildPickGrid(containerId, items, onClick){
    var el = document.getElementById(containerId);
    el.innerHTML = '';
    items.forEach(function(it){
      var card = document.createElement('div');
      card.className = 'pick-card';
      card.innerHTML = '<div class="pc-top"><span class="pc-icon">'+it.icon+'</span><span class="pc-name">'+it.name+'</span></div><div class="pc-desc">'+it.desc+'</div>';
      card.addEventListener('click', function(){ onClick(it, card); });
      el.appendChild(card);
    });
  }

  function rouletteCard(it,label){return '<div class="pick-card selected signature"><div class="pc-top"><span class="pc-icon">'+it.icon+'</span><span class="pc-name">'+it.name+(label?' <small>('+label+')</small>':'')+'</span></div><div class="pc-desc">'+it.desc+'</div></div>';}
  function renderPowerGrid(){
    var el = document.getElementById('powerGrid');
    el.innerHTML = '';
    var sigName = creation.cls ? creation.cls.signature : null;
    if(sigName){var signature=RPG.Player.powerByName(sigName);if(signature)el.innerHTML+=rouletteCard(signature,'poder da classe');}
    creation.powers.forEach(function(power){el.innerHTML+=rouletteCard(power,'poder da roleta');});
    if(!creation.powers.length)el.innerHTML+='<div class="roulette-result-placeholder">Gire a Roleta do Destino para descobrir seus dois poderes adicionais.</div>';
  }
  function renderDebuffResult(){var el=document.getElementById('debuffGrid');el.innerHTML=creation.debuff?rouletteCard(creation.debuff,'fraqueza sorteada'):'<div class="roulette-result-placeholder">Gire a Roleta do Destino para descobrir sua fraqueza.</div>';}
  function renderAttrsResult(){
    var el = document.getElementById('creationAttrGrid');
    el.innerHTML = '';
    if(!creation.attrs){ el.innerHTML = '<div class="roulette-result-placeholder">Gire a Roleta do Destino para sortear suas características.</div>'; return; }
    RPG.Player.ATTR_KEYS.forEach(function(k){
      var cell = document.createElement('div');
      cell.className = 'attr-cell';
      cell.innerHTML = '<div class="k">'+RPG.Player.ATTR_LABELS[k]+'</div><div class="v">'+creation.attrs[k]+'</div>';
      el.appendChild(cell);
    });
  }
  // marca um botao de roleta como usado -- so pode ser girado uma vez por criacao
  function lockRouletteButton(button,label){
    button.disabled = true;
    button.classList.add('roulette-used');
    button.textContent = label;
  }
  function unlockRouletteButton(button,label){
    button.disabled = false;
    button.classList.remove('roulette-used');
    button.textContent = label;
  }
  // marca no grid de cards (raca/classe) o item escolhido pela roleta
  function selectGridCard(containerId, items, chosen){
    var idx = items.indexOf(chosen);
    var el = document.getElementById(containerId);
    Array.prototype.forEach.call(el.children, function(c,i){ c.classList.toggle('selected', i===idx); });
  }
  // sorteia 2 poderes adicionais (sem repetir o poder de assinatura da classe atual)
  function rerollPowers(){
    var pool = RPG.Player.POWERS.filter(function(p){ return p.name!==creation.cls.signature; });
    var shuffled = pool.slice().sort(function(){ return Math.random()-.5; });
    creation.powers = shuffled.slice(0,2);
    renderPowerGrid();
  }
  // recalcula os atributos sempre que raca/classe/fraqueza mudam depois do sorteio inicial
  function rerollAttrsIfReady(){
    if(creation.race && creation.cls && creation.debuff){
      creation.attrs = RPG.Player.rollAttrs(creation.race, creation.cls, creation.debuff);
      renderAttrsResult();
    }
  }
  function rollEverything(){
    creation.race = pick(RPG.Player.RACES);
    creation.cls = pick(RPG.Player.CLASSES);
    selectGridCard('raceGrid', RPG.Player.RACES, creation.race);
    selectGridCard('classGrid', RPG.Player.CLASSES, creation.cls);
    rerollPowers();
    creation.debuff = pick(RPG.Player.DEBUFFS);
    renderDebuffResult();
    creation.attrs = RPG.Player.rollAttrs(creation.race, creation.cls, creation.debuff);
    renderAttrsResult();
  }
  // a animacao de roleta, tirada de dentro do "Rolar Tudo" para os botoes de
  // regirar usarem a mesma -- mesma sensacao, um lugar so pra mexer.
  // `amostra` e opcional: nos atributos nao ha lista pra piscar, entao o
  // botao so pulsa com o proprio texto.
  function animarRoleta(btn, amostra, voltas, aoTerminar){
    var original = btn.textContent, count = 0;
    btn.classList.add('rolling'); btn.disabled = true;
    var timer = setInterval(function(){
      if(amostra){ var flavor = pick(amostra); btn.textContent = flavor.icon+' '+flavor.name; }
      if(++count >= voltas){
        clearInterval(timer);
        btn.classList.remove('rolling'); btn.textContent = original; btn.disabled = false;
        aoTerminar(); clearError(); atualizarRegiros();
      }
    }, 70);
  }
  // regirar poder precisa da classe (o sorteio exclui o poder de assinatura
  // dela) e regirar atributo precisa de raca, classe e fraqueza -- sem isso
  // o sorteio estoura. Em vez de deixar quebrar, o botao fica desligado ate
  // haver o que sortear.
  function atualizarRegiros(){
    var pronto = {
      rerollPowersBtn: !!creation.cls,
      rerollDebuffBtn: true,
      rerollAttrsBtn: !!(creation.race && creation.cls && creation.debuff)
    };
    Object.keys(pronto).forEach(function(id){
      var btn = document.getElementById(id);
      if(!btn) return;
      btn.disabled = !pronto[id];
      btn.classList.toggle('roulette-used', !pronto[id]);
    });
  }

  function renderCreationScreen(){
    var accountUser = (RPG.Account && RPG.Account.currentUser && RPG.Account.currentUser()) || null;
    var defaultName = accountUser ? accountUser.username : '';
    creation = { name:defaultName, race:null, cls:null, powers:[], debuff:null, attrs:null, mode:"solo" };
    document.getElementById('nameInput').value = defaultName;

    var allBtn = document.getElementById('rollAllBtn');
    unlockRouletteButton(allBtn, '🎲 Rolar Tudo');

    buildPickGrid('raceGrid', RPG.Player.RACES, function(it, card){
      creation.race = it;
      Array.prototype.forEach.call(document.getElementById('raceGrid').children, function(c){ c.classList.remove('selected'); });
      card.classList.add('selected'); clearError();
      rerollAttrsIfReady();
      atualizarRegiros();
    });
    buildPickGrid('classGrid', RPG.Player.CLASSES, function(it, card){
      creation.cls = it;
      Array.prototype.forEach.call(document.getElementById('classGrid').children, function(c){ c.classList.remove('selected'); });
      card.classList.add('selected'); clearError();
      if(creation.powers.length) rerollPowers(); else renderPowerGrid();
      rerollAttrsIfReady();
      atualizarRegiros();
    });
    renderPowerGrid();
    renderDebuffResult();
    renderAttrsResult();

    allBtn.onclick=function(){ animarRoleta(this, RPG.Player.CLASSES, 14, rollEverything); };

    // Regiros por secao: pra quem nao gostou so da fraqueza nao precisar
    // sortear tudo de novo. Menos voltas que o "Rolar Tudo" porque sao um
    // ajuste, nao o momento da criacao.
    document.getElementById('rerollPowersBtn').onclick=function(){
      animarRoleta(this, RPG.Player.POWERS, 8, rerollPowers);
    };
    document.getElementById('rerollDebuffBtn').onclick=function(){
      animarRoleta(this, RPG.Player.DEBUFFS, 8, function(){
        creation.debuff = pick(RPG.Player.DEBUFFS);
        renderDebuffResult();
        // atributo depende da fraqueza (a tela diz isso), entao acompanha
        rerollAttrsIfReady();
      });
    };
    document.getElementById('rerollAttrsBtn').onclick=function(){
      animarRoleta(this, null, 8, function(){
        creation.attrs = RPG.Player.rollAttrs(creation.race, creation.cls, creation.debuff);
        renderAttrsResult();
      });
    };
    atualizarRegiros();

    document.getElementById('nameInput').oninput = function(e){ creation.name = e.target.value; clearError(); };
  }

  function showError(msg){ document.getElementById('creationError').textContent = msg; }
  function clearError(){ document.getElementById('creationError').textContent = ''; }

  function validateCreation(){
    var name = document.getElementById('nameInput').value.trim();
    if(!name){ showError('Dê um nome ao seu herói.'); return false; }
    if(!creation.race || !creation.cls || creation.powers.length!==2 || !creation.debuff || !creation.attrs){ showError('Gire a Roleta do Destino antes de começar.'); return false; }
    creation.name = name;
    return true;
  }

  function startAdventure(){
    if(!validateCreation()) return;
    var state = RPG.state;
    state.hero = RPG.Player.buildHero(creation);
    state.tutorial = RPG.Tutorial.create(document.getElementById('tutorialEnabled').checked);
    state.inventory = [];
    RPG.Inventory.addItem(state, RPG.Items.randomItem({ category:'consumivel', floor:1 }));
    state.party = [];
    state.floor = 1;
    state.quests = [];
    state.cityMap = null;
    state.cityStart = null;
    RPG.Quests.ensureBoard(state);

    // No multiplayer, o convidado cria apenas o próprio herói. O mapa da
    // aventura será recebido de quem criou a sala.
    if(RPG.Multiplayer && RPG.Multiplayer.isGuestCreating()){
      RPG.Multiplayer.finishGuestCreation(state);
      return;
    }

    RPG.UI.showScreen('game');
        document.getElementById('rollDie').textContent = '-';
    document.getElementById('rollDie').className = 'roll-die';
    document.getElementById('rollInfo').textContent = 'Escolha um dado para rolar.';
    document.getElementById('logList').innerHTML = '';

    renderHero();
    enterCity();
    resetDialogue();
    logEvent('<b>'+state.hero.name+'</b> ('+state.hero.race+' '+state.hero.className+') chega a cidade inicial'+(state.party.length? ' acompanhado de sua equipe.':'.'));
    RPG.Save.save(state);
    RPG.Tutorial.start();
    if(RPG.Multiplayer && RPG.Multiplayer.showHostLobby) RPG.Multiplayer.showHostLobby();
  }

  /* ================= HERO PANEL ================= */
  function renderHero(){
    var h = RPG.state.hero;
    if(!h) return;
    var heroAvatarEl = document.getElementById('heroAvatar');
    var accountUser = RPG.Account && RPG.Account.currentUser ? RPG.Account.currentUser() : null;
    heroAvatarEl.innerHTML = (accountUser && accountUser.avatarUrl)
      ? '<img src="'+accountUser.avatarUrl+'" alt="Foto de perfil" class="hero-avatar-img">'
      : h.raceIcon;
    document.getElementById('heroName').textContent = h.name;
    document.getElementById('heroClass').textContent = h.race + ' \u00b7 ' + h.className;
    document.getElementById('heroLevel').textContent = 'Nível ' + h.level;

    document.getElementById('hpText').textContent = h.hp + ' / ' + h.maxHp;
    document.getElementById('hpBar').style.width = (100*h.hp/h.maxHp) + '%';
    document.getElementById('mpText').textContent = h.mp + ' / ' + h.maxMp;
    document.getElementById('mpBar').style.width = (100*h.mp/h.maxMp) + '%';
    document.getElementById('xpText').textContent = h.xp + ' / ' + h.xpNext;
    document.getElementById('xpBar').style.width = (100*h.xp/h.xpNext) + '%';
    document.getElementById('goldText').textContent = h.gold;

    if(!h.derived){ RPG.Player.recomputeDerived(h); }
    var d = h.derived;
    var ATTR_BENEFITS = {
      forca: function(){ return ['Dano físico: +'+d.dmgFisico]; },
      destreza: function(){ return ['Esquiva: '+d.esquiva.toFixed(1)+'%', 'Crítico: '+d.critico.toFixed(1)+'%']; },
      constituicao: function(){ return ['Vida Máxima: +'+ (h.attrs.constituicao*10)]; },
      intelecto: function(){ return ['Mana Máxima: +'+(h.attrs.intelecto*5), 'Dano Mágico: +'+d.dmgMagico]; },
      sabedoria: function(){ return ['Cura: +'+d.curaBonus+'%', 'Resist. Mágica: +'+d.resistMagica]; },
      carisma: function(){ return ['Desconto em lojas: '+d.descontoLoja.toFixed(1)+'%']; }
    };
    var pts = h.attrPoints || 0;
    var ptsBanner = document.getElementById('attrPointsBanner');
    if(!ptsBanner){
      ptsBanner = document.createElement('div');
      ptsBanner.id = 'attrPointsBanner';
      ptsBanner.className = 'attr-points-banner';
      document.getElementById('attrGrid').parentNode.insertBefore(ptsBanner, document.getElementById('attrGrid'));
    }
    ptsBanner.textContent = pts>0 ? ('\u2728 Você tem '+pts+' ponto(s) de atributo para distribuir') : '';
    ptsBanner.classList.toggle('hidden', pts<=0);

    var grid = document.getElementById('attrGrid');
    grid.innerHTML = '';
    RPG.Player.ATTR_KEYS.forEach(function(k){
      var cell = document.createElement('div');
      cell.className = 'attr-cell';
      var benefits = ATTR_BENEFITS[k]().map(function(b){ return '<div class="attr-benefit">\u2022 '+b+'</div>'; }).join('');
      cell.innerHTML = '<div class="k">'+RPG.Player.ATTR_LABELS[k]+'</div><div class="v">'+h.attrs[k]+
        (pts>0 ? '<button class="attr-plus" data-attr="'+k+'">+</button>' : '') + '</div>' +
        '<div class="attr-benefits">'+benefits+'</div>';
      grid.appendChild(cell);
    });
    Array.prototype.forEach.call(grid.querySelectorAll('.attr-plus'), function(btn){
      btn.addEventListener('click', function(){
        RPG.Player.spendAttrPoint(h, btn.getAttribute('data-attr'));
        renderHero();
        RPG.Save.save(RPG.state);
      });
    });

    var slots = document.getElementById('equipSlots');
    slots.innerHTML = '';
    h.equip.secundaria=h.equip.secundaria||null;
    [['arma','Mão principal'],['secundaria','Mão secundária'],['armadura','Armadura'],['acessorio','Acessório']].forEach(function(pair){
      var it = h.equip[pair[0]];
      var line = document.createElement('div');
      line.className = 'equip-line';
      line.title = it ? it.desc : '';
      line.innerHTML = '<span class="slotlabel">'+pair[1]+'</span><span class="icon">'+(it?it.icon:'\u2014')+'</span><span class="name'+(it?'':' empty')+'">'+(it?it.name:'Vazio')+
        (it ? '<small class="equip-desc">'+it.desc+'</small>' : '')+'</span>';
      slots.appendChild(line);
    });

    var pl = document.getElementById('powersList');
    pl.innerHTML = '';
    var passive = RPG.Player.classPassive(h.className);
    if(passive){
      var pd = document.createElement('div');
      pd.className = 'trait-line passive';
      pd.innerHTML = '<span class="icon">🌟</span><div class="txt"><b>'+passive.name+' <small>(passiva)</small></b><span>'+passive.desc+'</span></div>';
      pl.appendChild(pd);
    }
    h.powers.forEach(function(p){
      var d = document.createElement('div');
      d.className = 'trait-line';
      d.innerHTML = '<span class="icon">'+p.icon+'</span><div class="txt"><b>'+p.name+'</b><span>'+p.desc+'</span></div>';
      pl.appendChild(d);
    });

    document.getElementById('debuffList').innerHTML = '<div class="trait-line debuff"><span class="icon">'+h.debuff.icon+'</span><div class="txt"><b>'+h.debuff.name+'</b><span>'+h.debuff.desc+'</span></div></div>';

    var effects=[];
    var buffs=h.buffs||{};
    if(h.buffs && h.buffs.esquivaTurns>=900) effects.push({icon:'\u2728',name:'Bênção do Viajante',desc:'+'+(h.buffs.esquivaAmount||0)+'% de Esquiva neste combate.'});
    else if(h.npcBlessing && h.npcBlessing.combats>0) effects.push({icon:'\u2728',name:'Bênção do Viajante',desc:'+'+h.npcBlessing.dodge+'% de Esquiva nos próximos '+h.npcBlessing.combats+' combate(s).'});
    if(buffs.poisonTurns>0) effects.push({icon:'\u2620\ufe0f',name:'Envenenado',desc:buffs.poisonDmg+' de dano por '+buffs.poisonTurns+' turno(s).'});
    if(buffs.shield>0) effects.push({icon:'\ud83d\udd37',name:'Escudo Arcano',desc:'Reduz o próximo dano recebido.'});
    if(buffs.forcaTurns>0) effects.push({icon:'\ud83d\udcaa',name:'Força Ampliada',desc:'Dano aumentado por '+buffs.forcaTurns+' ataque(s).'});
    if(buffs.precisaoTurns>0) effects.push({icon:'\ud83c\udfaf',name:'Precisão Ampliada',desc:'Acerto aumentado por '+buffs.precisaoTurns+' ataque(s).'});
    if(buffs.esquivaTurns>0 && buffs.esquivaTurns<900) effects.push({icon:'\ud83d\udca8',name:'Passo Veloz',desc:'Esquiva aumentada por '+buffs.esquivaTurns+' turno(s).'});
    var effectsSection=document.getElementById('activeEffectsSection');
    var effectsList=document.getElementById('activeEffectsList');
    effectsSection.classList.toggle('hidden',effects.length===0);
    effectsList.innerHTML=effects.map(function(effect){ return '<div class="trait-line active-effect"><span class="icon">'+effect.icon+'</span><div class="txt"><b>'+effect.name+'</b><span>'+effect.desc+'</span></div></div>'; }).join('');

    var partySection = document.getElementById('partySection');
    var partyList = document.getElementById('partyList');
    if(RPG.state.party.length){
      partySection.classList.remove('hidden');
      partyList.innerHTML = '';
      RPG.state.party.forEach(function(m,index){
        m.stance=m.stance||'equilibrada';
        var d = document.createElement('div');
        d.className = 'party-card';
        d.innerHTML = '<span class="p-icon">'+m.classIcon+'</span><div class="p-info"><div class="p-name">'+m.name+'</div><div class="p-class">'+m.race+' \u00b7 '+m.className+'</div>'+
          '<div class="p-ability">'+(m.ability||'Habilidade de Classe')+(m.temporary?' \u00b7 '+m.combatsLeft+' combate(s)':'')+'</div>'+
          '<select class="party-stance" data-index="'+index+'"><option value="equilibrada">Equilibrada</option><option value="agressiva">Agressiva</option><option value="defensiva">Defensiva</option><option value="suporte">Suporte</option></select></div><span class="p-hp">'+m.hp+'/'+m.maxHp+'</span>';
        d.querySelector('.party-stance').value=m.stance;
        partyList.appendChild(d);
      });
      Array.prototype.forEach.call(partyList.querySelectorAll('.party-stance'),function(select){
        select.addEventListener('change',function(){
          RPG.state.party[parseInt(select.getAttribute('data-index'),10)].stance=select.value;
          RPG.Save.save(RPG.state);
        });
      });
    } else { partySection.classList.add('hidden'); }

    document.getElementById('itemCount').textContent = RPG.state.inventory.length;
  }

  function onLevelUp(levels){
    RPG.Effects.playSfx('levelup');
    RPG.Effects.levelFlash(document.getElementById('playerPanel'));
    logEvent('<b>Você subiu de nível!</b> Agora é nível '+RPG.state.hero.level+'.');
  }

  /* ================= MAP RENDER (com neblina) ================= */
  function currentModule(){ return RPG.state.mapMode === 'city' ? RPG.City : RPG.Dungeon; }

  function iconFor(cell){ return currentModule().iconFor(cell); }

  // Instinto de Caça: o Caçador enxerga criaturas em salas vizinhas ainda
  // nao visitadas, mesmo sem abrir a porta.
  function isHunterTrackedCell(cell, state){
    var hero = state.hero;
    if(!hero || (hero.className!=='Caçador' && hero.className!=='Cacador')) return false;
    return Math.abs(cell.x-state.pos.x) + Math.abs(cell.y-state.pos.y) === 1;
  }
  function trackedMonsterIcon(cell){
    if((cell.type==='monster'||cell.type==='boss') && !cell.beaten && cell.monsters && cell.monsters.length){
      return cell.monsters[0].icon;
    }
    return '';
  }
  function renderMap(){
    var state = RPG.state;
    var el = document.getElementById('mapGrid');
    if(!state.map || !state.map.length || !state.pos){
      el.innerHTML = '';
      return;
    }
    el.style.gridTemplateColumns = 'repeat(' + state.mapCols + ', 1fr)';
    el.innerHTML = '';
    state.map.forEach(function(row){
      row.forEach(function(cell){
        var div = document.createElement('div');
        // Uma celula com dado inesperado (ex: sincronia de multiplayer em
        // transito) nao pode derrubar o mapa inteiro -- pula so essa celula.
        try{
          var isPlayer = (cell.x===state.pos.x && cell.y===state.pos.y);
          if(cell.type === 'void'){
            div.className = 'tile void';
          } else if(!RPG.MapUtil.isKnown(state.map, cell, state.mapCols, state.mapRows) && !isPlayer){
            div.className = 'tile fog';
          } else if(cell.visited || cell.revealed || isPlayer){
            div.className = 'tile room-known ' + cell.type + ((cell.collected||cell.beaten) ? ' collected' : '');
            div.textContent = iconFor(cell);
          } else {
            div.className = 'tile room-dim';
            if(isHunterTrackedCell(cell, state)){
              div.classList.add('tracked-enemy');
              div.textContent = trackedMonsterIcon(cell);
            }
          }
          if(isPlayer){ div.classList.add('player-tile'); }
        }catch(err){
          div.className = 'tile fog';
          console.error('[RPG] falha ao renderizar celula do mapa', cell, err);
        }
        el.appendChild(div);
      });
    });
    updateSceneText();
  }

  function updateSceneText(){
    var el = document.getElementById('sceneText');
    // So a descricao generica da sala faz sentido no modo "move" -- em
    // 'confirm'/'encounter'/'event' o texto da cena mostra um prompt ou
    // escolhas customizadas (ex: botoes de evento) que nao podem ser
    // sobrescritas por um re-render do mapa (comum em sincronias de
    // multiplayer), senao o jogador perde a interacao no meio.
    if(el && RPG.state.hero && RPG.state.map && RPG.state.map.length && RPG.state.mode==='move'){
      el.innerHTML = RPG.Narrator.describeCurrent(RPG.state);
    }
  }

  function setLegend(items){
    document.getElementById('mapLegend').innerHTML = items.map(function(it){ return '<span>'+it[0]+' '+it[1]+'</span>'; }).join('');
  }

  function resetPlayerToStart(startCell){
    var state = RPG.state;
    state.pos = { x: startCell.x, y: startCell.y };
    startCell.visited = true; startCell.revealed = true;
    state.mode = 'move';
    state.pendingTarget = null;
    state.pendingMonsterCell = null;
  }

  /* ================= LOCATION TRANSITIONS ================= */
  function enterDungeon(){
    var state = RPG.state;
    state.mapMode = 'dungeon';
    state.floor = 1;
    var startCell = RPG.Dungeon.generate(state);
    resetPlayerToStart(startCell);
    document.getElementById('combatScene').classList.add('hidden');
    document.getElementById('sceneText').classList.remove('hidden');
    renderMap();
    renderControls();
    resetDialogue();
    logEvent('Você atravessa o portão e entra na <b>masmorra</b>.');
    RPG.Save.save(state);
    RPG.Tutorial.event('dungeon');
  }
  // A cidade inicial e gerada uma unica vez por personagem e reaproveitada
  // sempre que o jogador volta da masmorra (nao "redesenha" a cada ida e
  // volta). Passe force=true para gerar uma cidade nova (ex: botao de ADM).
  function enterCity(force){
    var state = RPG.state;
    state.mapMode = 'city';
    var startCell;
    if(!force && state.cityMap && state.cityMap.length){
      state.map = state.cityMap;
      RPG.City.refreshPresentation();
      startCell = state.map[state.cityStart.y][state.cityStart.x];
    } else {
      startCell = RPG.City.generate(state);
      state.cityMap = state.map;
      state.cityStart = { x: startCell.x, y: startCell.y };
    }
    resetPlayerToStart(startCell);
    document.getElementById('combatScene').classList.add('hidden');
    document.getElementById('sceneText').classList.remove('hidden');
    renderMap();
    renderControls();
    resetDialogue();
    logEvent('Você retorna à <b>cidade</b>.');
    RPG.Save.save(state);
  }

  document.addEventListener('DOMContentLoaded', function(){
    var regenBtn = document.getElementById('regenMapBtn');
    if(regenBtn){
      regenBtn.addEventListener('click', function(){
        var state = RPG.state;
        if(state.mapMode === 'city'){ enterCity(true); logEvent('A cidade foi redesenhada e você reaparece no início.'); }
        else { var startCell = RPG.Dungeon.generate(state); resetPlayerToStart(startCell); renderMap(); renderControls(); logEvent('Este andar foi redesenhado.'); }
        resetDialogue();
      });
    }
  });

  /* ================= MOVEMENT (direcoes fixas: portas da sala) ================= */
  function neighborCell(dir){
    var state = RPG.state;
    var cell = state.map[state.pos.y][state.pos.x];
    if(!cell.doors || !cell.doors[dir]) return null;
    var v = RPG.MapUtil.DIR_VECTORS[dir];
    var nx = state.pos.x+v.x, ny = state.pos.y+v.y;
    if(!RPG.MapUtil.inBounds(nx,ny,state.mapCols,state.mapRows)) return null;
    var target = state.map[ny][nx];
    if(!RPG.MapUtil.isRoom(target)) return null;
    return { cell: target, nx: nx, ny: ny };
  }

  function needsConfirm(cell){
    if(cell.type==='treasure' && cell.collected) return false;
    if((cell.type==='monster' || cell.type==='boss') && cell.beaten) return false;
    return ['npc','event','treasure','monster','boss','shop','blacksmith','tavern','questboard','gate','exit','stairs'].indexOf(cell.type) >= 0;
  }

  function tryMove(dir){
    if(RPG.Multiplayer && !RPG.Multiplayer.beginMove()) return;
    var state = RPG.state;
    if(state.mode !== 'move') return;
    var info = neighborCell(dir);
    if(!info) return;
    if(needsConfirm(info.cell)){
      info.cell.revealed = true;
      renderMap();
      showEntryPrompt(info.cell, info.nx, info.ny);
    } else {
      movePlayerTo(info.nx, info.ny, info.cell);
    }
  }

  function movePlayerTo(nx, ny, cell){
    var state = RPG.state;
    state.pos = { x:nx, y:ny };
    cell.visited = true; cell.revealed = true;
    RPG.Effects.playSfx('step');
    renderMap();
    var handled = currentModule().handleEnter(state, cell);
    if(!handled){ resetDialogueAmbient(); }
    renderControls();
    RPG.Save.save(state);
    RPG.Tutorial.event('move');
  }

  function setSceneMessage(text){
    var el = document.getElementById('sceneText');
    if(el){ el.innerHTML = '<p>'+text+'</p>'; }
  }

  function setDialogueControls(showNext, showWrap){
    document.getElementById('dialogueControlsWrap').classList.toggle('hidden', !showWrap);
    document.getElementById('dialogueNextBtn').classList.toggle('hidden', !showNext);
  }

  function updateNpcActionButton(){
    var btn=document.getElementById('npcActionBtn');
    var service=currentNPC && RPG.NPCServices ? RPG.NPCServices.info(currentNPC.service) : null;
    btn.classList.toggle('hidden',!service || currentNPC.serviceUsed);
    if(service){ btn.textContent=service.icon+' '+service.label; }
  }

  function showEntryPrompt(cell, nx, ny){
    var state = RPG.state;
    state.mode = 'confirm';
    state.pendingTarget = { cell:cell, nx:nx, ny:ny };
    setSceneMessage(currentModule().entryText(cell));
    document.getElementById('npcCard').style.display = 'none';
    setDialogueControls(false, false);
    renderControls();
  }

  function confirmYes(){
    var state = RPG.state;
    var t = state.pendingTarget;
    state.mode = 'move';
    state.pendingTarget = null;
    if(t){ movePlayerTo(t.nx, t.ny, t.cell); }
  }
  function confirmNo(){
    var state = RPG.state;
    var t = state.pendingTarget;
    state.mode = 'move';
    state.pendingTarget = null;
    // A saída também pode ocupar uma sala de passagem. Responder "Não"
    // atravessa o local sem voltar à cidade, impedindo que ela bloqueie a escada.
    var passableWithoutInteraction = ['npc','shop','blacksmith','tavern','questboard','treasure','event','exit'];
    if(t && passableWithoutInteraction.indexOf(t.cell.type) >= 0){
      state.pos = { x:t.nx, y:t.ny };
      t.cell.visited = true;
      t.cell.revealed = true;
      RPG.Effects.playSfx('step');
      document.getElementById('npcCard').style.display = 'none';
      setDialogueControls(false, false);
      renderMap();
      setSceneMessage('Você passa pelo local sem interagir e segue seu caminho.');
      RPG.Save.save(state);
    } else {
      setSceneMessage('Você decide não entrar e recua um passo.');
    }
    renderControls();
  }

  document.addEventListener('click', function(e){
    if(e.target && e.target.id === 'encounterFightBtn'){ RPG.Combat.startCombat(RPG.state.pendingMonsterCell); }
    if(e.target && e.target.id === 'encounterFleeBtn'){ RPG.Combat.attemptFlee(RPG.state.pendingMonsterCell, 'pre'); }
  });

  /* ================= DIALOGUE (mesclado na caixa de exploracao) ================= */
  var currentNPC = null, npcLineIndex = 0;

  function openDialogueWithNPC(npc){
    currentNPC = npc; npcLineIndex = 0;
    document.getElementById('npcCard').style.display = 'flex';
    document.getElementById('npcPortrait').textContent = npc.icon;
    document.getElementById('npcName').textContent = npc.name;
    document.getElementById('npcRole').textContent = npc.role;
    setSceneMessage(npc.lines[0]);
    setDialogueControls(true, true);
    updateNpcActionButton();
    logEvent('Você iniciou uma conversa com <b>'+npc.name+'</b>.');
    RPG.Tutorial.event('npc');
    if(RPG.Multiplayer)RPG.Multiplayer.broadcastAction('npc',{npc:npc});
  }
  function showSimpleDialogue(icon, title, text){
    currentNPC = null;
    document.getElementById('npcCard').style.display = 'flex';
    document.getElementById('npcPortrait').textContent = icon;
    document.getElementById('npcName').textContent = title;
    document.getElementById('npcRole').textContent = 'Evento';
    setSceneMessage(text);
    setDialogueControls(false, true);
    document.getElementById('npcActionBtn').classList.add('hidden');
    if(RPG.Multiplayer)RPG.Multiplayer.broadcastAction('simple',{icon:icon,title:title,text:text});
  }
  function dialogueNext(){
    if(!currentNPC){ return; }
    npcLineIndex++;
    if(npcLineIndex >= currentNPC.lines.length){ logEvent('A conversa com <b>'+currentNPC.name+'</b> terminou.'); resetDialogue(); return; }
    setSceneMessage(currentNPC.lines[npcLineIndex]);
  }
  function resetDialogue(){
    currentNPC = null;
    if(RPG.state&&['combat','encounter','event'].indexOf(RPG.state.mode)<0){RPG.state.mode='move';RPG.state.pendingTarget=null;}
    document.getElementById('npcCard').style.display = 'none';
    setDialogueControls(false, false);
    document.getElementById('npcActionBtn').classList.add('hidden');
    updateSceneText();
  }
  function resetDialogueAmbient(){
    currentNPC = null;
    if(RPG.state&&['combat','encounter','event'].indexOf(RPG.state.mode)<0){RPG.state.mode='move';RPG.state.pendingTarget=null;}
    document.getElementById('npcCard').style.display = 'none';
    setDialogueControls(false, false);
    document.getElementById('npcActionBtn').classList.add('hidden');
    updateSceneText();
  }

  /* ================= MOVEMENT CONTROLS RENDER ================= */
  function renderControls(){
    var state = RPG.state;
    var el = document.getElementById('controlsArea');
    if(state.mode === 'move'){
      var n = neighborCell('N'), s = neighborCell('S'), e = neighborCell('E'), w = neighborCell('W');
      var html = '<div class="dpad">';
      html += n ? '<button class="btn-front" id="btnN">\u25b2<br>Norte (W)</button>' : '<span class="btn-front"></span>';
      html += w ? '<button class="btn-left" id="btnW">\u25c4<br>Oeste (A)</button>' : '<span class="btn-left"></span>';
      html += s ? '<button class="btn-back" id="btnS">\u25bc<br>Sul (S)</button>' : '<span class="btn-back"></span>';
      html += e ? '<button class="btn-right" id="btnE">\u25ba<br>Leste (D)</button>' : '<span class="btn-right"></span>';
      html += '</div><div class="move-hint">Use os botões ou WASD / setas do teclado.</div>';
      el.innerHTML = html;
      if(n) document.getElementById('btnN').addEventListener('click', function(){ tryMove('N'); });
      if(s) document.getElementById('btnS').addEventListener('click', function(){ tryMove('S'); });
      if(e) document.getElementById('btnE').addEventListener('click', function(){ tryMove('E'); });
      if(w) document.getElementById('btnW').addEventListener('click', function(){ tryMove('W'); });
    } else if(state.mode === 'confirm'){
      el.innerHTML = '<div class="prompt-box"><p>Confirme sua ação no diálogo ao lado.</p><div class="prompt-actions"><button class="yes" id="confirmYesBtn">Sim</button><button class="no" id="confirmNoBtn">Não</button></div></div>';
      document.getElementById('confirmYesBtn').addEventListener('click', confirmYes);
      document.getElementById('confirmNoBtn').addEventListener('click', confirmNo);
    } else if(state.mode === 'encounter'){
      el.innerHTML = '<div class="prompt-box"><p>Um inimigo apareceu. Enfrentar ou fugir?</p><div class="prompt-actions"><button class="yes" id="encounterFightBtn">Enfrentar</button><button class="no" id="encounterFleeBtn">Fugir</button></div></div>';
    } else if(state.mode === 'combat'){
      el.innerHTML = '<div class="move-hint">Use os botões na cena de combate acima.</div>';
    } else if(state.mode === 'event'){
      el.innerHTML = '<div class="move-hint">Escolha uma opção no evento acima.</div>';
    }
  }

  /* ================= TECLADO (WASD / setas = bussola) ================= */
  function bindKeyboard(){
    document.addEventListener('keydown', function(e){
      if(RPG.state.screen !== 'game') return;
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if(tag === 'INPUT' || tag === 'TEXTAREA') return;
      var key = e.key.toLowerCase();
      if(key==='w' || key==='arrowup'){ tryMove('N'); }
      else if(key==='a' || key==='arrowleft'){ tryMove('W'); }
      else if(key==='d' || key==='arrowright'){ tryMove('E'); }
      else if(key==='s' || key==='arrowdown'){ tryMove('S'); }
    });
  }

  /* ================= BACKPACK MODAL ================= */
  function bindBackpack(){
    document.getElementById('backpackBtn').addEventListener('click', function(){
      RPG.Inventory.resetSelection();
      RPG.Inventory.render(RPG.state);
      document.getElementById('backpackModal').classList.remove('hidden');
      RPG.Tutorial.event('inventory');
    });
    document.getElementById('closeModalBtn').addEventListener('click', function(){ document.getElementById('backpackModal').classList.add('hidden'); });
    document.getElementById('backpackModal').addEventListener('click', function(e){ if(e.target.id === 'backpackModal'){ document.getElementById('backpackModal').classList.add('hidden'); } });
  }

  function bindMerchantModal(){
    document.getElementById('closeMerchantBtn').addEventListener('click', RPG.Shop.close);
    document.getElementById('merchantModal').addEventListener('click', function(e){ if(e.target.id === 'merchantModal'){ RPG.Shop.close(); } });
    document.getElementById('merchantRestockBtn').addEventListener('click', function(){ RPG.Shop.restock(RPG.state); });
    document.getElementById('merchantForgeOpenBtn').addEventListener('click', function(){ RPG.Shop.toggleForge(RPG.state); });
  }

  function bindQuestModal(){
    document.getElementById('closeQuestBtn').addEventListener('click', RPG.Quests.closeBoard);
    document.getElementById('questModal').addEventListener('click', function(e){ if(e.target.id === 'questModal'){ RPG.Quests.closeBoard(); } });
  }

  function bindDialogueControls(){
    document.getElementById('npcActionBtn').addEventListener('click', function(){
      if(!currentNPC) return;
      setSceneMessage(RPG.NPCServices.use(RPG.state,currentNPC));
      if(RPG.state.mode!=='combat'&&RPG.state.mode!=='event'){RPG.state.mode='move';RPG.state.pendingTarget=null;renderControls();}
      updateNpcActionButton();
    });
    document.getElementById('dialogueNextBtn').addEventListener('click', dialogueNext);
    document.getElementById('dialogueCloseBtn').addEventListener('click', function(){
      if(currentNPC){ logEvent('Você encerrou a conversa com <b>'+currentNPC.name+'</b>.'); }
      resetDialogue();
      renderControls();
    });
  }

  // Carrega um save (local/nuvem) em RPG.state e entra direto no jogo, no
  // ponto exato onde o heroi parou. Usado pelo botao "Continuar" e para
  // reaproveitar o personagem solo ao entrar no multiplayer.
  function resumeSavedGame(data, opts){
    if(!data || !data.hero) return false;
    var forceCity = !!(opts && opts.forceCity);
    var state = RPG.state;
    state.hero = RPG.Player.hydrateSavedHero(data.hero);
    state.party = data.party || [];
    state.inventory = data.inventory || [];
    state.inventory.forEach(RPG.Items.refreshIcon);
    ['arma','secundaria','armadura','acessorio'].forEach(function(slot){
      RPG.Items.refreshIcon(state.hero.equip[slot]);
    });
    state.quests = forceCity ? [] : (data.quests || []);
    state.floor = forceCity ? 1 : (data.floor || 1);
    state.mapMode = forceCity ? 'city' : (data.mapMode || 'city');
    state.mapRows = data.mapRows || 6;
    state.mapCols = data.mapCols || 6;
    state.slot = data.slot || 1;
    state.soundOn = data.soundOn !== undefined ? data.soundOn : true;
    state.musicVolume = data.musicVolume !== undefined ? data.musicVolume : 0.28;
    state.tutorial = data.tutorial || RPG.Tutorial.create(false);
    document.getElementById('soundToggle').checked = state.soundOn;
    document.getElementById('musicVolume').value = Math.round(state.musicVolume*100);

    showScreen('game');
    document.getElementById('rollDie').textContent = '-';
    document.getElementById('rollDie').className = 'roll-die';
    document.getElementById('rollInfo').textContent = 'Escolha um dado para rolar.';
    document.getElementById('logList').innerHTML = '';
    renderHero();

    // Saves novos preservam mapa, posição, baús, monstros, eventos e NPCs.
    // Saves antigos continuam válidos e geram o local uma única vez.
    if(!forceCity && Array.isArray(data.cityMap) && data.cityMap.length){
      state.cityMap = data.cityMap;
      state.cityStart = data.cityStart || null;
    } else if(forceCity){
      state.cityMap = null;
      state.cityStart = null;
    }
    if(!forceCity && Array.isArray(data.map) && data.map.length && data.pos){
      state.map=data.map;
      state.pos=data.pos;
      state.mode='move';
      state.pendingTarget=null;
      state.pendingMonsterCell=null;
      if(state.mapMode==='dungeon') RPG.Dungeon.refreshPresentation(state);
      else RPG.City.refreshPresentation(state);
      // Saves de antes do cache de cidade nao tem cityMap salvo -- se o
      // jogador estava na cidade nesse save, usa o mapa atual como cache.
      if(state.mapMode==='city' && (!state.cityMap || !state.cityMap.length)){
        state.cityMap = state.map;
        if(!state.cityStart){
          for(var cy=0;cy<state.map.length && !state.cityStart;cy++){
            for(var cx=0;cx<state.map[cy].length;cx++){
              if(state.map[cy][cx].type==='start'){ state.cityStart={x:cx,y:cy}; break; }
            }
          }
        }
      }
    } else {
      var startCell = (state.mapMode === 'dungeon') ? RPG.Dungeon.generate(state) : RPG.City.generate(state);
      if(state.mapMode==='city'){ state.cityMap = state.map; state.cityStart = { x: startCell.x, y: startCell.y }; }
      resetPlayerToStart(startCell);
    }
    document.getElementById('combatScene').classList.add('hidden');
    document.getElementById('sceneText').classList.remove('hidden');
    renderMap();
    renderControls();
    resetDialogue();
    logEvent(forceCity ? ('<b>'+state.hero.name+'</b> chega à cidade inicial para a aventura online.') : ('Bem-vindo de volta, <b>'+state.hero.name+'</b>! Continuando de onde parou.'));
    RPG.Tutorial.render();
    return true;
  }

  /* ================= SCREEN SWITCHING ================= */
  function showScreen(name){
    RPG.state.screen = name;
    document.getElementById('menuScreen').classList.toggle('hidden', name!=='menu');
    document.getElementById('settingsPanel').classList.toggle('hidden', name!=='settings');
    document.getElementById('creditsPanel').classList.toggle('hidden', name!=='credits');
    document.getElementById('creationScreen').classList.toggle('hidden', name!=='creation');
    document.getElementById('gameScreen').classList.toggle('hidden', name!=='game');
    document.getElementById('newHeroBtn').classList.toggle('hidden', name!=='game');
    document.getElementById('tutorialGuideBtn').classList.toggle('hidden', name!=='game');
    document.getElementById('gameSettingsBtn').classList.toggle('hidden', name!=='game');
    document.getElementById('gameMainMenuBtn').classList.toggle('hidden', name!=='game');
    if(RPG.AdminPanel) RPG.AdminPanel.refreshButton();
    if(RPG.Social) RPG.Social.refreshLauncher();
    document.getElementById('headerSub').textContent =
      name==='game' ? 'mesa de rpg \u00b7 dados \u00b7 cidade \u00b7 masmorra' :
      name==='creation' ? 'criação de personagem' : 'menu principal';
  }

  return {
    renderCreationScreen: renderCreationScreen, startAdventure: startAdventure,
    renderHero: renderHero, onLevelUp: onLevelUp,
    renderMap: renderMap, setLegend: setLegend, resetPlayerToStart: resetPlayerToStart,
    enterDungeon: enterDungeon, enterCity: enterCity,
    tryMove: tryMove, renderControls: renderControls,
    neighborCell: neighborCell, updateSceneText: updateSceneText, setSceneMessage: setSceneMessage,
    openDialogueWithNPC: openDialogueWithNPC, showSimpleDialogue: showSimpleDialogue,
    resetDialogue: resetDialogue, logEvent: logEvent,
    bindKeyboard: bindKeyboard, bindBackpack: bindBackpack, bindMerchantModal: bindMerchantModal,
    bindQuestModal: bindQuestModal, bindDialogueControls: bindDialogueControls,
    showScreen: showScreen, resumeSavedGame: resumeSavedGame
  };
})();
