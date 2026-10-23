'use client';

/**
 * A tela de combate, em primeira pessoa como no Undertale (doc do Breno,
 * regras do usuário em 2026-10-09): o cenário do lugar atrás, o monstro
 * grande no meio, a caixa embaixo e o menu **Lutar · Poderes · Itens ·
 * Fugir**. As opções de cada um abrem dentro da caixa; o ataque é o d20 de
 * dano seguido da barra de mira (`AtaqueComMira`). Não há o minijogo de
 * desviar — foi decidido assim.
 *
 * Só desenha e rola o dado — quem decide o que acontece é
 * `jogo/combate.ts` (na engine). Os dados são rolados aqui e passados pra máquina
 * de turnos em vez de sorteados lá dentro: a tela mostra o número que saiu,
 * e é o mesmo número que um dia o servidor vai conferir.
 *
 * O cenário e o monstro são provisórios: as cores do tema do mapa e o
 * emoji da espécie, até o Breno desenhar os fundos e os monstros.
 *
 * **É a única tela com Motion, e por um motivo.** O log guarda oito
 * linhas: cada golpe entra embaixo e empurra a mais velha pra fora. Sem
 * animação de saída a linha some no mesmo quadro em que a nova aparece,
 * e a leitura fica um pulo. Animar saída é justamente o que CSS não faz
 * — o elemento já não está mais no DOM. Entrada, brilho e loop decorativo
 * continuam em CSS, como no resto do jogo.
 *
 * `LazyMotion` + `m` em vez de `motion`: o `motion` cheio carrega todo o
 * pacote de recursos junto. `MotionConfig reducedMotion="user"` respeita
 * quem pediu menos movimento no sistema, igual ao `@media` das outras
 * telas.
 */

import { AnimatePresence, LazyMotion, MotionConfig } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import {
  alvoDaLuta,
  atacar,
  ataquesDisponiveis,
  consumiveisDoCombate,
  displayName,
  escolherAlvo,
  esquivar,
  fugir,
  heroPowers,
  inimigosDaLuta,
  powerManaCost,
  usarItem,
  usarPoder,
  vezDoMonstro,
  type AtaqueDisponivel,
  type CombatMonsterView,
  type Combate,
  type Companion,
  type Flutuante,
  type InimigoNaLuta,
  type Item,
  type JogadaDeAtaque,
  type Power,
} from '@rpg-legend/shared';

import { TEMAS, type LugarDoTema } from '@/lib/jogo/desenho-da-sala';
import { tocar } from '@/lib/som/efeitos';
import { AtaqueComMira } from './ataque-com-mira';
import styles from './combate.module.css';
import jogo from './jogo.module.css';
import { TextoDoJogo } from './texto-do-jogo';

const LINHAS_DO_LOG = 8;

const carregarAnimacoes = () => import('./animacoes-do-log').then((modulo) => modulo.default);

const ENTRADA_DA_LINHA = { opacity: 0, x: -10 };
const LINHA_PARADA = { opacity: 1, x: 0 };
const SAIDA_DA_LINHA = { opacity: 0, height: 0, marginTop: -4 };
const RITMO = { duration: 0.18, ease: 'easeOut' } as const;

/** O log precisa de chave estável: sem ela a saída nunca chega a rodar. */
interface LinhaDoLog {
  id: number;
  texto: string;
}

/**
 * Número que sobe e some. Ganha id próprio pelo mesmo motivo do log — e
 * some sozinho quando a animação acaba (`onAnimationEnd`), sem
 * `setTimeout`: quem sabe a hora certa é a animação, não um relógio
 * paralelo que erra quando a aba fica em segundo plano.
 */
interface NumeroNaTela extends Flutuante {
  id: number;
}

/**
 * O que a caixa mostra: o registro da luta, as opções de um item do menu,
 * ou o ataque em andamento.
 */
type Caixa = { tipo: 'registro' } | { tipo: 'lutar' } | { tipo: 'poderes' } | { tipo: 'itens' } | { tipo: 'ataque'; ataque: AtaqueDisponivel };

const REGISTRO: Caixa = { tipo: 'registro' };

