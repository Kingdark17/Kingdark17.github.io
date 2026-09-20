import { describe, expect, it } from 'vitest';

import { ARMADURAS, ARMAS, CABELO_PADRAO, CABELOS, CORPOS, PENTEADOS, ehSegurada, maoDaCamada, montarCamadas } from './camadas';

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
      '/img/paperdoll/cabelo/curto.png',
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
      expect(montarCamadas({ raca })).toContain('/img/paperdoll/cabelo/curto.png');
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

  /**
   * O penteado virou escolha em 2026-09-20. Antes havia um só, chumbado.
   */
  describe('escolha de penteado', () => {
    it('o escolhido é o que desenha', () => {
      expect(montarCamadas({ raca: 'humano', cabelo: 'longo' })).toContain('/img/paperdoll/cabelo/longo.png');
      expect(montarCamadas({ raca: 'humano', cabelo: 'medio' })).toContain('/img/paperdoll/cabelo/medio.png');
    });

    /**
     * Ninguém que já tem personagem escolheu penteado — o campo nasceu
     * depois deles. Cair no padrão é o que impede a leva inteira de ficar
     * careca de um dia pro outro.
     */
    it('sem escolha, e com escolha que não existe, vai o padrão', () => {
      for (const cabelo of [undefined, null, '', 'moicano_de_fogo']) {
        expect(montarCamadas({ raca: 'humano', cabelo })).toContain(`/img/paperdoll/cabelo/${CABELO_PADRAO}.png`);
      }
    });

    /** Raça sem cabelo desenhado ignora a escolha em vez de obedecer. */
    it('felino e morto-vivo continuam sem cabelo, mesmo escolhendo', () => {
      expect(posicao(montarCamadas({ raca: 'felino', cabelo: 'longo' }), 'cabelo/')).toBe(-1);
      expect(posicao(montarCamadas({ raca: 'morto_vivo', cabelo: 'longo' }), 'cabelo/')).toBe(-1);
    });

    /**
     * O comentário do módulo previa que penteado longo exigiria duas
     * camadas — uma atrás do corpo, outra na frente — e que a hora seria
     * quando existisse um. Existe, e não exigiu: ele desce até a linha 32
     * e a roupa começa na 26, então a sobreposição cai na altura do ombro,
     * onde cabelo por cima é o certo. Este teste prende o arranjo que foi
     * conferido na tela; se um penteado na cintura chegar, ele quebra o
     * raciocínio e não o teste — por isso o comentário ficou no módulo.
     */
    /**
     * Tabela escrita à mão contra o disco, nos dois sentidos. Faltando um
     * lado, a falha é silenciosa: id sem arte vira 404 na amostra da
     * criação, e arte sem id some da lista sem ninguém perceber que o
     * penteado novo nunca apareceu pra escolher.
     */
    it('a lista da criação e a arte no disco cobrem uma à outra', () => {
      expect(PENTEADOS.map((p) => p.id).sort()).toEqual([...CABELOS].sort());
    });

    it('o padrão está entre os que dá pra escolher', () => {
      expect(PENTEADOS.map((p) => p.id)).toContain(CABELO_PADRAO);
    });

    it('todo penteado usa uma camada só, na mesma posição da pilha', () => {
      for (const cabelo of CABELOS) {
        const camadas = montarCamadas({ raca: 'humano', cabelo, armadura: 'placas' });
        expect(camadas.filter((c) => c.includes('/cabelo/'))).toHaveLength(1);
        expect(posicao(camadas, 'cabelo/')).toBeLessThan(posicao(camadas, 'armadura/placas'));
      }
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
  const conjuntoDePlacas = { raca: 'humano', armadura: 'placas', elmo: 'placas_elmo', calca: 'placas_calca' };

  /**
   * A divisão de 2026-09-20: até então `ladd` e `hadd` saíam do **mesmo**
   * `templateId` da armadura. Agora cada camada responde ao seu slot, e é
   * isso que faz elmo e perneira serem peças que se acham separadas.
   */
  it('cada camada vem do seu próprio slot', () => {
    const camadas = montarCamadas(conjuntoDePlacas);

    expect(camadas).toContain('/img/paperdoll/armadura/placas.png');
    expect(camadas).toContain('/img/paperdoll/hadd/placas_elmo.png');
    expect(camadas).toContain('/img/paperdoll/ladd/placas_calca.png');
  });

  it('elmo e perneira desenham sem peitoral nenhum', () => {
    const soElmo = montarCamadas({ raca: 'humano', elmo: 'placas_elmo' });

    expect(soElmo).toContain('/img/paperdoll/hadd/placas_elmo.png');
    expect(soElmo.some((c) => c.includes('/armadura/'))).toBe(false);
  });

  /**
   * O chapéu do mago vinha junto com o robe, porque os dois eram a mesma
   * peça: quem vestisse o Robe Arcano ganhava o chapéu de brinde, fosse da
   * classe que fosse, com a aba tapando o rosto. Agora ele é do slot de
   * elmo, e quem quiser chapéu veste chapéu.
   *
   * (O item ainda não existe — veio o `_body` e não veio o ícone —, então
   * hoje o efeito prático é o chapéu não aparecer mais sozinho.)
   */
  it('o robe não traz mais chapéu de brinde', () => {
    const comRobe = montarCamadas({ raca: 'humano', armadura: 'robe' });

    expect(comRobe).toContain('/img/paperdoll/armadura/robe.png');
    expect(comRobe).toContain('/img/paperdoll/badd/robe.png');
    expect(comRobe.some((c) => c.includes('/hadd/'))).toBe(false);
  });

  /** Perna primeiro, depois tronco, depois cabeça: de baixo pra cima. */
  it('as camadas se empilham de baixo pra cima', () => {
    const camadas = montarCamadas({ ...conjuntoDePlacas, armadura: 'robe' });

    expect(posicao(camadas, 'ladd/placas_calca')).toBeLessThan(posicao(camadas, 'armadura/robe'));
    expect(posicao(camadas, 'armadura/robe')).toBeLessThan(posicao(camadas, 'badd/robe'));
    expect(posicao(camadas, 'badd/robe')).toBeLessThan(posicao(camadas, 'hadd/placas_elmo'));
  });

  /**
   * O que mantém o traço valendo.
   *
   * Peça de cabeça cobre o rosto inteiro. Se o `hadd` fosse desenhado
   * depois do traço, o felino de elmo voltaria a ser indistinguível do
   * humano de elmo — e é exatamente isso que a camada de traço existe pra
   * impedir. Conferido na tela com o chapéu do mago: as orelhas saem por
   * cima da aba.
   */
  it('o traço da raça sobrevive à parte de cabeça da armadura', () => {
    const felino = montarCamadas({ raca: 'felino', elmo: 'placas_elmo' });

    expect(posicao(felino, 'hadd/placas_elmo')).toBeLessThan(posicao(felino, 'orelhas-de-gato'));
  });

  /**
   * Peça equipada sem arte não desenha nada e não quebra. É o caso da
   * armadura de couro: ela tem item, tem ícone e não tem `_body`, e é assim
   * que ela deve se comportar até a camada chegar.
   */
  it('peça equipada num slot sem arte não inventa camada', () => {
    const semArte = montarCamadas({ raca: 'humano', armadura: 'couro', elmo: 'couro', calca: 'couro' });

    expect(semArte.some((c) => c.includes('/armadura/') || c.includes('add/'))).toBe(false);
  });

  it('a bota desenha pelo slot dela', () => {
    const calcado = montarCamadas({ raca: 'humano', botas: 'botas' });

    expect(calcado).toContain('/img/paperdoll/botas/botas.png');
  });

  /**
   * **A bota vem depois da perneira, e é a única peça fora da ordem
   * baixo-pra-cima.**
   *
   * Não é descuido: as duas perneiras que existem desenham o próprio
   * calçado até a mesma linha em que a bota acaba. Sob elas a bota some
   * inteira — desenhado e conferido, "sob placas" saiu pixel por pixel
   * igual a "sem bota" —, e um slot que não muda nada pra quem veste
   * perneira não valeria a arte.
   *
   * Este teste é o que impede a ordem de ser "arrumada" mais tarde por
   * alguém lendo a lista e achando que o pé deveria vir antes da canela.
   */
  it('a bota fica por cima da perneira, senão não apareceria', () => {
    const camadas = montarCamadas({ ...conjuntoDePlacas, botas: 'botas' });

    expect(posicao(camadas, 'ladd/placas_calca')).toBeLessThan(posicao(camadas, 'botas/botas'));
  });

  /** As Botas do Vento têm item e slot, e ainda não têm `_body`. */
  it('bota sem camada desenhada não entra', () => {
    expect(montarCamadas({ raca: 'humano', botas: 'bota_vento' }).some((c) => c.includes('/botas/'))).toBe(false);
  });

  /** Sem armadura equipada, parte de armadura nenhuma entra. */
  it('sem armadura não há partes', () => {
    expect(montarCamadas({ raca: 'humano' }).some((c) => c.includes('add/'))).toBe(false);
  });

  /**
   * O acessório vai **por cima** da armadura, e isso foi decidido olhando
   * a tela: por baixo do peitoral de placas o amuleto some inteiro, e uma
   * camada que não aparece pra quem veste armadura não serve de nada.
   */
  it('o acessório fica por cima da armadura inteira', () => {
    const comTudo = montarCamadas({ raca: 'humano', armadura: 'placas', acessorio: 'amuleto_sab' });

    expect(comTudo).toContain('/img/paperdoll/acessorio/amuleto_sab.png');
    expect(posicao(comTudo, 'armadura/placas')).toBeLessThan(posicao(comTudo, 'acessorio/'));
    expect(posicao(comTudo, 'hadd/placas')).toBeLessThan(posicao(comTudo, 'acessorio/'));
  });

  /** Mas nunca na frente do traço: equipamento não passa na frente de quem a pessoa é. */
  it('o traço da raça continua por cima do acessório', () => {
    const felino = montarCamadas({ raca: 'felino', acessorio: 'amuleto_sab' });

    expect(posicao(felino, 'acessorio/')).toBeLessThan(posicao(felino, 'orelhas-de-gato'));
  });

  /** Acessório sem arte — o Anel das Sombras ainda não tem — não vira 404. */
  it('acessório sem camada desenhada não entra', () => {
    expect(montarCamadas({ raca: 'humano', acessorio: 'anel_som' }).some((c) => c.includes('/acessorio/'))).toBe(false);
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
      expect(camada).toMatch(/\/(back|corpo|base|cabelo|armadura|ladd|badd|hadd|traco)\//);
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
