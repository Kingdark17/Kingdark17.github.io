using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: JeitoDeLutar — o jeito de lutar de um comportamento de monstro.</summary>
    public sealed class JeitoDeLutar
    {
        /// <summary>Por passo, andando: no máximo a velocidade do herói.</summary>
        public double Velocidade;
        /// <summary>A distância do herói em que ele para e ataca (o mágico mantém ela).</summary>
        public double Distancia;
        /// <summary>Quanto dura o aviso antes do golpe.</summary>
        public double Aviso;
        /// <summary>"perto", "investida" ou "tiro".</summary>
        public string Golpe;
        /// <summary>Perto: até onde o golpe chega. Investida: o quanto ela corre.</summary>
        public double Alcance;
        /// <summary>Parado depois do golpe.</summary>
        public double Descanso;
        /// <summary>Descansando, ele se protege: o golpe do herói chega com metade da força.</summary>
        public bool? Guarda;
    }

    /// <summary>TS: MonstroNaArena. Fase: "andando", "avisando", "investindo", "descansando", "atordoado", "hesitando" ou "caido".</summary>
    public sealed class MonstroNaArena
    {
        public double Indice;
        public double X;
        public double Y;
        public string Fase;
        public double Tempo;
        public double Forca;
        public double RumoX;
        public double RumoY;
        public double Restante;

        public MonstroNaArena Clone() => (MonstroNaArena)MemberwiseClone();
    }

    /// <summary>TS: CompanheiroNaArena.</summary>
    public sealed class CompanheiroNaArena
    {
        public double Indice;
        public double X;
        public double Y;
        public double Tempo;

        public CompanheiroNaArena Clone() => (CompanheiroNaArena)MemberwiseClone();
    }

    /// <summary>TS: Tiro. <see cref="De"/> é "heroi" ou "monstro".</summary>
    public sealed class Tiro
    {
        public string De;
        public double X;
        public double Y;
        public double Vx;
        public double Vy;
        public double Vida;
        public double Indice;
        public double Forca;
        public double? Dado;
        public LeituraDaMira Leitura;
        public string Estilo;

        public Tiro Clone() => (Tiro)MemberwiseClone();
    }

    /// <summary>TS: EventoAberto — o evento da arma em curso.</summary>
    public sealed class EventoAberto
    {
        public EventoDeArma Evento;
        public double Passo;
        public JogadaDoEvento Jogada;
        public double Alvo;
        public string Estilo;
        public bool Tiro;
    }

    /// <summary>TS: Arena — tudo o que a luta em tempo real tem dentro da sala.</summary>
    public sealed class Arena
    {
        public double Passo;
        public double Lento;
        public Walker Heroi;
        public List<MonstroNaArena> Monstros;
        public List<CompanheiroNaArena> Companheiros;
        public List<Tiro> Tiros;
        [KeepNull] public EventoAberto Evento;
        public double Recarga;
        public OrderedMap<double> RecargaDosPoderes;
        public double RecargaDoItem;
        public double Rodada;
        public double Intervalo;
    }

    /// <summary>TS: LutaEmTempoReal. Fim: null, "vitoria" ou "derrota".</summary>
    public class LutaEmTempoReal
    {
        public EstadoDoJogo Estado;
        public Arena Arena;
        [KeepNull] public string Pet;
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
        public bool? Atacar;
        public bool? Soltar;
        public bool? Tocar;
        public DedoNoDesenho Dedo;
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
        [JsName("ALCANCE_CORPO_A_CORPO")] public double AlcanceCorpoACorpo;
        [JsName("ALCANCE_DO_GOLPE")] public double AlcanceDoGolpe;
        [JsName("VELOCIDADE_DO_TIRO")] public double VelocidadeDoTiro;
        [JsName("VELOCIDADE_DO_TIRO_DO_MONSTRO")] public double VelocidadeDoTiroDoMonstro;
        [JsName("RAIO_DO_TIRO")] public double RaioDoTiro;
        [JsName("VIDA_DO_TIRO")] public double VidaDoTiro;
        [JsName("CONTATO")] public double Contato;
        [JsName("TEMPO_ATORDOADO")] public double TempoAtordoado;
        [JsName("TEMPO_HESITANDO")] public double TempoHesitando;
        [JsName("ESPERA_INICIAL")] public double EsperaInicial;
        [JsName("ESPERA_POR_MONSTRO")] public double EsperaPorMonstro;
        [JsName("ATACANDO_DE_UMA_VEZ")] public double AtacandoDeUmaVez;
        [JsName("INTERVALO_ENTRE_GOLPES")] public double IntervaloEntreGolpes;
        [JsName("CADENCIA_DO_COMPANHEIRO")] public double CadenciaDoCompanheiro;
        [JsName("VELOCIDADE_DO_COMPANHEIRO")] public double VelocidadeDoCompanheiro;
        [JsName("JEITOS_DE_LUTAR")] public OrderedMap<JeitoDeLutar> JeitosDeLutar = new OrderedMap<JeitoDeLutar>();
        [JsName("LUGAR_DO_COMPANHEIRO")] public List<List<double>> LugarDoCompanheiro;
        [JsName("POSICOES_INICIAIS")] public List<List<List<double>>> PosicoesIniciais;
    }

    public static partial class GameData
    {
        private static ArenaData _arenaTable;

        /// <summary>luta/arena: os tempos, os alcances e os jeitos de lutar da luta em tempo real.</summary>
        public static ArenaData ArenaTable
        {
            get => Require(_arenaTable, "luta/arena");
            set => _arenaTable = value;
        }
    }

    /// <summary>
    /// Port de shared/src/luta/arena.ts: a luta em tempo real do app, dentro da sala. O herói anda como no resto
    /// da sala, com as portas trancadas; o botão de ataque mira o mais perto e abre o evento da arma em câmera
    /// lenta; cada comportamento de monstro luta do seu jeito, com aviso antes de todo golpe; poderes e itens são
    /// botões com espera; os companheiros lutam sozinhos. A recompensa é a do site (FimDaLuta). Tudo em passos e
    /// unidades inteiras; o sorteio atravessa a luta inteira.
    /// </summary>
    public static class Arenas
    {
        private static ArenaData D => GameData.ArenaTable;

        /// <summary>TS: VELOCIDADE_DA_INVESTIDA — dois passos de herói (é conta com o HERO_SPEED, não tabela).</summary>
        public static double VelocidadeDaInvestida => 2 * RoomWalk.HeroSpeed;

        public static double Lentidao => D.Lentidao;
        public static double Rodada => D.Rodada;

        /// <summary>A luta enquanto o passo corre: a mesma, mais o sorteio, o relógio e o que vai pra tela.</summary>
        private sealed class Luta
        {
            public EstadoDoJogo Estado;
            public Arena Arena;
            public string Pet;
            public string Fim;
            public Item Loot;
            public RngFn Rng;
            public Func<double> Now;
            public List<Acontecimento> Acontecimentos = new List<Acontecimento>();
        }

        // ---------- abrir ----------

        /// <summary>A sala trancada: parede em volta, sem porta e sem objeto.</summary>
        private static RoomLayout PlantaFechada() => RoomWalk.Layout(new DoorMap(), new List<RoomObject>());

        private static double Centro(double quadrado) => quadrado * RoomWalk.TileUnits + RoomWalk.TileUnits / 2;

        /// <summary>
        /// TS: abrirLuta — prepara os monstros e o herói (<see cref="FimDaLuta.PrepararLuta"/>), põe os monstros
        /// de pé nos lugares do grupo e os companheiros vivos em volta do herói, que chega em
        /// <paramref name="chegada"/>. Os monstros esperam um pouco antes do primeiro golpe, um depois do outro.
        /// </summary>
        public static QuadroDaLuta AbrirLuta(EstadoNaMasmorra estado, Walker chegada, string pet = null)
        {
            var preparada = FimDaLuta.PrepararLuta(estado);
            var sala = (DungeonCell)Estados.CelulaAtual(preparada.Estado);
            var dePe = FimDaLuta.IndicesDePe(sala);
            int qual = Math.Min(dePe.Count, D.PosicoesIniciais.Count) - 1;
            var lugares = qual >= 0 ? D.PosicoesIniciais[qual] : new List<List<double>>();

            var monstros = new List<MonstroNaArena>();
            int total = sala.Monsters?.Count ?? 0;
            for (int indice = 0; indice < total; indice++)
            {
                int ordem = dePe.IndexOf(indice);
                double col, row;
                if (ordem >= 0 && ordem < lugares.Count)
                {
                    col = lugares[ordem][0];
                    row = lugares[ordem][1];
                }
                else
                {
                    // O `% 5` do JS com negativo dá negativo, como o do C#.
                    col = 2 + (ordem % 5);
                    row = 2 + Math.Floor(ordem / 5.0);
                }
                monstros.Add(new MonstroNaArena
                {
                    Indice = indice,
                    X = Centro(col),
                    Y = Centro(row),
                    Fase = ordem < 0 ? "caido" : "andando",
                    Tempo = ordem < 0 ? 0 : D.EsperaInicial + ordem * D.EsperaPorMonstro,
                    Forca = 1,
                    RumoX = 0,
                    RumoY = 0,
                    Restante = 0,
                });
            }

            var companheiros = new List<CompanheiroNaArena>();
            var equipe = ((EstadoNaMasmorra)preparada.Estado).Party ?? new List<Companion>();
            for (int indice = 0; indice < equipe.Count; indice++)
            {
                if (equipe[indice].Hp <= 0) continue;
                // Em volta do herói, um quadrado ao lado; dentro do chão.
                var lugar = D.LugarDoCompanheiro[companheiros.Count % D.LugarDoCompanheiro.Count];
                companheiros.Add(new CompanheiroNaArena
                {
                    Indice = indice,
                    X = DentroDoChao(chegada.X + lugar[0] * RoomWalk.TileUnits, RoomWalk.RoomCols),
                    Y = DentroDoChao(chegada.Y + lugar[1] * RoomWalk.TileUnits, RoomWalk.RoomRows),
                    Tempo = D.CadenciaDoCompanheiro / 2 + indice * 10,
                });
            }

            var arena = new Arena
            {
                Passo = 0,
                Lento = 0,
                Heroi = new Walker { X = chegada.X, Y = chegada.Y, Facing = chegada.Facing },
                Monstros = monstros,
                Companheiros = companheiros,
                Tiros = new List<Tiro>(),
                Evento = null,
                Recarga = 0,
                RecargaDosPoderes = new OrderedMap<double>(),
                RecargaDoItem = 0,
                Rodada = D.Rodada,
                Intervalo = 0,
            };
            var acontecimentos = new List<Acontecimento>();
            foreach (var texto in preparada.Log) acontecimentos.Add(new Acontecimento { Tipo = "diario", Texto = texto });
            return new QuadroDaLuta
            {
                Luta = new LutaEmTempoReal { Estado = preparada.Estado, Arena = arena, Pet = pet, Fim = null, Loot = null },
                Acontecimentos = acontecimentos,
            };
        }

        /// <summary>Uma coordenada dentro do chão da sala, com a base inteira longe da parede.</summary>
        private static double DentroDoChao(double valor, double quadrados) =>
            Js.Max(RoomWalk.TileUnits + RoomWalk.HeroHalf, Js.Min((quadrados - 1) * RoomWalk.TileUnits - RoomWalk.HeroHalf, valor));

        // ---------- o passo ----------

        /// <summary>
        /// TS: passoDaLuta — um passo da luta. O evento da arma corre em tempo de verdade; o mundo (herói, monstros,
        /// companheiros, tiros, rodada) anda um passo, ou, em câmera lenta, um a cada LENTIDAO.
        /// <paramref name="now"/> é o relógio do uid do item que cai ao vencer (e do andar novo, se foi chefe).
        /// </summary>
        public static QuadroDaLuta PassoDaLuta(LutaEmTempoReal luta, EntradaDaLuta entrada, RngFn rng, Func<double> now = null)
        {
            if (luta.Fim != null) return new QuadroDaLuta { Luta = luta, Acontecimentos = new List<Acontecimento>() };
            var l = new Luta { Estado = luta.Estado, Arena = CopiarArena(luta.Arena), Pet = luta.Pet, Fim = luta.Fim, Loot = luta.Loot, Rng = rng, Now = now };

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
                Luta = new LutaEmTempoReal { Estado = l.Estado, Arena = l.Arena, Pet = l.Pet, Fim = l.Fim, Loot = l.Loot },
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
                Heroi = new Walker { X = arena.Heroi.X, Y = arena.Heroi.Y, Facing = arena.Heroi.Facing },
                Monstros = new List<MonstroNaArena>(arena.Monstros.Count),
                Companheiros = new List<CompanheiroNaArena>(arena.Companheiros.Count),
                Tiros = new List<Tiro>(arena.Tiros.Count),
                Evento = null,
                Recarga = arena.Recarga,
                RecargaDosPoderes = new OrderedMap<double>(),
                RecargaDoItem = arena.RecargaDoItem,
                Rodada = arena.Rodada,
                Intervalo = arena.Intervalo,
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
                    },
                    Alvo = arena.Evento.Alvo,
                    Estilo = arena.Evento.Estilo,
                    Tiro = arena.Evento.Tiro,
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

        private static JeitoDeLutar JeitoDe(CombatMonsterView monstro) =>
            monstro.Behavior != null && D.JeitosDeLutar.TryGet(monstro.Behavior, out var jeito) ? jeito : D.JeitosDeLutar.Get("agressivo");

        private static double Distancia2(double ax, double ay, double bx, double by)
        {
            double dx = ax - bx;
            double dy = ay - by;
            return dx * dx + dy * dy;
        }

        /// <summary>O monstro de pé mais perto do ponto; empate fica com o de índice menor.</summary>
        private static MonstroNaArena MaisPerto(Luta l, double x, double y)
        {
            MonstroNaArena melhor = null;
            double menor = double.PositiveInfinity;
            foreach (var m in l.Arena.Monstros)
            {
                if (m.Fase == "caido") continue;
                double d = Distancia2(m.X, m.Y, x, y);
                if (d < menor)
                {
                    menor = d;
                    melhor = m;
                }
            }
            return melhor;
        }

        /// <summary>Um rumo de comprimento <paramref name="velocidade"/> de (0,0) até (dx, dy), em inteiros.</summary>
        private static (double X, double Y) Rumo(double dx, double dy, double velocidade)
        {
            double comprimento = Math.Sqrt(dx * dx + dy * dy);
            if (comprimento == 0) return (0, 0);
            return (Math.Truncate(dx * velocidade / comprimento), Math.Truncate(dy * velocidade / comprimento));
        }

        /// <summary>Anda na direção (dx, dy) a <paramref name="velocidade"/> por passo, com a parede segurando.</summary>
        private static (double X, double Y) AndarRumo(RoomLayout planta, double x, double y, double dx, double dy, double velocidade)
        {
            double forca = Math.Truncate(Js.Min(velocidade, RoomWalk.HeroSpeed) * RoomWalk.StickMax / RoomWalk.HeroSpeed);
            var r = Rumo(dx, dy, forca);
            var passo = RoomWalk.Tick(planta, new Walker { X = x, Y = y, Facing = "S" }, new WalkInput { X = r.X, Y = r.Y }).Walker;
            return (passo.X, passo.Y);
        }

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
            var hero = Masmorra(l).Hero;
            string estilo = EstiloDoBotao(hero);
            bool tiro = estilo == AttackStyles.Magic || estilo == AttackStyles.Ranged;
            var alvo = MaisPerto(l, l.Arena.Heroi.X, l.Arena.Heroi.Y);
            if (alvo == null) return;
            if (!tiro && Distancia2(alvo.X, alvo.Y, l.Arena.Heroi.X, l.Arena.Heroi.Y) > D.AlcanceCorpoACorpo * D.AlcanceCorpoACorpo)
            {
                Contar(l, Aviso("Longe demais"));
                return;
            }
            var evento = EventosDeArma.EventoDoAtaque(hero, estilo, l.Rng);
            l.Arena.Evento = new EventoAberto { Evento = evento, Passo = 0, Jogada = new JogadaDoEvento(), Alvo = alvo.Indice, Estilo = estilo, Tiro = tiro };
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
            }

            if (pronto) Golpear(l);
        }

        /// <summary>O evento terminou: lê, rola o d20 e o golpe sai — de perto agora, ou num tiro.</summary>
        private static void Golpear(Luta l)
        {
            var aberto = l.Arena.Evento;
            l.Arena.Evento = null;
            l.Arena.Recarga = D.RecargaDoAtaque;
            var leitura = EventosDeArma.LerEvento(aberto.Evento, aberto.Jogada);
            double dado = 1 + Rng.RandomInt(Attack.LadosDoDano, l.Rng);
            var alvo = l.Arena.Monstros[(int)aberto.Alvo];
            var heroi = l.Arena.Heroi;

            if (aberto.Tiro)
            {
                // O tiro sai na direção de onde o alvo está agora; se ele já caiu, na do mais perto.
                var mira = alvo.Fase != "caido" ? alvo : (MaisPerto(l, heroi.X, heroi.Y) ?? alvo);
                var v = Rumo(mira.X - heroi.X, mira.Y - heroi.Y, D.VelocidadeDoTiro);
                l.Arena.Tiros.Add(new Tiro
                {
                    De = "heroi", X = heroi.X, Y = heroi.Y, Vx = v.X, Vy = v.Y, Vida = D.VidaDoTiro, Indice = -1, Forca = 1,
                    Dado = dado, Leitura = leitura, Estilo = aberto.Estilo,
                });
                return;
            }

            if (alvo.Fase == "caido" || Distancia2(alvo.X, alvo.Y, heroi.X, heroi.Y) > D.AlcanceDoGolpe * D.AlcanceDoGolpe)
            {
                Contar(l, Numero("monstro", alvo.Indice, "Longe", "erro"));
                Contar(l, Som("miss"));
                return;
            }
            AcertarMonstro(l, alvo, dado, leitura, aberto.Estilo);
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
            if (golpe.MonsterDefeated) Abater(l, alvo.Indice, golpe.Monster);
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
            var alvo = MaisPerto(l, l.Arena.Heroi.X, l.Arena.Heroi.Y);
            if (alvo == null) return;

            var bonus = Pets.Bonus(l.Pet);
            var monstro = MonstroNo(l, alvo.Indice);
            var uso = UsePower.CastPower(estado.Hero, estado.Party, monstro, poder,
                new UsePowerOptions { Rng = l.Rng, PetCuraBonus = bonus.Healing ?? 0, PetManaSaveChance = bonus.ManaSave ?? 0 });
            if (uso.Outcome == UsePowerOutcomes.NoMana)
            {
                Contar(l, Aviso("Mana insuficiente para " + poder.Name));
                return;
            }
            l.Arena.RecargaDosPoderes.Set(id, D.RecargaDoPoder);
            var comUso = estado.Clone();
            comUso.Hero = uso.Hero;
            comUso.Party = uso.Party;
            l.Estado = FimDaLuta.GravarMonstro(comUso, alvo.Indice, uso.Monster);

            if (uso.Outcome == UsePowerOutcomes.Damage)
            {
                Contar(l, Numero("monstro", alvo.Indice, poder.Icon + " -" + Js.NumberToString(uso.Damage ?? 0), "critico"));
                Contar(l, Som("crit"));
            }
            else if (uso.Outcome == UsePowerOutcomes.Heal)
            {
                Contar(l, Numero("heroi", 0, "+" + Js.NumberToString(uso.Healed ?? 0), "cura"));
                Contar(l, Som("heal"));
            }
            else
            {
                Contar(l, Aviso(poder.Icon + " " + poder.Name));
            }
            if (Js.Truthy(uso.Healed) && uso.Outcome == UsePowerOutcomes.Damage) Contar(l, Numero("heroi", 0, "+" + Js.NumberToString(uso.Healed.Value), "cura"));
            if (uso.MonsterDefeated) Abater(l, alvo.Indice, uso.Monster);
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

        private static void PassoDoMundo(Luta l, EntradaDaLuta entrada)
        {
            var planta = PlantaFechada();
            var arena = l.Arena;
            arena.Passo += 1;
            arena.Heroi = RoomWalk.Tick(planta, arena.Heroi, new WalkInput { X = entrada.X, Y = entrada.Y }).Walker;
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
                if (m.Fase != "caido") MoverMonstro(l, planta, m);
            }
            foreach (var c in arena.Companheiros)
            {
                if (l.Fim != null) return;
                MoverCompanheiro(l, planta, c);
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

        private static void MoverMonstro(Luta l, RoomLayout planta, MonstroNaArena m)
        {
            var monstro = MonstroNo(l, m.Indice);
            var jeito = JeitoDe(monstro);
            var heroi = l.Arena.Heroi;
            double dx = heroi.X - m.X;
            double dy = heroi.Y - m.Y;
            double d2 = dx * dx + dy * dy;

            switch (m.Fase)
            {
                case "andando":
                {
                    if (m.Tempo > 0) m.Tempo -= 1;
                    bool longe = d2 > jeito.Distancia * jeito.Distancia;
                    // O mágico guarda distância: perto demais, recua.
                    bool pertoDemais = jeito.Golpe == "tiro" && d2 < jeito.Distancia * jeito.Distancia * 36 / 100;
                    if (longe || pertoDemais)
                    {
                        double sentido = pertoDemais ? -1 : 1;
                        var passo = AndarRumo(planta, m.X, m.Y, sentido * dx, sentido * dy, jeito.Velocidade);
                        m.X = passo.X;
                        m.Y = passo.Y;
                    }
                    double alcance = jeito.Golpe == "tiro" ? jeito.Distancia * 6 / 5 : jeito.Distancia + RoomWalk.TileUnits / 4;
                    if (m.Tempo <= 0 && d2 <= alcance * alcance && PodeGolpear(l)) ComecarGolpe(l, m, monstro, jeito);
                    return;
                }
                case "avisando":
                    m.Tempo -= 1;
                    if (m.Tempo <= 0) SoltarGolpe(l, planta, m, jeito);
                    return;
                case "investindo":
                    Investir(l, planta, m, jeito);
                    return;
                default:
                    // Descansando, atordoado, hesitando: parado até o tempo acabar.
                    m.Tempo -= 1;
                    if (m.Tempo <= 0)
                    {
                        m.Fase = "andando";
                        m.Tempo = 0;
                    }
                    return;
            }
        }

        /// <summary>Há vaga pra mais um golpe começar: menos de ATACANDO_DE_UMA_VEZ golpeando e o intervalo passado.</summary>
        private static bool PodeGolpear(Luta l)
        {
            if (l.Arena.Intervalo > 0) return false;
            int golpeando = 0;
            foreach (var m in l.Arena.Monstros)
                if (m.Fase == "avisando" || m.Fase == "investindo") golpeando++;
            return golpeando < D.AtacandoDeUmaVez;
        }

        /// <summary>
        /// O monstro tenta golpear: atordoado ou lento demais, perde o golpe; senão, o aviso começa com o rumo
        /// travado. Nos três casos a vaga do próximo golpe espera o intervalo.
        /// </summary>
        private static void ComecarGolpe(Luta l, MonstroNaArena m, CombatMonsterView monstro, JeitoDeLutar jeito)
        {
            var estado = Masmorra(l);
            var inicio = MonsterHit.StartMonsterAttack(monstro, estado.Hero, l.Rng);
            var comHeroi = estado.Clone();
            comHeroi.Hero = inicio.Hero;
            l.Estado = FimDaLuta.GravarMonstro(comHeroi, m.Indice, inicio.Monster);
            l.Arena.Intervalo = D.IntervaloEntreGolpes;
            if (inicio.Outcome == MonsterAttackStart.Stunned)
            {
                m.Fase = "atordoado";
                m.Tempo = D.TempoAtordoado;
                Contar(l, Numero("monstro", m.Indice, "💫", "erro"));
                return;
            }
            if (inicio.Outcome == MonsterAttackStart.LentoSkip)
            {
                m.Fase = "hesitando";
                m.Tempo = D.TempoHesitando;
                Contar(l, Numero("monstro", m.Indice, "🐌", "erro"));
                return;
            }
            if (inicio.RageTriggered) Contar(l, Aviso(Js.Str(monstro.Name) + " fica furioso!"));
            m.Fase = "avisando";
            m.Tempo = jeito.Aviso;
            m.Forca = inicio.AttackMult;
            m.RumoX = l.Arena.Heroi.X - m.X;
            m.RumoY = l.Arena.Heroi.Y - m.Y;
        }

        private static void SoltarGolpe(Luta l, RoomLayout planta, MonstroNaArena m, JeitoDeLutar jeito)
        {
            if (jeito.Golpe == "investida")
            {
                m.Fase = "investindo";
                m.Restante = jeito.Alcance;
                Investir(l, planta, m, jeito);
                return;
            }
            m.Fase = "descansando";
            m.Tempo = jeito.Descanso;
            if (jeito.Golpe == "tiro")
            {
                var v = Rumo(m.RumoX, m.RumoY, D.VelocidadeDoTiroDoMonstro);
                l.Arena.Tiros.Add(new Tiro { De = "monstro", X = m.X, Y = m.Y, Vx = v.X, Vy = v.Y, Vida = D.VidaDoTiro, Indice = m.Indice, Forca = m.Forca });
                return;
            }
            // De perto: cai em quem estiver mais perto dentro do alcance, o herói primeiro no empate.
            var alvo = QuemEstaPerto(l, m.X, m.Y, jeito.Alcance);
            if (alvo == null) Contar(l, Numero("monstro", m.Indice, "Errou", "erro"));
            else GolpeDoMonstro(l, m, alvo.Value);
        }

        /// <summary>Quem leva o golpe: -1 é o herói; senão o índice do companheiro na equipe. null, ninguém ao alcance.</summary>
        private static double? QuemEstaPerto(Luta l, double x, double y, double alcance)
        {
            double limite = alcance * alcance;
            double? quem = null;
            double menor = Distancia2(l.Arena.Heroi.X, l.Arena.Heroi.Y, x, y);
            if (menor <= limite) quem = -1;
            else menor = double.PositiveInfinity;
            var equipe = Masmorra(l).Party ?? new List<Companion>();
            foreach (var c in l.Arena.Companheiros)
            {
                int i = (int)c.Indice;
                double vida = i >= 0 && i < equipe.Count ? equipe[i].Hp : 0;
                if (vida <= 0) continue;
                double d = Distancia2(c.X, c.Y, x, y);
                if (d <= limite && d < menor)
                {
                    menor = d;
                    quem = c.Indice;
                }
            }
            return quem;
        }

        /// <summary>A investida corre em linha reta pelo rumo travado; quem ela alcançar primeiro leva o golpe, e ela para.</summary>
        private static void Investir(Luta l, RoomLayout planta, MonstroNaArena m, JeitoDeLutar jeito)
        {
            double falta = Js.Min(VelocidadeDaInvestida, m.Restante);
            while (falta > 0)
            {
                double pedaco = Js.Min(RoomWalk.HeroSpeed, falta);
                double antesX = m.X;
                double antesY = m.Y;
                var passo = AndarRumo(planta, m.X, m.Y, m.RumoX, m.RumoY, pedaco);
                m.X = passo.X;
                m.Y = passo.Y;
                falta -= pedaco;
                m.Restante -= pedaco;
                var alvo = QuemEstaPerto(l, m.X, m.Y, D.Contato);
                if (alvo != null)
                {
                    GolpeDoMonstro(l, m, alvo.Value);
                    m.Restante = 0;
                    break;
                }
                if (m.X == antesX && m.Y == antesY)
                {
                    // Bateu na parede.
                    m.Restante = 0;
                    break;
                }
            }
            if (m.Restante <= 0 && l.Fim == null)
            {
                m.Fase = "descansando";
                m.Tempo = jeito.Descanso;
            }
        }

        /// <summary>O golpe do monstro cai no herói (-1) ou no companheiro <paramref name="alvo"/>.</summary>
        private static void GolpeDoMonstro(Luta l, MonstroNaArena m, double alvo)
        {
            var estado = Masmorra(l);
            var monstro = MonstroNo(l, m.Indice);
            if (alvo < 0)
            {
                var golpe = MonsterHit.LandHitOnHero(estado.Hero, monstro, m.Forca, l.Rng, Pets.Bonus(l.Pet).Esquiva ?? 0);
                var comHeroi = estado.Clone();
                comHeroi.Hero = golpe.Hero;
                l.Estado = FimDaLuta.GravarMonstro(comHeroi, m.Indice, golpe.Monster);
                if (golpe.Dodged)
                {
                    Contar(l, Numero("heroi", 0, "Desviou", "erro"));
                    Contar(l, Som("miss"));
                    return;
                }
                Contar(l, Numero("heroi", 0, "-" + Js.NumberToString(golpe.Damage), "dano"));
                Contar(l, Som("hit"));
                if (golpe.ManaDrained > 0) Contar(l, Aviso(Js.Str(monstro.Name) + " drena " + Js.NumberToString(golpe.ManaDrained) + " de mana"));
                if (golpe.PoisonApplied) Contar(l, Aviso("Você foi envenenado"));
                if (golpe.Hero.Hp <= 0) Perder(l);
                return;
            }
            int indice = (int)alvo;
            var equipe = estado.Party ?? new List<Companion>();
            if (indice >= equipe.Count) return;
            var membro = equipe[indice];
            var acerto = MonsterHit.HitPartyMember(membro, monstro, m.Forca, l.Rng);
            var novaEquipe = new List<Companion>(equipe.Count);
            for (int i = 0; i < equipe.Count; i++) novaEquipe.Add(i == indice ? acerto.Member : equipe[i]);
            var comEquipe = estado.Clone();
            comEquipe.Party = novaEquipe;
            l.Estado = comEquipe;
            Contar(l, Numero("companheiro", alvo, "-" + Js.NumberToString(acerto.Damage), "dano"));
            if (acerto.Defeated) Diario(l, new[] { Js.Str(membro.Name) + " caiu!" });
        }

        private static void MoverCompanheiro(Luta l, RoomLayout planta, CompanheiroNaArena c)
        {
            var estado = Masmorra(l);
            var equipe = estado.Party ?? new List<Companion>();
            int i = (int)c.Indice;
            if (i >= equipe.Count || equipe[i].Hp <= 0) return;
            var membro = equipe[i];
            if (c.Tempo > 0) c.Tempo -= 1;
            var alvo = MaisPerto(l, c.X, c.Y);
            if (alvo == null) return;
            double d2 = Distancia2(alvo.X, alvo.Y, c.X, c.Y);
            if (d2 > D.AlcanceCorpoACorpo * D.AlcanceCorpoACorpo)
            {
                var passo = AndarRumo(planta, c.X, c.Y, alvo.X - c.X, alvo.Y - c.Y, D.VelocidadeDoCompanheiro);
                c.X = passo.X;
                c.Y = passo.Y;
                return;
            }
            if (c.Tempo > 0) return;
            c.Tempo = D.CadenciaDoCompanheiro;
            var monstro = MonstroNo(l, alvo.Indice);
            var acao = Party.PartyMemberAct(estado.Hero, membro, monstro, l.Rng);
            var comHeroi = estado.Clone();
            comHeroi.Hero = acao.Hero;
            l.Estado = FimDaLuta.GravarMonstro(comHeroi, alvo.Indice, acao.Monster);
            var resultado = acao.Outcome;
            if (resultado.Kind == PartyOutcomeKinds.HealedHero)
            {
                Contar(l, Numero("heroi", 0, "+" + Js.NumberToString(resultado.Amount ?? 0), "cura"));
            }
            else if (resultado.Kind == PartyOutcomeKinds.Miss)
            {
                Contar(l, Numero("monstro", alvo.Indice, "Errou", "erro"));
            }
            else
            {
                Contar(l, Numero("monstro", alvo.Indice, "-" + Js.NumberToString(resultado.Amount ?? 0), "dano"));
                if (acao.Monster.Hp <= 0) Abater(l, alvo.Indice, Monsters.View(acao.Monster));
            }
        }

        /// <summary>Os tiros andam; o que sai do chão ou acaba some, o que encosta em alguém acerta.</summary>
        private static void MoverTiros(Luta l)
        {
            var ficam = new List<Tiro>();
            double minimo = RoomWalk.TileUnits;
            double maximoX = (RoomWalk.RoomCols - 1) * RoomWalk.TileUnits;
            double maximoY = (RoomWalk.RoomRows - 1) * RoomWalk.TileUnits;
            double raio2 = D.RaioDoTiro * D.RaioDoTiro;
            foreach (var t in l.Arena.Tiros)
            {
                if (l.Fim != null) break;
                t.X += t.Vx;
                t.Y += t.Vy;
                t.Vida -= 1;
                if (t.Vida <= 0 || t.X < minimo || t.X > maximoX || t.Y < minimo || t.Y > maximoY) continue;

                if (t.De == "heroi")
                {
                    MonstroNaArena alvo = null;
                    foreach (var m in l.Arena.Monstros)
                    {
                        if (m.Fase != "caido" && Distancia2(m.X, m.Y, t.X, t.Y) <= raio2)
                        {
                            alvo = m;
                            break;
                        }
                    }
                    if (alvo == null)
                    {
                        ficam.Add(t);
                        continue;
                    }
                    AcertarMonstro(l, alvo, t.Dado ?? double.NaN, t.Leitura, t.Estilo);
                    continue;
                }

                var quem = QuemEstaPerto(l, t.X, t.Y, D.RaioDoTiro);
                if (quem == null)
                {
                    ficam.Add(t);
                    continue;
                }
                var atirador = l.Arena.Monstros[(int)t.Indice].Clone();
                atirador.Forca = t.Forca;
                GolpeDoMonstro(l, atirador, quem.Value);
            }
            l.Arena.Tiros = ficam;
        }

        /// <summary>A rodada: o veneno do herói, o dano contínuo de cada monstro de pé e a Canção de Batalha.</summary>
        private static void RodadaDaLuta(Luta l)
        {
            var veneno = HeroStatus.TickHeroStatus(Masmorra(l).Hero);
            var comVeneno = Masmorra(l).Clone();
            comVeneno.Hero = veneno.Hero;
            l.Estado = comVeneno;
            if (veneno.Damage > 0) Contar(l, Numero("heroi", 0, "-" + Js.NumberToString(veneno.Damage), "dano"));
            if (veneno.Defeated)
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

        /// <summary>O monstro caiu: é pago; foi o último, a sala está limpa e a luta acaba em vitória.</summary>
        private static void Abater(Luta l, double indice, CombatMonsterView abatido)
        {
            int i = (int)indice;
            if (i >= 0 && i < l.Arena.Monstros.Count) l.Arena.Monstros[i].Fase = "caido";
            var pago = FimDaLuta.PagarAbate(Masmorra(l), abatido);
            l.Estado = pago.Estado;
            Diario(l, pago.Log);
            if (FimDaLuta.IndicesDePe(Sala(l)).Count > 0) return;

            var limpa = FimDaLuta.LimparSala(Masmorra(l), abatido, l.Rng, l.Now);
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
        public static string EventoDoBotao(Hero hero) => EventosDeArma.EventoDaArma(hero.Equip.Get("arma")?.TemplateId);
    }
}
