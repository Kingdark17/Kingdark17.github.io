import { describe, expect, it } from 'vitest';

import { ARMADURAS, ARMAS, CORPOS, ehSegurada, maoDaCamada, montarCamadas } from './camadas';

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
   * a arte diz o contrário: o Breno desenhou as duas cabeças com a calota
   * parcial que espera a camada, e nenhuma das duas resolve a cabeça
   * sozinha como o pelo do felino ou a caveira do morto-vivo.
   *
   * Este comentário já citou uma contagem de pixels claros e escuros do
   * topo como prova. **Ela não provava nada** — mede tinta, não forma; ver
   * `SEM_CABELO`, onde o orc em duas cores derrubou o método. A decisão
   * segue a mesma, o argumento é que estava errado.
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
      // Encolhe conforme a arte chega: o orc e o goblin saíram daqui quando
      // os corpos deles entraram. Sobram anão e fada.
      for (const raca of ['anao', 'fada']) {
        expect(CORPOS.has(raca)).toBe(false);
        expect(montarCamadas({ raca })).toEqual([]);
      }
    });

    /**
     * Cabeça humanoide comum espera a camada de cabelo — só pelo denso
     * (felino) e caveira lisa (morto_vivo) resolvem a cabeça sozinhos. Ver
     * `SEM_CABELO`, e por que a contagem de pixels claros/escuros que já
     * decidiu isso não serve.
     */
    it.each(['goblin', 'orc'])('o %s leva cabelo, como as outras cabeças humanoides', (raca) => {
      expect(CORPOS.has(raca)).toBe(true);
      expect(montarCamadas({ raca })).toContain('/img/paperdoll/cabelo/masculino.png');
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
 * As partes de uma peça de armadura — o vocabulário do doc do Breno.
 *
 * Uma armadura nem sempre é uma camada só: o manto do mago tem contorno e
 * preenchimento, e o chapéu é a parte de cabeça da mesma peça. Achatar tudo
 * num PNG dá a mesma tela **hoje** e impede, pra sempre, que algo seja
 * desenhado entre duas partes.
 */
describe('as partes da armadura', () => {
  const comRobe = montarCamadas({ raca: 'humano', armadura: 'robe' });

  it('o robe traz tronco e cabeça além da peça base', () => {
    expect(comRobe).toContain('/img/paperdoll/armadura/robe.png');
    expect(comRobe).toContain('/img/paperdoll/badd/robe.png');
    expect(comRobe).toContain('/img/paperdoll/hadd/robe.png');
  });

  /** Perna primeiro, depois tronco, depois cabeça: de baixo pra cima. */
  it('as partes vêm depois da peça base, de baixo pra cima', () => {
    expect(posicao(comRobe, 'armadura/robe')).toBeLessThan(posicao(comRobe, 'badd/robe'));
    expect(posicao(comRobe, 'badd/robe')).toBeLessThan(posicao(comRobe, 'hadd/robe'));
  });

  /**
   * O que mantém o traço valendo.
   *
   * O chapéu do mago cobre o rosto inteiro. Se o `hadd` fosse desenhado
   * depois do traço, o felino de chapéu voltaria a ser indistinguível do
   * humano de chapéu — e é exatamente isso que a camada de traço existe pra
   * impedir. Conferido na tela: as orelhas saem por cima da aba.
   */
  it('o traço da raça sobrevive à parte de cabeça da armadura', () => {
    const felino = montarCamadas({ raca: 'felino', armadura: 'robe' });

    expect(posicao(felino, 'hadd/robe')).toBeLessThan(posicao(felino, 'orelhas-de-gato'));
  });

  /** Armadura sem partes é o caso comum, e não é erro. */
  it('peça sem partes desenhadas não inventa camada', () => {
    const placas = montarCamadas({ raca: 'humano', armadura: 'placas' });

    expect(placas.some((c) => c.includes('/badd/') || c.includes('/hadd/') || c.includes('/ladd/'))).toBe(false);
  });

  /** Sem armadura equipada, parte de armadura nenhuma entra. */
  it('sem armadura não há partes', () => {
    expect(montarCamadas({ raca: 'humano' }).some((c) => c.includes('add/'))).toBe(false);
  });

  /**
   * Asa e cauda saem das costas: desenhá-las depois do corpo faria a asa
   * passar por cima do peito. Ainda não há arte — o que este teste prende é
   * a **guarda**, pra que a camada não apareça antes do arquivo existir.
   */
  it('o que fica atrás do corpo vem antes dele, e só quando existe', () => {
    for (const raca of CORPOS) {
      const camadas = montarCamadas({ raca });
      const costas = posicao(camadas, 'back/');
      if (costas === -1) continue;
      expect(costas).toBeLessThan(posicao(camadas, 'corpo/'));
    }
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
   * O escudo é defesa e fica parado; a adaga da mão secundária é arma e
   * gira. A checagem antiga olhava só a pasta, então prendia as duas
   * juntas — era o bug que o Breno abriu como "arma na segunda mão não tem
   * animação de ataque".
   */
  it('cada mão sabe se é arma, e o escudo não é', () => {
    expect(maoDaCamada('/img/paperdoll/arma/espada.png')).toBe('principal');
    expect(maoDaCamada('/img/paperdoll/secundaria/adaga.png')).toBe('secundaria');
    expect(maoDaCamada('/img/paperdoll/secundaria/escudo.png')).toBeNull();
  });

  /** Peça vestida não gira, por mais que esteja na pilha. */
  it('o que não está na mão não gira', () => {
    for (const camada of vestido.filter((c) => !ehSegurada(c))) {
      expect(maoDaCamada(camada)).toBeNull();
    }
  });

  /**
   * `secundaria/adaga.png` e `arma/adaga.png` existem os dois e são a mesma
   * arte. Quem decide o pivô é a **pasta**, porque os punhos são pontos
   * diferentes — 31,4%/68,6% contra 72,6%/70,1%. Trocar os dois faria a
   * lâmina girar em torno do braço errado.
   */
  it('a mesma adaga gira em torno de punhos diferentes em cada mão', () => {
    expect(maoDaCamada('/img/paperdoll/arma/adaga.png')).toBe('principal');
    expect(maoDaCamada('/img/paperdoll/secundaria/adaga.png')).toBe('secundaria');
  });

  /**
   * Quem responde é o catálogo, não o nome do arquivo: o dia em que um item
   * novo puder ir pra mão secundária, ele acerta sozinho. Um id que não
   * existe no catálogo não é arma — e não pode explodir.
   */
  it('id desconhecido na mão secundária não gira nem quebra', () => {
    expect(maoDaCamada('/img/paperdoll/secundaria/coisa_que_nao_existe.png')).toBeNull();
  });

  it('sem nada na mão, não há camada segurada', () => {
    expect(montarCamadas({ raca: 'humano' }).filter(ehSegurada)).toEqual([]);
  });
});
