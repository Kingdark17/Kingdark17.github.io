/* RPG Legend - trilha original gerada no navegador, sem arquivos externos. */
var RPG=window.RPG||{};
RPG.Music=(function(){
  var audioCtx=null,master=null,timer=null,step=0,current='',started=false;
  var THEMES={
    menu:{tempo:560,wave:'sine',notes:[261.63,329.63,392,329.63,293.66,349.23,440,349.23]},
    city:{tempo:480,wave:'triangle',notes:[261.63,329.63,392,523.25,392,329.63,293.66,349.23,440,523.25,440,349.23]},
    dungeon:{tempo:650,wave:'sine',notes:[110,146.83,164.81,146.83,103.83,138.59,155.56,138.59]},
    combat:{tempo:260,wave:'triangle',notes:[146.83,146.83,174.61,196,146.83,220,196,174.61]},
    boss:{tempo:210,wave:'sawtooth',notes:[98,98,116.54,130.81,98,146.83,130.81,116.54]}
  };
  function context(){if(!audioCtx){try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();master=audioCtx.createGain();master.gain.value=0;master.connect(audioCtx.destination);}catch(e){audioCtx=null;}}return audioCtx;}
  function wantedTheme(){var s=RPG.state;if(!s||!s.hero||s.screen!=='game')return 'menu';if(s.mode==='combat'){var cell=s.pendingMonsterCell,monster=cell&&cell.monsters&&cell.monsters[cell.monsterIndex||0];return monster&&monster.isBoss?'boss':'combat';}return s.mapMode==='dungeon'?'dungeon':'city';}
  function volume(){var s=RPG.state;return s&&s.soundOn!==false?Math.max(0,Math.min(1,Number(s.musicVolume===undefined?.28:s.musicVolume))):0;}
  function applyVolume(){if(!master||!audioCtx)return;master.gain.cancelScheduledValues(audioCtx.currentTime);master.gain.linearRampToValueAtTime(volume()*.16,audioCtx.currentTime+.18);}
  function note(freq,duration,wave,accent){var c=context();if(!c||!master||!freq||volume()<=0)return;try{var osc=c.createOscillator(),gain=c.createGain(),now=c.currentTime;osc.type=wave;osc.frequency.value=freq;gain.gain.setValueAtTime(0.0001,now);gain.gain.exponentialRampToValueAtTime(accent?0.24:0.14,now+.025);gain.gain.exponentialRampToValueAtTime(0.0001,now+duration);osc.connect(gain);gain.connect(master);osc.start(now);osc.stop(now+duration+.03);}catch(e){}}
  function tick(){var next=wantedTheme();if(next!==current){current=next;step=0;restart();return;}var theme=THEMES[current]||THEMES.menu,index=step%theme.notes.length;note(theme.notes[index],theme.tempo/1000*.78,theme.wave,index%4===0);if((current==='city'||current==='menu')&&index%4===0)note(theme.notes[index]/2,theme.tempo/1000*1.5,'sine',false);if(current==='combat'||current==='boss')note(theme.notes[index]/2,theme.tempo/1000*.55,'square',index%2===0);step++;}
  function restart(){if(timer)clearInterval(timer);var theme=THEMES[current]||THEMES.menu;timer=setInterval(tick,theme.tempo);tick();}
  function start(){if(started)return;var c=context();if(!c)return;started=true;if(c.state==='suspended')c.resume();current=wantedTheme();applyVolume();restart();}
  function refresh(){if(!started)return;var c=context();if(c&&c.state==='suspended')c.resume();applyVolume();var next=wantedTheme();if(next!==current){current=next;step=0;restart();}}
  document.addEventListener('pointerdown',start,{once:true});document.addEventListener('keydown',start,{once:true});setInterval(refresh,500);
  return {start:start,refresh:refresh};
})();
