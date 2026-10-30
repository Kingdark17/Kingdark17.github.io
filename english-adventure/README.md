# ENGLISH ADVENTURE — Learn English. Explore the World. Have Fun!

Jogo educativo 2D (visão de cima) para ensinar inglês a iniciantes. Roda direto no navegador.

## Como jogar
1. Abra `index.html` (duplo clique) em Chrome, Edge ou Firefox. Não precisa instalar nada.
2. **PLAY** cria um personagem; **CONTINUE** carrega o progresso salvo no navegador (localStorage).
3. Controles: **WASD / setas** mover (Shift corre) • **E** interagir • **I** inventário • **M** mapa • **Q** missões • **Esc** configurações.
   No celular aparecem direcional e botão **E** na tela.

## O que tem
- Cidade **ENGLISH TOWN** (64x46 tiles) com casa, escola, loja de roupas, pet shop, restaurante (Nível 2), supermercado (Nível 2) e parque.
- Criação de personagem, guarda-roupa (DRESS UP), loja com provador, inventário, mapa, XP / moedas / níveis / recompensas.
- Animal de estimação (MY PET): adotar cão ou gato, alimentar, água, brincar, carinho, passear, acessórios; ele segue você.
- Conversas com escolhas (LET'S TALK!), 20 missões (9 principais + 11 secundárias), 99 palavras/frases com tradução e pronúncia (síntese de voz do navegador).
- 6 minijogos: Body Challenge, Dress Up, Pet Care, Word Hunt (+ Shopping List no supermercado), English Quiz, Conversation Challenge — todos com 3 níveis.
- Acessibilidade: texto maior, traduções liga/desliga, áudio liga/desliga, alto contraste, controles de teclado e toque.

## Vozes
Todas as falas dos personagens, as respostas do jogador, as traduções e as palavras têm áudio gravado com voz neural (Kokoro TTS), com uma voz diferente para cada personagem (`assets/voice/`, índice em `js/voice-manifest.js`). Só o nome do jogador e textos sem gravação usam a voz do navegador. Em Settings dá para trocar para a voz do navegador e ajustar a velocidade.

## Música e volume
Três músicas de fundo originais (cidade de dia, interiores e noite), geradas pelo próprio jogo com Web Audio (`js/music.js`). A música abaixa sozinha quando alguém fala. Em Settings há volume geral, música, vozes e efeitos; o botão 🎵 no canto liga e desliga a música.

## Estrutura
```
index.html  style.css
js/data.js        vocabulário, itens, níveis, missões, lugares
js/dialogs.js     NPCs e árvores de diálogo
js/core.js        estado, salvamento, XP, missões, áudio, pet, input
js/art.js         pixel art procedural (tiles, personagens, pets, prédios, móveis)
js/maps.js        cidade e interiores (colisões, portas, NPCs)
js/world.js       movimento, colisão, câmera, renderização, interação
js/ui.js, ui2.js HUD, diálogos, menus, lojas, guarda-roupa, pet
js/minigames.js, minigames2.js   os 6 minijogos
js/main.js        loop do jogo, tela inicial, entrada
assets/           (reservado) toda a arte é gerada por código, sem arquivos de imagem
```
