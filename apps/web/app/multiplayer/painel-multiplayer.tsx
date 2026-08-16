'use client';

/**
 * Sala co-op: criar, entrar, convidar um amigo e esperar o parceiro — o
 * `multiplayerModal` do cliente antigo (formulário + lobby).
 *
 * A conexão em si mora em `lib/rede/sala.ts`, fora do React. Esta tela só
 * lê o instantâneo e manda comandos; sair da página não derruba a sessão,
 * que é o que permite ir daqui pro jogo.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { PET_ICONS, type PetId } from '@rpg-legend/shared';

import { usuarioAtual, type Usuario } from '@/lib/api/account';
import { listarAmigos, type AmigoPublico } from '@/lib/api/amigos';
import { listarPersonagens, type ResumoPersonagem } from '@/lib/api/characters';
import { salasPublicas, type SalaPublica } from '@/lib/api/salas';
import {
  conectar,
  convidar,
  criarSala,
  entrarNaSala,
  limparRecados,
  responderConvite,
  sairDaSala,
  type PerfilNaSala,
} from '@/lib/rede/sala';
import { useSala } from '@/lib/rede/use-sala';
import { Avatar, NomeColorido } from '../componentes/avatar';
import styles from './multiplayer.module.css';

const TAMANHO_DO_CODIGO = 6;
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Código curto e legível: sem I/O/0/1, que viram erro de digitação. */
function codigoNovo(): string {
  let codigo = '';
  for (let i = 0; i < TAMANHO_DO_CODIGO; i++) codigo += LETRAS[Math.floor(Math.random() * LETRAS.length)];
  return codigo;
}

