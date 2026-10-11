using System;
using System.Globalization;
using UnityEngine;
using UnityEngine.UIElements;

namespace RPGLegend.Game.App
{
    /// <summary>
    /// As telas do app (UI/App.uxml): o cartão de entrada por cima da porta, o menu principal e a lista de
    /// personagens, mais o véu das transições e o aviso rápido. Só mostra, esconde e avisa o que a pessoa fez;
    /// quem decide o que acontece é o <see cref="AppFlow"/>.
    /// </summary>
    public sealed class AppScreens
    {
        private readonly VisualElement _entrada, _cartao, _menu, _personagens, _grade, _veu;
        private readonly Label _tituloEntrada, _erro, _toque, _ola, _estado, _aviso;
        private readonly TextField _usuario, _email, _senha;
        private readonly Button _entrar, _alternar, _esqueci;
        private bool _modoCadastro, _ocupado;
        private int _avisoAtual;
        private TextField _campoComFoco;
        private float _subida;

        /// <summary>O espaço entre o campo em que se digita e o topo do teclado.</summary>
        private const float FolgaDoTeclado = 16f;

        /// <summary>
        /// Até onde o teclado vai quando o aparelho não diz a altura dele (o Android anterior ao 11 devolve área
        /// zero): supõe que cobre até 62% da tela deitada, o que sobra para os teclados mais altos.
        /// </summary>
        private const float TecladoSemAreaCobre = 0.62f;

        /// <summary>usuário, e-mail, senha, é cadastro.</summary>
        public event Action<string, string, string, bool> AoEnviar;
        public event Action AoEsqueci, AoTocar, AoJogar, AoSair, AoVoltar;
        public event Action<string> AoEmBreve;

        public AppScreens(VisualElement raiz)
        {
            _entrada = raiz.Q("entrada");
            _cartao = raiz.Q("cartao-entrada");
            _menu = raiz.Q("menu");
            _personagens = raiz.Q("personagens");
            _grade = raiz.Q("grade");
            _veu = raiz.Q("veu");
            _tituloEntrada = raiz.Q<Label>("titulo-entrada");
            _erro = raiz.Q<Label>("erro-entrada");
            _toque = raiz.Q<Label>("toque-para-entrar");
            _ola = raiz.Q<Label>("ola");
            _estado = raiz.Q<Label>("estado-personagens");
            _aviso = raiz.Q<Label>("aviso");
            _usuario = raiz.Q<TextField>("campo-usuario");
            _email = raiz.Q<TextField>("campo-email");
            _senha = raiz.Q<TextField>("campo-senha");
            _entrar = raiz.Q<Button>("botao-entrar");
            _alternar = raiz.Q<Button>("botao-alternar");
            _esqueci = raiz.Q<Button>("botao-esqueci");

            _entrar.clicked += Enviar;
            _alternar.clicked += () => ModoCadastro = !_modoCadastro;
            _esqueci.clicked += () => AoEsqueci?.Invoke();
            _senha.RegisterCallback<KeyDownEvent>(e =>
            {
                if (e.keyCode == KeyCode.Return || e.keyCode == KeyCode.KeypadEnter) Enviar();
            }, TrickleDown.TrickleDown);
            _entrada.RegisterCallback<PointerDownEvent>(_ =>
            {
                if (_entrada.pickingMode == PickingMode.Position) AoTocar?.Invoke();
            });
            foreach (var campo in new[] { _usuario, _email, _senha })
            {
                var este = campo;
                este.RegisterCallback<FocusInEvent>(_ => _campoComFoco = este);
                este.RegisterCallback<FocusOutEvent>(_ =>
                {
                    if (_campoComFoco == este) _campoComFoco = null;
                });
            }
            if (TouchScreenKeyboard.isSupported) _cartao.schedule.Execute(AcompanharTeclado).Every(50);

            raiz.Q<Button>("botao-jogar").clicked += () => AoJogar?.Invoke();
            raiz.Q<Button>("botao-config").clicked += () => AoEmBreve?.Invoke("As configurações chegam numa próxima versão do app.");
            raiz.Q<Button>("botao-loja").clicked += () => AoEmBreve?.Invoke("A loja chega numa próxima versão do app.");
            raiz.Q<Button>("botao-sair").clicked += () => AoSair?.Invoke();
            raiz.Q<Button>("botao-voltar").clicked += () => AoVoltar?.Invoke();

            // O "Toque para entrar" pulsa devagar enquanto aparece, para chamar o toque.
            _toque.schedule.Execute(() =>
            {
                if (!_toque.ClassListContains("escondido")) _toque.ToggleInClassList("apagado");
            }).Every(900);

            ModoCadastro = false;
            MostrarCartao(false);
        }

