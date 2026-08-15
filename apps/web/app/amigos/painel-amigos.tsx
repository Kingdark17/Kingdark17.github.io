'use client';

/**
 * Amigos e conversa — o `multiplayerModal` do cliente antigo, sem a parte
 * de sala co-op (que depende do socket.io e ainda não existe aqui).
 *
 * Três listas, como no original: amigos, pedidos que chegaram e pedidos
 * que você mandou. Pedir amizade a quem já tinha pedido pra você fecha a
 * amizade na hora — é o servidor que decide isso (`accepted: true`), e a
 * tela só repete o que ele respondeu.
 *
 * A conversa é histórico do banco, buscado por REST. Sem o cliente de
 * tempo real, mensagem nova chega ao recarregar a conversa; o botão de
 * atualizar existe justamente por isso, em vez de fingir que é ao vivo.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  aceitarAmizade,
  conversaCom,
  desfazerAmizade,
  enviarMensagem,
  listarAmigos,
  pedirAmizade,
  recusarAmizade,
  type AmigoPublico,
  type Mensagem,
  type Relacoes,
} from '@/lib/api/amigos';
import { ErroDaApi } from '@/lib/api/client';
import { Avatar, NomeColorido } from '../componentes/avatar';
import styles from './amigos.module.css';

const SEM_RELACOES: Relacoes = { friends: [], incoming: [], outgoing: [] };

export function PainelAmigos() {
  const [relacoes, setRelacoes] = useState<Relacoes>(SEM_RELACOES);
  const [conversando, setConversando] = useState<AmigoPublico | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [rascunho, setRascunho] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [recado, setRecado] = useState('');
  const [versao, setVersao] = useState(0);

  // `versao` é o gatilho de recarga: toda ação que muda as listas incrementa,
  // em vez de cada uma remontar a resposta na mão.
  useEffect(() => {
    listarAmigos()
      .then(setRelacoes)
      .catch((falha) => setErro(falha instanceof ErroDaApi ? falha.message : 'Não foi possível carregar seus amigos.'))
      .finally(() => setCarregando(false));
  }, [versao]);

  const abrirConversa = useCallback((amigo: AmigoPublico) => {
    setConversando(amigo);
    setMensagens([]);
    conversaCom(amigo.username)
      .then(setMensagens)
      .catch((falha) => setErro(falha instanceof ErroDaApi ? falha.message : 'Não foi possível abrir a conversa.'));
  }, []);

  async function comAviso(acao: () => Promise<string>) {
    setOcupado(true);
    setErro('');
    setRecado('');
    try {
      setRecado(await acao());
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha.message : 'Erro inesperado.');
    } finally {
      setOcupado(false);
    }
  }

  function aoPedir(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const campo = new FormData(evento.currentTarget).get('username');
    const alvo = String(campo ?? '').trim();
    evento.currentTarget.reset();
    if (!alvo) return;

    void comAviso(async () => {
      const resposta = await pedirAmizade(alvo);
      setVersao((n) => n + 1);
      return resposta.accepted ? `${alvo} já tinha te chamado: agora vocês são amigos.` : `Pedido enviado para ${alvo}.`;
    });
  }

  function aoResponder(amigo: AmigoPublico, aceitar: boolean) {
    void comAviso(async () => {
      await (aceitar ? aceitarAmizade(amigo.username) : recusarAmizade(amigo.username));
      setVersao((n) => n + 1);
      return aceitar ? `Agora vocês são amigos.` : `Pedido de ${amigo.username} recusado.`;
    });
  }

  function aoDesfazer(amigo: AmigoPublico) {
    void comAviso(async () => {
      await desfazerAmizade(amigo.username);
      setVersao((n) => n + 1);
      if (conversando?.username === amigo.username) setConversando(null);
      return `${amigo.username} não é mais seu amigo.`;
    });
  }

  function aoEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const texto = rascunho.trim();
    if (!texto || !conversando) return;
    const alvo = conversando;

    void comAviso(async () => {
      await enviarMensagem(alvo.username, texto);
      setRascunho('');
      setMensagens(await conversaCom(alvo.username));
      return '';
    });
  }

  function atualizarConversa() {
    if (conversando) abrirConversa(conversando);
  }

  if (carregando) return <p>Carregando seus amigos…</p>;

  return (
    <div className={styles.colunas}>
      <section className={styles.painel}>
        <h1 className={styles.titulo}>Amigos</h1>

        <form onSubmit={aoPedir} className={styles.formularioDeBusca}>
          <input className={styles.entrada} name="username" placeholder="nome do jogador" aria-label="Nome do jogador" />
          <button type="submit" className={styles.botao} disabled={ocupado}>
            Adicionar
          </button>
        </form>

        <Lista
          titulo="Seus amigos"
          vazio="Você ainda não tem amigos aqui."
          pessoas={relacoes.friends}
          acoes={(amigo) => (
            <>
              <button type="button" className={styles.botaoDiscreto} onClick={() => abrirConversa(amigo)}>
                Conversar
              </button>
              <button type="button" className={styles.botaoDiscreto} onClick={() => aoDesfazer(amigo)} disabled={ocupado}>
                Remover
              </button>
            </>
          )}
        />

        <Lista
          titulo="Pedidos recebidos"
          vazio="Nenhum pedido esperando."
          pessoas={relacoes.incoming}
          acoes={(amigo) => (
            <>
              <button type="button" className={styles.botaoDiscreto} onClick={() => aoResponder(amigo, true)} disabled={ocupado}>
                Aceitar
              </button>
              <button type="button" className={styles.botaoDiscreto} onClick={() => aoResponder(amigo, false)} disabled={ocupado}>
                Recusar
              </button>
            </>
          )}
        />

        <Lista titulo="Pedidos enviados" vazio="Nenhum pedido pendente." pessoas={relacoes.outgoing} acoes={() => null} />

        {recado && <p className={styles.aviso}>{recado}</p>}
        {erro && <p className={styles.erro}>{erro}</p>}
      </section>

      <section className={styles.painel}>
        {!conversando ? (
          <p className={styles.vazio}>Escolha um amigo para conversar.</p>
        ) : (
          <>
            <header className={styles.cabecalhoDaConversa}>
              <Avatar url={conversando.avatarUrl} frame={conversando.frame} nome={conversando.username} lado={40} />
              <NomeColorido nome={conversando.username} cor={conversando.nameColor || '#e8d7a5'} className={styles.tituloDaConversa} />
              <button type="button" className={styles.botaoDiscreto} onClick={atualizarConversa}>
                Atualizar
              </button>
            </header>

            <ol className={styles.mensagens}>
              {mensagens.length === 0 && <li className={styles.vazio}>Nenhuma mensagem ainda.</li>}
              {mensagens.map((mensagem) => (
                <li key={mensagem.id} className={mensagem.fromMe ? styles.minha : styles.dele}>
                  <span className={styles.corpoDaMensagem}>{mensagem.body}</span>
                  <span className={styles.horaDaMensagem}>{new Date(mensagem.createdAt).toLocaleString('pt-BR')}</span>
                </li>
              ))}
            </ol>

            <form onSubmit={aoEnviar} className={styles.formularioDeBusca}>
              <input
                className={styles.entrada}
                value={rascunho}
                onChange={(evento) => setRascunho(evento.target.value)}
                placeholder="escreva uma mensagem"
                aria-label="Mensagem"
              />
              <button type="submit" className={styles.botao} disabled={ocupado || !rascunho.trim()}>
                Enviar
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

interface PropsDaLista {
  titulo: string;
  vazio: string;
  pessoas: AmigoPublico[];
  acoes: (pessoa: AmigoPublico) => React.ReactNode;
}

function Lista({ titulo, vazio, pessoas, acoes }: PropsDaLista) {
  return (
    <>
      <h2 className={styles.subtitulo}>{titulo}</h2>
      {pessoas.length === 0 ? (
        <p className={styles.vazio}>{vazio}</p>
      ) : (
        <ul className={styles.listaDePessoas}>
          {pessoas.map((pessoa) => (
            <li key={pessoa.username} className={styles.pessoa}>
              <Avatar url={pessoa.avatarUrl} frame={pessoa.frame} nome={pessoa.username} lado={40} />
              <div className={styles.dadosDaPessoa}>
                <NomeColorido nome={pessoa.username} cor={pessoa.nameColor || '#e8d7a5'} />
                <span className={pessoa.online ? styles.online : styles.offline}>{pessoa.online ? 'online' : 'offline'}</span>
              </div>
              <div className={styles.acoesDaPessoa}>{acoes(pessoa)}</div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
