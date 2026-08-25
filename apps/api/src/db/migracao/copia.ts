/**
 * Cópia de um Postgres pro outro — feita pra virada Neon → Supabase.
 *
 * Não é `pg_dump`. É um copiador que o teste consegue exercitar de ponta a
 * ponta contra dois PGlite, e que **confere o que copiou** em vez de
 * confiar no "0 erros". Quem vira um banco com contas de gente dentro
 * precisa de prova, não de ausência de exceção.
 *
 * Três armadilhas moram aqui, e cada uma já derrubou migração de alguém:
 *
 * 1. **Sequence não anda sozinha.** Inserir linha com `id` explícito não
 *    move a sequence do `bigserial`. O banco novo entregaria `id = 1` no
 *    próximo cadastro e colidiria com o usuário 1 que acabou de chegar.
 *    Só aparece quando o primeiro jogador cria conta depois da virada —
 *    tarde demais. Por isso `corrigirSequences` não é opcional.
 *
 * 2. **Coluna a menos no destino é perda silenciosa.** A produção nasceu
 *    do `init()` do servidor antigo; o Supabase nasceu das migrações do
 *    drizzle. `conferirSchemas` recusa a cópia se o destino não tiver
 *    alguma coluna da origem — copiar mesmo assim jogaria dado fora sem
 *    erro nenhum.
 *
 * 3. **`jsonb` que começa com array vira array do Postgres.** O `pg`
 *    converte `Array` de JS pra literal de array do Postgres, não pra
 *    JSON. Toda coluna `json`/`jsonb` sai daqui como texto com `::jsonb`
 *    explícito.
 *
 * A cópia é re-executável: `ON CONFLICT DO NOTHING` em cima da chave
 * primária. Rodar duas vezes não duplica nada, o que permite retomar uma
 * cópia interrompida sem limpar o destino.
 */

