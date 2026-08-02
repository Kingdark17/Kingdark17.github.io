/* =========================================================
   RPG Legend - js/map.js
   Geracao procedural de MASMORRA EM SALAS (estilo "Binding of
   Isaac"): cada celula da grade e uma sala inteira ou vazio,
   salas vizinhas se conectam por portas fixas (Norte/Sul/
   Leste/Oeste). Sem conceito de "para onde o jogador olha" —
   direcoes sao sempre absolutas, entao nao ha ambiguidade de
   lado nenhuma.
   ========================================================= */
var RPG = window.RPG || {};

RPG.MapUtil = (function(){

  var DIR_VECTORS = { N:{x:0,y:-1}, S:{x:0,y:1}, W:{x:-1,y:0}, E:{x:1,y:0} };
  var DIR_LABEL = { N:'Norte', S:'Sul', E:'Leste', W:'Oeste' };
  var DIR_OPP = { N:'S', S:'N', E:'W', W:'E' };
  var DIR_ORDER = ['N','S','E','W'];

  function rnd(n){ return Math.floor(Math.random()*n); }

  function inBounds(x,y,cols,rows){ return x>=0 && x<cols && y>=0 && y<rows; }

  // Planta uma grade esparsa de salas conectadas por portas, crescendo
  // a partir do centro (mesma ideia do gerador de masmorra do Isaac).
  function generateRoomGraph(rows, cols, roomCount){
    var grid = [];
    for(var y=0;y<rows;y++){
      var row = [];
      for(var x=0;x<cols;x++){ row.push({ type:'void', x:x, y:y, doors:{} }); }
      grid.push(row);
    }
    var cx = Math.floor(cols/2), cy = Math.floor(rows/2);
    var start = grid[cy][cx];
    start.type = 'start';
    var rooms = [start];
    var frontier = [start];
    var count = 1;
    var guard = 0;
    while(count < roomCount && frontier.length && guard < 800){
      guard++;
      var r = frontier[rnd(frontier.length)];
      var dirs = DIR_ORDER.slice().sort(function(){ return Math.random()-0.5; });
      var placed = false;
      for(var i=0;i<dirs.length;i++){
        var d = dirs[i];
        var v = DIR_VECTORS[d];
        var nx = r.x+v.x, ny = r.y+v.y;
        if(!inBounds(nx,ny,cols,rows)) continue;
        var target = grid[ny][nx];
        if(target.type !== 'void') continue;
        target.type = 'normal';
        target.doors[DIR_OPP[d]] = true;
        r.doors[d] = true;
        rooms.push(target);
        frontier.push(target);
        count++;
        placed = true;
        break;
      }
      if(!placed){ frontier = frontier.filter(function(f){ return f!==r; }); }
    }
    return { grid: grid, rooms: rooms, start: start };
  }

  function isRoom(cell){ return cell && cell.type !== 'void'; }

  // Distância real em número de portas a partir de uma sala. É usada para
  // impedir que saídas importantes apareçam coladas ao ponto inicial.
  function distancesFrom(grid, start, cols, rows){
    var distances={};
    var queue=[start];
    distances[start.x+','+start.y]=0;
    while(queue.length){
      var cell=queue.shift();
      var base=distances[cell.x+','+cell.y];
      Object.keys(cell.doors||{}).forEach(function(dir){
        var v=DIR_VECTORS[dir],nx=cell.x+v.x,ny=cell.y+v.y;
        if(!inBounds(nx,ny,cols,rows))return;
        var key=nx+','+ny;
        if(distances[key]!==undefined)return;
        distances[key]=base+1;
        queue.push(grid[ny][nx]);
      });
    }
    return distances;
  }

  // Uma sala fica "conhecida" (silhueta visivel no minimapa) assim que
  // qualquer sala vizinha ligada por porta ja foi visitada — nao precisa
  // ter tentado abrir a porta ainda. O conteudo so aparece ao entrar.
  function isKnown(grid, cell, cols, rows){
    if(cell.visited || cell.revealed) return true;
    var dirs = Object.keys(cell.doors || {});
    for(var i=0;i<dirs.length;i++){
      var v = DIR_VECTORS[dirs[i]];
      var nx = cell.x+v.x, ny = cell.y+v.y;
      if(inBounds(nx,ny,cols,rows) && grid[ny][nx].visited) return true;
    }
    return false;
  }

  return {
    DIR_VECTORS: DIR_VECTORS, DIR_LABEL: DIR_LABEL, DIR_OPP: DIR_OPP, DIR_ORDER: DIR_ORDER,
    generateRoomGraph: generateRoomGraph, distancesFrom: distancesFrom, inBounds: inBounds,
    isRoom: isRoom, isKnown: isKnown
  };
})();
