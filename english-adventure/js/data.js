/* ===== DATA: vocabulary, items, quests, levels, places ===== */
const EA = window.EA = {};

EA.CATS = ['BODY PARTS','CLOTHES','ANIMALS','FOOD','COLORS','CITY','ACTIONS','CONVERSATION'];

/* ---------- Vocabulary ---------- */
EA.VOCAB = [];
EA.WORD = {};
(function(){
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  const add = (cat, list) => list.forEach(([en, pt]) => {
    const w = {id: slug(en), en, pt, cat};
    EA.VOCAB.push(w); EA.WORD[w.id] = w;
  });
  add('BODY PARTS', [['Head','cabeça'],['Hair','cabelo'],['Eyes','olhos'],['Ears','orelhas'],['Nose','nariz'],['Mouth','boca'],['Neck','pescoço'],['Shoulders','ombros'],['Arms','braços'],['Hands','mãos'],['Fingers','dedos das mãos'],['Legs','pernas'],['Knees','joelhos'],['Feet','pés'],['Toes','dedos dos pés']]);
  add('CLOTHES', [['T-shirt','camiseta'],['Shirt','camisa'],['Pants','calça'],['Shorts','short'],['Dress','vestido'],['Shoes','sapatos'],['Sneakers','tênis'],['Jacket','jaqueta'],['Hat','chapéu'],['Glasses','óculos'],['Scarf','cachecol']]);
  add('ANIMALS', [['Dog','cachorro'],['Cat','gato'],['Pet','animal de estimação'],['Bird','pássaro'],['Fish','peixe'],['Rabbit','coelho'],['Bone','osso'],['Toy','brinquedo'],['Ball','bola']]);
  add('FOOD', [['Apple','maçã'],['Banana','banana'],['Bread','pão'],['Milk','leite'],['Water','água'],['Sandwich','sanduíche'],['Juice','suco'],['Cheese','queijo'],['Egg','ovo'],['Carrot','cenoura'],['Tomato','tomate'],['Soup','sopa'],['Cake','bolo']]);
  add('COLORS', [['Red','vermelho'],['Blue','azul'],['Green','verde'],['Yellow','amarelo'],['Black','preto'],['White','branco'],['Pink','rosa'],['Purple','roxo'],['Orange','laranja'],['Brown','marrom']]);
  add('CITY', [['School','escola'],['House','casa'],['Park','parque'],['Shop','loja'],['Restaurant','restaurante'],['Supermarket','supermercado'],['Street','rua'],['Map','mapa'],['Fountain','fonte'],['Bench','banco (de sentar)'],['Tree','árvore'],['Flower','flor'],['Soap','sabonete'],['Toothpaste','pasta de dente']]);
  add('ACTIONS', [['Walk','andar'],['Run','correr'],['Eat','comer'],['Drink','beber'],['Play','brincar'],['Buy','comprar'],['Open','abrir'],['Listen','ouvir'],['Look','olhar'],['Help','ajudar'],['Sleep','dormir'],['Put on','vestir']]);
  add('CONVERSATION', [['Hello','olá'],['Goodbye','tchau'],['Please','por favor'],['Thank you','obrigado(a)'],['Sorry','desculpe'],['Yes','sim'],['No','não'],['How are you?','Como você está?'],["I'm fine",'Estou bem'],['My name is...','Meu nome é...'],["I'm hungry",'Estou com fome'],['How much is it?','Quanto custa?'],['Excuse me','Com licença'],['Nice to meet you','Prazer em conhecer você'],['Where is the school?','Onde fica a escola?']]);
})();
EA.wordId = s => EA.VOCAB.find(w => w.en.toLowerCase() === s.toLowerCase())?.id;

