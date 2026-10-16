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
    /// As telas de sala (loja, conversa, mochila…) chegam na parte seguinte da etapa 4: até lá, abrem uma janela que
    /// diz isso e fecham devolvendo o estado da sala. O portão já é de verdade, porque é o único caminho até a
    /// masmorra.
    /// </summary>
    public sealed class TelaDeJogo : MonoBehaviour
    {
        private const float RaioDoJoystick = 56f;
        private const float ZonaMorta = 0.15f;
        /// <summary>A coluna da direita nunca fica mais estreita que isto: antes, a sala encolhe.</summary>
        private const float MinimoDoLado = 380f;
        /// <summary>Daqui pra cima, o resumo do herói e o minimapa cabem lado a lado.</summary>
        private const float LadoLargo = 560f;

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

        private VisualElement _tela, _palco, _lado, _baseDoJoystick, _alavanca, _minimapa, _caixa, _escolhas, _recado, _sobre, _botoesDaJanela, _vida, _mana;
        private Label _dica, _nome, _nivel, _numeroDaVida, _numeroDaMana, _lugar, _iconeDaCaixa, _tituloDaCaixa, _textoDaCaixa, _tituloDoRecado, _textoDoRecado, _salvamento, _tituloDaJanela, _carregando;
        private VisualElement _narracao;
        private ScrollView _meio, _conteudoDaJanela;
        /// <summary>O aviso e o recado já mostrados: quando chega um novo, o meio da coluna rola até ele.</summary>
        private object _avisoMostrado, _recadoMostrado;
        private Button _mochila, _diario, _sairDoJogo;

        private Partida _partida;
        private SalaEmCena _sala;
        private string _token;

        /// <summary>O que a janela por cima mostra: "sala" (uma tela de sala), "diario", "saida" ou null.</summary>
        private string _janela;
        private bool _saindo;

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

            _partida = new Partida(slot, estado, assinatura) { Agora = AgoraMs };
            _partida.Mudou += Redesenhar;
            _partida.SaiuDaSecreta += direcao =>
            {
                // Quem sai da secreta reaparece na passagem, e não por onde entrou na sala da outra vez.
                _chegada = RoomWalk.Arrival(direcao);
                _volta++;
            };
            _partida.Som += Sons.Tocar;

            if (_sala == null)
            {
                _sala = SalaEmCena.Criar();
                _sala.Entrada = Entrada;
                _sala.AoSair = direcao => _partida != null && _partida.Mover(direcao);
                _sala.AoEncostar = id => _partida?.AoEncostar(id);
                _palco.style.backgroundImage = new StyleBackground(Background.FromRenderTexture(_sala.Textura));
            }
            _sala.gameObject.SetActive(true);

            _carregando.AddToClassList("escondido");
            Redesenhar();
            return true;
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
            if (_sala != null) _sala.gameObject.SetActive(false);
            _tela?.AddToClassList("oculto");
            _sobre?.AddToClassList("oculto");
        }

        private void Ligar(VisualElement raiz)
        {
            _tela = raiz.Q("jogo");
            _palco = raiz.Q("palco");
            _lado = raiz.Q("lado");
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
            _meio = raiz.Q<ScrollView>("meio-do-lado");
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
            _tituloDaJanela = raiz.Q<Label>("titulo-da-janela");
            _conteudoDaJanela = raiz.Q<ScrollView>("conteudo-da-janela");
            _botoesDaJanela = raiz.Q("botoes-da-janela");
            _carregando = raiz.Q<Label>("carregando-jogo");

            raiz.Q<Button>("botao-sim").clicked += () => _partida?.ConfirmarSim();
            raiz.Q<Button>("botao-nao").clicked += () => _partida?.ConfirmarNao();
            raiz.Q<Button>("fechar-recado").clicked += () => _partida?.FecharRecado();
            _mochila.clicked += () => _partida?.AbrirMochila();
            _diario.clicked += AbrirDiario;
            _sairDoJogo.clicked += PerguntarSaida;

            _tela.RegisterCallback<GeometryChangedEvent>(_ => AjustarPalco());
            _palco.RegisterCallback<PointerDownEvent>(ApertarDedo);
            _palco.RegisterCallback<PointerMoveEvent>(ArrastarDedo);
            _palco.RegisterCallback<PointerUpEvent>(e => SoltarDedo(e.pointerId));
            _palco.RegisterCallback<PointerCancelEvent>(e => SoltarDedo(e.pointerId));
            _palco.RegisterCallback<PointerCaptureOutEvent>(e => SoltarDedo(e.pointerId));
        }

        /// <summary>
        /// A sala é 9 × 7 quadrados, na altura toda — menos quando a coluna da direita ficaria mais estreita que
        /// <see cref="MinimoDoLado"/> (a tela 16:9 do PC): aí ela encolhe. O celular deitado é mais comprido e sobra
        /// largura, e então o resumo do herói e o minimapa ficam lado a lado.
        /// </summary>
        private void AjustarPalco()
        {
            var area = _tela.contentRect;
            if (float.IsNaN(area.height) || area.height <= 0 || area.width <= 0) return;
            float proporcao = (float)(RoomWalk.RoomCols / RoomWalk.RoomRows);
            float margem = _lado.resolvedStyle.marginLeft;
            float largura = Mathf.Floor(Mathf.Max(200f, Mathf.Min(area.height * proporcao, area.width - margem - MinimoDoLado)));
            float altura = Mathf.Floor(largura / proporcao);
            if (Mathf.Abs(_palco.resolvedStyle.width - largura) > 0.5f) _palco.style.width = largura;
            if (Mathf.Abs(_palco.resolvedStyle.height - altura) > 0.5f) _palco.style.height = altura;
            _lado.EnableInClassList("lado-largo", area.width - margem - largura >= LadoLargo);
        }

        // ---------- a cada quadro ----------

        /// <summary>A exploração está livre: sem tela, pergunta ou janela na frente.</summary>
        private bool Andando => _partida != null && _partida.Tela == null && !_partida.Confirmando && _janela == null;

        private void Update()
        {
            if (_partida == null) return;
            _partida.Agora = AgoraMs;
            if (_sala != null) _sala.Ativo = Andando;
            if (!Andando && _dedo.HasValue) SoltarDedo(-1);

            // Esc no PC, e o "voltar" do Android, que chega como Esc.
            var teclado = Keyboard.current;
            if (teclado != null && teclado.escapeKey.wasPressedThisFrame)
            {
                if (_janela == "diario" || _janela == "saida") FecharJanela();
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
            DesenharCaixa(celula, visual);
            DesenharRecado();
            MostrarNovidade();
            double pontos = estado.Hero.AttrPoints ?? 0;
            _mochila.text = pontos > 0 ? "MOCHILA (" + Js.NumberToString(pontos) + ")" : "MOCHILA";
            _diario.text = _partida.Diario.Count > 0 ? "DIÁRIO (" + _partida.Diario.Count + ")" : "DIÁRIO";
            DesenharTela();
            DesenharSala(estado, celula, secreta, visual);
        }

        private void DesenharHeroi(Hero hero)
        {
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
            var narracao = Narrador.Narrar(estado);
            if (narracao == null) return;
            Linha(narracao.Ambiente, "linha-da-narracao");
            if (!string.IsNullOrEmpty(narracao.Conteudo)) Linha(narracao.Conteudo, "linha-da-narracao");
            var extras = ExtrasDaSala.DescricaoDosExtras(celula);
            if (!string.IsNullOrEmpty(extras)) Linha(extras, "linha-da-narracao");
            if (narracao.Portas != null) Linha(string.Join(" ", narracao.Portas), "pistas-das-portas");
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

        /// <summary>Aviso, pergunta ou recado novo rola o meio da coluna até ele (na tela 16:9 ele pode ter caído pra baixo).</summary>
        private void MostrarNovidade()
        {
            object aviso = _partida.Confirmando ? (object)"pergunta" : _partida.Aviso;
            object recado = _partida.Recado;
            VisualElement alvo = null;
            if (recado != null && !ReferenceEquals(recado, _recadoMostrado)) alvo = _recado;
            if (aviso != null && !ReferenceEquals(aviso, _avisoMostrado)) alvo = _caixa;
            _avisoMostrado = aviso;
            _recadoMostrado = recado;
            // Depois do layout: a caixa acabou de aparecer e ainda não tem posição.
            if (alvo != null) _meio.schedule.Execute(() => _meio.ScrollTo(alvo));
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
            _dica.EnableInClassList("escondido", !Andando || _dedo.HasValue || Touchscreen.current == null);

            // Onde o herói aparece: quem veio da sala ao lado, na porta por onde entrou; quem chegou de outro jeito
            // (portão, escada, totem), no meio.
            var salaAgora = _partida.ChaveDaSala;
            var mapaAgora = _partida.ChaveDoMapa;
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
            _sala.Mostrar(chave, planta, TemaDaSala.Do(estado), figuras, chegada);
        }

        // ---------- janelas por cima ----------

        private void DesenharTela()
        {
            var tela = _partida.Tela;
            if (tela == null)
            {
                if (_janela == "sala")
                {
                    _janela = null;
                    _sobre.AddToClassList("oculto");
                }
                return;
            }
            _janela = "sala";
            if (tela.Tipo == "portao") TelaDoPortao(tela.Portao);
            else TelaEmBreve(tela);
        }

        /// <summary>As telas que ainda não existem no app: dizem isso e fecham devolvendo o estado da sala.</summary>
        private void TelaEmBreve(TelaAberta tela)
        {
            string nome;
            EstadoDoJogo estado;
            Aviso aviso = null;
            switch (tela.Tipo)
            {
                case "loja":
                    nome = tela.Loja.Kind == ShopKinds.Blacksmith ? "Ferreiro" : "Loja";
                    estado = tela.Loja.Estado;
                    break;
                case "dialogo":
                    nome = string.IsNullOrEmpty(tela.Dialogo.Npc?.Name) ? "Conversa" : tela.Dialogo.Npc.Name;
                    estado = tela.Dialogo.Estado;
                    break;
                case "missoes":
                    nome = "Quadro de Missões";
                    estado = tela.Quadro.Estado;
                    break;
                case "evento":
                    nome = string.IsNullOrEmpty(tela.Evento.Template?.Title) ? "Evento" : tela.Evento.Template.Title;
                    estado = tela.Evento.Estado;
                    break;
                case "mochila":
                    nome = "Mochila";
                    estado = tela.Mochila.Estado;
                    break;
                case "guilda":
                    nome = "Guilda dos Aventureiros";
                    estado = tela.Guilda.Estado;
                    break;
                case "professor":
                    nome = "Mestre de Classe";
                    estado = tela.Professor.Estado;
                    break;
                case "totem":
                    nome = "Totem Antigo";
                    estado = tela.Totem.Estado;
                    aviso = new Aviso("🗿", "Totem Antigo", tela.Totem.Texto);
                    break;
                default:
                    nome = tela.Tipo;
                    estado = _partida.Estado;
                    break;
            }
            Janela(nome, conteudo => conteudo.Add(Paragrafo("Esta tela chega na próxima parte da atualização do app.")),
                ("FECHAR", () => _partida.Fechar(estado, aviso)));
        }

        /// <summary>O portão: a masmorra, a dificuldade e o andar de entrada (o 1 ou um totem já tocado), e entrar.</summary>
        private void TelaDoPortao(Portao portao)
        {
            Janela("Portão da Masmorra", conteudo =>
            {
                conteudo.Add(Subtitulo("Masmorra"));
                conteudo.Add(Opcoes(Portoes.Masmorras(portao), portao.Escolha?.Dungeon, id => Portao(Portoes.EscolherMasmorra(portao, id))));
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

        private void FecharJanela()
        {
            if (_saindo || (_janela != "diario" && _janela != "saida")) return;
            _janela = null;
            _sobre.AddToClassList("oculto");
            Redesenhar();
        }

        private void Janela(string titulo, Action<ScrollView> conteudo, params (string texto, Action acao)[] botoes)
        {
            _sobre.RemoveFromClassList("oculto");
            _tituloDaJanela.text = titulo;
            _conteudoDaJanela.Clear();
            conteudo(_conteudoDaJanela);
            _botoesDaJanela.Clear();
            foreach (var (texto, acao) in botoes) _botoesDaJanela.Add(Botao(texto, acao));
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
