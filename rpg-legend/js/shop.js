/* =========================================================
   RPG Legend - js/shop.js
   Vendedor (itens gerais) e Ferreiro (equipamentos), com
   estoque aleatorio que pode ser renovado.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Shop = (function(){

  var activeCell = null;
  var activeKind = 'shop'; // 'shop' ou 'blacksmith'

  function rollStock(kind, floor){
    var stock = [];
    var count = 5;
    for(var i=0;i<count;i++){
      if(kind === 'blacksmith'){
        var cat = ['arma','armadura','acessorio'][Math.floor(Math.random()*3)];
        stock.push(RPG.Items.randomItem({ category: cat, floor: floor }));
      } else {
        stock.push(RPG.Items.randomItem({ category:'consumivel', floor: floor }));
      }
    }
    return stock;
  }

  function ensureStock(cell, kind, floor){
    if(!cell.forSale){ cell.forSale = rollStock(kind, floor); }
  }

  function open(state, cell, kind){
    activeCell = cell;
    activeKind = kind;
    ensureStock(cell, kind, state.floor);
    document.getElementById('merchantTitle').textContent = kind==='blacksmith' ? '\ud83d\udd28 Ferreiro' : '\ud83c\udff5 Vendedor Itinerante';
    render(state);
    document.getElementById('merchantModal').classList.remove('hidden');
  }

  function close(){ document.getElementById('merchantModal').classList.add('hidden'); }

  function render(state){
    document.getElementById('merchantGoldText').textContent = state.hero.gold;

    var buyGrid = document.getElementById('merchantBuyGrid');
    buyGrid.innerHTML = '';
    activeCell.forSale.forEach(function(item, idx){
      var afford = state.hero.gold >= item.value;
      var card = document.createElement('div');
      card.className = 'item-card rarity-'+item.rarity;
      card.innerHTML =
        '<div class="ic-top"><span class="ic-icon">'+item.icon+'</span><span class="ic-name">'+item.name+'</span></div>'+
        '<div class="ic-type">'+RPG.Items.CATEGORY_LABELS[item.category]+'</div>'+
        '<div class="ic-rarity rarity-'+item.rarity+'">'+item.rarityLabel+'</div>'+
        '<div class="ic-price">'+item.value+' ouro</div>'+
        '<button class="trade-btn" data-idx="'+idx+'" '+(afford?'':'disabled')+'>Comprar</button>';
      buyGrid.appendChild(card);
    });
    Array.prototype.forEach.call(buyGrid.querySelectorAll('.trade-btn'), function(btn){
      btn.addEventListener('click', function(){
        var idx = parseInt(btn.getAttribute('data-idx'),10);
        var item = activeCell.forSale[idx];
        if(state.hero.gold >= item.value){
          state.hero.gold -= item.value;
          RPG.Inventory.addItem(state, item);
          activeCell.forSale.splice(idx,1);
          RPG.Effects.playSfx('buy');
          RPG.UI.logEvent('Voce comprou <b>'+item.name+'</b> por '+item.value+' ouro.');
          RPG.UI.renderHero();
          render(state);
        }
      });
    });

    var sellGrid = document.getElementById('merchantSellGrid');
    sellGrid.innerHTML = '';
    var sellable = state.inventory.filter(function(it){ return !it.equipped; });
    if(sellable.length===0){ sellGrid.innerHTML = '<div style="color:var(--parchment-dim); font-size:13px;">Nada para vender no momento.</div>'; }
    sellable.forEach(function(item){
      var sellPrice = Math.max(1, Math.floor(item.value*0.5));
      var card = document.createElement('div');
      card.className = 'item-card rarity-'+item.rarity;
      card.innerHTML =
        '<div class="ic-top"><span class="ic-icon">'+item.icon+'</span><span class="ic-name">'+item.name+'</span></div>'+
        '<div class="ic-type">'+RPG.Items.CATEGORY_LABELS[item.category]+'</div>'+
        '<div class="ic-price">'+sellPrice+' ouro</div>'+
        '<button class="trade-btn" data-uid="'+item.uid+'">Vender</button>';
      sellGrid.appendChild(card);
    });
    Array.prototype.forEach.call(sellGrid.querySelectorAll('.trade-btn'), function(btn){
      btn.addEventListener('click', function(){
        var uid = btn.getAttribute('data-uid');
        var item = RPG.Inventory.findByUid(state, uid);
        if(item){
          var sellPrice = Math.max(1, Math.floor(item.value*0.5));
          state.hero.gold += sellPrice;
          RPG.Inventory.removeByUid(state, uid);
          RPG.Effects.playSfx('sell');
          RPG.UI.logEvent('Voce vendeu <b>'+item.name+'</b> por '+sellPrice+' ouro.');
          RPG.UI.renderHero();
          render(state);
        }
      });
    });
  }

  function restock(state){
    activeCell.forSale = rollStock(activeKind, state.floor);
    RPG.UI.logEvent('O comerciante renovou seu estoque.');
    render(state);
  }

  return { open: open, close: close, restock: restock };
})();