/* ---------- Colors ---------- */
EA.COLOR = {
  red:'#e74c3c', blue:'#3b82f6', green:'#2ecc71', yellow:'#f7d44c', black:'#2d2d34',
  white:'#f4f4f4', pink:'#ff8fc7', purple:'#9b59b6', orange:'#f39c12', brown:'#8d5a2b'
};
EA.SKINS = ['#ffdbb4','#f1c27d','#e0a370','#c68642','#8d5524','#5c3a21'];
EA.HAIRCOLORS = ['#2b1d12','#6b3f1d','#c98a3c','#f2d16b','#d9442c','#e86fa8','#4a7bd0','#d8d8d8'];
EA.HAIRSTYLES = ['short','long','curly','ponytail','spiky','buzz'];

/* ---------- Items ---------- */
EA.ITEMS = {};
(function(){
  const I = EA.ITEMS;
  const cl = (id, slot, color, en, pt, price, emoji, extra) => {
    I[id] = Object.assign({id, cat: slot==='acc' ? 'acc' : 'clothes', slot, color, name: en, pt, price, icon: emoji,
      desc: 'A piece of clothing for your character.'}, extra||{});
  };
  // tops
  cl('tshirt_white','top','white','White T-shirt','Camiseta branca',0,'👕',{start:true,word:'t_shirt'});
  cl('tshirt_red','top','red','Red T-shirt','Camiseta vermelha',25,'👕',{word:'t_shirt'});
  cl('tshirt_green','top','green','Green T-shirt','Camiseta verde',25,'👕',{word:'t_shirt'});
  cl('tshirt_yellow','top','yellow','Yellow T-shirt','Camiseta amarela',25,'👕',{word:'t_shirt'});
  cl('shirt_blue','top','blue','Blue shirt','Camisa azul',0,'👔',{start:true,word:'shirt'});
  cl('shirt_red','top','red','Red shirt','Camisa vermelha',30,'👔',{word:'shirt'});
  cl('shirt_black','top','black','Black shirt','Camisa preta',40,'👔',{word:'shirt'});
  cl('shirt_pink','top','pink','Pink shirt','Camisa rosa',30,'👔',{word:'shirt'});
  // bottoms
  cl('pants_blue','bottom','blue','Blue pants','Calça azul',0,'👖',{start:true,word:'pants'});
  cl('pants_black','bottom','black','Black pants','Calça preta',35,'👖',{word:'pants'});
  cl('pants_brown','bottom','brown','Brown pants','Calça marrom',35,'👖',{word:'pants'});
  cl('shorts_red','bottom','red','Red shorts','Short vermelho',25,'🩳',{word:'shorts'});
  cl('shorts_green','bottom','green','Green shorts','Short verde',25,'🩳',{word:'shorts'});
  cl('shorts_white','bottom','white','White shorts','Short branco',25,'🩳',{word:'shorts'});
  // dresses
  cl('dress_pink','dress','pink','Pink dress','Vestido rosa',50,'👗',{word:'dress'});
  cl('dress_yellow','dress','yellow','Yellow dress','Vestido amarelo',50,'👗',{word:'dress'});
  cl('dress_purple','dress','purple','Purple dress','Vestido roxo',55,'👗',{word:'dress'});
  // shoes
  cl('shoes_brown','shoes','brown','Brown shoes','Sapatos marrons',0,'👞',{start:true,word:'shoes'});
  cl('shoes_black','shoes','black','Black shoes','Sapatos pretos',30,'👞',{word:'shoes'});
  cl('sneakers_white','shoes','white','White sneakers','Tênis branco',40,'👟',{word:'sneakers'});
  cl('sneakers_red','shoes','red','Red sneakers','Tênis vermelho',45,'👟',{word:'sneakers'});
  // jackets
  cl('jacket_green','jacket','green','Green jacket','Jaqueta verde',60,'🧥',{word:'jacket'});
  cl('jacket_red','jacket','red','Red jacket','Jaqueta vermelha',60,'🧥',{word:'jacket'});
  cl('jacket_black','jacket','black','Black jacket','Jaqueta preta',65,'🧥',{word:'jacket'});
  cl('jacket_denim','jacket','blue','Denim jacket','Jaqueta jeans',0,'🧥',{word:'jacket',lock:3,desc:'Reward for reaching Level 3.'});
  // hats
  cl('hat_red','hat','red','Red hat','Chapéu vermelho',25,'🎩',{word:'hat'});
  cl('hat_blue','hat','blue','Blue hat','Chapéu azul',25,'🧢',{word:'hat'});
  cl('hat_black','hat','black','Black hat','Chapéu preto',30,'🎩',{word:'hat'});
  cl('hat_yellow','hat','yellow','Yellow straw hat','Chapéu de palha amarelo',30,'👒',{word:'hat'});
  cl('hat_crown','hat','yellow','Golden crown','Coroa dourada',0,'👑',{lock:4,desc:'Reward for reaching Level 4.'});
  // glasses
  cl('glasses_black','glasses','black','Black glasses','Óculos preto',20,'👓',{word:'glasses'});
  cl('glasses_red','glasses','red','Red glasses','Óculos vermelho',20,'👓',{word:'glasses'});
  cl('sunglasses','glasses','black','Sunglasses','Óculos de sol',0,'🕶️',{lock:2,desc:'Reward for reaching Level 2.'});
  // accessories
  cl('scarf_red','acc','red','Red scarf','Cachecol vermelho',20,'🧣',{word:'scarf'});
  cl('scarf_blue','acc','blue','Blue scarf','Cachecol azul',20,'🧣',{word:'scarf'});
  cl('medal_gold','acc','yellow','Gold medal','Medalha de ouro',0,'🏅',{lock:5,desc:'Reward for reaching Level 5.'});

  const ob = (id, cat, name, pt, price, icon, desc, extra) => { I[id] = Object.assign({id, cat, name, pt, price, icon, desc}, extra||{}); };
  // pet food & toys
  ob('dogfood','food','Dog bone','Osso de cachorro',8,'🦴','Yummy food for a dog.',{pet:'dog',word:'bone'});
  ob('catfood','food','Cat fish','Peixe para gato',8,'🐟','Yummy food for a cat.',{pet:'cat',word:'fish'});
  ob('ball','toy','Ball','Bola',0,'🎾','A ball to play with your pet.',{start:true,word:'ball'});
  ob('mouse_toy','toy','Toy mouse','Ratinho de brinquedo',15,'🐭','A little toy mouse.',{});
  ob('rope_toy','toy','Rope toy','Brinquedo de corda',12,'🪢','A strong rope toy.',{});
  ob('collar_red','petacc','Red collar','Coleira vermelha',18,'🔴','A collar for your pet.',{});
  ob('collar_blue','petacc','Blue collar','Coleira azul',18,'🔵','A collar for your pet.',{});
  ob('pet_bow','petacc','Pink bow','Laço rosa',18,'🎀','A pretty bow for your pet.',{});
  // human food
  ob('apple','food','Apple','Maçã',3,'🍎','A red, crunchy fruit.',{word:'apple',human:true});
  ob('banana','food','Banana','Banana',3,'🍌','A long, yellow fruit.',{word:'banana',human:true});
  ob('bread','food','Bread','Pão',4,'🍞','Fresh bread.',{word:'bread',human:true});
  ob('milk','food','Milk','Leite',4,'🥛','A glass of milk.',{word:'milk',human:true});
  ob('juice','food','Juice','Suco',5,'🧃','Orange juice.',{word:'juice',human:true});
  ob('carrot','food','Carrot','Cenoura',3,'🥕','An orange vegetable.',{word:'carrot',human:true});
  ob('tomato','food','Tomato','Tomate',3,'🍅','A red vegetable.',{word:'tomato',human:true});
  ob('cheese','food','Cheese','Queijo',5,'🧀','A piece of cheese.',{word:'cheese',human:true});
  ob('sandwich','food','Sandwich','Sanduíche',0,'🥪','A tasty sandwich.',{word:'sandwich',human:true});
  // objects (everyday)
  ob('soap','object','Soap','Sabonete',4,'🧼','Soap to wash your hands.',{word:'soap'});
  ob('toothpaste','object','Toothpaste','Pasta de dente',5,'🪥','For clean teeth.',{word:'toothpaste'});
  ob('map_item','object','Town map','Mapa da cidade',0,'🗺️','A map of English Town.',{start:true,word:'map'});
  // rewards
  ob('star_gold','reward','Gold star','Estrela dourada',0,'⭐','A shiny reward.',{});
  ob('badge_explorer','reward','Explorer badge','Distintivo de explorador',0,'🎖️','You explored the town!',{});
  ob('badge_pet','reward','Pet lover badge','Distintivo amigo dos animais',0,'🐾','You love animals!',{});
  ob('trophy','reward','Master trophy','Troféu do mestre',0,'🏆','You are an English Master!',{});
})();

