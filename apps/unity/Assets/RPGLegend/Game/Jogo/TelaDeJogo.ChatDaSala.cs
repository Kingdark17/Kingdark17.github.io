using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using RPGLegend.Game.App;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UIElements;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// O chat da sala, dentro da partida em dupla (o co-op do app, 2026-11-17): o CHAT dos botões de cima abre uma
    /// caixinha embaixo com as últimas mensagens e o campo. As mensagens vão pelo tempo real da sala (tipo "m"), só
    /// pro parceiro, e não ficam guardadas em lugar nenhum — a conversa de amigos, que fica, continua no AMIGOS do
    /// menu. Com a caixa fechada, a mensagem que chega aparece num aviso rápido e o botão ganha um ponto.
    ///
    /// Enquanto se digita, o teclado é do campo: o herói não anda e as teclas da luta não valem (a luta em dupla não
    /// pausa, porque o parceiro continua lutando).
    /// </summary>
    public sealed partial class TelaDeJogo
    {
        /// <summary>O maior texto de uma mensagem da sala.</summary>
        private const int TamanhoDaMensagem = 200;
        /// <summary>Quantas mensagens a caixa guarda.</summary>
        private const int MensagensNaCaixa = 30;

        private Button _botaoDoChat;
        private VisualElement _caixaDoChat;
        private ScrollView _mensagensDoChat;
        private TextField _campoDoChat;
        private bool _chatAberto, _chatComNovidade;
        /// <summary>O quadro em que o Esc fechou a caixa: o mesmo Esc não pergunta se quer sair do jogo.</summary>
        private int _chatFechadoNoQuadro = -1;
        private readonly List<(bool Minha, string Texto)> _conversaDaSala = new List<(bool, string)>();

        /// <summary>O campo do chat está com o teclado: nada de andar nem de atalho.</summary>
        private bool DigitandoNoChat
        {
            get
            {
                if (_chatFechadoNoQuadro == Time.frameCount) return true;
                if (_campoDoChat == null || !_chatAberto) return false;
                var foco = _campoDoChat.panel?.focusController?.focusedElement as VisualElement;
                return foco != null && (foco == _campoDoChat || _campoDoChat.Contains(foco));
            }
        }

        /// <summary>Monta o botão e a caixa (uma vez) e mostra o botão só em sala.</summary>
        private void PrepararChat(bool emSala)
        {
            if (_botaoDoChat == null && _tela != null)
            {
                _botaoDoChat = UQueryExtensions.Q<Button>(_tela, "botao-chat");
                if (_botaoDoChat != null) _botaoDoChat.clicked += () => AbrirChat(!_chatAberto);
                MontarCaixaDoChat();
            }
            _conversaDaSala.Clear();
            _chatComNovidade = false;
            DesenharConversaDaSala();
            AbrirChat(false);
            if (_botaoDoChat != null) _botaoDoChat.style.display = emSala ? DisplayStyle.Flex : DisplayStyle.None;
            AtualizarBotaoDoChat();
        }

        private void MontarCaixaDoChat()
        {
            _caixaDoChat = new VisualElement();
            _caixaDoChat.AddToClassList("chat-da-sala");
            _caixaDoChat.style.display = DisplayStyle.None;
            _mensagensDoChat = new ScrollView(ScrollViewMode.Vertical);
            _mensagensDoChat.AddToClassList("mensagens");
            _mensagensDoChat.AddToClassList("rolagem-fina");
            _mensagensDoChat.horizontalScrollerVisibility = ScrollerVisibility.Hidden;
            _caixaDoChat.Add(_mensagensDoChat);
            var linha = new VisualElement();
            linha.AddToClassList("linha-de-envio");
            _campoDoChat = new TextField { maxLength = TamanhoDaMensagem };
            _campoDoChat.textEdition.placeholder = "fale com o parceiro (Enter manda)";
            _campoDoChat.AddToClassList("campo");
            _campoDoChat.AddToClassList("campo-de-envio");
            _campoDoChat.RegisterCallback<KeyDownEvent>(e =>
            {
                if (e.keyCode == KeyCode.Return || e.keyCode == KeyCode.KeypadEnter) MandarNoChat();
                else if (e.keyCode == KeyCode.Escape) AbrirChat(false);
            }, TrickleDown.TrickleDown);
            linha.Add(_campoDoChat);
            linha.Add(PecasDaTela.Botao("Enviar", MandarNoChat));
            _caixaDoChat.Add(linha);
            _tela.Add(_caixaDoChat);
        }

        private void AbrirChat(bool abrir)
        {
            _chatAberto = abrir;
            if (_caixaDoChat == null) return;
            _caixaDoChat.style.display = abrir ? DisplayStyle.Flex : DisplayStyle.None;
            if (abrir)
            {
                _chatComNovidade = false;
                AtualizarBotaoDoChat();
                _campoDoChat.Focus();
                RolarChatAteOFim();
            }
            else
            {
                _campoDoChat?.Blur();
                _chatFechadoNoQuadro = Time.frameCount;
            }
        }

        private void MandarNoChat()
        {
            var texto = (_campoDoChat?.value ?? "").Trim();
            if (texto.Length == 0 || !Rede.NaSala) return;
            if (texto.Length > TamanhoDaMensagem) texto = texto.Substring(0, TamanhoDaMensagem);
            Rede.MandarTempoReal(new JObject { ["t"] = "m", ["x"] = texto });
            _campoDoChat.value = "";
            Guardar(true, texto);
            _campoDoChat.Focus();
        }

        /// <summary>Uma mensagem do parceiro (o texto já conferido por quem chamou).</summary>
        private void ChegouNoChat(string texto)
        {
            texto = texto.Trim();
            if (texto.Length == 0) return;
            if (texto.Length > TamanhoDaMensagem) texto = texto.Substring(0, TamanhoDaMensagem);
            Guardar(false, texto);
            if (_chatAberto) return;
            _chatComNovidade = true;
            AtualizarBotaoDoChat();
            Sons.Tocar("door");
        }

        private void Guardar(bool minha, string texto)
        {
            _conversaDaSala.Add((minha, texto));
            if (_conversaDaSala.Count > MensagensNaCaixa) _conversaDaSala.RemoveAt(0);
            DesenharConversaDaSala();
        }

        private void DesenharConversaDaSala()
        {
            if (_mensagensDoChat == null) return;
            _mensagensDoChat.Clear();
            var parceiro = NomeDoParceiro();
            foreach (var (minha, texto) in _conversaDaSala)
            {
                var balao = PecasDaTela.Bloco("mensagem", minha ? "minha" : "dele");
                // O texto é de outra pessoa: vai cru, sem marcação.
                var corpo = new Label((minha ? "" : parceiro + ": ") + texto) { enableRichText = false };
                corpo.AddToClassList("corpo-da-mensagem");
                balao.Add(corpo);
                _mensagensDoChat.Add(balao);
            }
            RolarChatAteOFim();
        }

        private void RolarChatAteOFim() =>
            _mensagensDoChat?.schedule.Execute(() => _mensagensDoChat.scrollOffset = new Vector2(0, float.MaxValue)).ExecuteLater(30);

        private void AtualizarBotaoDoChat()
        {
            if (_botaoDoChat != null) _botaoDoChat.text = _chatComNovidade ? "CHAT •" : "CHAT";
        }

        private static string NomeDoParceiro()
        {
            var nome = Rede.Perfil(Rede.PapelDoParceiro)?["name"];
            return nome != null && nome.Type == JTokenType.String && ((string)nome).Trim().Length > 0 ? ((string)nome).Trim() : "Parceiro";
        }

        /// <summary>No PC, Enter abre o chat (com a caixa fechada e ninguém digitando em outro lugar).</summary>
        private void TeclaDoChat()
        {
            if (_botaoDoChat == null || _botaoDoChat.resolvedStyle.display == DisplayStyle.None || _chatAberto || _janela != null) return;
            var teclado = Keyboard.current;
            if (teclado != null && teclado.enterKey.wasPressedThisFrame) AbrirChat(true);
        }
    }
}
