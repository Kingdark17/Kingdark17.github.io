using System;
using System.Collections.Generic;
using RPGLegend.Game.Jogo;
using UnityEngine;
using UnityEngine.UIElements;

namespace RPGLegend.Game.App
{
    /// <summary>
    /// Jogar com alguém (painel-multiplayer.tsx do site): escolher o personagem, criar uma sala ou entrar numa (pelo
    /// código, pela lista de públicas ou pelo convite de um amigo) e, dentro dela, chamar um amigo e ir jogar.
    ///
    /// Cada jogador leva o próprio herói; o mapa é o de quem cria a sala. Aprendiz não entra: a sala pode estar na
    /// masmorra, onde quem não tem classe não tem arma nem poder.
    ///
    /// As salas daqui são só do app: o co-op do app é em tempo real e o do site por turnos, e o servidor não mistura
    /// (quem tenta entrar numa sala do site recebe o recado dele).
    /// </summary>
    public sealed class TelaDeMultiplayer
    {
        private const int TamanhoDoCodigo = 6;
        /// <summary>Sem I, O, 0 e 1, que viram erro de digitação (o mesmo alfabeto do site).</summary>
        private const string Letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        private readonly VisualElement _tela;
        private readonly ScrollView _corpo, _lado;
        private readonly Label _estado;
        private readonly TextField _codigo;
        private List<CharacterSummary> _personagens = new List<CharacterSummary>();
        private List<Amigo> _amigos = new List<Amigo>();
        private List<SalaPublica> _publicas = new List<SalaPublica>();
        private int _slot;
        private bool _publica = true, _aberta, _carregou;
        private FaseDaSala _faseVista;
        private int _vez;

        public event Action AoVoltar;
        /// <summary>O token venceu: quem abriu a tela leva de volta à porta.</summary>
        public event Action AoSessaoExpirada;
        /// <summary>O IR JOGAR, com o slot do personagem escolhido.</summary>
        public event Action<int> AoJogar;

        public TelaDeMultiplayer(VisualElement raiz)
        {
            _tela = raiz.Q("multiplayer");
            _corpo = raiz.Q<ScrollView>("corpo-do-multiplayer");
            _lado = raiz.Q<ScrollView>("lado-do-multiplayer");
            _estado = raiz.Q<Label>("estado-do-multiplayer");
            raiz.Q<Button>("botao-voltar-multiplayer").clicked += () => AoVoltar?.Invoke();

            // O campo do código fica vivo entre um desenho e outro, pra não perder o que se digitava.
            _codigo = new TextField { maxLength = TamanhoDoCodigo };
            _codigo.textEdition.placeholder = "deixe vazio para sortear";
            _codigo.AddToClassList("campo");
            _codigo.AddToClassList("campo-de-envio");
            _codigo.RegisterValueChangedCallback(e =>
            {
                var maiusculo = (e.newValue ?? "").ToUpperInvariant();
                if (maiusculo != e.newValue) _codigo.SetValueWithoutNotify(maiusculo);
            });

            Rede.AoSala += MudouASala;
            Rede.AoMudar += MudouASala;
        }

