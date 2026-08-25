'use client';

/**
 * Criação de personagem. Porta do fluxo real do jogo, não do que o
 * CLAUDE.md descreve: raça e classe o jogador escolhe ou sorteia; os dois
 * poderes extras, a fraqueza e os atributos saem sempre da Roleta do
 * Destino.
 *
 * Todo o sorteio mora em `lib/jogo/criacao.ts` — aqui só tem tela e
 * estado. O herói é montado por `buildHero()` da engine compartilhada, a
 * mesma função que o servidor usa como referência ao validar o save.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ATTR_KEYS, ATTR_LABELS, CLASSES, RACES, powerById, type ClassDef, type Race } from '@rpg-legend/shared';
import { ErroDaApi } from '@/lib/api/client';
import { ARMAS, CORPOS } from '@/lib/paperdoll/camadas';
import { gravarSave } from '@/lib/api/save';
import {
  criacaoVazia,
  faltaParaComecar,
  rolarAtributosSePossivel,
  rolarTudo,
  sortearFraqueza,
  sortearPoderes,
  type Criacao,
} from '@/lib/jogo/criacao';
import { montarSaveInicial } from '@/lib/jogo/save-inicial';
import { Paperdoll } from '../../componentes/paperdoll';
import styles from './criacao.module.css';

/**
 * O que dizer embaixo do boneco. A arte está chegando por partes, e a
 * legenda diz **qual** parte falta em vez de deixar o jogador achando que
 * a tela quebrou — seis das doze raças ainda não têm corpo, e só espada e
 * cajado têm camada de arma.
 */
function legendaDoBoneco(raca: Race | null, classe: ClassDef | null): string {
  if (!raca) return 'Escolha uma raça para ver seu herói.';
  if (!CORPOS.has(raca.id)) return `${raca.name} ainda não tem corpo desenhado.`;
  if (classe && !ARMAS.has(classe.weaponTemplate)) {
    return `${raca.name} · ${classe.name} — a arma inicial ainda não tem camada.`;
  }
  if (!classe) return `${raca.name} · escolha uma classe para ver a arma.`;
  return `${raca.name} · ${classe.name}`;
}

const AVISOS: Record<NonNullable<ReturnType<typeof faltaParaComecar>>, string> = {
  nome: 'Dê um nome ao seu herói.',
  raca: 'Escolha uma raça.',
  classe: 'Escolha uma classe.',
  sorteio: 'Gire a Roleta do Destino antes de começar.',
};

