# Servidor do RPG Legend Multiplayer

1. Coloque esta pasta em um serviço que aceite Node.js e WebSocket.
2. Execute `npm install` e depois `npm start`.
3. Copie o endereço público HTTPS e troque `https://` por `wss://`.
4. No jogo, informe esse endereço em `js/multiplayer-config.js`.

O servidor usa automaticamente a variável `PORT` fornecida pela hospedagem.

## Proteções

- Limite de tamanho e frequência das mensagens.
- Apenas o dono de um perfil pode atualizá-lo.
- Vida e mana são recalculadas a partir do nível, atributos e equipamentos.
- Atributos, nível, XP, ouro, companheiros e inventário possuem limites.
- Valores corrigidos pelo servidor retornam ao jogador antes da próxima ação.
