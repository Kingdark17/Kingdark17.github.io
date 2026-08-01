/* =========================================================
   RPG Legend - js/npc-services.js
   Serviços simples oferecidos pelos NPCs encontrados no mapa.
   ========================================================= */
var RPG = window.RPG || {};

RPG.NPCServices = (function(){
  var INFO = {
    heal: { icon:'\u2764\ufe0f', label:'Receber Tratamento' },
    blessing: { icon:'\u2728', label:'Receber Bênção' },
    barter: { icon:'\ud83e\uddea', label:'Trocar Material' },
    reveal: { icon:'\ud83d\uddfa\ufe0f', label:'Pedir Informações' },
    recruit: { icon:'\ud83e\udd1d', label:'Convidar para a Equipe' }
  };

  function info(service){ return INFO[service] || null; }
  function finish(state, npc, message){
    npc.serviceUsed = true;
    RPG.UI.renderHero();
    RPG.UI.renderMap();
    RPG.Save.save(state);
    return message;
  }
  function heal(state, npc){
    var hero = state.hero;
    var discount = Math.min(0.4,(hero.derived.descontoLoja||0)/100);
    var price = Math.max(5,Math.round((14+state.floor*2)*(1-discount)));
    if(hero.gold<price) return 'O tratamento custa '+price+' ouro, mas você não possui essa quantia.';
    if(hero.hp===hero.maxHp && hero.mp===hero.maxMp) return 'Você já está com Vida e Mana completas.';
    hero.gold-=price;
    hero.hp=Math.min(hero.maxHp,hero.hp+Math.round(hero.maxHp*0.45));
    hero.mp=Math.min(hero.maxMp,hero.mp+Math.round(hero.maxMp*0.35));
    return finish(state,npc,'O tratamento restaura parte de sua Vida e Mana por '+price+' ouro.');
  }
  function blessing(state,npc){
    state.hero.npcBlessing={ combats:3, dodge:12 };
    return finish(state,npc,'Você recebe uma bênção: +12% de Esquiva nos próximos 3 combates.');
  }
  function barter(state,npc){
    var material=state.inventory.filter(function(item){ return item.category==='material' && !item.equipped; })[0];
    if(!material) return 'O alquimista aceita um material, mas você não possui nenhum na mochila.';
    RPG.Inventory.removeByUid(state,material.uid);
    var potion=RPG.Items.randomItem({category:'consumivel',floor:state.floor});
    RPG.Inventory.addItem(state,potion);
    return finish(state,npc,'Você troca <b>'+material.name+'</b> por <b>'+potion.name+'</b>. '+potion.desc);
  }
  function reveal(state,npc){
    var revealed=0;
    state.map.forEach(function(row){ row.forEach(function(cell){
      var distance=Math.abs(cell.x-state.pos.x)+Math.abs(cell.y-state.pos.y);
      if(cell.type!=='void' && distance<=2 && !cell.revealed){ cell.revealed=true; revealed++; }
    }); });
    return finish(state,npc,revealed ? ('O cartógrafo revela '+revealed+' sala(s) próxima(s) no mapa.') : 'Todas as salas próximas já eram conhecidas.');
  }
  function recruit(state,npc){
    if((state.party||[]).length>=3) return 'Sua equipe já está completa.';
    var companion=RPG.Player.generateCompanion();
    companion.temporary=true;
    companion.combatsLeft=3;
    state.party.push(companion);
    return finish(state,npc,'<b>'+companion.name+'</b>, '+companion.className+', entra na equipe pelos próximos 3 combates.');
  }
  function use(state,npc){
    if(!npc || !npc.service) return 'Este NPC não possui um serviço disponível.';
    if(npc.serviceUsed) return 'Este serviço já foi utilizado durante este encontro.';
    if(npc.service==='heal') return heal(state,npc);
    if(npc.service==='blessing') return blessing(state,npc);
    if(npc.service==='barter') return barter(state,npc);
    if(npc.service==='reveal') return reveal(state,npc);
    if(npc.service==='recruit') return recruit(state,npc);
    return 'Nada acontece.';
  }
  return { info:info, use:use };
})();
