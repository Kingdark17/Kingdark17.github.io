'use client';

/**
 * Personalização do perfil e loja de cosméticos — os modais
 * `profileEditorModal` e `profileShopModal` do cliente antigo.
 *
 * Duas regras do servidor moldam a tela:
 *
 * 1. Só dá pra **escolher** o que a conta já desbloqueou (`owned`), então
 *    os seletores listam só isso — o resto vive na loja.
 * 2. A compra sai do **ouro do personagem**, não de uma carteira da conta.
 *    Por isso a loja pede o slot antes de deixar comprar, e o ouro
 *    mostrado é o do slot escolhido.
 */

import { useEffect, useState } from 'react';

import { PET_ICONS, type PetId } from '@rpg-legend/shared';

import type { Usuario } from '@/lib/api/account';
import { listarPersonagens, type ResumoPersonagem } from '@/lib/api/characters';
import { ErroDaApi } from '@/lib/api/client';
import {
  catalogoDeCosmeticos,
  comprarCosmetico,
  salvarPerfil,
  type Catalogo,
  type ItemDeCosmetico,
  type PerfilEscolhido,
} from '@/lib/api/perfil';
import { Avatar, NomeColorido } from './avatar';
import { comprimirFoto, FotoInvalidaError } from './comprimir-foto';
import styles from './conta.module.css';

const NOME_DA_MOLDURA: Record<string, string> = {
  none: 'Sem moldura',
  bronze: 'Bronze',
  silver: 'Prata',
  gold: 'Ouro',
  arcane: 'Arcana',
  emerald: 'Esmeralda',
  crimson: 'Carmesim',
  obsidian: 'Obsidiana',
  celestial: 'Celestial',
  rgb: 'RGB do ADM',
};

const NOME_DA_COR: Record<string, string> = {
  '#e8d7a5': 'Pergaminho',
  '#ffffff': 'Branco',
  '#6ee7ff': 'Azul',
  '#8cff98': 'Verde',
  '#d8a4ff': 'Roxo',
  '#ff8f8f': 'Vermelho',
  '#ffd166': 'Dourado',
  '#ff9f43': 'Laranja',
  '#ff72c6': 'Rosa',
  '#4fffe1': 'Ciano',
  '#b8ff5a': 'Lima',
  rainbow: 'RGB do ADM',
};

const NOME_DO_PET: Record<string, string> = {
  none: 'Nenhum',
  chicken: 'Galinha',
  cat: 'Gato',
  fox: 'Raposa',
  owl: 'Coruja',
  slime: 'Slime',
  wolf: 'Lobo',
  fairy: 'Fada',
  baby_dragon: 'Dragão Filhote',
  admin_dragon: 'Dragão Lendário do ADM',
};

function perfilDe(usuario: Usuario): PerfilEscolhido {
  return {
    // Foto enviada vira `data:`; o campo de texto só faz sentido pra link.
    avatarUrl: usuario.avatarUrl,
    frame: usuario.frame || 'none',
    nameColor: usuario.nameColor || '#e8d7a5',
    pet: (usuario.pet || 'none') as PetId | 'none',
  };
}

interface Props {
  usuario: Usuario;
  onUsuario: (usuario: Usuario) => void;
}

