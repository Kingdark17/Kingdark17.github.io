/**
 * Cópia de um Postgres pro outro — feita pra virada Neon → Supabase.
 *
 * Não é `pg_dump`. É um copiador que o teste consegue exercitar de ponta a
 * ponta contra dois PGlite, e que **confere o que copiou** em vez de
 * confiar no "0 erros". Quem vira um banco com contas de gente dentro
 * precisa de prova, não de ausência de exceção.
 *
 * **Dois modos, e escolher errado é o jeito mais fácil de errar aqui.**
 * `inserir` (padrão) só acrescenta o que falta e nunca sobrescreve — certo
 * pra destino vazio. `espelhar` deixa o destino idêntico à origem:
 * acrescenta, atualiza e apaga. Ver `ModoDeCopia`.
 *
 * Quatro armadilhas moram aqui, e cada uma já derrubou migração de alguém:
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
 * 4. **Conferência com lista de colunas escolhida a dedo mente.** A
 *    primeira versão comparava só "o que importa" — hash de senha, save,
 *    corpo da mensagem — e deixou passar um `pet` desatualizado, que numa
 *    virada é cosmético comprado e perdido. A impressão digital agora é a
 *    linha inteira, com as colunas em ordem alfabética.
 *
 * Rodar de novo não duplica nada nos dois modos, o que permite retomar uma
 * cópia interrompida sem limpar o destino. Mas **`inserir` re-executado não
 * traz alteração**: ele pula a linha que já existe, e `cloud_saves` é a
 * mesma chave com `data` novo a cada save. Cópia quente termina em
 * `espelhar`, nunca num segundo `inserir`.
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

/**
 * `inserir` só acrescenta o que falta: nunca toca em linha que já está no
 * destino. É o certo pra um destino vazio, e é o padrão porque não
 * sobrescreve nada por engano.
 *
 * `espelhar` deixa o destino **idêntico** à origem: acrescenta, atualiza o
 * que mudou e **apaga o que sumiu**.
 *
 * A diferença importa mais do que parece. `cloud_saves` é a mesma chave
 * `(user_id, slot)` com `data` novo a cada save — num destino que já tem a
 * linha, `inserir` a pula e o save fica velho. Rodar `inserir` de novo pra
 * "pegar o atraso" não pega alteração nenhuma.
 */
export type ModoDeCopia = 'inserir' | 'espelhar';

