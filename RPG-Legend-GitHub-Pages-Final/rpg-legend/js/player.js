/* =========================================================
   RPG Legend - js/player.js
   Racas, classes, poderes, debuffs, criacao do heroi,
   sistema de XP/nivel e slots de equipamento.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Player = (function(){

  var RACES = [
    { name:"Humano", icon:"\ud83e\uddd1", desc:"Versátil e equilibrado em todos os atributos.", bonus:{forca:1,destreza:1,constituicao:1,intelecto:1,sabedoria:1,carisma:1} },
    { name:"Elfo", icon:"\ud83e\udddd", desc:"Ágil e perceptivo, porém de constituição frágil.", bonus:{destreza:2,intelecto:1,constituicao:-1} },
    { name:"Anão", icon:"\u26cf\ufe0f", desc:"Resistente e forte, mas pouco ágil.", bonus:{constituicao:2,forca:1,destreza:-1} },
    { name:"Orc", icon:"\ud83d\udc79", desc:"Força bruta acima da média, raciocínio mais lento.", bonus:{forca:3,intelecto:-1} },
    { name:"Elfo Negro", icon:"\ud83e\udd87", desc:"Mente afiada e reflexos rápidos, porém frio com estranhos.", bonus:{intelecto:2,destreza:1,carisma:-1} },
    { name:"Meio-Elfo", icon:"\ud83c\udf43", desc:"Carismático e sábio, herda o melhor de dois mundos.", bonus:{carisma:1,sabedoria:1} }
  ];

  // afinidade = % de eficiencia da classe com cada tipo de arma (base).
  // Nenhuma arma e bloqueada -- toda classe pode equipar qualquer uma,
  // so causa menos dano/efeito nas que tem pouca afinidade.
  var CLASSES = [
    { name:"Guerreiro", icon:"\u2694\ufe0f", weaponTemplate:'espada', bias:{forca:3,constituicao:2}, desc:"Combate corpo a corpo, resistente na linha de frente.", signature:"Golpe Poderoso",
      affinity:{espada:100,machado:90,maca:70,adaga:55,arco:50,cajado:25} },
    { name:"Mago", icon:"\ud83e\uddd9", weaponTemplate:'cajado', bias:{intelecto:3,sabedoria:1}, desc:"Magias ofensivas e controle de mana.", signature:"Bola de Fogo",
      affinity:{cajado:100,maca:55,adaga:45,arco:40,espada:30,machado:20} },
    { name:"Ladino", icon:"\ud83d\udd2a", weaponTemplate:'adaga', bias:{destreza:3,carisma:1}, desc:"Furtividade, críticos e agilidade.", signature:"Furtividade Sombria",
      affinity:{adaga:100,arco:80,espada:55,maca:40,machado:40,cajado:30} },
    { name:"Clérigo", icon:"\u271d\ufe0f", weaponTemplate:'maca', bias:{sabedoria:3,constituicao:1}, desc:"Cura aliados e resiste a corrupção.", signature:"Cura Menor",
      affinity:{maca:100,cajado:70,espada:50,adaga:40,arco:35,machado:30} },
    { name:"Bárbaro", icon:"\ud83e\ude93", weaponTemplate:'machado', bias:{forca:4}, desc:"Fúria bruta, dano massivo corpo a corpo.", signature:"Grito de Guerra",
      affinity:{machado:100,espada:85,maca:55,adaga:45,arco:35,cajado:15} },
    { name:"Arqueiro", icon:"\ud83c\udff9", weaponTemplate:'arco', bias:{destreza:3,sabedoria:1}, desc:"Precisão a distância e mobilidade.", signature:"Tiro Certeiro",
      affinity:{arco:100,adaga:70,espada:50,maca:40,machado:35,cajado:25} }
  ];

  // type: dano_fisico | dano_magico | cura | buff_crit | buff_precisao | buff_forca | buff_esquiva | escudo
  var POWERS = [
    { name:"Golpe Poderoso", icon:"\ud83d\udca5", desc:"Concentra força extra no próximo ataque corpo a corpo.", cost:8, type:"dano_fisico", power:1.8 },
    { name:"Bola de Fogo", icon:"\ud83d\udd25", desc:"Conjura uma explosão de fogo, causa dano mágico.", cost:14, type:"dano_magico", power:1.6 },
    { name:"Cura Menor", icon:"\u2728", desc:"Restaura uma quantidade de vida.", cost:10, type:"cura", power:1.0 },
    { name:"Furtividade Sombria", icon:"\ud83c\udf11", desc:"O próximo ataque é um acerto crítico garantido.", cost:8, type:"buff_crit" },
    { name:"Tiro Certeiro", icon:"\ud83c\udfaf", desc:"Aumenta muito a precisão dos próximos ataques.", cost:6, type:"buff_precisao", turns:2, amount:25 },
    { name:"Grito de Guerra", icon:"\ud83d\udcef", desc:"Aumenta o dano físico causado por um tempo.", cost:10, type:"buff_forca", turns:3, amount:0.3 },
    { name:"Escudo Arcano", icon:"\ud83d\udd37", desc:"Cria uma barreira que absorve o próximo golpe recebido.", cost:10, type:"escudo", amount:0.5 },
    { name:"Passo Veloz", icon:"\ud83d\udca8", desc:"Aumenta a chance de esquiva por um tempo.", cost:6, type:"buff_esquiva", turns:3, amount:20 }
  ];

  var DEBUFFS = [
    { name:"Medo do Fogo", icon:"\ud83d\udd25", desc:"Recebe 25% mais dano de criaturas mágicas ou de fogo.", attr:null, effect:"fireVulnerability" },
    { name:"Orgulhoso", icon:"\ud83d\udc51", desc:"-1 Carisma em negociações com autoridades.", attr:"carisma" },
    { name:"Visão Fraca", icon:"\ud83d\udc41\ufe0f", desc:"-2 nas rolagens de ataque quando usa arco ou cajado.", attr:null, effect:"rangedPenalty" },
    { name:"Sono Leve", icon:"\ud83d\ude34", desc:"Descansa mal e recupera menos energia; -1 Constituição.", attr:"constituicao" },
    { name:"Desajeitado", icon:"\ud83e\udd15", desc:"-1 Destreza em testes de agilidade.", attr:"destreza" },
    { name:"Teimoso", icon:"\ud83e\udded", desc:"-1 Sabedoria e -2 nas tentativas de fuga.", attr:"sabedoria", effect:"fleePenalty" }
  ];

  var MODES = [
    { id:"solo", icon:"\ud83e\udea6", name:"Jogar Solo", desc:"Você enfrenta a cidade e a masmorra sozinho." },
    { id:"equipe", icon:"\ud83e\udd1d", name:"Criar Equipe", desc:"Dois companheiros de aventura se juntam a você." }
  ];

  var FIRST_NAMES = ["Aldric","Bryn","Cael","Dara","Eron","Fiora","Garrick","Helka","Ivo","Junne","Korrin","Lyra","Maren","Norrik","Orla","Petra","Quill","Rhoda","Sten","Thalia"];
  var SURNAMES = ["Pedraverde","Fenris","Duasluas","Corvonegro","Vale-Ferro","Lobodourado","Ventoforte","Silêncio","Brasa","Marfim"];
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

  function normalizedName(name){
    return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  }
  function classByName(name){ return CLASSES.filter(function(c){ return normalizedName(c.name)===normalizedName(name); })[0]; }
  function powerByName(name){ return POWERS.filter(function(p){ return p.name===name; })[0]; }

  // Calcula tudo que os atributos concedem, do zero -- nunca acumula
  // sozinho, so muda quando o jogador gasta ponto ou sobe de nivel.
  function getDerived(hero){
    var a = hero.attrs;
    var eq = equipmentBonus(hero);
    var maxHp = 20 + hero.level*5 + a.constituicao*10 + eq.vida;
    var maxMp = 10 + hero.level*2 + a.intelecto*5 + eq.mana;
    return {
      maxHp: maxHp, maxMp: maxMp,
      dmgFisico: a.forca*2,
      dmgMagico: a.intelecto*3,
      esquiva: Math.max(0, a.destreza*0.5 + eq.esquiva),
      critico: 5 + a.destreza*0.5,
      velocidade: a.destreza + eq.velocidade,
      curaBonus: a.sabedoria,
      resistMagica: a.sabedoria,
      descontoLoja: a.carisma*0.5
    };
  }

  // Recalcula maxHp/maxMp e ajusta hp/mp atuais pela diferenca (para
  // nao curar/esvaziar sozinho ao subir nivel ou gastar ponto).
  function recomputeDerived(hero){
    var oldMaxHp = hero.maxHp || 0, oldMaxMp = hero.maxMp || 0;
    var d = getDerived(hero);
    hero.derived = d;
    var deltaHp = d.maxHp - oldMaxHp, deltaMp = d.maxMp - oldMaxMp;
    hero.maxHp = d.maxHp; hero.maxMp = d.maxMp;
    hero.hp = clamp((hero.hp||d.maxHp) + Math.max(0,deltaHp), 1, d.maxHp);
    hero.mp = clamp((hero.mp||d.maxMp) + Math.max(0,deltaMp), 0, d.maxMp);
    return d;
  }

  // Gasta 1 ponto de atributo disponivel. Retorna false se nao houver pontos.
  function spendAttrPoint(hero, key){
    if(!hero.attrPoints || hero.attrPoints <= 0) return false;
    if(ATTR_KEYS.indexOf(key) === -1) return false;
    hero.attrs[key] = clamp(hero.attrs[key]+1, 1, 99);
    hero.attrPoints -= 1;
    recomputeDerived(hero);
    return true;
  }

  function buildHero(creation){
    var attrs = rollAttrs(creation.race, creation.cls, creation.debuff);
    var weaponTemplate = RPG.Items.TEMPLATES.filter(function(t){ return t.id===creation.cls.weaponTemplate; })[0];
    var startWeapon = RPG.Items.instantiate(weaponTemplate, RPG.Items.RARITIES[0]);
    startWeapon.equipped = true;

    // poder de assinatura da classe (automatico) + os escolhidos na criacao (sem duplicar)
    var signature = powerByName(creation.cls.signature);
    var powers = signature ? [signature] : [];
    creation.powers.forEach(function(p){ if(p.name !== creation.cls.signature) powers.push(p); });

    var hero = {
      name: creation.name, race: creation.race.name, raceIcon: creation.race.icon,
      className: creation.cls.name, classIcon: creation.cls.icon, attrs: attrs,
      level: 1, xp: 0, xpNext: xpForLevel(1), attrPoints: 0,
      gold: 30 + rnd(21),
      powers: powers, debuff: creation.debuff,
      equip: { arma: startWeapon, armadura: null, acessorio: null },
      killCount: 0
    };
    var d = getDerived(hero);
    hero.derived = d; hero.maxHp = d.maxHp; hero.hp = d.maxHp; hero.maxMp = d.maxMp; hero.mp = d.maxMp;
    return hero;
  }

  function generateCompanion(){
    var race = pick(RACES); var cls = pick(CLASSES);
    var attrs = {};
    ATTR_KEYS.forEach(function(k){ attrs[k] = 6 + rnd(6); });
    Object.keys(race.bonus).forEach(function(k){ attrs[k] += race.bonus[k]; });
    Object.keys(cls.bias).forEach(function(k){ attrs[k] += cls.bias[k]; });
    var maxHp = 18 + attrs.constituicao * 3;
    var classRoles={
      Guerreiro:{ability:'Proteção',desc:'Pode interceptar ataques contra o herói.'},
      Mago:{ability:'Rajada Arcana',desc:'Seus ataques ignoram parte da resistência.'},
      Ladino:{ability:'Ataque Furtivo',desc:'Pode causar um segundo golpe.'},
      'Clérigo':{ability:'Prece Curativa',desc:'Pode recuperar a Vida do herói.'},
      'Bárbaro':{ability:'Fúria',desc:'Causa mais dano quando está ferido.'},
      Arqueiro:{ability:'Tiro Crítico',desc:'Possui chance elevada de dano crítico.'}
    };
    var role=classRoles[cls.name] || {ability:'Ataque',desc:'Ajuda durante o combate.'};
    return { name: pick(FIRST_NAMES)+" "+pick(SURNAMES), raceIcon: race.icon, race: race.name, className: cls.name, classIcon: cls.icon,
      hp: maxHp, maxHp: maxHp, attack: 4 + Math.floor((attrs.forca + attrs.destreza)/3), attrs: attrs,
      stance:'equilibrada', ability:role.ability, abilityDesc:role.desc };
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
    recomputeDerived(hero);
    return true;
  }

  function unequipItem(hero, slot){
    if(hero.equip[slot]){ hero.equip[slot].equipped = false; hero.equip[slot] = null; recomputeDerived(hero); }
  }

  function hasDebuffEffect(hero, effect){
    if(!hero || !hero.debuff) return false;
    if(hero.debuff.effect === effect) return true;
    var legacyEffects = { 'Medo do Fogo':'fireVulnerability', 'Visão Fraca':'rangedPenalty', 'Visao Fraca':'rangedPenalty', 'Teimoso':'fleePenalty' };
    return legacyEffects[hero.debuff.name] === effect;
  }

  // retorna {leveledUp, levels} apos aplicar XP. Nenhum atributo sobe
  // sozinho -- o jogador ganha 2 pontos por nivel para distribuir.
  function gainXP(hero, amount){
    hero.xp += amount;
    var levels = 0;
    while(hero.xp >= hero.xpNext){
      hero.xp -= hero.xpNext;
      hero.level += 1;
      hero.xpNext = xpForLevel(hero.level);
      hero.attrPoints = (hero.attrPoints||0) + 2;
      levels++;
    }
    if(levels>0) recomputeDerived(hero);
    return { leveledUp: levels>0, levels: levels };
  }

  return {
    RACES: RACES, CLASSES: CLASSES, POWERS: POWERS, DEBUFFS: DEBUFFS, MODES: MODES,
    ATTR_KEYS: ATTR_KEYS, ATTR_LABELS: ATTR_LABELS,
    attrMod: attrMod, buildHero: buildHero, generateCompanion: generateCompanion,
    equipmentBonus: equipmentBonus, equipItem: equipItem, unequipItem: unequipItem,
    gainXP: gainXP, xpForLevel: xpForLevel,
    getDerived: getDerived, recomputeDerived: recomputeDerived, spendAttrPoint: spendAttrPoint,
    hasDebuffEffect: hasDebuffEffect,
    classByName: classByName, powerByName: powerByName
  };
})();
