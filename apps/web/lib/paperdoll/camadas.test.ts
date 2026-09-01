import { describe, expect, it } from 'vitest';

import { ARMADURAS, ARMAS, CORPOS, ehArma, ehSegurada, montarCamadas } from './camadas';

/** Onde a peça aparece na pilha, ou -1. Trás para frente. */
function posicao(camadas: string[], trecho: string): number {
  return camadas.findIndex((c) => c.includes(trecho));
}

describe('montarCamadas', () => {
  it('sem raça, ou raça sem corpo, não há o que desenhar', () => {
    expect(montarCamadas({ raca: null })).toEqual([]);
    expect(montarCamadas({ raca: 'anao' })).toEqual([]);
  });

  it('a raça nua já vem vestida com o básico', () => {
    expect(montarCamadas({ raca: 'humano' })).toEqual([
      '/img/paperdoll/corpo/humano.png',
      '/img/paperdoll/base/calca.png',
      '/img/paperdoll/base/roupa.png',
      '/img/paperdoll/cabelo/masculino.png',
    ]);
  });

  it('só entra o que tem arte — o resto some sem quebrar', () => {
    const comArte = montarCamadas({ raca: 'humano', arma: 'espada', armadura: 'placas', secundaria: 'escudo' });
    expect(posicao(comArte, 'arma/espada')).toBeGreaterThan(-1);

    // `marreta` e `couro` existem como item e não têm camada.
    const semArte = montarCamadas({ raca: 'humano', arma: 'marreta', armadura: 'couro' });
    expect(posicao(semArte, 'arma/')).toBe(-1);
    expect(posicao(semArte, 'armadura/')).toBe(-1);
    expect(ARMAS.has('marreta')).toBe(false);
    expect(ARMADURAS.has('couro')).toBe(false);
  });

  it('felino e morto-vivo não levam cabelo humano por cima', () => {
    expect(posicao(montarCamadas({ raca: 'felino' }), 'cabelo/')).toBe(-1);
    expect(posicao(montarCamadas({ raca: 'morto_vivo' }), 'cabelo/')).toBe(-1);
  });

  /**
   * O outro lado da mesma decisão, e o que impede que ela vire acidente.
   *
   * Draconato e Celestial *parecem* candidatos ao `SEM_CABELO` — um tem
   * chifres, o outro auréola —, e a tentação de acrescentá-los é real. Mas
   * a arte diz o contrário: contando os pixels do topo da cabeça, o
   * draconato tem o perfil do elfo (10 escuros / 30 claros) e o celestial
   * tem exatamente o do meio-elfo (4 / 36); nenhum se parece com a caveira
   * lisa do morto-vivo (0 / 48) nem com o pelo do felino (32 / 26). O
   * Breno desenhou as duas cabeças com a calota parcial que espera a
   * camada. Ver a tabela em `SEM_CABELO`.
   */
  it.each(['draconato', 'celestial'])('%s leva cabelo — a cabeça foi desenhada esperando por ele', (raca) => {
    expect(posicao(montarCamadas({ raca }), 'cabelo/')).toBeGreaterThan(-1);
  });

  describe('traço da raça', () => {
    it('o felino leva as orelhas; quem não tem traço não ganha camada extra', () => {
      expect(posicao(montarCamadas({ raca: 'felino' }), 'orelhas-de-gato')).toBeGreaterThan(-1);
      expect(posicao(montarCamadas({ raca: 'humano' }), 'orelhas-de-gato')).toBe(-1);
    });

    /**
     * O caminho inteiro, pasta incluída.
     *
     * Os outros testes casam só pelo nome do arquivo, e por isso nenhum
     * deles reclamou quando a pasta saiu de `acessorio/` pra `traco/` — o
     * caminho teria ficado errado e a suíte, verde. Caminho errado aqui não
     * dá exceção: dá 404 e um quadrado quebrado na tela, que é exatamente o
     * que a lista escrita à mão deste módulo existe pra evitar.
     */
    it('o caminho do traço aponta pra pasta que existe no disco', () => {
      expect(montarCamadas({ raca: 'felino' })).toContain('/img/paperdoll/traco/orelhas-de-gato.png');
    });

    /**
     * O motivo de a camada existir.
     *
     * A armadura de placas tem capacete. Desenhada por último, ela cobre a
     * cabeça — e o felino de armadura ficaria indistinguível do humano de
     * armadura. A pessoa escolheu a raça e a perderia de vista exatamente
     * quando o personagem fica mais forte.
     */
    it('as orelhas ficam POR CIMA da armadura — é o ponto inteiro', () => {
      const camadas = montarCamadas({ raca: 'felino', armadura: 'placas' });
      expect(posicao(camadas, 'orelhas-de-gato')).toBeGreaterThan(posicao(camadas, 'armadura/placas'));
    });

    /** Escudo e arma são objetos segurados na frente do corpo. */
    it('mas por baixo do que a mão segura', () => {
      const camadas = montarCamadas({ raca: 'felino', armadura: 'placas', secundaria: 'escudo', arma: 'espada' });
      const orelhas = posicao(camadas, 'orelhas-de-gato');
      expect(orelhas).toBeLessThan(posicao(camadas, 'secundaria/escudo'));
      expect(orelhas).toBeLessThan(posicao(camadas, 'arma/espada'));
    });

    /**
     * Virão outras raças com traço. Se alguém acrescentar uma sem corpo
     * desenhado, ela não pode aparecer flutuando: a guarda de `CORPOS` vem
     * antes de tudo e este teste prende isso.
     */
    it('traço sem corpo não desenha nada', () => {
      for (const raca of ['anao', 'orc', 'goblin', 'fada']) {
        expect(CORPOS.has(raca)).toBe(false);
        expect(montarCamadas({ raca })).toEqual([]);
      }
    });

    /**
     * Chegaram junto com os corpos, e é o par que importa: o corpo já
     * traz chifres e auréola desenhados, e o traço é a **segunda** cópia
     * deles, pra sobreviver ao capacete. Sem o traço, o draconato de
     * armadura de placas fica idêntico ao humano de armadura de placas —
     * a pessoa escolheu a raça e a perderia de vista.
     */
    it.each([
      ['draconato', 'chifres-de-dragao'],
      ['celestial', 'aureola'],
    ])('o %s leva o traço por cima da armadura', (raca, arquivo) => {
      const camadas = montarCamadas({ raca, armadura: 'placas' });

      expect(camadas).toContain(`/img/paperdoll/traco/${arquivo}.png`);
      expect(posicao(camadas, arquivo)).toBeGreaterThan(posicao(camadas, 'armadura/placas'));
    });

    /**
     * A ordem entre cabelo e armadura já esteve invertida, e nada acusou:
     * o boneco só ficava com o cabelo caindo por cima do peitoral. Com uma
     * camada de cabelo só, a peça tem que cobrir — é o que dá pra fazer sem
     * separar frente e costas do penteado.
     */
    it('a armadura cobre o cabelo, e não o contrário', () => {
      const camadas = montarCamadas({ raca: 'humano', armadura: 'placas' });

      expect(posicao(camadas, 'cabelo/')).toBeLessThan(posicao(camadas, 'armadura/placas'));
    });
  });
});

