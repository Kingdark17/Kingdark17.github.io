using System;
using System.Collections.Generic;
using RPGLegend.Engine;
using UnityEngine;
using UnityEngine.UIElements;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// A luta em primeira pessoa, como a tela de combate do site (tela-combate.tsx): o cenário do lugar atrás, os
    /// monstros de frente no palco, cada um com a placa (nome, vida e o que pesa sobre ele) — tocar num deles muda o
    /// alvo —, e embaixo a caixa preta do Undertale, onde o coração desvia dos golpes: o círculo do golpe de perto,
    /// a faixa da investida (com o monstro mergulhando por ela), a bola do mágico. Os companheiros ficam ao lado da
    /// caixa. Pedida pelo usuário como teste em 2026-10-17 e mantida por ele.
    ///
    /// Só desenha, a cada quadro: onde está cada coisa é a arena que diz (<see cref="Arenas"/>).
    /// </summary>
    public sealed class PalcoDaLuta : VisualElement
    {
        /// <summary>A caixa ocupa esta parte da largura do palco; a altura vem da proporção da caixa da engine.</summary>
        private const float ParteDaLargura = 0.56f;
        /// <summary>A caixa fica um pouco à esquerda do meio, pra não encostar nos botões em volta do ataque.</summary>
        private const float DesvioDaCaixa = 50f;
        private const float TempoDaTremida = 0.36f;
        private const float TempoDoPiscar = 0.6f;
        private const float TempoDoImpacto = 0.25f;

        private static readonly Dictionary<string, string> RotulosDeStatus = new Dictionary<string, string>
        {
            ["queimadura"] = "🔥 Queimando",
            ["sangramento"] = "🩸 Sangrando",
            ["veneno"] = "☣️ Envenenado",
            ["atordoado"] = "💫 Atordoado",
            ["enfraquecido"] = "📉 Enfraquecido",
            ["vulneravel"] = "🎯 Vulnerável",
            ["lento"] = "❄️ Lento",
        };

        private readonly VisualElement _parede, _rodape, _chao, _grupo, _aliados, _caixa;
        private readonly TintaDaCaixa _tinta;
        private readonly CoracaoNaCaixa _coracao;
        private readonly List<Lutador> _lutadores = new List<Lutador>();
        private readonly List<Aliado> _listaDeAliados = new List<Aliado>();
        private readonly List<Label> _mergulhos = new List<Label>();
        private string _temaMostrado;
        private int _tamanhoDoGrupo = -1;
        private bool _visivel = true;

        /// <summary>Tocou num monstro de pé: o índice dele na sala.</summary>
        public event Action<int> AoMirar;

        /// <summary>Onde a caixa começa, do alto do palco (0 antes do primeiro desenho).</summary>
        public float TopoDaCaixa { get; private set; }

        /// <summary>O palco dos monstros: do alto até a caixa (o palco inteiro, antes do primeiro desenho).</summary>
        public Rect AreaDoPalco => TopoDaCaixa > 0 ? new Rect(0f, 0f, contentRect.width, TopoDaCaixa) : contentRect;

        private sealed class Lutador
        {
            public VisualElement Raiz, Placa, Preenchimento, Marcadores, Corpo;
            public Label Nome, Subtitulo, Vida, Vez, Mira, Figura;
            public string Chips;
            public float ApanhouEm = -10f;
        }

        private sealed class Aliado
        {
            public VisualElement Raiz, Preenchimento;
            public Label Icone;
        }

        public PalcoDaLuta()
        {
            AddToClassList("palco-da-luta");
            pickingMode = PickingMode.Position;

            var cenario = new VisualElement { pickingMode = PickingMode.Ignore };
            cenario.AddToClassList("cenario-da-luta");
            _parede = Pedaco(cenario, "parede-da-luta");
            _rodape = Pedaco(cenario, "rodape-da-luta");
            _chao = Pedaco(cenario, "chao-da-luta");
            Add(cenario);

            _grupo = new VisualElement { pickingMode = PickingMode.Ignore };
            _grupo.AddToClassList("grupo-da-luta");
            Add(_grupo);

            _aliados = new VisualElement { pickingMode = PickingMode.Ignore };
            _aliados.AddToClassList("aliados-da-luta");
            Add(_aliados);

            _caixa = new VisualElement { pickingMode = PickingMode.Ignore };
            _caixa.AddToClassList("caixa-da-luta");
            _tinta = new TintaDaCaixa();
            _caixa.Add(_tinta);
            _coracao = new CoracaoNaCaixa();
            _caixa.Add(_coracao);
            Add(_caixa);

            RegisterCallback<GeometryChangedEvent>(_ => Ajustar());
        }

        private static VisualElement Pedaco(VisualElement pai, string classe)
        {
            var pedaco = new VisualElement { pickingMode = PickingMode.Ignore };
            pedaco.AddToClassList(classe);
            pai.Add(pedaco);
            return pedaco;
        }

        /// <summary>A caixa no meio, embaixo, na proporção da engine; o palco dos monstros em cima dela; os aliados ao lado.</summary>
        private void Ajustar()
        {
            var r = contentRect;
            if (float.IsNaN(r.width) || r.width <= 0 || r.height <= 0) return;
            float largura = Mathf.Round(r.width * ParteDaLargura);
            float altura = Mathf.Round(largura * (float)(Arenas.AlturaDaCaixa / Arenas.LarguraDaCaixa));
            float baixo = Mathf.Round(r.height * 0.045f);
            float topoDaCaixa = r.height - baixo - altura;
            float esquerda = Mathf.Max(8f, Mathf.Round((r.width - largura) / 2f - DesvioDaCaixa));
            TopoDaCaixa = topoDaCaixa;
            _caixa.style.width = largura;
            _caixa.style.height = altura;
            _caixa.style.left = esquerda;
            _caixa.style.top = topoDaCaixa;
            _grupo.style.height = Mathf.Max(80f, topoDaCaixa - 6f);
            _aliados.style.top = topoDaCaixa;
            _aliados.style.width = Mathf.Max(40f, esquerda - 16f);
        }

        // ---------- a cada quadro ----------

        /// <summary>Desenha a luta como ela está agora.</summary>
        public void Mostrar(LutaEmTempoReal luta, TemaDaSala tema, string lugar)
        {
            if (!_visivel)
            {
                _visivel = true;
                style.display = DisplayStyle.Flex;
            }
            if (lugar != _temaMostrado)
            {
                _temaMostrado = lugar;
                _parede.style.backgroundColor = tema.Parede;
                _rodape.style.backgroundColor = tema.BordaDaParede;
                _chao.style.backgroundColor = tema.Chao;
            }

            var arena = luta.Arena;
            var sala = Estados.CelulaAtual(luta.Estado) as DungeonCell;
            var instancias = sala?.Monsters ?? new List<MonsterInstance>();
            MostrarGrupo(arena, instancias);
            MostrarAliados(arena, (luta.Estado as EstadoNaMasmorra)?.Party ?? new List<Companion>());
            MostrarMergulhos(arena, instancias);
            _tinta.Mostrar(arena, instancias);
            _coracao.Mostrar(arena);
        }

        public void Esconder()
        {
            if (!_visivel) return;
            _visivel = false;
            style.display = DisplayStyle.None;
            _tinta.Esquecer();
        }

        private void MostrarGrupo(Arena arena, List<MonsterInstance> instancias)
        {
            int total = arena.Monstros.Count;
            while (_lutadores.Count < total) _lutadores.Add(NovoLutador(_lutadores.Count));
            for (int i = 0; i < _lutadores.Count; i++)
            {
                bool usado = i < total;
                if (usado && _lutadores[i].Raiz.parent != _grupo) _grupo.Add(_lutadores[i].Raiz);
                if (!usado && _lutadores[i].Raiz.parent != null) _lutadores[i].Raiz.RemoveFromHierarchy();
            }
            if (total != _tamanhoDoGrupo)
            {
                _tamanhoDoGrupo = total;
                _grupo.EnableInClassList("grupo-de-dois", total == 2);
                _grupo.EnableInClassList("grupo-de-tres", total >= 3);
            }

            float agora = Time.unscaledTime;
            for (int i = 0; i < total; i++)
            {
                var m = arena.Monstros[i];
                var l = _lutadores[i];
                if (i >= instancias.Count) continue;
                var visao = Monsters.View(instancias[i]);
                bool caido = m.Fase == "caido";

                l.Nome.text = Js.Str(visao.Name) + (visao.IsBoss ? " 👑" : "");
                l.Subtitulo.text = caido ? "Caiu" : visao.EnemyClassLabel ?? "";
                double vida = Math.Max(0, instancias[i].Hp);
                double maximo = Math.Max(1, instancias[i].MaxHp);
                l.Preenchimento.style.width = Length.Percent((float)Math.Min(100.0, vida / maximo * 100.0));
                l.Vida.text = Js.NumberToString(vida) + " / " + Js.NumberToString(instancias[i].MaxHp);
                if (l.Figura.text != visao.Icon) l.Figura.text = visao.Icon;
                l.Raiz.EnableInClassList("lutador-chefe", visao.IsBoss);
                l.Raiz.EnableInClassList("lutador-caido", caido);
                l.Raiz.EnableInClassList("lutador-alvo", !caido && total > 1 && arena.Alvo == m.Indice);
                l.Mira.style.display = !caido && total > 1 && arena.Alvo == m.Indice ? DisplayStyle.Flex : DisplayStyle.None;

                // Quem vai golpear avisa; quem mergulhou na caixa some do palco enquanto isso.
                bool avisando = m.Fase == "avisando";
                l.Raiz.EnableInClassList("lutador-avisando", avisando);
                l.Corpo.style.opacity = caido ? 0.38f : m.Fase == "investindo" ? 0.15f : 1f;
                l.Vez.text = avisando ? (m.Alvo >= 0 ? "⚠️ mira um aliado" : "⚠️ vai atacar!") : "";
                l.Vez.style.display = avisando ? DisplayStyle.Flex : DisplayStyle.None;

                var chips = Chips(m, visao);
                if (chips != l.Chips)
                {
                    l.Chips = chips;
                    l.Marcadores.Clear();
                    if (chips.Length > 0)
                        foreach (var rotulo in chips.Split('|'))
                        {
                            var chip = new Label(rotulo) { pickingMode = PickingMode.Ignore };
                            chip.AddToClassList("marcador-da-luta");
                            l.Marcadores.Add(chip);
                        }
                }

                // Apanhou: treme e pisca, como o inimigo do Undertale.
                float t = (agora - l.ApanhouEm) / TempoDaTremida;
                if (t >= 0f && t < 1f)
                {
                    float x = Mathf.Sin(t * Mathf.PI * 6f) * 7f * (1f - t);
                    l.Figura.style.translate = new Translate(x, 0f);
                    l.Figura.style.opacity = t < 0.5f && Mathf.Repeat(t * 6f, 1f) < 0.5f ? 0.45f : 1f;
                }
                else
                {
                    l.Figura.style.translate = new Translate(0f, 0f);
                    l.Figura.style.opacity = 1f;
                }
            }
        }

        /// <summary>O que pesa sobre o monstro (a mesma lista do site) e a guarda do defensivo, separados por "|".</summary>
        private static string Chips(MonstroNaArena m, CombatMonsterView visao)
        {
            if (m.Fase == "caido") return "";
            var lista = new List<string>();
            var s = visao.Status;
            if (s != null)
            {
                if (s.Queimadura != null && s.Queimadura.Turns > 0) lista.Add(RotulosDeStatus["queimadura"]);
                if (s.Sangramento != null && s.Sangramento.Turns > 0) lista.Add(RotulosDeStatus["sangramento"]);
                if (s.Veneno != null && s.Veneno.Turns > 0) lista.Add(RotulosDeStatus["veneno"]);
                if ((s.Atordoado ?? 0) > 0) lista.Add(RotulosDeStatus["atordoado"]);
                if (s.Enfraquecido != null && s.Enfraquecido.Turns > 0) lista.Add(RotulosDeStatus["enfraquecido"]);
                if (s.Vulneravel != null && s.Vulneravel.Turns > 0) lista.Add(RotulosDeStatus["vulneravel"]);
                if (s.Lento != null && s.Lento.Turns > 0) lista.Add(RotulosDeStatus["lento"]);
            }
            if (m.Fase == "atordoado" && !lista.Contains(RotulosDeStatus["atordoado"])) lista.Add(RotulosDeStatus["atordoado"]);
            if (m.Fase == "hesitando") lista.Add("🐌 Hesitando");
            if (m.Fase == "descansando" && Arenas.JeitoDoComportamento(visao.Behavior).Guarda == true) lista.Add("🛡️ Em guarda");
            return string.Join("|", lista);
        }

        private Lutador NovoLutador(int indice)
        {
            var l = new Lutador { Raiz = new VisualElement() };
            l.Raiz.AddToClassList("lutador");
            l.Raiz.RegisterCallback<PointerDownEvent>(e =>
            {
                // Tocar no monstro escolhe o alvo; não vira o joystick do palco.
                e.StopPropagation();
                AoMirar?.Invoke(indice);
            });

            l.Placa = new VisualElement { pickingMode = PickingMode.Ignore };
            l.Placa.AddToClassList("placa-da-luta");
            l.Nome = Rotulo(l.Placa, "nome-do-lutador");
            l.Nome.AddToClassList("nome");
            l.Subtitulo = Rotulo(l.Placa, "subtitulo-do-lutador");
            var trilho = new VisualElement { pickingMode = PickingMode.Ignore };
            trilho.AddToClassList("trilho-da-luta");
            l.Preenchimento = new VisualElement { pickingMode = PickingMode.Ignore };
            l.Preenchimento.AddToClassList("vida-da-luta");
            trilho.Add(l.Preenchimento);
            l.Placa.Add(trilho);
            l.Vida = Rotulo(l.Placa, "vida-do-lutador");
            l.Marcadores = new VisualElement { pickingMode = PickingMode.Ignore };
            l.Marcadores.AddToClassList("marcadores-da-luta");
            l.Placa.Add(l.Marcadores);
            l.Vez = Rotulo(l.Placa, "vez-do-lutador");
            l.Raiz.Add(l.Placa);

            l.Corpo = new VisualElement { pickingMode = PickingMode.Ignore };
            l.Corpo.AddToClassList("corpo-do-lutador");
            l.Mira = Rotulo(l.Corpo, "mira-do-lutador");
            l.Mira.text = "🎯";
            l.Figura = Rotulo(l.Corpo, "figura-do-lutador");
            var sombra = new VisualElement { pickingMode = PickingMode.Ignore };
            sombra.AddToClassList("sombra-do-lutador");
            l.Corpo.Add(sombra);
            l.Raiz.Add(l.Corpo);
            return l;
        }

        private static Label Rotulo(VisualElement pai, string classe)
        {
            var rotulo = new Label { pickingMode = PickingMode.Ignore };
            rotulo.AddToClassList(classe);
            pai.Add(rotulo);
            return rotulo;
        }

        private void MostrarAliados(Arena arena, List<Companion> equipe)
        {
            while (_listaDeAliados.Count < arena.Companheiros.Count)
            {
                var a = new Aliado { Raiz = new VisualElement { pickingMode = PickingMode.Ignore } };
                a.Raiz.AddToClassList("aliado-na-luta");
                a.Icone = Rotulo(a.Raiz, "icone-do-aliado");
                var trilho = new VisualElement { pickingMode = PickingMode.Ignore };
                trilho.AddToClassList("trilho-do-aliado");
                a.Preenchimento = new VisualElement { pickingMode = PickingMode.Ignore };
                a.Preenchimento.AddToClassList("vida-do-aliado");
                trilho.Add(a.Preenchimento);
                a.Raiz.Add(trilho);
                _aliados.Add(a.Raiz);
                _listaDeAliados.Add(a);
            }
            for (int k = 0; k < _listaDeAliados.Count; k++)
            {
                var a = _listaDeAliados[k];
                if (k >= arena.Companheiros.Count)
                {
                    a.Raiz.style.display = DisplayStyle.None;
                    continue;
                }
                int indice = (int)arena.Companheiros[k].Indice;
                var membro = indice < equipe.Count ? equipe[indice] : null;
                a.Raiz.style.display = membro != null ? DisplayStyle.Flex : DisplayStyle.None;
                if (membro == null) continue;
                a.Icone.text = string.IsNullOrEmpty(membro.ClassIcon) ? "🛡️" : membro.ClassIcon;
                a.Preenchimento.style.width = Length.Percent((float)Math.Max(0, Math.Min(100.0, membro.Hp / Math.Max(1, membro.MaxHp) * 100.0)));
                a.Raiz.EnableInClassList("aliado-caido", membro.Hp <= 0);
                bool mirado = false;
                foreach (var m in arena.Monstros)
                    if (m.Fase == "avisando" && m.Alvo == indice) mirado = true;
                a.Raiz.EnableInClassList("aliado-na-mira", mirado);
            }
        }

        /// <summary>O monstro que investe mergulha pela caixa: o emoji dele, no tamanho do que pega.</summary>
        private void MostrarMergulhos(Arena arena, List<MonsterInstance> instancias)
        {
            var r = _caixa.contentRect;
            float escala = r.width / (float)Arenas.LarguraDaCaixa;
            while (_mergulhos.Count < arena.Monstros.Count)
            {
                var rotulo = new Label { pickingMode = PickingMode.Ignore };
                rotulo.AddToClassList("mergulho-na-caixa");
                _caixa.Add(rotulo);
                _mergulhos.Add(rotulo);
                // O coração fica por cima de quem mergulha.
                _coracao.BringToFront();
            }
            for (int i = 0; i < _mergulhos.Count; i++)
            {
                var rotulo = _mergulhos[i];
                var m = i < arena.Monstros.Count ? arena.Monstros[i] : null;
                bool mergulhando = m != null && m.Fase == "investindo" && m.Alvo < 0 && i < instancias.Count && escala > 0;
                rotulo.style.display = mergulhando ? DisplayStyle.Flex : DisplayStyle.None;
                if (!mergulhando) continue;
                var visao = Monsters.View(instancias[i]);
                var jeito = Arenas.JeitoDoComportamento(visao.Behavior);
                float lado = (float)jeito.Tamanho * 2f * escala;
                if (rotulo.text != visao.Icon) rotulo.text = visao.Icon;
                rotulo.style.fontSize = lado * 0.8f;
                rotulo.style.width = lado;
                rotulo.style.height = lado;
                rotulo.style.left = (float)m.X * escala - lado / 2f;
                rotulo.style.top = (float)m.Y * escala - lado / 2f;
            }
        }

        // ---------- pra quem põe os números ----------

        /// <summary>Em cima da figura do monstro, no sistema do palco (o mesmo dos números da luta).</summary>
        public Vector2 PosicaoDoMonstro(int indice)
        {
            if (indice < 0 || indice >= _lutadores.Count || _lutadores[indice].Raiz.parent == null) return new Vector2(contentRect.width / 2f, contentRect.height * 0.3f);
            var b = _lutadores[indice].Figura.worldBound;
            return this.WorldToLocal(new Vector2(b.center.x, b.yMin + b.height * 0.2f));
        }

        /// <summary>Em cima do coração, na caixa.</summary>
        public Vector2 PosicaoDoCoracao(Arena arena)
        {
            var r = _caixa.contentRect;
            float escala = r.width / (float)Arenas.LarguraDaCaixa;
            var local = new Vector2((float)arena.Coracao.X * escala, (float)arena.Coracao.Y * escala - 18f);
            return this.WorldToLocal(_caixa.LocalToWorld(local));
        }

        /// <summary>Em cima do companheiro (pelo índice na equipe).</summary>
        public Vector2 PosicaoDoAliado(Arena arena, int indice)
        {
            for (int k = 0; k < arena.Companheiros.Count && k < _listaDeAliados.Count; k++)
            {
                if ((int)arena.Companheiros[k].Indice != indice) continue;
                var b = _listaDeAliados[k].Raiz.worldBound;
                return this.WorldToLocal(new Vector2(b.center.x, b.yMin));
            }
            return PosicaoDoCoracao(arena);
        }

        /// <summary>O monstro apanhou: treme.</summary>
        public void Apanhou(int indice)
        {
            if (indice >= 0 && indice < _lutadores.Count) _lutadores[indice].ApanhouEm = Time.unscaledTime;
        }

        /// <summary>O coração apanhou: pisca.</summary>
        public void CoracaoApanhou() => _coracao.Apanhou();

        // ---------- a caixa ----------

        /// <summary>
        /// O que vai dentro da caixa, por baixo do coração: o aviso de cada golpe (o círculo de perto, a faixa da
        /// investida, a mira do tiro), o estalo do golpe de perto quando ele cai e as bolas voando. As medidas são as da
        /// engine, na escala da caixa.
        /// </summary>
        private sealed class TintaDaCaixa : VisualElement
        {
            private static readonly Color Aviso = new Color(0.9f, 0.16f, 0.14f, 1f);
            private static readonly Color Bola = new Color(1f, 1f, 1f, 1f);
            private static readonly Color AuraDaBola = new Color(0.69f, 0.36f, 0.88f, 0.55f);

            private Arena _arena;
            private List<MonsterInstance> _instancias;
            private readonly List<string> _fasesAntes = new List<string>();
            private readonly List<(float x, float y, float raio, float desde)> _impactos = new List<(float, float, float, float)>();

            public TintaDaCaixa()
            {
                pickingMode = PickingMode.Ignore;
                AddToClassList("tinta-da-caixa");
                generateVisualContent += Desenhar;
            }

            public void Mostrar(Arena arena, List<MonsterInstance> instancias)
            {
                // O golpe de perto não deixa rastro na arena: o estalo é daqui, quando o aviso acaba.
                for (int i = 0; i < arena.Monstros.Count; i++)
                {
                    var m = arena.Monstros[i];
                    string antes = i < _fasesAntes.Count ? _fasesAntes[i] : null;
                    if (antes == "avisando" && m.Fase != "avisando" && m.Alvo < 0 && i < instancias.Count)
                    {
                        var jeito = Arenas.JeitoDoComportamento(Monsters.View(instancias[i]).Behavior);
                        if (jeito.Golpe == "perto") _impactos.Add(((float)m.X, (float)m.Y, (float)jeito.Tamanho, Time.unscaledTime));
                    }
                    if (i < _fasesAntes.Count) _fasesAntes[i] = m.Fase;
                    else _fasesAntes.Add(m.Fase);
                }
                _impactos.RemoveAll(x => Time.unscaledTime - x.desde > TempoDoImpacto);
                _arena = arena;
                _instancias = instancias;
                MarkDirtyRepaint();
            }

            public void Esquecer()
            {
                _fasesAntes.Clear();
                _impactos.Clear();
                _arena = null;
            }

            private void Desenhar(MeshGenerationContext contexto)
            {
                if (_arena == null) return;
                var p = contexto.painter2D;
                var r = contentRect;
                float escala = r.width / (float)Arenas.LarguraDaCaixa;
                if (escala <= 0) return;

                for (int i = 0; i < _arena.Monstros.Count && i < _instancias.Count; i++)
                {
                    var m = _arena.Monstros[i];
                    if (m.Fase != "avisando" || m.Alvo >= 0) continue;
                    var jeito = Arenas.JeitoDoComportamento(Monsters.View(_instancias[i]).Behavior);
                    float progresso = jeito.Aviso > 0 ? 1f - Mathf.Clamp01((float)(m.Tempo / jeito.Aviso)) : 1f;
                    // Pisca mais rápido perto de cair.
                    float pisca = 0.5f + 0.5f * Mathf.Sin(Time.unscaledTime * (10f + 20f * progresso));
                    float alfa = 0.14f + 0.22f * progresso + 0.08f * pisca;
                    var centro = new Vector2((float)m.X * escala, (float)m.Y * escala);
                    if (jeito.Golpe == "perto")
                    {
                        Circulo(p, centro, (float)jeito.Tamanho * escala, Cor(Aviso, alfa), true, 0f);
                        Circulo(p, centro, (float)jeito.Tamanho * escala, Cor(Aviso, 0.6f + 0.4f * pisca), false, 2f);
                    }
                    else if (jeito.Golpe == "investida")
                    {
                        var rumo = new Vector2((float)m.RumoX, (float)m.RumoY);
                        if (rumo.sqrMagnitude < 1f) rumo = Vector2.up;
                        rumo.Normalize();
                        float meia = (float)jeito.Tamanho * escala;
                        float comprimento = (r.width + r.height) * 1.5f;
                        Faixa(p, centro, rumo, comprimento, meia, Cor(Aviso, alfa));
                    }
                    else
                    {
                        // O tiro: a mira do alto até o coração, e a bola crescendo na borda.
                        var coracao = new Vector2((float)_arena.Coracao.X * escala, (float)_arena.Coracao.Y * escala);
                        var borda = new Vector2(centro.x, 0f);
                        p.lineWidth = 2f;
                        p.strokeColor = Cor(Aviso, 0.35f + 0.4f * pisca);
                        p.BeginPath();
                        p.MoveTo(borda);
                        p.LineTo(coracao);
                        p.Stroke();
                        Circulo(p, borda, Mathf.Max(2f, (float)jeito.Tamanho * escala * progresso), Cor(AuraDaBola, 0.9f), true, 0f);
                    }
                }

                foreach (var (x, y, raio, desde) in _impactos)
                {
                    float t = Mathf.Clamp01((Time.unscaledTime - desde) / TempoDoImpacto);
                    Circulo(p, new Vector2(x * escala, y * escala), raio * escala * (0.85f + 0.15f * t), Cor(Color.white, 0.55f * (1f - t)), true, 0f);
                }

                foreach (var tiro in _arena.Tiros)
                {
                    var centro = new Vector2((float)tiro.X * escala, (float)tiro.Y * escala);
                    float raio = (float)tiro.Raio * escala;
                    Circulo(p, centro, raio * 1.35f, AuraDaBola, true, 0f);
                    Circulo(p, centro, raio, Bola, true, 0f);
                }
            }

            private static Color Cor(Color cor, float alfa) => new Color(cor.r, cor.g, cor.b, Mathf.Clamp01(alfa));

            /// <summary>A faixa da investida: do começo, na direção do rumo, com a largura do corpo que mergulha.</summary>
            private static void Faixa(Painter2D p, Vector2 inicio, Vector2 rumo, float comprimento, float meia, Color cor)
            {
                var lado = new Vector2(-rumo.y, rumo.x) * meia;
                var fim = inicio + rumo * comprimento;
                p.fillColor = cor;
                p.BeginPath();
                p.MoveTo(inicio + lado);
                p.LineTo(fim + lado);
                p.LineTo(fim - lado);
                p.LineTo(inicio - lado);
                p.ClosePath();
                p.Fill();
            }

            private static void Circulo(Painter2D p, Vector2 centro, float raio, Color cor, bool cheio, float espessura)
            {
                p.BeginPath();
                p.Arc(centro, Mathf.Max(0.5f, raio), Angle.Degrees(0f), Angle.Degrees(360f));
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

        /// <summary>O coração do Undertale, em pixel, onde a arena diz; pisca quando apanha.</summary>
        private sealed class CoracaoNaCaixa : VisualElement
        {
            private static readonly Color Vermelho = new Color32(0xff, 0x12, 0x12, 255);

            // 9 × 8, como o coração do jogo.
            private static readonly string[] Desenho =
            {
                ".XX...XX.",
                "XXXX.XXXX",
                "XXXXXXXXX",
                "XXXXXXXXX",
                ".XXXXXXX.",
                "..XXXXX..",
                "...XXX...",
                "....X....",
            };

            private Arena _arena;
            private float _apanhouEm = -10f;

            public CoracaoNaCaixa()
            {
                pickingMode = PickingMode.Ignore;
                AddToClassList("tinta-da-caixa");
                generateVisualContent += Desenhar;
            }

            public void Mostrar(Arena arena)
            {
                _arena = arena;
                MarkDirtyRepaint();
            }

            public void Apanhou() => _apanhouEm = Time.unscaledTime;

            private void Desenhar(MeshGenerationContext contexto)
            {
                if (_arena == null) return;
                float desde = Time.unscaledTime - _apanhouEm;
                if (desde < TempoDoPiscar && Mathf.Repeat(desde * 12f, 1f) < 0.5f) return;
                var r = contentRect;
                float escala = r.width / (float)Arenas.LarguraDaCaixa;
                if (escala <= 0) return;
                float lado = Mathf.Max(9f, (float)Arenas.RaioDoCoracao * 2f * escala);
                float pixel = lado / 9f;
                float x0 = (float)_arena.Coracao.X * escala - lado / 2f;
                float y0 = (float)_arena.Coracao.Y * escala - pixel * 4f;
                var p = contexto.painter2D;
                p.fillColor = Vermelho;
                for (int linha = 0; linha < Desenho.Length; linha++)
                {
                    for (int coluna = 0; coluna < Desenho[linha].Length; coluna++)
                    {
                        if (Desenho[linha][coluna] != 'X') continue;
                        float x = x0 + coluna * pixel;
                        float y = y0 + linha * pixel;
                        p.BeginPath();
                        p.MoveTo(new Vector2(x, y));
                        p.LineTo(new Vector2(x + pixel + 0.3f, y));
                        p.LineTo(new Vector2(x + pixel + 0.3f, y + pixel + 0.3f));
                        p.LineTo(new Vector2(x, y + pixel + 0.3f));
                        p.ClosePath();
                        p.Fill();
                    }
                }
            }
        }
    }
}
