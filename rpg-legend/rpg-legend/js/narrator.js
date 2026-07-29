/* =========================================================
   RPG Legend - js/narrator.js
   Gera a descricao textual do local onde o heroi esta parado,
   com pistas nas quatro direcoes. So descreve com detalhes o
   que ja foi revelado (nao estraga a neblina de guerra).
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
    "Um silencio pesado paira sobre o corredor, quebrado apenas por um pingar distante.",
    "Musgo cobre as pedras irregulares sob seus pes.",
    "Algo goteja em algum lugar da escuridao adiante.",
    "As paredes estreitas parecem se fechar um pouco mais a cada passo.",
    "Um vento fraco sopra vindo de algum lugar mais fundo na masmorra."
  ];

  // descricao do que ha na propria sala onde o heroi esta parado
  var CONTENT_LINES = {
    npc: function(cell){ return 'Voce esta diante de <b>'+cell.npc.name+'</b>, '+cell.npc.role.toLowerCase()+'.'; },
    treasure: function(cell){ return cell.collected ? 'Um bau vazio jaz aberto no chao — ja foi revistado.' : 'Um bau de madeira reforcada repousa alguns passos a frente.'; },
    monster: function(cell){ return cell.beaten ? 'Os restos da batalha ainda marcam o chao desta sala.' : '<b>'+cell.monster.name+'</b> bloqueia o caminho, observando cada movimento seu.'; },
    boss: function(cell){ return cell.beaten ? 'O covil do guardiao agora esta silencioso e vazio.' : 'Uma presenca imensa e hostil domina esta camara: <b>'+cell.monster.name+'</b>.'; },
    shop: function(){ return 'Um vendedor itinerante organiza suas mercadorias sobre um pano estendido no chao.'; },
    blacksmith: function(){ return 'O calor da forja aquece o ar; um ferreiro trabalha o metal com golpes firmes.'; },
    tavern: function(){ return 'Risadas e cheiro de cerveja escapam pela porta entreaberta da taverna.'; },
    questboard: function(){ return 'Um quadro de madeira, coberto de pergaminhos e anuncios, esta afixado na parede.'; },
    gate: function(){ return 'Um portao de pedra antiga marca a entrada da masmorra.'; },
    exit: function(){ return 'Um caminho iluminado sobe de volta em direcao a cidade.'; },
    stairs: function(){ return 'Escadas de pedra descem para a escuridao, mais fundo na masmorra.'; },
    start: function(cell, state){ return state.mapMode==='city' ? 'Este foi o ponto onde voce chegou a cidade.' : 'Foi aqui que voce chegou a este andar.'; }
  };

  // versao curta, usada nas dicas de direcao (celulas ja reveladas)
  var SHORT_HINT = {
    npc: function(){ return 'alguem parado por perto'; },
    treasure: function(cell){ return cell.collected ? 'um bau ja vazio' : 'um bau fechado'; },
    monster: function(cell){ return cell.beaten ? 'os restos de uma batalha' : 'uma criatura hostil'; },
    boss: function(cell){ return cell.beaten ? 'um covil agora silencioso' : 'uma presenca poderosa e perigosa'; },
    shop: function(){ return 'um vendedor'; },
    blacksmith: function(){ return 'a forja de um ferreiro'; },
    tavern: function(){ return 'a entrada de uma taverna'; },
    questboard: function(){ return 'um quadro de missoes'; },
    gate: function(){ return 'o portao da masmorra'; },
    exit: function(){ return 'o caminho de volta a cidade'; },
    stairs: function(){ return 'escadas descendo'; },
    start: function(){ return 'o ponto de partida'; }
  };

  var DIR_LABEL = { front:'A frente', left:'A esquerda', right:'A direita', back:'Atras de voce' };

  function neighborHint(rel, info){
    if(!info){ return DIR_LABEL[rel]+', uma parede bloqueia a passagem.'; }
    var cell = info.cell;
    var known = cell.visited || cell.revealed;
    if(!known){ return DIR_LABEL[rel]+', o caminho segue adiante.'; }
    var hintFn = SHORT_HINT[cell.type];
    if(!hintFn){ return DIR_LABEL[rel]+', o caminho continua.'; }
    return DIR_LABEL[rel]+', voce percebe '+hintFn(cell)+'.';
  }

  // descreve a sala onde o heroi esta parado agora, com pistas nas 4 direcoes
  function describeCurrent(state){
    if(!state.map || !state.map.length) return '';
    var cell = state.map[state.pos.y][state.pos.x];
    var ambientPool = state.mapMode==='city' ? CITY_AMBIENT : DUNGEON_AMBIENT;
    if(!cell.ambientLine){ cell.ambientLine = pick(ambientPool); }

    var lines = [cell.ambientLine];

    var contentFn = CONTENT_LINES[cell.type];
    if(contentFn){ lines.push(contentFn(cell, state)); }

    var hints = ['front','left','right','back'].map(function(rel){
      return neighborHint(rel, RPG.UI.neighborCell(rel));
    });
    lines.push(hints.join(' '));

    var html = lines.slice(0,-1).map(function(l){ return '<p>'+l+'</p>'; }).join('');
    html += '<p class="scene-hints">'+lines[lines.length-1]+'</p>';
    return html;
  }

  return { describeCurrent: describeCurrent };
})();