        public void Abrir()
        {
            int esta = ++_vez;
            _aberta = true;
            _carregou = false;
            _personagens = new List<CharacterSummary>();
            _amigos = new List<Amigo>();
            _publicas = new List<SalaPublica>();
            _faseVista = Rede.Fase;
            _corpo.Clear();
            _lado.Clear();
            Estado("Carregando…", false);
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

        private async void Carregar(int esta)
        {
            try
            {
                var lista = await RpgApi.Personagens(Session.Token);
                if (esta != _vez) return;
                _personagens = lista.Characters;
                var primeiro = _personagens.Find(PodeJogarJunto);
                if (_personagens.Find(p => p.Slot == _slot && PodeJogarJunto(p)) == null) _slot = primeiro?.Slot ?? 0;
                // Amigos e salas públicas são enfeite da tela: falhar neles não a derruba.
                try { _amigos = (await RpgApi.Amigos(Session.Token)).Amigos; }
                catch (ApiError e) when (!e.SessaoInvalida) { }
                if (esta != _vez) return;
                await BuscarPublicas(esta);
                if (esta != _vez) return;
                _carregou = true;
                Estado(null, false);
                Desenhar();
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
                if (esta == _vez) Estado("Não foi possível abrir o modo online.", true);
            }
        }

        private async Awaitable BuscarPublicas(int esta)
        {
            try
            {
                var salas = await RpgApi.SalasPublicas();
                if (esta == _vez) _publicas = salas;
            }
            catch (ApiError) { }
        }

        private async void AtualizarPublicas()
        {
            int esta = _vez;
            try
            {
                await BuscarPublicas(esta);
                if (esta == _vez && _aberta && _carregou) Desenhar();
            }
            catch (OperationCanceledException) { }
            catch (Exception e) { Debug.LogException(e); }
        }

        private void MudouASala()
        {
            if (!_aberta || !_carregou) return;
            // A vitrine muda sozinha (gente criando e entrando): relê quando eu saio de uma sala.
            if (Rede.Fase != _faseVista)
            {
                _faseVista = Rede.Fase;
                if (Rede.Fase == FaseDaSala.Fora) AtualizarPublicas();
            }
            Desenhar();
        }

        // ---------- o desenho ----------

        /// <summary>Aprendiz não entra em sala (a mesma regra do site).</summary>
        private static bool PodeJogarJunto(CharacterSummary personagem) =>
            !string.IsNullOrEmpty(personagem.ClassName) && personagem.ClassName != "Aprendiz";

        private CharacterSummary Escolhido => _personagens.Find(p => p.Slot == _slot && PodeJogarJunto(p));

        private static string NomeDe(CharacterSummary personagem) => string.IsNullOrEmpty(personagem?.Name) ? "Aventureiro" : personagem.Name;

        private void Desenhar()
        {
            _corpo.Clear();
            _lado.Clear();
            if (Rede.NaSala) DesenharNaSala();
            else DesenharFora();
        }

        private void DesenharFora()
        {
            var escolhido = Escolhido;
            if (_personagens.Count == 0)
            {
                _corpo.Add(PecasDaTela.Texto("Crie um personagem antes: é ele que entra na sala.", "aviso-da-loja"));
            }
            else
            {
                _corpo.Add(PecasDaTela.Secao("Com qual personagem?"));
                var grade = PecasDaTela.Grade();
                foreach (var personagem in _personagens)
                {
                    var este = personagem;
                    bool pode = PodeJogarJunto(este);
                    var carta = PecasDaTela.CartaDeEscolha(string.IsNullOrEmpty(este.ClassIcon) ? "🧑" : este.ClassIcon, NomeDe(este),
                        pode ? "nível " + este.Level + " · " + este.ClassName : "Aprendiz: treine na Guilda", _slot == este.Slot && pode, () =>
                        {
                            if (!pode) return;
                            _slot = este.Slot;
                            Desenhar();
                        });
                    carta.AddToClassList("carta-de-personagem");
                    carta.SetEnabled(pode);
                    grade.Add(carta);
                }
                _corpo.Add(grade);
                if (_personagens.Find(PodeJogarJunto) == null)
                    _corpo.Add(PecasDaTela.Texto("Seus personagens ainda são Aprendizes. Treine um na Guilda dos Aventureiros, na cidade, antes de jogar com alguém.", "aviso-da-loja"));
            }

            _corpo.Add(PecasDaTela.Secao("Código da sala"));
            var linha = PecasDaTela.Bloco("linha-de-envio");
            linha.Add(_codigo);
            linha.Add(PecasDaTela.Botao(_publica ? "Pública: sim" : "Pública: não", () =>
            {
                _publica = !_publica;
                Desenhar();
            }));
            _corpo.Add(linha);
            _corpo.Add(PecasDaTela.Texto(_publica ? "A sala aparece na lista de salas públicas." : "Só entra quem tiver o código ou o seu convite.", "legenda-da-loja"));

            bool pronto = Rede.Pronta && Rede.Fase == FaseDaSala.Fora && escolhido != null;
            var acoes = PecasDaTela.Bloco("acoes-do-multiplayer");
            acoes.Add(PecasDaTela.Botao("Criar sala", Criar, true, pronto));
            acoes.Add(PecasDaTela.Botao("Entrar nesse código", () => Entrar(_codigo.value), false, pronto && (_codigo.value ?? "").Trim().Length > 0));
            _corpo.Add(acoes);

            if (!Rede.Pronta) _corpo.Add(PecasDaTela.Texto("Conectando…", "legenda-da-loja"));
            else if (Rede.Fase == FaseDaSala.Entrando) _corpo.Add(PecasDaTela.Texto("Entrando na sala…", "legenda-da-loja"));
            Recados(_corpo);

            // ---- ao lado: o convite e as salas públicas ----
            var convite = Rede.ConvitePendente;
            if (convite != null)
            {
                var caixa = PecasDaTela.Bloco("convite");
                caixa.Add(NomeCru(convite.De + " chamou você para a sala " + convite.Codigo + ".", "texto-do-convite"));
                var botoes = PecasDaTela.Bloco("acoes-do-multiplayer");
                botoes.Add(PecasDaTela.Botao("Aceitar", () =>
                {
                    var codigo = convite.Codigo;
                    Rede.ResponderConvite(true);
                    Entrar(codigo);
                }, true, pronto));
                botoes.Add(PecasDaTela.Botao("Recusar", () => Rede.ResponderConvite(false)));
                caixa.Add(botoes);
                _lado.Add(caixa);
            }

            var cabecalho = PecasDaTela.Bloco("cabecalho-da-conversa");
            cabecalho.Add(PecasDaTela.Secao("Salas públicas"));
            cabecalho.Add(PecasDaTela.Discreto("Atualizar", AtualizarPublicas));
            _lado.Add(cabecalho);
            if (_publicas.Count == 0) _lado.Add(PecasDaTela.Texto("Nenhuma sala aberta agora.", "legenda-da-loja"));
            foreach (var sala in _publicas)
            {
                var esta = sala;
                var item = PecasDaTela.Bloco("pessoa");
                var dados = PecasDaTela.Bloco("dados-da-pessoa");
                dados.Add(NomeCru(esta.Codigo, "nome-da-pessoa"));
                dados.Add(NomeCru(esta.Dono, "offline"));
                item.Add(dados);
                item.Add(PecasDaTela.Botao("Entrar", () => Entrar(esta.Codigo), false, pronto));
                _lado.Add(item);
            }
        }

        private void DesenharNaSala()
        {
            var escolhido = Escolhido;
            _corpo.Add(PecasDaTela.Texto("Sala " + Rede.Codigo, "codigo-da-sala"));
            _corpo.Add(PecasDaTela.Texto(Rede.Conduzo
                ? "Você conduz a aventura: o mapa é o seu, e é você quem passa pelas portas."
                : "Quem criou a sala conduz a aventura: o mapa é o dele.", "legenda-da-loja"));
            _corpo.Add(PecasDaTela.Texto(Rede.TemParceiro ? "Seu parceiro está na sala." : "Esperando alguém entrar…", Rede.TemParceiro ? "online" : "offline"));
            if (escolhido != null) _corpo.Add(PecasDaTela.Texto("Você entra com " + NomeDe(escolhido) + ".", "legenda-da-loja"));
            Recados(_corpo);

            var acoes = PecasDaTela.Bloco("acoes-do-multiplayer");
            acoes.Add(PecasDaTela.Botao("IR JOGAR", () =>
            {
                if (escolhido != null) AoJogar?.Invoke(escolhido.Slot);
            }, true, escolhido != null));
            acoes.Add(PecasDaTela.Botao("Sair da sala", Rede.SairDaSala));
            _corpo.Add(acoes);

            // ---- ao lado: chamar um amigo ----
            _lado.Add(PecasDaTela.Secao("Chamar um amigo"));
            if (Rede.TemParceiro)
            {
                _lado.Add(PecasDaTela.Texto("A sala já está completa.", "legenda-da-loja"));
                return;
            }
            if (_amigos.Count == 0) _lado.Add(PecasDaTela.Texto("Você ainda não tem amigos aqui. Adicione pelo AMIGOS do menu.", "legenda-da-loja"));
            foreach (var amigo in _amigos)
            {
                var este = amigo;
                var item = PecasDaTela.Bloco("pessoa");
                var dados = PecasDaTela.Bloco("dados-da-pessoa");
                dados.Add(NomeCru(este.Username, "nome-da-pessoa"));
                dados.Add(PecasDaTela.Texto(este.Online ? "online" : "offline", este.Online ? "online" : "offline"));
                item.Add(dados);
                item.Add(PecasDaTela.Botao("Convidar", () => Rede.Convidar(este.Username, NomeDe(escolhido)), false, este.Online));
                _lado.Add(item);
            }
            _lado.Add(PecasDaTela.Texto("O amigo precisa estar no app: quem está no site não entra numa sala daqui.", "legenda-da-loja"));
        }

        private void Recados(VisualElement onde)
        {
            if (Rede.Recado.Length > 0) onde.Add(NomeCru(Rede.Recado, "aviso-da-loja"));
            if (Rede.Erro.Length > 0) onde.Add(NomeCru(Rede.Erro, "erro-da-loja"));
        }

        /// <summary>Texto que leva o nome de outra pessoa (ou veio do servidor): vai cru, sem virar marcação.</summary>
        private static Label NomeCru(string texto, string classe)
        {
            var rotulo = new Label(texto) { enableRichText = false };
            rotulo.AddToClassList(classe);
            return rotulo;
        }

        // ---------- as ações ----------

        private void Criar()
        {
            var escolhido = Escolhido;
            if (escolhido == null) return;
            var codigo = (_codigo.value ?? "").Trim().ToUpperInvariant();
            if (codigo.Length == 0) codigo = CodigoNovo();
            _codigo.SetValueWithoutNotify(codigo);
            Rede.CriarSala(codigo, NomeDe(escolhido), _publica);
        }

        private void Entrar(string codigo)
        {
            var escolhido = Escolhido;
            codigo = (codigo ?? "").Trim().ToUpperInvariant();
            if (escolhido == null || codigo.Length == 0) return;
            Rede.EntrarNaSala(codigo, NomeDe(escolhido));
        }

        private static string CodigoNovo()
        {
            var codigo = new char[TamanhoDoCodigo];
            for (int i = 0; i < codigo.Length; i++) codigo[i] = Letras[UnityEngine.Random.Range(0, Letras.Length)];
            return new string(codigo);
        }

        private void Estado(string texto, bool falha)
        {
            _estado.text = texto ?? "";
            _estado.EnableInClassList("visivel", !string.IsNullOrEmpty(texto));
            _estado.EnableInClassList("falha", falha);
        }
    }
}
