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
  var INTEGRITY_KEY = 'rpg_legend_integrity_required_v1';
  var INTEGRITY_PEPPER = 'RPG-LEGEND::RUNAS-DO-REINO::V1';

  function checksum(data){
    var clean={},keys=Object.keys(data||{});keys.forEach(function(key){if(key!=='integrity')clean[key]=data[key];});
    var text=INTEGRITY_PEPPER+'|'+JSON.stringify(clean),a=0x811c9dc5,b=0x9e3779b9;
    for(var i=0;i<text.length;i++){var code=text.charCodeAt(i);a=Math.imul(a^code,0x01000193);b=Math.imul((b+code)^(b>>>13),0x85ebca6b);}
    return ('00000000'+(a>>>0).toString(16)).slice(-8)+('00000000'+(b>>>0).toString(16)).slice(-8);
  }
  function seal(data){delete data.integrity;data.integrity={version:1,check:checksum(data)};try{localStorage.setItem(INTEGRITY_KEY,'1');}catch(e){}return data;}
  function verifyIntegrity(data){if(!data||typeof data!=='object')return false;if(!data.integrity){try{return localStorage.getItem(INTEGRITY_KEY)!=='1';}catch(e){return true;}}return data.integrity.version===1&&data.integrity.check===checksum(data);}

  function hasSave(){
    try{var raw=localStorage.getItem(KEY);if(!raw)return false;return verifyIntegrity(JSON.parse(raw));}catch(e){ return false; }
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
        musicVolume: state.musicVolume,
        tutorial: state.tutorial,
        savedAt: Date.now()
      };
      seal(data);
      localStorage.setItem(KEY, JSON.stringify(data));
      if(RPG.Account&&RPG.Account.scheduleCloudSave)RPG.Account.scheduleCloudSave();
      return true;
    }catch(e){ return false; }
  }

  function load(){
    try{
      var raw = localStorage.getItem(KEY);
      if(!raw) return null;
      var data=JSON.parse(raw);
      return verifyIntegrity(data)?data:null;
    }catch(e){ return null; }
  }

  function clear(){
    try{ localStorage.removeItem(KEY); localStorage.removeItem(OFFLINE_KEY); localStorage.removeItem(INTEGRITY_KEY); }catch(e){}
  }

  function isImportedBackup(){ try{return localStorage.getItem(OFFLINE_KEY)==='1';}catch(e){return false;} }
  function markOfficial(){ try{localStorage.removeItem(OFFLINE_KEY);var raw=localStorage.getItem(KEY);if(raw)localStorage.setItem(KEY,JSON.stringify(seal(JSON.parse(raw))));}catch(e){} }

  function validSave(data){
    return !!(data && typeof data==='object' && data.hero && typeof data.hero.name==='string' &&
      data.hero.attrs && data.hero.equip && Array.isArray(data.inventory) && Array.isArray(data.party) &&
      isFinite(Number(data.floor)) && Number(data.floor)>=1 && Number(data.floor)<=10000);
  }

  function bytesToBase64(bytes){var out='',chunk=0x8000;for(var i=0;i<bytes.length;i+=chunk)out+=String.fromCharCode.apply(null,bytes.subarray(i,Math.min(i+chunk,bytes.length)));return btoa(out);}
  function base64ToBytes(text){var raw=atob(text),out=new Uint8Array(raw.length);for(var i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
  async function backupKey(password,salt,usage){var material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:210000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,[usage]);}

  async function createBackup(state,password){
    if(state && state.hero) save(state);
    var data=load();
    if(!validSave(data)||!window.crypto||!crypto.subtle||typeof password!=='string'||password.length<6) return null;
    try{
      var salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
      var key=await backupKey(password,salt,'encrypt');
      var encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,new TextEncoder().encode(JSON.stringify(data)));
      return JSON.stringify({format:'RPG_LEGEND_BACKUP_ENCRYPTED',version:2,cipher:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:210000,exportedAt:Date.now(),salt:bytesToBase64(salt),iv:bytesToBase64(iv),data:bytesToBase64(new Uint8Array(encrypted))},null,2);
    }catch(e){return null;}
  }

  function isEncryptedBackup(raw){try{var parsed=JSON.parse(raw);return !!(parsed&&parsed.format==='RPG_LEGEND_BACKUP_ENCRYPTED'&&parsed.version===2);}catch(e){return false;}}

  async function restoreBackup(raw,password){
    try{
      if(typeof raw!=='string' || raw.length<10 || raw.length>5000000) return {ok:false,message:'O arquivo está vazio ou é grande demais.'};
      var parsed=JSON.parse(raw);
      var data;
      if(parsed&&parsed.format==='RPG_LEGEND_BACKUP_ENCRYPTED'&&parsed.version===2){
        if(typeof password!=='string'||password.length<1)return {ok:false,message:'Digite a senha usada para proteger este backup.'};
        try{var salt=base64ToBytes(parsed.salt),iv=base64ToBytes(parsed.iv),encrypted=base64ToBytes(parsed.data);var key=await backupKey(password,salt,'decrypt');var clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:iv},key,encrypted);data=JSON.parse(new TextDecoder().decode(clear));}catch(e){return {ok:false,message:'Senha incorreta ou arquivo modificado.'};}
      }else data=parsed && parsed.format==='RPG_LEGEND_BACKUP' ? parsed.save : parsed;
      if(!validSave(data)) return {ok:false,message:'Este arquivo não contém um progresso válido do RPG Legend.'};
      data.hero.equip.secundaria=data.hero.equip.secundaria||null;
      seal(data);
      localStorage.setItem(KEY,JSON.stringify(data));
      localStorage.setItem(OFFLINE_KEY,'1');
      return {ok:true,data:data};
    }catch(e){return {ok:false,message:'Não foi possível ler o arquivo de backup.'};}
  }

  return { hasSave: hasSave, save: save, load: load, clear: clear, createBackup:createBackup, restoreBackup:restoreBackup, isEncryptedBackup:isEncryptedBackup, validSave:validSave, verifyIntegrity:verifyIntegrity, isImportedBackup:isImportedBackup, markOfficial:markOfficial, KEY: KEY };
})();
