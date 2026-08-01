# Multiplayer cooperativo (Beta)

## Teste rápido no mesmo computador

1. Abra `index.html` em duas abas do mesmo navegador.
2. Na primeira aba, entre em **Multiplayer (Beta)** e clique em **Criar Sala**.
3. Copie o código exibido.
4. Na segunda aba, informe o código e clique em **Entrar na Sala**.
5. O jogador 1 inicia ou continua a aventura. Cada ação passa a vez ao parceiro.

## Jogar entre computadores

É necessário Node.js. Na pasta do jogo, execute:

```text
npm install
npm start
```

Abra `http://IP-DO-COMPUTADOR:8080` nos dois computadores. No menu multiplayer,
use `ws://IP-DO-COMPUTADOR:8080` como servidor e compartilhe o código da sala.

O firewall do computador que hospeda a partida precisa permitir a porta 8080.

## Publicação no GitHub Pages

O jogo está preparado para a pasta `rpg-legend` do repositório
`Kingdark17/Kingdark17.github.io`. Depois de publicar o servidor em um serviço
compatível com Node.js e WebSocket, abra `js/multiplayer-config.js` e coloque o
endereço `wss://` em `serverUrl`. Assim os jogadores não precisarão digitá-lo.

## Escopo desta versão

- Duas pessoas controlam a mesma aventura em turnos alternados.
- Mapa, posição, herói, equipe, inventário, missões e combate são sincronizados.
- A versão solo e seu salvamento continuam disponíveis.
- Inventários e personagens separados por jogador ficam para uma próxima etapa.