export function FormularioCriacao({ slot }: { slot: number }) {
  const router = useRouter();
  const [criacao, setCriacao] = useState<Criacao>(() => criacaoVazia(''));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  function escolherRaca(raca: Race) {
    setErro('');
    setCriacao((atual) => {
      const proxima = { ...atual, raca };
      return { ...proxima, atributos: rolarAtributosSePossivel(proxima) };
    });
  }

  function escolherClasse(classe: ClassDef) {
    setErro('');
    setCriacao((atual) => {
      // Trocar de classe troca o poder de assinatura, então os extras que
      // já saíram precisam ser sorteados de novo pra não repetir o novo.
      const proxima = { ...atual, classe, poderes: atual.poderes.length ? sortearPoderes(classe) : [] };
      return { ...proxima, atributos: rolarAtributosSePossivel(proxima) };
    });
  }

  function rolar() {
    setErro('');
    setCriacao((atual) => rolarTudo(atual.nome));
  }

  // As três regiradas por seção, iguais às do jogo em produção. Servem pra
  // ajustar um resultado sem perder os outros — quem gostou da fraqueza
  // mas não dos poderes não precisa rolar tudo de novo e recomeçar.

  /** Poderes não entram no cálculo de atributo, então nada mais muda. */
  function regirarPoderes() {
    setErro('');
    setCriacao((atual) => (atual.classe ? { ...atual, poderes: sortearPoderes(atual.classe) } : atual));
  }

  /**
   * Atributo depende da fraqueza — a própria tela diz isso. Deixar a
   * fraqueza nova com os atributos velhos mostraria números que não
   * correspondem a nada.
   */
  function regirarFraqueza() {
    setErro('');
    setCriacao((atual) => {
      const proxima = { ...atual, fraqueza: sortearFraqueza() };
      return { ...proxima, atributos: rolarAtributosSePossivel(proxima) };
    });
  }

  function regirarAtributos() {
    setErro('');
    setCriacao((atual) => ({ ...atual, atributos: rolarAtributosSePossivel(atual) ?? atual.atributos }));
  }

  async function comecar() {
    const falta = faltaParaComecar(criacao);
    if (falta) {
      setErro(AVISOS[falta]);
      return;
    }

    setSalvando(true);
    try {
      await gravarSave({ slot, save: montarSaveInicial(criacao) });
      router.push('/personagens');
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha.message : 'Erro inesperado ao salvar o personagem.');
      setSalvando(false);
    }
  }

  const assinatura = criacao.classe ? powerById(criacao.classe.signatureId) : null;

  // Mesmo pré-requisito que `rolarAtributosSePossivel` checa por dentro. Sem
  // isso o botão ficaria clicável e não faria nada, que é pior que estar
  // desligado com o motivo escrito.
  const podeRolarAtributos = Boolean(criacao.raca && criacao.classe && criacao.fraqueza);

  return (
    <>
      <section className={styles.secao}>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Nome do herói</span>
          <input
            className={styles.entrada}
            value={criacao.nome}
            maxLength={20}
            onChange={(evento) => {
              setErro('');
              setCriacao((atual) => ({ ...atual, nome: evento.target.value }));
            }}
          />
        </label>
      </section>

      <section className={styles.secao}>
        <div className={styles.previa}>
          <Paperdoll
            className={styles.balaoDoBoneco}
            raca={criacao.raca?.id ?? null}
            arma={criacao.classe?.weaponTemplate ?? null}
            reserva={
              <span className={styles.reservaDoBoneco} aria-hidden>
                {criacao.raca?.icon ?? '❔'}
              </span>
            }
          />
          <p className={styles.legendaDoBoneco}>{legendaDoBoneco(criacao.raca, criacao.classe)}</p>
        </div>
      </section>

      <section className={styles.secao}>
        <h2 className={styles.tituloSecao}>Raça</h2>
        <ul className={styles.grade}>
          {RACES.map((raca) => (
            <li key={raca.id}>
              <button
                type="button"
                className={`${styles.carta} ${criacao.raca?.id === raca.id ? styles.cartaEscolhida : ''}`}
                aria-pressed={criacao.raca?.id === raca.id}
                onClick={() => escolherRaca(raca)}
              >
                <span className={styles.icone}>{raca.icon}</span>
                <span className={styles.nomeCarta}>{raca.name}</span>
                <span className={styles.descricao}>{raca.desc}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.secao}>
        <h2 className={styles.tituloSecao}>Classe</h2>
        <ul className={styles.grade}>
          {CLASSES.map((classe) => (
            <li key={classe.id}>
              <button
                type="button"
                className={`${styles.carta} ${criacao.classe?.id === classe.id ? styles.cartaEscolhida : ''}`}
                aria-pressed={criacao.classe?.id === classe.id}
                onClick={() => escolherClasse(classe)}
              >
                <span className={styles.icone}>{classe.icon}</span>
                <span className={styles.nomeCarta}>{classe.name}</span>
                <span className={styles.descricao}>{classe.desc}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.secao}>
        <div className={styles.cabecalhoSecao}>
          <h2 className={styles.tituloSecao}>Poderes</h2>
          <button
            type="button"
            className={styles.regirar}
            onClick={regirarPoderes}
            disabled={!criacao.classe || salvando}
            title={criacao.classe ? undefined : 'Escolha uma classe primeiro'}
          >
            🎲 Girar
          </button>
        </div>
        {assinatura || criacao.poderes.length > 0 ? (
          <ul className={styles.grade}>
            {assinatura && (
              <li className={styles.sorteado}>
                <span className={styles.icone}>{assinatura.icon}</span>
                <span className={styles.nomeCarta}>{assinatura.name}</span>
                <span className={styles.descricao}>poder da classe</span>
              </li>
            )}
            {criacao.poderes.map((poder) => (
              <li key={poder.name} className={styles.sorteado}>
                <span className={styles.icone}>{poder.icon}</span>
                <span className={styles.nomeCarta}>{poder.name}</span>
                <span className={styles.descricao}>poder da roleta</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.placeholder}>Gire a Roleta do Destino para descobrir seus dois poderes adicionais.</p>
        )}
      </section>

      <section className={styles.secao}>
        <div className={styles.cabecalhoSecao}>
          <h2 className={styles.tituloSecao}>Fraqueza</h2>
          {/* Sem pré-requisito: a fraqueza não depende de raça nem classe,
              e é o que o jogo em produção faz. */}
          <button type="button" className={styles.regirar} onClick={regirarFraqueza} disabled={salvando}>
            🎲 Girar
          </button>
        </div>
        {criacao.fraqueza ? (
          <div className={styles.sorteado}>
            <span className={styles.icone}>{criacao.fraqueza.icon}</span>
            <span className={styles.nomeCarta}>{criacao.fraqueza.name}</span>
            <span className={styles.descricao}>{criacao.fraqueza.desc}</span>
          </div>
        ) : (
          <p className={styles.placeholder}>Gire a Roleta do Destino para descobrir sua fraqueza.</p>
        )}
      </section>

      <section className={styles.secao}>
        <div className={styles.cabecalhoSecao}>
          <h2 className={styles.tituloSecao}>Atributos</h2>
          <button
            type="button"
            className={styles.regirar}
            onClick={regirarAtributos}
            disabled={!podeRolarAtributos || salvando}
            title={podeRolarAtributos ? undefined : 'Precisa de raça, classe e fraqueza'}
          >
            🎲 Girar
          </button>
        </div>
        {criacao.atributos ? (
          <ul className={styles.gradeAtributos}>
            {ATTR_KEYS.map((chave) => (
              <li key={chave} className={styles.atributo}>
                <span className={styles.valorAtributo}>{criacao.atributos?.[chave]}</span>
                <span className={styles.chaveAtributo}>{ATTR_LABELS[chave]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.placeholder}>Gire a Roleta do Destino para sortear suas características.</p>
        )}
      </section>

      <div className={styles.acoes}>
        <button type="button" className={`${styles.botao} ${styles.botaoSecundario}`} onClick={rolar} disabled={salvando}>
          🎲 Rolar Tudo
        </button>
        <button type="button" className={styles.botao} onClick={comecar} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Começar aventura'}
        </button>
      </div>

      <p className={styles.dica}>Rolar Tudo também sorteia raça e classe — depois disso você ainda pode trocar as duas.</p>

      {erro && <p className={styles.erro}>{erro}</p>}
    </>
  );
}
