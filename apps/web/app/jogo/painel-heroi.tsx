'use client';

/**
 * O painel do herói é o **cartão de guilda** (arte e decisão do usuário,
 * 2026-10-09), em todas as telas. Ele existe por causa da fraqueza: quando
 * a classe foi pra Guilda, a criação deixou de mostrá-la, e nenhuma outra
 * tela mostrava. Além dela, o cartão traz o que o painel já tinha — Vida,
 * Mana, XP e atributos — e os poderes. O Ouro saiu: a mochila e a loja o
 * mostram no cabeçalho (o usuário preferiu assim). A maestria da classe é a
 * quarta barra, com o bônus escrito embaixo (2026-10-09).
 *
 * O Aprendiz tem o cartão **provisório**: sem selo, até a Guilda selar no
 * treino. O texto do cartão sai de `jogo/cartao.ts` (na engine).
 */

import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';

import { ATTR_KEYS, ATTR_LABELS, fraquezaNoCartao, hasClass, idDaRaca, maestriaNoCartao, poderesNoCartao, type AttrKey, type Hero } from '@rpg-legend/shared';

import { sinaisDoHeroi } from '@/lib/paperdoll/sinais';
import { tocar } from '@/lib/som/efeitos';
import { Paperdoll } from '../componentes/paperdoll';
import cartao from './cartao-de-guilda.module.css';
import styles from './jogo.module.css';

function porcentagem(atual: number, maximo: number): string {
  return `${maximo > 0 ? Math.max(0, Math.min(100, (atual / maximo) * 100)) : 0}%`;
}

interface PropsDoMedidor {
  rotulo: string;
  atual: number;
  maximo: number;
  cor: string;
  /** O que vai à direita do rótulo, quando não é "atual/máximo" (a maestria no teto diz "máx."). */
  contagem?: string;
  /** Uma linha embaixo da barra. */
  nota?: string;
}

function Medidor({ rotulo, atual, maximo, cor, contagem, nota }: Readonly<PropsDoMedidor>) {
  return (
    <div>
      <div className={cartao.medidor}>
        <span className={cartao.rotulo}>{rotulo}</span>
        <span>{contagem ?? `${atual}/${maximo}`}</span>
      </div>
      <div className={cartao.trilho}>
        <div className={`${cartao.preenchimento} ${cor}`} style={{ width: porcentagem(atual, maximo) }} />
      </div>
      {nota && <p className={cartao.notaDoMedidor}>{nota}</p>}
    </div>
  );
}

/** A barrinha da faixa do celular: rótulo, número e trilho, numa linha só. */
function BarraCurta({ rotulo, atual, maximo, cor }: Readonly<{ rotulo: string; atual: number; maximo: number; cor: string }>) {
  return (
    <div className={styles.barraCurta}>
      <span className={styles.rotuloCurto}>
        {rotulo} <span className={styles.numeroCurto}>{`${atual}/${maximo}`}</span>
      </span>
      <div className={styles.trilhoCurto}>
        <div className={`${cartao.preenchimento} ${cor}`} style={{ width: porcentagem(atual, maximo) }} />
      </div>
    </div>
  );
}

/**
 * Duas voltas da piscada de `paperdoll.module.css` (0,42 s cada).
 *
 * O número está nos dois lugares e não tem como não estar: o CSS precisa
 * dele pro ritmo e o JS pra saber quando desligar. Se um dia divergirem, a
 * piscada acaba um pouco antes ou depois — nada quebra.
 */
const DURACAO_DA_PISCADA_MS = 840;

/**
 * Um pouco **menos** que a volta do giro em `paperdoll.module.css` (0,38 s).
 *
 * De propósito: o giro é infinito e quem o desliga é este relógio, então
 * onde ele desliga importa. Em 360 ms a animação está em 94,7% do arco de
 * ida e volta — com o `ease-in-out`, sobra cerca de 1° de rotação, que
 * ninguém vê sumir. Desligar **depois** da volta pegaria o começo do
 * segundo arco, e aí a arma daria um pulo pra voltar ao lugar.
 */
