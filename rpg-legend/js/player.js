/* =========================================================
   RPG Legend - js/player.js
   Racas, classes, poderes, debuffs, criacao do heroi,
   sistema de XP/nivel e slots de equipamento.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Player = (function(){

  var RACES = [
    { name:"Humano", icon:"\ud83e\uddd1", desc:"Versatil e equilibrado em todos os atributos.", bonus:{forca:1,destreza:1,constituicao:1,intelecto:1,sabedoria:1,carisma:1} },
    { name:"Elfo", icon:"\ud83e\udddd", desc:"Agil e perceptivo, porem de constituicao fragil.", bonus:{destreza:2,intelecto:1,constituicao:-1} },
    { name:"Anao", icon:"\u26cf\ufe0f", desc:"Resistente e forte, mas pouco agil.", bonus:{constituicao:2,forca:1,destreza:-1} },
    { name:"Orc", icon:"\ud83d\udc79", desc:"Forca bruta acima da media, raciocinio mais lento.", bonus:{forca:3,intelecto:-1} },
    { name:"Elfo Negro", icon:"\ud83e\udd87", desc:"Mente afiada e reflexos rapidos, porem frio com estranhos.", bonus:{intelecto:2,destreza:1,carisma:-1} },
    { name:"Meio-Elfo", icon:"\ud83c\udf43", desc:"Carismatico e sabio, herda o melhor de dois mundos.", bonus:{carisma:1,sabedoria:1} }
  ];

  var CLASSES = [
    { name:"Guerreiro", icon:"\u2694\ufe0f", weaponTemplate:'espada', bias:{forca:3,constituicao:2}, desc:"Combate corpo a corpo, resistente na linha de frente." },
    { name:"Mago", icon:"\ud83e\uddd9", weaponTemplate:'cajado', bias:{intelecto:3,sabedoria:1}, desc:"Magias ofensivas e controle de mana." },
    { name:"Ladino", icon:"\ud83d\udd2a", weaponTemplate:'adaga', bias:{destreza:3,carisma:1}, desc:"Furtividade, criticos e agilidade." },
    { name:"Clerigo", icon:"\u271d\ufe0f", weaponTemplate:'maca', bias:{sabedoria:3,constituicao:1}, desc:"Cura aliados e resiste a corrupcao." },
    { name:"Barbaro", icon:"\ud83e\ude93", weaponTemplate:'machado', bias:{forca:4}, desc:"Furia bruta, dano massivo corpo a corpo." },
    { name:"Arqueiro", icon:"\ud83c\udff9", weaponTemplate:'arco', bias:{destreza:3,sabedoria:1}, desc:"Precisao a distancia e mobilidade." }
  ];

  var POWERS = [
    { name:"Golpe Poderoso", icon:"\ud83d\udca5", desc:"Concentra forca extra no proximo ataque corpo a corpo." },
    { name:"Bola de Fogo", icon:"\ud83d\udd25", desc:"Conjura uma explosao de fogo em area, consome mana." },
    { name:"Cura Menor", icon:"\u2728", desc:"Restaura uma pequena quantidade de vida." },
    { name:"Furtividade Sombria", icon:"\ud83c\udf11", desc:"Desaparece nas sombras para um ataque surpresa." },
    { name:"Tiro Certeiro", icon:"\ud83c\udfaf", desc:"Aumenta a precisao em ataques a distancia." },
    { name:"Grito de Guerra", icon:"\ud83d\udcef", desc:"Eleva o moral e os atributos dos aliados por um tempo." },
    { name:"Escudo Arcano", icon:"\ud83d\udd37", desc:"Cria uma barreira magica que reduz dano recebido." },
    { name:"Passo Veloz", icon:"\ud83d\udca8", desc:"Aumenta a velocidade e iniciativa do usuario." }
  ];

  var DEBUFFS = [
    { name:"Medo do Fogo", icon:"\ud83d\udd25", desc:"-2 em testes perto de chamas ou magia de fogo.", attr:null },
    { name:"Orgulhoso", icon:"\ud83d\udc51", desc:"-1 Carisma em negociacoes com autoridades.", attr:"carisma" },
    { name:"Visao Fraca", icon:"\ud83d\udc41\ufe0f", desc:"-2 em ataques a distancia em ambientes escuros.", attr:null },
    { name:"Sono Leve", icon:"\ud83d\ude34", desc:"Descansa mal e recupera menos energia; -1 Constituicao.", attr:"constituicao" },
    { name:"Desajeitado", icon:"\ud83e\udd15", desc:"-1 Destreza em testes de agilidade.", attr:"destreza" },
    { name:"Teimoso", icon:"\ud83e\udded", desc:"Recusa recuar de combates; -1 Sabedoria em decisoes taticas.", attr:"sabedoria" }
  ];

  var MODES = [
    { id:"solo", icon:"\ud83e\udea6", name:"Jogar Solo", desc:"Voce enfrenta a cidade e a masmorra sozinho." },
    { id:"equipe", icon:"\ud83e\udd1d", name:"Criar Equipe", desc:"Dois companheiros de aventura se juntam a voce." }
  ];

  var FIRST_NAMES = ["Aldric","Bryn","Cael","Dara","Eron","Fiora","Garrick","Helka","Ivo","Junne","Korrin","Lyra","Maren","Norrik","Orla","Petra","Quill","Rhoda","Sten","Thalia"];
  var SURNAMES = ["Pedraverde","Fenris","Duasluas","Corvonegro","Vale-Ferro","Lobodourado","Ventoforte","Silencio","Brasa","Marfim"];
  var ATTR_KEYS = ["forca","destreza","constituicao","intelecto","sabedoria","carisma"];
  var ATTR_LABELS = { forca:"FOR", destreza:"DES", constituicao:"CON", intelecto:"INT", sabedoria:"SAB", carisma:"CAR" };

  function rnd(n){ return Math.floor(Math.random()*n); }
  function pick(arr){ return arr[rnd(arr.length)]; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

  function rollAttrs(race, cls, debuff){
    var attrs = {};
    ATTR_KEYS.forEach(function(k){ attrs[k] = 6 + rnd(6); });
    Object.keys(race.bonus).forEach(function(k){ attrs[k] += race.bonus[k]; });
    Object.keys(cls.bias).forEach(function(k){ attrs[k] += cls.bias[k]; });
    if(debuff.attr){ attrs[debuff.attr] -= 1; }
    ATTR_KEYS.forEach(function(k){ attrs[k] = clamp(attrs[k], 1, 20); });
    return attrs;
  }

  function attrMod(v){ var m = Math.floor((v-10)/2); return m; }

  function xpForLevel(level){ return 40 + (level-1)*35; }

  function buildHero(creation){
    var attrs = rollAttrs(creation.race, creation.cls, creation.debuff);
    var maxHp = 20 + attrs.constituicao * 3;
    var maxMp = 10 + attrs.intelecto * 2 + attrs.sabedoria;
    var weaponTemplate = RPG.Items.TEMPLATES.filter(function(t){ return t.id===creation.cls.weaponTemplate; })[0];
    var startWeapon = RPG.Items.instantiate(weaponTemplate, RPG.Items.RARITIES[0]);
    startWeapon.equipped = true;

    var hero = {
      name: creation.name, race: creation.race.name, raceIcon: creation.race.icon,
      className: creation.cls.name, classIcon: creation.cls.icon, attrs: attrs,
      level: 1, xp: 0, xpNext: xpForLevel(1),
      hp: maxHp, maxHp: maxHp, mp: maxMp, maxMp: maxMp,
      gold: 30 + rnd(21),
      powers: creation.powers, debuff: creation.debuff,
      equip: { arma: startWeapon, armadura: null, acessorio: null },
      killCount: 0
    };
    return hero;
  }

  function generateCompanion(){
    var race = pick(RACES); var cls = pick(CLASSES);
    var attrs = {};
    ATTR_KEYS.forEach(function(k){ attrs[k] = 6 + rnd(6); });
    Object.keys(race.bonus).forEach(function(k){ attrs[k] += race.bonus[k]; });
    Object.keys(cls.bias).forEach(function(k){ attrs[k] += cls.bias[k]; });
    var maxHp = 18 + attrs.constituicao * 3;
    return { name: pick(FIRST_NAMES)+" "+pick(SURNAMES), raceIcon: race.icon, race: race.name, className: cls.name, classIcon: cls.icon, hp: maxHp, maxHp: maxHp };
  }

  // soma os bonus de todos os itens equipados
  function equipmentBonus(hero){
    var sum = { ataque:0, defesa:0, vida:0, mana:0, critico:0, velocidade:0, esquiva:0 };
    ['arma','armadura','acessorio'].forEach(function(slot){
      var it = hero.equip[slot];
      if(!it) return;
      Object.keys(it.stats).forEach(function(k){ if(sum[k]!==undefined){ sum[k] += it.stats[k]; } });
    });
    return sum;
  }

  function equipItem(hero, item){
    if(item.category !== 'arma' && item.category !== 'armadura' && item.category !== 'acessorio') return false;
    var slot = item.category;
    if(hero.equip[slot]){ hero.equip[slot].equipped = false; }
    hero.equip[slot] = item;
    item.equipped = true;
    return true;
  }

  function unequipItem(hero, slot){
    if(hero.equip[slot]){ hero.equip[slot].equipped = false; hero.equip[slot] = null; }
  }

  // retorna {leveledUp, levels} apos aplicar XP, atualizando hp/mp maximos
  function gainXP(hero, amount){
    hero.xp += amount;
    var levels = 0;
    while(hero.xp >= hero.xpNext){
      hero.xp -= hero.xpNext;
      hero.level += 1;
      hero.xpNext = xpForLevel(hero.level);
      hero.attrs.forca += (hero.level % 2 === 0) ? 1 : 0;
      hero.attrs.constituicao += 1;
      var addHp = 8 + attrMod(hero.attrs.constituicao)*2;
      var addMp = 4 + attrMod(hero.attrs.intelecto);
      hero.maxHp += addHp; hero.hp = hero.maxHp;
      hero.maxMp += addMp; hero.mp = hero.maxMp;
      levels++;
    }
    return { leveledUp: levels>0, levels: levels };
  }

  return {
    RACES: RACES, CLASSES: CLASSES, POWERS: POWERS, DEBUFFS: DEBUFFS, MODES: MODES,
    ATTR_KEYS: ATTR_KEYS, ATTR_LABELS: ATTR_LABELS,
    attrMod: attrMod, buildHero: buildHero, generateCompanion: generateCompanion,
    equipmentBonus: equipmentBonus, equipItem: equipItem, unequipItem: unequipItem,
    gainXP: gainXP, xpForLevel: xpForLevel
  };
})();
