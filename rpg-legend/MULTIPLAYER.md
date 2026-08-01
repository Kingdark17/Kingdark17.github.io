# Multiplayer cooperativo (Beta)

## Como jogar

1. O primeiro jogador escolhe **Criar Sala** e cria seu personagem.
2. Ele envia o código de seis caracteres ao parceiro.
3. O segundo jogador informa nome e código em **Entrar na Sala**.
4. O segundo jogador também cria seu próprio personagem.
5. Os dois exploram livremente; durante as batalhas, as ações alternam por turno.

O endereço técnico do servidor fica oculto no arquivo de configuração.

## Iniciar o servidor

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

- Duas pessoas exploram a mesma aventura livremente.
- O grupo ocupa uma única sala: quando alguém se move, todos seguem juntos.
- Uma trava curta evita comandos de movimento simultâneos.
- A alternância de turnos é usada somente durante as batalhas.
- Cada jogador possui seu próprio herói, vida, mana, ouro e inventário.
- Cada jogador leva seus próprios companheiros NPCs para o combate.
- A experiência das criaturas derrotadas é concedida aos dois heróis.
- O ouro das criaturas derrotadas também é concedido integralmente aos dois heróis.
- O servidor valida os principais valores do personagem e rejeita números impossíveis.
- Mapa, posição, equipe, missões e combate são sincronizados.
- A versão solo e seu salvamento continuam disponíveis.
