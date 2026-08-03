/* =========================================================
   RPG Legend - js/monsters.js
   Especies de monstros + geracao escalada por andar/chefes.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Monsters = (function(){

  // Especies base. behavior apenas descreve o "estilo" (usado em flavor text).
  var SPECIES = [
    { name:'Goblin', icon:'\ud83d\udc79', behavior:'agressivo', baseHp:10, baseSpeed:8, baseDmg:3, weakness:'magico', resistance:'nenhuma', ability:'Ataque Impulsivo', abilityDesc:'Pode causar dano extra.' },
    { name:'Lobo das Sombras', icon:'\ud83d\udc3a', behavior:'agil', baseHp:9, baseSpeed:13, baseDmg:3, weakness:'magico', resistance:'fisico', ability:'Reflexos Rápidos', abilityDesc:'Tem chance de evitar ataques comuns.' },
    { name:'Esqueleto Errante', icon:'\ud83d\udc80', behavior:'defensivo', baseHp:13, baseSpeed:6, baseDmg:2, weakness:'magico', resistance:'fisico', ability:'Ossos Reforcados', abilityDesc:'Reduz parte do dano físico recebido.' },
    { name:'Aranha Gigante', icon:'\ud83d\udd77\ufe0f', behavior:'venenoso', baseHp:8, baseSpeed:11, baseDmg:4, weakness:'fisico', resistance:'nenhuma', ability:'Picada Venenosa', abilityDesc:'Pode envenenar o herói por 3 turnos.' },
    { name:'Slime Corrosivo', icon:'\ud83d\udfe2', behavior:'defensivo', baseHp:15, baseSpeed:4, baseDmg:2, weakness:'magico', resistance:'fisico', ability:'Corpo Gelatinoso', abilityDesc:'Reduz parte do dano físico recebido.' },
    { name:'Orc Selvagem', icon:'\ud83d\udc79', behavior:'agressivo', baseHp:14, baseSpeed:7, baseDmg:4, weakness:'magico', resistance:'nenhuma', ability:'Fúria Selvagem', abilityDesc:'Pode causar dano extra.' },
    { name:'Morcego Vampírico', icon:'\ud83e\udd87', behavior:'agil', baseHp:7, baseSpeed:14, baseDmg:2, weakness:'fisico', resistance:'magico', ability:'Voo Errático', abilityDesc:'Tem chance de evitar ataques comuns.' },
    { name:'Zumbi Cambaleante', icon:'\ud83e\udddf', behavior:'lento', baseHp:16, baseSpeed:3, baseDmg:3, weakness:'magico', resistance:'fisico', ability:'Golpe Pesado', abilityDesc:'A cada 3 ataques, causa dano elevado.' },
    { name:'Elemental de Fogo', icon:'\ud83d\udd25', behavior:'magico', baseHp:11, baseSpeed:9, baseDmg:5, weakness:'fisico', resistance:'magico', ability:'Chama Arcana', abilityDesc:'Pode queimar e drenar mana.' },
    { name:'Espectro Gelado', icon:'\u2744\ufe0f', behavior:'magico', baseHp:12, baseSpeed:10, baseDmg:4, weakness:'fisico', resistance:'magico', ability:'Toque Gélido', abilityDesc:'Pode drenar mana do herói.' }
  ];

  // Prefixos usados para variar o nome de monstros em andares mais profundos,
  // criando a sensacao de dezenas de variacoes sem precisar de 50 especies unicas.
  var TIER_ADJECTIVES = [
    { min:1,  max:3,  label:'' },
    { min:4,  max:7,  label:'Corrompido' },
    { min:8,  max:12, label:'Ancestral' },
    { min:13, max:18, label:'Amaldiçoado' },
    { min:19, max:99, label:'Lendário' }
  ];

  var BOSS_TITLES = [
    'o Devorador', 'o Flagelo', 'Senhor das Trevas', 'o Ímpio', 'o Eterno', 'Rei dos Ossos', 'a Calamidade'
  ];
  var ENEMY_CLASSES = [
    {name:'Brutamontes',icon:'\ud83d\udca5',power:'Impacto Brutal',powerDesc:'A cada 3 ataques causa 70% mais dano.',hp:1.15,dmg:1.2,speed:.9},
    {name:'Assassino',icon:'\ud83d\udde1\ufe0f',power:'Lâmina Tóxica',powerDesc:'A cada 3 ataques causa dano extra e aplica veneno.',hp:.9,dmg:1.15,speed:1.25},
    {name:'Xamã',icon:'\ud83d\udd2e',power:'Regeneração Profana',powerDesc:'A cada 3 ataques recupera parte da própria Vida.',hp:1,dmg:1.05,speed:1},
    {name:'Guardião',icon:'\ud83d\udee1\ufe0f',power:'Muralha Sombria',powerDesc:'A cada 3 ataques reduz o dano dos próximos golpes.',hp:1.35,dmg:.95,speed:.8},
    {name:'Feiticeiro',icon:'\ud83e\uddd9',power:'Ruptura Arcana',powerDesc:'A cada 3 ataques drena Mana e aumenta o dano mágico.',hp:.95,dmg:1.18,speed:1.05}
  ];

  function rnd(n){ return Math.floor(Math.random()*n); }
  function pick(arr){ return arr[rnd(arr.length)]; }

  function tierLabelFor(floor){
    for(var i=0;i<TIER_ADJECTIVES.length;i++){
      var t = TIER_ADJECTIVES[i];
      if(floor>=t.min && floor<=t.max) return t.label;
    }
    return '';
  }
  function ensureClass(monster){
    if(!monster.enemyClass){var cls=pick(ENEMY_CLASSES);monster.enemyClass=cls.name;monster.classIcon=cls.icon;monster.classPower=cls.power;monster.classPowerDesc=cls.powerDesc;}
    return monster;
  }

  // Gera um monstro comum escalado para o andar informado.
  function generate(floor){
    var sp = pick(SPECIES);
    var enemyClass=pick(ENEMY_CLASSES);
    var adj = tierLabelFor(floor);
    var name = adj ? (sp.name + ' ' + adj) : sp.name;
    var scale = 1 + (floor-1)*0.27;
    return {
      name: name,
      icon: sp.icon,
      behavior: sp.behavior,
      ability: sp.ability, abilityDesc: sp.abilityDesc,
      enemyClass:enemyClass.name,classIcon:enemyClass.icon,classPower:enemyClass.power,classPowerDesc:enemyClass.powerDesc,
      weakness: sp.weakness, resistance: sp.resistance,
      speed: Math.max(1,Math.round(sp.baseSpeed*(1+(floor-1)*0.09)*enemyClass.speed)),
      hp: Math.round(sp.baseHp*scale*enemyClass.hp)+rnd(4),
      dmg: Math.max(1,Math.round((sp.baseDmg+Math.floor((floor-1)*.6))*enemyClass.dmg)),
      xp: 6 + floor*3 + rnd(4),
      gold: 4 + floor*2 + rnd(6),
      isBoss: false
    };
  }

  // Gera um chefe (mini-chefe a cada 5 andares, chefe principal a cada 10).
  function generateBoss(floor){
    var sp = pick(SPECIES);
    var enemyClass=pick(ENEMY_CLASSES);
    var isMain = (floor % 10 === 0);
    var title = pick(BOSS_TITLES);
    var mult = isMain ? 3.2 : 2.1;
    return {
      name: sp.name + ', ' + title,
      icon: sp.icon,
      behavior: sp.behavior,
      ability: sp.ability, abilityDesc: sp.abilityDesc,
      enemyClass:'Chefe '+enemyClass.name,classIcon:enemyClass.icon,classPower:enemyClass.power,classPowerDesc:enemyClass.powerDesc,
      weakness: sp.weakness, resistance: sp.resistance,
      speed: Math.round(sp.baseSpeed * (1 + (floor-1)*0.08) * 0.9),
      hp: Math.round(sp.baseHp*(1+(floor-1)*0.27)*mult*enemyClass.hp)+20,
      dmg: Math.round((sp.baseDmg+Math.floor((floor-1)*.65)+(isMain?5:3))*enemyClass.dmg),
      xp: (isMain? 60 : 30) + floor*5,
      gold: (isMain? 80 : 40) + floor*6,
      isBoss: true,
      isMainBoss: isMain,
      bossAbility: isMain ? 'Golpe Devastador' : 'Fúria do Guardião',
      bossAbilityDesc: isMain ? 'A cada 3 ataques desfere um golpe muito mais forte.' : 'Fica mais forte ao cair abaixo de metade da vida.'
    };
  }

  return {
    SPECIES: SPECIES,
    ENEMY_CLASSES:ENEMY_CLASSES,
    ensureClass:ensureClass,
    generate: generate,
    generateBoss: generateBoss
  };
})();
