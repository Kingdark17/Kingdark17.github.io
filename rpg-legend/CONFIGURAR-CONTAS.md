# Configurar o sistema de contas

O servidor cria automaticamente as tabelas de usuários, sessões e progressos. É necessário apenas fornecer um banco PostgreSQL.

## Variáveis do serviço no Render

- `DATABASE_URL`: endereço completo de conexão do PostgreSQL.
- `ALLOWED_ORIGIN`: `https://kingdark17.github.io`
- `DATABASE_SSL`: use `false` apenas se o provedor do banco disser explicitamente que a conexão não usa SSL.

Depois de adicionar as variáveis, faça um novo deploy do repositório do servidor. Nos logs deve aparecer:

`Sistema de contas conectado ao banco de dados.`

## Segurança e funcionamento

- As senhas são protegidas com `scrypt` e um salt exclusivo; a senha original não é armazenada.
- Os tokens de sessão são aleatórios, armazenados no banco apenas como hash e expiram após 30 dias.
- Cadastro e login possuem limite de tentativas.
- Cada conta possui um progresso na nuvem.
- O backup local em arquivo continua disponível nas Configurações.

Sem `DATABASE_URL`, o multiplayer continua funcionando, mas o servidor responde que o sistema de contas ainda não foi configurado.