        // ---------- entrada ----------

        /// <summary>Entrar (usuário ou e-mail + senha) ou criar conta (usuário + e-mail + senha), como no site.</summary>
        public bool ModoCadastro
        {
            get => _modoCadastro;
            set
            {
                _modoCadastro = value;
                _tituloEntrada.text = value ? "Criar conta" : "Entrar na conta";
                _usuario.label = value ? "Usuário" : "Usuário ou e-mail";
                _email.style.display = value ? DisplayStyle.Flex : DisplayStyle.None;
                _entrar.text = value ? "CADASTRAR" : "ENTRAR";
                _alternar.text = value ? "Já tenho conta" : "Criar uma conta";
                Erro(null);
            }
        }

        public void MostrarCartao(bool mostrar)
        {
            _cartao.EnableInClassList("escondido", !mostrar);
            _cartao.pickingMode = mostrar ? PickingMode.Position : PickingMode.Ignore;
            _cartao.SetEnabled(mostrar);
        }

        /// <summary>Mostra a mensagem de erro do cartão; null ou vazio esconde.</summary>
        public void Erro(string mensagem)
        {
            _erro.text = mensagem ?? "";
            _erro.EnableInClassList("visivel", !string.IsNullOrEmpty(mensagem));
        }

        public void Ocupado(bool ocupado)
        {
            _ocupado = ocupado;
            _entrar.SetEnabled(!ocupado);
            _alternar.SetEnabled(!ocupado);
            _entrar.text = ocupado ? (_modoCadastro ? "CADASTRANDO…" : "ENTRANDO…") : (_modoCadastro ? "CADASTRAR" : "ENTRAR");
        }

        public void LimparSenha() => _senha.value = "";

        private void Enviar()
        {
            if (_ocupado) return;
            AoEnviar?.Invoke(_usuario.value?.Trim() ?? "", _email.value?.Trim() ?? "", _senha.value ?? "", _modoCadastro);
        }

        /// <summary>
        /// No celular deitado o teclado cobre a metade de baixo da tela, justo onde fica o cartão. Enquanto ele
        /// está aberto, o cartão sobe o necessário para o campo em que se digita ficar logo acima do teclado; quando
        /// fecha, o cartão volta.
        /// </summary>
        private void AcompanharTeclado()
        {
            float subida = 0f;
            var campo = _campoComFoco;
            var area = TouchScreenKeyboard.area;
            var teclado = campo?.touchScreenKeyboard;
            bool aberto = campo != null && (area.height > 0f || (teclado != null && teclado.status == TouchScreenKeyboard.Status.Visible));
            float alturaDaTela = _entrada.layout.height;
            if (aberto && Screen.height > 0 && alturaDaTela > 0f)
            {
                // A área vem em pixels da tela, com o teclado colado embaixo; o painel tem a escala dele.
                float topoDoTeclado = area.height > 0f
                    ? (Screen.height - area.height) * (alturaDaTela / Screen.height)
                    : alturaDaTela * (1f - TecladoSemAreaCobre);
                // Onde o campo fica com o cartão no lugar (centrado na altura), sem a subida que já houver: a
                // subida anima, e no meio da animação a posição de agora não serve de base.
                float baseDoCampo = (alturaDaTela - _cartao.layout.height) / 2f + (campo.worldBound.yMax - _cartao.worldBound.yMin);
                subida = Mathf.Max(0f, baseDoCampo - (topoDoTeclado - FolgaDoTeclado));
            }
            if (Mathf.Abs(subida - _subida) < 0.5f) return;
            _subida = subida;
            _cartao.style.marginTop = -subida;
        }

        /// <summary>O "Toque para entrar" de quem já tem sessão; enquanto aparece, um toque em qualquer lugar vale.</summary>
        public void MostrarToque(bool mostrar, string texto = "Toque para entrar")
        {
            _toque.text = texto;
            _toque.EnableInClassList("escondido", !mostrar);
            _entrada.pickingMode = mostrar ? PickingMode.Position : PickingMode.Ignore;
        }

        // ---------- menu e personagens ----------

        public void MostrarMenu(bool mostrar) => _menu.EnableInClassList("oculto", !mostrar);

        public void MostrarPersonagens(bool mostrar) => _personagens.EnableInClassList("oculto", !mostrar);

        public void Ola(string usuario) => _ola.text = string.IsNullOrEmpty(usuario) ? "" : "Olá, " + usuario + "!";

        public void PersonagensCarregando()
        {
            _grade.Clear();
            Estado("Carregando personagens…", false);
        }

