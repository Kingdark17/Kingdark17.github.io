/* =========================================================
   RPG Legend - js/admin-panel.js
   Painel visivel so para a conta admin (isAdmin=true, vindo do
   servidor de contas). Deixa editar vida, mana, ouro, nivel, xp
   e atributos do personagem atual diretamente.
   ========================================================= */
var RPG = window.RPG || {};

RPG.AdminPanel = (function(){

  function el(id){ return document.getElementById(id); }

  function isAdmin(){
    var user = RPG.Account && RPG.Account.currentUser ? RPG.Account.currentUser() : null;
    return !!(user && user.isAdmin);
  }

  var GOD = { attr:999, hp:999999, mp:999999, gold:999999999 };

  function needsGodMode(h){
    return !(h.gold>=GOD.gold-1 && h.maxHp>=GOD.hp-1 && h.attrs.forca>=GOD.attr-1);
  }

  // aplica status "infinito" no heroi local e manda pra nuvem, se a conta for admin.
  function applyGodMode(silent){
    if(!isAdmin() || !RPG.state || !RPG.state.hero) return;
    var h = RPG.state.hero;
    ['forca','destreza','constituicao','intelecto','sabedoria','carisma'].forEach(function(k){ h.attrs[k] = GOD.attr; });
    RPG.Player.recomputeDerived(h);
    h.maxHp = GOD.hp; h.maxMp = GOD.mp; h.hp = GOD.hp; h.mp = GOD.mp;
    if(h.derived){ h.derived.maxHp = GOD.hp; h.derived.maxMp = GOD.mp; }
    h.gold = GOD.gold;
    RPG.UI.renderHero();
    RPG.Save.save(RPG.state);
    if(RPG.Account && RPG.Account.upload) RPG.Account.upload(true); // salva no banco de dados do servidor tambem
    if(!silent){ var m = el('adminPanelMessage'); if(m){ m.textContent = 'Modo infinito ativado e salvo na nuvem.'; m.className = 'account-message'; } }
  }

  // mostra/esconde o botao "ADM" no cabecalho: so em jogo E so pra admin
  function refreshButton(){
    var btn = el('adminPanelBtn');
    if(!btn) return;
    var inGame = RPG.state && RPG.state.screen === 'game';
    btn.classList.toggle('hidden', !(inGame && isAdmin()));
    if(inGame && isAdmin() && RPG.state.hero && needsGodMode(RPG.state.hero)){ applyGodMode(true); }
  }

  function num(id, fallback){
    var v = parseInt(el(id).value, 10);
    return isNaN(v) ? fallback : v;
  }

  function open(){
    if(!isAdmin()){ return; }
    if(!RPG.state || !RPG.state.hero){ return; }
    var h = RPG.state.hero;
    el('admHp').value = h.hp;
    el('admMaxHp').value = h.maxHp;
    el('admMp').value = h.mp;
    el('admMaxMp').value = h.maxMp;
    el('admGold').value = h.gold;
    el('admLevel').value = h.level;
    el('admXp').value = h.xp;
    el('admAttrPoints').value = h.attrPoints || 0;
    el('admForca').value = h.attrs.forca;
    el('admDestreza').value = h.attrs.destreza;
    el('admConstituicao').value = h.attrs.constituicao;
    el('admIntelecto').value = h.attrs.intelecto;
    el('admSabedoria').value = h.attrs.sabedoria;
    el('admCarisma').value = h.attrs.carisma;
    el('adminPanelMessage').textContent = '';
    el('adminPanelModal').classList.remove('hidden');
  }

  function close(){ el('adminPanelModal').classList.add('hidden'); }

  function apply(){
    if(!isAdmin()){ return; }
    if(!RPG.state || !RPG.state.hero){ return; }
    var h = RPG.state.hero;

    h.attrs.forca = Math.max(1, num('admForca', h.attrs.forca));
    h.attrs.destreza = Math.max(1, num('admDestreza', h.attrs.destreza));
    h.attrs.constituicao = Math.max(1, num('admConstituicao', h.attrs.constituicao));
    h.attrs.intelecto = Math.max(1, num('admIntelecto', h.attrs.intelecto));
    h.attrs.sabedoria = Math.max(1, num('admSabedoria', h.attrs.sabedoria));
    h.attrs.carisma = Math.max(1, num('admCarisma', h.attrs.carisma));
    h.level = Math.max(1, num('admLevel', h.level));
    h.xp = Math.max(0, num('admXp', h.xp));
    h.xpNext = RPG.Player.xpForLevel(h.level);
    h.attrPoints = Math.max(0, num('admAttrPoints', h.attrPoints || 0));
    h.gold = Math.max(0, num('admGold', h.gold));

    // recalcula os bonus derivados dos atributos (dano, esquiva, critico etc)
    RPG.Player.recomputeDerived(h);

    // vida/mana maxima e atual: o valor digitado no painel manda por cima do calculo automatico
    var newMaxHp = Math.max(1, num('admMaxHp', h.maxHp));
    var newMaxMp = Math.max(0, num('admMaxMp', h.maxMp));
    h.maxHp = newMaxHp;
    h.maxMp = newMaxMp;
    h.hp = Math.min(newMaxHp, Math.max(0, num('admHp', h.hp)));
    h.mp = Math.min(newMaxMp, Math.max(0, num('admMp', h.mp)));
    if(h.derived){ h.derived.maxHp = newMaxHp; h.derived.maxMp = newMaxMp; }

    RPG.UI.renderHero();
    RPG.Save.save(RPG.state);
    el('adminPanelMessage').textContent = 'Alteracoes aplicadas e salvas.';
    el('adminPanelMessage').className = 'account-message';
  }

  document.addEventListener('rpg-account-ready', refreshButton);

  document.addEventListener('DOMContentLoaded', function(){
    var btn = el('adminPanelBtn');
    if(btn) btn.addEventListener('click', open);
    var closeBtn = el('closeAdminPanelBtn');
    if(closeBtn) closeBtn.addEventListener('click', close);
    var applyBtn = el('admApplyBtn');
    if(applyBtn) applyBtn.addEventListener('click', apply);
  });

  return { isAdmin: isAdmin, refreshButton: refreshButton, open: open, close: close, apply: apply };
})();
