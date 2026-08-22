# Imagem da API. Construída da RAIZ do repositório, não desta pasta:
#
#   docker build -f apps/api/Dockerfile -t rpg-legend-api .
#
# O contexto tem que ser a raiz porque `@rpg-legend/shared` é
# `workspace:*` — a API não compila sem o pacote irmão, e ele não existe
# dentro de `apps/api/`. Plataforma que só aponta pra uma subpasta não
# consegue construir isto; precisa apontar o Dockerfile daqui com o
# contexto na raiz.
#
# Três estágios pra a imagem final não carregar nem devDependency nem
# código-fonte: `deps` resolve só o que roda em produção, `builder`
# compila com tudo, e `runner` junta os dois pedaços.

# ---------------------------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /app
# Versão presa à mesma do `packageManager` na raiz. Instalado pelo npm em
# vez de corepack porque corepack já mudou de comportamento entre versões
# do Node e aqui não vale depender disso.
RUN npm install -g pnpm@11.21.0

# --- só as dependências de produção ---------------------------------
FROM base AS deps
# Os manifestos primeiro, sozinhos: é o que deixa o Docker reaproveitar a
# camada de instalação enquanto só o código muda.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# `api...` = a API e as dependências dela, o que traz `packages/shared` e
# deixa `apps/web` de fora. O manifesto do web ainda é copiado acima
# porque o lockfile o descreve, e `--frozen-lockfile` recusa um workspace
# que não bate com o lockfile.
RUN pnpm install --frozen-lockfile --prod --filter api... --ignore-scripts

# --- compilação ------------------------------------------------------
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# Sem `--ignore-scripts` aqui, ao contrário do estágio `deps`: o esbuild
# (que o tsup usa pra compilar o shared) precisa do postinstall dele pra
# linkar o binário nativo. O `pnpm-workspace.yaml` já libera esse script.
RUN pnpm install --frozen-lockfile --filter api...
COPY packages/shared packages/shared
COPY apps/api apps/api
# `api...` de novo: o pnpm resolve a ordem e constrói o shared antes.
RUN pnpm --filter api... build

# --- imagem final ----------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
# `deps` já tem os manifestos e o node_modules de produção montado; só
# faltam os dois `dist`.
COPY --from=deps /app ./
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Usuário sem privilégio, que a imagem do Node já traz pronto.
USER node
WORKDIR /app/apps/api

# Informativo: quem manda na porta é a variável PORT, lida pelo main.ts.
# Toda plataforma define a dela, e o app respeita.
EXPOSE 3000

# `dist/main` só existe porque o `tsconfig.build.json` fixa `rootDir` em
# `src`. Sem isso a saída ia pra `dist/src/main.js` e este CMD falharia.
CMD ["node", "dist/main"]
