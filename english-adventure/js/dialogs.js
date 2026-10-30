/* ===== NPC definitions & dialogue trees (LET'S TALK!) ===== */
/* Node format: {t, pt, learn:[wordIds], fx, next, ch:[{t, pt, ok, next, fx, rew}]}
   - ch.ok === true  -> "Great job!" and continue ; ok === false -> "Try another answer!" (stay)
   - no ok field     -> plain navigation choice
   - fx strings are handled in ui.js (EA.fx); a returned string makes the dialogue jump to that node */
EA.NPCS = {
  rose:   {name:'Grandma Rose', pt:'Vovó Rose', role:'Grandma', skin:2, hair:7, style:'ponytail', hc:7, outfit:{dress:'dress_purple', shoes:'shoes_brown', glasses:'glasses_red'}},
  lily:   {name:'Lily', pt:'Lily', role:'Neighbor', skin:1, hair:3, style:'ponytail', hc:2, outfit:{top:'shirt_pink', bottom:'shorts_white', shoes:'sneakers_red'}},
  tom:    {name:'Tom', pt:'Tom', role:'Kid', skin:3, hair:1, style:'spiky', hc:0, outfit:{top:'tshirt_green', bottom:'shorts_red', shoes:'sneakers_white', hat:'hat_blue'}},
  sam:    {name:'Old Sam', pt:'Velho Sam', role:'Resident', skin:0, hair:5, style:'buzz', hc:7, outfit:{top:'shirt_red', bottom:'pants_brown', shoes:'shoes_black', hat:'hat_yellow', glasses:'glasses_black'}},
  ben:    {name:'Ben', pt:'Ben', role:'Kid', skin:4, hair:2, style:'curly', hc:0, outfit:{top:'tshirt_yellow', bottom:'pants_blue', shoes:'sneakers_white'}},
  walker: {name:'Mr. Walker', pt:'Sr. Walker', role:'Resident', skin:1, hair:4, style:'short', hc:1, outfit:{top:'shirt_black', bottom:'pants_black', shoes:'shoes_black', jacket:'jacket_green'}},
  greenms:{name:'Ms. Green', pt:'Profa. Green', role:'Teacher', skin:2, hair:2, style:'long', hc:1, outfit:{dress:'dress_yellow', shoes:'shoes_black', glasses:'glasses_black'}},
  anna:   {name:'Anna', pt:'Anna', role:'Student', skin:0, hair:3, style:'long', hc:3, outfit:{top:'tshirt_red', bottom:'pants_blue', shoes:'sneakers_white'}},
  clara:  {name:'Clara', pt:'Clara', role:'Shop clerk', skin:3, hair:5, style:'curly', hc:0, outfit:{dress:'dress_pink', shoes:'shoes_black', acc:'scarf_blue'}},
  paws:   {name:'Dr. Paws', pt:'Dr. Paws', role:'Vet', skin:1, hair:1, style:'short', hc:1, outfit:{top:'shirt_blue', bottom:'pants_black', shoes:'shoes_brown', jacket:'jacket_green'}},
  rosa:   {name:'Waiter Rosa', pt:'Garçonete Rosa', role:'Waiter', skin:4, hair:4, style:'ponytail', hc:0, outfit:{top:'shirt_black', bottom:'pants_black', shoes:'shoes_black', acc:'scarf_red'}},
  leo:    {name:'Chef Leo', pt:'Chef Leo', role:'Chef', skin:2, hair:5, style:'buzz', hc:0, outfit:{top:'shirt_black', bottom:'pants_black', shoes:'shoes_black', hat:'hat_black'}},
  fresh:  {name:'Mr. Fresh', pt:'Sr. Fresh', role:'Cashier', skin:0, hair:3, style:'short', hc:2, outfit:{top:'tshirt_green', bottom:'pants_brown', shoes:'sneakers_red', hat:'hat_red'}}
};

