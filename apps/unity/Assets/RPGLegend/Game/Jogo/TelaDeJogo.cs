using System;
using System.Collections.Generic;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using RPGLegend.Game.App;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UIElements;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// A tela de jogo do app (UI/App.uxml, "jogo"): liga a <see cref="Partida"/> à <see cref="SalaEmCena"/> e às
    /// telas, como a tela-jogo.tsx do site. Carrega o save do slot, anda pelo teclado (WASD e setas) ou pelo joystick
    /// que aparece onde o dedo encosta na sala, e grava na nuvem 2,5 s depois da última mudança.
    ///
    /// As telas de sala abrem numa janela por cima da sala: as pequenas (conversa, evento, totem, quadro de
    /// missões, mestre) aqui e em TelaDeJogo.Telas.cs; a mochila, a loja e a guilda em janela larga, com colunas que
    /// rolam por dentro (TelaDeJogo.Mochila.cs, TelaDeJogo.Loja.cs).
    /// </summary>
    public sealed partial class TelaDeJogo : MonoBehaviour
    {
        private const float RaioDoJoystick = 56f;
        private const float ZonaMorta = 0.15f;
        /// <summary>
        /// Quanto o que fala do lugar fica na tela depois da chegada: um tanto fixo mais o tempo de ler, entre o mínimo
        /// e o máximo. Depois some apagando.
        /// </summary>
        private const float ProporcaoDaLuta = 9f / 7f;
        private const float SegundosDoLugar = 3f, SegundosPorLetra = 0.05f, MinimoDoLugar = 5f, MaximoDoLugar = 15f, SegundosDoApagar = 0.4f;

        private static readonly Dictionary<string, Color> CorDoTipo = new Dictionary<string, Color>
        {
            ["start"] = Hex(0x2a2c37), ["normal"] = Hex(0x22242e), ["npc"] = Hex(0x26313a), ["treasure"] = Hex(0x332b1c),
            ["monster"] = Hex(0x331d1d), ["boss"] = Hex(0x3a1414), ["stairs"] = Hex(0x1a2836), ["exit"] = Hex(0x1f2e29),
            ["event"] = Hex(0x2a2233), ["shop"] = Hex(0x2c2818), ["blacksmith"] = Hex(0x26262c), ["tavern"] = Hex(0x2c1f1a),
            ["gate"] = Hex(0x1c2a24), ["questboard"] = Hex(0x202a1e),
        };

        private static Color Hex(int rgb) => new Color(((rgb >> 16) & 0xff) / 255f, ((rgb >> 8) & 0xff) / 255f, (rgb & 0xff) / 255f);

        /// <summary>A pessoa saiu da partida, já gravada: quem abriu volta pra lista de personagens.</summary>
        public event Action AoSair;

        private VisualElement _tela, _palco, _areaDaLuta, _caixaDoLugar, _baseDoJoystick, _alavanca, _minimapa, _caixa, _escolhas, _recado, _sobre, _botoesDaJanela, _vida, _mana;
        private VisualElement _janelaEl, _colunasDaJanela;
        private Label _dica, _nome, _nivel, _numeroDaVida, _numeroDaMana, _lugar, _iconeDaCaixa, _tituloDaCaixa, _textoDaCaixa, _tituloDoRecado, _textoDoRecado, _salvamento, _tituloDaJanela, _carregando;
        private Label _ouroDaJanela, _linhaDaJanela;
        private VisualElement _narracao;
        private ScrollView _conteudoDaJanela;
        /// <summary>O lugar cuja chegada a caixa do lugar já mostrou, e até quando (Time.unscaledTime) ela fica.</summary>
        private string _lugarMostrado;
        private float _lugarAte, _lugarSomeEm;
        private Button _mochila, _diario, _sairDoJogo;

        private Partida _partida;
        private SalaEmCena _sala;
        private BichoDeEstimacao _bicho;
        private string _token;

        /// <summary>O que a janela por cima mostra: "sala" (uma tela de sala), "diario", "guia", "ficha", "saida" ou null.</summary>
        private string _janela;
        private bool _saindo;

        /// <summary>O nível que a tela mostrou por último: subir toca o som do site (painel-heroi.tsx).</summary>
        private double _nivelMostrado = -1;

        /// <summary>Onde o herói aparece nesta sala (a chegada pela porta), como o naSala do site.</summary>
        private string _salaDaChegada, _mapaDaChegada;
        private double _xDaChegada, _yDaChegada;
        private Walker _chegada;
        private int _volta;

        private int? _dedo;
        private Vector2 _origemDoDedo;
        private Vetor _joystick = new Vetor(0, 0);

        private static double AgoraMs => Time.realtimeSinceStartupAsDouble * 1000.0;

        // ---------- abrir e fechar ----------

        /// <summary>Mostra a tela, ainda com "Carregando progresso…" por cima (a troca de tela acontece no escuro).</summary>
        public void Preparar(VisualElement raiz)
        {
            if (_tela == null) Ligar(raiz);
            _partida = null;
            _janela = null;
            _saindo = false;
            _nivelMostrado = -1;
            _lugarMostrado = null;
            _caixaDoLugar.AddToClassList("escondida");
            EsquecerEscolhas();
            EsquecerLuta();
            _bicho.Mostrar(null);
            _salaDaChegada = null;
            _mapaDaChegada = null;
            _chegada = null;
            _volta = 0;
            SoltarDedo(-1);
            Salvamento("", false);
            _sobre.AddToClassList("oculto");
            _tela.RemoveFromClassList("oculto");
            _carregando.text = "Carregando progresso…";
            _carregando.RemoveFromClassList("escondido");
        }

        /// <summary>Carrega o save do slot e começa. Devolve false se não deu (a mensagem fica um instante na tela).</summary>
        public async Awaitable<bool> Carregar(int slot)
        {
            _token = Session.Token;
            EstadoDoJogo estado;
            string assinatura;
            try
            {
                var nuvem = await RpgApi.CarregarSave(_token, slot);
                if (nuvem.Save == null)
                {
                    await Mensagem("Este slot ainda não tem personagem.");
                    return false;
                }
                estado = Estados.RetomarSave(JogoJson.LerSave(nuvem.Save));
                assinatura = nuvem.Signature;
            }
            catch (ApiError e)
            {
                await Mensagem(e.Message);
                return false;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                await Mensagem("Erro inesperado ao carregar o progresso.");
                return false;
            }

            // No PC o cajado pede letras (desenhar com o mouse é mais difícil que com o dedo); no celular, o desenho.
            _partida = new Partida(slot, estado, assinatura) { Agora = AgoraMs, Teclado = !Application.isMobilePlatform };
            _partida.Mudou += Redesenhar;
            _partida.SaiuDaSecreta += direcao =>
            {
                // Quem sai da secreta reaparece na passagem, e não por onde entrou na sala da outra vez.
                _chegada = RoomWalk.Arrival(direcao);
                _volta++;
            };
            _partida.Som += Sons.Tocar;
            _partida.NaLuta += MostrarAcontecimentos;
            _partida.LutaAcabou += AoAcabarALuta;
            _partida.PosicaoDoHeroi = () => _sala?.Walker;

            if (_sala == null)
            {
                _sala = SalaEmCena.Criar();
                _sala.Entrada = Entrada;
                _sala.AoSair = direcao => _partida != null && _partida.Mover(direcao);
                _sala.AoEncostar = id => _partida?.AoEncostar(id);
                _palco.style.backgroundImage = new StyleBackground(Background.FromRenderTexture(_sala.Textura));
                AjustarPalco();
            }
            _sala.gameObject.SetActive(true);

            _carregando.AddToClassList("escondido");
            Redesenhar();
            // Quem fechou o app no meio de uma luta volta pra ela.
            _partida.RetomarLutaSeHouver();
            CarregarPet();
            return true;
        }

        /// <summary>
        /// O pet vem da conta, não do save (o site pergunta o mesmo ao abrir a partida). Falhar aqui não é erro de
        /// jogo: sem pet, a partida segue igual.
        /// </summary>
        private async void CarregarPet()
        {
            var partida = _partida;
            try
            {
                var eu = await RpgApi.Eu(_token);
                if (partida == _partida)
                {
                    _bicho.Mostrar(eu.Pet);
                    // Os bônus do pet valem na luta, como no site.
                    _partida.Pet = eu.Pet;
                }
            }
            catch (Exception) { /* sem pet */ }
        }

        private async Awaitable Mensagem(string texto)
        {
            _carregando.text = texto;
            await Awaitable.WaitForSecondsAsync(2f, destroyCancellationToken);
        }

        /// <summary>Esconde a tela e para a sala (a partida já foi gravada por quem chamou).</summary>
        public void Fechar()
        {
            _partida = null;
            EsquecerLuta();
            if (_sala != null)
            {
                _sala.SairDaLuta(_sala.Walker);
                _sala.gameObject.SetActive(false);
            }
            _tela?.AddToClassList("oculto");
            _sobre?.AddToClassList("oculto");
        }

        private void Ligar(VisualElement raiz)
        {
            _tela = raiz.Q("jogo");
            _palco = raiz.Q("palco");
            _areaDaLuta = raiz.Q("area-da-luta");
            _caixaDoLugar = raiz.Q("caixa-do-lugar");
            _baseDoJoystick = raiz.Q("base-do-joystick");
            _alavanca = raiz.Q("alavanca-do-joystick");
            _dica = raiz.Q<Label>("dica-do-joystick");
            _nome = raiz.Q<Label>("nome-do-heroi");
            _nivel = raiz.Q<Label>("nivel-do-heroi");
            _vida = raiz.Q("vida");
            _mana = raiz.Q("mana");
            _numeroDaVida = raiz.Q<Label>("numero-da-vida");
            _numeroDaMana = raiz.Q<Label>("numero-da-mana");
            _minimapa = raiz.Q("minimapa");
            _lugar = raiz.Q<Label>("lugar");
            _narracao = raiz.Q("narracao");
            _caixa = raiz.Q("caixa");
            _iconeDaCaixa = raiz.Q<Label>("icone-da-caixa");
            _tituloDaCaixa = raiz.Q<Label>("titulo-da-caixa");
            _textoDaCaixa = raiz.Q<Label>("texto-da-caixa");
            _escolhas = raiz.Q("escolhas-da-caixa");
            _recado = raiz.Q("recado");
            _tituloDoRecado = raiz.Q<Label>("titulo-do-recado");
            _textoDoRecado = raiz.Q<Label>("texto-do-recado");
            _mochila = raiz.Q<Button>("botao-mochila");
            _diario = raiz.Q<Button>("botao-diario");
            _sairDoJogo = raiz.Q<Button>("botao-sair-do-jogo");
            _salvamento = raiz.Q<Label>("estado-do-salvamento");
            _sobre = raiz.Q("sobre-o-jogo");
            _janelaEl = raiz.Q("janela");
            _tituloDaJanela = raiz.Q<Label>("titulo-da-janela");
            _ouroDaJanela = raiz.Q<Label>("ouro-da-janela");
            _linhaDaJanela = raiz.Q<Label>("linha-da-janela");
            _conteudoDaJanela = raiz.Q<ScrollView>("conteudo-da-janela");
            _colunasDaJanela = raiz.Q("colunas-da-janela");
            _botoesDaJanela = raiz.Q("botoes-da-janela");
            _carregando = raiz.Q<Label>("carregando-jogo");

            raiz.Q<Button>("botao-sim").clicked += () => _partida?.ConfirmarSim();
            raiz.Q<Button>("botao-nao").clicked += () => _partida?.ConfirmarNao();
            raiz.Q<Button>("fechar-recado").clicked += () => _partida?.FecharRecado();
            _mochila.clicked += () => _partida?.AbrirMochila();
            _diario.clicked += AbrirDiario;
            raiz.Q<Button>("botao-guia").clicked += AbrirGuia;
            _bicho = new BichoDeEstimacao(raiz.Q<Button>("bichinho"));
            raiz.Q<Button>("botao-ficha").clicked += AbrirFicha;
            _sairDoJogo.clicked += PerguntarSaida;
            // Tocar no que fala do lugar fecha antes da hora.
            _caixaDoLugar.RegisterCallback<PointerDownEvent>(_ => ApagarLugar());

            _tela.RegisterCallback<GeometryChangedEvent>(_ => AjustarPalco());
            _palco.RegisterCallback<PointerDownEvent>(ApertarDedo);
            _palco.RegisterCallback<PointerMoveEvent>(ArrastarDedo);
            _palco.RegisterCallback<PointerUpEvent>(e => SoltarDedo(e.pointerId));
            _palco.RegisterCallback<PointerCancelEvent>(e => SoltarDedo(e.pointerId));
            _palco.RegisterCallback<PointerCaptureOutEvent>(e => SoltarDedo(e.pointerId));

            CriarHudDaLuta(_areaDaLuta);
        }

        /// <summary>
        /// O palco é a tela toda (decisão do usuário em 2026-10-23, só no app): a cena ganha a proporção dele, e a
        /// cidade enche a tela; a sala da masmorra (9 × 9) fica no meio, na altura toda; e a área da luta, também no meio.
        /// </summary>
        private void AjustarPalco()
        {
            var area = _palco.contentRect;
            if (float.IsNaN(area.height) || area.height <= 0 || area.width <= 0) return;
            if (_sala != null && _sala.AjustarVista(area.width / area.height))
                _palco.style.backgroundImage = new StyleBackground(Background.FromRenderTexture(_sala.Textura));

            // A área da luta no meio, na altura toda. A luta foi afinada na sala 9 × 7 e continua nessa proporção
            // depois que a sala virou 9 × 9 (2026-10-24): quadrada, os botões dos poderes cobriam a caixa e os monstros.
            float proporcao = ProporcaoDaLuta;
            float largura = Mathf.Floor(Mathf.Min(area.width, area.height * proporcao));
            float altura = Mathf.Floor(largura / proporcao);
            _areaDaLuta.style.width = largura;
            _areaDaLuta.style.height = altura;
            _areaDaLuta.style.left = Mathf.Floor((area.width - largura) / 2f);
            _areaDaLuta.style.top = Mathf.Floor((area.height - altura) / 2f);
        }

        // ---------- a cada quadro ----------

        /// <summary>A exploração está livre: sem tela, pergunta ou janela na frente.</summary>
        private bool Andando => _partida != null && _partida.Tela == null && !_partida.Confirmando && _janela == null;

        private void Update()
        {
            if (_partida == null) return;
            _partida.Agora = AgoraMs;
            if (_sala != null) _sala.Ativo = Andando && _partida.Luta == null;
            if (!Andando && _dedo.HasValue) SoltarDedo(-1);
            AtualizarLuta();
            if (_partida == null) return;
            AtualizarLugar();
            // Na luta os nomes dos monstros ficam no alto da sala: os botões descem em coluna pelo escuro da esquerda.
            _tela.EnableInClassList("em-luta", _partida.Luta != null);

            // Esc no PC, e o "voltar" do Android, que chega como Esc.
            var teclado = Keyboard.current;
            if (teclado != null && teclado.escapeKey.wasPressedThisFrame)
            {
                if (JanelaSemTela) FecharJanela();
                else if (_janela == "sala") _sairDaTela?.Invoke();
                else if (_janela == null) PerguntarSaida();
            }

            if (_partida.HoraDeGravar(AgoraMs)) Gravar(false);
        }

        /// <summary>As teclas seguradas (duas juntas são diagonal) ou o joystick, que manda enquanto está sendo usado.</summary>
        private Vetor Entrada()
        {
            var teclas = new List<string>(4);
            var teclado = Keyboard.current;
            if (teclado != null)
            {
                if (teclado.wKey.isPressed || teclado.upArrowKey.isPressed) teclas.Add("N");
                if (teclado.sKey.isPressed || teclado.downArrowKey.isPressed) teclas.Add("S");
                if (teclado.dKey.isPressed || teclado.rightArrowKey.isPressed) teclas.Add("E");
                if (teclado.aKey.isPressed || teclado.leftArrowKey.isPressed) teclas.Add("W");
            }
            return AndarNaSala.EntradaCombinada(teclas, _joystick);
        }

        // ---------- joystick: aparece onde o dedo encosta (o joystick.tsx do site) ----------

        private void ApertarDedo(PointerDownEvent e)
        {
            if (!Andando || _dedo.HasValue) return;
            _dedo = e.pointerId;
            _origemDoDedo = e.localPosition;
            _palco.CapturePointer(e.pointerId);
            _baseDoJoystick.style.left = _origemDoDedo.x;
            _baseDoJoystick.style.top = _origemDoDedo.y;
            _baseDoJoystick.RemoveFromClassList("escondido");
            MoverAlavanca(Vector2.zero);
            _dica.AddToClassList("escondido");
        }

        private void ArrastarDedo(PointerMoveEvent e)
        {
            if (_dedo != e.pointerId) return;
            var delta = ((Vector2)e.localPosition - _origemDoDedo) / RaioDoJoystick;
            float comprimento = delta.magnitude;
            if (comprimento > 1) delta /= comprimento;
            _joystick = comprimento < ZonaMorta ? new Vetor(0, 0) : new Vetor(delta.x, delta.y);
            MoverAlavanca(delta * RaioDoJoystick);
        }

        private void MoverAlavanca(Vector2 deslocamento) => _alavanca.style.translate = new Translate(deslocamento.x, deslocamento.y);

        /// <summary>Solta o joystick deste dedo (-1: o que estiver apertado).</summary>
        private void SoltarDedo(int id)
        {
            if (!_dedo.HasValue || (id != _dedo.Value && id != -1)) return;
            var dedo = _dedo.Value;
            _dedo = null;
            _joystick = new Vetor(0, 0);
            if (_palco.HasPointerCapture(dedo)) _palco.ReleasePointer(dedo);
            _baseDoJoystick.AddToClassList("escondido");
        }

        // ---------- desenhar ----------

        private void Redesenhar()
        {
            if (_partida == null) return;
            var estado = _partida.Estado;
            var celula = _partida.CelulaAtual;
            var secreta = _partida.Secreta;
            var visual = Apresentacoes.ApresentacaoDe(estado);

            DesenharHeroi(estado.Hero);
            DesenharMinimapa(estado, visual);
            _lugar.text = secreta != null ? "Sala Secreta" : visual.Lugar;
            DesenharNarracao(estado, celula, secreta);
            MostrarLugarNaChegada(secreta != null);
            DesenharCaixa(celula, visual);
            DesenharRecado();
            double pontos = estado.Hero.AttrPoints ?? 0;
            _mochila.text = pontos > 0 ? "MOCHILA (" + Js.NumberToString(pontos) + ")" : "MOCHILA";
            _diario.text = _partida.Diario.Count > 0 ? "DIÁRIO (" + _partida.Diario.Count + ")" : "DIÁRIO";
            DesenharTela();
            DesenharSala(estado, celula, secreta, visual);
        }

        private void DesenharHeroi(Hero hero)
        {
            // Como o painel do site: o nível novo é percebido aqui, venha de onde vier (missão, combate, mochila).
            if (_nivelMostrado >= 0 && hero.Level > _nivelMostrado) Sons.Tocar("levelup");
            _nivelMostrado = hero.Level;
            _nome.text = hero.Name ?? "";
            _nivel.text = "nv " + Js.NumberToString(hero.Level);
            Encher(_vida, _numeroDaVida, hero.Hp, hero.MaxHp);
            Encher(_mana, _numeroDaMana, hero.Mp, hero.MaxMp);
        }

        private static void Encher(VisualElement barra, Label numero, double atual, double maximo)
        {
            float parte = maximo > 0 ? Mathf.Clamp01((float)(atual / maximo)) : 0f;
            barra.style.width = Length.Percent(parte * 100f);
            numero.text = Js.NumberToString(Math.Floor(atual)) + "/" + Js.NumberToString(Math.Floor(maximo));
        }

        /// <summary>O minimapa do site (mapa.tsx): a cor e a arte só em sala cujo tipo o jogador já sabe.</summary>
        private void DesenharMinimapa(EstadoDoJogo estado, Apresentacao visual)
        {
            _minimapa.Clear();
            // Na cidade o mapa é a própria cena: a grade de salas sai, com a moldura.
            if (estado.MapMode == "city")
            {
                _minimapa.style.display = DisplayStyle.None;
                return;
            }
            _minimapa.style.display = StyleKeyword.Null;
            int colunas = (int)estado.MapCols;
            int linhas = (int)estado.MapRows;
            var grade = estado.Grade;
            for (int y = 0; y < linhas && y < grade.Count; y++)
            {
                var linha = grade[y];
                // Uma linha por fileira do mapa: quebrar pela largura errava a conta por arredondamento.
                var fileira = new VisualElement { pickingMode = PickingMode.Ignore };
                fileira.AddToClassList("fileira-do-minimapa");
                _minimapa.Add(fileira);
                for (int x = 0; x < colunas && x < linha.Count; x++)
                {
                    var celula = linha[x];
                    bool aqui = x == estado.Pos.X && y == estado.Pos.Y;
                    var estadoDaSala = Neblina.EstadoDaSala(grade, celula, estado.MapCols, estado.MapRows);
                    bool sabe = Neblina.SabeOTipo(estadoDaSala);
                    bool esgotada = estadoDaSala == EstadosDaSala.Visitada && visual.Gasta(celula);

                    var quadro = new VisualElement();
                    quadro.AddToClassList("celula");
                    quadro.AddToClassList(estadoDaSala == EstadosDaSala.Vazia ? "celula-vazia"
                        : estadoDaSala == EstadosDaSala.Inexplorada ? "celula-desconhecida"
                        : estadoDaSala == EstadosDaSala.Visitada ? "celula-visitada" : "celula-conhecida");
                    if (aqui) quadro.AddToClassList("celula-aqui");
                    if (esgotada) quadro.AddToClassList("celula-esgotada");
                    if (sabe && CorDoTipo.TryGetValue(celula.Type, out var cor)) quadro.style.backgroundColor = cor;

                    if (aqui)
                    {
                        quadro.Add(Imagem("Mapa/jogador"));
                    }
                    else if (sabe)
                    {
                        var arte = FigurasDaSala.ArteDoTipo(celula.Type);
                        if (arte != null)
                        {
                            quadro.Add(Imagem(arte));
                        }
                        else
                        {
                            var icone = visual.Icone(celula);
                            if (!string.IsNullOrEmpty(icone))
                            {
                                var emoji = new Label(icone);
                                emoji.AddToClassList("icone-da-celula");
                                quadro.Add(emoji);
                            }
                        }
                    }
                    fileira.Add(quadro);
                }
            }
        }

        private static VisualElement Imagem(string recurso)
        {
            var imagem = new VisualElement { pickingMode = PickingMode.Ignore };
            imagem.AddToClassList("arte-da-celula");
            var sprite = Resources.Load<Sprite>(recurso);
            if (sprite != null) imagem.style.backgroundImage = new StyleBackground(sprite);
            return imagem;
        }

        private void DesenharNarracao(EstadoDoJogo estado, RoomCell celula, NaSecreta secreta)
        {
            _narracao.Clear();
            if (secreta != null)
            {
                Linha(ExtrasDaSala.TextoDaSecreta(celula, secreta.Indice), "linha-da-narracao");
                var volta = Directions.Labels.Get(Directions.Opposite.Get(secreta.Lado)) ?? "";
                Linha("A passagem de volta fica ao " + volta.ToLowerInvariant() + ".", "pistas-das-portas");
                return;
            }
            if (estado.MapMode == "city")
            {
                // A cidade desenhada não tem sala pra narrar: diz o que há em volta e como entrar.
                Linha(Cidades.TextoDaCidade, "linha-da-narracao");
                Linha(Cidades.PistasDaCidade(estado), "pistas-das-portas");
                return;
            }
            var narracao = Narrador.Narrar(estado);
            if (narracao == null) return;
            Linha(narracao.Ambiente, "linha-da-narracao");
            if (!string.IsNullOrEmpty(narracao.Conteudo)) Linha(narracao.Conteudo, "linha-da-narracao");
            var extras = ExtrasDaSala.DescricaoDosExtras(celula);
            if (!string.IsNullOrEmpty(extras)) Linha(extras, "linha-da-narracao");
            // As pistas das portas (Norte: parede…) saíram em 2026-10-23, a pedido do usuário, no app e no site: a sala
            // desenhada e o minimapa já mostram o que elas diziam.
        }

        private void Linha(string texto, string classe)
        {
            var linha = new Label(TextoDoJogo.ParaTela(texto));
            linha.AddToClassList(classe);
            _narracao.Add(linha);
        }

        private void DesenharCaixa(RoomCell celula, Apresentacao visual)
        {
            if (_partida.Confirmando && celula != null)
            {
                var icone = visual.Icone(celula);
                Caixa(string.IsNullOrEmpty(icone) ? "🚪" : icone, null, visual.TextoDeEntrada(celula), true);
                return;
            }
            var aviso = _partida.Aviso;
            if (aviso != null)
            {
                Caixa(aviso.Icone, aviso.Titulo, aviso.Texto, false);
                return;
            }
            _caixa.AddToClassList("escondida");
        }

        private void Caixa(string icone, string titulo, string texto, bool pergunta)
        {
            _caixa.RemoveFromClassList("escondida");
            _iconeDaCaixa.text = icone ?? "";
            _tituloDaCaixa.text = titulo ?? "";
            _tituloDaCaixa.style.display = string.IsNullOrEmpty(titulo) ? DisplayStyle.None : DisplayStyle.Flex;
            _textoDaCaixa.text = TextoDoJogo.ParaTela(texto);
            _escolhas.EnableInClassList("escondida", !pergunta);
        }

        /// <summary>
        /// O que fala do lugar aparece quando o herói chega a outro lugar (outra sala, a secreta, a cidade) e some
        /// sozinho depois do tempo de ler (decisão do usuário em 2026-10-23). Fechar uma loja ou mudar algo na sala não
        /// conta como chegar.
        /// </summary>
        private void MostrarLugarNaChegada(bool naSecreta)
        {
            var lugar = _partida.ChaveDaSala + (naSecreta ? ":secreta" : "");
            if (lugar == _lugarMostrado) return;
            _lugarMostrado = lugar;
            int letras = _lugar.text.Length;
            foreach (var linha in _narracao.Children())
                if (linha is Label rotulo) letras += rotulo.text.Length;
            _lugarAte = Time.unscaledTime + Mathf.Clamp(SegundosDoLugar + letras * SegundosPorLetra, MinimoDoLugar, MaximoDoLugar);
            _lugarSomeEm = 0f;
            _caixaDoLugar.RemoveFromClassList("apagando");
            _caixaDoLugar.RemoveFromClassList("escondida");
        }

        /// <summary>Começa a apagar o que fala do lugar (some de vez depois da transição).</summary>
        private void ApagarLugar()
        {
            if (_lugarSomeEm > 0f || _caixaDoLugar.ClassListContains("escondida")) return;
            _lugarAte = 0f;
            _lugarSomeEm = Time.unscaledTime + SegundosDoApagar;
            _caixaDoLugar.AddToClassList("apagando");
        }

        /// <summary>A cada quadro: na hora, apaga; apagado, sai do caminho do dedo. Em luta não aparece.</summary>
        private void AtualizarLugar()
        {
            if (_partida.Luta != null && !_caixaDoLugar.ClassListContains("escondida"))
            {
                _caixaDoLugar.AddToClassList("escondida");
                _lugarSomeEm = 0f;
                return;
            }
            if (_lugarAte > 0f && Time.unscaledTime >= _lugarAte) ApagarLugar();
            if (_lugarSomeEm > 0f && Time.unscaledTime >= _lugarSomeEm)
            {
                _lugarSomeEm = 0f;
                _caixaDoLugar.AddToClassList("escondida");
            }
        }

        private void DesenharRecado()
        {
            var recado = _partida.Recado;
            _recado.EnableInClassList("escondida", recado == null);
            if (recado == null) return;
            _tituloDoRecado.text = recado.Titulo ?? "";
            _textoDoRecado.text = TextoDoJogo.ParaTela(recado.Texto);
        }

        private void DesenharSala(EstadoDoJogo estado, RoomCell celula, NaSecreta secreta, Apresentacao visual)
        {
            if (_sala == null) return;
            _dica.EnableInClassList("escondido", !Andando || _dedo.HasValue || Touchscreen.current == null || _partida.Luta != null);

            // Onde o herói aparece: quem veio da sala ao lado, na porta por onde entrou; quem chegou de outro jeito
            // (portão, escada, totem), no meio.
            var salaAgora = _partida.ChaveDaSala;
            var mapaAgora = _partida.ChaveDoMapa;

            // A cidade desenhada do Breno: um mapa só, no lugar das salas. Quem volta da masmorra aparece na entrada
            // dela; quem carrega o jogo, na porta da sala do save.
            if (estado is EstadoNaCidade cidade)
            {
                if (salaAgora != _salaDaChegada)
                {
                    bool daMasmorra = _mapaDaChegada != null && _mapaDaChegada.StartsWith("dungeon", StringComparison.Ordinal);
                    _salaDaChegada = salaAgora;
                    _mapaDaChegada = mapaAgora;
                    _xDaChegada = estado.Pos.X;
                    _yDaChegada = estado.Pos.Y;
                    _chegada = Cidades.ChegadaNaCidade(cidade, daMasmorra);
                    _volta = 0;
                }
                var quem = estado.Hero;
                _sala.DefinirHeroi(Catalog.IdDaRaca(quem.RaceId, quem.Race), string.IsNullOrEmpty(quem.RaceIcon) ? "🙂" : quem.RaceIcon);
                _sala.MostrarCidade(salaAgora, Cidades.PlantaDaCidadeAgora(cidade), Cidades.TroncosNoCaminho(cidade), _chegada);
                return;
            }

            if (salaAgora != _salaDaChegada)
            {
                double dx = estado.Pos.X - _xDaChegada;
                double dy = estado.Pos.Y - _yDaChegada;
                bool vizinha = _mapaDaChegada == mapaAgora && Math.Abs(dx) + Math.Abs(dy) == 1;
                string veioPor = vizinha ? dx == 1 ? "E" : dx == -1 ? "W" : dy == 1 ? "S" : "N" : null;
                _salaDaChegada = salaAgora;
                _mapaDaChegada = mapaAgora;
                _xDaChegada = estado.Pos.X;
                _yDaChegada = estado.Pos.Y;
                _chegada = RoomWalk.Arrival(veioPor);
                _volta = 0;
            }

            RoomLayout planta;
            Dictionary<string, Figura> figuras;
            string chave;
            Walker chegada;
            if (secreta != null)
            {
                planta = ExtrasDaSala.PlantaDaSalaSecreta(secreta.Lado);
                figuras = FigurasDaSala.Da(celula, null, secreta.Indice);
                chave = salaAgora + "#secreta";
                chegada = RoomWalk.Arrival(secreta.Lado);
            }
            else
            {
                var icone = celula != null ? visual.Icone(celula) ?? "" : "";
                var portas = new DoorMap();
                foreach (var d in Directions.Order)
                    if (celula?.Doors != null && celula.Doors.TryGet(d, out var aberta) && aberta) portas.Set(d, true);
                var passagem = ExtrasDaSala.PassagemSecreta(celula);
                if (passagem != null) portas.Set(passagem.Lado, true);
                planta = AndarNaSala.PlantaDaSala(portas, ExtrasDaSala.ObjetosDaSala(celula, icone != ""));
                var conteudo = icone == "" ? null : new Figura { Arte = FigurasDaSala.ArteDoTipo(celula.Type), Emoji = icone };
                figuras = FigurasDaSala.Da(celula, conteudo, null);
                chave = salaAgora + "#" + _volta;
                chegada = _chegada;
            }

            var heroi = estado.Hero;
            _sala.DefinirHeroi(Catalog.IdDaRaca(heroi.RaceId, heroi.Race), string.IsNullOrEmpty(heroi.RaceIcon) ? "🙂" : heroi.RaceIcon);
            _sala.Mostrar(chave, planta, TemaDaSala.Do(estado), figuras, chegada, estado.MapMode == "dungeon" ? estado.Masmorra?.Dungeon : null);
        }

        // ---------- janelas por cima ----------

        /// <summary>O que fecha a tela de sala aberta, como o botão dela (o Esc e o "voltar" do Android).</summary>
        private Action _sairDaTela;

        private void DesenharTela()
        {
            var tela = _partida.Tela;
            if (tela == null)
            {
                _sairDaTela = null;
                if (_janela == "sala")
                {
                    _janela = null;
                    _sobre.AddToClassList("oculto");
                    EsquecerEscolhas();
                }
                return;
            }
            if (_janela != null && _janela != "sala") FecharJanela();
            _janela = "sala";
            if (tela.Tipo != _tipoDaTela) EsquecerEscolhas();
            _tipoDaTela = tela.Tipo;
            switch (tela.Tipo)
            {
                case "portao": TelaDoPortao(tela.Portao); break;
                case "dialogo": TelaDoDialogo(tela.Dialogo); break;
                case "evento": TelaDoEvento(tela.Evento); break;
                case "totem": TelaDoTotem(tela.Totem); break;
                case "missoes": TelaDasMissoes(tela.Quadro); break;
                case "professor": TelaDoProfessor(tela.Professor); break;
                case "guilda": TelaDaGuilda(tela.Guilda); break;
                case "encantadora": TelaDaEncantadora(tela.Encantadora); break;
                case "mochila": TelaDaMochila(tela.Mochila); break;
                case "loja": TelaDaLoja(tela.Loja); break;
                default:
                    // O painel ADM não abre no app (fica pra depois). O combate por turnos nem chega aqui: a
                    // Partida troca ele pela luta em tempo real.
                    _partida.TrocarTela(null);
                    break;
            }
        }

        /// <summary>O portão: a masmorra, a dificuldade e o andar de entrada (o 1 ou um totem já tocado), e entrar.</summary>
        private void TelaDoPortao(Portao portao)
        {
            _sairDaTela = () => _partida.Fechar(portao.Estado);
            Janela("Portão da Masmorra", conteudo =>
            {
                if (portao.Fixa == true)
                {
                    // Pela entrada da cidade desenhada a masmorra já está escolhida: é a do caminho.
                    var nome = Dungeons.ById(portao.Escolha?.Dungeon)?.Name ?? portao.Escolha?.Dungeon;
                    conteudo.Add(PecasDaTela.Texto("O caminho leva à " + nome + ". Escolha a dificuldade e por onde entrar.", "fala-da-tela"));
                }
                else
                {
                    conteudo.Add(Subtitulo("Masmorra"));
                    conteudo.Add(Opcoes(Portoes.Masmorras(portao), portao.Escolha?.Dungeon, id => Portao(Portoes.EscolherMasmorra(portao, id))));
                }
                conteudo.Add(Subtitulo("Dificuldade"));
                conteudo.Add(Opcoes(Portoes.Dificuldades(portao), portao.Escolha?.Difficulty, id => Portao(Portoes.EscolherDificuldade(portao, id))));
                conteudo.Add(Subtitulo("Andar de entrada"));
                var andares = new VisualElement();
                andares.AddToClassList("opcoes-da-janela");
                foreach (var andar in Portoes.Andares(portao))
                {
                    var este = andar;
                    var botao = Botao("ANDAR " + Js.NumberToString(este), () => Portao(Portoes.EscolherAndar(portao, este)));
                    if (este == portao.Andar) botao.AddToClassList("botao-escolhido");
                    andares.Add(botao);
                }
                conteudo.Add(andares);
            },
            ("ENTRAR", () =>
            {
                var entrada = Portoes.Entrar(portao);
                if (entrada == null) return;
                Sons.Tocar("door");
                _partida.Fechar(entrada.Estado, new Aviso("🌟", "Portão da Masmorra", entrada.Texto));
                _partida.Recadar(entrada.Recado);
            }),
            ("VOLTAR", () => _partida.Fechar(portao.Estado)));
        }

        private void Portao(Portao proximo) => _partida.TrocarTela(new TelaAberta { Tipo = "portao", Portao = proximo });

        private static VisualElement Opcoes(List<OpcaoDoPortao> opcoes, string escolhida, Action<string> escolher)
        {
            var caixa = new VisualElement();
            caixa.AddToClassList("opcoes-da-janela");
            foreach (var opcao in opcoes)
            {
                var id = opcao.Id;
                var texto = ((opcao.Icone ?? "") + " " + opcao.Nome).Trim();
                var botao = Botao(opcao.Falta != null ? texto + " · " + opcao.Falta : texto, () => escolher(id));
                botao.SetEnabled(opcao.Falta == null);
                if (id == escolhida) botao.AddToClassList("botao-escolhido");
                caixa.Add(botao);
            }
            return caixa;
        }

        private void AbrirDiario()
        {
            if (_partida == null || _janela != null) return;
            _janela = "diario";
            Janela("Diário de Aventura", conteudo =>
            {
                if (_partida.Diario.Count == 0) conteudo.Add(Paragrafo("Nada aconteceu ainda nesta partida."));
                foreach (var nota in _partida.Diario)
                    conteudo.Add(Paragrafo(((nota.Icone ?? "") + " <b>" + (nota.Titulo ?? "") + "</b> " + (nota.Texto ?? "")).Trim()));
            }, ("FECHAR", FecharJanela));
        }

        private void PerguntarSaida()
        {
            if (_partida == null || _saindo || _janela != null) return;
            _janela = "saida";
            Janela("Sair da partida?", conteudo => conteudo.Add(Paragrafo("Seu progresso é gravado na nuvem antes de sair.")),
                ("SIM, SAIR", Sair), ("CONTINUAR JOGANDO", FecharJanela));
        }

        /// <summary>A janela aberta não é tela de sala: o diário, o guia, a ficha ou a pergunta de saída.</summary>
        private bool JanelaSemTela => _janela == "diario" || _janela == "guia" || _janela == "ficha" || _janela == "saida";

        private void FecharJanela()
        {
            if (_saindo || !JanelaSemTela) return;
            _janela = null;
            _sobre.AddToClassList("oculto");
            Redesenhar();
        }

        // ---------- a janela por cima da sala ----------

        /// <summary>A tela desenhada por último: redesenhar a mesma tela devolve a rolagem de cada coluna.</summary>
        private string _chaveDaJanela;
        private readonly Dictionary<string, Vector2> _rolagens = new Dictionary<string, Vector2>();

        /// <summary>A janela de sempre: o título, o ouro (quando a tela mostra), a resposta, o conteúdo que rola e os botões.</summary>
        private void Janela(string titulo, Action<ScrollView> conteudo, params (string texto, Action acao)[] botoes) =>
            MontarJanela("janela:" + titulo, titulo, null, null, conteudo, botoes);

        private void Janela(string titulo, string ouro, string linha, Action<ScrollView> conteudo, params (string texto, Action acao)[] botoes) =>
            MontarJanela("janela:" + titulo, titulo, ouro, linha, conteudo, botoes);

        /// <summary>A conversa, o evento e o totem: o retrato já diz quem é, então a janela não repete o nome no título.</summary>
        private void JanelaDeRetrato(string chave, Action<ScrollView> conteudo, params (string texto, Action acao)[] botoes) =>
            MontarJanela("retrato:" + chave, null, null, null, conteudo, botoes);

        private void MontarJanela(string chave, string titulo, string ouro, string linha, Action<ScrollView> conteudo, (string texto, Action acao)[] botoes)
        {
            GuardarRolagens(chave);
            Cabecalho(titulo, ouro, linha, larga: false);
            _conteudoDaJanela.Clear();
            conteudo(_conteudoDaJanela);
            Botoes(botoes);
            DevolverRolagens();
        }

        /// <summary>
        /// A janela larga da mochila, da loja e da guilda: quase a tela toda, com colunas que rolam cada uma por
        /// dentro (as rolagens vêm de <see cref="Coluna"/>). O resto é igual à de sempre.
        /// </summary>
        private void JanelaLarga(string titulo, string ouro, string linha, Action<VisualElement> colunas, params (string texto, Action acao)[] botoes)
        {
            var chave = "larga:" + titulo;
            GuardarRolagens(chave);
            Cabecalho(titulo, ouro, linha, larga: true);
            _colunasDaJanela.Clear();
            colunas(_colunasDaJanela);
            Botoes(botoes);
            DevolverRolagens();
        }

        /// <summary>Uma coluna da janela larga; o nome guarda a rolagem dela entre um desenho e outro.</summary>
        private static ScrollView Coluna(string nome, string classe)
        {
            // Sem rolagem de lado: o conteúdo que passar da largura quebra linha ou encolhe.
            var coluna = new ScrollView(ScrollViewMode.Vertical) { name = nome, horizontalScrollerVisibility = ScrollerVisibility.Hidden };
            coluna.AddToClassList("coluna-da-janela");
            coluna.AddToClassList("rolagem-fina");
            if (classe != null) coluna.AddToClassList(classe);
            return coluna;
        }

        private void Cabecalho(string titulo, string ouro, string linha, bool larga)
        {
            _sobre.RemoveFromClassList("oculto");
            _janelaEl.EnableInClassList("janela-larga", larga);
            _conteudoDaJanela.EnableInClassList("escondida", larga);
            _colunasDaJanela.EnableInClassList("escondida", !larga);
            if (larga) _conteudoDaJanela.Clear();
            else _colunasDaJanela.Clear();
            _tituloDaJanela.text = titulo ?? "";
            _tituloDaJanela.EnableInClassList("escondida", string.IsNullOrEmpty(titulo));
            _ouroDaJanela.text = ouro ?? "";
            _ouroDaJanela.EnableInClassList("escondida", string.IsNullOrEmpty(ouro));
            _linhaDaJanela.text = TextoDoJogo.ParaTela(linha ?? "");
            _linhaDaJanela.EnableInClassList("escondida", string.IsNullOrEmpty(linha));
        }

        private void Botoes((string texto, Action acao)[] botoes)
        {
            _botoesDaJanela.Clear();
            foreach (var (texto, acao) in botoes) _botoesDaJanela.Add(Botao(texto, acao));
        }

        private void GuardarRolagens(string chave)
        {
            _rolagens.Clear();
            if (chave == _chaveDaJanela)
                _janelaEl.Query<ScrollView>().ForEach(rolagem =>
                {
                    if (!string.IsNullOrEmpty(rolagem.name)) _rolagens[rolagem.name] = rolagem.scrollOffset;
                });
            _chaveDaJanela = chave;
        }

        /// <summary>
        /// O que a tela pediu pra mostrar depois de desenhar (a ficha da peça recém-escolhida, como o
        /// useFichaAVista do site): a coluna dela rola até ele, por cima da rolagem devolvida.
        /// </summary>
        private VisualElement _mostrarDepois;

        /// <summary>Depois do layout: antes dele o conteúdo novo ainda não tem altura, e a rolagem voltaria a zero.</summary>
        private void DevolverRolagens()
        {
            var guardadas = new Dictionary<string, Vector2>(_rolagens);
            var alvo = _mostrarDepois;
            _mostrarDepois = null;
            if (guardadas.Count == 0 && alvo == null) return;
            _janelaEl.schedule.Execute(() =>
            {
                _janelaEl.Query<ScrollView>().ForEach(rolagem =>
                {
                    if (guardadas.TryGetValue(rolagem.name ?? "", out var onde)) rolagem.scrollOffset = onde;
                });
                alvo?.GetFirstAncestorOfType<ScrollView>()?.ScrollTo(alvo);
            });
        }

        private static Button Botao(string texto, Action acao)
        {
            var botao = new Button(acao) { text = texto };
            botao.AddToClassList("botao");
            botao.AddToClassList("botao-pequeno");
            return botao;
        }

        private static Label Paragrafo(string texto)
        {
            var paragrafo = new Label(TextoDoJogo.ParaTela(texto));
            paragrafo.AddToClassList("paragrafo-da-janela");
            return paragrafo;
        }

        private static Label Subtitulo(string texto)
        {
            var subtitulo = new Label(texto);
            subtitulo.AddToClassList("subtitulo-da-janela");
            return subtitulo;
        }

        // ---------- gravar e sair ----------

        private async void Gravar(bool saindo)
        {
            var partida = _partida;
            var estado = partida.ComecarAGravar();
            Salvamento("Salvando na nuvem…", false);
            string erro = null;
            try
            {
                var assinatura = await RpgApi.GravarSave(_token, partida.Slot, JogoJson.ParaSave(estado), partida.Assinatura);
                partida.Gravou(assinatura);
            }
            catch (ApiError e)
            {
                erro = e.Message;
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                erro = "Erro inesperado ao salvar.";
            }

            if (erro == null)
            {
                if (partida == _partida) Salvamento("Progresso salvo na nuvem.", false);
                if (saindo) TerminarSaida();
                return;
            }

            partida.NaoGravou();
            if (partida != _partida) return;
            Salvamento(erro, true);
            if (saindo)
            {
                // Como no site: se a gravação falhar, não sai — a mensagem fica na tela e a pessoa decide.
                _saindo = false;
                FecharJanela();
            }
        }

        private void Salvamento(string texto, bool falha)
        {
            _salvamento.text = texto;
            _salvamento.EnableInClassList("falha", falha);
        }

        /// <summary>Sair grava o que ainda estiver na fila (e espera a gravação em andamento) antes de sair.</summary>
        private async void Sair()
        {
            if (_saindo || _partida == null) return;
            _saindo = true;
            _botoesDaJanela.SetEnabled(false);
            try
            {
                while (_partida != null && _partida.Gravando) await Awaitable.NextFrameAsync(destroyCancellationToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
            finally
            {
                _botoesDaJanela.SetEnabled(true);
            }
            if (_partida == null) return;
            if (_partida.TemMudancaPorGravar) Gravar(true);
            else TerminarSaida();
        }

        private void TerminarSaida()
        {
            _janela = null;
            _sobre.AddToClassList("oculto");
            AoSair?.Invoke();
        }
    }
}
