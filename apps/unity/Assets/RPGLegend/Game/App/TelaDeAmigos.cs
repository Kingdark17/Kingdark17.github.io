using System;
using System.Collections.Generic;
using RPGLegend.Game.Jogo;
using UnityEngine;
using UnityEngine.UIElements;

namespace RPGLegend.Game.App
{
    /// <summary>
    /// Os amigos e a conversa (painel-amigos.tsx do site): à esquerda, adicionar pelo nome, os amigos, os pedidos
    /// que chegaram e os enviados; à direita, a conversa com o amigo escolhido. As mensagens são as mesmas do site
    /// (a mesma conta, as mesmas rotas): o que se escreve aqui aparece lá, e o contrário.
    ///
    /// Mandar vai por HTTP, como no site; o tempo real (<see cref="Rede"/>) só avisa do que chega — mensagem nova,
    /// pedido e aceite — e a tela recarrega o que mudou. A foto e a moldura de cada um o app ainda não desenha.
    /// </summary>
    public sealed class TelaDeAmigos
    {
        private readonly VisualElement _tela, _conversa;
        private readonly ScrollView _lista, _mensagens;
        private readonly Label _estado, _titulo;
        private readonly TextField _nome, _rascunho;
        private readonly Button _adicionar, _enviar;
        private Relacoes _relacoes = new Relacoes();
        private Amigo _conversando;
        private List<MensagemDaConversa> _conversaAtual = new List<MensagemDaConversa>();
        private string _recado, _erro;
        private bool _ocupado, _aberta;
        /// <summary>Muda a cada abertura: a resposta que chega depois de a tela fechar não desenha nada.</summary>
        private int _vez;

        public event Action AoVoltar;
        /// <summary>O token venceu: quem abriu a tela leva de volta à porta.</summary>
        public event Action AoSessaoExpirada;

        public TelaDeAmigos(VisualElement raiz)
        {
            _tela = raiz.Q("amigos");
            _lista = raiz.Q<ScrollView>("lista-de-amigos");
            _conversa = raiz.Q("conversa");
            _mensagens = raiz.Q<ScrollView>("mensagens");
            _estado = raiz.Q<Label>("estado-dos-amigos");
            _titulo = raiz.Q<Label>("titulo-da-conversa");
            _nome = raiz.Q<TextField>("campo-novo-amigo");
            _rascunho = raiz.Q<TextField>("campo-mensagem");
            _adicionar = raiz.Q<Button>("botao-adicionar-amigo");
            _enviar = raiz.Q<Button>("botao-enviar-mensagem");

            raiz.Q<Button>("botao-voltar-amigos").clicked += () => AoVoltar?.Invoke();
            raiz.Q<Button>("botao-atualizar-conversa").clicked += () =>
            {
                if (_conversando != null) AbrirConversa(_conversando);
            };
            _adicionar.clicked += Pedir;
            _enviar.clicked += Enviar;
            _nome.RegisterCallback<KeyDownEvent>(e =>
            {
                if (e.keyCode == KeyCode.Return || e.keyCode == KeyCode.KeypadEnter) Pedir();
            }, TrickleDown.TrickleDown);
            _rascunho.RegisterCallback<KeyDownEvent>(e =>
            {
                if (e.keyCode == KeyCode.Return || e.keyCode == KeyCode.KeypadEnter) Enviar();
            }, TrickleDown.TrickleDown);

            Rede.AoMensagem += Chegou;
            Rede.AoAmizade += MudouAAmizade;
        }

        public void Abrir()
        {
            int esta = ++_vez;
            _aberta = true;
            _relacoes = new Relacoes();
            _conversando = null;
            _conversaAtual = new List<MensagemDaConversa>();
            _recado = null;
            _erro = null;
            _ocupado = false;
            _nome.value = "";
            _rascunho.value = "";
            _lista.Clear();
            Estado("Carregando seus amigos…", false);
            DesenharConversa();
            _tela.RemoveFromClassList("oculto");
            Rede.Ligar();
            Carregar(esta);
        }

        public void Fechar()
        {
            _vez++;
            _aberta = false;
            _tela.AddToClassList("oculto");
        }

        // ---------- as listas ----------

