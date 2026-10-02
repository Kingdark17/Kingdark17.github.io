/**
 * O equipamento em volta do boneco — pedido do doc do Breno: "tela para
 * equipar personagem e slot para cada parte da armadura".
 *
 * Cada espaço fica ao lado da parte do corpo que veste. Pela esquerda, da
 * cabeça aos pés: elmo, peitoral, perneira, botas. Pela direita, o que vai
 * nas mãos e o acessório. Antes era uma grade de cartas com a mesma
 * informação e nenhuma geografia: achar "o que está na cabeça" era ler
 * rótulo por rótulo.
 *
 * **O espaço seleciona, a ficha age** — a mesma regra das cartas da
 * mochila (ver `CartaItem`). Clicar num espaço ocupado abre a peça na
 * ficha, onde estão Guardar e o resto. Espaço vazio não é botão: não há o
 * que abrir.
 */

import Image from 'next/image';

import { idDaRaca, itemView, type EquipSlot, type Hero, type Item } from '@rpg-legend/shared';

import { sinaisDoHeroi } from '@/lib/paperdoll/sinais';
import { Paperdoll } from '../componentes/paperdoll';
import { spriteDoItem } from './carta-item';
import styles from './jogo.module.css';

/**
 * `Record<EquipSlot, …>` de propósito, e não um `Partial`: slot novo na
 * engine sem rótulo aqui vira erro de compilação, em vez de um espaço
 * escrito `undefined` em volta do boneco.
 */
export const ROTULO_DO_SLOT: Record<EquipSlot, string> = {
  arma: 'Arma',
  secundaria: 'Secundária',
  elmo: 'Elmo',
  armadura: 'Peitoral',
  calca: 'Perneira',
  botas: 'Botas',
  acessorio: 'Acessório',
};

/** A ordem de leitura, que é a do DOM: o leitor de tela percorre a cabeça aos pés e depois as mãos. */
const ESQUERDA: EquipSlot[] = ['elmo', 'armadura', 'calca', 'botas'];
const DIREITA: EquipSlot[] = ['arma', 'secundaria', 'acessorio'];

const LADO_DO_SPRITE = 40;

interface Props {
  hero: Hero;
  selecionado: string | null;
  onEscolher: (uid: string) => void;
}

export function Equipamento({ hero, selecionado, onEscolher }: Readonly<Props>) {
  const espaco = (slot: EquipSlot) => (
    <Espaco key={slot} slot={slot} peca={hero.equip[slot] as Item | null} selecionado={selecionado} onEscolher={onEscolher} />
  );

  return (
    <div className={styles.equipamento}>
      <div className={styles.gradeDoEquipamento}>
        {/* Quem lê a tela ouve a lista de espaços; o boneco é a mesma
            informação desenhada, e não precisa ser anunciado de novo. */}
        <div className={styles.bonecoDoEquipamento} aria-hidden>
          <Paperdoll
            className={styles.balaoDoBoneco}
            raca={idDaRaca(hero)}
            arma={hero.equip.arma?.templateId}
            armadura={hero.equip.armadura?.templateId}
            elmo={hero.equip.elmo?.templateId}
            calca={hero.equip.calca?.templateId}
            botas={hero.equip.botas?.templateId}
            secundaria={hero.equip.secundaria?.templateId}
            acessorio={hero.equip.acessorio?.templateId}
            cabelo={hero.hair}
            lado={192}
            sinais={sinaisDoHeroi(hero)}
            reserva={<span className={styles.reservaDoRetrato}>{hero.raceIcon}</span>}
          />
        </div>
        {ESQUERDA.map(espaco)}
        {DIREITA.map(espaco)}
      </div>
    </div>
  );
}

interface EspacoProps {
  slot: EquipSlot;
  peca: Item | null;
  selecionado: string | null;
  onEscolher: (uid: string) => void;
}

function Espaco({ slot, peca, selecionado, onEscolher }: Readonly<EspacoProps>) {
  // A área da grade tem o nome do slot: é o CSS quem decide o lado.
  const lugar = { gridArea: slot };

  if (!peca) {
    return (
      <div className={`${styles.espaco} ${styles.espacoVazio}`} style={lugar}>
        <span className={styles.rotuloDoEspaco}>{ROTULO_DO_SLOT[slot]}</span>
        <span className={styles.molduraDoSprite} aria-hidden />
        <span className={styles.nomeDoEspaco}>vazio</span>
      </div>
    );
  }

  const visao = itemView(peca);
  return (
    <button
      type="button"
      className={`${styles.espaco} ${styles.cartaClicavel} ${peca.uid === selecionado ? styles.cartaSelecionada : ''}`}
      style={{ ...lugar, borderLeftColor: `var(${visao.rarityColorVar})` }}
      aria-pressed={peca.uid === selecionado}
      onClick={() => onEscolher(peca.uid)}
    >
      <span className={styles.rotuloDoEspaco}>{ROTULO_DO_SLOT[slot]}</span>
      <Image className={styles.spriteItem} src={spriteDoItem(peca)} alt="" width={LADO_DO_SPRITE} height={LADO_DO_SPRITE} unoptimized />
      <span className={styles.nomeDoEspaco} style={{ color: `var(${visao.rarityColorVar})` }}>
        {visao.name}
      </span>
    </button>
  );
}
