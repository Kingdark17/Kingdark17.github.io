/* eslint-disable @next/next/no-img-element */

/**
 * O boneco: as camadas do paperdoll empilhadas.
 *
 * **`<img>` em posição absoluta, e não PixiJS nem `<canvas>`.** A tabela de
 * decisões da migração fixa PixiJS pro personagem 2D, e continua valendo
 * pro boneco que se mexe — mas isto aqui é um empilhamento parado de até
 * cinco imagens de 64×64. Pixi custaria ~400 KB de JavaScript pra fazer o
 * que o navegador já faz de graça, e `image-rendering: pixelated` sai mais
 * fiel que reamostragem de textura. Quando o boneco precisar animar ou
 * receber filtro, o Pixi entra — e este componente é o que ele substitui.
 *
 * Sem estado e sem efeito: é Server Component onde o chamador for servidor,
 * e não manda uma linha de JS quando é.
 */

import { montarCamadas, type Vestimenta } from '@/lib/paperdoll/camadas';
import styles from './paperdoll.module.css';

interface Props extends Vestimenta {
  /** Lado em pixels. O sprite é 64×64; múltiplos de 64 saem mais nítidos. */
  lado?: number;
  /** Mostrado quando a raça ainda não tem corpo desenhado. */
  reserva?: React.ReactNode;
}

export function Paperdoll({ raca, arma, lado = 192, reserva = null }: Props) {
  const camadas = montarCamadas({ raca, arma });

  if (camadas.length === 0) {
    return (
      <div className={styles.boneco} style={{ width: lado, height: lado }}>
        {reserva}
      </div>
    );
  }

  return (
    <div className={styles.boneco} style={{ width: lado, height: lado }}>
      {camadas.map((camada) => (
        // `alt` vazio de propósito: as camadas juntas são uma figura só, e
        // quem lê a tela não ganha nada ouvindo "corpo, calça, roupa,
        // cabelo, espada". Quem descreve o boneco é o chamador.
        <img key={camada} className={styles.camada} src={camada} alt="" width={64} height={64} />
      ))}
    </div>
  );
}