export function PainelPerfil({ usuario, onUsuario }: Props) {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [personagens, setPersonagens] = useState<ResumoPersonagem[]>([]);
  const [slot, setSlot] = useState<number | null>(null);
  const [escolha, setEscolha] = useState<PerfilEscolhido>(() => perfilDe(usuario));
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

  const donoDe = catalogo?.owned ?? usuario.cosmetics;
  const escolhido = personagens.find((personagem) => personagem.slot === slot) ?? null;

  function adotar(atualizado: Usuario, mensagem: string) {
    onUsuario(atualizado);
    setEscolha(perfilDe(atualizado));
    setRecado(mensagem);
    setErro('');
  }

  async function comAviso(acao: () => Promise<void>) {
    setOcupado(true);
    setErro('');
    setRecado('');
    try {
      await acao();
    } catch (falha) {
      if (falha instanceof FotoInvalidaError) setErro(falha.message);
      else setErro(falha instanceof ErroDaApi ? falha.message : 'Erro inesperado.');
    } finally {
      setOcupado(false);
    }
  }

  function aoTrocarFoto(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!arquivo) return;
    void comAviso(async () => {
      const comprimida = await comprimirFoto(arquivo);
      setEscolha((atual) => ({ ...atual, avatarUrl: comprimida }));
      setRecado('Foto pronta. Clique em "Salvar perfil" para confirmar.');
    });
  }

  function aoSalvar() {
    void comAviso(async () => adotar(await salvarPerfil(escolha), 'Perfil atualizado.'));
  }

  function aoComprar(item: ItemDeCosmetico) {
    if (slot === null) {
      setErro('Selecione um personagem antes de comprar.');
      return;
    }
    void comAviso(async () => {
      const compra = await comprarCosmetico(item.id, slot);
      const atualizado = await catalogoDeCosmeticos();
      setCatalogo(atualizado);
      // O ouro do personagem mudou no servidor; a lista de slots repete o resumo.
      setPersonagens((await listarPersonagens()).characters);
      adotar(compra.user, `${item.name} desbloqueado por ${item.price} de ouro.`);
    });
  }

  function possui(item: ItemDeCosmetico): boolean {
    if (item.type === 'frame') return donoDe.frames.includes(item.value);
    if (item.type === 'color') return donoDe.colors.includes(item.value);
    return donoDe.pets.includes(item.value);
  }

  return (
    <section className={styles.perfil}>
      <h2 className={styles.subtitulo}>Personalização</h2>

      <div className={styles.previa}>
        <Avatar url={escolha.avatarUrl} frame={escolha.frame} nome={usuario.username} lado={80} />
        <div>
          <NomeColorido nome={usuario.username} cor={escolha.nameColor} className={styles.nomeNaPrevia} />
          <p className={styles.legendaDaPrevia}>
            {NOME_DA_MOLDURA[escolha.frame] ?? escolha.frame}
            {escolha.pet !== 'none' && ` · ${PET_ICONS[escolha.pet]} ${NOME_DO_PET[escolha.pet] ?? escolha.pet}`}
          </p>
        </div>
      </div>

      <label className={styles.campo}>
        <span className={styles.rotulo}>Link da foto</span>
        <input
          className={styles.entrada}
          value={escolha.avatarUrl.startsWith('data:') ? '' : escolha.avatarUrl}
          placeholder={escolha.avatarUrl.startsWith('data:') ? 'foto enviada do computador' : 'https://…'}
          onChange={(evento) => setEscolha({ ...escolha, avatarUrl: evento.target.value })}
        />
      </label>

      <label className={styles.campo}>
        <span className={styles.rotulo}>…ou envie do computador</span>
        <input className={styles.entrada} type="file" accept="image/png,image/jpeg,image/webp" onChange={aoTrocarFoto} />
      </label>

      <label className={styles.campo}>
        <span className={styles.rotulo}>Moldura</span>
        <select className={styles.entrada} value={escolha.frame} onChange={(evento) => setEscolha({ ...escolha, frame: evento.target.value })}>
          {donoDe.frames.map((valor) => (
            <option key={valor} value={valor}>
              {NOME_DA_MOLDURA[valor] ?? valor}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.campo}>
        <span className={styles.rotulo}>Cor do nome</span>
        <select
          className={styles.entrada}
          value={escolha.nameColor}
          onChange={(evento) => setEscolha({ ...escolha, nameColor: evento.target.value })}
        >
          {donoDe.colors.map((valor) => (
            <option key={valor} value={valor}>
              {NOME_DA_COR[valor] ?? valor}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.campo}>
        <span className={styles.rotulo}>Pet</span>
        <select
          className={styles.entrada}
          value={escolha.pet}
          onChange={(evento) => setEscolha({ ...escolha, pet: evento.target.value as PetId | 'none' })}
        >
          {donoDe.pets.map((valor) => (
            <option key={valor} value={valor}>
              {NOME_DO_PET[valor] ?? valor}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.acoes}>
        <button type="button" className={styles.botao} onClick={aoSalvar} disabled={ocupado}>
          Salvar perfil
        </button>
      </div>

      <h2 className={styles.subtitulo}>Loja de cosméticos</h2>

      {personagens.length === 0 ? (
        <p className={styles.aviso}>Crie um personagem e salve na nuvem antes de comprar — o ouro sai dele.</p>
      ) : (
        <label className={styles.campo}>
          <span className={styles.rotulo}>Ouro de qual personagem?</span>
          <select className={styles.entrada} value={slot ?? ''} onChange={(evento) => setSlot(Number(evento.target.value))}>
            {personagens.map((personagem) => (
              <option key={personagem.slot} value={personagem.slot}>
                Slot {personagem.slot} · {personagem.name} · nível {personagem.level}
              </option>
            ))}
          </select>
        </label>
      )}

      {escolhido && <p className={styles.legendaDaPrevia}>Comprando com o ouro de {escolhido.name}.</p>}

      {!catalogo ? (
        <p className={styles.legendaDaPrevia}>Carregando a loja…</p>
      ) : (
        <ul className={styles.vitrine}>
          {catalogo.catalog.map((item) => {
            const jaTem = possui(item);
            return (
              <li key={item.id} className={styles.cosmetico}>
                <span className={styles.iconeDoCosmetico} aria-hidden>
                  {item.icon}
                </span>
                <span className={styles.nomeDoCosmetico}>{item.name}</span>
                <span className={styles.precoDoCosmetico}>{item.adminOnly ? 'exclusivo do ADM' : `${item.price} ouro`}</span>
                <button
                  type="button"
                  className={styles.botaoDaLoja}
                  onClick={() => aoComprar(item)}
                  disabled={ocupado || jaTem || personagens.length === 0}
                >
                  {jaTem ? 'já é seu' : 'Comprar'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {recado && <p className={styles.aviso}>{recado}</p>}
      {erro && <p className={styles.erro}>{erro}</p>}
    </section>
  );
}
