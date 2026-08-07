# RPG Legend - cópia revisada

## Feedback de exploração e itens

- Escadas e saída são reservadas entre as salas mais distantes do início.
- Testes automáticos impedem que essas portas apareçam coladas ao jogador.
- Mochila reorganizada em catálogo e painel lateral fixo de detalhes.
- Lojas usam o mesmo padrão, com compra e venda no painel lateral.
- Em telas pequenas, os detalhes ficam fixos acima da lista de itens.
- Armas, armaduras e acessórios agora recebem tiers D, C, B, A, S, SS ou SSS.
- A loja compara o tier e todos os atributos do item com o equipamento atual.

## Correções aplicadas

- Companheiros agora atacam automaticamente e podem receber dano em combate.
- Taverna restaura a equipe, além do personagem principal.
- Bônus de Vida, Mana, Esquiva e Velocidade dos equipamentos agora funcionam.
- Velocidade dos equipamentos influencia a tentativa de fuga.
- Tiro Certeiro reduz a dificuldade para acertar, sem aumentar o crítico.
- Medo do Fogo, Visão Fraca e Teimoso agora possuem efeitos reais.
- Vitórias, compras, vendas, equipamentos, consumíveis e missões salvam imediatamente.
- Renovar o estoque custa ouro e fica mais caro a cada renovação na mesma visita.
- Andares de chefe sempre reservam salas para chefe, escada e saída.
- Adicionado teste automático dos equipamentos, equipe e andares 1 a 100.
- Descrições e atributos dos itens agora aparecem na mochila, compra, venda,
  equipamentos e mensagens de itens encontrados.
- Encontros mostram informações completas da criatura antes da batalha.
- Famílias de monstros e chefes receberam habilidades, fraquezas e resistências reais.
- Adicionadas salas de evento com escolhas baseadas em FOR, INT e SAB.
- O sinal de mais dos atributos foi centralizado dentro do botão.
- Escolher "Não" diante de NPC, loja, ferreiro, taverna, baú ou evento agora
  permite atravessar a sala sem abrir diálogo ou menu.
- Textos de menus, itens, monstros, eventos, diálogos, combate e documentação
  foram revisados ortográfica e gramaticalmente em português brasileiro.
- NPCs agora oferecem cura, bênção, troca de materiais, informações do mapa
  ou recrutamento temporário, além das conversas normais.
- Nova arma Marreta de Guerra, com afinidade por classe própria.
- Ícone do Machado de Guerra e das Poções de Vida e Mana trocados por pixel art.
- Dragão Filhote do perfil agora usa sprite próprio (normal/coração ao clicar).

## Como testar

Abra `index.html` diretamente no navegador.

Para executar a verificação automática, com Node.js instalado:

```text
node tests/smoke.js
```
