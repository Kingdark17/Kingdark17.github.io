/* =========================================================
   RPG Legend - js/social.js
   Lista de amigos e chat em tempo real (estilo Messenger de
   PC): pedidos de amizade, status online e janelas de
   conversa flutuantes no canto inferior direito.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Social = (function(){
  var socket=null, authed=false, reconnectTimer=null;
  var friends=[], incoming=[], outgoing=[];
  var chats={};      // username em minusculo -> {display,messages,loaded,unread}
  var openOrder=[];  // usernames (minusculo) com janela de chat aberta

  function el(id){ return document.getElementById(id); }
  function key(username){ return String(username||'').toLowerCase(); }
  function apiBase(){ var ws=(window.RPG_MULTIPLAYER_CONFIG&&window.RPG_MULTIPLAYER_CONFIG.serverUrl)||''; return ws.replace(/^wss:/,'https:').replace(/^ws:/,'http:').replace(/\/$/,''); }
  async function api(path,options){
    options=options||{};
    options.headers=Object.assign({'Content-Type':'application/json'},options.headers||{});
    var token=RPG.Account&&RPG.Account.token?RPG.Account.token():'';
    if(token)options.headers.Authorization='Bearer '+token;
    var response=await fetch(apiBase()+path,options);
    var data=await response.json().catch(function(){return {};});
    if(!response.ok) throw new Error(data.error||'Não foi possível conectar ao servidor.');
    return data;
  }
  function chatFor(username){
    var k=key(username);
    if(!chats[k]) chats[k]={display:username,messages:[],loaded:false,unread:0};
    else if(username) chats[k].display=username;
    return chats[k];
  }

  /* ================= Lista de amigos (REST) ================= */
  function totalUnread(){
    var incomingCount=incoming.length,messageCount=0;
    Object.keys(chats).forEach(function(k){ messageCount+=chats[k].unread||0; });
    return incomingCount+messageCount;
  }
  function refreshLauncher(){
    var btn=el('socialLauncherBtn'),tab=el('btnSocialTab'); if(!btn||!tab) return;
    var loggedIn=!!(RPG.Account&&RPG.Account.currentUser&&RPG.Account.currentUser());
    var onMenu=!RPG.state||RPG.state.screen==='menu';
    // A aba de "Amigos" mora no menu (embaixo de Conta); a bolha flutuante
    // so aparece durante o jogo, pra nao duplicar o mesmo acesso na tela.
    tab.classList.toggle('hidden',!loggedIn);
    btn.classList.toggle('hidden',!loggedIn||onMenu);
    var count=totalUnread();
    [el('socialBadge'),el('socialTabBadge')].forEach(function(badge){
      if(!badge) return;
      badge.textContent=count>9?'9+':String(count);
      badge.classList.toggle('hidden',count<=0);
    });
  }
  async function refreshFriends(){
    if(!RPG.Account||!RPG.Account.currentUser||!RPG.Account.currentUser()) return;
    try{
      var data=await api('/api/friends',{method:'GET'});
      friends=data.friends||[]; incoming=data.incoming||[]; outgoing=data.outgoing||[];
      renderFriendsList();
      refreshLauncher();
      refreshOpenChatDots();
    }catch(e){ /* silencioso -- o painel so mostra a lista quando reaberto */ }
  }
  function refreshOpenChatDots(){
    openOrder.forEach(function(k){
      var node=document.querySelector('.chat-window[data-user="'+k+'"]');
      if(!node) return;
      var info=friends.filter(function(f){ return key(f.username)===k; })[0];
      node.querySelector('.social-dot').classList.toggle('online',!!(info&&info.online));
    });
  }
  function friendCard(info, actions){
    var card=document.createElement('div');
    card.className='social-friend';
    var dot=document.createElement('span'); dot.className='social-dot'+(info.online?' online':'');
    var name=document.createElement('span'); name.className='social-friend-name'; name.textContent=info.username;
    name.classList.toggle('rgb-name',info.nameColor==='rainbow');
    name.style.color=info.nameColor==='rainbow'?'':(info.nameColor||'');
    card.appendChild(dot); card.appendChild(name);
    var actionsWrap=document.createElement('div'); actionsWrap.className='social-friend-actions';
    actions.forEach(function(a){
      var b=document.createElement('button'); b.type='button'; b.className='rune-btn ghost small'; b.textContent=a.label;
      b.onclick=a.onClick; actionsWrap.appendChild(b);
    });
    card.appendChild(actionsWrap);
    return card;
  }
  function renderFriendsList(){
    var incomingSection=el('socialIncomingSection'),incomingList=el('socialIncomingList'),friendsList=el('socialFriendsList');
    if(!friendsList) return;
    incomingSection.classList.toggle('hidden',!incoming.length);
    incomingList.innerHTML='';
    incoming.forEach(function(info){
      incomingList.appendChild(friendCard(info,[
        {label:'Aceitar',onClick:function(){ acceptRequest(info.username); }},
        {label:'Recusar',onClick:function(){ declineRequest(info.username); }}
      ]));
    });
    friendsList.innerHTML='';
    if(!friends.length && !outgoing.length){ friendsList.innerHTML='<div class="social-empty">Você ainda não tem amigos adicionados.</div>'; }
    outgoing.forEach(function(info){
      var card=friendCard(info,[{label:'Cancelar',onClick:function(){ declineOutgoing(info.username); }}]);
      card.classList.add('pending'); card.title='Pedido enviado, aguardando resposta.';
      friendsList.appendChild(card);
    });
    friends.forEach(function(info){
      var unread=chats[key(info.username)]&&chats[key(info.username)].unread||0;
      var card=friendCard(info,[
        {label:unread?('💬 ('+unread+')'):'💬 Conversar',onClick:function(){ openChat(info.username); }},
        {label:'Remover',onClick:function(){ removeFriend(info.username); }}
      ]);
      friendsList.appendChild(card);
    });
  }
  function setFormMessage(text,error){
    var el2=el('socialFormMessage'); if(!el2) return;
    el2.textContent=text||''; el2.style.color=error?'#e28a8a':'var(--parchment-dim)';
  }
  async function sendRequest(username){
    username=(username||'').trim(); if(!username) return;
    try{
      var result=await api('/api/friends/request',{method:'POST',body:JSON.stringify({username:username})});
      setFormMessage(result.accepted?('Vocês agora são amigos de '+username+'!'):('Pedido enviado para '+username+'.'), false);
      el('socialAddInput').value='';
      refreshFriends();
    }catch(e){ setFormMessage(e.message,true); }
  }
  async function acceptRequest(username){ try{ await api('/api/friends/accept',{method:'POST',body:JSON.stringify({username:username})}); refreshFriends(); }catch(e){ setFormMessage(e.message,true); } }
  async function declineRequest(username){ try{ await api('/api/friends/decline',{method:'POST',body:JSON.stringify({username:username})}); refreshFriends(); }catch(e){} }
  async function declineOutgoing(username){ try{ await api('/api/friends/decline',{method:'POST',body:JSON.stringify({username:username})}); }catch(e){} refreshFriends(); }
  async function removeFriend(username){
    if(!window.confirm('Remover '+username+' da lista de amigos?')) return;
    try{ await api('/api/friends/remove',{method:'POST',body:JSON.stringify({username:username})}); closeChat(username); refreshFriends(); }catch(e){}
  }

  /* ================= WebSocket: presenca + chat ao vivo ================= */
  function connect(){
    var server=(window.RPG_MULTIPLAYER_CONFIG&&window.RPG_MULTIPLAYER_CONFIG.serverUrl)||'';
    var token=RPG.Account&&RPG.Account.token?RPG.Account.token():'';
    if(!server||!token) return;
    if(socket&&(socket.readyState===0||socket.readyState===1)) return;
    try{
      socket=new WebSocket(server);
      socket.onopen=function(){ if(socket)socket.send(JSON.stringify({type:'auth',token:token})); };
      socket.onmessage=function(e){ try{ handleSocketMessage(JSON.parse(e.data)); }catch(err){ console.error('[Social] falha ao processar mensagem',err); } };
      socket.onclose=function(){ authed=false; scheduleReconnect(); };
      socket.onerror=function(){};
    }catch(e){}
  }
  function scheduleReconnect(){
    if(reconnectTimer) return;
    reconnectTimer=setTimeout(function(){
      reconnectTimer=null;
      if(RPG.Account&&RPG.Account.currentUser&&RPG.Account.currentUser()) connect();
    },4000);
  }
  function handleSocketMessage(msg){
    if(!msg||!msg.type) return;
    if(msg.type==='authed'){ authed=true; refreshFriends(); return; }
    if(msg.type==='presence'){ refreshFriends(); return; }
    if(msg.type==='chat'){
      var chat=chatFor(msg.from);
      chat.messages.push({id:msg.id,fromMe:false,body:msg.body,createdAt:msg.createdAt});
      chat.loaded=true;
      if(openOrder.indexOf(key(msg.from))>=0){ renderChatWindow(msg.from); }
      else{ chat.unread=(chat.unread||0)+1; notify('<b>'+msg.from+'</b> te enviou uma mensagem.'); }
      renderFriendsList(); refreshLauncher();
      return;
    }
    if(msg.type==='friend-request'){ notify('<b>'+msg.username+'</b> te enviou um pedido de amizade.'); refreshFriends(); return; }
    if(msg.type==='friend-accept'){ notify('<b>'+msg.username+'</b> aceitou seu pedido de amizade.'); refreshFriends(); return; }
    if(msg.type==='chat-ack'){ reconcileMessage(msg.to,msg.tempId,{id:msg.id,createdAt:msg.createdAt}); return; }
    if(msg.type==='chat-error'){ markMessageFailed(msg.to,msg.tempId,msg.message); return; }
    if(msg.type==='auth-error'){ authed=false; console.error('[Social] token invalido ao autenticar o chat.'); return; }
  }
  function notify(html){
    if(RPG.UI && RPG.UI.logEvent && RPG.state && RPG.state.screen==='game') RPG.UI.logEvent(html);
  }

  /* ================= Historico e envio de mensagens ================= */
  async function loadHistory(username){
    var chat=chatFor(username);
    if(chat.loaded) return;
    try{
      var data=await api('/api/messages/'+encodeURIComponent(username),{method:'GET'});
      var incomingMsgs=(data.messages||[]).map(function(m){ return {id:m.id,fromMe:m.fromMe,body:m.body,createdAt:m.createdAt}; });
      chat.messages=incomingMsgs.concat(chat.messages);
      chat.loaded=true;
      renderChatWindow(username);
    }catch(e){}
  }
  function sendMessage(username,text){
    text=(text||'').trim(); if(!text) return;
    var chat=chatFor(username);
    var tempId='tmp'+Date.now()+Math.random().toString(36).slice(2);
    var entry={id:tempId,fromMe:true,body:text,createdAt:new Date().toISOString(),pending:true};
    chat.messages.push(entry);
    renderChatWindow(username);
    if(socket&&socket.readyState===1&&authed){
      socket.send(JSON.stringify({type:'chat',to:username,body:text,tempId:tempId}));
      // O WebSocket pode "morrer" em silencio (sem disparar onclose) e
      // deixar a mensagem presa em "Enviando..." pra sempre -- se a
      // confirmacao nao chegar em alguns segundos, tenta por HTTP e forca
      // a reconexao do socket, que provavelmente esta com problema.
      entry.timeoutHandle=setTimeout(function(){
        if(!entry.pending) return;
        console.error('[Social] sem resposta do servidor via WebSocket, tentando por HTTP.');
        sendViaRest(username,text,tempId);
        if(socket){ try{ socket.close(); }catch(e){} }
      },6000);
    }else{
      sendViaRest(username,text,tempId);
    }
  }
  function sendViaRest(username,text,tempId){
    api('/api/messages/'+encodeURIComponent(username),{method:'POST',body:JSON.stringify({body:text})})
      .then(function(data){ reconcileMessage(username,tempId,data.message); })
      .catch(function(err){ markMessageFailed(username,tempId,err.message); });
  }
  function reconcileMessage(username,tempId,serverMsg){
    var chat=chatFor(username),msg=chat.messages.filter(function(m){ return m.id===tempId; })[0];
    if(msg){
      if(msg.timeoutHandle){ clearTimeout(msg.timeoutHandle); delete msg.timeoutHandle; }
      if(serverMsg){ msg.id=serverMsg.id; msg.createdAt=serverMsg.createdAt||msg.createdAt; }
      delete msg.pending;
    }
    renderChatWindow(username);
  }
  function markMessageFailed(username,tempId,errorText){
    var chat=chatFor(username),msg=chat.messages.filter(function(m){ return m.id===tempId; })[0];
    if(msg){ if(msg.timeoutHandle){ clearTimeout(msg.timeoutHandle); delete msg.timeoutHandle; } delete msg.pending; msg.failed=true; }
    renderChatWindow(username);
    setFormMessage(errorText||'Não foi possível enviar a mensagem.',true);
    console.error('[Social] falha ao enviar mensagem:',errorText);
  }

  /* ================= Janelas de chat (estilo Messenger) ================= */
  function chatWindowEl(username){ return document.querySelector('.chat-window[data-user="'+key(username)+'"]'); }
  function openChat(username){
    var k=key(username);
    chatFor(username).unread=0;
    if(openOrder.indexOf(k)<0){
      if(openOrder.length>=3) closeChat(openOrder[0]);
      openOrder.push(k);
      buildChatWindow(username);
    }
    loadHistory(username);
    renderFriendsList(); refreshLauncher();
    el('socialPanel').classList.add('hidden');
    var node=chatWindowEl(username); if(node) node.querySelector('.chat-window-input input').focus();
  }
  function closeChat(username){
    var k=key(username),idx=openOrder.indexOf(k);
    if(idx>=0) openOrder.splice(idx,1);
    var node=chatWindowEl(username); if(node) node.remove();
  }
  function escapeHtml(text){ return String(text||'').replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function formatTime(iso){
    try{ var d=new Date(iso); return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; }
  }
  function buildChatWindow(username){
    var wrap=document.createElement('div');
    wrap.className='chat-window';
    wrap.setAttribute('data-user',key(username));
    wrap.innerHTML=
      '<div class="chat-window-header">'+
        '<span class="social-dot"></span>'+
        '<span class="chat-window-name"></span>'+
        '<button type="button" class="chat-window-close" aria-label="Fechar">&times;</button>'+
      '</div>'+
      '<div class="chat-window-body"></div>'+
      '<div class="chat-window-input"><input type="text" maxlength="500" placeholder="Escreva uma mensagem..."><button type="button">➤</button></div>';
    wrap.querySelector('.chat-window-name').textContent=username;
    wrap.querySelector('.chat-window-close').addEventListener('click',function(){ closeChat(username); });
    var input=wrap.querySelector('.chat-window-input input'),sendBtn=wrap.querySelector('.chat-window-input button');
    function submit(){ sendMessage(username,input.value); input.value=''; }
    sendBtn.addEventListener('click',submit);
    input.addEventListener('keydown',function(e){ if(e.key==='Enter') submit(); });
    el('socialChats').appendChild(wrap);
    renderChatWindow(username);
  }
  function renderChatWindow(username){
    var node=chatWindowEl(username); if(!node) return;
    var friendInfo=friends.filter(function(f){ return key(f.username)===key(username); })[0];
    node.querySelector('.social-dot').classList.toggle('online',!!(friendInfo&&friendInfo.online));
    var body=node.querySelector('.chat-window-body'),chat=chatFor(username);
    var wasNearBottom=body.scrollHeight-body.scrollTop-body.clientHeight<40;
    body.innerHTML=chat.messages.length?chat.messages.map(function(m){
      var stateClass=m.failed?' failed':(m.pending?' pending':'');
      var timeLabel=m.failed?'Falhou ao enviar':(m.pending?'Enviando...':formatTime(m.createdAt));
      return '<div class="chat-msg '+(m.fromMe?'mine':'theirs')+stateClass+'"><span class="chat-msg-body">'+escapeHtml(m.body)+'</span><span class="chat-msg-time">'+timeLabel+'</span></div>';
    }).join(''):'<div class="social-empty">Diga oi! 👋</div>';
    if(wasNearBottom) body.scrollTop=body.scrollHeight;
  }

  /* ================= Boot ================= */
  function togglePanel(){
    var panel=el('socialPanel'),willOpen=panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    if(willOpen) refreshFriends();
  }
  function bindPanel(){
    el('socialLauncherBtn').addEventListener('click',togglePanel);
    el('btnSocialTab').addEventListener('click',togglePanel);
    el('socialPanelCloseBtn').addEventListener('click',function(){ el('socialPanel').classList.add('hidden'); });
    el('socialAddBtn').addEventListener('click',function(){ sendRequest(el('socialAddInput').value); });
    el('socialAddInput').addEventListener('keydown',function(e){ if(e.key==='Enter') sendRequest(el('socialAddInput').value); });
    document.addEventListener('click',function(e){
      var panel=el('socialPanel'),launcher=el('socialLauncherBtn'),tab=el('btnSocialTab');
      if(panel.classList.contains('hidden')) return;
      if(panel.contains(e.target)||launcher.contains(e.target)||tab.contains(e.target)) return;
      panel.classList.add('hidden');
    });
  }
  function init(){
    if(!el('socialLauncherBtn')) return;
    bindPanel();
    document.addEventListener('rpg-account-ready',function(e){
      var user=e.detail&&e.detail.user;
      refreshLauncher();
      if(user) connect();
    });
    if(RPG.Account&&RPG.Account.currentUser&&RPG.Account.currentUser()){ refreshLauncher(); connect(); }
  }
  document.addEventListener('DOMContentLoaded',init);
  return { openChat:openChat, refreshFriends:refreshFriends, refreshLauncher:refreshLauncher };
})();