const ROTULOS_DE_STATUS: Record<string, string> = {
  queimadura: '🔥 Queimando',
  sangramento: '🩸 Sangrando',
  veneno: '☣️ Envenenado',
  atordoado: '💫 Atordoado',
  enfraquecido: '📉 Enfraquecido',
  vulneravel: '🎯 Vulnerável',
  lento: '❄️ Lento',
};

/** Esquiva e fuga continuam no d20 de sempre. */
function rolar(lados: number): number {
  return Math.floor(Math.random() * lados) + 1;
}

function rotuloDoAtaque(ataque: AtaqueDisponivel): string {
  if (ataque.estilo === 'magic') return 'Ataque Mágico';
  if (ataque.estilo === 'ranged') return 'Tiro';
  return 'Ataque Físico';
}

/**
 * Consumíveis iguais viram um botão só, com a contagem. Cinco poções de vida
 * são uma escolha ("beber uma"), não cinco — e cinco botões iguais
 * empurrariam o resto pra fora da caixa no celular.
 */
function agruparConsumiveis(itens: Item[]): Array<{ item: Item; nome: string; quantos: number }> {
  const grupos = new Map<string, { item: Item; nome: string; quantos: number }>();
  for (const item of itens) {
    const nome = displayName(item);
    const grupo = grupos.get(nome);
    if (grupo) grupo.quantos += 1;
    else grupos.set(nome, { item, nome, quantos: 1 });
  }
  return [...grupos.values()];
}

function statusAtivos(monstro: CombatMonsterView): string[] {
  const status = monstro.status ?? {};
  return Object.entries(status)
    .filter(([, valor]) => (typeof valor === 'number' ? valor > 0 : !!valor && valor.turns > 0))
    .map(([chave]) => ROTULOS_DE_STATUS[chave] ?? chave);
}

const emHex = (cor: number) => `#${cor.toString(16).padStart(6, '0')}`;

/** As cores do cenário provisório, as mesmas do mapa do lugar. */
function corDoCenario(lugar: LugarDoTema): CSSProperties {
  const tema = TEMAS[lugar];
  return { '--parede': emHex(tema.parede), '--borda': emHex(tema.bordaDaParede), '--chao': emHex(tema.chao) } as CSSProperties;
}

interface Props {
  combate: Combate;
  /** Onde a luta acontece — escolhe o cenário atrás do monstro. */
  lugar: LugarDoTema;
  onCombate: (proximo: Combate) => void;
  onEncerrar: (final: Combate) => void;
  /**
   * Um poder de cura foi lançado: esta é a parte do parceiro online. Quem
   * sabe se há parceiro é a tela de jogo — esta tela só avisa.
   */
  onCuraDoParceiro?: (quantia: number) => void;
}

