/**
 * Se o som está ligado e em que volume.
 *
 * **Mora no `localStorage`, não no save** — e isso é uma divergência
 * deliberada do cliente antigo, onde `soundOn` e `musicVolume` viviam
 * dentro do progresso (`js/save.js`) e o `soundOn` ainda viajava no relay
 * do co-op (`js/multiplayer.js`), sincronizando o botão de som de um
 * jogador com o do outro — o que parece acidente, não intenção.
 *
 * Volume é preferência do aparelho: quem joga no ônibus e em casa quer
 * volumes diferentes, e nenhum dos dois é "o certo" pra guardar na conta.
 * Além disso o save novo é assinado e conferido contra trapaça pelo
 * servidor; acrescentar campo ali por causa de um controle de volume seria
 * pagar caro pelo motivo errado.
 */

const CHAVE = 'rpg-legend:som';

/** Mesmo volume inicial do cliente antigo (`main.js`). */
export const VOLUME_PADRAO = 0.28;

export interface PreferenciaDeSom {
  ligado: boolean;
  /** Volume geral, de 0 a 1: vale pra música e pros efeitos. */
  volume: number;
  /**
   * Volume dos efeitos **relativo** ao geral, de 0 a 1.
   *
   * Padrão 1, e isso é o que mantém quem já tinha preferência gravada
   * ouvindo exatamente o mesmo de antes. Se `efeitos` fosse o volume
   * absoluto dos efeitos, quem tivesse zerado o `volume` pra ficar no
   * silêncio voltaria a levar um susto no primeiro golpe.
   */
  efeitos: number;
}

/**
 * Referência estável de propósito: é o que o `useSyncExternalStore` usa
 * como retrato do servidor, e um objeto novo a cada chamada faria o React
 * renderizar em laço.
 */
export const PREFERENCIA_PADRAO: PreferenciaDeSom = { ligado: true, volume: VOLUME_PADRAO, efeitos: 1 };

const ouvintes = new Set<() => void>();
let cache: PreferenciaDeSom | null = null;

function entre0e1(valor: unknown, padrao: number): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.min(1, Math.max(0, numero)) : padrao;
}

export function lerPreferencia(): PreferenciaDeSom {
  if (cache) return cache;
  // No servidor não há `localStorage`, e esta função é chamada de dentro
  // de componente. Devolver o padrão é o que mantém o primeiro render
  // igual dos dois lados.
  if (typeof window === 'undefined') return PREFERENCIA_PADRAO;

  try {
    const cru: unknown = JSON.parse(window.localStorage.getItem(CHAVE) ?? 'null');
    if (cru && typeof cru === 'object') {
      const guardado = cru as Record<string, unknown>;
      // `efeitos` nasceu depois. Ausente vira 1 — quem gravou antes ouve
      // igual ao que ouvia, com os efeitos no volume geral.
      cache = {
        ligado: guardado.ligado !== false,
        volume: entre0e1(guardado.volume, VOLUME_PADRAO),
        efeitos: entre0e1(guardado.efeitos, 1),
      };
      return cache;
    }
  } catch {
    /* localStorage bloqueado ou conteúdo estragado: cai no padrão */
  }
  cache = PREFERENCIA_PADRAO;
  return cache;
}

export function gravarPreferencia(preferencia: PreferenciaDeSom): void {
  cache = {
    ligado: preferencia.ligado,
    volume: entre0e1(preferencia.volume, VOLUME_PADRAO),
    efeitos: entre0e1(preferencia.efeitos, 1),
  };
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(cache));
  } catch {
    /* modo privado pode recusar a escrita; o som continua funcionando nesta sessão */
  }
  for (const ouvinte of ouvintes) ouvinte();
}

/** Avisa quem precisa reagir na hora — o volume da música, por exemplo. */
export function assinarPreferencia(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}
