/**
 * A cópia Neon → Supabase exercitada contra **dois Postgres de verdade**.
 *
 * Dois PGlite separados, cada um atrás do seu socket, cada um com o DDL
 * original da produção. É o mais perto que dá pra chegar da virada sem
 * credencial: quem escreve é o mesmo código que escreveria lá.
 *
 * O teste que mais importa é o último — o da sequence. Ele é o único que
 * reproduz o estrago que só apareceria depois da virada, quando o primeiro
 * jogador criasse conta e colidisse com um id já copiado.
 */

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Client } from 'pg';

import { autorizaApagar, conferir, conferirSchemas, copiar, limparDestino, TABELAS_EM_ORDEM, TIPOS_COM_PRECISAO } from './copia';
import { ORIGINAL_DDL } from '../testing/original-ddl';

jest.setTimeout(120_000);

interface Banco {
  cliente: Client;
  parar: () => Promise<void>;
}

function portaAleatoria(): number {
  return 49152 + Math.floor(Math.random() * 10000);
}

async function subirBanco(): Promise<Banco> {
  const pglite = await PGlite.create();

  let servidor: PGLiteSocketServer | null = null;
  let porta = 0;
  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    porta = portaAleatoria();
    const candidato = new PGLiteSocketServer({ db: pglite, port: porta, host: '127.0.0.1', maxConnections: 10 });
    try {
      await candidato.start();
      servidor = candidato;
      break;
    } catch (erro) {
      ultimoErro = erro;
    }
  }
  if (!servidor) throw ultimoErro;

  for (const comando of ORIGINAL_DDL) await pglite.exec(comando);

  // `types` igual ao da CLI de propósito: sem isso o teste roda com um
  // cliente diferente do que vira produção, e foi assim que a perda de
  // microssegundo passou batido aqui e só apareceu na virada de verdade.
  const cliente = new Client({
    connectionString: `postgres://postgres:postgres@127.0.0.1:${porta}/postgres`,
    types: TIPOS_COM_PRECISAO,
  });
  await cliente.connect();

  return {
    cliente,
    async parar() {
      await cliente.end();
      await servidor.stop();
      await pglite.close();
    },
  };
}

let origem: Banco;
let destino: Banco;

/**
 * Semente com o que costuma quebrar: e-mail nulo (o índice único é
 * parcial), acento e emoji no corpo da mensagem, e um `jsonb` que começa
 * com **array** no topo — é o caso que viraria literal de array do
 * Postgres se alguém esquecer o `::jsonb`.
 */
