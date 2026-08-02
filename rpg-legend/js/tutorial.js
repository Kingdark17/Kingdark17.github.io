/* RPG Legend - tutorial contextual e guia permanente. */
var RPG=window.RPG||{};
RPG.Tutorial=(function(){
  var STEPS=[
    {id:'move',icon:'🧭',name:'Dê o primeiro passo',tip:'Use WASD, as setas do teclado ou os botões de direção para andar.'},
    {id:'inventory',icon:'🎒',name:'Abra a mochila',tip:'Selecione um item para ver atributos, comparar, equipar, usar ou descartar.'},
    {id:'npc',icon:'🧙',name:'Converse com um NPC',tip:'NPCs podem curar, negociar, revelar o mapa ou entrar temporariamente na equipe.'},
    {id:'shop',icon:'🏵️',name:'Visite uma loja',tip:'Compare o item da loja com o equipado. Carisma melhora seus descontos.'},
    {id:'dungeon',icon:'🏰',name:'Entre na masmorra',tip:'Explore antes de usar a saída ou a escada. O mapa oculta salas ainda desconhecidas.'},
    {id:'combat',icon:'⚔️',name:'Comece um combate',tip:'Observe fraquezas e resistências. Poderes gastam Mana e podem aplicar debuffs.'}
  ];
  var GUIDES=[
    ['🧭 Movimentação','Use WASD, setas ou os controles. Ao escolher “Não” em NPCs, lojas e saídas, você pode atravessar sem interagir.'],
    ['⚔️ Combate','Ataques usam atributos e afinidade da arma. Poderes gastam Mana. Você também pode fugir com uma rolagem.'],
    ['☣️ Efeitos','Queimadura, veneno e sangramento causam dano contínuo. Atordoamento impede ataques; lentidão, vulnerabilidade e fraqueza reduzem a defesa do inimigo.'],
    ['🎒 Itens e tiers','Compare atributos e tiers antes de equipar. A ordem é E, D, C, B, A, S, SS, SSS, SSS+ e MAX.'],
    ['⚒️ Reforja','No ferreiro, materiais diferentes alteram as chances. A Pedra de Proteção impede queda e quatro falhas ativam garantia.'],
    ['🧙 NPCs e aliados','Você começa sozinho. Converse e realize serviços para conseguir ajuda e companheiros temporários.'],
    ['👥 Multiplayer','Cada jogador cria o próprio herói. O mapa é compartilhado e os turnos são usados somente nas batalhas.'],
    ['💾 Salvamento','O jogo salva automaticamente no navegador. Use Continuar para voltar ao mapa e posição anteriores.']
  ];
  var toastTimer=null;
  function create(enabled){return {enabled:enabled!==false,completed:{},rewarded:false,seen:{}};}
  function ensure(){if(!RPG.state.tutorial)RPG.state.tutorial=create(false);return RPG.state.tutorial;}
  function toast(title,text){var el=document.getElementById('tutorialToast');if(!el)return;document.getElementById('tutorialToastTitle').textContent=title;document.getElementById('tutorialToastText').textContent=text;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.classList.add('hidden');},9000);}
  function render(){var t=ensure(),done=STEPS.filter(function(s){return t.completed[s.id];}).length;document.getElementById('tutorialProgress').innerHTML='<div class="tutorial-progress-title"><b>Primeiros Passos</b><span>'+done+'/'+STEPS.length+'</span></div><div class="tutorial-step-list">'+STEPS.map(function(s){return '<div class="tutorial-step '+(t.completed[s.id]?'done':'')+'"><span>'+s.icon+'</span><div><b>'+s.name+'</b><small>'+s.tip+'</small></div><strong>'+(t.completed[s.id]?'✓':'○')+'</strong></div>';}).join('')+'</div>'+(t.rewarded?'<div class="tutorial-reward done">✓ Recompensa recebida: 40 ouro e uma poção.</div>':'<div class="tutorial-reward">Conclua tudo: 40 ouro e uma poção.</div>');document.getElementById('tutorialGuideContent').innerHTML=GUIDES.map(function(g){return '<section><b>'+g[0]+'</b><p>'+g[1]+'</p></section>';}).join('');}
  function open(){render();document.getElementById('tutorialModal').classList.remove('hidden');}
  function close(){document.getElementById('tutorialModal').classList.add('hidden');}
  function event(id){var t=ensure();if(!t.enabled||t.completed[id])return;t.completed[id]=true;var step=STEPS.filter(function(s){return s.id===id;})[0];if(step)toast(step.icon+' Etapa concluída',step.tip);if(STEPS.every(function(s){return t.completed[s.id];})&&!t.rewarded){t.rewarded=true;RPG.state.hero.gold+=40;RPG.Inventory.addItem(RPG.state,RPG.Items.randomItem({category:'consumivel',floor:1}));toast('🏆 Tutorial concluído','Você recebeu 40 ouro e uma poção. O Guia continuará disponível no topo da tela.');if(RPG.UI)RPG.UI.renderHero();}RPG.Save.save(RPG.state);}
  function start(){var t=ensure();if(!t.enabled)return;toast('📖 Primeiros Passos','Uma pequena missão ensinará o básico. Abra o Guia para acompanhar o progresso.');setTimeout(open,450);}
  function bind(){document.getElementById('tutorialGuideBtn').onclick=open;document.getElementById('closeTutorialBtn').onclick=close;document.getElementById('tutorialModal').onclick=function(e){if(e.target.id==='tutorialModal')close();};document.getElementById('tutorialToastClose').onclick=function(){document.getElementById('tutorialToast').classList.add('hidden');};}
  return {create:create,bind:bind,start:start,event:event,open:open,close:close,render:render};
})();
