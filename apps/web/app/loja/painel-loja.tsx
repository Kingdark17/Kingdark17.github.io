'use client';

/**
 * A loja: onde se **compra** pet, moldura e cor de nome. Escolher qual
 * usar continua em `/conta` — são coisas diferentes, e estavam juntas no
 * mesmo painel só porque vieram juntas do modal antigo.
 *
 * Duas regras do servidor moldam a tela:
 *
 * 1. A compra sai do **ouro do personagem**, não de uma carteira da conta.
 *    Por isso a loja pede o slot antes de deixar comprar. Sem personagem
 *    salvo na nuvem não há de onde tirar ouro, e o botão fica travado.
 * 2. O que a conta já tem (`owned`) vem no mesmo catálogo, e é o que
 *    decide entre "Comprar" e "já é seu".
 *
 * **A tela não mostra quanto ouro o personagem tem.** Não é esquecimento:
 * `/api/characters` devolve nome, classe, nível, andar e data — e nada de
 * ouro. Mostrar um número aqui exigiria campo novo no servidor; inventar
 * um seria pior que não ter.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { listarPersonagens, type ResumoPersonagem } from '@/lib/api/characters';
import { ErroDaApi } from '@/lib/api/client';
import { catalogoDeCosmeticos, comprarCosmetico, type Catalogo, type ItemDeCosmetico } from '@/lib/api/perfil';

import styles from './loja.module.css';

const NOME_DO_TIPO: Record<ItemDeCosmetico['type'], string> = {
  pet: 'Pets',
  frame: 'Molduras',
  color: 'Cores de nome',
};

/** A ordem das prateleiras, na ordem em que o jogador falou delas. */
const ORDEM: ItemDeCosmetico['type'][] = ['pet', 'frame', 'color'];

export function PainelLoja() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [personagens, setPersonagens] = useState<ResumoPersonagem[]>([]);
  const [slot, setSlot] = useState<number | null>(null);
  const [recado, setRecado] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    catalogoDeCosmeticos()
      .then(setCatalogo)
      .catch((falha) => setErro(falha instanceof ErroDaApi ? falha.message : 'Não foi possível abrir a loja.'));

    listarPersonagens()
      .then((lista) => {
        setPersonagens(lista.characters);
        setSlot(lista.characters[0]?.slot ?? null);
      })
      .catch(() => undefined);
  }, []);

  function possui(item: ItemDeCosmetico): boolean {
    const dono = catalogo?.owned;
    if (!dono) return false;
    if (item.type === 'frame') return dono.frames.includes(item.value);
    if (item.type === 'color') return dono.colors.includes(item.value);
    return dono.pets.includes(item.value);
  }

  async function aoComprar(item: ItemDeCosmetico) {
    if (slot === null) {
      setErro('Escolha um personagem antes de comprar.');
      return;
    }
    setOcupado(true);
    setErro('');
    setRecado('');
    try {
      await comprarCosmetico(item.id, slot);
      // O `owned` mudou no servidor — reler é o que faz o botão virar
      // "já é seu" sem a tela precisar adivinhar o resultado da compra.
      setCatalogo(await catalogoDeCosmeticos());
      setRecado(`${item.name} desbloqueado por ${item.price} de ouro. Escolha em Conta e perfil pra usar.`);
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha.message : 'Erro inesperado.');
    } finally {
      setOcupado(false);
    }
  }

  const escolhido = personagens.find((personagem) => personagem.slot === slot) ?? null;

  return (
    <section className={styles.painel}>
      <div className={styles.cabecalho}>
        <h1 className={styles.titulo}>Loja</h1>
        <Link href="/menu" className={styles.voltar}>
          Voltar ao menu
        </Link>
      </div>

      {personagens.length === 0 ? (
        <p className={styles.aviso}>
          Crie um personagem e salve na nuvem antes de comprar — o ouro sai dele, não da conta.
        </p>
      ) : (
        <label className={styles.campo}>
          <span className={styles.rotulo}>Comprar com o ouro de qual personagem?</span>
          <select className={styles.entrada} value={slot ?? ''} onChange={(evento) => setSlot(Number(evento.target.value))}>
            {personagens.map((personagem) => (
              <option key={personagem.slot} value={personagem.slot}>
                Slot {personagem.slot} · {personagem.name} · nível {personagem.level}
              </option>
            ))}
          </select>
        </label>
      )}

      {escolhido && <p className={styles.legenda}>Comprando com o ouro de {escolhido.name}.</p>}

      {recado && <p className={styles.aviso}>{recado}</p>}
      {erro && <p className={styles.erro}>{erro}</p>}

      {!catalogo ? (
        <p className={styles.legenda}>Carregando a loja…</p>
      ) : (
        ORDEM.map((tipo) => {
          const itens = catalogo.catalog.filter((item) => item.type === tipo);
          if (itens.length === 0) return null;

          return (
            <div key={tipo}>
              <h2 className={styles.prateleira}>{NOME_DO_TIPO[tipo]}</h2>
              <ul className={styles.vitrine}>
                {itens.map((item) => {
                  const jaTem = possui(item);
                  return (
                    <li key={item.id} className={styles.cosmetico}>
                      <span className={styles.iconeDoCosmetico} aria-hidden>
                        {item.icon}
                      </span>
                      <span className={styles.nomeDoCosmetico}>{item.name}</span>
                      <span className={styles.precoDoCosmetico}>
                        {item.adminOnly ? 'exclusivo do ADM' : `${item.price} ouro`}
                      </span>
                      <button
                        type="button"
                        className={styles.botaoDaLoja}
                        onClick={() => void aoComprar(item)}
                        disabled={ocupado || jaTem || personagens.length === 0}
                      >
                        {jaTem ? 'já é seu' : 'Comprar'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}
