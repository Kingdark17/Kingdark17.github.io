using System;
using System.Collections.Generic;
using RPGLegend.Engine;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UIElements;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// A luta em tempo real na tela (etapa 5), em primeira pessoa como no site (<see cref="PalcoDaLuta"/>): os monstros
    /// de frente, a caixa com o coração que o joystick move, o botão de ataque (com a arte da arma) com os poderes e a
    /// poção em volta dele, o desenho do evento da arma e os números que sobem. A cada quadro a luta anda em passos
    /// fixos de 1/60 s (<see cref="Partida.PassoDaLuta"/>), com o joystick, o teclado e os toques do quadro.
    ///
    /// No PC: as setas (ou WASD) movem o coração; espaço (ou J) é o botão de ataque — apertar abre o evento, apertar de
    /// novo toca, soltar solta a carga —, 1, 2 e 3 são os poderes, Q abre os itens, Tab troca o alvo, e a escolha do
    /// alvo também vai com o mouse. O cajado, no PC, pede letras em vez do desenho: U, I, O e P.
    /// </summary>
    public sealed partial class TelaDeJogo
    {
        private const float VidaDoNumero = 0.9f;
        private const float VidaDoAviso = 2.2f;

        /// <summary>Os poderes e a poção em arco em volta do botão de ataque: o raio, e o ângulo de cada um (0° é a direita).</summary>
        private const float RaioDosBotoes = 124f;
        private static readonly float[] AngulosDosBotoes = { 180f, 148f, 116f, 84f };

        /// <summary>
        /// Com quatro poderes (o necromante com o Levantar Esqueleto, o bardo com a Canção), o arco abre: raio maior e cinco
        /// lugares, pra os botões de 62 px não se encostarem. Até três, fica o arco de sempre.
        /// </summary>
        private const float RaioDosBotoesLargo = 150f;
        private static readonly float[] AngulosDosBotoesLargo = { 180f, 156f, 132f, 108f, 84f };

        /// <summary>Quantos botões de poder cabem em volta do ataque.</summary>
        private const int PoderesNoArco = 4;

        private VisualElement _hud, _botaoAtaque, _iconeDoAtaque, _poderes, _menuDeItens, _numeros, _avisosDaLuta;
        private Label _emojiDoAtaque, _dicaDoEvento;
        private Button _botaoItem;
        private EventoNaTela _eventoNaTela;
        private PalcoDaLuta _palcoDaLuta;
        private Button _botaoDoBicho;
        private readonly List<BotaoDePoder> _botoesDePoder = new List<BotaoDePoder>();
        private string _poderesMostrados, _armaMostrada;

        // O que a pessoa fez desde o último passo: entra no primeiro passo do quadro.
        private bool _apertou, _soltou, _tocou;
        private string _poderApertado, _itemUsado, _tecla;
        private int? _mirar;
        private DedoNoDesenho _dedoNoDesenho;
        private int? _dedoDoDesenho;
        private double _sobraDaLuta;

        private readonly List<Flutuando> _flutuando = new List<Flutuando>();

        private sealed class BotaoDePoder
        {
            public string Id;
            public Button Botao;
            public VisualElement Espera;
            public Label Custo;
        }

        /// <summary>A distância entre dois números que sobem juntos no mesmo alvo (a fonte deles tem 30 px).</summary>
        private const float AlturaDoNumero = 28f;

        private sealed class Flutuando
        {
            public Label Rotulo;
            public float Desde;
            public float Vida;
        }

        // ---------- montar ----------

        private void CriarHudDaLuta(VisualElement palco)
        {
            // A luta em primeira pessoa cobre a sala, por baixo do joystick, do pet e dos botões.
            _palcoDaLuta = new PalcoDaLuta();
            _palcoDaLuta.AoMirar += indice => _mirar = indice;
            _palcoDaLuta.Esconder();
            palco.Insert(0, _palcoDaLuta);
            // O pet fica de fora da luta: o bônus dele vale, mas o canto da sala é o palco dos monstros.
            _botaoDoBicho = _palco.Q<Button>("bichinho");

            _hud = new VisualElement { name = "hud-da-luta", pickingMode = PickingMode.Ignore };
            _hud.AddToClassList("hud-da-luta");
            _hud.AddToClassList("escondido");
            palco.Add(_hud);

            _numeros = new VisualElement { pickingMode = PickingMode.Ignore };
            _numeros.AddToClassList("numeros-da-luta");
            _hud.Add(_numeros);

            _avisosDaLuta = new VisualElement { pickingMode = PickingMode.Ignore };
            _avisosDaLuta.AddToClassList("avisos-da-luta");
            _hud.Add(_avisosDaLuta);

            _eventoNaTela = new EventoNaTela();
            _hud.Add(_eventoNaTela);
            _dicaDoEvento = new Label { pickingMode = PickingMode.Ignore };
            _dicaDoEvento.AddToClassList("dica-do-evento");
            _hud.Add(_dicaDoEvento);
            _eventoNaTela.RegisterCallback<PointerDownEvent>(ApertarNoEvento);
            _eventoNaTela.RegisterCallback<PointerMoveEvent>(ArrastarNoEvento);
            _eventoNaTela.RegisterCallback<PointerUpEvent>(e => SoltarNoEvento(e.pointerId));
            _eventoNaTela.RegisterCallback<PointerCancelEvent>(e => SoltarNoEvento(e.pointerId));

            var cantoDosBotoes = new VisualElement { pickingMode = PickingMode.Ignore };
            cantoDosBotoes.AddToClassList("botoes-da-luta");
            _hud.Add(cantoDosBotoes);

            _poderes = new VisualElement { pickingMode = PickingMode.Ignore };
            _poderes.AddToClassList("poderes-da-luta");
            cantoDosBotoes.Add(_poderes);

            _botaoItem = new Button { text = "🧪" };
            _botaoItem.AddToClassList("botao-da-luta");
            _botaoItem.AddToClassList("botao-em-volta");
            _botaoItem.AddToClassList("botao-de-item");
            ParaNaoAndar(_botaoItem);
            _botaoItem.clicked += AlternarMenuDeItens;
            _poderes.Add(_botaoItem);

            _botaoAtaque = new VisualElement();
            _botaoAtaque.AddToClassList("botao-de-ataque");
            _iconeDoAtaque = new VisualElement { pickingMode = PickingMode.Ignore };
            _iconeDoAtaque.AddToClassList("icone-do-ataque");
            _botaoAtaque.Add(_iconeDoAtaque);
            _emojiDoAtaque = new Label("⚔️") { pickingMode = PickingMode.Ignore };
            _emojiDoAtaque.AddToClassList("emoji-do-ataque");
            _botaoAtaque.Add(_emojiDoAtaque);
            _botaoAtaque.RegisterCallback<PointerDownEvent>(e =>
            {
                e.StopPropagation();
                _botaoAtaque.CapturePointer(e.pointerId);
                _botaoAtaque.AddToClassList("apertado");
                _apertou = true;
            });
            _botaoAtaque.RegisterCallback<PointerUpEvent>(e =>
            {
                e.StopPropagation();
                if (_botaoAtaque.HasPointerCapture(e.pointerId)) _botaoAtaque.ReleasePointer(e.pointerId);
                _botaoAtaque.RemoveFromClassList("apertado");
                _soltou = true;
            });
            cantoDosBotoes.Add(_botaoAtaque);

            _menuDeItens = new VisualElement();
            _menuDeItens.AddToClassList("painel");
            _menuDeItens.AddToClassList("menu-de-itens");
            _menuDeItens.AddToClassList("escondido");
            ParaNaoAndar(_menuDeItens);
            _hud.Add(_menuDeItens);
        }

        /// <summary>Toque num botão da luta não pode virar o joystick do palco.</summary>
        private static void ParaNaoAndar(VisualElement elemento) =>
            elemento.RegisterCallback<PointerDownEvent>(e => e.StopPropagation());

        // ---------- a cada quadro ----------

        private void AtualizarLuta()
        {
            var luta = _partida?.Luta;
            _hud.EnableInClassList("escondido", luta == null);
            _botaoDoBicho?.EnableInClassList("escondido-na-luta", luta != null);
            AnimarFlutuantes();
            if (luta == null)
            {
                _palcoDaLuta.Esconder();
                return;
            }
            _sala?.EntrarNaLuta();

            LerTecladoDaLuta(luta);
            bool pausada = _janela != null || _saindo;
            if (!pausada)
            {
                var passos = AndarNaSala.PassosDoQuadro(_sobraDaLuta, Time.deltaTime * 1000.0);
                _sobraDaLuta = passos.Sobra;
                for (int i = 0; i < passos.Passos && _partida?.Luta != null; i++) _partida.PassoDaLuta(EntradaDaLuta());
            }
            if (_partida?.Luta == null)
            {
                _palcoDaLuta.Esconder();
                return;
            }
            var estado = _partida.Luta.Estado;
            string lugar = estado.MapMode == "dungeon" ? estado.Masmorra?.Dungeon ?? "floresta" : "cidade";
            _palcoDaLuta.Mostrar(_partida.Luta, TemaDaSala.Do(estado), lugar);
            DesenharHud(_partida.Luta);
        }

        /// <summary>O passo de agora: o joystick e o que a pessoa fez desde o passo anterior (cada coisa vale uma vez).</summary>
        private EntradaDaLuta EntradaDaLuta()
        {
            var vetor = Entrada();
            var stick = RoomWalk.StickInput(vetor.X, vetor.Y);
            var entrada = new EntradaDaLuta
            {
                X = stick.X,
                Y = stick.Y,
                Atacar = _apertou ? true : (bool?)null,
                Soltar = _soltou ? true : (bool?)null,
                Tocar = _tocou ? true : (bool?)null,
                Poder = _poderApertado,
                Item = _itemUsado,
                Menu = _menuDeItens.ClassListContains("escondido") ? (bool?)null : true,
                Dedo = _dedoNoDesenho,
                Tecla = _tecla,
                Mirar = _mirar,
            };
            _apertou = _soltou = _tocou = false;
            _poderApertado = null;
            _itemUsado = null;
            _tecla = null;
            _mirar = null;
            return entrada;
        }

        private void LerTecladoDaLuta(LutaEmTempoReal luta)
        {
            var teclado = Keyboard.current;
            if (teclado == null || _janela != null) return;
            if (teclado.spaceKey.wasPressedThisFrame || teclado.jKey.wasPressedThisFrame) _apertou = true;
            if (teclado.spaceKey.wasReleasedThisFrame || teclado.jKey.wasReleasedThisFrame) _soltou = true;
            if (teclado.qKey.wasPressedThisFrame) AlternarMenuDeItens();
            if (teclado.tabKey.wasPressedThisFrame) _mirar = ProximoAlvo(luta.Arena);
            var digitos = new[] { teclado.digit1Key, teclado.digit2Key, teclado.digit3Key };
            for (int i = 0; i < digitos.Length && i < _botoesDePoder.Count; i++)
                if (digitos[i].wasPressedThisFrame) _poderApertado = _botoesDePoder[i].Id;
            // As letras do cajado no PC (a engine só olha pra elas no evento das letras).
            foreach (var letra in GameData.EventosDeArmaTable.LetrasDoTeclado)
                if (Enum.TryParse<Key>(letra, out var tecla) && teclado[tecla].wasPressedThisFrame) _tecla = letra;
        }

        // ---------- o painel ----------

        private void DesenharHud(LutaEmTempoReal luta)
        {
            var hero = luta.Estado.Hero;
            var arena = luta.Arena;

            // A arma na mão no botão de ataque (ou ⚔️ de mão vazia).
            var arma = hero.Equip.Get("arma");
            var chaveDaArma = arma?.TemplateId ?? "";
            if (chaveDaArma != _armaMostrada)
            {
                _armaMostrada = chaveDaArma;
                var sprite = arma != null ? PecasDaTela.SpriteDoItem(arma) : null;
                _iconeDoAtaque.style.backgroundImage = sprite != null ? new StyleBackground(sprite) : StyleKeyword.None;
                _emojiDoAtaque.style.display = sprite != null ? DisplayStyle.None : DisplayStyle.Flex;
            }
            _botaoAtaque.EnableInClassList("esperando", arena.Evento == null && arena.Recarga > 0);

            // Os poderes do herói: um botão cada, com o custo e a espera.
            var poderes = Heroes.HeroPowers(hero);
            var chave = string.Join(",", poderes.ConvertAll(p => p.Id));
            if (chave != _poderesMostrados)
            {
                _poderesMostrados = chave;
                foreach (var antigo in _botoesDePoder) antigo.Botao.RemoveFromHierarchy();
                _botoesDePoder.Clear();
                for (int i = 0; i < poderes.Count && i < PoderesNoArco; i++)
                {
                    var poder = poderes[i];
                    var botao = new Button { text = "" };
                    botao.AddToClassList("botao-da-luta");
                    botao.AddToClassList("botao-em-volta");
                    botao.AddToClassList("botao-de-poder");
                    var icone = new Label(poder.Icon) { pickingMode = PickingMode.Ignore };
                    icone.AddToClassList("icone-do-poder");
                    botao.Add(icone);
                    var custo = new Label { pickingMode = PickingMode.Ignore };
                    custo.AddToClassList("custo-do-poder");
                    botao.Add(custo);
                    var espera = new VisualElement { pickingMode = PickingMode.Ignore };
                    espera.AddToClassList("espera-do-poder");
                    botao.Add(espera);
                    var id = poder.Id;
                    botao.clicked += () => _poderApertado = id;
                    ParaNaoAndar(botao);
                    _poderes.Insert(_poderes.IndexOf(_botaoItem), botao);
                    _botoesDePoder.Add(new BotaoDePoder { Id = id, Botao = botao, Espera = espera, Custo = custo });
                }
                PosicionarEmVolta();
            }
            double recargaTotal = GameData.ArenaTable.RecargaDoPoder;
            foreach (var b in _botoesDePoder)
            {
                var poder = poderes.Find(p => p.Id == b.Id);
                if (poder == null) continue;
                // A Coroa do Arquimago barateia o poder na arena: o botão mostra o custo com o desconto.
                double custo = UsePower.PowerManaCost(hero, poder, AcessoriosUnicos.DescontoDeMana(hero));
                b.Custo.text = Js.NumberToString(custo);
                double falta = arena.RecargaDosPoderes.TryGet(b.Id, out var resta) ? resta : 0;
                b.Espera.style.height = Length.Percent((float)(falta / recargaTotal * 100.0));
                b.Botao.EnableInClassList("sem-mana", hero.Mp < custo);
            }

            // O escudo do vigor (a Encantadora) aparece ao lado da vida enquanto durar.
            double escudo = arena.Escudo ?? 0;
            _numeroDaVida.text = Js.NumberToString(Math.Floor(hero.Hp)) + "/" + Js.NumberToString(Math.Floor(hero.MaxHp))
                + (escudo > 0 ? " +" + Js.NumberToString(escudo) + " 💪" : "");

            int consumiveis = 0;
            foreach (var item in luta.Estado.Inventory)
                if (Mochilas.PodeUsar(item)) consumiveis++;
            _botaoItem.text = consumiveis > 0 ? "🧪" : "";
            _botaoItem.EnableInClassList("sem-mana", consumiveis == 0 || arena.RecargaDoItem > 0);
            if (!_menuDeItens.ClassListContains("escondido") && consumiveis == 0) _menuDeItens.AddToClassList("escondido");

            // O evento da arma, se houver um aberto, no palco dos monstros (a caixa do coração fica livre).
            var aberto = arena.Evento;
            _eventoNaTela.Mostrar(aberto, _palcoDaLuta.AreaDoPalco);
            float topoDaCaixa = _palcoDaLuta.TopoDaCaixa;
            if (topoDaCaixa > 0) _avisosDaLuta.style.bottom = Mathf.Max(0f, _areaDaLuta.contentRect.height - topoDaCaixa + 6f);
            _dicaDoEvento.text = aberto != null ? DicaDoEvento(aberto.Evento.Tipo) : "";
            _dicaDoEvento.EnableInClassList("escondido", aberto == null);
            if (aberto == null || aberto.Evento.Tipo != TiposDeEvento.Desenho) _dedoNoDesenho = null;
        }

        private static string DicaDoEvento(string tipo)
        {
            switch (tipo)
            {
                case TiposDeEvento.Circulo: return "Toque quando a bolinha bater no aro";
                case TiposDeEvento.Carga: return "Segure e solte na faixa";
                case TiposDeEvento.Desenho: return "Passe o dedo pelo símbolo";
                case TiposDeEvento.Letras: return "Aperte a letra quando o aro encostar";
                case TiposDeEvento.Ritmo: return "Toque no ritmo";
                case TiposDeEvento.ToqueDuplo: return "Dois toques ligeiros";
                default: return "Toque no meio da barra";
            }
        }

        /// <summary>Os poderes (na ordem do herói) e, depois deles, a poção, em arco em volta do botão de ataque.</summary>
        private void PosicionarEmVolta()
        {
            var botoes = new List<VisualElement>();
            foreach (var b in _botoesDePoder) botoes.Add(b.Botao);
            botoes.Add(_botaoItem);
            // O centro do botão de ataque fica a 54 px do canto de baixo à direita; cada botão em volta tem 62 px.
            bool largo = botoes.Count > AngulosDosBotoes.Length;
            var angulos = largo ? AngulosDosBotoesLargo : AngulosDosBotoes;
            float raio = largo ? RaioDosBotoesLargo : RaioDosBotoes;
            for (int i = 0; i < botoes.Count && i < angulos.Length; i++)
            {
                float angulo = angulos[i] * Mathf.Deg2Rad;
                botoes[i].style.right = 54f - Mathf.Cos(angulo) * raio - 31f;
                botoes[i].style.bottom = 54f + Mathf.Sin(angulo) * raio - 31f;
            }
        }

        /// <summary>O próximo monstro de pé depois do alvo de agora, dando a volta (o Tab do PC).</summary>
        private static int? ProximoAlvo(Arena arena)
        {
            int total = arena.Monstros.Count;
            for (int k = 1; k <= total; k++)
            {
                var m = arena.Monstros[(int)((arena.Alvo + k) % total)];
                if (m.Fase != "caido") return (int)m.Indice;
            }
            return null;
        }

        // ---------- o desenho, com o dedo ou o mouse ----------

        private void ApertarNoEvento(PointerDownEvent e)
        {
            e.StopPropagation();
            var aberto = _partida?.Luta?.Arena.Evento;
            if (aberto == null) return;
            if (aberto.Evento.Tipo != TiposDeEvento.Desenho)
            {
                _tocou = true;
                return;
            }
            _dedoDoDesenho = e.pointerId;
            _eventoNaTela.CapturePointer(e.pointerId);
            _dedoNoDesenho = _eventoNaTela.NoDesenho(e.localPosition);
        }

        private void ArrastarNoEvento(PointerMoveEvent e)
        {
            if (_dedoDoDesenho != e.pointerId) return;
            _dedoNoDesenho = _eventoNaTela.NoDesenho(e.localPosition);
        }

        private void SoltarNoEvento(int id)
        {
            if (_dedoDoDesenho != id) return;
            _dedoDoDesenho = null;
            if (_eventoNaTela.HasPointerCapture(id)) _eventoNaTela.ReleasePointer(id);
            _dedoNoDesenho = null;
        }

        // ---------- itens ----------

        private void AlternarMenuDeItens()
        {
            var luta = _partida?.Luta;
            if (luta == null) return;
            if (!_menuDeItens.ClassListContains("escondido"))
            {
                _menuDeItens.AddToClassList("escondido");
                return;
            }
            _menuDeItens.Clear();
            var titulo = new Label("Itens");
            titulo.AddToClassList("titulo-do-menu-de-itens");
            _menuDeItens.Add(titulo);
            // Um botão por tipo de item usável, com quantos há.
            var vistos = new Dictionary<string, (Item item, int quantos)>();
            var ordem = new List<string>();
            foreach (var item in luta.Estado.Inventory)
            {
                if (!Mochilas.PodeUsar(item)) continue;
                var chave = item.TemplateId + ":" + item.Rarity;
                if (vistos.TryGetValue(chave, out var ja)) vistos[chave] = (ja.item, ja.quantos + 1);
                else
                {
                    vistos[chave] = (item, 1);
                    ordem.Add(chave);
                }
            }
            if (ordem.Count == 0) return;
            foreach (var chave in ordem)
            {
                var (item, quantos) = vistos[chave];
                var linha = new Button();
                linha.AddToClassList("item-do-menu");
                var icone = new VisualElement { pickingMode = PickingMode.Ignore };
                icone.AddToClassList("icone-do-item-do-menu");
                var sprite = PecasDaTela.SpriteDoItem(item);
                if (sprite != null) icone.style.backgroundImage = new StyleBackground(sprite);
                linha.Add(icone);
                var nome = new Label(Items.DisplayName(item) + (quantos > 1 ? " ×" + quantos : "")) { pickingMode = PickingMode.Ignore };
                linha.Add(nome);
                var uid = item.Uid;
                linha.clicked += () =>
                {
                    _itemUsado = uid;
                    _menuDeItens.AddToClassList("escondido");
                };
                _menuDeItens.Add(linha);
            }
            _menuDeItens.RemoveFromClassList("escondido");
        }

        // ---------- o que a luta fez ----------

        private void MostrarAcontecimentos(List<Acontecimento> acontecimentos)
        {
            var luta = _partida?.Luta;
            // Mais de um número no mesmo alvo de uma vez (o golpe e o choque da runa): cada um uma linha abaixo do outro.
            var linhasPorAlvo = new Dictionary<string, int>();
            foreach (var a in acontecimentos)
            {
                switch (a.Tipo)
                {
                    case "som":
                        Sons.Tocar(a.Som);
                        break;
                    case "numero":
                        if (luta == null) break;
                        string alvo = a.Onde + ":" + Js.NumberToString(a.Indice ?? 0);
                        linhasPorAlvo.TryGetValue(alvo, out int linha);
                        linhasPorAlvo[alvo] = linha + 1;
                        Numero(luta.Arena, a, linha);
                        break;
                    case "aviso":
                        AvisoDaLuta(a.Texto, "aviso-da-luta");
                        break;
                    case "diario":
                        AvisoDaLuta(a.Texto, "diario-da-luta");
                        break;
                }
            }
        }

        /// <summary>
        /// O número que sobe em cima de quem levou (ou desviou, ou se curou): o monstro no palco, o coração na caixa ou o
        /// companheiro do lado dela. Quem apanhou treme (o monstro) ou pisca (o coração).
        /// </summary>
        private void Numero(Arena arena, Acontecimento a, int linha)
        {
            int indice = (int)(a.Indice ?? 0);
            Vector2 onde = a.Onde == "monstro" ? _palcoDaLuta.PosicaoDoMonstro(indice)
                : a.Onde == "companheiro" ? _palcoDaLuta.PosicaoDoAliado(arena, indice)
                : _palcoDaLuta.PosicaoDoCoracao(arena);
            var rotulo = new Label(a.Texto) { pickingMode = PickingMode.Ignore };
            rotulo.AddToClassList("numero-da-luta");
            rotulo.AddToClassList("numero-" + (a.Tom ?? "dano"));
            rotulo.style.left = onde.x;
            rotulo.style.top = onde.y - 24f + linha * AlturaDoNumero;
            _numeros.Add(rotulo);
            _flutuando.Add(new Flutuando { Rotulo = rotulo, Desde = Time.unscaledTime, Vida = VidaDoNumero });

            bool doeu = a.Tom == "dano" || a.Tom == "critico";
            if (a.Onde == "monstro" && doeu) _palcoDaLuta.Apanhou(indice);
            if (a.Onde == "heroi" && doeu) _palcoDaLuta.CoracaoApanhou();
        }

        private void AvisoDaLuta(string texto, string classe)
        {
            if (string.IsNullOrEmpty(texto)) return;
            var rotulo = PecasDaTela.Texto(texto, classe);
            rotulo.pickingMode = PickingMode.Ignore;
            _avisosDaLuta.Add(rotulo);
            while (_avisosDaLuta.childCount > 3) _avisosDaLuta.RemoveAt(0);
            _flutuando.Add(new Flutuando { Rotulo = rotulo, Desde = Time.unscaledTime, Vida = VidaDoAviso });
        }

        private void AnimarFlutuantes()
        {
            float agora = Time.unscaledTime;
            for (int i = _flutuando.Count - 1; i >= 0; i--)
            {
                var f = _flutuando[i];
                float t = (agora - f.Desde) / f.Vida;
                if (t >= 1f || f.Rotulo.parent == null)
                {
                    f.Rotulo.RemoveFromHierarchy();
                    _flutuando.RemoveAt(i);
                    continue;
                }
                f.Rotulo.style.opacity = 1f - t * t;
                if (f.Rotulo.ClassListContains("numero-da-luta")) f.Rotulo.style.translate = new Translate(Length.Percent(-50), -28f * t);
            }
        }

        /// <summary>A luta acabou: a sala volta, com o herói na porta por onde entrou, e o que era da luta sai da tela.</summary>
        private void AoAcabarALuta(Walker heroi)
        {
            _sala?.SairDaLuta(heroi);
            _palcoDaLuta.Esconder();
            _mirar = null;
            _menuDeItens.AddToClassList("escondido");
            _eventoNaTela.Mostrar(null, _areaDaLuta.contentRect);
            _dicaDoEvento.AddToClassList("escondido");
            _dedoNoDesenho = null;
            _apertou = _soltou = _tocou = false;
            _sobraDaLuta = 0;
        }

        /// <summary>Uma partida nova (ou fechada): sem nada da luta anterior na tela.</summary>
        private void EsquecerLuta()
        {
            if (_hud == null) return;
            _hud.AddToClassList("escondido");
            _palcoDaLuta.Esconder();
            _mirar = null;
            _menuDeItens.AddToClassList("escondido");
            _numeros.Clear();
            _avisosDaLuta.Clear();
            _flutuando.Clear();
            _poderesMostrados = null;
            _armaMostrada = null;
            _dedoNoDesenho = null;
            _apertou = _soltou = _tocou = false;
            _sobraDaLuta = 0;
        }
    }

    /// <summary>
    /// O evento da arma desenhado por cima do palco dos monstros (o Painter2D da UI): a barra, a bolinha encolhendo até
    /// o aro, a carga subindo, as notas do ritmo chegando na linha, o símbolo a traçar e, no PC, a letra com o aro
    /// fechando. Os números vêm da engine (<see cref="EventosDeArma"/>): a zona, a faixa do crítico e os tempos são os
    /// mesmos que a leitura usa.
    /// </summary>
    internal sealed class EventoNaTela : VisualElement
    {
        private static readonly Color Fundo = new Color(0.06f, 0.07f, 0.1f, 0.82f);
        private static readonly Color Moldura = new Color32(0xc9, 0xa2, 0x27, 200);
        private static readonly Color Zona = new Color(0.79f, 0.64f, 0.15f, 0.35f);
        private static readonly Color Critico = new Color32(0xe8, 0xc6, 0x5a, 255);
        private static readonly Color Cursor = new Color32(0xec, 0xdf, 0xc0, 255);
        private static readonly Color Traco = new Color32(0xe8, 0xc6, 0x5a, 255);
        private static readonly Color Simbolo = new Color(0.93f, 0.87f, 0.75f, 0.28f);
        private static readonly Color Acertou = new Color32(0x9f, 0xd3, 0x6b, 255);
        private static readonly Color Errou = new Color32(0xe0, 0x5a, 0x4f, 255);
        private static readonly Color Apagada = new Color(0.93f, 0.87f, 0.75f, 0.25f);
        private static readonly Color FundoDaLetra = new Color(0.06f, 0.07f, 0.1f, 0.96f);

        private EventoAberto _aberto;
        /// <summary>A letra da vez, no meio do aro (o Painter2D não escreve texto).</summary>
        private readonly Label _letra;

        public EventoNaTela()
        {
            AddToClassList("evento-da-arma");
            style.display = DisplayStyle.None;
            generateVisualContent += Desenhar;
            _letra = new Label { pickingMode = PickingMode.Ignore };
            _letra.AddToClassList("letra-do-evento");
            Add(_letra);
        }

        /// <summary>
        /// Mostra o evento (ou some, sem evento), no tamanho que o tipo pede dentro de <paramref name="area"/>: o palco dos
        /// monstros, em cima da caixa, que fica livre pro coração continuar desviando.
        /// </summary>
        public void Mostrar(EventoAberto aberto, Rect area)
        {
            _aberto = aberto;
            style.display = aberto == null ? DisplayStyle.None : DisplayStyle.Flex;
            if (aberto == null) return;
            bool desenho = aberto.Evento.Tipo == TiposDeEvento.Desenho;
            bool redondo = aberto.Evento.Tipo == TiposDeEvento.Circulo || aberto.Evento.Tipo == TiposDeEvento.Letras;
            bool carga = aberto.Evento.Tipo == TiposDeEvento.Carga;
            float alto = desenho ? area.height * 0.86f : redondo ? area.height * 0.52f : carga ? area.height * 0.64f : area.height * 0.22f;
            float largo = desenho || redondo ? alto : carga ? area.height * 0.17f : area.width * 0.6f;
            style.width = largo;
            style.height = alto;
            style.left = area.x + (area.width - largo) / 2f;
            style.top = area.y + area.height * 0.06f;
            // Só o desenho e as notas recebem o dedo aqui; o resto é no botão de ataque (ou aqui, se preferir).
            pickingMode = PickingMode.Position;
            MostrarLetra(aberto.Evento, alto);
            MarkDirtyRepaint();
        }

        /// <summary>A letra da vez no meio do aro, na cor de como foi: ainda sem tecla, crítica, acertada ou perdida.</summary>
        private void MostrarLetra(EventoDeArma evento, float alto)
        {
            int k = evento.Tipo == TiposDeEvento.Letras ? LetraDaVez(evento, _aberto.Passo) : -1;
            _letra.style.display = k >= 0 ? DisplayStyle.Flex : DisplayStyle.None;
            if (k < 0) return;
            _letra.text = evento.Letras[k];
            _letra.style.fontSize = alto * 0.3f;
            _letra.style.color = CorDaLetra(LeituraDaLetra(evento, k), Cursor);
        }

        /// <summary>A letra cuja janela tem o passo (a da vez), ou -1 fora de todas.</summary>
        private static int LetraDaVez(EventoDeArma evento, double passo)
        {
            if (evento.Notas == null || evento.Letras == null) return -1;
            double janela = evento.Janela ?? 0;
            for (int k = 0; k < evento.Notas.Count && k < evento.Letras.Count; k++)
                if (passo >= evento.Notas[k] - janela && passo < evento.Notas[k] + janela) return k;
            return -1;
        }

        /// <summary>
        /// Como foi a letra <paramref name="k"/>: null se nenhuma tecla caiu na janela dela; senão a leitura da primeira
        /// (a letra errada é erro), pela mesma régua da engine.
        /// </summary>
        private LeituraDaMira LeituraDaLetra(EventoDeArma evento, int k)
        {
            var teclas = _aberto?.Jogada?.Teclas;
            if (teclas == null) return null;
            double batida = evento.Notas[k], janela = evento.Janela ?? 1;
            foreach (var tecla in teclas)
            {
                if (tecla.T < batida - janela || tecla.T >= batida + janela) continue;
                if (tecla.Letra != evento.Letras[k]) return Attack.LerMira(evento.Zona, null);
                return Attack.LerMira(evento.Zona, 0.5 + (tecla.T - batida) / (2 * janela));
            }
            return null;
        }

        private static Color CorDaLetra(LeituraDaMira leitura, Color semTecla) =>
            leitura == null ? semTecla : leitura.Critico ? Critico : leitura.Acerto ? Acertou : Errou;

        /// <summary>Do ponto na caixa do desenho pra caixa da engine (0 a TAMANHO_DO_DESENHO, y pra baixo).</summary>
        public DedoNoDesenho NoDesenho(Vector2 local)
        {
            var r = contentRect;
            double tamanho = GameData.EventosDeArmaTable.TamanhoDoDesenho;
            double x = Math.Max(0, Math.Min(tamanho, local.x / Math.Max(1f, r.width) * tamanho));
            double y = Math.Max(0, Math.Min(tamanho, local.y / Math.Max(1f, r.height) * tamanho));
            return new DedoNoDesenho { X = Math.Floor(x), Y = Math.Floor(y) };
        }

        private void Desenhar(MeshGenerationContext contexto)
        {
            if (_aberto == null) return;
            var p = contexto.painter2D;
            var r = contentRect;
            var evento = _aberto.Evento;
            float progresso = evento.Duracao > 0 ? Mathf.Clamp01((float)(_aberto.Passo / evento.Duracao)) : 1f;
            float zona = (float)evento.Zona;
            float faixa = (float)Attack.FaixaCritica;

            switch (evento.Tipo)
            {
                case TiposDeEvento.Circulo:
                {
                    var centro = r.center;
                    float raio = Mathf.Min(r.width, r.height) * 0.47f;
                    Circulo(p, centro, raio, Fundo, true, 0);
                    Circulo(p, centro, raio * 0.5f, Zona, false, raio * zona);
                    Circulo(p, centro, raio * 0.5f, Critico, false, Mathf.Max(2f, raio * faixa));
                    Circulo(p, centro, Mathf.Max(1f, raio * (1f - progresso)), Cursor, false, 3f);
                    break;
                }
                case TiposDeEvento.Carga:
                {
                    Retangulo(p, r, Fundo);
                    float h = r.height;
                    Retangulo(p, new Rect(r.x, r.y + h * (0.5f - zona / 2f), r.width, h * zona), Zona);
                    Retangulo(p, new Rect(r.x, r.y + h * (0.5f - faixa / 2f), r.width, Mathf.Max(2f, h * faixa)), Critico);
                    // Enche de baixo pra cima: o meio da barra é o meio do tempo.
                    Retangulo(p, new Rect(r.x + r.width * 0.3f, r.yMax - h * progresso, r.width * 0.4f, h * progresso), Cursor);
                    Contorno(p, r);
                    break;
                }
                case TiposDeEvento.Ritmo:
                case TiposDeEvento.ToqueDuplo:
                    Notas(p, r, evento, zona);
                    break;
                case TiposDeEvento.Desenho:
                    Desenho(p, r, evento, progresso);
                    break;
                case TiposDeEvento.Letras:
                    Letras(p, r, evento, zona, faixa);
                    break;
                default:
                {
                    Retangulo(p, r, Fundo);
                    float w = r.width;
                    Retangulo(p, new Rect(r.x + w * (0.5f - zona / 2f), r.y, w * zona, r.height), Zona);
                    Retangulo(p, new Rect(r.x + w * (0.5f - faixa / 2f), r.y, Mathf.Max(2f, w * faixa), r.height), Critico);
                    Retangulo(p, new Rect(r.x + w * progresso - 2f, r.y - 4f, 4f, r.height + 8f), Cursor);
                    Contorno(p, r);
                    break;
                }
            }
        }

        /// <summary>As notas vêm da direita até a linha; a faixa em volta da linha é onde o toque conta.</summary>
        private void Notas(Painter2D p, Rect r, EventoDeArma evento, float zona)
        {
            Retangulo(p, r, Fundo);
            float linha = r.x + r.width * 0.18f;
            double janela = evento.Janela ?? 1;
            float porPasso = r.width * 0.75f / (float)Math.Max(1, evento.Duracao);
            float meia = (float)(janela * zona) * porPasso;
            Retangulo(p, new Rect(linha - meia, r.y, meia * 2f, r.height), Zona);
            Retangulo(p, new Rect(linha - 2f, r.y, 4f, r.height), Critico);
            float meio = r.center.y;
            if (evento.Notas != null)
            {
                foreach (var nota in evento.Notas)
                {
                    float x = linha + (float)(nota - _aberto.Passo) * porPasso;
                    if (x < r.x - 10f || x > r.xMax + 10f) continue;
                    Circulo(p, new Vector2(x, meio), r.height * 0.28f, Cursor, true, 0);
                }
            }
            if (_aberto.Jogada?.Toques != null)
            {
                foreach (var toque in _aberto.Jogada.Toques)
                {
                    float x = linha + (float)(toque - _aberto.Passo) * porPasso;
                    if (x < r.x) continue;
                    Retangulo(p, new Rect(x - 1.5f, r.y + 4f, 3f, r.height - 8f), Traco);
                }
            }
            Contorno(p, r);
        }

        /// <summary>
        /// As letras: o aro da letra da vez fechando até o círculo dela, com a faixa da zona e a do crítico em volta,
        /// como no arco (some quando a tecla cai). A letra fica num disco escuro, com a borda na cor de como foi, pra
        /// ler bem em cima da faixa. Embaixo, uma bolinha por letra, na cor de como cada uma foi.
        /// </summary>
        private void Letras(Painter2D p, Rect r, EventoDeArma evento, float zona, float faixa)
        {
            var centro = r.center;
            float raio = Mathf.Min(r.width, r.height) * 0.47f;
            Circulo(p, centro, raio, Fundo, true, 0);
            int k = LetraDaVez(evento, _aberto.Passo);
            if (k >= 0)
            {
                Circulo(p, centro, raio * 0.5f, Zona, false, raio * zona);
                Circulo(p, centro, raio * 0.5f, Critico, false, Mathf.Max(2f, raio * faixa));
                var leitura = LeituraDaLetra(evento, k);
                Circulo(p, centro, raio * 0.28f, FundoDaLetra, true, 0);
                Circulo(p, centro, raio * 0.28f, CorDaLetra(leitura, Cursor), false, 2f);
                if (leitura == null)
                {
                    double janela = evento.Janela ?? 1;
                    float progresso = Mathf.Clamp01((float)((_aberto.Passo - (evento.Notas[k] - janela)) / (2 * janela)));
                    Circulo(p, centro, Mathf.Max(1f, raio * (1f - progresso)), Cursor, false, 3f);
                }
            }
            int total = evento.Letras?.Count ?? 0;
            for (int i = 0; i < total; i++)
            {
                var ponto = new Vector2(centro.x + (i - (total - 1) / 2f) * raio * 0.22f, centro.y + raio * 0.78f);
                var cor = k >= 0 && i > k ? Apagada : CorDaLetra(LeituraDaLetra(evento, i), i == k ? Cursor : Errou);
                Circulo(p, ponto, raio * 0.05f, cor, true, 0);
            }
        }

        /// <summary>O símbolo fraco, o traço do dedo por cima e o tempo que resta embaixo.</summary>
        private void Desenho(Painter2D p, Rect r, EventoDeArma evento, float progresso)
        {
            Retangulo(p, r, Fundo);
            var tabela = GameData.EventosDeArmaTable;
            float escala = r.width / (float)tabela.TamanhoDoDesenho;
            if (evento.Simbolo != null && tabela.Simbolos.TryGet(evento.Simbolo, out var pontos) && pontos != null && pontos.Count > 1)
            {
                p.lineWidth = Mathf.Max(6f, r.width * 0.045f);
                p.strokeColor = Simbolo;
                p.lineJoin = LineJoin.Round;
                p.lineCap = LineCap.Round;
                p.BeginPath();
                p.MoveTo(new Vector2(r.x + (float)pontos[0][0] * escala, r.y + (float)pontos[0][1] * escala));
                for (int i = 1; i < pontos.Count; i++) p.LineTo(new Vector2(r.x + (float)pontos[i][0] * escala, r.y + (float)pontos[i][1] * escala));
                p.Stroke();
            }
            var traco = _aberto.Jogada?.Traco;
            if (traco != null && traco.Count > 1)
            {
                p.lineWidth = 4f;
                p.strokeColor = Traco;
                p.BeginPath();
                p.MoveTo(new Vector2(r.x + (float)traco[0].X * escala, r.y + (float)traco[0].Y * escala));
                for (int i = 1; i < traco.Count; i++) p.LineTo(new Vector2(r.x + (float)traco[i].X * escala, r.y + (float)traco[i].Y * escala));
                p.Stroke();
            }
            float livre = (float)(tabela.TempoLivreDoDesenho / Math.Max(1, evento.Duracao));
            Retangulo(p, new Rect(r.x, r.yMax - 6f, r.width * (1f - progresso), 6f), progresso < livre ? Critico : Cursor);
            Contorno(p, r);
        }

        private static void Retangulo(Painter2D p, Rect r, Color cor)
        {
            p.fillColor = cor;
            p.BeginPath();
            p.MoveTo(new Vector2(r.xMin, r.yMin));
            p.LineTo(new Vector2(r.xMax, r.yMin));
            p.LineTo(new Vector2(r.xMax, r.yMax));
            p.LineTo(new Vector2(r.xMin, r.yMax));
            p.ClosePath();
            p.Fill();
        }

        private static void Contorno(Painter2D p, Rect r)
        {
            p.lineWidth = 2f;
            p.strokeColor = Moldura;
            p.BeginPath();
            p.MoveTo(new Vector2(r.xMin, r.yMin));
            p.LineTo(new Vector2(r.xMax, r.yMin));
            p.LineTo(new Vector2(r.xMax, r.yMax));
            p.LineTo(new Vector2(r.xMin, r.yMax));
            p.ClosePath();
            p.Stroke();
        }

        private static void Circulo(Painter2D p, Vector2 centro, float raio, Color cor, bool cheio, float espessura)
        {
            p.BeginPath();
            p.Arc(centro, raio, Angle.Degrees(0f), Angle.Degrees(360f));
            p.ClosePath();
            if (cheio)
            {
                p.fillColor = cor;
                p.Fill();
                return;
            }
            p.lineWidth = Mathf.Max(1f, espessura);
            p.strokeColor = cor;
            p.Stroke();
        }
    }
}
