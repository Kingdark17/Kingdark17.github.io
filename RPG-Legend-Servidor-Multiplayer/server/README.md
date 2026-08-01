# Servidor do RPG Legend Multiplayer

1. Coloque esta pasta em um serviço que aceite Node.js e WebSocket.
2. Execute `npm install` e depois `npm start`.
3. Copie o endereço público HTTPS e troque `https://` por `wss://`.
4. No jogo, informe esse endereço em `js/multiplayer-config.js`.

O servidor usa automaticamente a variável `PORT` fornecida pela hospedagem.
