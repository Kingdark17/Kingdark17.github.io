/* RPG Legend - trilha procedural original, sem samples ou arquivos externos. */
var RPG=window.RPG||{};
RPG.Music=(function(){
  var audioCtx=null,master=null,echo=null,echoGain=null,timer=null,current='',step=0,started=false;
  var THEMES={
    menu:{beat:470,melody:[62,65,69,67,65,62,60,57,62,65,69,72,69,67,65,0],bass:[38,38,41,41],chords:[[50,53,57],[48,53,57]],kind:'harp'},
    city:{beat:330,melody:[69,72,74,76,74,72,69,67,69,72,76,79,76,74,72,0,67,69,72,74,72,69,67,64,67,72,74,76,74,72,69,0],bass:[45,45,43,43,41,41,43,43],chords:[[57,60,64],[55,59,62],[53,57,60],[55,59,62]],kind:'celtic'},
    dungeon:{beat:520,melody:[45,0,48,0,46,0,41,0,43,0,46,0,41,0,40,0],bass:[33,33,31,31],chords:[[45,48,52],[43,46,50]],kind:'dark'},
    combat:{beat:185,melody:[57,57,60,62,57,64,62,60,55,55,59,60,55,62,60,59],bass:[33,33,36,36,31,31,36,36],chords:[[45,48,52],[43,47,50]],kind:'battle'},
    boss:{beat:225,melody:[45,45,46,48,45,52,50,48,43,43,45,46,43,50,48,46],bass:[28,28,31,31,26,26,31,31],chords:[[40,45,48],[38,43,46]],kind:'boss'}
  };
  function context(){
    if(!audioCtx){try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();master=audioCtx.createGain();var compressor=audioCtx.createDynamicsCompressor();echo=audioCtx.createDelay(.8);echo.delayTime.value=.24;echoGain=audioCtx.createGain();echoGain.gain.value=.16;master.connect(compressor);compressor.connect(audioCtx.destination);master.connect(echo);echo.connect(echoGain);echoGain.connect(compressor);master.gain.value=0;}catch(e){audioCtx=null;}}
    return audioCtx;
  }
  function hz(midi){return 440*Math.pow(2,(midi-69)/12);}
  function gameVolume(){var s=RPG.state;return s&&s.soundOn!==false?Math.max(0,Math.min(1,Number(s.musicVolume===undefined?0.28:s.musicVolume))):0;}
  function applyVolume(){if(!master||!audioCtx)return;master.gain.cancelScheduledValues(audioCtx.currentTime);master.gain.linearRampToValueAtTime(gameVolume()*.48,audioCtx.currentTime+.2);}
  function voice(midi,duration,type,amount,attack,filterFreq){
    var c=context();if(!c||!midi||gameVolume()<=0)return;try{var now=c.currentTime,osc=c.createOscillator(),gain=c.createGain(),filter=c.createBiquadFilter();osc.type=type||'triangle';osc.frequency.value=hz(midi);filter.type='lowpass';filter.frequency.value=filterFreq||5000;gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(amount||.1,now+(attack||.015));gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(filter);filter.connect(gain);gain.connect(master);osc.start(now);osc.stop(now+duration+.04);}catch(e){}
  }
  function harp(midi,beat){voice(midi,beat*.72,'triangle',.13,.008,4200);voice(midi+12,beat*.38,'sine',.045,.006,5200);}
  function flute(midi,beat){voice(midi,beat*1.65,'sine',.075,.12,3600);voice(midi+12,beat*1.2,'triangle',.018,.14,3000);}
  function pad(notes,beat,dark){(notes||[]).forEach(function(note,index){voice(note,beat*4.1,dark?'sawtooth':'sine',dark?0.025:0.035,.35,dark?700:1700);if(index===0)voice(note-12,beat*4,'sine',.025,.3,900);});}
  function drum(strong,dark){
    var c=context();if(!c||gameVolume()<=0)return;try{var now=c.currentTime,osc=c.createOscillator(),gain=c.createGain();osc.type='sine';osc.frequency.setValueAtTime(strong?(dark?78:105):145,now);osc.frequency.exponentialRampToValueAtTime(45,now+.13);gain.gain.setValueAtTime(strong?0.16:0.07,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.15);osc.connect(gain);gain.connect(master);osc.start(now);osc.stop(now+.17);}catch(e){}
  }
  function wantedTheme(){var s=RPG.state;if(!s||!s.hero||s.screen!=='game')return 'menu';if(s.mode==='combat'){var cell=s.pendingMonsterCell,monster=cell&&cell.monsters&&cell.monsters[cell.monsterIndex||0];return monster&&monster.isBoss?'boss':'combat';}return s.mapMode==='dungeon'?'dungeon':'city';}
  function tick(){
    var next=wantedTheme();if(next!==current){switchTheme(next);return;}var t=THEMES[current]||THEMES.menu,seconds=t.beat/1000,index=step%t.melody.length,note=t.melody[index];
    if(step%4===0)pad(t.chords[Math.floor(step/4)%t.chords.length],seconds,t.kind==='dark'||t.kind==='boss');
    if(step%4===0)voice(t.bass[Math.floor(step/4)%t.bass.length],seconds*3.5,'sine',t.kind==='boss'?0.11:0.065,.03,600);
    if(t.kind==='celtic'){if(note)harp(note,seconds);if(step%8===4)flute(note+12,seconds);}
    else if(t.kind==='harp'){if(note)harp(note,seconds);if(step%8===0)flute(note+12,seconds);}
    else if(t.kind==='dark'){if(note)flute(note+12,seconds);if(step%8===0)voice(t.bass[Math.floor(step/4)%t.bass.length]-12,seconds*7,'sine',.07,.45,450);}
    else if(t.kind==='battle'){if(note)harp(note,seconds);drum(step%4===0,false);}
    else if(t.kind==='boss'){if(note)voice(note,seconds*.82,'sawtooth',.085,.025,1100);drum(step%4===0,true);if(step%8===0)voice(note-12,seconds*6,'sawtooth',.06,.25,650);}
    step++;
  }
  function switchTheme(name){current=name;step=0;if(timer)clearInterval(timer);var theme=THEMES[current]||THEMES.menu;timer=setInterval(tick,theme.beat);tick();}
  function start(){if(started)return;var c=context();if(!c)return;started=true;if(c.state==='suspended')c.resume();applyVolume();switchTheme(wantedTheme());}
  function refresh(){if(!started)return;var c=context();if(c&&c.state==='suspended')c.resume();applyVolume();var next=wantedTheme();if(next!==current)switchTheme(next);}
  document.addEventListener('pointerdown',start,{once:true});document.addEventListener('keydown',start,{once:true});setInterval(refresh,500);
  return {start:start,refresh:refresh,currentTheme:function(){return current;}};
})();
