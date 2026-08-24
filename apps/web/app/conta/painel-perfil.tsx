'use client';

/**
 * Personalização do perfil — o modal `profileEditorModal` do cliente
 * antigo. **Só o escolher**: comprar mudou de endereço e agora é `/loja`.
 *
 * Estavam juntos aqui porque vieram juntos do mesmo modal, mas são coisas
 * diferentes — uma gasta ouro do personagem, a outra troca o que aparece
 * no seu nome. Separados, esta tela nem precisa mais buscar o catálogo:
 * a regra do servidor é que só dá pra **escolher** o que a conta já
 * desbloqueou, e essa lista já vem em `usuario.cosmetics`.
 */

import Link from 'next/link';
import { useState } from 'react';

import { PET_ICONS, type PetId } from '@rpg-legend/shared';

import type { Usuario } from '@/lib/api/account';
import { ErroDaApi } from '@/lib/api/client';
import { salvarPerfil, type PerfilEscolhido } from '@/lib/api/perfil';
import { Avatar, NomeColorido } from '../componentes/avatar';
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
  const [escolha, setEscolha] = useState<PerfilEscolhido>(() => perfilDe(usuario));
  const [recado, setRecado] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const donoDe = usuario.cosmetics;

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
        <Link href="/loja" className={styles.alternar}>
          Quer mais opções? Ir à loja
        </Link>
      </div>

      {recado && <p className={styles.aviso}>{recado}</p>}
      {erro && <p className={styles.erro}>{erro}</p>}
    </section>
  );
}
