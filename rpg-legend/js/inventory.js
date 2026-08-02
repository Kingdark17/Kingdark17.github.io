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
    { id:'acessorio', label:'Acessórios' },
    { id:'consumivel', label:'Consumíveis' },
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
      var tier = RPG.Items.tierFor(item);
      var statsPreview = RPG.Items.statTags(item).map(function(t){ return t.text; }).join(' · ');
      card.innerHTML =
        '<div class="ic-top"><span class="ic-icon">'+item.icon+'</span><span class="ic-name">'+item.name+equippedTag+'</span></div>'+
        '<div class="ic-type">'+RPG.Items.CATEGORY_LABELS[item.category]+'</div>'+
        '<div class="ic-meta"><span class="ic-rarity rarity-'+item.rarity+'">'+item.rarityLabel+'</span>'+(tier?'<span class="tier-badge '+RPG.Items.tierClass(tier)+'">Tier '+tier+'</span>':'')+'</div>'+
        '<div class="ic-desc">'+item.desc+'</div>'+
        (statsPreview ? '<div class="ic-stats">'+statsPreview+'</div>' : '');
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
    var itemTier=RPG.Items.tierFor(item);
    var tags = RPG.Items.statTags(item);
    var tagsHtml = tags.map(function(t){ return '<span class="tag '+(t.positive?'buff':'debuff')+'">'+t.text+'</span>'; }).join('');
    if(!tagsHtml){ tagsHtml = '<span class="tag" style="color:var(--parchment-dim); border:1px solid var(--line);">Sem efeitos especiais</span>'; }
    var tierInfo=itemTier?RPG.Items.tierInfo(item):null;
    var itemSheet='<div class="item-stat-sheet"><div><span>Tier</span><b>'+(itemTier||'—')+'</b></div><div><span>Raridade</span><b class="rarity-'+item.rarity+'">'+item.rarityLabel+'</b></div><div><span>Poder</span><b>'+(tierInfo?tierInfo.score:'—')+'</b></div><div><span>Valor</span><b>'+item.value+' ouro</b></div></div>';
    var impactRows=RPG.Items.equipmentImpact(state.hero,item).filter(function(row){return row.diff!==0;});
    var impactHtml=impactRows.length?'<div class="player-impact"><div class="compare-title">Mudança nos status do personagem</div>'+impactRows.map(function(row){return '<div class="impact-row"><span>'+row.label+'</span><span>'+row.before+' → '+row.after+'</span><b class="'+(row.diff>0?'better':'worse')+'">'+(row.diff>0?'+':'')+row.diff+'</b></div>';}).join('')+'</div>':'';

    var extraInfo = '';
    if(item.category==='arma'){
      var affinity = RPG.Combat.weaponAffinityPct({ className: state.hero.className, equip: { arma: item } });
      extraInfo += '<div class="id-affinity">Afinidade do '+state.hero.className+': <b>'+affinity+'%</b> de eficiência'+(affinity<100?' <span class="dim">(menos dano com essa arma)</span>':'')+'</div>';
      if(item.proc){
        extraInfo += '<div class="id-affinity">'+item.proc.icon+' '+Math.round(item.proc.chance*100)+'% de chance: <b>'+item.proc.label+'</b></div>';
      }
    }

    var comparisonHtml='';
    if(item.category==='arma' || item.category==='armadura' || item.category==='acessorio'){
      var equipped=state.hero.equip[item.category];
      if(equipped && equipped.uid!==item.uid){
        var equippedTier=RPG.Items.tierFor(equipped);
        var labels={ataque:'Ataque',defesa:'Defesa',vida:'Vida',mana:'Mana',critico:'Crítico',velocidade:'Velocidade',esquiva:'Esquiva'};
        var keys={};
        Object.keys(equipped.stats||{}).forEach(function(k){keys[k]=true;});
        Object.keys(item.stats||{}).forEach(function(k){keys[k]=true;});
        var rows=Object.keys(keys).map(function(k){
          var oldValue=(equipped.stats&&equipped.stats[k])||0;
          var newValue=(item.stats&&item.stats[k])||0;
          var diff=newValue-oldValue;
          return '<div class="compare-row"><span>'+ (labels[k]||k) +'</span><span>'+oldValue+'</span><span>'+newValue+'</span><b class="'+(diff>0?'better':(diff<0?'worse':'same'))+'">'+(diff>0?'+':'')+diff+'</b></div>';
        }).join('');
        var tierDiff=RPG.Items.tierRank(item)-RPG.Items.tierRank(equipped);
        comparisonHtml='<div class="item-comparison"><div class="compare-title">Comparação com '+equipped.name+'</div><div class="tier-comparison"><span class="tier-badge '+RPG.Items.tierClass(equippedTier)+'">'+equippedTier+'</span><b>→</b><span class="tier-badge '+RPG.Items.tierClass(itemTier)+'">'+itemTier+'</span><strong class="'+(tierDiff>0?'better':(tierDiff<0?'worse':'same'))+'">'+(tierDiff>0?'Tier superior':(tierDiff<0?'Tier inferior':'Mesmo tier'))+'</strong></div><div class="compare-head"><span>Atributo</span><span>Atual</span><span>Novo</span><span>Dif.</span></div>'+rows+'</div>';
      } else if(equipped && equipped.uid===item.uid){
        comparisonHtml='<div class="item-comparison equipped-note">Este item está equipado.</div>';
      }
    }

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
      '<div class="id-title"><span class="ic-icon">'+item.icon+'</span><span class="id-name rarity-'+item.rarity+'">'+item.name+'</span>'+(itemTier?'<span class="tier-badge '+RPG.Items.tierClass(itemTier)+'">Tier '+itemTier+'</span>':'')+'</div>'+
      '<div class="id-desc">'+item.desc+'</div>'+
      itemSheet+
      '<div class="tag-row">'+tagsHtml+'</div>'+
      extraInfo +
      comparisonHtml +
      impactHtml+
      '<div style="font-family:var(--font-mono); font-size:11px; color:var(--gold-bright); margin-top:8px;">Valor: '+item.value+' ouro</div>'+
      '<div class="panel-btn-row" style="margin-top:10px;">'+actions+'</div>';

    var eqBtn = document.getElementById('actEquip');
    if(eqBtn){ eqBtn.addEventListener('click', function(){
      RPG.Player.equipItem(state.hero, item);
      RPG.Effects.playSfx('buy');
      RPG.UI.renderHero();
      RPG.Save.save(state);
      render(state);
    }); }
    var unBtn = document.getElementById('actUnequip');
    if(unBtn){ unBtn.addEventListener('click', function(){
      RPG.Player.unequipItem(state.hero, item.category);
      RPG.UI.renderHero();
      RPG.Save.save(state);
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
      RPG.Save.save(state);
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
      RPG.UI.logEvent('Você usou <b>'+item.name+'</b>.');
      removeByUid(state, item.uid);
      selectedUid = null;
      RPG.UI.renderHero();
      RPG.Save.save(state);
    }
  }

  function resetSelection(){ selectedUid = null; activeTab = 'todos'; }

  return { addItem: addItem, removeByUid: removeByUid, findByUid: findByUid, render: render, resetSelection: resetSelection, useConsumable: useConsumable };
})();