        private async void Carregar(int esta)
        {
            try
            {
                var relacoes = await RpgApi.Amigos(Session.Token);
                if (esta != _vez) return;
                _relacoes = relacoes;
                // Quem deixou de ser amigo enquanto a conversa estava aberta sai dela.
                if (_conversando != null)
                {
                    _conversando = _relacoes.Amigos.Find(a => a.Username == _conversando.Username);
                    if (_conversando == null) DesenharConversa();
                }
                Estado(null, false);
                DesenharLista();
            }
            catch (ApiError e) when (e.SessaoInvalida)
            {
                if (esta == _vez) AoSessaoExpirada?.Invoke();
            }
            catch (ApiError e)
            {
                if (esta == _vez) Estado(e.Message, true);
            }
            catch (OperationCanceledException) { }
            catch (Exception e)
            {
                Debug.LogException(e);
                if (esta == _vez) Estado("Não foi possível carregar seus amigos.", true);
            }
        }

        private void DesenharLista()
        {
            _lista.Clear();
            if (!string.IsNullOrEmpty(_recado)) _lista.Add(PecasDaTela.Texto(_recado, "aviso-da-loja"));
            if (!string.IsNullOrEmpty(_erro)) _lista.Add(PecasDaTela.Texto(_erro, "erro-da-loja"));

            Grupo("Seus amigos", "Você ainda não tem amigos aqui.", _relacoes.Amigos, (linha, amigo) =>
            {
                linha.Add(PecasDaTela.Botao("Conversar", () => AbrirConversa(amigo)));
                linha.Add(PecasDaTela.Botao("Remover", () => Agir(() => RpgApi.DesfazerAmizade(Session.Token, amigo.Username), amigo.Username + " não é mais seu amigo."), false, !_ocupado));
            });
            Grupo("Pedidos recebidos", "Nenhum pedido esperando.", _relacoes.Recebidos, (linha, amigo) =>
            {
                linha.Add(PecasDaTela.Botao("Aceitar", () => Agir(() => RpgApi.AceitarAmizade(Session.Token, amigo.Username), "Agora vocês são amigos."), false, !_ocupado));
                linha.Add(PecasDaTela.Botao("Recusar", () => Agir(() => RpgApi.RecusarAmizade(Session.Token, amigo.Username), "Pedido de " + amigo.Username + " recusado."), false, !_ocupado));
            });
            Grupo("Pedidos enviados", "Nenhum pedido pendente.", _relacoes.Enviados, null);
        }

        private void Grupo(string titulo, string vazio, List<Amigo> pessoas, Action<VisualElement, Amigo> acoes)
        {
            _lista.Add(PecasDaTela.Secao(titulo));
            if (pessoas.Count == 0)
            {
                _lista.Add(PecasDaTela.Texto(vazio, "legenda-da-loja"));
                return;
            }
            foreach (var pessoa in pessoas)
            {
                var linha = PecasDaTela.Bloco("pessoa");
                if (_conversando != null && _conversando.Username == pessoa.Username) linha.AddToClassList("escolhida");
                var dados = PecasDaTela.Bloco("dados-da-pessoa");
                dados.Add(Nome(pessoa, "nome-da-pessoa"));
                dados.Add(PecasDaTela.Texto(pessoa.Online ? "online" : "offline", pessoa.Online ? "online" : "offline"));
                linha.Add(dados);
                acoes?.Invoke(linha, pessoa);
                _lista.Add(linha);
            }
        }

        /// <summary>O nome com a cor comprada na loja (a padrão quando não tem, ou quando ela veio torta).</summary>
        private static Label Nome(Amigo pessoa, string classe)
        {
            // Sem passar pelo texto rico: o nome é de outra pessoa, e não pode virar marcação.
            var nome = new Label(pessoa.Username) { enableRichText = false };
            nome.AddToClassList(classe);
            if (!string.IsNullOrEmpty(pessoa.CorDoNome) && ColorUtility.TryParseHtmlString(pessoa.CorDoNome, out var cor)) nome.style.color = cor;
            return nome;
        }

        private void Pedir()
        {
            var alvo = (_nome.value ?? "").Trim();
            if (alvo.Length == 0 || _ocupado) return;
            _nome.value = "";
            Agir(async () =>
            {
                bool aceito = await RpgApi.PedirAmizade(Session.Token, alvo);
                _recado = aceito ? alvo + " já tinha te chamado: agora vocês são amigos." : "Pedido enviado para " + alvo + ".";
            }, null);
        }

        /// <summary>Uma ação que muda as listas: trava os botões, mostra o recado ou o erro e recarrega.</summary>
        private async void Agir(Func<Awaitable> acao, string recado)
        {
            if (_ocupado) return;
            int esta = _vez;
            _ocupado = true;
            _erro = null;
            _recado = null;
            DesenharLista();
            try
            {
                await acao();
                if (esta != _vez) return;
                if (recado != null) _recado = recado;
            }
            catch (ApiError e) when (e.SessaoInvalida)
            {
                if (esta == _vez) AoSessaoExpirada?.Invoke();
                return;
            }
            catch (ApiError e)
            {
                if (esta != _vez) return;
                _erro = e.Message;
            }
            catch (OperationCanceledException) { return; }
            catch (Exception e)
            {
                Debug.LogException(e);
                if (esta != _vez) return;
                _erro = "Erro inesperado.";
            }
            _ocupado = false;
            DesenharLista();
            Carregar(esta);
        }

