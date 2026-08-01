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
  var restockCount = 0;

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
    restockCount = 0;
    ensureStock(cell, kind, state.floor);
    document.getElementById('merchantTitle').textContent = kind==='blacksmith' ? '\ud83d\udd28 Ferreiro' : '\ud83c\udff5 Vendedor Itinerante';
    render(state);
    document.getElementById('merchantModal').classList.remove('hidden');
  }

  function close(){ document.getElementById('merchantModal').classList.add('hidden'); }

  function buyPrice(state, item){
    var d = state.hero.derived || RPG.Player.getDerived(state.hero);
    var total = Math.min(0.6, (d.descontoLoja/100) + discount);
    return Math.max(1, Math.round(item.value * (1 - total)));
  }

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
        ? 'Você rolou '+result+' no d20 e convenceu o comerciante a dar '+pct+'% de desconto.'
        : 'Você rolou '+result+' no d20 e o comerciante não cedeu desconto algum desta vez.');
      render(state);
    });
  }

  function renderNegotiation(state){
    var el = document.getElementById('merchantNegotiation');
    if(!el) return;
    if(discountRolled){
      el.innerHTML = discount > 0
        ? '<span class="haggle-result">Desconto conseguido: <b>'+Math.round(discount*100)+'%</b> nesta visita.</span>'
        : '<span class="haggle-result dim">O comerciante não cedeu desconto desta vez.</span>';
    } else {
      el.innerHTML = '<button class="rune-btn small" id="haggleBtn">\ud83c\udfb2 Rolar Dado por Desconto</button>';
      var btn = document.getElementById('haggleBtn');
      if(btn){ btn.addEventListener('click', function(){ rollForDiscount(state); }); }
    }
  }

  function render(state){
    document.getElementById('merchantGoldText').textContent = state.hero.gold;
    var restockBtn = document.getElementById('merchantRestockBtn');
    var restockPrice = 10 + state.floor*3 + restockCount*10;
    if(restockBtn){
      restockBtn.textContent = 'Renovar Estoque ('+restockPrice+' ouro)';
      restockBtn.disabled = state.hero.gold < restockPrice;
    }
    renderNegotiation(state);

    var buyGrid = document.getElementById('merchantBuyGrid');
    buyGrid.innerHTML = '';
    activeCell.forSale.forEach(function(item, idx){
      var price = buyPrice(state, item);
      var afford = state.hero.gold >= price;
      var statsPreview = RPG.Items.statTags(item).map(function(t){ return t.text; }).join(' · ');
      var card = document.createElement('div');
      card.className = 'item-card rarity-'+item.rarity;
      card.innerHTML =
        '<div class="ic-top"><span class="ic-icon">'+item.icon+'</span><span class="ic-name">'+item.name+'</span></div>'+
        '<div class="ic-type">'+RPG.Items.CATEGORY_LABELS[item.category]+'</div>'+
        '<div class="ic-rarity rarity-'+item.rarity+'">'+item.rarityLabel+'</div>'+
        '<div class="ic-desc">'+item.desc+'</div>'+
        (statsPreview ? '<div class="ic-stats">'+statsPreview+'</div>' : '')+
        (item.proc ? '<div class="ic-power">'+item.proc.icon+' '+Math.round(item.proc.chance*100)+'%: '+item.proc.label+'</div>' : '')+
        '<div class="ic-price">'+(price<item.value ? '<s>'+item.value+'</s> '+price : price)+' ouro</div>'+
        '<button class="trade-btn" data-idx="'+idx+'" '+(afford?'':'disabled')+'>Comprar</button>';
      buyGrid.appendChild(card);
    });
    Array.prototype.forEach.call(buyGrid.querySelectorAll('.trade-btn'), function(btn){
      btn.addEventListener('click', function(){
        var idx = parseInt(btn.getAttribute('data-idx'),10);
        var item = activeCell.forSale[idx];
        var price = buyPrice(state, item);
        if(state.hero.gold >= price){
          state.hero.gold -= price;
          RPG.Inventory.addItem(state, item);
          activeCell.forSale.splice(idx,1);
          RPG.Effects.playSfx('buy');
          RPG.UI.logEvent('Você comprou <b>'+item.name+'</b> por '+price+' ouro.');
          RPG.UI.renderHero();
          RPG.Save.save(state);
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
      var statsPreview = RPG.Items.statTags(item).map(function(t){ return t.text; }).join(' · ');
      var card = document.createElement('div');
      card.className = 'item-card rarity-'+item.rarity;
      card.innerHTML =
        '<div class="ic-top"><span class="ic-icon">'+item.icon+'</span><span class="ic-name">'+item.name+'</span></div>'+
        '<div class="ic-type">'+RPG.Items.CATEGORY_LABELS[item.category]+'</div>'+
        '<div class="ic-desc">'+item.desc+'</div>'+
        (statsPreview ? '<div class="ic-stats">'+statsPreview+'</div>' : '')+
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
          RPG.UI.logEvent('Você vendeu <b>'+item.name+'</b> por '+sellPrice+' ouro.');
          RPG.UI.renderHero();
          RPG.Save.save(state);
          render(state);
        }
      });
    });
  }

  function restock(state){
    var price = 10 + state.floor*3 + restockCount*10;
    if(state.hero.gold < price){
      RPG.UI.logEvent('Ouro insuficiente para renovar o estoque.');
      return;
    }
    state.hero.gold -= price;
    restockCount++;
    activeCell.forSale = rollStock(activeKind, state.floor);
    RPG.UI.logEvent('O comerciante renovou seu estoque por '+price+' ouro.');
    RPG.UI.renderHero();
    RPG.Save.save(state);
    render(state);
  }

  return { open: open, close: close, restock: restock };
})();
