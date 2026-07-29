/* =========================================================
   RPG Legend - js/shop.js
   Vendedor (itens gerais) e Ferreiro (equipamentos), com
   estoque aleatorio que pode ser renovado.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Shop = (function(){

  var activeCell = null;
  var activeKind = 'shop'; // 'shop' ou 'blacksmith'
  var discount = 0;
  var discountRolled = false;

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
    discount = 0;
    discountRolled = false;
    ensureStock(cell, kind, state.floor);
    document.getElementById('merchantTitle').textContent = kind==='blacksmith' ? '\ud83d\udd28 Ferreiro' : '\ud83c\udff5 Vendedor Itinerante';
    render(state);
    document.getElementById('merchantModal').classList.remove('hidden');
  }

  function close(){ document.getElementById('merchantModal').classList.add('hidden'); }

  function buyPrice(item){ return Math.max(1, Math.round(item.value * (1 - discount))); }

  function rollForDiscount(state){
    if(discountRolled) return;
    RPG.Combat.rollDie(20, function(result){
      var pct = 0;
      if(result >= 20) pct = 30;
      else if(result >= 19) pct = 20;
      else if(result >= 15) pct = 15;
      else if(result >= 11) pct = 10;
      else if(result >= 6) pct = 5;
      discount = pct/100;
      discountRolled = true;
      RPG.Effects.playSfx(pct>0 ? 'gold' : 'miss');
      RPG.UI.logEvent(pct>0
        ? 'Voce rolou '+result+' no d20 e convenceu o comerciante a dar '+pct+'% de desconto.'
        : 'Voce rolou '+result+' no d20 e o comerciante nao cedeu desconto algum desta vez.');
      render(state);
    });
  }

  function renderNegotiation(state){
    var el = document.getElementById('merchantNegotiation');
    if(!el) return;
    if(discountRolled){
      el.innerHTML = discount > 0
        ? '<span class="haggle-result">Desconto conseguido: <b>'+Math.round(discount*100)+'%</b> nesta visita.</span>'
        : '<span class="haggle-result dim">O comerciante nao cedeu desconto desta vez.</span>';
    } else {
      el.innerHTML = '<button class="rune-btn small" id="haggleBtn">\ud83c\udfb2 Rolar Dado por Desconto</button>';
      var btn = document.getElementById('haggleBtn');
      if(btn){ btn.addEventListener('click', function(){ rollForDiscount(state); }); }
    }
  }

  function render(state){
    document.getElementById('merchantGoldText').textContent = state.hero.gold;
    renderNegotiation(state);

    var buyGrid = document.getElementById('merchantBuyGrid');
    buyGrid.innerHTML = '';
    activeCell.forSale.forEach(function(item, idx){
      var price = buyPrice(item);
      var afford = state.hero.gold >= price;
      var card = document.createElement('div');
      card.className = 'item-card rarity-'+item.rarity;
      card.innerHTML =
        '<div class="ic-top"><span class="ic-icon">'+item.icon+'</span><span class="ic-name">'+item.name+'</span></div>'+
        '<div class="ic-type">'+RPG.Items.CATEGORY_LABELS[item.category]+'</div>'+
        '<div class="ic-rarity rarity-'+item.rarity+'">'+item.rarityLabel+'</div>'+
        '<div class="ic-price">'+(discount>0 ? '<s>'+item.value+'</s> '+price : price)+' ouro</div>'+
        '<button class="trade-btn" data-idx="'+idx+'" '+(afford?'':'disabled')+'>Comprar</button>';
      buyGrid.appendChild(card);
    });
    Array.prototype.forEach.call(buyGrid.querySelectorAll('.trade-btn'), function(btn){
      btn.addEventListener('click', function(){
        var idx = parseInt(btn.getAttribute('data-idx'),10);
        var item = activeCell.forSale[idx];
        var price = buyPrice(item);
        if(state.hero.gold >= price){
          state.hero.gold -= price;
          RPG.Inventory.addItem(state, item);
          activeCell.forSale.splice(idx,1);
          RPG.Effects.playSfx('buy');
          RPG.UI.logEvent('Voce comprou <b>'+item.name+'</b> por '+price+' ouro.');
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
