/* =========================================================
   RPG Legend - js/ui.js
   Cola tudo: renderizacao da ficha, exploracao com neblina,
   controles de movimento, dialogo e modais.
   ========================================================= */
var RPG = window.RPG || {};

RPG.UI = (function(){

  var creation = { name:"", race:null, cls:null, powers:[], debuff:null, mode:null };

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

  // cada classe ja vem com 1 poder proprio (automatico); o jogador
  // escolhe ate 2 poderes extras entre os das outras classes.
  function renderPowerGrid(){
    var el = document.getElementById('powerGrid');
    el.innerHTML = '';
    var sigName = creation.cls ? creation.cls.signature : null;
    creation.powers = creation.powers.filter(function(p){ return p.name !== sigName; });
    RPG.Player.POWERS.forEach(function(it){
      var isSig = it.name === sigName;
      var card = document.createElement('div');
      card.className = 'pick-card' + (isSig ? ' selected signature' : '');
      card.innerHTML = '<div class="pc-top"><span class="pc-icon">'+it.icon+'</span><span class="pc-name">'+it.name+(isSig?' <small>(da classe)</small>':'')+'</span></div><div class="pc-desc">'+it.desc+'</div>';
      if(isSig){
        card.classList.add('locked');
      } else {
        if(creation.powers.indexOf(it) >= 0){ card.classList.add('selected'); }
        card.addEventListener('click', function(){
          var idx = creation.powers.indexOf(it);
          if(idx >= 0){ creation.powers.splice(idx,1); card.classList.remove('selected'); }
          else {
            if(creation.powers.length >= 2){ showError('Você só pode escolher até 2 poderes extras.'); return; }
            creation.powers.push(it); card.classList.add('selected');
          }
          clearError();
        });
      }
      el.appendChild(card);
    });
  }

  function renderCreationScreen(){
    creation = { name:"", race:null, cls:null, powers:[], debuff:null, mode:null };
    document.getElementById('nameInput').value = '';

    buildPickGrid('raceGrid', RPG.Player.RACES, function(it, card){
      creation.race = it;
      Array.prototype.forEach.call(document.getElementById('raceGrid').children, function(c){ c.classList.remove('selected'); });
      card.classList.add('selected'); clearError();
    });
    buildPickGrid('classGrid', RPG.Player.CLASSES, function(it, card){
      creation.cls = it;
      Array.prototype.forEach.call(document.getElementById('classGrid').children, function(c){ c.classList.remove('selected'); });
      card.classList.add('selected'); clearError();
      renderPowerGrid();
    });
    renderPowerGrid();
    buildPickGrid('debuffGrid', RPG.Player.DEBUFFS, function(it, card){
      creation.debuff = it;
      Array.prototype.forEach.call(document.getElementById('debuffGrid').children, function(c){ c.classList.remove('selected'); });
      card.classList.add('selected'); clearError();
    });

    var modeEl = document.getElementById('modeGrid');
    modeEl.innerHTML = '';
    RPG.Player.MODES.forEach(function(m){
      var card = document.createElement('div');
      card.className = 'mode-card';
      card.innerHTML = '<div class="mc-icon">'+m.icon+'</div><div class="mc-name">'+m.name+'</div><div class="mc-desc">'+m.desc+'</div>';
      card.addEventListener('click', function(){
        creation.mode = m.id;
        Array.prototype.forEach.call(modeEl.children, function(c){ c.classList.remove('selected'); });
        card.classList.add('selected'); clearError();
      });
      modeEl.appendChild(card);
    });

    document.getElementById('nameInput').oninput = function(e){ creation.name = e.target.value; clearError(); };
  }

  function showError(msg){ document.getElementById('creationError').textContent = msg; }
  function clearError(){ document.getElementById('creationError').textContent = ''; }

  function validateCreation(){
    var name = document.getElementById('nameInput').value.trim();
    if(!name){ showError('Dê um nome ao seu herói.'); return false; }
    if(!creation.race){ showError('Escolha uma raça.'); return false; }
    if(!creation.cls){ showError('Escolha uma classe.'); return false; }
    if(!creation.debuff){ showError('Escolha uma fraqueza.'); return false; }
    if(!creation.mode){ showError('Escolha o modo de jogo.'); return false; }
    creation.name = name;
    return true;
  }

  function startAdventure(){
    if(!validateCreation()) return;
    var state = RPG.state;
    state.hero = RPG.Player.buildHero(creation);
    state.inventory = [];
    RPG.Inventory.addItem(state, RPG.Items.randomItem({ category:'consumivel', floor:1 }));
    state.party = [];
    if(creation.mode === 'equipe'){ for(var i=0;i<2;i++){ state.party.push(RPG.Player.generateCompanion()); } }
    state.floor = 1;
    state.quests = [];
    RPG.Quests.ensureBoard(state);

    // No multiplayer, o convidado cria apenas o próprio herói. O mapa da
    // aventura será recebido de quem criou a sala.
    if(RPG.Multiplayer && RPG.Multiplayer.isGuestCreating()){
      RPG.Multiplayer.finishGuestCreation(state);
      return;
    }

    RPG.UI.showScreen('game');
    document.getElementById('rollLog').innerHTML = '';
    document.getElementById('rollDie').textContent = '-';
    document.getElementById('rollDie').className = 'roll-die';
    document.getElementById('rollInfo').textContent = 'Escolha um dado para rolar.';
    document.getElementById('logList').innerHTML = '';

    renderHero();
    enterCity();
    resetDialogue();
    logEvent('<b>'+state.hero.name+'</b> ('+state.hero.race+' '+state.hero.className+') chega a cidade inicial'+(state.party.length? ' acompanhado de sua equipe.':'.'));
    RPG.Save.save(state);
  }

  /* ================= HERO PANEL ================= */
  function renderHero(){
    var h = RPG.state.hero;
    if(!h) return;
    document.getElementById('heroAvatar').innerHTML = h.raceIcon;
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
    [['arma','Arma'],['armadura','Armadura'],['acessorio','Acessório']].forEach(function(pair){
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

  function renderMap(){
    var state = RPG.state;
    var el = document.getElementById('mapGrid');
    el.style.gridTemplateColumns = 'repeat(' + state.mapCols + ', 1fr)';
    el.innerHTML = '';
    state.map.forEach(function(row){
      row.forEach(function(cell){
        var div = document.createElement('div');
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
        }
        if(isPlayer){ div.classList.add('player-tile'); }
        el.appendChild(div);
      });
    });
    updateSceneText();
  }

  function updateSceneText(){
    var el = document.getElementById('sceneText');
    if(el && RPG.state.hero && RPG.state.map && RPG.state.map.length){
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
  }
  function enterCity(){
    var state = RPG.state;
    state.mapMode = 'city';
    var startCell = RPG.City.generate(state);
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
        if(state.mapMode === 'city'){ enterCity(); logEvent('A cidade foi redesenhada e você reaparece no início.'); }
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
    var passableWithoutInteraction = ['npc','shop','blacksmith','tavern','questboard','treasure','event'];
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
  }
  function dialogueNext(){
    if(!currentNPC){ return; }
    npcLineIndex++;
    if(npcLineIndex >= currentNPC.lines.length){ logEvent('A conversa com <b>'+currentNPC.name+'</b> terminou.'); resetDialogue(); return; }
    setSceneMessage(currentNPC.lines[npcLineIndex]);
  }
  function resetDialogue(){
    currentNPC = null;
    document.getElementById('npcCard').style.display = 'none';
    setDialogueControls(false, false);
    document.getElementById('npcActionBtn').classList.add('hidden');
    updateSceneText();
  }
  function resetDialogueAmbient(){
    currentNPC = null;
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
    });
    document.getElementById('closeModalBtn').addEventListener('click', function(){ document.getElementById('backpackModal').classList.add('hidden'); });
    document.getElementById('backpackModal').addEventListener('click', function(e){ if(e.target.id === 'backpackModal'){ document.getElementById('backpackModal').classList.add('hidden'); } });
  }

  function bindMerchantModal(){
    document.getElementById('closeMerchantBtn').addEventListener('click', RPG.Shop.close);
    document.getElementById('merchantModal').addEventListener('click', function(e){ if(e.target.id === 'merchantModal'){ RPG.Shop.close(); } });
    document.getElementById('merchantRestockBtn').addEventListener('click', function(){ RPG.Shop.restock(RPG.state); });
  }

  function bindQuestModal(){
    document.getElementById('closeQuestBtn').addEventListener('click', RPG.Quests.closeBoard);
    document.getElementById('questModal').addEventListener('click', function(e){ if(e.target.id === 'questModal'){ RPG.Quests.closeBoard(); } });
  }

  function bindDialogueControls(){
    document.getElementById('npcActionBtn').addEventListener('click', function(){
      if(!currentNPC) return;
      setSceneMessage(RPG.NPCServices.use(RPG.state,currentNPC));
      updateNpcActionButton();
    });
    document.getElementById('dialogueNextBtn').addEventListener('click', dialogueNext);
    document.getElementById('dialogueCloseBtn').addEventListener('click', function(){
      if(currentNPC){ logEvent('Você encerrou a conversa com <b>'+currentNPC.name+'</b>.'); }
      resetDialogue();
    });
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
    showScreen: showScreen
  };
})();
