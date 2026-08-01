/* =========================================================
   RPG Legend - js/quests.js
   Quadro de missoes simples: matar monstros, alcancar andar,
   coletar itens. Progresso rastreado em state.quests.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Quests = (function(){

  function rnd(n){ return Math.floor(Math.random()*n); }

  function generateQuest(state){
    var types = ['kill','floor','collect'];
    var type = types[rnd(types.length)];
    if(type === 'kill'){
      var amount = 3 + rnd(4);
      return { id:'q_'+Date.now()+'_'+rnd(9999), type:'kill', target:amount, progress:0,
        title:'Caçador de Monstros', desc:'Derrote '+amount+' monstros na masmorra.',
        rewardXp: 20+amount*5, rewardGold: 15+amount*4, done:false, claimed:false };
    }
    if(type === 'floor'){
      var floorTarget = state.floor + 2 + rnd(3);
      return { id:'q_'+Date.now()+'_'+rnd(9999), type:'floor', target:floorTarget, progress: state.floor,
        title:'Exploradora das Profundezas', desc:'Alcance o andar '+floorTarget+' da masmorra.',
        rewardXp: 30+floorTarget*4, rewardGold: 20+floorTarget*5, done:false, claimed:false };
    }
    var itemAmount = 2 + rnd(3);
    return { id:'q_'+Date.now()+'_'+rnd(9999), type:'collect', target:itemAmount, progress:0,
      title:'Coletora de Materiais', desc:'Colete '+itemAmount+' itens de qualquer tipo.',
      rewardXp: 15+itemAmount*5, rewardGold: 10+itemAmount*4, done:false, claimed:false };
  }

  function ensureBoard(state){
    if(!state.quests || state.quests.length===0){
      state.quests = [generateQuest(state), generateQuest(state)];
    }
  }

  function onMonsterKilled(state){
    (state.quests||[]).forEach(function(q){
      if(q.type==='kill' && !q.done){ q.progress++; if(q.progress>=q.target){ q.done=true; } }
    });
  }

  function onFloorReached(state){
    (state.quests||[]).forEach(function(q){
      if(q.type==='floor' && !q.done){ q.progress = state.floor; if(q.progress>=q.target){ q.done=true; } }
    });
  }

  function onItemCollected(state){
    (state.quests||[]).forEach(function(q){
      if(q.type==='collect' && !q.done){ q.progress++; if(q.progress>=q.target){ q.done=true; } }
    });
  }

  function claim(state, questId){
    var q = (state.quests||[]).filter(function(x){ return x.id===questId; })[0];
    if(!q || !q.done || q.claimed) return;
    q.claimed = true;
    state.hero.gold += q.rewardGold;
    var res = RPG.Player.gainXP(state.hero, q.rewardXp);
    RPG.UI.logEvent('Missão concluída: <b>'+q.title+'</b>. +'+q.rewardXp+' XP, +'+q.rewardGold+' ouro.');
    RPG.Effects.playSfx('victory');
    state.quests = state.quests.filter(function(x){ return x.id!==questId; });
    state.quests.push(generateQuest(state));
    if(res.leveledUp){ RPG.UI.onLevelUp(res.levels); }
    RPG.UI.renderHero();
    RPG.Save.save(state);
    renderBoard(state);
  }

  function renderBoard(state){
    ensureBoard(state);
    var el = document.getElementById('questList');
    el.innerHTML = '';
    state.quests.forEach(function(q){
      var card = document.createElement('div');
      card.className = 'quest-card';
      card.innerHTML =
        '<div class="q-title">'+q.title+'</div>'+
        '<div class="q-desc">'+q.desc+'</div>'+
        '<div class="q-progress">Progresso: '+Math.min(q.progress,q.target)+' / '+q.target+'</div>'+
        '<div class="q-reward">Recompensa: '+q.rewardXp+' XP \u00b7 '+q.rewardGold+' ouro</div>'+
        (q.done ? '<button class="rune-btn small" data-id="'+q.id+'">Resgatar Recompensa</button>' : '');
      el.appendChild(card);
    });
    Array.prototype.forEach.call(el.querySelectorAll('button[data-id]'), function(btn){
      btn.addEventListener('click', function(){ claim(state, btn.getAttribute('data-id')); });
    });
  }

  function openBoard(state){
    ensureBoard(state);
    renderBoard(state);
    document.getElementById('questModal').classList.remove('hidden');
  }
  function closeBoard(){ document.getElementById('questModal').classList.add('hidden'); }

  return { ensureBoard: ensureBoard, onMonsterKilled: onMonsterKilled, onFloorReached: onFloorReached, onItemCollected: onItemCollected, openBoard: openBoard, closeBoard: closeBoard, renderBoard: renderBoard };
})();