export function PainelMultiplayer() {
  const router = useRouter();
  const sala = useSala();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [personagens, setPersonagens] = useState<ResumoPersonagem[]>([]);
  const [slot, setSlot] = useState<number | null>(null);
  const [amigos, setAmigos] = useState<AmigoPublico[]>([]);
  const [publicas, setPublicas] = useState<SalaPublica[]>([]);
  const [codigo, setCodigo] = useState('');
  const [publica, setPublica] = useState(true);
  const [olhando, setOlhando] = useState<PerfilNaSala | null>(null);

  useEffect(() => {
    conectar();
  }, []);

  useEffect(() => {
    usuarioAtual().then(setUsuario).catch(() => undefined);
    listarAmigos().then((r) => setAmigos(r.friends)).catch(() => undefined);
    listarPersonagens()
      .then((lista) => {
        setPersonagens(lista.characters);
        setSlot(lista.characters[0]?.slot ?? null);
      })
      .catch(() => undefined);
  }, []);

  // A vitrine muda sozinha (gente criando e entrando em sala), então ela é
  // recarregada a cada mudança de fase em vez de ficar presa na primeira leitura.
  useEffect(() => {
    if (sala.fase === 'jogando') return;
    salasPublicas().then(setPublicas).catch(() => undefined);
  }, [sala.fase]);

  const escolhido = personagens.find((p) => p.slot === slot) ?? null;
  const naSala = sala.fase === 'esperando' || sala.fase === 'jogando';

  function aoCriar() {
    const escolha = codigo.trim().toUpperCase() || codigoNovo();
    setCodigo(escolha);
    criarSala(escolha, { publica, nome: escolhido?.name ?? usuario?.username ?? 'Aventureiro' });
  }

  function aoEntrar(alvo: string) {
    entrarNaSala(alvo.toUpperCase(), escolhido?.name ?? usuario?.username ?? 'Aventureiro');
  }

  function irJogar() {
    if (slot === null) return;
    router.push(`/jogo?slot=${slot}&sala=${sala.codigo}`);
  }

  if (!naSala) {
    return (
      <div className={styles.colunas}>
        <section className={styles.painel}>
          <h1 className={styles.titulo}>Jogar com alguém</h1>
          <p className={styles.legenda}>
            Cada jogador leva o próprio herói. O mapa é o de quem cria a sala; a mochila, o nível e a equipe continuam
            sendo seus.
          </p>

          {personagens.length === 0 ? (
            <p className={styles.aviso}>Crie um personagem antes — é ele que entra na sala.</p>
          ) : (
            <label className={styles.campo}>
              <span className={styles.rotulo}>Com qual personagem?</span>
              <select className={styles.entrada} value={slot ?? ''} onChange={(e) => setSlot(Number(e.target.value))}>
                {personagens.map((personagem) => (
                  <option key={personagem.slot} value={personagem.slot}>
                    {personagem.name} · nível {personagem.level}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className={styles.campo}>
            <span className={styles.rotulo}>Código da sala</span>
            <input
              className={styles.entrada}
              value={codigo}
              maxLength={TAMANHO_DO_CODIGO}
              placeholder="deixe vazio para sortear"
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            />
          </label>

          <label className={styles.caixaDeMarcar}>
            <input type="checkbox" checked={publica} onChange={(e) => setPublica(e.target.checked)} />
            <span>Aparecer na lista de salas públicas</span>
          </label>

          <div className={styles.acoes}>
            <button type="button" className={styles.botao} onClick={aoCriar} disabled={sala.fase !== 'conectado' || !escolhido}>
              Criar sala
            </button>
            <button
              type="button"
              className={styles.botaoVazado}
              onClick={() => aoEntrar(codigo)}
              disabled={sala.fase !== 'conectado' || !escolhido || codigo.trim().length === 0}
            >
              Entrar nesse código
            </button>
          </div>

          {sala.fase === 'conectando' && <p className={styles.legenda}>Conectando…</p>}
          {sala.recado && <p className={styles.aviso}>{sala.recado}</p>}
          {sala.erro && <p className={styles.erro}>{sala.erro}</p>}
        </section>

        <section className={styles.painel}>
          <h2 className={styles.subtitulo}>Salas públicas</h2>
          {publicas.length === 0 ? (
            <p className={styles.legenda}>Nenhuma sala aberta agora.</p>
          ) : (
            <ul className={styles.lista}>
              {publicas.map((aberta) => (
                <li key={aberta.code} className={styles.linhaDaLista}>
                  <span className={styles.codigoDaSala}>{aberta.code}</span>
                  <span className={styles.dono}>{aberta.hostName}</span>
                  <button type="button" className={styles.botaoDiscreto} onClick={() => aoEntrar(aberta.code)} disabled={!escolhido}>
                    Entrar
                  </button>
                </li>
              ))}
            </ul>
          )}

          {sala.convite && (
            <div className={styles.convite}>
              <p>
                <strong>{sala.convite.de}</strong> chamou você para a sala {sala.convite.codigo}.
              </p>
              <div className={styles.acoes}>
                <button
                  type="button"
                  className={styles.botao}
                  onClick={() => {
                    const convite = sala.convite!;
                    responderConvite(convite, true);
                    aoEntrar(convite.codigo);
                  }}
                  disabled={!escolhido}
                >
                  Aceitar
                </button>
                <button type="button" className={styles.botaoVazado} onClick={() => responderConvite(sala.convite!, false)}>
                  Recusar
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className={styles.colunas}>
      <section className={styles.painel}>
        <h1 className={styles.titulo}>Sala {sala.codigo}</h1>
        <p className={styles.legenda}>
          Você é {sala.papel === 1 ? 'o anfitrião — conduz a exploração' : 'o convidado — acompanha o anfitrião'}.
        </p>

        <h2 className={styles.subtitulo}>Na sala</h2>
        <ul className={styles.lista}>
          {([1, 2] as const).map((papel) => {
            const perfil = sala.perfis[papel];
            if (!perfil) {
              return (
                <li key={papel} className={styles.linhaDaLista}>
                  <span className={styles.dono}>{papel === 1 ? 'Anfitrião' : 'Convidado'}: esperando…</span>
                </li>
              );
            }
            const cosmeticos = perfil.publicProfile;
            return (
              <li key={papel} className={styles.linhaDaLista}>
                <Avatar url={cosmeticos?.avatarUrl ?? ''} frame={cosmeticos?.frame ?? 'none'} nome={perfil.name} lado={36} />
                <button type="button" className={styles.nomeClicavel} onClick={() => setOlhando(perfil)}>
                  <NomeColorido nome={perfil.name} cor={cosmeticos?.nameColor ?? '#e8d7a5'} />
                </button>
                {papel === sala.papel && <span className={styles.legenda}>(você)</span>}
              </li>
            );
          })}
        </ul>

        {olhando && <CartaDePerfil perfil={olhando} onFechar={() => setOlhando(null)} />}

        <div className={styles.acoes}>
          <button type="button" className={styles.botao} onClick={irJogar} disabled={slot === null}>
            {sala.papel === 1 ? 'Começar a aventura' : 'Entrar na aventura'}
          </button>
          <button type="button" className={styles.botaoVazado} onClick={sairDaSala}>
            Sair da sala
          </button>
        </div>

        {sala.recado && (
          <p className={styles.aviso} onAnimationEnd={limparRecados}>
            {sala.recado}
          </p>
        )}
        {sala.erro && <p className={styles.erro}>{sala.erro}</p>}
      </section>

      <section className={styles.painel}>
        <h2 className={styles.subtitulo}>Chamar um amigo</h2>
        {amigos.length === 0 ? (
          <p className={styles.legenda}>Você ainda não tem amigos para chamar.</p>
        ) : (
          <ul className={styles.lista}>
            {amigos.map((amigo) => (
              <li key={amigo.username} className={styles.linhaDaLista}>
                <Avatar url={amigo.avatarUrl} frame={amigo.frame} nome={amigo.username} lado={36} />
                <span className={styles.dono}>
                  <NomeColorido nome={amigo.username} cor={amigo.nameColor || '#e8d7a5'} />
                  {amigo.pet !== 'none' && ` ${PET_ICONS[amigo.pet as PetId] ?? ''}`}
                </span>
                <button
                  type="button"
                  className={styles.botaoDiscreto}
                  onClick={() => convidar(amigo.username, sala.codigo, escolhido?.name ?? sala.eu)}
                  disabled={!amigo.online}
                  title={amigo.online ? '' : 'Só dá para chamar quem está online'}
                >
                  Chamar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** O `publicProfileModal`: o cartão do parceiro, com moldura, cor e pet. */
function CartaDePerfil({ perfil, onFechar }: { perfil: PerfilNaSala; onFechar: () => void }) {
  const cosmeticos = perfil.publicProfile;
  const pet = (cosmeticos?.pet ?? 'none') as PetId | 'none';

  return (
    <div className={styles.cartaDePerfil}>
      <Avatar url={cosmeticos?.avatarUrl ?? ''} frame={cosmeticos?.frame ?? 'none'} nome={perfil.name} lado={64} />
      <div>
        <NomeColorido nome={cosmeticos?.username || perfil.name} cor={cosmeticos?.nameColor ?? '#e8d7a5'} className={styles.nomeGrande} />
        <p className={styles.legenda}>
          Nível {String(perfil.hero?.level ?? '?')} · {String(perfil.hero?.className ?? '')}
        </p>
        <p className={styles.legenda}>{pet === 'none' ? 'Nenhum pet equipado.' : `${PET_ICONS[pet]} Pet equipado`}</p>
      </div>
      <button type="button" className={styles.botaoDiscreto} onClick={onFechar}>
        Fechar
      </button>
    </div>
  );
}
