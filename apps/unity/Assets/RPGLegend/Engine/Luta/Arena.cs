using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: JeitoDeLutar — o jeito de lutar de um comportamento de monstro.</summary>
    public sealed class JeitoDeLutar
    {
        /// <summary>Quanto dura o aviso antes do golpe.</summary>
        public double Aviso;
        /// <summary>"perto", "investida" ou "tiro".</summary>
        public string Golpe;
        /// <summary>O raio do que pega: o círculo (perto), o corpo que mergulha (investida), a bola (tiro).</summary>
        public double Tamanho;
        /// <summary>Por passo, o mergulho ou a bola. O golpe de perto não anda.</summary>
        public double Velocidade;
        /// <summary>Parado depois do golpe.</summary>
        public double Descanso;
        /// <summary>Descansando, ele se protege: o golpe do herói chega com metade da força.</summary>
        public bool? Guarda;
    }

    /// <summary>
    /// TS: MonstroNaArena. Fase: "esperando", "avisando", "investindo", "descansando", "atordoado", "hesitando" ou
    /// "caido". Alvo -1 é o herói (na caixa); senão o índice do companheiro na equipe.
    /// </summary>
    public sealed class MonstroNaArena
    {
        public double Indice;
        public string Fase;
        public double Tempo;
        public double Forca;
        public double Alvo;
        public double X;
        public double Y;
        public double RumoX;
        public double RumoY;

        public MonstroNaArena Clone() => (MonstroNaArena)MemberwiseClone();
    }

    /// <summary>TS: CompanheiroNaArena.</summary>
    public sealed class CompanheiroNaArena
    {
        public double Indice;
        public double Tempo;

        public CompanheiroNaArena Clone() => (CompanheiroNaArena)MemberwiseClone();
    }

    /// <summary>TS: Tiro — a bola do mágico, voando pela caixa.</summary>
    public sealed class Tiro
    {
        public double X;
        public double Y;
        public double Vx;
        public double Vy;
        public double Raio;
        public double Vida;
        public double Indice;
        public double Forca;

        public Tiro Clone() => (Tiro)MemberwiseClone();
    }

    /// <summary>TS: Coracao — onde o coração está, na caixa.</summary>
    public sealed class Coracao
    {
        public double X;
        public double Y;
    }

    /// <summary>TS: EventoAberto — o evento da arma em curso.</summary>
    public sealed class EventoAberto
    {
        public EventoDeArma Evento;
        public double Passo;
        public JogadaDoEvento Jogada;
        public double Alvo;
        public string Estilo;
    }

    /// <summary>TS: Arena — tudo o que a luta em tempo real tem: o palco, a caixa e os tempos.</summary>
    public sealed class Arena
    {
        public double Passo;
        public double Lento;
        public Walker Chegada;
        public Coracao Coracao;
        public double Alvo;
        public List<MonstroNaArena> Monstros;
        public List<CompanheiroNaArena> Companheiros;
        public List<Tiro> Tiros;
        [KeepNull] public EventoAberto Evento;
        public double Recarga;
        public OrderedMap<double> RecargaDosPoderes;
        public double RecargaDoItem;
        public double Rodada;
        public double Intervalo;
        public double Vez;
        /// <summary>
        /// O que sobra do escudo do vigor (a Encantadora, <see cref="Encantamentos"/>): apanha antes da vida e some com a
        /// luta. Ausente (null) quando o herói não tem vigor.
        /// </summary>
        public double? Escudo;
    }

    /// <summary>TS: LutaEmTempoReal. Fim: null, "vitoria" ou "derrota".</summary>
    public class LutaEmTempoReal
    {
        public EstadoDoJogo Estado;
        public Arena Arena;
        [KeepNull] public string Pet;
        /// <summary>Jogada no teclado (o PC): o cajado pede letras em vez do desenho (EVENTO_NO_TECLADO).</summary>
        public bool Teclado;
        [KeepNull] public string Fim;
        [KeepNull] public Item Loot;
    }

    /// <summary>Onde o dedo está, na caixa do desenho.</summary>
    public sealed class DedoNoDesenho
    {
        public double X;
        public double Y;
    }

    /// <summary>TS: EntradaDaLuta — o que a pessoa fez neste passo.</summary>
    public sealed class EntradaDaLuta
    {
        public double X;
        public double Y;
        public double? Mirar;
        public bool? Atacar;
        public bool? Soltar;
        public bool? Tocar;
        public DedoNoDesenho Dedo;
        /// <summary>Letras: a tecla de letra apertada neste passo.</summary>
        public string Tecla;
        public string Poder;
        public string Item;
        public bool? Menu;
    }

    /// <summary>TS: Acontecimento — algo que a tela mostra ou toca.</summary>
    public sealed class Acontecimento
    {
        /// <summary>"numero", "som", "diario" ou "aviso".</summary>
        public string Tipo;
        public string Texto;
        /// <summary>"monstro", "heroi" ou "companheiro".</summary>
        public string Onde;
        public double? Indice;
        /// <summary>"dano", "critico", "cura" ou "erro".</summary>
        public string Tom;
        public string Som;
    }

    /// <summary>TS: QuadroDaLuta.</summary>
    public sealed class QuadroDaLuta
    {
        public LutaEmTempoReal Luta;
        public List<Acontecimento> Acontecimentos;
    }

    /// <summary>As tabelas de luta/arena.ts (fixtures/data/luta/arena.json).</summary>
    public sealed class ArenaData
    {
        [JsName("LENTIDAO")] public double Lentidao;
        [JsName("RODADA")] public double Rodada;
        [JsName("RECARGA_DO_ATAQUE")] public double RecargaDoAtaque;
        [JsName("RECARGA_DO_PODER")] public double RecargaDoPoder;
        [JsName("RECARGA_DO_ITEM")] public double RecargaDoItem;
        [JsName("LARGURA_DA_CAIXA")] public double LarguraDaCaixa;
        [JsName("ALTURA_DA_CAIXA")] public double AlturaDaCaixa;
        [JsName("RAIO_DO_CORACAO")] public double RaioDoCoracao;
        [JsName("VELOCIDADE_DO_CORACAO")] public double VelocidadeDoCoracao;
        [JsName("VIDA_DO_TIRO")] public double VidaDoTiro;
        [JsName("TEMPO_ATORDOADO")] public double TempoAtordoado;
        [JsName("TEMPO_HESITANDO")] public double TempoHesitando;
        [JsName("ESPERA_INICIAL")] public double EsperaInicial;
        [JsName("ATACANDO_DE_UMA_VEZ")] public double AtacandoDeUmaVez;
        [JsName("INTERVALO_ENTRE_GOLPES")] public double IntervaloEntreGolpes;
        [JsName("CADENCIA_DO_COMPANHEIRO")] public double CadenciaDoCompanheiro;
        [JsName("JEITOS_DE_LUTAR")] public OrderedMap<JeitoDeLutar> JeitosDeLutar = new OrderedMap<JeitoDeLutar>();
    }

    public static partial class GameData
    {
        private static ArenaData _arenaTable;

        /// <summary>luta/arena: os tempos, a caixa e os jeitos de lutar da luta em tempo real.</summary>
        public static ArenaData ArenaTable
        {
            get => Require(_arenaTable, "luta/arena");
            set => _arenaTable = value;
        }
    }

    /// <summary>
    /// Port de shared/src/luta/arena.ts: a luta em tempo real do app, em primeira pessoa como a do site, com o
    /// coração na caixa como no Undertale (pedida pelo usuário como teste em 2026-10-17 e mantida por ele). Os
    /// monstros ficam no palco; o joystick move o coração dentro da caixa; todo golpe de monstro no herói é um
    /// desenho na caixa com aviso antes, e só pega se encostar no coração. O botão de ataque abre o evento da
    /// arma no alvo, em câmera lenta. Um monstro golpeia por vez, revezando; o golpe pode ir num companheiro
    /// pela regra do site. A recompensa é a do site (FimDaLuta). Tudo em passos e unidades inteiras; o sorteio
    /// atravessa a luta inteira.
    /// </summary>
    public static class Arenas
    {
        private static ArenaData D => GameData.ArenaTable;

        public static double Lentidao => D.Lentidao;
        public static double Rodada => D.Rodada;
        public static double LarguraDaCaixa => D.LarguraDaCaixa;
        public static double AlturaDaCaixa => D.AlturaDaCaixa;
        public static double RaioDoCoracao => D.RaioDoCoracao;

        /// <summary>O jeito de lutar de um comportamento (o agressivo, se não houver), pra tela desenhar o golpe.</summary>
        public static JeitoDeLutar JeitoDoComportamento(string behavior) =>
            behavior != null && D.JeitosDeLutar.TryGet(behavior, out var jeito) ? jeito : D.JeitosDeLutar.Get("agressivo");

        /// <summary>A luta enquanto o passo corre: a mesma, mais o sorteio, o relógio e o que vai pra tela.</summary>
        private sealed class Luta
        {
            public EstadoDoJogo Estado;
            public Arena Arena;
            public string Pet;
            public bool Teclado;
            public string Fim;
            public Item Loot;
            public RngFn Rng;
            public Func<double> Now;
            public List<Acontecimento> Acontecimentos = new List<Acontecimento>();
        }

        // ---------- abrir ----------

        /// <summary>
        /// TS: abrirLuta — prepara os monstros e o herói (<see cref="FimDaLuta.PrepararLuta"/>), põe os monstros no
        /// palco (os caídos ficam no lugar, apagados), o coração no meio da caixa e os companheiros vivos ao lado.
        /// O alvo começa no primeiro de pé. <paramref name="chegada"/> é por onde o herói entrou: a luta guarda
        /// pra ele voltar ali quando acabar. <paramref name="teclado"/>: jogada no PC, onde o cajado pede letras em
        /// vez do desenho.
        /// </summary>
        public static QuadroDaLuta AbrirLuta(EstadoNaMasmorra estado, Walker chegada, string pet = null, bool teclado = false)
        {
            var preparada = FimDaLuta.PrepararLuta(estado);
            var sala = (DungeonCell)Estados.CelulaAtual(preparada.Estado);
            var dePe = FimDaLuta.IndicesDePe(sala);

            var monstros = new List<MonstroNaArena>();
            int total = sala.Monsters?.Count ?? 0;
            for (int indice = 0; indice < total; indice++)
            {
                monstros.Add(new MonstroNaArena
                {
                    Indice = indice,
                    Fase = dePe.Contains(indice) ? "esperando" : "caido",
                    Tempo = 0,
                    Forca = 1,
                    Alvo = -1,
                    X = 0,
                    Y = 0,
                    RumoX = 0,
                    RumoY = 0,
                });
            }

            var companheiros = new List<CompanheiroNaArena>();
            var equipe = ((EstadoNaMasmorra)preparada.Estado).Party ?? new List<Companion>();
            for (int indice = 0; indice < equipe.Count; indice++)
            {
                if (equipe[indice].Hp > 0) companheiros.Add(new CompanheiroNaArena { Indice = indice, Tempo = D.CadenciaDoCompanheiro / 2 + indice * 10 });
            }

            var arena = new Arena
            {
                Passo = 0,
                Lento = 0,
                Chegada = new Walker { X = chegada.X, Y = chegada.Y, Facing = chegada.Facing },
                Coracao = new Coracao { X = D.LarguraDaCaixa / 2, Y = D.AlturaDaCaixa / 2 },
                Alvo = dePe.Count > 0 ? dePe[0] : 0,
                Monstros = monstros,
                Companheiros = companheiros,
                Tiros = new List<Tiro>(),
                Evento = null,
                Recarga = 0,
                RecargaDosPoderes = new OrderedMap<double>(),
                RecargaDoItem = 0,
                Rodada = D.Rodada,
                Intervalo = D.EsperaInicial,
                Vez = -1,
            };
            var acontecimentos = new List<Acontecimento>();
            foreach (var texto in preparada.Log) acontecimentos.Add(new Acontecimento { Tipo = "diario", Texto = texto });
            // O vigor da armadura encantada ergue o escudo na entrada da luta (só o app tem a arena).
            double escudo = Encantamentos.EscudoDoVigor(preparada.Estado.Hero);
            if (escudo > 0)
            {
                arena.Escudo = escudo;
                acontecimentos.Add(Aviso("💪 Vigor: escudo de " + Js.NumberToString(escudo)));
            }
            return new QuadroDaLuta
            {
                Luta = new LutaEmTempoReal { Estado = preparada.Estado, Arena = arena, Pet = pet, Teclado = teclado, Fim = null, Loot = null },
                Acontecimentos = acontecimentos,
            };
        }

        // ---------- o passo ----------

        /// <summary>
        /// TS: passoDaLuta — um passo da luta. O evento da arma corre em tempo de verdade; o mundo (coração,
        /// monstros, companheiros, tiros, rodada) anda um passo, ou, em câmera lenta, um a cada LENTIDAO.
        /// <paramref name="now"/> é o relógio do uid do item que cai ao vencer (e do andar novo, se foi chefe).
        /// </summary>
        public static QuadroDaLuta PassoDaLuta(LutaEmTempoReal luta, EntradaDaLuta entrada, RngFn rng, Func<double> now = null)
        {
            if (luta.Fim != null) return new QuadroDaLuta { Luta = luta, Acontecimentos = new List<Acontecimento>() };
            var l = new Luta { Estado = luta.Estado, Arena = CopiarArena(luta.Arena), Pet = luta.Pet, Teclado = luta.Teclado, Fim = luta.Fim, Loot = luta.Loot, Rng = rng, Now = now };

            if (entrada.Mirar != null) Mirar(l, entrada.Mirar.Value);
            if (l.Arena.Evento != null) SeguirEvento(l, entrada);
            else if (entrada.Atacar == true && l.Arena.Recarga <= 0) AbrirEvento(l);
            else if (Js.Truthy(entrada.Poder)) UsarPoder(l, entrada.Poder);
            else if (Js.Truthy(entrada.Item)) UsarItem(l, entrada.Item);

            if (l.Fim == null)
            {
                bool lento = l.Arena.Evento != null || entrada.Menu == true;
                if (lento) l.Arena.Lento += 1;
                if (!lento || l.Arena.Lento % D.Lentidao == 0) PassoDoMundo(l, entrada);
            }

            return new QuadroDaLuta
            {
                Luta = new LutaEmTempoReal { Estado = l.Estado, Arena = l.Arena, Pet = l.Pet, Teclado = l.Teclado, Fim = l.Fim, Loot = l.Loot },
                Acontecimentos = l.Acontecimentos,
            };
        }

        /// <summary>TS: simularLuta — vários passos de uma vez, cada um com a sua entrada; para no fim da luta.</summary>
        public static QuadroDaLuta SimularLuta(LutaEmTempoReal luta, IReadOnlyList<EntradaDaLuta> entradas, RngFn rng, Func<double> now = null)
        {
            var atual = luta;
            var acontecimentos = new List<Acontecimento>();
            foreach (var entrada in entradas)
            {
                if (atual.Fim != null) break;
                var quadro = PassoDaLuta(atual, entrada, rng, now);
                atual = quadro.Luta;
                acontecimentos.AddRange(quadro.Acontecimentos);
            }
            return new QuadroDaLuta { Luta = atual, Acontecimentos = acontecimentos };
        }

        private static Arena CopiarArena(Arena arena)
        {
            var copia = new Arena
            {
                Passo = arena.Passo,
                Lento = arena.Lento,
                Chegada = new Walker { X = arena.Chegada.X, Y = arena.Chegada.Y, Facing = arena.Chegada.Facing },
                Coracao = new Coracao { X = arena.Coracao.X, Y = arena.Coracao.Y },
                Alvo = arena.Alvo,
                Monstros = new List<MonstroNaArena>(arena.Monstros.Count),
                Companheiros = new List<CompanheiroNaArena>(arena.Companheiros.Count),
                Tiros = new List<Tiro>(arena.Tiros.Count),
                Evento = null,
                Recarga = arena.Recarga,
                RecargaDosPoderes = new OrderedMap<double>(),
                RecargaDoItem = arena.RecargaDoItem,
                Rodada = arena.Rodada,
                Intervalo = arena.Intervalo,
                Vez = arena.Vez,
                Escudo = arena.Escudo,
            };
            foreach (var m in arena.Monstros) copia.Monstros.Add(m.Clone());
            foreach (var c in arena.Companheiros) copia.Companheiros.Add(c.Clone());
            foreach (var t in arena.Tiros) copia.Tiros.Add(t.Clone());
            foreach (var par in arena.RecargaDosPoderes) copia.RecargaDosPoderes.Set(par.Key, par.Value);
            if (arena.Evento != null)
            {
                var j = arena.Evento.Jogada ?? new JogadaDoEvento();
                copia.Evento = new EventoAberto
                {
                    Evento = arena.Evento.Evento,
                    Passo = arena.Evento.Passo,
                    Jogada = new JogadaDoEvento
                    {
                        Toque = j.Toque,
                        Soltou = j.Soltou,
                        Toques = j.Toques != null ? new List<double>(j.Toques) : null,
                        Traco = j.Traco != null ? new List<PontoDoTraco>(j.Traco) : null,
                        Teclas = j.Teclas != null ? new List<TeclaDoEvento>(j.Teclas) : null,
                    },
                    Alvo = arena.Evento.Alvo,
                    Estilo = arena.Evento.Estilo,
                };
            }
            return copia;
        }

        private static EstadoNaMasmorra Masmorra(Luta l)
        {
            if (l.Estado.MapMode != "dungeon") throw new EngineError("a luta só acontece na masmorra", "Error");
            return (EstadoNaMasmorra)l.Estado;
        }

        private static DungeonCell Sala(Luta l) => (DungeonCell)Estados.CelulaAtual(Masmorra(l));

        private static CombatMonsterView MonstroNo(Luta l, double indice) => Monsters.View(Sala(l).Monsters[(int)indice]);

        private static JeitoDeLutar JeitoDe(CombatMonsterView monstro) => JeitoDoComportamento(monstro.Behavior);

        /// <summary>O monstro da arena no índice, se o índice for um inteiro dentro da lista (o <c>monstros[i]</c> do TS).</summary>
        private static MonstroNaArena MonstroDaArena(Luta l, double indice)
        {
            if (indice != Math.Floor(indice) || indice < 0 || indice >= l.Arena.Monstros.Count) return null;
            return l.Arena.Monstros[(int)indice];
        }

        /// <summary>O alvo do jogador, se ainda está de pé; senão o primeiro de pé. null, ninguém de pé.</summary>
        private static double? AlvoAtual(Luta l)
        {
            var escolhido = MonstroDaArena(l, l.Arena.Alvo);
            if (escolhido != null && escolhido.Fase != "caido") return escolhido.Indice;
            foreach (var m in l.Arena.Monstros)
                if (m.Fase != "caido") return m.Indice;
            return null;
        }

        /// <summary>De onde, na largura da caixa, sai o golpe do monstro: embaixo do lugar dele no palco.</summary>
        private static double ColunaDe(Luta l, double indice)
        {
            double total = Math.Max(1, l.Arena.Monstros.Count);
            return Math.Truncate(D.LarguraDaCaixa * (2 * indice + 1) / (2 * total));
        }

        /// <summary>Um rumo de comprimento <paramref name="velocidade"/> de (0,0) até (dx, dy), em inteiros.</summary>
        private static (double X, double Y) Rumo(double dx, double dy, double velocidade)
        {
            double comprimento = Math.Sqrt(dx * dx + dy * dy);
            if (comprimento == 0) return (0, velocidade);
            return (Math.Truncate(dx * velocidade / comprimento), Math.Truncate(dy * velocidade / comprimento));
        }

        /// <summary>O círculo de raio <paramref name="raio"/> em (x, y) encosta no coração?</summary>
        private static bool Encosta(Coracao coracao, double x, double y, double raio)
        {
            double dx = coracao.X - x;
            double dy = coracao.Y - y;
            double limite = raio + D.RaioDoCoracao;
            return dx * dx + dy * dy <= limite * limite;
        }

        /// <summary>O círculo de raio <paramref name="raio"/> em (x, y) já saiu inteiro da caixa?</summary>
        private static bool ForaDaCaixa(double x, double y, double raio) =>
            x < -raio || x > D.LarguraDaCaixa + raio || y < -raio || y > D.AlturaDaCaixa + raio;

        private static void Contar(Luta l, Acontecimento acontecimento) => l.Acontecimentos.Add(acontecimento);

        private static void Diario(Luta l, IEnumerable<string> linhas)
        {
            foreach (var texto in linhas) Contar(l, new Acontecimento { Tipo = "diario", Texto = texto });
        }

        private static Acontecimento Numero(string onde, double indice, string texto, string tom) =>
            new Acontecimento { Tipo = "numero", Onde = onde, Indice = indice, Texto = texto, Tom = tom };

        private static Acontecimento Som(string som) => new Acontecimento { Tipo = "som", Som = som };

        private static Acontecimento Aviso(string texto) => new Acontecimento { Tipo = "aviso", Texto = texto };

        // ---------- o ataque do herói ----------

        /// <summary>Tocar num monstro de pé faz dele o alvo. Caído, ou um índice que não existe, não muda nada.</summary>
        private static void Mirar(Luta l, double indice)
        {
            var m = MonstroDaArena(l, indice);
            if (m != null && m.Fase != "caido") l.Arena.Alvo = m.Indice;
        }

        /// <summary>O ataque do botão: o da classe primeiro; o mágico sem mana pro golpe de magia cai pro físico.</summary>
        private static string EstiloDoBotao(Hero hero)
        {
            var ataques = Attack.AtaquesDisponiveis(hero);
            foreach (var a in ataques)
                if (hero.Mp >= a.Custo) return a.Estilo;
            return ataques[ataques.Count - 1].Estilo;
        }

        private static void AbrirEvento(Luta l)
        {
            var alvo = AlvoAtual(l);
            if (alvo == null) return;
            var hero = Masmorra(l).Hero;
            string estilo = EstiloDoBotao(hero);
            var evento = EventosDeArma.EventoDoAtaque(hero, estilo, l.Rng, l.Teclado);
            l.Arena.Evento = new EventoAberto { Evento = evento, Passo = 0, Jogada = new JogadaDoEvento(), Alvo = alvo.Value, Estilo = estilo };
        }

        /// <summary>O evento aberto anda um passo de verdade e lê o que a pessoa fez nele; terminado, o golpe sai.</summary>
        private static void SeguirEvento(Luta l, EntradaDaLuta entrada)
        {
            var aberto = l.Arena.Evento;
            aberto.Passo += 1;
            var evento = aberto.Evento;
            var jogada = aberto.Jogada;
            double passo = aberto.Passo;
            bool tocou = entrada.Tocar == true || entrada.Atacar == true;
            bool pronto = passo >= evento.Duracao;

            switch (evento.Tipo)
            {
                case TiposDeEvento.Barra:
                case TiposDeEvento.Circulo:
                    if (tocou && passo < evento.Duracao)
                    {
                        jogada.Toque = passo;
                        pronto = true;
                    }
                    break;
                case TiposDeEvento.Carga:
                    if (entrada.Soltar == true && passo < evento.Duracao)
                    {
                        jogada.Soltou = passo;
                        pronto = true;
                    }
                    break;
                case TiposDeEvento.Ritmo:
                case TiposDeEvento.ToqueDuplo:
                    if (tocou && passo <= evento.Duracao)
                    {
                        var toques = jogada.Toques != null ? new List<double>(jogada.Toques) : new List<double>();
                        toques.Add(passo);
                        jogada.Toques = toques;
                    }
                    break;
                case TiposDeEvento.Desenho:
                {
                    var traco = jogada.Traco ?? new List<PontoDoTraco>();
                    if (entrada.Dedo != null && passo <= evento.Duracao)
                    {
                        double tamanho = GameData.EventosDeArmaTable.TamanhoDoDesenho;
                        double x = Js.Max(0, Js.Min(tamanho, Math.Truncate(entrada.Dedo.X)));
                        double y = Js.Max(0, Js.Min(tamanho, Math.Truncate(entrada.Dedo.Y)));
                        var ultimo = traco.Count > 0 ? traco[traco.Count - 1] : null;
                        if (ultimo == null || ultimo.X != x || ultimo.Y != y)
                        {
                            var novo = new List<PontoDoTraco>(traco) { new PontoDoTraco { X = x, Y = y, T = passo } };
                            jogada.Traco = novo;
                        }
                    }
                    else if (entrada.Dedo == null && traco.Count > 0)
                    {
                        // Levantou o dedo: o desenho acabou.
                        pronto = true;
                    }
                    break;
                }
                case TiposDeEvento.Letras:
                    if (Js.Truthy(entrada.Tecla) && passo <= evento.Duracao)
                    {
                        var teclas = jogada.Teclas != null ? new List<TeclaDoEvento>(jogada.Teclas) : new List<TeclaDoEvento>();
                        teclas.Add(new TeclaDoEvento { Letra = entrada.Tecla, T = passo });
                        jogada.Teclas = teclas;
                        // Uma tecla na janela da última letra decide ela: não sobra nada pra apertar.
                        var batidas = evento.Notas ?? new List<double>();
                        double ultima = batidas.Count > 0 ? batidas[batidas.Count - 1] : 0;
                        if (passo >= ultima - (evento.Janela ?? 0)) pronto = true;
                    }
                    break;
            }

            if (pronto) Golpear(l);
        }

        /// <summary>
        /// O evento terminou: lê, rola o d20 e o golpe cai no alvo do evento. Se ele caiu enquanto o evento corria
        /// (um companheiro, o veneno), cai no alvo de agora.
        /// </summary>
        private static void Golpear(Luta l)
        {
            var aberto = l.Arena.Evento;
            l.Arena.Evento = null;
            l.Arena.Recarga = D.RecargaDoAtaque;
            var leitura = EventosDeArma.LerEvento(aberto.Evento, aberto.Jogada);
            double dado = 1 + Rng.RandomInt(Attack.LadosDoDano, l.Rng);
            var doEvento = l.Arena.Monstros[(int)aberto.Alvo];
            double? indice = doEvento.Fase != "caido" ? doEvento.Indice : AlvoAtual(l);
            if (indice == null) return;
            AcertarMonstro(l, l.Arena.Monstros[(int)indice.Value], dado, leitura, aberto.Estilo);
        }

        /// <summary>O golpe do herói chega no monstro: a regra do site, com a guarda do defensivo.</summary>
        private static void AcertarMonstro(Luta l, MonstroNaArena alvo, double dado, LeituraDaMira leitura, string estilo)
        {
            var monstro = MonstroNo(l, alvo.Indice);
            var lida = leitura;
            if (JeitoDe(monstro).Guarda == true && alvo.Fase == "descansando" && leitura.Acerto)
            {
                lida = new LeituraDaMira { Acerto = true, Forca = Js.Round(leitura.Forca * 50) / 100, Critico = false };
                Contar(l, Aviso(Js.Str(monstro.Name) + " se protege!"));
            }
            var estado = Masmorra(l);
            var golpe = Attack.ResolverGolpe(estado.Hero, monstro, dado, lida, estilo,
                new ResolveAttackOptions { Rng = l.Rng, PetCriticoBonus = Pets.Bonus(l.Pet).Critico ?? 0 });
            var comHeroi = estado.Clone();
            comHeroi.Hero = golpe.Hero;
            l.Estado = FimDaLuta.GravarMonstro(comHeroi, alvo.Indice, golpe.Monster);

            if (golpe.Outcome == ResolveAttackOutcomes.NoMana)
            {
                Contar(l, Aviso("Mana insuficiente"));
                return;
            }
            if (golpe.Outcome != ResolveAttackOutcomes.Hit)
            {
                Contar(l, Numero("monstro", alvo.Indice, golpe.Outcome == ResolveAttackOutcomes.Dodged ? "Desviou" : "Errou", "erro"));
                Contar(l, Som("miss"));
                return;
            }
            Contar(l, Numero("monstro", alvo.Indice, "-" + Js.NumberToString(golpe.Damage ?? 0), golpe.IsCrit == true ? "critico" : "dano"));
            Contar(l, Som(golpe.IsCrit == true ? "crit" : "hit"));
            if (golpe.MonsterDefeated)
            {
                Abater(l, alvo.Indice, golpe.Monster);
                return;
            }
            AplicarRunasDoGolpe(l, alvo.Indice, golpe.Monster, golpe.Damage ?? 0);
        }

        /// <summary>
        /// TS: aplicarRunasDoGolpe — as runas da arma no golpe que acertou. Só a arena as aplica: no site a arma vale só
        /// pelos atributos. O choque pode derrubar.
        /// </summary>
        private static void AplicarRunasDoGolpe(Luta l, double indice, CombatMonsterView monstro, double dano)
        {
            var estado = Masmorra(l);
            var runas = Runas.AplicarRunas(estado.Hero, monstro, dano, l.Rng);
            if (runas.Disparos.Count == 0) return;
            var comHeroi = (EstadoNaMasmorra)estado.Clone();
            comHeroi.Hero = runas.Hero;
            l.Estado = FimDaLuta.GravarMonstro(comHeroi, indice, runas.Monster);
            foreach (var disparo in runas.Disparos)
            {
                string icone = Runas.IconeDe(disparo.Runa);
                if (disparo.Runa == "vampirica")
                {
                    if (disparo.Valor > 0) Contar(l, Numero("heroi", 0, icone + "+" + Js.NumberToString(disparo.Valor), "cura"));
                }
                else if (disparo.Runa == "eletrica")
                {
                    Contar(l, Numero("monstro", indice, icone + "-" + Js.NumberToString(disparo.Valor), "dano"));
                }
                else
                {
                    // Queimar e gelar só marcam o monstro, como o 💫 e o 🐌: sem dano agora, ele não treme.
                    Contar(l, Numero("monstro", indice, icone, "erro"));
                }
            }
            if (runas.Monster.Hp <= 0) Abater(l, indice, runas.Monster);
        }

        // ---------- poderes e itens ----------

        private static void UsarPoder(Luta l, string id)
        {
            var estado = Masmorra(l);
            PowerDef poder = null;
            foreach (var p in Heroes.HeroPowers(estado.Hero))
            {
                if (p.Id == id)
                {
                    poder = p;
                    break;
                }
            }
            if (poder == null || (l.Arena.RecargaDosPoderes.TryGet(id, out var falta) ? falta : 0) > 0) return;
            var alvo = AlvoAtual(l);
            if (alvo == null) return;

            var bonus = Pets.Bonus(l.Pet);
            var monstro = MonstroNo(l, alvo.Value);
            var uso = UsePower.CastPower(estado.Hero, estado.Party, monstro, poder,
                new UsePowerOptions { Rng = l.Rng, PetCuraBonus = bonus.Healing ?? 0, PetManaSaveChance = bonus.ManaSave ?? 0 });
            if (uso.Outcome == UsePowerOutcomes.NoMana)
            {
                Contar(l, Aviso("Mana insuficiente para " + poder.Name));
                return;
            }
            if (uso.Outcome == UsePowerOutcomes.SummonFull)
            {
                Contar(l, Aviso("Seus " + Js.NumberToString(Invocacao.MaxEsqueletos) + " esqueletos já estão de pé"));
                return;
            }
            l.Arena.RecargaDosPoderes.Set(id, D.RecargaDoPoder);
            var comUso = estado.Clone();
            comUso.Hero = uso.Hero;
            comUso.Party = uso.Party;
            l.Estado = FimDaLuta.GravarMonstro(comUso, alvo.Value, uso.Monster);

            if (uso.Outcome == UsePowerOutcomes.Damage)
            {
                Contar(l, Numero("monstro", alvo.Value, poder.Icon + " -" + Js.NumberToString(uso.Damage ?? 0), "critico"));
                Contar(l, Som("crit"));
            }
            else if (uso.Outcome == UsePowerOutcomes.Heal)
            {
                Contar(l, Numero("heroi", 0, "+" + Js.NumberToString(uso.Healed ?? 0), "cura"));
                Contar(l, Som("heal"));
            }
            else if (uso.Outcome == UsePowerOutcomes.Summon)
            {
                // O esqueleto entra no fim da equipe e começa a bater no tempo dele, como os companheiros da entrada.
                l.Arena.Companheiros.Add(new CompanheiroNaArena { Indice = uso.Party.Count - 1, Tempo = D.CadenciaDoCompanheiro / 2 });
                Contar(l, Aviso(poder.Icon + " " + (uso.Summoned?.Name ?? "Esqueleto") + " se ergue"));
            }
            else
            {
                Contar(l, Aviso(poder.Icon + " " + poder.Name));
            }
            if (Js.Truthy(uso.Healed) && uso.Outcome == UsePowerOutcomes.Damage) Contar(l, Numero("heroi", 0, "+" + Js.NumberToString(uso.Healed.Value), "cura"));
            if (uso.MonsterDefeated) Abater(l, alvo.Value, uso.Monster);
        }

        private static void UsarItem(Luta l, string uid)
        {
            var estado = Masmorra(l);
            Item item = null;
            foreach (var atual in estado.Inventory)
            {
                if (atual.Uid == uid)
                {
                    item = atual;
                    break;
                }
            }
            if (item == null || !Mochilas.PodeUsar(item) || l.Arena.RecargaDoItem > 0) return;
            var usado = Mochilas.Usar(new Mochila { Estado = estado, Log = new List<string>() }, item);
            if (usado.Estado.MapMode != "dungeon") return;
            l.Arena.RecargaDoItem = D.RecargaDoItem;
            double cura = usado.Estado.Hero.Hp - estado.Hero.Hp;
            l.Estado = usado.Estado;
            Diario(l, usado.Log);
            if (cura > 0) Contar(l, Numero("heroi", 0, "+" + Js.NumberToString(cura), "cura"));
            Contar(l, Som("heal"));
        }

        // ---------- o mundo ----------

        /// <summary>O coração anda como o herói na sala: a diagonal não é mais rápida que o reto. A parede da caixa segura.</summary>
        private static Coracao MoverCoracao(Coracao coracao, EntradaDaLuta entrada)
        {
            double ix = Math.Truncate(entrada.X);
            double iy = Math.Truncate(entrada.Y);
            double quadrado = ix * ix + iy * iy;
            if (quadrado > RoomWalk.StickMax * RoomWalk.StickMax)
            {
                double comprimento = Math.Sqrt(quadrado);
                ix = Math.Truncate(ix * RoomWalk.StickMax / comprimento);
                iy = Math.Truncate(iy * RoomWalk.StickMax / comprimento);
            }
            double x = coracao.X + Math.Truncate(ix * D.VelocidadeDoCoracao / RoomWalk.StickMax);
            double y = coracao.Y + Math.Truncate(iy * D.VelocidadeDoCoracao / RoomWalk.StickMax);
            return new Coracao
            {
                X = Js.Max(D.RaioDoCoracao, Js.Min(D.LarguraDaCaixa - D.RaioDoCoracao, x)),
                Y = Js.Max(D.RaioDoCoracao, Js.Min(D.AlturaDaCaixa - D.RaioDoCoracao, y)),
            };
        }

        private static void PassoDoMundo(Luta l, EntradaDaLuta entrada)
        {
            var arena = l.Arena;
            arena.Passo += 1;
            arena.Coracao = MoverCoracao(arena.Coracao, entrada);
            if (arena.Recarga > 0) arena.Recarga -= 1;
            if (arena.RecargaDoItem > 0) arena.RecargaDoItem -= 1;
            if (arena.Intervalo > 0) arena.Intervalo -= 1;
            foreach (var id in new List<string>(arena.RecargaDosPoderes.Keys))
            {
                double falta = arena.RecargaDosPoderes.Get(id) - 1;
                if (falta > 0) arena.RecargaDosPoderes.Set(id, falta);
                else arena.RecargaDosPoderes.Remove(id);
            }

            foreach (var m in arena.Monstros)
            {
                if (l.Fim != null) return;
                if (m.Fase != "caido") AgirMonstro(l, m);
            }
            if (l.Fim != null) return;
            if (PodeGolpear(l))
            {
                var proximo = ProximoDaVez(l);
                if (proximo != null) ComecarGolpe(l, proximo);
            }
            foreach (var c in arena.Companheiros)
            {
                if (l.Fim != null) return;
                AgirCompanheiro(l, c);
            }
            MoverTiros(l);
            if (l.Fim != null) return;

            arena.Rodada -= 1;
            if (arena.Rodada <= 0)
            {
                arena.Rodada = D.Rodada;
                RodadaDaLuta(l);
            }
        }

        private static void AgirMonstro(Luta l, MonstroNaArena m)
        {
            var jeito = JeitoDe(MonstroNo(l, m.Indice));
            switch (m.Fase)
            {
                case "esperando":
                    return;
                case "avisando":
                    m.Tempo -= 1;
                    if (m.Tempo <= 0) SoltarGolpe(l, m, jeito);
                    return;
                case "investindo":
                    Investir(l, m, jeito);
                    return;
                default:
                    // Descansando, atordoado, hesitando: parado até o tempo acabar.
                    m.Tempo -= 1;
                    if (m.Tempo <= 0)
                    {
                        m.Fase = "esperando";
                        m.Tempo = 0;
                    }
                    return;
            }
        }

        /// <summary>Há vaga pra mais um golpe começar: menos de ATACANDO_DE_UMA_VEZ golpeando e o respiro passado.</summary>
        private static bool PodeGolpear(Luta l)
        {
            if (l.Arena.Intervalo > 0) return false;
            int golpeando = 0;
            foreach (var m in l.Arena.Monstros)
                if (m.Fase == "avisando" || m.Fase == "investindo") golpeando++;
            return golpeando < D.AtacandoDeUmaVez;
        }

        /// <summary>O próximo da vez: depois de quem golpeou por último, o primeiro esperando, dando a volta.</summary>
        private static MonstroNaArena ProximoDaVez(Luta l)
        {
            var monstros = l.Arena.Monstros;
            int n = monstros.Count;
            for (int k = 1; k <= n; k++)
            {
                var m = monstros[(int)((l.Arena.Vez + k + n) % n)];
                if (m.Fase == "esperando") return m;
            }
            return null;
        }

        /// <summary>
        /// O monstro tenta golpear: atordoado ou lento demais, perde o golpe; senão sorteia em quem cai, como no
        /// site, e o aviso começa. Golpe no herói trava o desenho na caixa (o círculo e a investida miram onde o
        /// coração está agora). Perder a vez também é a vez: o respiro do próximo começa igual.
        /// </summary>
        private static void ComecarGolpe(Luta l, MonstroNaArena m)
        {
            var estado = Masmorra(l);
            var monstro = MonstroNo(l, m.Indice);
            var jeito = JeitoDe(monstro);
            var inicio = MonsterHit.StartMonsterAttack(monstro, estado.Hero, l.Rng);
            var comHeroi = estado.Clone();
            comHeroi.Hero = inicio.Hero;
            l.Estado = FimDaLuta.GravarMonstro(comHeroi, m.Indice, inicio.Monster);
            l.Arena.Vez = m.Indice;
            if (inicio.Outcome == MonsterAttackStart.Stunned)
            {
                m.Fase = "atordoado";
                m.Tempo = D.TempoAtordoado;
                l.Arena.Intervalo = D.IntervaloEntreGolpes;
                Contar(l, Numero("monstro", m.Indice, "💫", "erro"));
                return;
            }
            if (inicio.Outcome == MonsterAttackStart.LentoSkip)
            {
                m.Fase = "hesitando";
                m.Tempo = D.TempoHesitando;
                l.Arena.Intervalo = D.IntervaloEntreGolpes;
                Contar(l, Numero("monstro", m.Indice, "🐌", "erro"));
                return;
            }
            if (inicio.RageTriggered) Contar(l, Aviso(Js.Str(monstro.Name) + " fica furioso!"));

            m.Fase = "avisando";
            m.Tempo = jeito.Aviso;
            m.Forca = inicio.AttackMult;
            m.Alvo = MonsterHit.PickMonsterTarget(Masmorra(l).Party ?? new List<Companion>(), l.Rng) ?? -1;
            m.RumoX = 0;
            m.RumoY = 0;
            if (m.Alvo >= 0)
            {
                // No companheiro: fora da caixa, cai como no site quando o aviso acaba.
                m.X = 0;
                m.Y = 0;
                return;
            }
            var coracao = l.Arena.Coracao;
            if (jeito.Golpe == "perto")
            {
                m.X = coracao.X;
                m.Y = coracao.Y;
                return;
            }
            // A investida e o tiro saem de cima da caixa, embaixo do monstro, inteiros pra fora.
            m.X = ColunaDe(l, m.Indice);
            m.Y = -jeito.Tamanho;
            if (jeito.Golpe == "investida")
            {
                var r = Rumo(coracao.X - m.X, coracao.Y - m.Y, jeito.Velocidade);
                m.RumoX = r.X;
                m.RumoY = r.Y;
            }
        }

        /// <summary>O aviso acabou: o golpe sai.</summary>
        private static void SoltarGolpe(Luta l, MonstroNaArena m, JeitoDeLutar jeito)
        {
            if (m.Alvo >= 0)
            {
                GolpeNoCompanheiro(l, m, m.Alvo);
                Descansar(l, m, jeito);
                return;
            }
            if (jeito.Golpe == "investida")
            {
                m.Fase = "investindo";
                Investir(l, m, jeito);
                return;
            }
            if (jeito.Golpe == "tiro")
            {
                // A bola mira onde o coração está agora, no fim do aviso.
                var coracao = l.Arena.Coracao;
                var v = Rumo(coracao.X - m.X, coracao.Y - m.Y, jeito.Velocidade);
                l.Arena.Tiros.Add(new Tiro { X = m.X, Y = m.Y, Vx = v.X, Vy = v.Y, Raio = jeito.Tamanho, Vida = D.VidaDoTiro, Indice = m.Indice, Forca = m.Forca });
                Descansar(l, m, jeito);
                return;
            }
            if (Encosta(l.Arena.Coracao, m.X, m.Y, jeito.Tamanho)) GolpeNoHeroi(l, m.Indice, m.Forca);
            else Contar(l, Numero("monstro", m.Indice, "Errou", "erro"));
            Descansar(l, m, jeito);
        }

        /// <summary>O golpe acabou: o monstro descansa, e o próximo golpe espera o respiro.</summary>
        private static void Descansar(Luta l, MonstroNaArena m, JeitoDeLutar jeito)
        {
            if (l.Fim != null) return;
            m.Fase = "descansando";
            m.Tempo = jeito.Descanso;
            l.Arena.Intervalo = D.IntervaloEntreGolpes;
        }

        /// <summary>A investida mergulha pelo rumo travado: encostou no coração, pega e para; saiu da caixa, acabou.</summary>
        private static void Investir(Luta l, MonstroNaArena m, JeitoDeLutar jeito)
        {
            m.X += m.RumoX;
            m.Y += m.RumoY;
            if (Encosta(l.Arena.Coracao, m.X, m.Y, jeito.Tamanho))
            {
                GolpeNoHeroi(l, m.Indice, m.Forca);
                Descansar(l, m, jeito);
                return;
            }
            if (ForaDaCaixa(m.X, m.Y, jeito.Tamanho))
            {
                Contar(l, Numero("monstro", m.Indice, "Errou", "erro"));
                Descansar(l, m, jeito);
            }
        }

        /// <summary>
        /// O golpe do monstro pegou no coração: a regra do site, com a esquiva de sempre, mais a armadura encantada (que só
        /// a arena aplica) e o escudo do vigor, que apanha antes da vida.
        /// </summary>
        private static void GolpeNoHeroi(Luta l, double indice, double forca)
        {
            var estado = Masmorra(l);
            var monstro = MonstroNo(l, indice);
            var golpe = MonsterHit.LandHitOnHero(estado.Hero, monstro, forca, l.Rng, Pets.Bonus(l.Pet).Esquiva ?? 0, Encantamentos.DefesasDoHeroi(estado.Hero));
            if (golpe.Dodged)
            {
                var desviou = estado.Clone();
                desviou.Hero = golpe.Hero;
                l.Estado = FimDaLuta.GravarMonstro(desviou, indice, golpe.Monster);
                Contar(l, Numero("heroi", 0, "Desviou", "erro"));
                Contar(l, Som("miss"));
                return;
            }
            var hero = NoEscudo(l, estado.Hero.Hp, golpe.Hero, golpe.Damage);
            var comHeroi = estado.Clone();
            comHeroi.Hero = hero;
            l.Estado = FimDaLuta.GravarMonstro(comHeroi, indice, golpe.Monster);
            Contar(l, Som("hit"));
            if (golpe.ManaDrained > 0) Contar(l, Aviso(Js.Str(monstro.Name) + " drena " + Js.NumberToString(golpe.ManaDrained) + " de mana"));
            if (golpe.DrainResisted == true) Contar(l, Aviso("Sua armadura segura o dreno de mana"));
            if (golpe.PoisonApplied) Contar(l, Aviso("Você foi envenenado"));
            if (golpe.PoisonResisted == true) Contar(l, Aviso("Sua armadura segura o veneno"));
            if (hero.Hp <= 0) Perder(l);
        }

        /// <summary>
        /// O dano no herói passa primeiro pelo escudo do vigor: ele aguenta o que tiver, e a vida perde só o resto. Conta
        /// os números (o do escudo no tom dele) e devolve o herói com a vida certa. Sem escudo, é o dano de sempre.
        /// </summary>
        private static Hero NoEscudo(Luta l, double vidaAntes, Hero hero, double dano)
        {
            double escudo = l.Arena.Escudo ?? 0;
            double absorvido = Js.Min(escudo, dano);
            if (absorvido <= 0)
            {
                Contar(l, Numero("heroi", 0, "-" + Js.NumberToString(dano), "dano"));
                return hero;
            }
            l.Arena.Escudo = escudo - absorvido;
            Contar(l, Numero("heroi", 0, "💪-" + Js.NumberToString(absorvido), "escudo"));
            double resto = dano - absorvido;
            if (resto > 0) Contar(l, Numero("heroi", 0, "-" + Js.NumberToString(resto), "dano"));
            var comVida = hero.Clone();
            comVida.Hp = Js.Max(0, vidaAntes - resto);
            return comVida;
        }

        /// <summary>O golpe do monstro cai no companheiro <paramref name="alvo"/>, como no site. Se ele já caiu, o golpe vai no vazio.</summary>
        private static void GolpeNoCompanheiro(Luta l, MonstroNaArena m, double alvo)
        {
            var estado = Masmorra(l);
            var equipe = estado.Party ?? new List<Companion>();
            int indice = (int)alvo;
            var membro = indice >= 0 && indice < equipe.Count ? equipe[indice] : null;
            if (membro == null || membro.Hp <= 0)
            {
                Contar(l, Numero("monstro", m.Indice, "Errou", "erro"));
                return;
            }
            var acerto = MonsterHit.HitPartyMember(membro, MonstroNo(l, m.Indice), m.Forca, l.Rng);
            var novaEquipe = new List<Companion>(equipe.Count);
            for (int i = 0; i < equipe.Count; i++) novaEquipe.Add(i == indice ? acerto.Member : equipe[i]);
            var comEquipe = estado.Clone();
            comEquipe.Party = novaEquipe;
            l.Estado = comEquipe;
            Contar(l, Numero("companheiro", alvo, "-" + Js.NumberToString(acerto.Damage), "dano"));
            Contar(l, Som("hit"));
            if (acerto.Defeated) Diario(l, new[] { Js.Str(membro.Name) + " caiu!" });
        }

        /// <summary>O companheiro bate no alvo do jogador, no tempo dele.</summary>
        private static void AgirCompanheiro(Luta l, CompanheiroNaArena c)
        {
            var estado = Masmorra(l);
            var equipe = estado.Party ?? new List<Companion>();
            int i = (int)c.Indice;
            if (i >= equipe.Count || equipe[i].Hp <= 0) return;
            var membro = equipe[i];
            if (c.Tempo > 0) c.Tempo -= 1;
            if (c.Tempo > 0) return;
            var alvo = AlvoAtual(l);
            if (alvo == null) return;
            c.Tempo = D.CadenciaDoCompanheiro;
            var monstro = MonstroNo(l, alvo.Value);
            var acao = Party.PartyMemberAct(estado.Hero, membro, monstro, l.Rng);
            var comHeroi = estado.Clone();
            comHeroi.Hero = acao.Hero;
            l.Estado = FimDaLuta.GravarMonstro(comHeroi, alvo.Value, acao.Monster);
            var resultado = acao.Outcome;
            if (resultado.Kind == PartyOutcomeKinds.HealedHero)
            {
                Contar(l, Numero("heroi", 0, "+" + Js.NumberToString(resultado.Amount ?? 0), "cura"));
            }
            else if (resultado.Kind == PartyOutcomeKinds.Miss)
            {
                Contar(l, Numero("monstro", alvo.Value, "Errou", "erro"));
            }
            else
            {
                Contar(l, Numero("monstro", alvo.Value, "-" + Js.NumberToString(resultado.Amount ?? 0), "dano"));
                if (acao.Monster.Hp <= 0) Abater(l, alvo.Value, Monsters.View(acao.Monster));
            }
        }

        /// <summary>As bolas voam; a que encosta no coração pega, a que sai da caixa (ou acaba) errou.</summary>
        private static void MoverTiros(Luta l)
        {
            var ficam = new List<Tiro>();
            foreach (var t in l.Arena.Tiros)
            {
                if (l.Fim != null) break;
                t.X += t.Vx;
                t.Y += t.Vy;
                t.Vida -= 1;
                if (t.Vida <= 0 || ForaDaCaixa(t.X, t.Y, t.Raio))
                {
                    Contar(l, Numero("monstro", t.Indice, "Errou", "erro"));
                    continue;
                }
                if (Encosta(l.Arena.Coracao, t.X, t.Y, t.Raio))
                {
                    GolpeNoHeroi(l, t.Indice, t.Forca);
                    continue;
                }
                ficam.Add(t);
            }
            l.Arena.Tiros = ficam;
        }

        /// <summary>A rodada: o veneno do herói, o dano contínuo de cada monstro de pé e a Canção de Batalha.</summary>
        private static void RodadaDaLuta(Luta l)
        {
            var antes = Masmorra(l).Hero;
            var veneno = HeroStatus.TickHeroStatus(antes);
            // O veneno também passa primeiro pelo escudo do vigor.
            var heroi = veneno.Damage > 0 ? NoEscudo(l, antes.Hp, veneno.Hero, veneno.Damage) : veneno.Hero;
            var comVeneno = Masmorra(l).Clone();
            comVeneno.Hero = heroi;
            l.Estado = comVeneno;
            if (heroi.Hp <= 0)
            {
                Diario(l, new[] { "O veneno foi mais forte." });
                Perder(l);
                return;
            }

            foreach (var indice in FimDaLuta.IndicesDePe(Sala(l)))
            {
                var monstro = MonstroNo(l, indice);
                var dot = StatusEffects.TickMonsterDot(monstro);
                l.Estado = FimDaLuta.GravarMonstro(Masmorra(l), indice, dot.Monster);
                if (dot.Damage > 0) Contar(l, Numero("monstro", indice, "-" + Js.NumberToString(dot.Damage), "dano"));
                if (dot.Defeated) Abater(l, indice, Monsters.View(dot.Monster));
                if (l.Fim != null) return;
            }

            var comCancao = Masmorra(l).Clone();
            comCancao.Hero = Party.PassarRodadaDaCancao(comCancao.Hero);
            l.Estado = comCancao;
        }

        // ---------- quem cai ----------

        /// <summary>
        /// O monstro caiu: é pago, e o alvo passa pro primeiro de pé; foi o último, a sala está limpa e a luta
        /// acaba em vitória.
        /// </summary>
        private static void Abater(Luta l, double indice, CombatMonsterView abatido)
        {
            int i = (int)indice;
            if (i >= 0 && i < l.Arena.Monstros.Count) l.Arena.Monstros[i].Fase = "caido";
            var pago = FimDaLuta.PagarAbate(Masmorra(l), abatido);
            l.Estado = pago.Estado;
            Diario(l, pago.Log);
            var dePe = FimDaLuta.IndicesDePe(Sala(l));
            if (dePe.Count > 0)
            {
                if (!dePe.Contains(l.Arena.Alvo)) l.Arena.Alvo = dePe[0];
                return;
            }

            // A arena só existe no app: o item achado pode vir com material.
            var limpa = FimDaLuta.LimparSala(Masmorra(l), abatido, l.Rng, l.Now, true);
            l.Estado = limpa.Estado;
            l.Loot = limpa.Loot;
            l.Fim = "vitoria";
            l.Arena.Evento = null;
            l.Arena.Tiros = new List<Tiro>();
            Diario(l, limpa.Log);
            Contar(l, Som("victory"));
        }

        private static void Perder(Luta l)
        {
            var perdida = FimDaLuta.PerderLuta(Masmorra(l), l.Rng);
            l.Estado = perdida.Estado;
            l.Fim = "derrota";
            l.Arena.Evento = null;
            l.Arena.Tiros = new List<Tiro>();
            Diario(l, perdida.Log);
            Contar(l, Som("defeat"));
        }

        // ---------- pra tela ----------

        /// <summary>TS: eventoDoBotao — o evento que o botão de ataque abriria agora, sem sortear nada.</summary>
        public static string EventoDoBotao(Hero hero, bool teclado = false) => EventosDeArma.EventoDaArma(hero.Equip.Get("arma")?.TemplateId, teclado);
    }
}
