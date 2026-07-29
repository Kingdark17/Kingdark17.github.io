/* =========================================================
   RPG Legend - js/save.js
   Salvamento automatico em localStorage. Guarda heroi,
   inventario, ouro, XP, andar, missoes e configuracoes.
   O layout exato do mapa nao e salvo (e regenerado), mas
   todo o progresso do personagem sim.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Save = (function(){

  var KEY = 'rpg_legend_save_v1';

  function hasSave(){
    try{ return !!localStorage.getItem(KEY); }catch(e){ return false; }
  }

  function save(state){
    try{
      var data = {
        hero: state.hero,
        party: state.party,
        inventory: state.inventory,
        quests: state.quests,
        floor: state.floor,
        mapMode: state.mapMode,
        soundOn: state.soundOn,
        savedAt: Date.now()
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    }catch(e){ return false; }
  }

  function load(){
    try{
      var raw = localStorage.getItem(KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null; }
  }

  function clear(){
    try{ localStorage.removeItem(KEY); }catch(e){}
  }

  return { hasSave: hasSave, save: save, load: load, clear: clear, KEY: KEY };
})();
