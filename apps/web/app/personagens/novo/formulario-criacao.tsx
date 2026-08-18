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
import { gravarSave } from '@/lib/api/save';
import { criacaoVazia, faltaParaComecar, rolarAtributosSePossivel, rolarTudo, sortearPoderes, type Criacao } from '@/lib/jogo/criacao';
import { montarSaveInicial } from '@/lib/jogo/save-inicial';
import styles from './criacao.module.css';

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
        <h2 className={styles.tituloSecao}>Poderes</h2>
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
        <h2 className={styles.tituloSecao}>Fraqueza</h2>
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
        <h2 className={styles.tituloSecao}>Atributos</h2>
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