        public void PersonagensErro(string mensagem)
        {
            _grade.Clear();
            Estado(mensagem, true);
        }

        public void PersonagensLista(CharacterList lista)
        {
            Estado(null, false);
            _grade.Clear();
            for (int slot = 1; slot <= Math.Max(1, lista.MaxSlots); slot++)
            {
                var personagem = lista.Characters.Find(c => c.Slot == slot);
                _grade.Add(personagem == null ? SlotVazio(slot) : SlotOcupado(slot, personagem));
            }
        }

        private void Estado(string texto, bool falha)
        {
            _estado.text = texto ?? "";
            _estado.EnableInClassList("visivel", !string.IsNullOrEmpty(texto));
            _estado.EnableInClassList("falha", falha);
        }

        private VisualElement SlotVazio(int slot)
        {
            var card = Card(slot, "slot-vazio");
            card.Add(BotaoEmBreve("CRIAR PERSONAGEM", "Criar personagem pelo app chega numa próxima versão. Por enquanto, crie no site."));
            return card;
        }

        private VisualElement SlotOcupado(int slot, CharacterSummary p)
        {
            var card = Card(slot, null);
            var retrato = Novo<VisualElement>("retrato");
            var nome = string.IsNullOrEmpty(p.Name) ? "Sem nome" : p.Name;
            retrato.Add(Texto(nome.Substring(0, 1).ToUpperInvariant(), "retrato-letra"));
            card.Add(retrato);
            card.Add(Texto(nome, "nome"));
            card.Add(Texto(string.IsNullOrEmpty(p.ClassName) ? "Classe desconhecida" : (string.IsNullOrEmpty(p.Race) ? p.ClassName : p.Race + " " + p.ClassName), "classe"));
            var numeros = Novo<VisualElement>("numeros");
            numeros.Add(Numero(p.Level, "Nível"));
            numeros.Add(Numero(p.Floor, "Andar"));
            card.Add(numeros);
            var data = DataCurta(p.UpdatedAt);
            if (data.Length > 0) card.Add(Texto("Salvo em " + data, "atualizado"));
            card.Add(BotaoEmBreve("JOGAR", "Jogar pelo app chega numa próxima versão. Por enquanto, jogue no site."));
            return card;
        }

        private static VisualElement Card(int slot, string classeExtra)
        {
            var card = Novo<VisualElement>("painel");
            card.AddToClassList("slot");
            if (classeExtra != null) card.AddToClassList(classeExtra);
            card.Add(Texto("SLOT " + slot, "numero-slot"));
            return card;
        }

        private Button BotaoEmBreve(string texto, string aviso)
        {
            var botao = new Button(() => AoEmBreve?.Invoke(aviso)) { text = texto };
            botao.AddToClassList("botao");
            botao.AddToClassList("botao-slot");
            return botao;
        }

        private static VisualElement Numero(int valor, string chave)
        {
            var bloco = Novo<VisualElement>("numero");
            bloco.Add(Texto(valor.ToString(CultureInfo.InvariantCulture), "valor"));
            bloco.Add(Texto(chave, "chave"));
            return bloco;
        }

        private static T Novo<T>(string classe) where T : VisualElement, new()
        {
            var e = new T();
            e.AddToClassList(classe);
            return e;
        }

        private static Label Texto(string texto, string classe)
        {
            var l = new Label(texto);
            l.AddToClassList(classe);
            return l;
        }

        /// <summary>"10/10/2026, 22:18" no fuso do aparelho, como o toLocaleString('pt-BR') do site (sem os segundos).</summary>
        public static string DataCurta(string iso)
        {
            if (string.IsNullOrEmpty(iso)) return "";
            return DateTime.TryParse(iso, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var data)
                ? data.ToLocalTime().ToString("dd/MM/yyyy, HH:mm", CultureInfo.InvariantCulture)
                : "";
        }

        // ---------- véu e aviso ----------

        /// <summary>A cor e a opacidade do véu que cobre a tela nas transições (0 = transparente).</summary>
        public void Veu(Color cor, float opacidade)
        {
            _veu.style.backgroundColor = cor;
            _veu.style.opacity = Mathf.Clamp01(opacidade);
            _veu.pickingMode = opacidade > 0.01f ? PickingMode.Position : PickingMode.Ignore;
        }

        /// <summary>Um aviso curto embaixo da tela, que some sozinho.</summary>
        public async void Aviso(string texto)
        {
            int este = ++_avisoAtual;
            _aviso.text = texto;
            _aviso.RemoveFromClassList("escondido");
            await Awaitable.WaitForSecondsAsync(2.4f);
            if (este == _avisoAtual) _aviso.AddToClassList("escondido");
        }
    }
}
