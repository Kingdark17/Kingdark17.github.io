/* =========================================================
   RPG Legend - js/narrator.js
   Gera a descricao textual da sala onde o heroi esta, com
   pistas nas quatro portas (Norte/Sul/Leste/Oeste). So
   descreve com detalhes o que ja foi revelado (nao estraga a
   neblina de guerra). O conteudo de cada sala vem do proprio
   modulo (City/Dungeon), que e a fonte unica da verdade.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Narrator = (function(){

  function rnd(n){ return Math.floor(Math.random()*n); }
  function pick(arr){ return arr[rnd(arr.length)]; }

  var CITY_AMBIENT = [
    "As ruas de paralelepipedo ecoam seus passos.",
    "O cheiro de pao fresco e fumaca de forja se mistura no ar.",
    "Bandeiras coloridas tremulam entre os telhados inclinados ao redor.",
    "Vozes distantes de mercadores anunciam ofertas em algum lugar proximo.",
    "Uma brisa fresca percorre a rua estreita, carregando cheiro de terra molhada.",
    "Lampioes pendurados nas paredes iluminam fracamente o caminho.",
    "Passos apressados ecoam em algum beco proximo, fora de vista."
  ];

  var DUNGEON_AMBIENT = [
    "O ar aqui e frio e cheira a pedra umida.",
    "Tochas bruxuleantes lancam sombras longas pelas paredes de pedra.",
    "Um silencio pesado paira sobre a sala, quebrado apenas por um pingar distante.",
    "Musgo cobre as pedras irregulares sob seus pes.",
    "Algo goteja em algum lugar da escuridao adiante.",
    "As paredes de pedra parecem se fechar um pouco mais a cada passo.",
    "Um vento fraco sopra vindo de algum lugar mais fundo na masmorra."
  ];

  function moduleFor(state){ return state.mapMode==='city' ? RPG.City : RPG.Dungeon; }

  function doorHint(dir, state, cell){
    var label = RPG.MapUtil.DIR_LABEL[dir];
    if(!cell.doors[dir]){ return label+': parede.'; }
    var v = RPG.MapUtil.DIR_VECTORS[dir];
    var nx = cell.x+v.x, ny = cell.y+v.y;
    var target = state.map[ny][nx];
    var known = target.visited || target.revealed;
    if(!known){ return label+': porta fechada.'; }
    return label+': '+moduleFor(state).shortLabel(target)+'.';
  }

  // descreve a sala onde o heroi esta parado agora, com pistas nas 4 portas
  function describeCurrent(state){
    if(!state.map || !state.map.length) return '';
    var cell = state.map[state.pos.y][state.pos.x];
    var ambientPool = state.mapMode==='city' ? CITY_AMBIENT : DUNGEON_AMBIENT;
    if(!cell.ambientLine){ cell.ambientLine = pick(ambientPool); }

    var lines = [cell.ambientLine];
    var mod = moduleFor(state);
    var contentLine = mod.roomDesc(cell);
    if(contentLine){ lines.push(contentLine); }

    var hints = RPG.MapUtil.DIR_ORDER.map(function(d){ return doorHint(d, state, cell); });
    lines.push(hints.join(' '));

    var html = lines.slice(0,-1).map(function(l){ return '<p>'+l+'</p>'; }).join('');
    html += '<p class="scene-hints">'+lines[lines.length-1]+'</p>';
    return html;
  }

  return { describeCurrent: describeCurrent };
})();