        // ---------- a conversa ----------

        private void AbrirConversa(Amigo amigo)
        {
            _conversando = amigo;
            _conversaAtual = new List<MensagemDaConversa>();
            DesenharLista();
            DesenharConversa();
            BuscarConversa(_vez, amigo);
        }

        private async void BuscarConversa(int esta, Amigo amigo)
        {
            try
            {
                var conversa = await RpgApi.Conversa(Session.Token, amigo.Username);
                if (esta != _vez || _conversando != amigo) return;
                _conversaAtual = conversa;
                DesenharConversa();
            }
            catch (ApiError e) when (e.SessaoInvalida)
            {
                if (esta == _vez) AoSessaoExpirada?.Invoke();
            }
            catch (ApiError e)
            {
                if (esta != _vez) return;
                _erro = e.Message;
                DesenharLista();
            }
            catch (OperationCanceledException) { }
            catch (Exception e)
            {
                Debug.LogException(e);
            }
        }

        private void DesenharConversa()
        {
            _mensagens.Clear();
            bool tem = _conversando != null;
            _conversa.EnableInClassList("sem-conversa", !tem);
            _titulo.enableRichText = false;
            _titulo.text = tem ? _conversando.Username : "Escolha um amigo para conversar.";
            if (!tem) return;
            if (_conversaAtual.Count == 0) _mensagens.Add(PecasDaTela.Texto("Nenhuma mensagem ainda.", "legenda-da-loja"));
            foreach (var mensagem in _conversaAtual)
            {
                var balao = PecasDaTela.Bloco("mensagem", mensagem.Minha ? "minha" : "dele");
                // O texto é de outra pessoa: vai cru, sem marcação.
                var corpo = new Label(mensagem.Corpo) { enableRichText = false };
                corpo.AddToClassList("corpo-da-mensagem");
                balao.Add(corpo);
                if (mensagem.Quando.HasValue) balao.Add(PecasDaTela.Texto(mensagem.Quando.Value.ToString("dd/MM HH:mm"), "hora-da-mensagem"));
                _mensagens.Add(balao);
            }
            // Depois que a lista tomar o tamanho dela, desce até a mais nova.
            _mensagens.schedule.Execute(() => _mensagens.scrollOffset = new Vector2(0, float.MaxValue)).ExecuteLater(50);
        }

        private async void Enviar()
        {
            var texto = (_rascunho.value ?? "").Trim();
            var alvo = _conversando;
            if (texto.Length == 0 || alvo == null || _ocupado) return;
            int esta = _vez;
            _ocupado = true;
            _enviar.SetEnabled(false);
            try
            {
                await RpgApi.EnviarMensagem(Session.Token, alvo.Username, texto);
                if (esta != _vez) return;
                _rascunho.value = "";
                if (_erro != null)
                {
                    _erro = null;
                    DesenharLista();
                }
                BuscarConversa(esta, alvo);
            }
            catch (ApiError e) when (e.SessaoInvalida)
            {
                if (esta == _vez) AoSessaoExpirada?.Invoke();
            }
            catch (ApiError e)
            {
                if (esta != _vez) return;
                _erro = e.Message;
                DesenharLista();
            }
            catch (OperationCanceledException) { }
            catch (Exception e)
            {
                Debug.LogException(e);
            }
            finally
            {
                if (esta == _vez)
                {
                    _ocupado = false;
                    _enviar.SetEnabled(true);
                    _rascunho.Focus();
                }
            }
        }

        // ---------- o que chega pelo tempo real ----------

        private void Chegou(MensagemRecebida mensagem)
        {
            if (!_aberta) return;
            if (_conversando != null && _conversando.Username == mensagem.De)
            {
                BuscarConversa(_vez, _conversando);
                return;
            }
            _recado = mensagem.De + " mandou uma mensagem.";
            DesenharLista();
        }

        private void MudouAAmizade(string recado)
        {
            if (!_aberta) return;
            _recado = recado;
            DesenharLista();
            Carregar(_vez);
        }

        private void Estado(string texto, bool falha)
        {
            _estado.text = texto ?? "";
            _estado.EnableInClassList("visivel", !string.IsNullOrEmpty(texto));
            _estado.EnableInClassList("falha", falha);
        }
    }
}
