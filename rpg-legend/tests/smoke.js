const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const elements = {};
const context = {
  console,
  Math,
  Date,
  setTimeout,
  clearTimeout,
  localStorage: {
    data: {},
    getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; },
    setItem(key, value) { this.data[key] = String(value); },
    removeItem(key) { delete this.data[key]; }
  },
  window: null,
  document: {
    getElementById(id) {
      if (!elements[id]) elements[id] = { textContent: '', innerHTML: '', style: {}, classList: { add(){}, remove(){}, toggle(){} } };
      return elements[id];
    }
  }
};
context.window = context;
vm.createContext(context);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

['js/items.js', 'js/monsters.js', 'js/player.js', 'js/map.js', 'js/events.js', 'js/npc-services.js', 'js/dungeon.js', 'js/save.js'].forEach(load);
const RPG = context.RPG;
assert(RPG.Player.RACES.length >= 12, 'novas racas nao foram carregadas');
assert(RPG.Player.CLASSES.length >= 12, 'novas classes nao foram carregadas');
assert(RPG.Player.POWERS.some(power => power.status === 'veneno'), 'poder de veneno ausente');
assert(RPG.Player.POWERS.some(power => power.status === 'vulneravel'), 'poder de vulnerabilidade ausente');
assert.strictEqual(RPG.Player.MODES.some(mode => mode.id === 'equipe'), false, 'criacao automatica de equipe ainda disponivel');
RPG.UI = { setLegend(){}, logEvent(){}, renderHero(){}, renderMap(){}, renderControls(){}, resetPlayerToStart(){}, showSimpleDialogue(){}, enterCity(){} };
RPG.Quests = { onFloorReached(){}, onItemCollected(){} };

const savedState = { hero:{ name:'Teste' }, party:[], inventory:[], quests:[], floor:7, mapMode:'dungeon', map:[[{ type:'empty', visited:true }]], mapRows:1, mapCols:1, pos:{ r:0, c:0 }, soundOn:true };
assert(RPG.Save.save(savedState), 'falha ao salvar');
const loadedState = RPG.Save.load();
assert.deepStrictEqual(JSON.parse(JSON.stringify(loadedState.map)), savedState.map, 'mapa não foi preservado no save');
assert.deepStrictEqual(JSON.parse(JSON.stringify(loadedState.pos)), savedState.pos, 'posição não foi preservada no save');

const hero = {
  level: 1,
  attrs: { forca:10, destreza:10, constituicao:10, intelecto:10, sabedoria:10, carisma:10 },
  equip: { arma:null, armadura:null, acessorio:null }
};
let derived = RPG.Player.getDerived(hero);
const baseHp = derived.maxHp;
const baseMp = derived.maxMp;
const amuletTemplate = RPG.Items.TEMPLATES.filter(t => t.id === 'amuleto_sab')[0];
const amulet = RPG.Items.instantiate(amuletTemplate, RPG.Items.RARITIES[0]);
hero.maxHp = baseHp; hero.hp = baseHp; hero.maxMp = baseMp; hero.mp = baseMp;
RPG.Player.equipItem(hero, amulet);
assert.strictEqual(hero.maxHp, baseHp + 4, 'bonus de vida do equipamento');
assert.strictEqual(hero.maxMp, baseMp + 6, 'bonus de mana do equipamento');

for (let floor = 1; floor <= 100; floor++) {
  const state = { floor, mapRows:6, mapCols:6 };
  RPG.Dungeon.generate(state);
  const rooms = state.map.flat();
  const stairs = rooms.find(c => c.type === 'stairs');
  const exit = rooms.find(c => c.type === 'exit');
  assert(stairs, `andar ${floor} sem escada`);
  assert(exit, `andar ${floor} sem saida`);
  const start = rooms.find(c => c.type === 'start');
  const distances = RPG.MapUtil.distancesFrom(state.map, start, state.mapCols, state.mapRows);
  assert(distances[stairs.x+','+stairs.y] >= 4, `andar ${floor} com escada perto pelo caminho`);
  assert(distances[exit.x+','+exit.y] >= 4, `andar ${floor} com saida perto pelo caminho`);
  assert(Math.abs(stairs.x-start.x)+Math.abs(stairs.y-start.y) >= 3, `andar ${floor} com escada colada visualmente ao inicio`);
  assert(Math.abs(exit.x-start.x)+Math.abs(exit.y-start.y) >= 3, `andar ${floor} com saida colada visualmente ao inicio`);
  assert(rooms.some(c => c.type === 'event'), `andar ${floor} sem evento`);
  if (floor % 5 === 0) assert(rooms.some(c => c.type === 'boss'), `andar ${floor} sem chefe`);
}

const companion = RPG.Player.generateCompanion();
assert(companion.attack > 0 && companion.hp > 0, 'companheiro sem atributos de combate');
assert(RPG.Player.classByName('Clerigo').name === 'Clérigo', 'save antigo da classe Clerigo incompatível');
assert(RPG.Player.classByName('Barbaro').name === 'Bárbaro', 'save antigo da classe Barbaro incompatível');
assert(RPG.Items.TEMPLATES.some(item => item.id === 'minerio'), 'identificador interno de minério foi alterado');
RPG.Items.RARITIES.forEach(rarity => assert(!/[áéíóú]/i.test(rarity.color), 'variável CSS de raridade alterada'));
const axeTemplate = RPG.Items.TEMPLATES.find(item => item.id === 'machado');
const axeTiers = RPG.Items.RARITIES.map(rarity => RPG.Items.tierRank(RPG.Items.instantiate(axeTemplate, rarity)));
axeTiers.forEach((rank,index) => { if(index) assert(rank >= axeTiers[index-1], 'tier diminuiu com raridade maior'); });
assert.strictEqual(RPG.Items.tierFor(RPG.Items.instantiate(axeTemplate, RPG.Items.RARITIES[5])), 'SSS', 'equipamento máximo sem tier SSS');
assert.deepStrictEqual(Array.from(RPG.Items.TIER_ORDER), ['E','D','C','B','A','S','SS','SSS','SSS+','MAX'], 'ordem dos dez tiers incorreta');
const reforgedAxe = RPG.Items.instantiate(axeTemplate, RPG.Items.RARITIES[0]);
const initialTierRank = RPG.Items.tierRank(reforgedAxe);
const reforgedResult = RPG.Items.reforge(reforgedAxe, 2);
assert.strictEqual(reforgedResult.newRank, initialTierRank + 2, 'reforja nao avancou dois tiers');
assert.strictEqual(RPG.Items.tierRank(reforgedAxe), initialTierRank + 2, 'tier reforjado nao persistiu no item');
assert.strictEqual(RPG.Items.tierClass('SSS+'), 'tier-sss-plus', 'classe visual do tier SSS+ invalida');
RPG.Monsters.SPECIES.forEach(monster => {
  assert(monster.ability && monster.weakness && monster.resistance, `criatura sem identidade: ${monster.name}`);
});
['heal','blessing','barter','reveal','recruit'].forEach(service => assert(RPG.NPCServices.info(service), `serviço de NPC ausente: ${service}`));
console.log('Smoke tests: OK (equipamentos, equipe, NPCs, criaturas, eventos e andares 1-100)');