async function semear(cliente: Client): Promise<void> {
  const senha = (n: number) => ({ hash: `hash_${n}`.padEnd(64, '0'), sal: `sal_${n}`.padEnd(32, 'f') });

  for (let i = 1; i <= 3; i += 1) {
    const { hash, sal } = senha(i);
    await cliente.query(
      `insert into users (username, password_hash, password_salt, email, cosmetics, pet, name_color)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        `jogador${i}`,
        hash,
        sal,
        i === 2 ? null : `jogador${i}@exemplo.com`,
        JSON.stringify({ frames: ['none', 'ouro'], colors: ['#e8d7a5', '#ffffff'], pets: ['none', 'dragao'] }),
        i === 1 ? 'dragao' : 'none',
        '#e8d7a5',
      ],
    );
  }

  // Microssegundo cravado à mão. O `now()` do PGlite quase sempre traz as
  // seis casas, mas "quase sempre" é como se escreve teste que pisca. Este
  // valor é o da virada real, onde a truncagem apareceu pela primeira vez.
  await cliente.query(`update users set created_at = '2026-08-10 14:21:32.826884+00' where id = 1`);

  await cliente.query(`insert into sessions (token_hash, user_id, expires_at) values ($1, 1, now() + interval '7 days')`, ['a'.repeat(64)]);
  await cliente.query(`insert into sessions (token_hash, user_id, expires_at) values ($1, 2, now() + interval '7 days')`, ['b'.repeat(64)]);

  const save = {
    hero: { name: 'Kaelen, o Bravo', race: 'Meio-Elfo', raceId: 'meio_elfo', level: 7, equip: { arma: { templateId: 'machado' } } },
    inventory: [
      { uid: 'a1', templateId: 'pot_vida', qtd: 3 },
      { uid: 'a2', templateId: 'machado', qtd: 1 },
    ],
    floor: 3,
  };
  await cliente.query(`insert into cloud_saves (user_id, slot, data) values (1, 1, $1::jsonb), (1, 2, $2::jsonb), (2, 1, $3::jsonb)`, [
    JSON.stringify(save),
    JSON.stringify({ ...save, floor: 9 }),
    JSON.stringify({ ...save, hero: { ...save.hero, name: 'Lyra' } }),
  ]);

  // `data` começando com array no topo: o caso do `::jsonb` esquecido.
  await cliente.query(`insert into cloud_save_history (user_id, slot, data) values (1, 1, $1::jsonb), (1, 1, $2::jsonb)`, [
    JSON.stringify([{ passo: 1 }, { passo: 2 }]),
    JSON.stringify(save),
  ]);

  await cliente.query(`insert into friend_requests (from_id, to_id) values (1, 3), (3, 2)`);
  await cliente.query(`insert into friendships (user_id, friend_id) values (1, 2), (2, 1)`);
  await cliente.query(`insert into chat_messages (sender_id, recipient_id, body) values (1, 2, $1), (2, 1, $2)`, [
    'Opa, bora pra masmorra? 🐉',
    'Bora — só preciso de poção de vida, tô com 3 só',
  ]);
}

async function contar(cliente: Client, tabela: string): Promise<number> {
  const { rows } = await cliente.query<{ n: string }>(`select count(*)::text as n from public."${tabela}"`);
  return Number(rows[0].n);
}

beforeAll(async () => {
  [origem, destino] = await Promise.all([subirBanco(), subirBanco()]);
  await semear(origem.cliente);
});

afterAll(async () => {
  await origem?.parar();
  await destino?.parar();
});

describe('cópia Neon → Supabase', () => {
  it('os dois schemas são compatíveis', async () => {
    await expect(conferirSchemas(origem.cliente, destino.cliente)).resolves.toEqual([]);
  });

  it('sem `escrever`, não escreve nada — e ainda assim relata o tamanho da origem', async () => {
    const relatorio = await copiar(origem.cliente, destino.cliente);

    expect(relatorio.escreveu).toBe(false);
    expect(relatorio.tabelas.find((t) => t.tabela === 'users')?.naOrigem).toBe(3);
    expect(relatorio.tabelas.every((t) => t.inseridas === 0)).toBe(true);

    for (const tabela of TABELAS_EM_ORDEM) {
      expect(await contar(destino.cliente, tabela)).toBe(0);
    }
  });

  it('copia as sete tabelas', async () => {
    const relatorio = await copiar(origem.cliente, destino.cliente, { escrever: true, lote: 2 });

    expect(relatorio.escreveu).toBe(true);
    const porTabela = Object.fromEntries(relatorio.tabelas.map((t) => [t.tabela, t.inseridas]));
    expect(porTabela).toEqual({
      users: 3,
      sessions: 2,
      cloud_saves: 3,
      cloud_save_history: 2,
      friend_requests: 2,
      friendships: 2,
      chat_messages: 2,
    });
  });

  it('a conferência bate em todas as tabelas — contagem e conteúdo', async () => {
    const linhas = await conferir(origem.cliente, destino.cliente);

    for (const linha of linhas) {
      expect({ tabela: linha.tabela, bate: linha.bate }).toEqual({ tabela: linha.tabela, bate: true });
    }
  });

  /**
   * A armadilha 5, e ela escapou desta suíte uma vez.
   *
   * O Postgres guarda tempo em microssegundo; o `Date` do JS só chega a
   * milissegundo. Com o `pg` convertendo `timestamptz` em `Date`,
   * `12:53:15.421396` chegava no destino como `12:53:15.421` — sem erro,
   * sem mudar contagem. Na virada de verdade as sete tabelas com data
   * divergiram de uma vez, e foi isto.
   *
   * O teste antigo não pegava porque o `Client` daqui não usava o mesmo
   * `types` da CLI. Agora usa, e este caso prende o comportamento.
   */
  it('o microssegundo do timestamp sobrevive — `Date` do JS truncaria', async () => {
    const { rows } = await destino.cliente.query<{ criado: string }>(`select created_at::text as criado from users where id = 1`);
    // Passando por `Date`, isto viraria `...32.826`. As três últimas casas
    // são a prova.
    expect(rows[0].criado).toContain('14:21:32.826884');

    const iguais = await conferir(origem.cliente, destino.cliente);
    expect(iguais.find((l) => l.tabela === 'users')?.bate).toBe(true);
  });

  it('o `jsonb` que começa com array chegou como JSON, não como array do Postgres', async () => {
    const { rows } = await destino.cliente.query<{ data: unknown }>(`select data from cloud_save_history where jsonb_typeof(data) = 'array'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toEqual([{ passo: 1 }, { passo: 2 }]);
  });

  it('o e-mail nulo sobreviveu, e o índice único parcial aceitou', async () => {
    const { rows } = await destino.cliente.query<{ username: string; email: string | null }>(`select username, email from users order by id`);
    expect(rows.map((r) => r.email)).toEqual(['jogador1@exemplo.com', null, 'jogador3@exemplo.com']);
  });

  it('rodar de novo não duplica nada', async () => {
    const relatorio = await copiar(origem.cliente, destino.cliente, { escrever: true, lote: 2 });

    expect(relatorio.tabelas.every((t) => t.inseridas === 0)).toBe(true);
    expect(relatorio.tabelas.find((t) => t.tabela === 'users')?.puladas).toBe(3);

    for (const tabela of TABELAS_EM_ORDEM) {
      expect(await contar(destino.cliente, tabela)).toBe(await contar(origem.cliente, tabela));
    }
  });

  /**
   * O teste que justifica o arquivo. Sem `setval`, a sequence do destino
   * ainda estaria em zero e este insert devolveria `id = 1` — colidindo
   * com o jogador1 recém-copiado. Em produção isso só apareceria no
   * primeiro cadastro depois da virada.
   */
  it('a sequence foi realinhada: o próximo cadastro não colide', async () => {
    const { rows } = await destino.cliente.query<{ id: string }>(
      `insert into users (username, password_hash, password_salt) values ('recem_chegado', 'h', 's') returning id::text`,
    );
    expect(Number(rows[0].id)).toBe(4);
  });

  /**
   * O buraco do modo `inserir`, escrito como teste em vez de como aviso.
   *
   * `ON CONFLICT DO NOTHING` pula a linha que já existe — e `cloud_saves`
   * é a mesma chave `(user_id, slot)` com `data` novo a cada save. Numa
   * cópia quente, tudo que o jogador gravar depois da passada fica velho
   * no destino, e a segunda passada **não** conserta.
   */
  it('modo inserir NÃO traz alteração de linha existente — é o limite dele', async () => {
    // O teste da sequence deixou um usuário que só existe no destino. Sai
    // daqui pra diferença medida abaixo ser só a alteração, e não ele.
    await destino.cliente.query(`delete from users where username = 'recem_chegado'`);

    await origem.cliente.query(`update cloud_saves set data = jsonb_set(data, '{floor}', '99') where user_id = 1 and slot = 1`);
    await origem.cliente.query(`update users set pet = 'slime' where id = 1`);

    await copiar(origem.cliente, destino.cliente, { escrever: true });

    const { rows } = await destino.cliente.query<{ floor: number }>(
      `select (data->>'floor')::int as floor from cloud_saves where user_id = 1 and slot = 1`,
    );
    expect(rows[0].floor).toBe(3);

    const linhas = await conferir(origem.cliente, destino.cliente);
    expect(linhas.find((l) => l.tabela === 'cloud_saves')?.bate).toBe(false);
    expect(linhas.find((l) => l.tabela === 'users')?.bate).toBe(false);
  });

  it('modo espelhar traz a alteração e a conferência volta a bater', async () => {
    await copiar(origem.cliente, destino.cliente, { escrever: true, modo: 'espelhar' });

    const { rows } = await destino.cliente.query<{ floor: number }>(
      `select (data->>'floor')::int as floor from cloud_saves where user_id = 1 and slot = 1`,
    );
    expect(rows[0].floor).toBe(99);

    for (const linha of await conferir(origem.cliente, destino.cliente)) {
      expect({ tabela: linha.tabela, bate: linha.bate }).toEqual({ tabela: linha.tabela, bate: true });
    }
  });

  /**
   * Apagar na origem também não se propaga sozinho. `espelhar` remove do
   * destino a linha cuja chave sumiu — sem isso, um pedido de amizade
   * recusado voltaria a existir depois da virada.
   */
  it('modo espelhar apaga no destino o que sumiu na origem', async () => {
    await origem.cliente.query(`delete from friend_requests where from_id = 1 and to_id = 3`);
    await origem.cliente.query(`delete from sessions where user_id = 2`);

    const relatorio = await copiar(origem.cliente, destino.cliente, { escrever: true, modo: 'espelhar' });

    expect(relatorio.tabelas.find((t) => t.tabela === 'friend_requests')?.apagadas).toBe(1);
    expect(relatorio.tabelas.find((t) => t.tabela === 'sessions')?.apagadas).toBe(1);

    for (const linha of await conferir(origem.cliente, destino.cliente)) {
      expect({ tabela: linha.tabela, bate: linha.bate }).toEqual({ tabela: linha.tabela, bate: true });
    }
  });

  it('espelhar em ensaio continua sem escrever nada', async () => {
    await origem.cliente.query(`update users set name_color = '#ff0000' where id = 3`);

    const relatorio = await copiar(origem.cliente, destino.cliente, { modo: 'espelhar' });
    expect(relatorio.escreveu).toBe(false);

    const { rows } = await destino.cliente.query<{ cor: string }>(`select name_color as cor from users where id = 3`);
    expect(rows[0].cor).toBe('#e8d7a5');

    // Devolve a origem ao estado espelhado, pro teste seguinte não herdar diferença.
    await copiar(origem.cliente, destino.cliente, { escrever: true, modo: 'espelhar' });
  });

  it('recusa a cópia quando falta coluna no destino', async () => {
    await destino.cliente.query(`alter table users drop column pet`);
    try {
      await expect(conferirSchemas(origem.cliente, destino.cliente)).resolves.toEqual([expect.stringContaining('destino não tem users.pet')]);
      await expect(copiar(origem.cliente, destino.cliente, { escrever: true })).rejects.toThrow(/schemas incompatíveis/);
    } finally {
      await destino.cliente.query(`alter table users add column pet varchar(32) not null default 'none'`);
    }
  });

  /**
   * A limpeza do destino existe pelo caso real desta virada: o Supabase
   * tem a conta de teste do login de 22/08. Destino sujo + modo `inserir`
   * pode pular um jogador real cujo `id` bata com o da conta de teste.
   */
  describe('limpar o destino antes de copiar', () => {
    it('em ensaio, conta o que apagaria e não apaga', async () => {
      const antes = await contar(destino.cliente, 'users');
      expect(antes).toBeGreaterThan(0);

      const relatorio = await limparDestino(destino.cliente, false);

      expect(relatorio.apagou).toBe(false);
      expect(relatorio.total).toBeGreaterThan(0);
      expect(relatorio.porTabela.find((t) => t.tabela === 'users')?.linhas).toBe(antes);
      expect(await contar(destino.cliente, 'users')).toBe(antes);
    });

    it('esvazia as sete e zera as sequences', async () => {
      const relatorio = await limparDestino(destino.cliente, true);
      expect(relatorio.apagou).toBe(true);

      for (const tabela of TABELAS_EM_ORDEM) {
        expect(await contar(destino.cliente, tabela)).toBe(0);
      }

      // `RESTART IDENTITY` é metade do serviço: sem ele o destino ficaria
      // vazio mas com a sequence adiantada, e o primeiro cadastro pularia ids.
      const { rows } = await destino.cliente.query<{ id: string }>(
        `insert into users (username, password_hash, password_salt) values ('depois_da_limpeza', 'h', 's') returning id::text`,
      );
      expect(Number(rows[0].id)).toBe(1);
    });

    /**
     * A barreira que separa o usuário de apagar um banco. Cada caso aqui
     * é um jeito real de errar: esquecer a flag, herdar um número de uma
     * execução anterior, ou estar apontado pro banco errado — que aparece
     * como contagem inesperada.
     */
    describe('a barreira do --apagando', () => {
      it('recusa quando a flag não veio', () => {
        expect(autorizaApagar(2, undefined)).toEqual({ ok: false, motivo: 'faltou', total: 2 });
      });

      it('recusa string vazia — `--apagando=` sem número', () => {
        expect(autorizaApagar(2, '')).toEqual({ ok: false, motivo: 'faltou', total: 2 });
      });

      it('recusa número diferente do que está no banco', () => {
        expect(autorizaApagar(2, '999')).toEqual({ ok: false, motivo: 'nao-bate', total: 2, declarado: '999' });
      });

      it('recusa quando o destino tem MAIS do que o esperado — o sintoma de banco errado', () => {
        expect(autorizaApagar(4312, '2')).toEqual({ ok: false, motivo: 'nao-bate', total: 4312, declarado: '2' });
      });

      it('recusa lixo que não é número', () => {
        expect(autorizaApagar(2, 'dois')).toEqual({ ok: false, motivo: 'nao-bate', total: 2, declarado: 'dois' });
      });

      it('aceita só o número exato', () => {
        expect(autorizaApagar(2, '2')).toEqual({ ok: true });
        expect(autorizaApagar(0, '0')).toEqual({ ok: true });
      });
    });

    it('e a cópia num destino recém-limpo entrega tudo como novo', async () => {
      await limparDestino(destino.cliente, true);

      const relatorio = await copiar(origem.cliente, destino.cliente, { escrever: true, modo: 'espelhar' });

      expect(relatorio.tabelas.every((t) => t.atualizadas === 0 && t.apagadas === 0)).toBe(true);
      expect(relatorio.tabelas.find((t) => t.tabela === 'users')?.inseridas).toBe(3);

      for (const linha of await conferir(origem.cliente, destino.cliente)) {
        expect({ tabela: linha.tabela, bate: linha.bate }).toEqual({ tabela: linha.tabela, bate: true });
      }
    });
  });
});
