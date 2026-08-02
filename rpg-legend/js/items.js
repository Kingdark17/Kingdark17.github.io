/* =========================================================
   RPG Legend - js/items.js
   Catalogo de itens, sistema de raridade e geracao aleatoria.
   ========================================================= */
var RPG = window.RPG || {};

RPG.Items = (function(){

  // Raridades, da mais comum a mais rara. mult afeta stats e valor.
  var RARITIES = [
    { id:'comum',    label:'Comum',    color:'var(--r-comum)',    mult:1.0, weight:45 },
    { id:'incomum',  label:'Incomum',  color:'var(--r-incomum)',  mult:1.3, weight:28 },
    { id:'raro',     label:'Raro',     color:'var(--r-raro)',     mult:1.7, weight:16 },
    { id:'epico',    label:'Épico',    color:'var(--r-epico)',    mult:2.2, weight:7  },
    { id:'lendario', label:'Lendário', color:'var(--r-lendario)', mult:3.0, weight:3  },
    { id:'mitico',   label:'Mítico',   color:'var(--r-mitico)',   mult:4.0, weight:1  }
  ];

  // Modelos base de item. category: arma | armadura | acessorio | consumivel | material
  var TEMPLATES = [
    { id:'espada', name:'Espada', icon:'\u2694\ufe0f', category:'arma', desc:'Uma lâmina equilibrada para combate corpo a corpo.', base:{ataque:4}, value:22,
      proc:{ chance:0.15, effect:'queimadura', label:'Queimadura', icon:'\ud83d\udd25' } },
    { id:'machado', name:'Machado de Guerra', icon:'\ud83e\ude93', category:'arma', desc:'Pesado e brutal, favorece a força bruta.', base:{ataque:6, velocidade:-1}, value:26,
      proc:{ chance:0.12, effect:'atordoar', label:'Atordoar', icon:'\ud83d\udcab' } },
    { id:'adaga', name:'Adaga Sombria', icon:'\ud83d\udd2a', category:'arma', desc:'Rápida e precisa, ideal para golpes furtivos.', base:{ataque:3, critico:8}, value:20,
      proc:{ chance:0.15, effect:'sangramento', label:'Sangramento', icon:'\ud83e\ude78' } },
    { id:'arco', name:'Arco Longo', icon:'\ud83c\udff9', category:'arma', desc:'Ataques precisos a distância.', base:{ataque:4, esquiva:2, critico:6}, value:24 },
    { id:'cajado', name:'Cajado Arcano', icon:'\ud83e\ude84', category:'arma', desc:'Canaliza energia mágica em combate.', base:{ataque:3, mana:8}, value:24,
      proc:{ chance:0.10, effect:'mana_gratis', label:'Poupanca Arcana', icon:'\ud83d\udd37' } },
    { id:'maca', name:'Maça Sagrada', icon:'\ud83d\udd28', category:'arma', desc:'Abençoada, favorece curandeiros.', base:{ataque:3, vida:6}, value:22,
      proc:{ chance:0.10, effect:'cura_no_acerto', label:'Toque Curativo', icon:'\u2728' } },

    { id:'escudo', name:'Escudo de Carvalho', icon:'\ud83d\udee1\ufe0f', category:'armadura', desc:'Pesado, mas confiável contra golpes diretos.', base:{defesa:5, velocidade:-1}, value:24 },
    { id:'couro', name:'Armadura de Couro Batido', icon:'\ud83e\udd4b', category:'armadura', desc:'Leve o suficiente para não atrapalhar reflexos.', base:{defesa:3, velocidade:1}, value:22 },
    { id:'placas', name:'Armadura de Placas', icon:'\ud83e\udee5', category:'armadura', desc:'Proteção pesada, reduz agilidade.', base:{defesa:7, esquiva:-2}, value:30 },
    { id:'robe', name:'Robe Arcano', icon:'\ud83e\udd7c', category:'armadura', desc:'Tecido enfeitiçado que amplia o poder mágico.', base:{defesa:2, mana:10}, value:26 },

    { id:'anel_som', name:'Anel das Sombras', icon:'\ud83d\udc8d', category:'acessorio', desc:'Sussurra segredos no escuro.', base:{critico:5, esquiva:2}, value:20 },
    { id:'amuleto_sab', name:'Amuleto da Sabedoria', icon:'\ud83d\udccf', category:'acessorio', desc:'Pertenceu a um oráculo esquecido.', base:{mana:6, vida:4}, value:20 },
    { id:'bota_vento', name:'Botas do Vento', icon:'\ud83d\udc62', category:'acessorio', desc:'Passos leves como brisa de outono.', base:{velocidade:3, esquiva:1}, value:18 },
    { id:'colar_forca', name:'Colar da Força Ancestral', icon:'\ud83d\udcff', category:'acessorio', desc:'Pulsa com poder antigo.', base:{ataque:2, vida:8}, value:22 },

    { id:'pot_vida', name:'Poção de Vida', icon:'\ud83e\uddea', category:'consumivel', desc:'Restaura uma quantidade de vida ao ser bebida.', base:{cura:22}, value:14 },
    { id:'pot_mana', name:'Poção de Mana', icon:'\ud83e\uddec', category:'consumivel', desc:'Restaura uma quantidade de mana.', base:{curaMana:16}, value:14 },
    { id:'pergaminho', name:'Pergaminho Selado', icon:'\ud83d\udcdc', category:'consumivel', desc:'Contém um feitiço de propósito desconhecido.', base:{cura:10, curaMana:10}, value:16 },

    { id:'minerio', name:'Minério Bruto', icon:'\u26cf\ufe0f', category:'material', desc:'Pode ser vendido a um ferreiro.', base:{}, value:10 },
    { id:'essencia', name:'Essência Arcana', icon:'\u2728', category:'material', desc:'Resíduo de magia cristalizado.', base:{}, value:14 },
    { id:'catalisador_mitico', name:'Catalisador Mítico', icon:'\ud83d\udca0', category:'material', desc:'Catalisador raro que aumenta muito a chance de elevar o tier na reforja.', base:{}, value:80 },
    { id:'pedra_protecao', name:'Pedra de Proteção', icon:'\ud83d\udee1\ufe0f', category:'material', desc:'Protege o equipamento: uma reforja feita com ela nunca reduz o tier.', base:{}, value:55 },
    { id:'couro_bruto', name:'Couro de Fera', icon:'\ud83e\uddb4', category:'material', desc:'Material usado em armaduras leves.', base:{}, value:10 }
  ];

  var CATEGORY_LABELS = { arma:'Arma', armadura:'Armadura', acessorio:'Acessório', consumivel:'Consumível', material:'Material', missao:'Missão' };

  function rnd(n){ return Math.floor(Math.random()*n); }

  function pickRarity(luckFloor){
    // andares mais profundos empurram a sorte para raridades melhores
    var bonus = Math.min(20, (luckFloor||0) * 1.2);
    var pool = [];
    RARITIES.forEach(function(r, idx){
      var w = r.weight + (idx>=2 ? bonus/RARITIES.length : 0);
      for(var i=0;i<Math.ceil(w);i++){ pool.push(r); }
    });
    return pool[rnd(pool.length)];
  }

  function pickTemplate(category){
    var pool = category ? TEMPLATES.filter(function(t){ return t.category===category; }) : TEMPLATES;
    return pool[rnd(pool.length)];
  }

  // Gera uma instancia de item a partir de um template + raridade, com stats escalados.
  function instantiate(template, rarity){
    var stats = {};
    Object.keys(template.base).forEach(function(k){
      var v = template.base[k];
      stats[k] = Math.round(v * rarity.mult);
    });
    var value = Math.round(template.value * rarity.mult);
    var namePrefix = rarity.id==='comum' ? '' : (rarity.label + ' ');
    var proc = null;
    if(template.proc){
      proc = {
        effect: template.proc.effect, label: template.proc.label, icon: template.proc.icon,
        chance: Math.min(0.5, template.proc.chance + (rarity.mult-1)*0.05)
      };
    }
    return {
      uid: template.id + '_' + Date.now() + '_' + rnd(99999),
      templateId: template.id,
      name: namePrefix + template.name,
      icon: template.icon,
      category: template.category,
      desc: template.desc,
      rarity: rarity.id,
      rarityLabel: rarity.label,
      rarityColor: rarity.color,
      stats: stats,
      proc: proc,
      value: value,
      equipped: false
    };
  }

  function randomItem(opts){
    opts = opts || {};
    var template = opts.category ? pickTemplate(opts.category) : pickTemplate();
    var rarity = opts.rarity ? RARITIES.filter(function(r){return r.id===opts.rarity;})[0] : pickRarity(opts.floor);
    var item=instantiate(template, rarity || RARITIES[0]);
    var floor=Math.max(1,opts.floor||1);
    if(['arma','armadura','acessorio'].indexOf(item.category)>=0 && floor>1){
      var depthMult=1+Math.min(.75,(floor-1)*.015);
      Object.keys(item.stats).forEach(function(key){if(item.stats[key]>0)item.stats[key]=Math.max(1,Math.round(item.stats[key]*depthMult));});
      item.foundFloor=floor;
    }
    return item;
  }

  function statTags(item){
    var LABELS = { ataque:'Ataque', defesa:'Defesa', vida:'Vida', mana:'Mana', critico:'Crítico', velocidade:'Velocidade', esquiva:'Esquiva', cura:'Cura', curaMana:'Restaura Mana' };
    var tags = [];
    Object.keys(item.stats).forEach(function(k){
      var v = item.stats[k];
      if(!v) return;
      var label = LABELS[k] || k;
      var sign = v>0 ? '+' : '';
      tags.push({ text: sign+v+' '+label, positive: v>0 });
    });
    return tags;
  }

  var TIER_ORDER = ['E','D','C','B','A','S','SS','SSS','SSS+','MAX'];
  var TIER_MIN = [0,25,40,60,85,115,145,175,210,250];
  function powerScore(item){
    if(!item || ['arma','armadura','acessorio'].indexOf(item.category)<0) return 0;
    var rarityIndex=Math.max(0,RARITIES.map(function(r){return r.id;}).indexOf(item.rarity));
    var rarityBase=[10,25,40,58,78,95][rarityIndex]||10;
    var weights={ataque:4,defesa:4,vida:.2,mana:.2,critico:1,velocidade:3,esquiva:2};
    var score=rarityBase;
    Object.keys(item.stats||{}).forEach(function(key){score+=Math.max(0,item.stats[key]||0)*(weights[key]||.5);});
    if(item.proc)score+=(item.proc.chance||0)*30;
    return Math.round(score+(Number(item.tierAdjustment)||0));
  }
  function tierFromScore(score){
    for(var i=TIER_MIN.length-1;i>=0;i--){if(score>=TIER_MIN[i])return TIER_ORDER[i];}
    return 'E';
  }
  function tierFor(item){
    if(!item || ['arma','armadura','acessorio'].indexOf(item.category)<0)return null;
    return tierFromScore(powerScore(item));
  }
  function tierRank(item){var tier=typeof item==='string'?item:tierFor(item);return TIER_ORDER.indexOf(tier);}
  function tierClass(tier){return 'tier-'+String(tier||'').toLowerCase().replace('+','-plus');}
  function tierInfo(item){
    var score=powerScore(item),rank=tierRank(item),min=TIER_MIN[Math.max(0,rank)],next=rank<TIER_ORDER.length-1?TIER_MIN[rank+1]:null;
    return {score:score,tier:TIER_ORDER[rank],rank:rank,min:min,next:next,progress:next===null?100:Math.max(0,Math.min(100,Math.round((score-min)/(next-min)*100)))};
  }
  function reforge(item,delta){
    var oldRank=tierRank(item),target=Math.max(0,Math.min(TIER_ORDER.length-1,oldRank+delta));
    if(target===oldRank)return {oldTier:TIER_ORDER[oldRank],newTier:TIER_ORDER[target],oldRank:oldRank,newRank:target};
    var oldScore=Math.max(1,powerScore(item)),nextMin=TIER_MIN[target],nextMax=target<TIER_ORDER.length-1?TIER_MIN[target+1]-1:300;
    var desired=Math.round((nextMin+nextMax)/2),factor=Math.max(.55,Math.min(1.8,desired/oldScore));
    Object.keys(item.stats||{}).forEach(function(key){var value=item.stats[key];if(value>0)item.stats[key]=Math.max(1,Math.round(value*factor));});
    if(item.proc)item.proc.chance=Math.max(.05,Math.min(.65,item.proc.chance+(target-oldRank)*.015));
    item.tierAdjustment=0;
    item.tierAdjustment=desired-powerScore(item);
    item.value=Math.max(1,Math.round(item.value*(1+(target-oldRank)*.16)));
    item.reforgeCount=(item.reforgeCount||0)+1;
    return {oldTier:TIER_ORDER[oldRank],newTier:TIER_ORDER[target],oldRank:oldRank,newRank:target};
  }
  function heroEquipmentSnapshot(hero){
    var derived=RPG.Player.getDerived(hero),bonus=RPG.Player.equipmentBonus(hero),weapon=hero.equip&&hero.equip.arma;
    var affinity=100,cls=RPG.Player.classByName(hero.className);
    if(weapon&&cls&&cls.affinity&&cls.affinity[weapon.templateId]!=null)affinity=cls.affinity[weapon.templateId];
    var weaponAtk=weapon?Math.round((weapon.stats.ataque||0)*affinity/100):0;
    var otherAtk=(bonus.ataque||0)-(weapon&&weapon.stats.ataque||0);
    return {vida:derived.maxHp,mana:derived.maxMp,danoFisico:derived.dmgFisico+weaponAtk+otherAtk,danoMagico:derived.dmgMagico,defesa:bonus.defesa||0,critico:derived.critico+(bonus.critico||0),esquiva:derived.esquiva,velocidade:derived.velocidade};
  }
  function equipmentImpact(hero,item){
    if(!hero||!item||['arma','armadura','acessorio'].indexOf(item.category)<0)return [];
    var before=heroEquipmentSnapshot(hero),preview={className:hero.className,level:hero.level,attrs:hero.attrs,debuff:hero.debuff,equip:{arma:hero.equip.arma,armadura:hero.equip.armadura,acessorio:hero.equip.acessorio}};
    preview.equip[item.category]=item;
    var after=heroEquipmentSnapshot(preview),labels={vida:'Vida máxima',mana:'Mana máxima',danoFisico:'Dano físico',danoMagico:'Dano mágico',defesa:'Defesa',critico:'Crítico',esquiva:'Esquiva',velocidade:'Velocidade'};
    return Object.keys(labels).map(function(key){var oldValue=Math.round(before[key]*10)/10,newValue=Math.round(after[key]*10)/10;return {key:key,label:labels[key],before:oldValue,after:newValue,diff:Math.round((newValue-oldValue)*10)/10};});
  }

  return {
    RARITIES: RARITIES,
    TEMPLATES: TEMPLATES,
    CATEGORY_LABELS: CATEGORY_LABELS,
    pickRarity: pickRarity,
    pickTemplate: pickTemplate,
    instantiate: instantiate,
    randomItem: randomItem,
    statTags: statTags,
    TIER_ORDER: TIER_ORDER,
    powerScore: powerScore,
    tierFromScore: tierFromScore,
    tierFor: tierFor,
    tierRank: tierRank,
    tierClass: tierClass,
    tierInfo: tierInfo,
    reforge: reforge,
    equipmentImpact: equipmentImpact
  };
})();
