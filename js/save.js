/* =========================================================
   RPG Legend - js/save.js
   Salvamento automatico em localStorage. Guarda heroi,
   inventario, ouro, XP, andar, missoes, configuracoes,
   layout do mapa e posicao exata do jogador.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Save = (function(){

  var KEY = 'rpg_legend_save_v1';
  var OFFLINE_KEY = 'rpg_legend_imported_backup_v1';

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
        map: state.map,
        mapRows: state.mapRows,
        mapCols: state.mapCols,
        pos: state.pos,
        soundOn: state.soundOn,
        tutorial: state.tutorial,
        savedAt: Date.now()
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      if(RPG.Account&&RPG.Account.scheduleCloudSave)RPG.Account.scheduleCloudSave();
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
    try{ localStorage.removeItem(KEY); localStorage.removeItem(OFFLINE_KEY); }catch(e){}
  }

  function isImportedBackup(){ try{return localStorage.getItem(OFFLINE_KEY)==='1';}catch(e){return false;} }
  function markOfficial(){ try{localStorage.removeItem(OFFLINE_KEY);}catch(e){} }

  function validSave(data){
    return !!(data && typeof data==='object' && data.hero && typeof data.hero.name==='string' &&
      data.hero.attrs && data.hero.equip && Array.isArray(data.inventory) && Array.isArray(data.party) &&
      isFinite(Number(data.floor)) && Number(data.floor)>=1 && Number(data.floor)<=10000);
  }

  function createBackup(state){
    if(state && state.hero) save(state);
    var data=load();
    if(!validSave(data)) return null;
    return JSON.stringify({format:'RPG_LEGEND_BACKUP',version:1,exportedAt:Date.now(),save:data},null,2);
  }

  function restoreBackup(raw){
    try{
      if(typeof raw!=='string' || raw.length<10 || raw.length>5000000) return {ok:false,message:'O arquivo está vazio ou é grande demais.'};
      var parsed=JSON.parse(raw);
      var data=parsed && parsed.format==='RPG_LEGEND_BACKUP' ? parsed.save : parsed;
      if(!validSave(data)) return {ok:false,message:'Este arquivo não contém um progresso válido do RPG Legend.'};
      data.hero.equip.secundaria=data.hero.equip.secundaria||null;
      localStorage.setItem(KEY,JSON.stringify(data));
      localStorage.setItem(OFFLINE_KEY,'1');
      return {ok:true,data:data};
    }catch(e){return {ok:false,message:'Não foi possível ler o arquivo de backup.'};}
  }

  return { hasSave: hasSave, save: save, load: load, clear: clear, createBackup:createBackup, restoreBackup:restoreBackup, validSave:validSave, isImportedBackup:isImportedBackup, markOfficial:markOfficial, KEY: KEY };
})();