/**
 * O que fica **na mão** sai do corte da cintura e é desenhado inteiro.
 *
 * Duas coisas dependem disso. A primeira é um defeito que existia calado:
 * a adaga ocupa y 40..48 e o corte fica em 48, então as linhas 46 e 47 dela
 * iam na cópia do tronco — que sobe 2 px ao respirar — e a 48 na das
 * pernas, que não sobe; a lâmina se rasgava. A segunda é o giro do golpe:
 * camada partida em duas cópias recortadas não tem como rodar em torno de
 * um pivô só.
 */
describe('o que está na mão', () => {
  const vestido = montarCamadas({ raca: 'humano', armadura: 'placas', arma: 'espada', secundaria: 'escudo' });

  it('arma e escudo contam como segurados; o resto, não', () => {
    expect(vestido.filter(ehSegurada)).toEqual(['/img/paperdoll/secundaria/escudo.png', '/img/paperdoll/arma/espada.png']);
  });

  it('nenhuma peça vestida entra na conta', () => {
    for (const camada of vestido.filter((c) => !ehSegurada(c))) {
      expect(camada).toMatch(/\/(corpo|base|cabelo|armadura|traco)\//);
    }
  });

  /**
   * Só a mão principal gira. O escudo é defesa: vê-lo girando junto faria
   * o boneco parecer que bate com os dois braços ao mesmo tempo.
   */
  it('só a mão principal gira', () => {
    expect(vestido.filter(ehArma)).toEqual(['/img/paperdoll/arma/espada.png']);
    expect(ehArma('/img/paperdoll/secundaria/escudo.png')).toBe(false);
  });

  /**
   * `secundaria/adaga.png` e `arma/adaga.png` existem os dois. Um prefixo
   * frouxo — procurar só por "adaga", ou por "arma" em qualquer posição —
   * confundiria a adaga de mão secundária com a principal, e o escudo
   * começaria a girar junto.
   */
  it('a adaga na mão secundária não é a arma que gira', () => {
    expect(ehSegurada('/img/paperdoll/secundaria/adaga.png')).toBe(true);
    expect(ehArma('/img/paperdoll/secundaria/adaga.png')).toBe(false);
    expect(ehArma('/img/paperdoll/arma/adaga.png')).toBe(true);
  });

  it('sem nada na mão, não há camada segurada', () => {
    expect(montarCamadas({ raca: 'humano' }).filter(ehSegurada)).toEqual([]);
  });
});