export function TelaCombate({ combate, lugar, onCombate, onEncerrar, onCuraDoParceiro }: Props) {
  const [historico, setHistorico] = useState<LinhaDoLog[]>(() => combate.log.map((texto, indice) => ({ id: indice, texto })));
  const [naTela, setNaTela] = useState<NumeroNaTela[]>([]);
  const [tremida, setTremida] = useState(false);
  /** Os monstros do grupo que acabaram de apanhar (pelo índice na sala), pro clarão de cada um. */
  const [golpeados, setGolpeados] = useState<number[]>([]);
  const [caixa, setCaixa] = useState<Caixa>(REGISTRO);
  // O cenário é o de onde a luta começou. Perder (ou zerar a masmorra) leva
  // o estado pra cidade antes da tela de "Continuar", e o fundo não deve
  // trocar de lugar no meio do resultado.
  const [cenario] = useState(lugar);
  const proximoId = useRef(combate.log.length);

  // O grupo inteiro fica no palco (pedido do usuário, 2026-10-16): o jogador
  // toca no monstro que quer atacar, e a placa marca quem bate nesta rodada.
  const grupo = inimigosDaLuta(combate.estado);
  const alvo = alvoDaLuta(combate);
  const vez = vezDoMonstro(combate.estado);
  const emGrupo = grupo.length > 1;
  const hero = combate.estado.hero;
  const acabou = combate.fase === 'vitoria' || combate.fase === 'fuga' || combate.fase === 'derrota';
  const atacando = caixa.tipo === 'ataque';

  // Esc fecha as opções e volta pro registro. Não interrompe o ataque: com
  // o dado girado, desistir seria rolar de novo (ver `AtaqueComMira`).
  useEffect(() => {
    if (caixa.tipo === 'registro' || caixa.tipo === 'ataque') return;
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setCaixa(REGISTRO);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [caixa.tipo]);

  function avancar(proximo: Combate) {
    // Os ids saem daqui, não de dentro do `setHistorico`: em StrictMode o
    // atualizador roda duas vezes e a mesma linha ganharia ids diferentes.
    const novas = proximo.log.map((texto) => ({ id: proximoId.current++, texto }));
    setHistorico((atual) => [...atual, ...novas].slice(-LINHAS_DO_LOG));

    const numeros = proximo.flutuantes.map((flutuante) => ({ ...flutuante, id: proximoId.current++ }));
    setNaTela((atual) => [...atual, ...numeros]);
    // A tremida e o clarão se apagam sozinhos no fim da animação (ver os
    // `onAnimationEnd`), o equivalente React do `classList.remove` + reflow
    // que o cliente antigo fazia à mão.
    if (numeros.some((numero) => numero.alvo === 'heroi')) setTremida(true);
    const apanharam = numeros.filter((numero) => numero.alvo === 'inimigo').map((numero) => numero.indice ?? alvo ?? 0);
    if (apanharam.length > 0) setGolpeados(apanharam);

    // Aqui e não num efeito: dois acertos seguidos têm o mesmo `som`, e
    // um efeito que observa o valor não tocaria o segundo.
    if (proximo.som) tocar(proximo.som);
    setCaixa(REGISTRO);
    onCombate(proximo);
  }

  const ataques = ataquesDisponiveis(hero);
  const poderes: Power[] = heroPowers(hero);
  const consumiveis = agruparConsumiveis(consumiveisDoCombate(combate));

  function lancar(poder: Power) {
    const { combate: proximo, curaDoParceiro } = usarPoder(combate, poder);
    // Antes do `avancar`, que é quem manda o estado desta jogada: o servidor
    // precisa curar o parceiro antes de montar esse pacote (ver `mandarCura`).
    if (curaDoParceiro > 0) onCuraDoParceiro?.(curaDoParceiro);
    avancar(proximo);
  }

  function golpear(ataque: AtaqueDisponivel, jogada: JogadaDeAtaque) {
    avancar(atacar(combate, jogada, ataque.estilo));
  }

  /** Tocar no item do menu que já está aberto fecha as opções. */
  function abrir(tipo: 'lutar' | 'poderes' | 'itens') {
    setCaixa((atual) => (atual.tipo === tipo ? REGISTRO : { tipo }));
  }

  /**
   * Trocar o alvo não é ação: não gasta o turno, não toca som e não deixa
   * número — sem zerar os `flutuantes`, a tela de jogo contaria de novo o
   * golpe anterior e giraria a arma do boneco à toa.
   */
  function mirar(indice: number) {
    const proximo = escolherAlvo(combate, indice);
    if (proximo !== combate) onCombate({ ...proximo, som: null, flutuantes: [] });
  }

  if (grupo.length === 0 && !acabou) return <p className={jogo.erro}>A sala está vazia.</p>;

  function tirarNumero(id: number) {
    setNaTela((atual) => atual.filter((outro) => outro.id !== id));
  }

  /** Os números do golpe que caem neste monstro; o do herói fica no palco, embaixo. */
  function numerosNoMonstro(indice: number) {
    return naTela
      .filter((numero) => numero.alvo === 'inimigo' && (numero.indice ?? alvo) === indice)
      .map((numero) => (
        <span
          key={numero.id}
          className={`${styles.numero} ${numero.tom === 'critico' ? styles.numeroCritico : ''}`}
          onAnimationEnd={() => tirarNumero(numero.id)}
        >
          {numero.texto}
        </span>
      ));
  }

  return (
    <section
      className={styles.combate}
      data-tremendo={tremida || undefined}
      onAnimationEnd={(evento) => {
        if (evento.currentTarget === evento.target) setTremida(false);
      }}
    >
      <div className={styles.palco} style={corDoCenario(cenario)}>
        {/* O golpe que o herói toma fica sobre o palco inteiro, embaixo; o que
            cai num monstro sobe de cima dele. Cada número se remove quando a
            própria animação termina. */}
        <div className={styles.numeros} data-tamanho={grupo.length} aria-hidden>
          {naTela
            .filter((numero) => numero.alvo === 'heroi')
            .map((numero) => (
              <span
                key={numero.id}
                className={`${styles.numero} ${styles.numeroNoHeroi}`}
                onAnimationEnd={() => tirarNumero(numero.id)}
              >
                {numero.texto}
              </span>
            ))}
        </div>

        {!acabou && (
          <div className={styles.grupo} data-tamanho={grupo.length}>
            {grupo.map((inimigo) => (
              <Lutador
                key={inimigo.indice}
                inimigo={inimigo}
                emGrupo={emGrupo}
                escolhido={emGrupo && inimigo.vivo && inimigo.indice === alvo}
                daVez={emGrupo && inimigo.vivo && inimigo.indice === vez}
                golpeado={golpeados.includes(inimigo.indice)}
                travado={atacando}
                numeros={numerosNoMonstro(inimigo.indice)}
                onEscolher={() => mirar(inimigo.indice)}
                onFimDoGolpe={() => setGolpeados((atual) => atual.filter((outro) => outro !== inimigo.indice))}
              />
            ))}
          </div>
        )}
      </div>

      {combate.estado.party.length > 0 && <Equipe membros={combate.estado.party} />}

      <div className={styles.caixa}>
        {caixa.tipo === 'registro' && (
          <>
            {combate.dado !== null && !acabou && (
              <p className={styles.dado} aria-label={`Dado de ${combate.dado.lados} lados: ${combate.dado.valor}`}>
                🎲 <span className={styles.ladosDoDado}>d{combate.dado.lados}</span> {combate.dado.valor}
              </p>
            )}
            <MotionConfig reducedMotion="user">
              <LazyMotion features={carregarAnimacoes} strict>
                <ul className={styles.registro} aria-live="polite">
                  {/* `initial={false}`: ao abrir a tela as linhas já existentes
                      aparecem prontas, sem desfilar uma cascata de entrada. */}
                  <AnimatePresence initial={false}>
                    {historico.map((linha) => (
                      <m.li
                        key={linha.id}
                        className={jogo.linhaDoLog}
                        initial={ENTRADA_DA_LINHA}
                        animate={LINHA_PARADA}
                        exit={SAIDA_DA_LINHA}
                        transition={RITMO}
                      >
                        <TextoDoJogo>{linha.texto}</TextoDoJogo>
                      </m.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </LazyMotion>
            </MotionConfig>
          </>
        )}

        {caixa.tipo === 'lutar' && (
          <>
            <p className={styles.tituloDaCaixa}>Lutar</p>
            <div className={styles.opcoes}>
              {/* O ataque da classe vem primeiro e em destaque — é o de zona
                  maior. `ataquesDisponiveis` já devolve nessa ordem. */}
              {ataques.map((ataque, indice) => (
                <button
                  key={ataque.estilo}
                  type="button"
                  className={indice === 0 ? `${jogo.botao} ${jogo.botaoPrincipal}` : jogo.botao}
                  onClick={() => setCaixa({ tipo: 'ataque', ataque })}
                  disabled={hero.mp < ataque.custo}
                >
                  {rotuloDoAtaque(ataque)}
                  {ataque.custo > 0 && <span className={jogo.custoDeMana}>({ataque.custo} MP)</span>}
                </button>
              ))}
              <button
                type="button"
                className={jogo.botao}
                onClick={() => avancar(esquivar(combate, rolar(20)))}
                title="Rola o d20 com o bônus de velocidade: 12 ou mais, e o golpe desta rodada erra você. Você não ataca."
              >
                Esquivar <span className={jogo.custoDeMana}>(d20)</span>
              </button>
              <button type="button" className={jogo.botaoDiscreto} onClick={() => setCaixa(REGISTRO)}>
                Voltar
              </button>
            </div>
          </>
        )}

        {caixa.tipo === 'poderes' && (
          <>
            <p className={styles.tituloDaCaixa}>Poderes</p>
            <div className={styles.opcoes}>
              {poderes.map((poder) => {
                const custo = powerManaCost(hero, poder);
                return (
                  <button key={poder.id} type="button" className={jogo.botao} onClick={() => lancar(poder)} disabled={hero.mp < custo} title={poder.desc}>
                    {poder.icon} {poder.name} <span className={jogo.custoDeMana}>({custo} MP)</span>
                  </button>
                );
              })}
              <button type="button" className={jogo.botaoDiscreto} onClick={() => setCaixa(REGISTRO)}>
                Voltar
              </button>
            </div>
          </>
        )}

        {/* Consumíveis gastam o turno, como toda ação. Só aparecem os que
            fazem alguma coisa — o mesmo filtro do "Usar" da mochila. */}
        {caixa.tipo === 'itens' && (
          <>
            <p className={styles.tituloDaCaixa}>Itens</p>
            <div className={styles.opcoes}>
              {consumiveis.map(({ item, nome, quantos }) => (
                <button key={nome} type="button" className={jogo.botao} onClick={() => avancar(usarItem(combate, item))}>
                  Usar {nome}
                  {quantos > 1 ? <span className={jogo.custoDeMana}>×{quantos}</span> : null}
                </button>
              ))}
              <button type="button" className={jogo.botaoDiscreto} onClick={() => setCaixa(REGISTRO)}>
                Voltar
              </button>
            </div>
          </>
        )}

        {caixa.tipo === 'ataque' && (
          <AtaqueComMira
            ataque={caixa.ataque}
            rotulo={rotuloDoAtaque(caixa.ataque)}
            onFim={(jogada) => golpear(caixa.ataque, jogada)}
            onVoltar={() => setCaixa({ tipo: 'lutar' })}
          />
        )}
      </div>

      {acabou ? (
        <div className={jogo.escolhas}>
          <button type="button" className={`${jogo.botao} ${jogo.botaoPrincipal}`} onClick={() => onEncerrar(combate)}>
            Continuar
          </button>
        </div>
      ) : (
        <nav className={styles.menu} aria-label="Ações do combate">
          <button
            type="button"
            className={`${jogo.botao} ${caixa.tipo === 'lutar' ? styles.menuAberto : ''}`}
            onClick={() => abrir('lutar')}
            disabled={atacando}
            aria-expanded={caixa.tipo === 'lutar'}
          >
            Lutar
          </button>
          <button
            type="button"
            className={`${jogo.botao} ${caixa.tipo === 'poderes' ? styles.menuAberto : ''}`}
            onClick={() => abrir('poderes')}
            disabled={atacando || poderes.length === 0}
            aria-expanded={caixa.tipo === 'poderes'}
          >
            Poderes
          </button>
          <button
            type="button"
            className={`${jogo.botao} ${caixa.tipo === 'itens' ? styles.menuAberto : ''}`}
            onClick={() => abrir('itens')}
            disabled={atacando || consumiveis.length === 0}
            aria-expanded={caixa.tipo === 'itens'}
          >
            Itens
          </button>
          <button type="button" className={jogo.botao} onClick={() => avancar(fugir(combate, rolar(20)))} disabled={atacando}>
            Fugir
          </button>
        </nav>
      )}
    </section>
  );
}

interface PropsDoLutador {
  inimigo: InimigoNaLuta;
  emGrupo: boolean;
  /** O alvo do jogador: leva a mira e a moldura dourada. */
  escolhido: boolean;
  /** É quem ataca nesta rodada. */
  daVez: boolean;
  golpeado: boolean;
  /** Com o ataque em andamento (dado girado, barra correndo), o alvo não muda mais. */
  travado: boolean;
  numeros: ReactNode;
  onEscolher: () => void;
  onFimDoGolpe: () => void;
}

/**
 * Um monstro no palco: a placa em cima (nome, vida, o que pesa sobre ele e
 * se é a vez dele) e a figura no chão. Sozinho na sala, é só o desenho, como
 * sempre foi; em grupo, é o botão que escolhe o alvo. O que caiu fica no
 * lugar, apagado, até a luta acabar — sumir no meio empurraria os outros e
 * o número do golpe que o derrubou ficaria sem onde aparecer.
 */
function Lutador({ inimigo, emGrupo, escolhido, daVez, golpeado, travado, numeros, onEscolher, onFimDoGolpe }: Readonly<PropsDoLutador>) {
  const { monstro, vivo } = inimigo;
  const status = vivo ? statusAtivos(monstro) : [];
  // O atordoado só baixa quando chega a vez dele: o da vez atordoado perde o
  // ataque com certeza, e a placa não pode prometer um golpe que não vem.
  const perdeAVez = (monstro.status?.atordoado ?? 0) > 0;

  const conteudo = (
    <>
      <div className={`${styles.placa} ${monstro.isBoss ? styles.placaChefe : ''}`}>
        <h2 className={styles.nome}>
          {monstro.name}
          {monstro.isBoss ? ' 👑' : ''}
        </h2>
        <p className={styles.subtitulo}>{vivo ? monstro.enemyClassLabel : 'Caiu'}</p>
        <div className={jogo.trilho}>
          <div
            className={`${jogo.preenchimento} ${jogo.vida}`}
            style={{ width: `${Math.max(0, Math.min(100, (monstro.hp / monstro.maxHp) * 100))}%` }}
          />
        </div>
        <p className={styles.vida}>
          {Math.max(0, monstro.hp)} / {monstro.maxHp}
        </p>
        {status.length > 0 && (
          <ul className={styles.marcadores}>
            {status.map((rotulo) => (
              <li key={rotulo} className={styles.marcador}>
                {rotulo}
              </li>
            ))}
          </ul>
        )}
        {daVez && <p className={styles.daVez}>{perdeAVez ? '💫 perde a vez' : '⚔️ ataca nesta rodada'}</p>}
      </div>

      <div
        className={`${styles.monstro} ${monstro.isBoss ? styles.monstroChefe : ''}`}
        data-golpeado={golpeado || undefined}
        onAnimationEnd={onFimDoGolpe}
        aria-hidden
      >
        {escolhido && <span className={styles.marcaDeAlvo}>🎯</span>}
        <span className={styles.figura}>{monstro.icon}</span>
        <span className={styles.sombra} />
      </div>
      <div className={styles.numerosDoMonstro} aria-hidden>
        {numeros}
      </div>
    </>
  );

  if (!emGrupo) return <div className={styles.lutador}>{conteudo}</div>;

  return (
    <button
      type="button"
      className={`${styles.lutador} ${styles.lutadorClicavel} ${escolhido ? styles.lutadorAlvo : ''}`}
      data-caido={!vivo || undefined}
      disabled={!vivo || travado}
      aria-pressed={escolhido}
      aria-label={vivo ? `Atacar ${monstro.name}` : `${monstro.name} caiu`}
      onClick={onEscolher}
    >
      {conteudo}
    </button>
  );
}

/**
 * A equipe na luta: os recrutas e os esqueletos do necromante, cada um com a
 * vida (pedido do usuário, 2026-10-23). O caído fica apagado até a luta
 * acabar — os esqueletos somem com ela, e os recrutas voltam como estavam.
 */
function Equipe({ membros }: Readonly<{ membros: readonly Companion[] }>) {
  return (
    <ul className={styles.equipe} aria-label="Sua equipe">
      {membros.map((membro, indice) => (
        <li key={`${indice}-${membro.name}`} className={styles.membro} data-caido={membro.hp <= 0 || undefined}>
          <span className={styles.iconeDoMembro} aria-hidden>
            {membro.classIcon || '🛡️'}
          </span>
          <span className={styles.nomeDoMembro}>{membro.name}</span>
          <div className={`${jogo.trilho} ${styles.trilhoDoMembro}`}>
            <div
              className={`${jogo.preenchimento} ${jogo.vida}`}
              style={{ width: `${Math.max(0, Math.min(100, (membro.hp / Math.max(1, membro.maxHp)) * 100))}%` }}
            />
          </div>
          <span className={styles.vidaDoMembro}>{membro.hp <= 0 ? 'caiu' : `${membro.hp} / ${membro.maxHp}`}</span>
        </li>
      ))}
    </ul>
  );
}
