/* =========================================================
   RPG Legend - js/inventory.js
   Renderizacao do modal de mochila, categorias e acoes de item.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Inventory = (function(){

  var activeTab = 'todos';
  var selectedUid = null;

  function addItem(state, item){ state.inventory.push(item); }

  function removeByUid(state, uid){
    var idx = state.inventory.findIndex(function(it){ return it.uid===uid; });
    if(idx>=0){ return state.inventory.splice(idx,1)[0]; }
    return null;
  }

  function findByUid(state, uid){
    return state.inventory.filter(function(it){ return it.uid===uid; })[0] || null;
  }

  var TABS = [
    { id:'todos', label:'Todos' },
    { id:'arma', label:'Armas' },
    { id:'armadura', label:'Armaduras' },
    { id:'acessorio', label:'Acessorios' },
    { id:'consumivel', label:'Consumiveis' },
    { id:'material', label:'Materiais' }
  ];

  function render(state){
    var tabRow = document.getElementById('invTabs');
    tabRow.innerHTML = '';
    TABS.forEach(function(t){
      var btn = document.createElement('button');
      btn.className = 'tab-btn' + (activeTab===t.id ? ' active' : '');
      btn.textContent = t.label;
      btn.addEventListener('click', function(){ activeTab = t.id; render(state); });
      tabRow.appendChild(btn);
    });

    var grid = document.getElementById('itemGrid');
    grid.innerHTML = '';
    var items = state.inventory.filter(function(it){ return activeTab==='todos' || it.category===activeTab; });
    if(items.length===0){ grid.innerHTML = '<div style="color:var(--parchment-dim); font-size:13px;">Nenhum item nesta categoria.</div>'; }

    items.forEach(function(item){
      var card = document.createElement('div');
      card.className = 'item-card rarity-'+item.rarity + (selectedUid===item.uid ? ' selected' : '');
      var equippedTag = item.equipped ? ' (equipado)' : '';
      card.innerHTML =
        '<div class="ic-top"><span class="ic-icon">'+item.icon+'</span><span class="ic-name">'+item.name+equippedTag+'</span></div>'+
        '<div class="ic-type">'+RPG.Items.CATEGORY_LABELS[item.category]+'</div>'+
        '<div class="ic-rarity rarity-'+item.rarity+'">'+item.rarityLabel+'</div>';
      card.addEventListener('click', function(){ selectedUid = item.uid; render(state); showDetail(state, item); });
      grid.appendChild(card);
    });

    if(selectedUid){
      var sel = findByUid(state, selectedUid);
      if(sel){ showDetail(state, sel); } else { document.getElementById('itemDetail').style.display='none'; }
    } else if(items.length){
      selectedUid = items[0].uid;
      showDetail(state, items[0]);
    } else {
      document.getElementById('itemDetail').style.display = 'none';
    }
  }

  function showDetail(state, item){
    var detail = document.getElementById('itemDetail');
    detail.style.display = 'block';
    var tags = RPG.Items.statTags(item);
    var tagsHtml = tags.map(function(t){ return '<span class="tag '+(t.positive?'buff':'debuff')+'">'+t.text+'</span>'; }).join('');
    if(!tagsHtml){ tagsHtml = '<span class="tag" style="color:var(--parchment-dim); border:1px solid var(--line);">Sem efeitos especiais</span>'; }

    var actions = '';
    if(item.category==='arma' || item.category==='armadura' || item.category==='acessorio'){
      actions += item.equipped
        ? '<button class="equip-btn" id="actUnequip">Desequipar</button>'
        : '<button class="equip-btn" id="actEquip">Equipar</button>';
    }
    if(item.category==='consumivel'){
      actions += '<button class="equip-btn" id="actUse">Usar</button>';
    }
    actions += '<button class="equip-btn" id="actDiscard">Descartar</button>';

    detail.innerHTML =
      '<div class="id-title"><span class="ic-icon">'+item.icon+'</span><span class="id-name rarity-'+item.rarity+'">'+item.name+'</span></div>'+
      '<div class="id-desc">'+item.desc+'</div>'+
      '<div class="tag-row">'+tagsHtml+'</div>'+
      '<div style="font-family:var(--font-mono); font-size:11px; color:var(--gold-bright); margin-top:8px;">Valor: '+item.value+' ouro</div>'+
      '<div class="panel-btn-row" style="margin-top:10px;">'+actions+'</div>';

    var eqBtn = document.getElementById('actEquip');
    if(eqBtn){ eqBtn.addEventListener('click', function(){
      RPG.Player.equipItem(state.hero, item);
      RPG.Effects.playSfx('buy');
      RPG.UI.renderHero();
      render(state);
    }); }
    var unBtn = document.getElementById('actUnequip');
    if(unBtn){ unBtn.addEventListener('click', function(){
      RPG.Player.unequipItem(state.hero, item.category);
      RPG.UI.renderHero();
      render(state);
    }); }
    var useBtn = document.getElementById('actUse');
    if(useBtn){ useBtn.addEventListener('click', function(){
      useConsumable(state, item);
      render(state);
    }); }
    var discardBtn = document.getElementById('actDiscard');
    if(discardBtn){ discardBtn.addEventListener('click', function(){
      if(item.equipped){ RPG.Player.unequipItem(state.hero, item.category); }
      removeByUid(state, item.uid);
      selectedUid = null;
      RPG.UI.renderHero();
      render(state);
    }); }
  }

  function useConsumable(state, item){
    var hero = state.hero;
    var healed = false;
    if(item.stats.cura){ hero.hp = Math.min(hero.maxHp, hero.hp + item.stats.cura); healed = true; }
    if(item.stats.curaMana){ hero.mp = Math.min(hero.maxMp, hero.mp + item.stats.curaMana); healed = true; }
    if(healed){
      RPG.Effects.playSfx('gold');
      RPG.UI.logEvent('Voce usou <b>'+item.name+'</b>.');
      removeByUid(state, item.uid);
      selectedUid = null;
      RPG.UI.renderHero();
    }
  }

  function resetSelection(){ selectedUid = null; activeTab = 'todos'; }

  return { addItem: addItem, removeByUid: removeByUid, findByUid: findByUid, render: render, resetSelection: resetSelection, useConsumable: useConsumable };
})();
