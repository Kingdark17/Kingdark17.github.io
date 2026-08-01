/* =========================================================
   RPG Legend - js/effects.js
   Texto flutuante (dano/cura/ouro/xp) e efeitos sonoros simples
   gerados via Web Audio API (sem arquivos de audio externos).
   ========================================================= */
var RPG = window.RPG || {};

RPG.Effects = (function(){

  var audioCtx = null;
  function ctx(){
    if(!audioCtx){
      try{ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ audioCtx = null; }
    }
    return audioCtx;
  }

  // toca um "beep" simples com frequencia/duracao/tipo de onda configuraveis
  function beep(freq, dur, type, vol){
    if(!RPG.state || !RPG.state.soundOn) return;
    var c = ctx();
    if(!c) return;
    try{
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.value = (vol!==undefined?vol:0.08);
      osc.connect(gain); gain.connect(c.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (dur||0.15));
      osc.stop(c.currentTime + (dur||0.15) + 0.02);
    }catch(e){ /* silencioso: audio pode estar bloqueado pelo navegador */ }
  }

  var SFX = {
    hit: function(){ beep(180, 0.12, 'square', 0.07); },
    crit: function(){ beep(260, 0.18, 'square', 0.09); beep(180,0.12,'square',0.06); },
    miss: function(){ beep(110, 0.1, 'sine', 0.05); },
    gold: function(){ beep(880, 0.08, 'triangle', 0.06); beep(1100,0.08,'triangle',0.05); },
    buy: function(){ beep(520, 0.09, 'triangle', 0.06); },
    sell: function(){ beep(400, 0.09, 'triangle', 0.06); },
    door: function(){ beep(220, 0.15, 'sine', 0.06); },
    levelup: function(){ beep(523,0.12,'triangle',0.08); beep(659,0.12,'triangle',0.08); beep(784,0.18,'triangle',0.09); },
    victory: function(){ beep(660,0.12,'triangle',0.08); beep(880,0.16,'triangle',0.08); },
    defeat: function(){ beep(200,0.3,'sawtooth',0.07); },
    step: function(){ beep(140,0.05,'sine',0.03); }
  };

  function playSfx(name){ if(SFX[name]) SFX[name](); }

  // mostra um texto flutuante sobre um elemento de referencia (dentro de um container relative)
  function floatText(container, text, cls){
    if(!container) return;
    var el = document.createElement('div');
    el.className = 'floating-text ' + (cls||'dmg');
    el.textContent = text;
    var w = container.clientWidth || 120, h = container.clientHeight || 80;
    el.style.left = (w/2 - 20 + (Math.random()*30-15)) + 'px';
    el.style.top = (h/2 - 10) + 'px';
    container.appendChild(el);
    setTimeout(function(){ if(el.parentNode){ el.parentNode.removeChild(el); } }, 1000);
  }

  function shakeElement(el){
    if(!el) return;
    el.classList.remove('shake');
    void el.offsetWidth; // forca reflow para reiniciar a animacao
    el.classList.add('shake');
  }

  function levelFlash(el){
    if(!el) return;
    el.classList.remove('level-flash');
    void el.offsetWidth;
    el.classList.add('level-flash');
  }

  return { playSfx: playSfx, floatText: floatText, shakeElement: shakeElement, levelFlash: levelFlash };
})();