/* ---------- Levels ---------- */
EA.LEVELS = [
  {lv:1, name:'Beginner',      xp:0,   rew:null},
  {lv:2, name:'Explorer',      xp:100, rew:{coins:50, items:['sunglasses'], text:'New places unlocked: Restaurant & Supermarket!'}},
  {lv:3, name:'Learner',       xp:250, rew:{coins:40, items:['jacket_denim']}},
  {lv:4, name:'Adventurer',    xp:450, rew:{coins:60, items:['hat_crown']}},
  {lv:5, name:'English Master',xp:700, rew:{coins:150, items:['medal_gold','trophy']}}
];
EA.levelFor = xp => { let L = EA.LEVELS[0]; for (const l of EA.LEVELS) if (xp >= l.xp) L = l; return L; };

/* ---------- Places ---------- */
EA.PLACES = {
  home:       {name:'Home',          pt:'Casa',            icon:'🏠', reqLevel:1},
  school:     {name:'School',        pt:'Escola',          icon:'🏫', reqLevel:1},
  clothes:    {name:'Clothes Shop',  pt:'Loja de roupas',  icon:'👕', reqLevel:1},
  petshop:    {name:'Pet Shop',      pt:'Pet shop',        icon:'🐶', reqLevel:1},
  restaurant: {name:'Restaurant',    pt:'Restaurante',     icon:'🍽️', reqLevel:2},
  supermarket:{name:'Supermarket',   pt:'Supermercado',    icon:'🛒', reqLevel:2},
  park:       {name:'Park',          pt:'Parque',          icon:'🌳', reqLevel:1}
};