export interface OpcoesDeCopia {
  /** Sem isto, nada é escrito — só lê e relata. É o padrão de propósito. */
  escrever?: boolean;
  /** Ver `ModoDeCopia`. Padrão `inserir`, que é o que não sobrescreve. */
  modo?: ModoDeCopia;
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
  /** Linhas que existiam no destino e foram sobrescritas. Só em `espelhar`. */
  atualizadas: number;
  /** Linhas do destino cuja chave sumiu da origem. Só em `espelhar`. */
  apagadas: number;
  /** Linhas que a origem tinha e o destino já possuía sem mudança. */
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

export interface RelatorioDaLimpeza {
  apagou: boolean;
  porTabela: Array<{ tabela: Tabela; linhas: number }>;
  total: number;
}

/**
 * Esvazia o destino antes de uma cópia — as sete tabelas de uma vez.
 *
 * `TRUNCATE` num único comando com todas as tabelas dispensa ordem de
 * chave estrangeira, e o `RESTART IDENTITY` zera as sequences junto, que é
 * exatamente o estado de banco recém-criado.
 *
 * Existe porque o Supabase **não está vazio**: a conta de teste do login
 * de 22/08 mora lá. Com o destino sujo, uma cópia em modo `inserir` pode
 * pular um jogador real cujo `id` bata com o da conta de teste — e a
 * contagem final bateria assim mesmo.
 *
 * Sem `apagar: true` não destrói nada: só conta e relata o que apagaria.
 */
export type VereditoDaLimpeza =
  { ok: true } | { ok: false; motivo: 'faltou'; total: number } | { ok: false; motivo: 'nao-bate'; total: number; declarado: string };

/**
 * A barreira do apagar: além de repetir o host do destino, é preciso
 * declarar **quantas linhas** se está destruindo.
 *
 * Não é cerimônia. Repetir o host não pega o caso de estar no banco certo
 * com conteúdo inesperado — e contagem inesperada é justamente o sintoma
 * de estar apontado pro lugar errado. Se o destino tiver 400 linhas quando
 * você esperava 2, o número não bate e o comando morre.
 *
 * Mora aqui, e não na CLI, porque barreira sem teste não é barreira — e
 * testar isto pela CLI custaria subir banco e processo pra cada caso.
 */
export function autorizaApagar(total: number, declarado: string | undefined): VereditoDaLimpeza {
  if (declarado === undefined || declarado === '') return { ok: false, motivo: 'faltou', total };
  if (Number(declarado) !== total) return { ok: false, motivo: 'nao-bate', total, declarado };
  return { ok: true };
}

export async function limparDestino(destino: Consultavel, apagar: boolean): Promise<RelatorioDaLimpeza> {
  const porTabela: RelatorioDaLimpeza['porTabela'] = [];

  for (const tabela of TABELAS_EM_ORDEM) {
    porTabela.push({ tabela, linhas: await contar(destino, tabela) });
  }

  const total = porTabela.reduce((soma, t) => soma + t.linhas, 0);

  if (apagar) {
    const lista = TABELAS_EM_ORDEM.map((t) => `public."${t}"`).join(', ');
    await destino.query(`truncate ${lista} restart identity cascade`);
  }

  return { apagou: apagar, porTabela, total };
}

/**
 * Um lote de linhas viram um único INSERT parametrizado. `ON CONFLICT DO
 * NOTHING` sem alvo cobre qualquer restrição única da tabela, não só a
 * primária — é o que faz `friend_requests` (que tem a única `from_id,
 * to_id` além do `id`) se comportar na re-execução.
 */
async function inserirLote(
  destino: Consultavel,
  tabela: string,
  colunas: Coluna[],
  chave: string[],
  linhas: Array<Record<string, unknown>>,
  modo: ModoDeCopia,
): Promise<{ inseridas: number; atualizadas: number }> {
  if (linhas.length === 0) return { inseridas: 0, atualizadas: 0 };

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

  const cabeca = `insert into public."${tabela}" (${colunas.map((c) => cit(c.nome)).join(', ')})
                  values ${grupos.join(', ')}`;

  if (modo === 'inserir') {
    const { rowCount } = await destino.query(`${cabeca} on conflict do nothing`, valores);
    return { inseridas: rowCount ?? 0, atualizadas: 0 };
  }

  const naChave = new Set(chave);
  const atribuicoes = colunas.filter((c) => !naChave.has(c.nome)).map((c) => `${cit(c.nome)} = excluded.${cit(c.nome)}`);

  // Tabela feita só de chave não tem o que atualizar — `DO UPDATE SET`
  // vazio é erro de sintaxe, então ela volta pro `DO NOTHING`.
  if (atribuicoes.length === 0) {
    const { rowCount } = await destino.query(`${cabeca} on conflict do nothing`, valores);
    return { inseridas: rowCount ?? 0, atualizadas: 0 };
  }

  // `xmax = 0` é o jeito de saber se a linha nasceu ou foi sobrescrita:
  // num INSERT de verdade não há transação que a tenha travado antes, e o
  // `rowCount` de um upsert soma os dois casos sem distinguir.
  const { rows } = await destino.query<{ inserida: boolean }>(
    `${cabeca}
     on conflict (${chave.map(cit).join(', ')}) do update set ${atribuicoes.join(', ')}
     returning (xmax = 0) as inserida`,
    valores,
  );

  const inseridas = rows.filter((r) => r.inserida).length;
  return { inseridas, atualizadas: rows.length - inseridas };
}

/**
 * Apaga do destino as linhas cuja chave não existe mais na origem.
 *
 * Lê as duas listas de chaves inteiras na memória. Aguenta bem um banco do
 * tamanho deste jogo; não aguentaria milhões de linhas, e é o limite que
 * este arquivo assume de propósito em vez de esconder.
 */
async function apagarSobrando(origem: Consultavel, destino: Consultavel, tabela: string, chave: string[], escrever: boolean): Promise<number> {
  const lista = chave.map(cit).join(', ');
  // Os dois lados são Postgres lidos pelo mesmo driver, então o mesmo tipo
  // de coluna volta na mesma forma dos dois — o que faz esta marca servir
  // de identidade sem precisar normalizar nada.
  const marca = (linha: Record<string, unknown>) => JSON.stringify(chave.map((c) => linha[c]));

  const daOrigem = new Set((await origem.query<Record<string, unknown>>(`select ${lista} from public."${tabela}"`)).rows.map(marca));
  const doDestino = (await destino.query<Record<string, unknown>>(`select ${lista} from public."${tabela}"`)).rows;

  const sobrando = doDestino.filter((linha) => !daOrigem.has(marca(linha)));
  if (sobrando.length === 0 || !escrever) return sobrando.length;

  const porVez = Math.max(1, Math.floor(TETO_DE_PARAMETROS / chave.length));
  for (let i = 0; i < sobrando.length; i += porVez) {
    const valores: unknown[] = [];
    const tuplas = sobrando.slice(i, i + porVez).map((linha) => {
      const marcadores = chave.map((c) => {
        valores.push(linha[c]);
        return `$${valores.length}`;
      });
      return `(${marcadores.join(', ')})`;
    });
    await destino.query(`delete from public."${tabela}" where (${lista}) in (${tuplas.join(', ')})`, valores);
  }

  return sobrando.length;
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
  const modo: ModoDeCopia = opcoes.modo ?? 'inserir';
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
    let atualizadas = 0;
    let lidas = 0;

    // Apagar antes de inserir, e não depois: em `friend_requests` um par
    // `(from_id, to_id)` recriado com id novo violaria a única se a linha
    // velha ainda estivesse lá.
    const apagadas = modo === 'espelhar' ? await apagarSobrando(origem, destino, tabela, chave, escrever) : 0;

    if (escrever) {
      const porLote = Math.max(1, Math.min(lote, Math.floor(TETO_DE_PARAMETROS / colunas.length)));
      for await (const linhas of lerEmLotes(origem, tabela, colunas, chave, porLote)) {
        const feito = await inserirLote(destino, tabela, colunas, chave, linhas, modo);
        inseridas += feito.inseridas;
        atualizadas += feito.atualizadas;
        lidas += linhas.length;
        andar(`  ${tabela}: ${lidas}/${naOrigem} lidas, ${inseridas} novas, ${atualizadas} atualizadas`);
      }
    }

    tabelas.push({
      tabela,
      naOrigem,
      noDestinoAntes,
      inseridas,
      atualizadas,
      apagadas,
      puladas: escrever ? lidas - inseridas - atualizadas : 0,
    });
  }