const DURACAO_DO_GOLPE_MS = 360;

interface Props {
  hero: Hero;
  /**
   * Quantos golpes o herói já acertou nesta sessão. Só o **aumento**
   * importa; o número em si não significa nada e não é exibido.
   */
  golpes?: number;
  /**
   * Gastar um ponto de atributo. Só chega com a **mochila aberta**, que é
   * onde o level up acontece: ali o boneco já está no meio da tela, então o
   * cartão tira o retrato e põe um "+" ao lado de cada atributo enquanto
   * houver ponto. Arranjo "Assim" do usuário, 2026-10-02.
   */
  onPonto?: (chave: AttrKey) => void;
  /**
   * O título da maior conquista (`tituloDoHeroi`: "Sobrevivente da Floresta",
   * "Lenda da Torre"), prêmio de quem zera uma masmorra (decisão do usuário,
   * 2026-10-25). Ausente pra quem ainda não zerou nada.
   */
  titulo?: string | null;
}

export function PainelHeroi({ hero, golpes = 0, onPonto, titulo = null }: Readonly<Props>) {
  const naMochila = onPonto !== undefined;
  const comPontos = naMochila && hero.attrPoints > 0;
  const treinado = hasClass(hero);
  const poderes = poderesNoCartao(hero);
  const fraqueza = fraquezaNoCartao(hero);
  const maestria = maestriaNoCartao(hero);
  const [subiu, setSubiu] = useState(false);
  const nivelAnterior = useRef(hero.level);
  const [ferido, setFerido] = useState(false);
  const vidaAnterior = useRef(hero.hp);
  const relogioDoDano = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [atacando, setAtacando] = useState(false);
  const golpesAnteriores = useRef(golpes);
  const relogioDoGolpe = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * No celular o cartão inteiro tomava a primeira tela, e a sala ficava
   * embaixo, cortada (decisão do usuário, 2026-10-11: "sala primeiro"). Lá
   * ele fica recolhido atrás de uma faixa com Vida e Mana e abre pelo botão.
   * Com ponto de atributo pra gastar na mochila ele já vem aberto: o "+" mora
   * nele. No computador nada muda — a faixa nem aparece.
   */
  const [fichaAberta, setFichaAberta] = useState(false);
  const mostraFicha = fichaAberta || comPontos;
  const idDaFicha = useId();

  // O painel percebe o nível novo sozinho, como o `renderHero()` do
  // cliente antigo: subir de nível acontece no combate, na mochila e no
  // painel ADM, e nenhum dos três precisa saber que existe uma piscada.
  useEffect(() => {
    if (hero.level > nivelAnterior.current) {
      setSubiu(true);
      tocar('levelup');
    }
    nivelAnterior.current = hero.level;
  }, [hero.level]);

  /**
   * Levar dano é **acontecimento, não estado**: a vida cair de 40 pra 32
   * não deixa rastro nenhum no herói depois. Por isso a comparação é aqui,
   * com o que a tela mostrou da última vez — o mesmo desenho da piscada de
   * nível, pelo mesmo motivo: combate, veneno e painel ADM tiram vida, e
   * nenhum dos três precisa saber que o boneco pisca.
   *
   * Só a queda liga. Poção e descanso sobem a vida e não são golpe.
   */
  /**
   * Quem desliga a piscada é o relógio, e **não** `onAnimationEnd`.
   *
   * Duas razões, e a primeira é um bug: com `prefers-reduced-motion` a
   * animação não roda, `animationend` nunca chega e o sinal ficaria preso
   * em ligado pra sempre. A segunda é que a respiração é infinita e
   * dispara `animationend` a cada volta — daria pra filtrar pelo nome, mas
   * CSS Modules embaralha nome de `@keyframes` na build, e a comparação
   * quebraria em produção sem quebrar em desenvolvimento.
   *
   * O relógio mora numa `ref`, **fora da limpeza do efeito**. Com ele na
   * limpeza, tomar um golpe e beber uma poção em seguida cancelava o
   * relógio sem marcar outro, e a piscada ficava acesa pra sempre: a
   * segunda passagem do efeito limpa, vê que a vida subiu e sai sem
   * remarcar. Fora dela, cada golpe reinicia a contagem e apanhar em
   * sequência estica a piscada — que é o que se quer ver.
   */
  useEffect(() => {
    const caiu = hero.hp < vidaAnterior.current;
    vidaAnterior.current = hero.hp;

    if (caiu) {
      setFerido(true);
      if (relogioDoDano.current !== null) clearTimeout(relogioDoDano.current);
      relogioDoDano.current = setTimeout(() => setFerido(false), DURACAO_DA_PISCADA_MS);
    }
  }, [hero.hp]);

  /**
   * O golpe, pelo mesmo desenho da piscada: acertar é acontecimento, e o
   * contador que sobe é o rastro que a tela de combate deixa.
   *
   * Comparar com o valor anterior, e não reagir a "maior que zero", é o que
   * faz o segundo golpe da mesma luta girar a arma de novo.
   */
  useEffect(() => {
    const acertou = golpes > golpesAnteriores.current;
    golpesAnteriores.current = golpes;

    if (acertou) {
      setAtacando(true);
      if (relogioDoGolpe.current !== null) clearTimeout(relogioDoGolpe.current);
      relogioDoGolpe.current = setTimeout(() => setAtacando(false), DURACAO_DO_GOLPE_MS);
    }
  }, [golpes]);

  // Sair da tela no meio da piscada ou do giro não pode deixar relógio solto.
  useEffect(
    () => () => {
      clearTimeout(relogioDoDano.current ?? undefined);
      clearTimeout(relogioDoGolpe.current ?? undefined);
    },
    [],
  );

  return (
    <>
      <div className={styles.resumoDoHeroi}>
        <span className={styles.nomeNoResumo}>
          {hero.name} <span className={styles.nivelNoResumo}>nv {hero.level}</span>
        </span>
        <BarraCurta rotulo="Vida" atual={hero.hp} maximo={hero.maxHp} cor={cartao.vida} />
        <BarraCurta rotulo="Mana" atual={hero.mp} maximo={hero.maxMp} cor={cartao.mana} />
        <button
          type="button"
          className={styles.botaoDaFicha}
          aria-expanded={mostraFicha}
          aria-controls={idDaFicha}
          onClick={() => setFichaAberta((aberta) => !aberta)}
        >
          {mostraFicha ? 'Fechar' : 'Ficha'}
          {hero.attrPoints > 0 && <span className={styles.marcaDePontos}>{hero.attrPoints}</span>}
        </button>
      </div>
      <aside
        id={idDaFicha}
        className={`${cartao.cartao} ${mostraFicha ? '' : styles.fichaRecolhida}`}
        aria-label={`Cartão de guilda de ${hero.name}`}
        data-subiu-de-nivel={subiu || undefined}
        onAnimationEnd={(evento) => {
          if (evento.currentTarget === evento.target) setSubiu(false);
        }}
      >
        {/* O selo é da Guilda: o Aprendiz ainda não treinou, e o cartão dele
            é provisório. Primeiro no HTML, posicionado — a última seção é que
            leva a folga pra não passar por baixo dele. */}
        {treinado && <Image className={cartao.selo} src="/img/ui/selo-da-guilda.png" alt="Selo da Guilda" width={28} height={28} unoptimized />}

        {/* O boneco vestido com o que **está equipado agora**, e não com a
            arma inicial da classe: trocar de espada na mochila muda o que
            aparece aqui. `idDaRaca` porque o herói grava `race` como nome
            ("Elfo Negro") e só os saves novos trazem `raceId` — a função
            resolve os dois.
            Com a mochila aberta ele sai: o mesmo boneco já está no meio da
            tela, maior, com os espaços em volta. */}
        {!naMochila && (
          <Paperdoll
            className={cartao.retrato}
            raca={idDaRaca(hero)}
            arma={hero.equip.arma?.templateId}
            armadura={hero.equip.armadura?.templateId}
            elmo={hero.equip.elmo?.templateId}
            calca={hero.equip.calca?.templateId}
            botas={hero.equip.botas?.templateId}
            secundaria={hero.equip.secundaria?.templateId}
            acessorio={hero.equip.acessorio?.templateId}
            cabelo={hero.hair}
            lado={132}
            sinais={{ ...sinaisDoHeroi(hero), ferido, atacando }}
            reserva={
              <span className={styles.reservaDoRetrato} aria-hidden>
                {hero.raceIcon}
              </span>
            }
          />
        )}

        <header className={cartao.topo}>
          <h2 className={cartao.nome}>{hero.name}</h2>
          <span className={cartao.nivel}>nível {hero.level}</span>
        </header>
        <p className={cartao.linha}>
          {hero.raceIcon} {hero.race} · {hero.classIcon} {hero.className}
          {!treinado && (
            <>
              {' · '}
              <span className={cartao.provisorio}>provisório</span>
            </>
          )}
        </p>
        {titulo && <p className={cartao.titulo}>🏆 {titulo}</p>}

        <div className={cartao.medidores}>
          <Medidor rotulo="Vida" atual={hero.hp} maximo={hero.maxHp} cor={cartao.vida} />
          <Medidor rotulo="Mana" atual={hero.mp} maximo={hero.maxMp} cor={cartao.mana} />
          <Medidor rotulo="XP" atual={hero.xp} maximo={hero.xpNext} cor={cartao.xp} />
          {maestria && (
            <Medidor
              rotulo={`Maestria ${maestria.nivel}`}
              atual={maestria.atual}
              maximo={maestria.maximo}
              cor={cartao.maestria}
              contagem={maestria.contagem}
              nota={maestria.bonus}
            />
          )}
        </div>

        {comPontos && (
          <p className={cartao.pontos}>
            Subiu de nível: {hero.attrPoints} {hero.attrPoints === 1 ? 'ponto' : 'pontos'}
          </p>
        )}

        <dl className={cartao.atributos}>
          {ATTR_KEYS.map((chave) => (
            <div key={chave} className={cartao.atributo}>
              <dt>{ATTR_LABELS[chave]}</dt>
              <dd>{hero.attrs[chave]}</dd>
              {comPontos && (
                <button
                  type="button"
                  className={cartao.mais}
                  onClick={() => onPonto(chave)}
                  aria-label={`Mais um ponto em ${ATTR_LABELS[chave]}`}
                >
                  +
                </button>
              )}
            </div>
          ))}
        </dl>

        <section className={cartao.secao}>
          <h3 className={cartao.rotulo}>{poderes.length > 1 ? 'Poderes' : 'Poder'}</h3>
          {poderes.map((poder) => (
            <p key={poder.id}>
              {poder.icone} {poder.nome} <span className={cartao.custo}>· {poder.custo} MP</span>
            </p>
          ))}
          {poderes.length === 0 && <p className={cartao.provisorio}>{treinado ? 'Nenhum.' : 'Nenhum ainda: a Guilda ensina o primeiro.'}</p>}
        </section>

        {fraqueza && (
          <section className={cartao.secao}>
            <h3 className={cartao.rotulo}>Fraqueza</h3>
            <p>
              {fraqueza.icone} {fraqueza.nome}
            </p>
            <p className={cartao.efeito}>{fraqueza.efeito}</p>
          </section>
        )}
      </aside>
    </>
  );
}
