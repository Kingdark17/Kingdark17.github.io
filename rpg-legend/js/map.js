/* =========================================================
   RPG Legend - js/map.js
   Geracao procedural de corredores (usada por cidade e masmorra),
   utilidades de fog-of-war e movimentacao em grid.
   ========================================================= */
var RPG = window.RPG || {};

RPG.MapUtil = (function(){

  var DIR_VECTORS = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
  var DIR_CYCLE = ['up','right','down','left'];
  var DIR_ARROW = { up:'\u25b2', right:'\u25ba', down:'\u25bc', left:'\u25c4' };

  function rnd(n){ return Math.floor(Math.random()*n); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

  function rotateRight(dir){ return DIR_CYCLE[(DIR_CYCLE.indexOf(dir)+1)%4]; }
  function rotateLeft(dir){ return DIR_CYCLE[(DIR_CYCLE.indexOf(dir)+3)%4]; }
  function opposite(dir){ return DIR_CYCLE[(DIR_CYCLE.indexOf(dir)+2)%4]; }

  // Cava corredores por um "passeio aleatorio" a partir do centro da grade.
  function carveWalk(rows, cols, targetFraction){
    var grid = [];
    for(var y=0;y<rows;y++){ var row=[]; for(var x=0;x<cols;x++){ row.push({type:'wall', x:x, y:y}); } grid.push(row); }
    var cx = Math.floor(cols/2), cy = Math.floor(rows/2);
    var floorCells = [];
    var target = Math.floor(rows*cols*targetFraction);
    var attempts = 0;
    while(floorCells.length < target && attempts < target*20){
      attempts++;
      if(grid[cy][cx].type === 'wall'){ grid[cy][cx].type = 'floor'; floorCells.push(grid[cy][cx]); }
      var dir = rnd(4);
      if(dir===0) cx = clamp(cx+1,0,cols-1);
      else if(dir===1) cx = clamp(cx-1,0,cols-1);
      else if(dir===2) cy = clamp(cy+1,0,rows-1);
      else cy = clamp(cy-1,0,rows-1);
    }
    return { grid: grid, floorCells: floorCells };
  }

  function inBounds(x,y,cols,rows){ return x>=0 && x<cols && y>=0 && y<rows; }
  function isWalkable(cell){ return cell && cell.type!=='wall' && cell.type!=='building'; }

  function isKnown(map, cell, cols, rows){
    if(cell.visited || cell.revealed) return true;
    var neighbors = [[0,-1],[0,1],[-1,0],[1,0]];
    for(var i=0;i<neighbors.length;i++){
      var nx = cell.x+neighbors[i][0], ny = cell.y+neighbors[i][1];
      if(inBounds(nx,ny,cols,rows) && map[ny][nx].visited) return true;
    }
    return false;
  }

  function facingDeg(dir){ return dir==='up'?0 : dir==='right'?90 : dir==='down'?180 : 270; }

  return {
    DIR_VECTORS: DIR_VECTORS, DIR_CYCLE: DIR_CYCLE, DIR_ARROW: DIR_ARROW,
    rotateRight: rotateRight, rotateLeft: rotateLeft, opposite: opposite,
    carveWalk: carveWalk, inBounds: inBounds, isWalkable: isWalkable,
    isKnown: isKnown, facingDeg: facingDeg
  };
})();
