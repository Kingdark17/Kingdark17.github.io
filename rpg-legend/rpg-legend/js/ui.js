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
    });
    buildPickGrid('powerGrid', RPG.Player.POWERS, function(it, card){
      var idx = creation.powers.indexOf(it);
      if(idx >= 0){ creation.powers.splice(idx,1); card.classList.remove('selected'); }
      else {
        if(creation.powers.length >= 2){ showError('Voce so pode escolher ate 2 poderes.'); return; }
        creation.powers.push(it); card.classList.add('selected');
      }
      clearError();
    });
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
    if(!name){ showError('De um nome ao seu heroi.'); return false; }
    if(!creation.race){ showError('Escolha uma raca.'); return false; }
    if(!creation.cls){ showError('Escolha uma classe.'); return false; }
    if(creation.powers.length < 1){ showError('Escolha ao menos 1 poder.'); return false; }
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
    document.getElementById('heroLevel').textContent = 'Nivel ' + h.level;

    document.getElementById('hpText').textContent = h.hp + ' / ' + h.maxHp;
    document.getElementById('hpBar').style.width = (100*h.hp/h.maxHp) + '%';
    document.getElementById('mpText').textContent = h.mp + ' / ' + h.maxMp;
    document.getElementById('mpBar').style.width = (100*h.mp/h.maxMp) + '%';
    document.getElementById('xpText').textContent = h.xp + ' / ' + h.xpNext;
    document.getElementById('xpBar').style.width = (100*h.xp/h.xpNext) + '%';
    document.getElementById('goldText').textContent = h.gold;

    var grid = document.getElementById('attrGrid');
    grid.innerHTML = '';
    RPG.Player.ATTR_KEYS.forEach(function(k){
      var cell = document.createElement('div');
      cell.className = 'attr-cell';
      var m = RPG.Player.attrMod(h.attrs[k]);
      cell.innerHTML = '<div class="k">'+RPG.Player.ATTR_LABELS[k]+'</div><div class="v">'+h.attrs[k]+'</div><div class="m">'+(m>=0?'+'+m:m)+'</div>';
      grid.appendChild(cell);
    });

    var slots = document.getElementById('equipSlots');
    slots.innerHTML = '';
    [['arma','Arma'],['armadura','Armadura'],['acessorio','Acessorio']].forEach(function(pair){
      var it = h.equip[pair[0]];
      var line = document.createElement('div');
      line.className = 'equip-line';
      line.innerHTML = '<span class="slotlabel">'+pair[1]+'</span><span class="icon">'+(it?it.icon:'\u2014')+'</span><span class="name'+(it?'':' empty')+'">'+(it?it.name:'Vazio')+'</span>';
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

    var partySection = document.getElementById('partySection');
    var partyList = document.getElementById('partyList');
    if(RPG.state.party.length){
      partySection.classList.remove('hidden');
      partyList.innerHTML = '';
      RPG.state.party.forEach(function(m){
        var d = document.createElement('div');
        d.className = 'party-card';
        d.innerHTML = '<span class="p-icon">'+m.classIcon+'</span><div><div class="p-name">'+m.name+'</div><div class="p-class">'+m.race+' \u00b7 '+m.className+'</div></div><span class="p-hp">'+m.hp+'/'+m.maxHp+'</span>';
        partyList.appendChild(d);
      });
    } else { partySection.classList.add('hidden'); }

    document.getElementById('itemCount').textContent = RPG.state.inventory.length;
  }

  function onLevelUp(levels){
    RPG.Effects.playSfx('levelup');
    RPG.Effects.levelFlash(document.getElementById('playerPanel'));
    logEvent('<b>Voce subiu de nivel!</b> Agora e nivel '+RPG.state.hero.level+'.');
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
        if(!RPG.MapUtil.isKnown(state.map, cell, state.mapCols, state.mapRows) && !isPlayer){
          div.className = 'tile fog';
        } else if(cell.type==='wall' || cell.type==='building'){
          div.className = 'tile ' + cell.type;
        } else {
          var contentRevealed = cell.visited || cell.revealed;
          var displayType = contentRevealed ? cell.type : (state.mapMode==='city' ? 'street' : 'floor');
          div.className = 'tile ' + displayType + (((cell.collected||cell.beaten) && contentRevealed) ? ' collected' : '');
          if(contentRevealed){ div.textContent = iconFor(cell); }
        }
        if(isPlayer){
          div.classList.add('player-tile');
          div.innerHTML = '<span class="facing-arrow" style="transform:rotate('+RPG.MapUtil.facingDeg(state.facing)+'deg)">'+RPG.MapUtil.DIR_ARROW.up+'</span>';
        }
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
    var order = ['down','right','up','left'];
    var f = 'down';
    for(var i=0;i<order.length;i++){
      var v = RPG.MapUtil.DIR_VECTORS[order[i]];
      var nx = startCell.x+v.x, ny = startCell.y+v.y;
      if(RPG.MapUtil.inBounds(nx,ny,state.mapCols,state.mapRows) && RPG.MapUtil.isWalkable(state.map[ny][nx])){ f = order[i]; break; }
    }
    state.facing = f;
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
    logEvent('Voce atravessa o portao e entra na <b>masmorra</b>.');
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
    logEvent('Voce retorna a <b>cidade</b>.');
    RPG.Save.save(state);
  }

  document.addEventListener('DOMContentLoaded', function(){
    var regenBtn = document.getElementById('regenMapBtn');
    if(regenBtn){
      regenBtn.addEventListener('click', function(){
        var state = RPG.state;
        if(state.mapMode === 'city'){ enterCity(); logEvent('A cidade foi redesenhada e voce reaparece no inicio.'); }
        else { var startCell = RPG.Dungeon.generate(state); resetPlayerToStart(startCell); renderMap(); renderControls(); logEvent('Este andar foi redesenhado.'); }
        resetDialogue();
      });
    }
  });

  /* ================= MOVEMENT ================= */
  function computeAbsoluteDir(rel, facing){
    // OBS: esquerda/direita foram corrigidos para corresponder ao lado
    // visual esperado pelo jogador (bug relatado de inversao).
    if(rel==='front') return facing;
    if(rel==='left') return RPG.MapUtil.rotateRight(facing);
    if(rel==='right') return RPG.MapUtil.rotateLeft(facing);
    return RPG.MapUtil.opposite(facing);
  }

  function neighborCell(rel){
    var state = RPG.state;
    var absDir = computeAbsoluteDir(rel, state.facing);
    var v = RPG.MapUtil.DIR_VECTORS[absDir];
    var nx = state.pos.x+v.x, ny = state.pos.y+v.y;
    if(!RPG.MapUtil.inBounds(nx,ny,state.mapCols,state.mapRows)) return null;
    var cell = state.map[ny][nx];
    if(!RPG.MapUtil.isWalkable(cell)) return null;
    return { cell: cell, nx: nx, ny: ny, absDir: absDir };
  }

  function needsConfirm(cell){
    if(cell.type==='treasure' && cell.collected) return false;
    if((cell.type==='monster' || cell.type==='boss') && cell.beaten) return false;
    return ['npc','treasure','monster','boss','shop','blacksmith','tavern','questboard','gate','exit','stairs'].indexOf(cell.type) >= 0;
  }

  function tryMove(rel){
    var state = RPG.state;
    if(state.mode !== 'move') return;
    var info = neighborCell(rel);
    if(!info) return;
    state.facing = info.absDir;
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
    state.mode = 'move';
    state.pendingTarget = null;
    setSceneMessage('Voce decide nao entrar e recua um passo.');
    updateSceneText();
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
    logEvent('Voce iniciou uma conversa com <b>'+npc.name+'</b>.');
  }
  function showSimpleDialogue(icon, title, text){
    currentNPC = null;
    document.getElementById('npcCard').style.display = 'flex';
    document.getElementById('npcPortrait').textContent = icon;
    document.getElementById('npcName').textContent = title;
    document.getElementById('npcRole').textContent = 'Evento';
    setSceneMessage(text);
    setDialogueControls(false, true);
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
    updateSceneText();
  }
  function resetDialogueAmbient(){
    currentNPC = null;
    document.getElementById('npcCard').style.display = 'none';
    setDialogueControls(false, false);
    updateSceneText();
  }

  /* ================= MOVEMENT CONTROLS RENDER ================= */
  function renderControls(){
    var state = RPG.state;
    var el = document.getElementById('controlsArea');
    if(state.mode === 'move'){
      var front = neighborCell('front');
      var left = neighborCell('left');
      var right = neighborCell('right');
      var back = neighborCell('back');
      var html = '<div class="dpad">';
      html += front ? '<button class="btn-front" id="btnFront">\u25b2<br>Frente (W)</button>' : '<span class="btn-front"></span>';
      html += left ? '<button class="btn-left" id="btnLeft">\u25c4<br>Esquerda (A)</button>' : '<span class="btn-left"></span>';
      html += back ? '<button class="btn-back" id="btnBack">\u21bb<br>Voltar (S)</button>' : '<span class="btn-back"></span>';
      html += right ? '<button class="btn-right" id="btnRight">\u25ba<br>Direita (D)</button>' : '<span class="btn-right"></span>';
      html += '</div><div class="move-hint">Use os botoes ou WASD / setas do teclado.</div>';
      el.innerHTML = html;
      if(front) document.getElementById('btnFront').addEventListener('click', function(){ tryMove('front'); });
      if(left) document.getElementById('btnLeft').addEventListener('click', function(){ tryMove('left'); });
      if(right) document.getElementById('btnRight').addEventListener('click', function(){ tryMove('right'); });
      if(back) document.getElementById('btnBack').addEventListener('click', function(){ tryMove('back'); });
    } else if(state.mode === 'confirm'){
      el.innerHTML = '<div class="prompt-box"><p>Confirme sua acao no dialogo ao lado.</p><div class="prompt-actions"><button class="yes" id="confirmYesBtn">Sim</button><button class="no" id="confirmNoBtn">Nao</button></div></div>';
      document.getElementById('confirmYesBtn').addEventListener('click', confirmYes);
      document.getElementById('confirmNoBtn').addEventListener('click', confirmNo);
    } else if(state.mode === 'encounter'){
      el.innerHTML = '<div class="prompt-box"><p>Um inimigo apareceu. Enfrentar ou fugir?</p><div class="prompt-actions"><button class="yes" id="encounterFightBtn">Enfrentar</button><button class="no" id="encounterFleeBtn">Fugir</button></div></div>';
    } else if(state.mode === 'combat'){
      el.innerHTML = '<div class="move-hint">Use os botoes na cena de combate acima.</div>';
    }
  }

  /* ================= TECLADO (WASD / setas) ================= */
  function bindKeyboard(){
    document.addEventListener('keydown', function(e){
      if(RPG.state.screen !== 'game') return;
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if(tag === 'INPUT' || tag === 'TEXTAREA') return;
      var key = e.key.toLowerCase();
      if(key==='w' || key==='arrowup'){ tryMove('front'); }
      else if(key==='a' || key==='arrowleft'){ tryMove('left'); }
      else if(key==='d' || key==='arrowright'){ tryMove('right'); }
      else if(key==='s' || key==='arrowdown'){ tryMove('back'); }
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
    document.getElementById('dialogueNextBtn').addEventListener('click', dialogueNext);
    document.getElementById('dialogueCloseBtn').addEventListener('click', function(){
      if(currentNPC){ logEvent('Voce encerrou a conversa com <b>'+currentNPC.name+'</b>.'); }
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
      name==='creation' ? 'criacao de personagem' : 'menu principal';
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