  const sequences = await corrigirSequences(destino, escrever);

  return { escreveu: escrever, tabelas, sequences };
}

export interface LinhaDeConferencia {
  tabela: Tabela;
  origem: number;
  destino: number;
  /** `md5` da linha inteira, dos dois lados. `null` quando a tabela está vazia nos dois. */
  digestOrigem: string | null;
  digestDestino: string | null;
  bate: boolean;
}

/**
 * A impressão digital é a **linha inteira**, e essa escolha custou um
 * teste vermelho pra ficar clara.
 *
 * A primeira versão listava à mão o "que importa" — hash de senha, save,
 * corpo da mensagem. Aí um `pet` alterado passou pela conferência sem
 * levantar nada: a coluna não estava na lista. Numa virada isso significa
 * aprovar um destino onde o jogador perdeu o cosmético que comprou. Lista
 * escolhida a dedo é lista que envelhece sem avisar.
 *
 * `row(...)::text` monta a linha com as colunas **em ordem alfabética**,
 * não na ordem física da tabela: origem e destino nasceram de DDLs
 * diferentes e podem ter ordenado as colunas diferente, o que faria um
 * `t.*::text` divergir com dado idêntico.
 */
async function impressaoDe(cliente: Consultavel, tabela: Tabela, colunas: string[], chave: string[]): Promise<{ n: number; digest: string | null }> {
  const lista = [...colunas]
    .sort((a, b) => a.localeCompare(b))
    .map(cit)
    .join(', ');
  const ordem = chave.map(cit).join(', ');

  const { rows } = await cliente.query<{ n: string; digest: string | null }>(
    `select count(*)::text as n,
            md5(coalesce(string_agg(md5(row(${lista})::text), chr(10) order by ${ordem}), '')) as digest
       from public."${tabela}"`,
  );
  const n = Number(rows[0].n);
  return { n, digest: n === 0 ? null : rows[0].digest };
}

/**
 * Normaliza o que muda o texto de um `timestamptz` sem mudar o instante.
 * Sem isto, dois bancos com fuso ou `DateStyle` diferentes renderiam a
 * mesma data de formas diferentes e a conferência acusaria divergência que
 * não existe.
 */
async function normalizar(cliente: Consultavel): Promise<void> {
  await cliente.query(`set time zone 'UTC'`);
  await cliente.query(`set datestyle to 'ISO, YMD'`);
}

/**
 * A prova de que a cópia valeu: mesma contagem **e** mesmo `md5` da linha
 * inteira, tabela por tabela. Contagem sozinha não pega texto truncado,
 * `jsonb` remontado errado nem coluna que ficou pra trás.
 */
export async function conferir(origem: Consultavel, destino: Consultavel): Promise<LinhaDeConferencia[]> {
  await normalizar(origem);
  await normalizar(destino);

  const saida: LinhaDeConferencia[] = [];

  for (const tabela of TABELAS_EM_ORDEM) {
    // As colunas da origem, não as do destino: coluna a mais no destino
    // nasce com default e não é perda. Coluna a menos o `conferirSchemas`
    // já teria recusado.
    const colunas = (await colunasDe(origem, tabela)).map((c) => c.nome);
    const chave = await chavePrimariaDe(origem, tabela);

    const a = await impressaoDe(origem, tabela, colunas, chave);
    const b = await impressaoDe(destino, tabela, colunas, chave);
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
