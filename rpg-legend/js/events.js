/* =========================================================
   RPG Legend - js/events.js
   Eventos de masmorra com escolhas curtas e resultados
   influenciados pelos atributos do personagem.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Events = (function(){
  var TEMPLATES = [
    { id:'ferido', icon:'\ud83e\ude79', title:'Aventureiro Ferido', text:'Um aventureiro ferido pede ajuda no canto da sala.' },
    { id:'altar', icon:'\ud83d\udd6f\ufe0f', title:'Altar Antigo', text:'Runas antigas brilham sobre um altar coberto de poeira.' },
    { id:'porta', icon:'\ud83d\udeaa', title:'Porta Lacrada', text:'Uma porta de pedra protege algo valioso. Força ou conhecimento podem abri-la.' }
  ];

  function random(){ return TEMPLATES[Math.floor(Math.random()*TEMPLATES.length)]; }
  function finish(state, cell, message){
    cell.resolved = true;
    state.mode = 'move';
    RPG.UI.setSceneMessage(message);
    RPG.UI.logEvent(message);
    RPG.UI.renderHero();
    RPG.UI.renderMap();
    RPG.UI.renderControls();
    RPG.Save.save(state);
  }
  function button(id, text){ return '<button class="event-choice" data-choice="'+id+'">'+text+'</button>'; }

  function open(state, cell){
    var ev = cell.event;
    if(cell.resolved){ RPG.UI.showSimpleDialogue(ev.icon, ev.title, 'Este evento já foi resolvido.'); return; }
    state.mode = 'event';
    document.getElementById('npcCard').style.display = 'flex';
    document.getElementById('npcPortrait').textContent = ev.icon;
    document.getElementById('npcName').textContent = ev.title;
    document.getElementById('npcRole').textContent = 'Escolha de Atributo';
    var choices = '';
    if(ev.id==='ferido') choices = button('ajudar','Dar 15 ouro') + button('curar','Usar SAB') + button('ignorar','Seguir caminho');
    if(ev.id==='altar') choices = button('estudar','Estudar com INT') + button('rezar','Rezar com SAB') + button('sacrificar','Sacrificar Vida');
    if(ev.id==='porta') choices = button('forcar','Forçar com FOR') + button('examinar','Examinar com INT') + button('desistir','Deixar fechada');
    RPG.UI.setSceneMessage(ev.text+'<div class="event-choices">'+choices+'</div>');
    RPG.UI.renderControls();
    Array.prototype.forEach.call(document.querySelectorAll('.event-choice'), function(btn){
      btn.addEventListener('click', function(){ resolve(state, cell, btn.getAttribute('data-choice')); });
    });
  }

  function resolve(state, cell, choice){
    if(cell.resolved) return;
    var h = state.hero, a = h.attrs, success, item, amount;
    if(choice==='ignorar' || choice==='desistir'){ finish(state, cell, 'Você decide não arriscar e segue em frente.'); return; }
    if(choice==='ajudar'){
      if(h.gold < 15){ RPG.UI.setSceneMessage('Você não possui 15 ouro. Escolha outra opção.'); return; }
      h.gold -= 15; h.hp = Math.min(h.maxHp, h.hp+20);
      var xpResult = RPG.Player.gainXP(h,8);
      if(xpResult.leveledUp) RPG.UI.onLevelUp(xpResult.levels);
      finish(state, cell, 'O aventureiro agradece e compartilha provisões. Você recupera 20 de Vida e ganha 8 XP.'); return;
    }
    if(choice==='curar'){
      success = a.sabedoria >= 12;
      if(success){ h.gold += 30; finish(state, cell, 'Sua Sabedoria salva o aventureiro. Ele recompensa você com 30 ouro.'); }
      else { finish(state, cell, 'Você tenta ajudar, mas não domina o tratamento. Ao menos o ferido consegue descansar.'); }
      return;
    }
    if(choice==='estudar' || choice==='examinar'){
      success = a.intelecto >= 13;
      if(success){ item = RPG.Items.randomItem({ floor:state.floor }); RPG.Inventory.addItem(state,item); RPG.Quests.onItemCollected(state); finish(state, cell, 'Seu Intelecto revela o mecanismo. Você encontra <b>'+item.name+'</b>: '+item.desc); }
      else { h.mp = Math.max(0,h.mp-8); finish(state, cell, 'O enigma resiste e consome 8 de sua Mana.'); }
      return;
    }
    if(choice==='rezar'){
      success = a.sabedoria >= 13;
      if(success){ h.hp=h.maxHp; h.mp=h.maxMp; finish(state, cell, 'O altar responde a sua Sabedoria e restaura completamente Vida e Mana.'); }
      else { finish(state, cell, 'O altar permanece silencioso.'); }
      return;
    }
    if(choice==='sacrificar'){
      amount = Math.max(10,Math.floor(h.maxHp*0.2));
      if(h.hp<=amount){ RPG.UI.setSceneMessage('Você está ferido demais para realizar o sacrifício.'); return; }
      h.hp -= amount; h.attrPoints=(h.attrPoints||0)+1;
      finish(state, cell, 'O altar aceita '+amount+' de Vida e concede 1 ponto de atributo.'); return;
    }
    if(choice==='forcar'){
      success = a.forca >= 13;
      if(success){ amount=18+state.floor*3; h.gold+=amount; finish(state, cell, 'Sua Força rompe a porta. Dentro, você encontra '+amount+' ouro.'); }
      else { h.hp=Math.max(1,h.hp-10); finish(state, cell, 'A porta não cede e você sofre 10 de dano no esforço.'); }
    }
  }

  return { random:random, open:open };
})();