/* ---------- Quests ---------- */
EA.QUESTS = [
  // main
  {id:'m1', main:true, name:'Welcome to English Town!', pt:'Bem-vindo a English Town!', desc:'Explore the town. Visit three different places.', goal:'Visit 3 places', ev:'discover', n:3, giver:'Grandma Rose', rew:{xp:30, coins:20}},
  {id:'m2', main:true, name:'Meet your neighbor!', pt:'Conheça sua vizinha!', desc:'Say hello to Lily, your neighbor.', goal:'Talk to Lily', ev:'talk', arg:'lily', n:1, giver:'Grandma Rose', rew:{xp:25, coins:15}},
  {id:'m3', main:true, name:'Find the red shirt!', pt:'Encontre a camisa vermelha!', desc:'Go to the Clothes Shop and get the red shirt.', goal:'Get the Red shirt', ev:'own', arg:'shirt_red', n:1, giver:'Clara', rew:{xp:30, coins:15}},
  {id:'m4', main:true, name:'Adopt a pet!', pt:'Adote um animal!', desc:'Visit the Pet Shop and adopt a dog or a cat.', goal:'Adopt a pet', ev:'adopt', n:1, giver:'Dr. Paws', rew:{xp:40, coins:20, items:{dogfood:2, catfood:2}}},
  {id:'m5', main:true, name:'Take your pet to the park!', pt:'Leve seu animal ao parque!', desc:'Walk to the Park with your pet following you.', goal:'Go to the Park with your pet', ev:'petpark', n:1, giver:'Dr. Paws', rew:{xp:40, coins:25}},
  {id:'m6', main:true, name:'Find the school!', pt:'Encontre a escola!', desc:'Look for the School in English Town.', goal:'Find the School', ev:'place', arg:'school', n:1, giver:'Lily', rew:{xp:20, coins:10}},
  {id:'m7', main:true, name:'Order a sandwich!', pt:'Peça um sanduíche!', desc:'Order a sandwich at the Restaurant (Level 2).', goal:'Order a sandwich', ev:'order_sandwich', n:1, giver:'Waiter Rosa', rew:{xp:40, coins:10}},
  {id:'m8', main:true, name:'Complete the Body Challenge!', pt:'Complete o desafio das partes do corpo!', desc:'Talk to Ms. Green at school and finish the Body Challenge.', goal:'Finish the Body Challenge', ev:'body_done', n:1, giver:'Ms. Green', rew:{xp:50, coins:30}},
  {id:'m9', main:true, name:'English Master!', pt:'Mestre de inglês!', desc:'Finish every main quest to become a true English Master.', goal:'Finish all main quests', ev:'__main', n:1, giver:'Grandma Rose', rew:{xp:100, coins:100, items:{trophy:1, badge_explorer:1}}},
  // side
  {id:'s1', main:false, name:'Feed your pet!', pt:'Alimente seu animal!', desc:'Give food to your pet.', goal:'Feed your pet', ev:'feed', n:1, giver:'Dr. Paws', rew:{xp:20, coins:10}},
  {id:'s2', main:false, name:'Put on the blue shirt!', pt:'Vista a camisa azul!', desc:'Open the wardrobe and put on the blue shirt.', goal:'Wear the Blue shirt', ev:'wear', arg:'shirt_blue', n:1, giver:'Grandma Rose', rew:{xp:15, coins:5}},
  {id:'s3', main:false, name:'Find a pair of black shoes!', pt:'Encontre sapatos pretos!', desc:'Buy black shoes at the Clothes Shop.', goal:'Get Black shoes', ev:'own', arg:'shoes_black', n:1, giver:'Clara', rew:{xp:20, coins:10}},
  {id:'s4', main:false, name:'Word Hunt champion', pt:'Campeão da caça às palavras', desc:'Talk to Tom in the park and finish the Word Hunt.', goal:'Finish the Word Hunt', ev:'hunt_done', n:1, giver:'Tom', rew:{xp:40, coins:20}},
  {id:'s5', main:false, name:'Quiz time!', pt:'Hora do quiz!', desc:'Play the English Quiz with Ms. Green.', goal:'Finish the English Quiz', ev:'quiz_done', n:1, giver:'Ms. Green', rew:{xp:30, coins:15}},
  {id:'s6', main:false, name:"Let's chat!", pt:'Vamos conversar!', desc:'Play the Conversation Challenge with Anna.', goal:'Finish the Conversation Challenge', ev:'conv_done', n:1, giver:'Anna', rew:{xp:30, coins:15}},
  {id:'s7', main:false, name:'Dress up star', pt:'Estrela da moda', desc:'Play Dress Up with Clara at the Clothes Shop.', goal:'Finish Dress Up', ev:'dress_done', n:1, giver:'Clara', rew:{xp:30, coins:15}},
  {id:'s8', main:false, name:'Super shopper', pt:'Super comprador', desc:'Help Mr. Fresh: find the products at the Supermarket (Level 2).', goal:'Finish the shopping list', ev:'shop_done', n:1, giver:'Mr. Fresh', rew:{xp:30, coins:15}},
  {id:'s9', main:false, name:'Pet carer', pt:'Cuidador de animais', desc:'Play Pet Care with Dr. Paws.', goal:'Finish Pet Care', ev:'petcare_done', n:1, giver:'Dr. Paws', rew:{xp:30, coins:15, items:{badge_pet:1}}},
  {id:'s10', main:false, name:'Word collector', pt:'Colecionador de palavras', desc:'Learn 25 different English words.', goal:'Learn 25 words', ev:'learn', n:25, giver:'Ms. Green', rew:{xp:40, coins:25}},
  {id:'s11', main:false, name:'Take a walk!', pt:'Dê um passeio!', desc:'Take your pet for a walk (open My Pet and press Walk).', goal:'Walk with your pet', ev:'walk', n:1, giver:'Ben', rew:{xp:20, coins:10}}
];
EA.QUEST = {}; EA.QUESTS.forEach(q => EA.QUEST[q.id] = q);
