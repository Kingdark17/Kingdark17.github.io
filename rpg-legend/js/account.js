/* Contas e salvamento na nuvem do RPG Legend. */
var RPG=window.RPG||{};
RPG.Account=(function(){
  var TOKEN_KEY='rpg_legend_account_token',token='',user=null,timer=null;
  function base(){var ws=(window.RPG_MULTIPLAYER_CONFIG&&window.RPG_MULTIPLAYER_CONFIG.serverUrl)||'';return ws.replace(/^wss:/,'https:').replace(/^ws:/,'http:').replace(/\/$/,'');}
  function el(id){return document.getElementById(id);}
  function message(text,error){var node=el('accountMessage');node.textContent=text||'';node.className='account-message'+(error?' error':'');}
  function render(){el('accountGuest').classList.toggle('hidden',!!user);el('accountLogged').classList.toggle('hidden',!user);el('accountName').textContent=user?user.username:'—';el('btnAccount').textContent=user?'👤 '+user.username:'👤 Conta';}
  async function request(path,options){options=options||{};options.headers=Object.assign({'Content-Type':'application/json'},options.headers||{});if(token)options.headers.Authorization='Bearer '+token;var response=await fetch(base()+path,options),data=await response.json().catch(function(){return {};});if(!response.ok)throw new Error(data.error||'Não foi possível conectar ao servidor.');return data;}
  function credentials(){return {username:(el('accountUsername').value||'').trim(),password:el('accountPassword').value||''};}
  async function enter(mode){try{message(mode==='register'?'Criando conta…':'Entrando…');var data=await request('/api/account/'+mode,{method:'POST',body:JSON.stringify(credentials())});token=data.token;user=data.user;localStorage.setItem(TOKEN_KEY,token);el('accountPassword').value='';render();message('Conta conectada. Seu progresso pode ser salvo na nuvem.');if(mode==='register'&&RPG.Save.hasSave())upload();}catch(e){message(e.message,true);}}
  async function refresh(){token=localStorage.getItem(TOKEN_KEY)||'';if(!token){render();return;}try{var data=await request('/api/account/me');user=data.user;}catch(e){token='';user=null;localStorage.removeItem(TOKEN_KEY);}render();}
  async function upload(silent){if(!user||!RPG.Save.hasSave())return false;try{var data=RPG.Save.load();await request('/api/save',{method:'PUT',body:JSON.stringify({save:data})});if(!silent)message('Progresso salvo na nuvem.');return true;}catch(e){if(!silent)message(e.message,true);return false;}}
  async function download(){try{var data=await request('/api/save');if(!data.save){message('Esta conta ainda não possui progresso na nuvem.',true);return;}if(!window.confirm('Carregar o progresso da nuvem substituirá o progresso deste navegador. Continuar?'))return;localStorage.setItem(RPG.Save.KEY,JSON.stringify(data.save));message('Progresso recuperado. Recarregando…');setTimeout(function(){window.location.reload();},500);}catch(e){message(e.message,true);}}
  function scheduleCloudSave(){if(!user)return;clearTimeout(timer);timer=setTimeout(function(){upload(true);},2500);}
  async function logout(){try{await request('/api/account/logout',{method:'POST'});}catch(e){}token='';user=null;localStorage.removeItem(TOKEN_KEY);render();message('Você saiu da conta. O progresso local continua neste navegador.');}
  function init(){
    el('btnAccount').onclick=function(){el('accountModal').classList.remove('hidden');refresh();};el('closeAccountBtn').onclick=function(){el('accountModal').classList.add('hidden');};
    el('accountLoginBtn').onclick=function(){enter('login');};el('accountRegisterBtn').onclick=function(){enter('register');};el('cloudSaveBtn').onclick=function(){upload(false);};el('cloudLoadBtn').onclick=download;el('accountLogoutBtn').onclick=logout;refresh();
  }
  document.addEventListener('DOMContentLoaded',init);
  return {scheduleCloudSave:scheduleCloudSave,upload:upload,currentUser:function(){return user;}};
})();
