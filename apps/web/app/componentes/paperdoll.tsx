/* eslint-disable @next/next/no-img-element */

/**
 * O boneco: as camadas do paperdoll empilhadas, e o que ele sente.
 *
 * **`<img>` em posição absoluta, e não PixiJS nem `<canvas>`.** A tabela de
 * decisões da migração fixa PixiJS pro personagem 2D, e continua valendo —
 * mas pro boneco que **troca de quadro**, que é o que o CSS não faz.
 * Respirar parado é mover o boneco inteiro; brilho, tinta e piscada de dano
 * são filtro sobre a imagem. O navegador faz os quatro sozinho, e
 * `image-rendering: pixelated` sai mais fiel que reamostragem de textura.
 * O Pixi entra quando existir arte de quadros — golpe, andar —, e este
 * componente é o que ele substitui então.
 *
 * Sem estado e sem efeito: é Server Component onde o chamador for servidor,
 * e não manda uma linha de JS quando é. Os sinais chegam prontos por
 * propriedade e viram atributo de dado; **toda** a animação está no CSS.
 */

import { ehSegurada, maoDaCamada, montarCamadas, type Vestimenta } from '@/lib/paperdoll/camadas';
import { corDaAura, type SinaisVitais } from '@/lib/paperdoll/sinais';
import styles from './paperdoll.module.css';

interface Props extends Vestimenta {
  /** Lado em pixels. O sprite é 64×64; múltiplos de 64 saem mais nítidos. */
  lado?: number;
  /** Mostrado quando a raça ainda não tem corpo desenhado. */
  reserva?: React.ReactNode;
  /**
   * Classe do chamador, aplicada na raiz — é por onde entra o balão
   * (`composes: balao from acabamento.module.css`). Existe pra as telas
   * não precisarem alcançar aqui dentro com `> :first-child`, que é um
   * seletor que quebra em silêncio no dia em que a raiz deixar de ser o
   * primeiro filho do contêiner.
   */
  className?: string;
  /**
   * O que o boneco sente — ver `lib/paperdoll/sinais.ts`. Omitido, ele fica
   * parado como antes: é o que serve pra ícone e pra retrato de lista.
   */
  sinais?: SinaisVitais;
}

/**
 * As camadas viradas em `<img>`.
 *
 * `alt` vazio de propósito: as camadas juntas são uma figura só, e quem lê
 * a tela não ganha nada ouvindo "corpo, calça, roupa, cabelo, espada".
 * Quem descreve o boneco é o chamador.
 */
function empilhar(camadas: string[]) {
  return camadas.map((camada) => (
    // `data-arma` guarda **qual mão**, e não só "é arma": cada punho tem
    // pivô e sentido próprios, e o CSS escolhe por esse valor. Assim a
    // camada é alcançada sem depender de ser "a última", que é verdade hoje
    // e deixaria de ser no dia em que uma camada nova entrar depois.
    <img
      key={camada}
      className={styles.camada}
      data-arma={maoDaCamada(camada) ?? undefined}
      src={camada}
      alt=""
      width={64}
      height={64}
    />
  ));
}

export function Paperdoll({
  raca,
  arma,
  armadura,
  elmo,
  calca,
  secundaria,
  acessorio,
  lado = 192,
  reserva = null,
  className = '',
  sinais = {},
}: Readonly<Props>) {
  const camadas = montarCamadas({ raca, arma, armadura, elmo, calca, secundaria, acessorio });
  const classes = `${styles.boneco} ${className}`.trim();

  if (camadas.length === 0) {
    return (
      <div className={classes} style={{ width: lado, height: lado }}>
        {reserva}
      </div>
    );
  }

  const aura = corDaAura(sinais.aura);

  // O que está vestido é recortado na cintura; o que está na mão, não. Ver
  // `ehSegurada`: a adaga cruza a linha do corte e se rasgava na
  // respiração, e camada partida em duas cópias não teria como girar.
  const doCorpo = camadas.filter((camada) => !ehSegurada(camada));
  const nasMaos = camadas.filter(ehSegurada);

  return (
    <div className={classes} style={{ width: lado, height: lado }}>
      {/* Dois invólucros, e cada um com um tipo de efeito só. `filter` é
          uma propriedade só: brilho e tinta na mesma lista brigariam com a
          piscada de dano, que anima justamente `filter`. Separando, o CSS
          compõe sozinho e nenhum efeito apaga o outro. */}
      <div
        className={styles.aura}
        data-aura={aura ? '' : undefined}
        data-envenenado={sinais.envenenado ? '' : undefined}
        style={aura ? ({ '--cor-da-aura': `var(${aura})` } as React.CSSProperties) : undefined}
      >
        <div
          className={styles.pilha}
          data-ferido={sinais.ferido ? '' : undefined}
          style={sinais.atraso ? ({ '--atraso-da-respiracao': `${sinais.atraso}ms` } as React.CSSProperties) : undefined}
        >
          {sinais.vivo ? (
            /* O invólucro do golpe embrulha o boneco todo: é ele que se
               inclina pro lado da arma. Precisa ser um elemento à parte
               porque o tronco já anima `transform` pra respirar, e duas
               animações da mesma propriedade no mesmo elemento não se
               compõem — uma apaga a outra. Aninhadas, se multiplicam. */
            <div className={styles.golpe} data-atacando={sinais.atacando ? '' : undefined}>
              {/* A mesma pilha duas vezes, recortada na cintura: embaixo as
                  pernas, paradas; em cima o tronco, que é o que respira.
                  Pedido do Breno, e ele tem razão — o boneco inteiro subindo
                  parece que flutua; com o pé plantado, parece que respira.

                  Custa nó de DOM, não download: são as mesmas URLs, e o
                  navegador busca cada arte uma vez só. */}
              <div className={styles.pernas}>{empilhar(doCorpo)}</div>
              {/* As mãos moram **dentro** do tronco, e não ao lado dele.
                  Duas animações iguais em elementos irmãos não são a mesma
                  animação: cada uma começa quando o seu elemento aparece, e
                  `.maos` só aparece quando há algo na mão — equipar uma arma
                  no meio da partida montava o invólucro depois, com a
                  respiração fora de fase pra sempre. Era isso que o Breno
                  via como arma descolando do punho.

                  Aninhado, não há segunda animação: a mão herda o transform
                  do tronco, que é o "mesmo referencial de tempo" que ele
                  pediu — não por acerto de relógio, mas por não haver dois.
                  O recorte da cintura vira `>` no CSS pra não alcançar o que
                  está aqui dentro. */}
              <div className={styles.tronco}>
                {empilhar(doCorpo)}
                {nasMaos.length > 0 && <div className={styles.maos}>{empilhar(nasMaos)}</div>}
              </div>
            </div>
          ) : (
            // Parado, uma pilha só: sem animação o recorte não teria o que
            // esconder, e duplicar arriscaria uma emenda visível de graça.
            empilhar(camadas)
          )}
        </div>
      </div>
    </div>
  );
}
