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

import { montarCamadas, type Vestimenta } from '@/lib/paperdoll/camadas';
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
  return camadas.map((camada) => <img key={camada} className={styles.camada} src={camada} alt="" width={64} height={64} />);
}

export function Paperdoll({
  raca,
  arma,
  armadura,
  secundaria,
  lado = 192,
  reserva = null,
  className = '',
  sinais = {},
}: Readonly<Props>) {
  const camadas = montarCamadas({ raca, arma, armadura, secundaria });
  const classes = `${styles.boneco} ${className}`.trim();

  if (camadas.length === 0) {
    return (
      <div className={classes} style={{ width: lado, height: lado }}>
        {reserva}
      </div>
    );
  }

  const aura = corDaAura(sinais.aura);

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
        <div className={styles.pilha} data-ferido={sinais.ferido ? '' : undefined}>
          {sinais.vivo ? (
            <>
              {/* A mesma pilha duas vezes, recortada na cintura: embaixo as
                  pernas, paradas; em cima o tronco, que é o que respira.
                  Pedido do Breno, e ele tem razão — o boneco inteiro subindo
                  parece que flutua; com o pé plantado, parece que respira.

                  Custa nó de DOM, não download: são as mesmas URLs, e o
                  navegador busca cada arte uma vez só. */}
              <div className={styles.pernas}>{empilhar(camadas)}</div>
              <div
                className={styles.tronco}
                style={sinais.atraso ? ({ '--atraso-da-respiracao': `${sinais.atraso}ms` } as React.CSSProperties) : undefined}
              >
                {empilhar(camadas)}
              </div>
            </>
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