/** O bastante de um cliente `pg` pra este arquivo — e o que o PGlite atrás do socket também entrega. */
export interface Consultavel {
  query<T = Record<string, unknown>>(texto: string, valores?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

/**
 * Ordem de inserção. `users` primeiro porque as outras seis apontam pra
 * ela; entre si não há dependência. É a inversa da ordem de apagar que os
 * testes já usam (`TABLES_IN_DELETE_ORDER`), e tem que continuar sendo.
 */
export const TABELAS_EM_ORDEM = [
  'users',
  'sessions',
  'cloud_saves',
  'cloud_save_history',
  'friend_requests',
  'friendships',
  'chat_messages',
] as const;

export type Tabela = (typeof TABELAS_EM_ORDEM)[number];

/**
 * Colunas `bigserial` que precisam da sequence realinhada depois da
 * cópia. As outras três tabelas têm chave natural (hash do token, par de
 * ids) e não têm sequence nenhuma.
 */
const SEQUENCES: ReadonlyArray<{ tabela: Tabela; coluna: string }> = [
  { tabela: 'users', coluna: 'id' },
  { tabela: 'cloud_save_history', coluna: 'id' },
  { tabela: 'friend_requests', coluna: 'id' },
  { tabela: 'chat_messages', coluna: 'id' },
];

/** Teto do protocolo do Postgres: 65535 parâmetros por comando. Fica bem abaixo. */
const TETO_DE_PARAMETROS = 30000;

export interface OpcoesDeCopia {
  /** Sem isto, nada é escrito — só lê e relata. É o padrão de propósito. */
  escrever?: boolean;
  /** Linhas por lote. Save é `jsonb` grande; 200 segura a memória sem virar lerdeza. */
  lote?: number;
  /** Recebe cada linha de progresso. Sem isto, o módulo não imprime nada. */
  aoAndar?: (texto: string) => void;
}

export interface ResumoDaTabela {
  tabela: Tabela;
  naOrigem: number;
  noDestinoAntes: number;
  inseridas: number;
  /** Linhas que a origem tinha e o destino já possuía (conflito de chave). */
  puladas: number;
}

export interface RelatorioDeCopia {
  escreveu: boolean;
  tabelas: ResumoDaTabela[];
  sequences: Array<{ tabela: Tabela; coluna: string; valor: number | null }>;
}

interface Coluna {
  nome: string;
  ehJson: boolean;
}

async function colunasDe(cliente: Consultavel, tabela: string): Promise<Coluna[]> {
  const { rows } = await cliente.query<{ column_name: string; udt_name: string }>(
    `select column_name, udt_name
       from information_schema.columns
      where table_schema = 'public' and table_name = $1
      order by ordinal_position`,
    [tabela],
  );
  return rows.map((r) => ({ nome: r.column_name, ehJson: r.udt_name === 'json' || r.udt_name === 'jsonb' }));
}

async function chavePrimariaDe(cliente: Consultavel, tabela: string): Promise<string[]> {
  const { rows } = await cliente.query<{ attname: string }>(
    `select a.attname
       from pg_index i
       join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = $1::regclass and i.indisprimary
      order by array_position(i.indkey, a.attnum)`,
    [`public.${tabela}`],
  );
  return rows.map((r) => r.attname);
}

async function contar(cliente: Consultavel, tabela: string): Promise<number> {
  const { rows } = await cliente.query<{ n: string }>(`select count(*)::text as n from public."${tabela}"`);
  return Number(rows[0].n);
}

/**
 * Recusa a cópia quando o destino não consegue receber tudo que a origem
 * tem. Coluna sobrando no destino é aceita de propósito — ela nasce com o
 * default, que é o caso de qualquer coluna acrescentada depois.
 */
export async function conferirSchemas(origem: Consultavel, destino: Consultavel): Promise<string[]> {
  const problemas: string[] = [];

  for (const tabela of TABELAS_EM_ORDEM) {
    const daOrigem = await colunasDe(origem, tabela);
    const doDestino = await colunasDe(destino, tabela);

    if (daOrigem.length === 0) problemas.push(`origem não tem a tabela ${tabela}`);
    if (doDestino.length === 0) problemas.push(`destino não tem a tabela ${tabela}`);
    if (daOrigem.length === 0 || doDestino.length === 0) continue;

    const nomesDoDestino = new Set(doDestino.map((c) => c.nome));
    for (const coluna of daOrigem) {
      if (!nomesDoDestino.has(coluna.nome)) {
        problemas.push(`destino não tem ${tabela}.${coluna.nome} — copiar assim perderia esse dado`);
      }
    }
  }

  return problemas;
}

/** Nome citado de coluna, pra montar SQL sem sustos com maiúscula ou palavra reservada. */
const cit = (nome: string) => `"${nome}"`;

/**
 * Um lote de linhas viram um único INSERT parametrizado. `ON CONFLICT DO
 * NOTHING` sem alvo cobre qualquer restrição única da tabela, não só a
 * primária — é o que faz `friend_requests` (que tem a única `from_id,
 * to_id` além do `id`) se comportar na re-execução.
 */
async function inserirLote(destino: Consultavel, tabela: string, colunas: Coluna[], linhas: Array<Record<string, unknown>>): Promise<number> {
  if (linhas.length === 0) return 0;

  const valores: unknown[] = [];
  const grupos = linhas.map((linha) => {
    const marcadores = colunas.map((coluna) => {
      const bruto = linha[coluna.nome];
      // `jsonb` sai como texto e volta com cast explícito: sem isso, um
      // array de JS viraria literal de array do Postgres.
      valores.push(coluna.ehJson && bruto !== null && bruto !== undefined ? JSON.stringify(bruto) : bruto);
      return coluna.ehJson ? `$${valores.length}::jsonb` : `$${valores.length}`;
    });
    return `(${marcadores.join(', ')})`;
  });

  const sql = `insert into public."${tabela}" (${colunas.map((c) => cit(c.nome)).join(', ')})
               values ${grupos.join(', ')}
               on conflict do nothing`;

  const { rowCount } = await destino.query(sql, valores);
  return rowCount ?? 0;
}

/**
 * Paginação por chave, não por `OFFSET`. `OFFSET` desliza quando alguém
 * insere durante a leitura, e aí some linha sem ninguém perceber. A
 * comparação de tupla (`(a, b) > ($1, $2)`) funciona igual pra chave
 * simples e composta.
 */
async function* lerEmLotes(
  origem: Consultavel,
  tabela: string,
  colunas: Coluna[],
  chave: string[],
  tamanho: number,
): AsyncGenerator<Array<Record<string, unknown>>> {
  const listaDeColunas = colunas.map((c) => cit(c.nome)).join(', ');
  const tupla = chave.map(cit).join(', ');
  const ordem = chave.map((c) => `${cit(c)} asc`).join(', ');

  let ultima: unknown[] | null = null;

  for (;;) {
    const marcadores: string = chave.map((_, i) => `$${i + 1}`).join(', ');
    const filtro: string = ultima ? `where (${tupla}) > (${marcadores})` : '';
    const sql: string = `select ${listaDeColunas} from public."${tabela}" ${filtro} order by ${ordem} limit ${tamanho}`;

    // Anotado à mão, e não é preciosismo: `ultima` é lida pra montar a
    // consulta e reescrita com o resultado dela, o que fecha um ciclo de
    // inferência. Com `noImplicitAny: false` o TS resolve ciclo entregando
    // `any` **em silêncio** — o `tsc` passa e o tipo some. A anotação corta
    // o ciclo e devolve a checagem.
    const linhas: Array<Record<string, unknown>> = (await origem.query<Record<string, unknown>>(sql, ultima ?? [])).rows;
    if (linhas.length === 0) return;

    yield linhas;
    if (linhas.length < tamanho) return;

    const derradeira: Record<string, unknown> = linhas[linhas.length - 1];
    ultima = chave.map((c) => derradeira[c]);
  }
}

/**
 * Realinha as sequences com o maior id copiado.
 *
 * O terceiro argumento do `setval` é `is_called`: com `true`, o próximo
 * `nextval` devolve `max + 1`. Tabela vazia recebe `1, false`, que é o
 * estado de sequence recém-criada — e não `0`, que o Postgres recusa.
 */
export async function corrigirSequences(destino: Consultavel, escrever: boolean): Promise<RelatorioDeCopia['sequences']> {
  const saida: RelatorioDeCopia['sequences'] = [];

  for (const { tabela, coluna } of SEQUENCES) {
    const { rows } = await destino.query<{ maior: string | null }>(`select max(${cit(coluna)})::text as maior from public."${tabela}"`);
    const maior = rows[0].maior === null ? null : Number(rows[0].maior);

    if (escrever) {
      await destino.query(`select setval(pg_get_serial_sequence($1, $2), $3::bigint, $4::boolean)`, [
        `public.${tabela}`,
        coluna,
        maior ?? 1,
        maior !== null,
      ]);
    }

    saida.push({ tabela, coluna, valor: maior });
  }

  return saida;
}

/**
 * Copia as sete tabelas da origem pro destino.
 *
 * Sem `escrever: true` não grava nada: lê, conta e relata o que faria.
 * O padrão é esse porque o destino errado é um comando de distância.
 */
export async function copiar(origem: Consultavel, destino: Consultavel, opcoes: OpcoesDeCopia = {}): Promise<RelatorioDeCopia> {
  const escrever = opcoes.escrever === true;
  const lote = opcoes.lote ?? 200;
  const andar = opcoes.aoAndar ?? (() => {});

  const problemas = await conferirSchemas(origem, destino);
  if (problemas.length > 0) {
    throw new Error(`schemas incompatíveis:\n  - ${problemas.join('\n  - ')}`);
  }

  const tabelas: ResumoDaTabela[] = [];

  for (const tabela of TABELAS_EM_ORDEM) {
    const colunas = await colunasDe(origem, tabela);
    const chave = await chavePrimariaDe(origem, tabela);
    if (chave.length === 0) throw new Error(`${tabela} não tem chave primária — a paginação por chave depende dela`);

    const naOrigem = await contar(origem, tabela);
    const noDestinoAntes = await contar(destino, tabela);

    let inseridas = 0;
    let lidas = 0;

    if (escrever) {
      const porLote = Math.max(1, Math.min(lote, Math.floor(TETO_DE_PARAMETROS / colunas.length)));
      for await (const linhas of lerEmLotes(origem, tabela, colunas, chave, porLote)) {
        inseridas += await inserirLote(destino, tabela, colunas, linhas);
        lidas += linhas.length;
        andar(`  ${tabela}: ${lidas}/${naOrigem} lidas, ${inseridas} inseridas`);
      }
    }

    tabelas.push({ tabela, naOrigem, noDestinoAntes, inseridas, puladas: escrever ? lidas - inseridas : 0 });
  }

  const sequences = await corrigirSequences(destino, escrever);

  return { escreveu: escrever, tabelas, sequences };
}

export interface LinhaDeConferencia {
  tabela: Tabela;
  origem: number;
  destino: number;
  /** `md5` do conteúdo que importa, dos dois lados. `null` quando a tabela está vazia nos dois. */
  digestOrigem: string | null;
  digestDestino: string | null;
  bate: boolean;
}

/**
 * O que cada tabela precisa provar que sobreviveu. Não é a linha inteira:
 * é o que perder seria estrago de verdade — hash e sal de senha, o save
 * do jogador, o corpo da mensagem. `data::text` de `jsonb` é determinístico
 * (o Postgres guarda as chaves ordenadas), então o `md5` compara conteúdo,
 * não formatação.
 */
const IMPRESSAO: Record<Tabela, { expressao: string; ordem: string }> = {
  users: {
    expressao: `id || '|' || username || '|' || password_hash || '|' || password_salt || '|' || coalesce(email, '') || '|' || md5(cosmetics::text)`,
    ordem: 'id',
  },
  sessions: { expressao: `token_hash || '|' || user_id`, ordem: 'token_hash' },
  cloud_saves: { expressao: `user_id || '|' || slot || '|' || md5(data::text)`, ordem: 'user_id, slot' },
  cloud_save_history: { expressao: `id || '|' || user_id || '|' || slot || '|' || md5(data::text)`, ordem: 'id' },
  friend_requests: { expressao: `id || '|' || from_id || '|' || to_id`, ordem: 'id' },
  friendships: { expressao: `user_id || '|' || friend_id`, ordem: 'user_id, friend_id' },
  chat_messages: { expressao: `id || '|' || sender_id || '|' || recipient_id || '|' || md5(body)`, ordem: 'id' },
};

async function impressaoDe(cliente: Consultavel, tabela: Tabela): Promise<{ n: number; digest: string | null }> {
  const { expressao, ordem } = IMPRESSAO[tabela];
  const { rows } = await cliente.query<{ n: string; digest: string | null }>(
    `select count(*)::text as n,
            md5(coalesce(string_agg(${expressao}, chr(10) order by ${ordem}), '')) as digest
       from public."${tabela}"`,
  );
  const n = Number(rows[0].n);
  return { n, digest: n === 0 ? null : rows[0].digest };
}

/**
 * A prova de que a cópia valeu: mesma contagem **e** mesmo `md5` do
 * conteúdo que importa, tabela por tabela. Contagem sozinha não pega
 * truncamento de texto nem `jsonb` remontado errado.
 */
export async function conferir(origem: Consultavel, destino: Consultavel): Promise<LinhaDeConferencia[]> {
  const saida: LinhaDeConferencia[] = [];

  for (const tabela of TABELAS_EM_ORDEM) {
    const a = await impressaoDe(origem, tabela);
    const b = await impressaoDe(destino, tabela);
    saida.push({
      tabela,
      origem: a.n,
      destino: b.n,
      digestOrigem: a.digest,
      digestDestino: b.digest,
      bate: a.n === b.n && a.digest === b.digest,
    });
  }

  return saida;
}