EA.DIALOGS = {
  rose: {
    start:'a1', again:'r1',
    nodes:{
      a1:{t:'Welcome to English Town, {name}! I am your grandma, Rose.', pt:'Bem-vindo(a) a English Town, {name}! Eu sou sua avó, Rose.', learn:['hello','house'], next:'a2'},
      a2:{t:'This is your new home. Do you like it?', pt:'Esta é a sua nova casa. Você gosta dela?', ch:[
        {t:'Yes, I love it! Thank you!', pt:'Sim, eu amo! Obrigado(a)!', ok:true, next:'a3', rew:{xp:5}},
        {t:'Go away!', pt:'Vá embora!', ok:false},
        {t:'I am a banana.', pt:'Eu sou uma banana.', ok:false}]},
      a3:{t:'Wonderful! Your wardrobe, your mirror and your bed are in this room. Use them!', pt:'Maravilhoso! Seu guarda-roupa, seu espelho e sua cama estão neste quarto. Use-os!', learn:['thank_you'], next:'a4'},
      a4:{t:'Then open the door, visit the school, the shops and the park. Have fun!', pt:'Depois abra a porta e visite a escola, as lojas e o parque. Divirta-se!', learn:['school','shop','park']}
    }
    ,
    extra:{
      r1:{t:'Hello again, {name}! How are you?', pt:'Olá de novo, {name}! Como você está?', learn:['how_are_you'], ch:[
        {t:"I'm fine, thank you!", pt:'Estou bem, obrigado(a)!', ok:true, next:'r2'},
        {t:"I'm hungry!", pt:'Estou com fome!', ok:true, next:'r3'},
        {t:'Goodbye!', pt:'Tchau!', ok:true}]},
      r2:{t:"I'm happy to hear that! Have a nice day.", pt:'Fico feliz em ouvir isso! Tenha um bom dia.', learn:['i_m_fine']},
      r3:{t:'Oh! Here is an apple for you. Eat it!', pt:'Oh! Aqui está uma maçã para você. Coma!', fx:'give:apple', learn:['apple','eat','i_m_hungry']}
    }
  },
  lily: {
    start:'l1', again:'r1',
    nodes:{
      l1:{t:"Hi! I'm Lily. I live next door. What's your name?", pt:'Oi! Eu sou a Lily. Eu moro ao lado. Qual é o seu nome?', ch:[
        {t:'My name is {name}.', pt:'Meu nome é {name}.', ok:true, next:'l2', rew:{xp:5}},
        {t:"I'm hungry.", pt:'Estou com fome.', ok:false},
        {t:'Goodbye!', pt:'Tchau!', ok:false}]},
      l2:{t:'Nice to meet you, {name}!', pt:'Prazer em conhecer você, {name}!', learn:['nice_to_meet_you','my_name_is'], next:'l3'},
      l3:{t:'Do you like animals? I have a cat!', pt:'Você gosta de animais? Eu tenho um gato!', learn:['cat'], ch:[
        {t:'Yes, I love cats and dogs!', pt:'Sim, eu amo gatos e cachorros!', ok:true, next:'l4', rew:{xp:5}},
        {t:'No, thank you.', pt:'Não, obrigado(a).', ok:false},
        {t:'I am a table.', pt:'Eu sou uma mesa.', ok:false}]},
      l4:{t:'Great! Do you know the school? It is next to your house, on the right. Find it!', pt:'Ótimo! Você conhece a escola? Ela fica ao lado da sua casa, à direita. Encontre-a!', learn:['school','house']}
    },
    extra:{
      r1:{t:'Hi, {name}! How is your day?', pt:'Oi, {name}! Como está seu dia?', ch:[
        {t:"I'm fine, thank you! And you?", pt:'Estou bem, obrigado(a)! E você?', ok:true, next:'r2'},
        {t:'Where is the school?', pt:'Onde fica a escola?', ok:true, next:'r3'},
        {t:'Goodbye!', pt:'Tchau!', ok:true}]},
      r2:{t:"I'm great! Let's play with our pets in the park!", pt:'Estou ótima! Vamos brincar com nossos animais no parque!', learn:['park','play']},
      r3:{t:'The school is next to your house, on the right.', pt:'A escola fica ao lado da sua casa, à direita.', learn:['where_is_the_school']}
    }
  },
  tom: {
    start:'t1',
    nodes:{
      t1:{t:"Hey! I'm Tom. I love games! Let's play Word Hunt! We look for things in town.", pt:'Ei! Eu sou o Tom. Eu amo jogos! Vamos jogar Caça às Palavras! Procuramos coisas na cidade.', learn:['look'], ch:[
        {t:"Yes, let's play!", pt:'Sim, vamos jogar!', fx:'mg:hunt'},
        {t:'Not now, sorry.', pt:'Agora não, desculpe.', next:'t2'}]},
      t2:{t:'OK, no problem. See you later!', pt:'Tudo bem. Até mais!', learn:['sorry']}
    }
  },
  sam: {
    start:'s1',
    nodes:{
      s1:{t:"Good afternoon! I'm Sam. I love this park.", pt:'Boa tarde! Eu sou o Sam. Eu amo este parque.', next:'s2', learn:['park','tree','flower','bench','fountain']},
      s2:{t:'Do you want to know about the town?', pt:'Você quer saber sobre a cidade?', ch:[
        {t:'Where is the supermarket?', pt:'Onde fica o supermercado?', next:'s3'},
        {t:'Where is the pet shop?', pt:'Onde fica o pet shop?', next:'s4'},
        {t:'Where is the restaurant?', pt:'Onde fica o restaurante?', next:'s5'},
        {t:'Goodbye!', pt:'Tchau!'}]},
      s3:{t:'The supermarket is north of the main street, on the right. You need to be an Explorer (Level 2).', pt:'O supermercado fica ao norte da rua principal, à direita. Você precisa ser Explorador (Nível 2).', learn:['supermarket','street'], next:'s2'},
      s4:{t:'The pet shop is on the south side of the main street, on the left. Dr. Paws is there.', pt:'O pet shop fica ao sul da rua principal, à esquerda. O Dr. Paws está lá.', learn:['shop','pet'], next:'s2'},
      s5:{t:'The restaurant is next to the supermarket. It is for Explorers (Level 2) too.', pt:'O restaurante fica ao lado do supermercado. Também é para Exploradores (Nível 2).', learn:['restaurant'], next:'s2'}
    }
  },
  ben: {
    start:'b1',
    nodes:{
      b1:{t:'Hi! I love animals. Do you have a pet?', pt:'Oi! Eu amo animais. Você tem um animal de estimação?', learn:['pet'], ch:[
        {t:'Yes, I have a dog.', pt:'Sim, eu tenho um cachorro.', ok:true, next:'b2'},
        {t:"No, I don't have a pet.", pt:'Não, eu não tenho um animal.', ok:true, next:'b3'},
        {t:'I am a fish.', pt:'Eu sou um peixe.', ok:false}]},
      b2:{t:'Great! A dog needs food, water and a walk every day.', pt:'Ótimo! Um cachorro precisa de comida, água e um passeio todo dia.', learn:['dog','water','walk'], next:'b4'},
      b3:{t:'Go to the Pet Shop! Dr. Paws can help you adopt a dog or a cat.', pt:'Vá ao Pet Shop! O Dr. Paws pode ajudar você a adotar um cachorro ou um gato.', learn:['dog','cat'], next:'b4'},
      b4:{t:'Take your pet for a walk! Open "My Pet" and press Walk. Then run and play!', pt:'Leve seu animal para passear! Abra "My Pet" e aperte Walk. Depois corra e brinque!', learn:['run','play']}
    }
  },
  walker: {
    start:'w1',
    nodes:{
      w1:{t:"Excuse me! I'm lost. Where is the supermarket?", pt:'Com licença! Estou perdido. Onde fica o supermercado?', learn:['excuse_me','supermarket'], ch:[
        {t:'It is next to the restaurant.', pt:'Fica ao lado do restaurante.', ok:true, next:'w2', rew:{xp:5}},
        {t:'It is a banana.', pt:'É uma banana.', ok:false},
        {t:'Hello!', pt:'Olá!', ok:false}]},
      w2:{t:'Thank you very much! You are very kind.', pt:'Muito obrigado! Você é muito gentil.', learn:['thank_you']}
    }
  },
  greenms: {
    start:'g1', again:'g2',
    nodes:{
      g1:{t:"Good morning, {name}! I'm Ms. Green, the English teacher.", pt:'Bom dia, {name}! Eu sou a Profa. Green, a professora de inglês.', next:'g2'},
      g2:{t:'What do you want to do today?', pt:'O que você quer fazer hoje?', ch:[
        {t:'Body Challenge', pt:'Desafio do Corpo', fx:'mg:body'},
        {t:'English Quiz', pt:'Quiz de Inglês', fx:'mg:quiz'},
        {t:'Learn new words', pt:'Aprender palavras novas', fx:'words'},
        {t:'Goodbye!', pt:'Tchau!', learn:[]}]}
    }
  },
  anna: {
    start:'n1',
    nodes:{
      n1:{t:"Hi! I'm Anna. I'm a student. I love to talk!", pt:'Oi! Eu sou a Anna. Sou estudante. Eu amo conversar!', next:'n2'},
      n2:{t:"Let's practice conversations!", pt:'Vamos praticar conversas!', ch:[
        {t:"Okay, let's go!", pt:'Certo, vamos lá!', fx:'mg:conv'},
        {t:'Maybe later.', pt:'Talvez mais tarde.', next:'n3'}]},
      n3:{t:'No problem. Come back soon!', pt:'Sem problemas. Volte logo!'}
    }
  },
  clara: {
    start:'c1',
    nodes:{
      c1:{t:'Welcome to the Clothes Shop! Can I help you?', pt:'Bem-vindo(a) à Loja de Roupas! Posso ajudar?', learn:['shop','shirt','hat','shoes'], ch:[
        {t:'Show me the clothes, please.', pt:'Mostre-me as roupas, por favor.', fx:'shop:clothes'},
        {t:"Let's play Dress Up!", pt:'Vamos jogar Dress Up!', fx:'mg:dress'},
        {t:'No, thank you. Goodbye!', pt:'Não, obrigado(a). Tchau!', next:'c2'}]},
      c2:{t:'You can try the clothes before you buy them. See you!', pt:'Você pode experimentar as roupas antes de comprar. Até mais!', learn:['buy']}
    }
  },
  paws: {
    start:'p1', again:'p3',
    nodes:{
      p1:{t:"Hello! I'm Dr. Paws, the vet. I love dogs and cats!", pt:'Olá! Eu sou o Dr. Paws, o veterinário. Eu amo cachorros e gatos!', learn:['dog','cat','pet'], next:'p2'},
      p2:{t:'A pet needs food, water and love. Feed it, play with it and take it for a walk.', pt:'Um animal precisa de comida, água e carinho. Alimente-o, brinque com ele e leve-o para passear.', learn:['eat','drink','play','walk'], next:'p3'},
      p3:{t:'How can I help you?', pt:'Como posso ajudar?', ch:[
        {t:'I want to adopt a pet.', pt:'Eu quero adotar um animal.', fx:'adopt'},
        {t:'I want food and toys, please.', pt:'Eu quero comida e brinquedos, por favor.', fx:'shop:pet'},
        {t:"Let's play Pet Care!", pt:'Vamos jogar Pet Care!', fx:'mg:petcare'},
        {t:'Goodbye!', pt:'Tchau!'}]}
    }
  },
  rosa: {
    start:'r1',
    nodes:{
      r1:{t:'Good afternoon! Welcome to Tasty Corner. What would you like?', pt:'Boa tarde! Bem-vindo(a) ao Tasty Corner. O que você gostaria?', learn:['restaurant','please'], ch:[
        {t:"I'd like a sandwich, please.", pt:'Eu gostaria de um sanduíche, por favor.', ok:true, next:'r2'},
        {t:'Give me food!', pt:'Me dê comida!', ok:false},
        {t:'I am a banana.', pt:'Eu sou uma banana.', ok:false},
        {t:'Just water, please.', pt:'Só água, por favor.', ok:true, next:'rw'}]},
      rw:{t:'Of course! Here is your water. It is free.', pt:'Claro! Aqui está sua água. É de graça.', learn:['water','drink']},
      r2:{t:'A sandwich. Great choice! Would you like a drink too?', pt:'Um sanduíche. Ótima escolha! Você quer uma bebida também?', learn:['sandwich'], ch:[
        {t:'Yes, orange juice, please.', pt:'Sim, suco de laranja, por favor.', ok:true, next:'r3'},
        {t:'No, thank you.', pt:'Não, obrigado(a).', ok:true, next:'r3'},
        {t:'I sleep.', pt:'Eu durmo.', ok:false}]},
      r3:{t:"OK! That's 5 coins, please.", pt:'Certo! São 5 moedas, por favor.', ch:[
        {t:'Here you are. Thank you!', pt:'Aqui está. Obrigado(a)!', ok:true, fx:'order:sandwich'},
        {t:'How much is it?', pt:'Quanto custa?', next:'r3b'}]},
      r3b:{t:"It's five coins.", pt:'Custa cinco moedas.', learn:['how_much_is_it'], next:'r3'},
      r4:{t:'Here is your sandwich. Enjoy your meal!', pt:'Aqui está seu sanduíche. Bom apetite!', learn:['sandwich','eat']},
      poor:{t:"Oh no. You don't have enough coins. Play a game and earn coins!", pt:'Ah não. Você não tem moedas suficientes. Jogue e ganhe moedas!'}
    }
  },
  leo: {
    start:'e1',
    nodes:{
      e1:{t:"Hello! I'm Chef Leo. I love cooking! What is yellow and long? You can eat it!", pt:'Olá! Eu sou o Chef Leo. Eu amo cozinhar! O que é amarelo e comprido? Dá para comer!', learn:['yellow'], ch:[
        {t:'A banana!', pt:'Uma banana!', ok:true, next:'e2'},
        {t:'A dog.', pt:'Um cachorro.', ok:false},
        {t:'A shoe.', pt:'Um sapato.', ok:false}]},
      e2:{t:'Yes! A banana. And what is red and round?', pt:'Sim! Uma banana. E o que é vermelho e redondo?', learn:['banana','red'], ch:[
        {t:'A tomato!', pt:'Um tomate!', ok:true, next:'e3'},
        {t:'An apple!', pt:'Uma maçã!', ok:true, next:'e3'},
        {t:'A hat.', pt:'Um chapéu.', ok:false}]},
      e3:{t:'Great job! Food is fun: soup, cake, cheese, eggs and bread!', pt:'Ótimo trabalho! Comida é divertido: sopa, bolo, queijo, ovos e pão!', learn:['tomato','apple','soup','cake','cheese','egg','bread']}
    }
  },
  fresh: {
    start:'f1', again:'f2',
    nodes:{
      f1:{t:"Hello! I'm Mr. Fresh. Welcome to the supermarket!", pt:'Olá! Eu sou o Sr. Fresh. Bem-vindo(a) ao supermercado!', learn:['supermarket'], next:'f2'},
      f2:{t:'What can I do for you? I need help with some products!', pt:'O que posso fazer por você? Eu preciso de ajuda com alguns produtos!', ch:[
        {t:'Yes, I can help you!', pt:'Sim, eu posso ajudar!', fx:'mg:shop'},
        {t:'I want to buy something.', pt:'Eu quero comprar algo.', fx:'shop:market'},
        {t:'Goodbye!', pt:'Tchau!'}]}
    }
  }
};
// merge "extra" nodes (the repeat-visit nodes) into nodes
Object.values(EA.DIALOGS).forEach(d => { if (d.extra) { Object.assign(d.nodes, d.extra); delete d.extra; } });
