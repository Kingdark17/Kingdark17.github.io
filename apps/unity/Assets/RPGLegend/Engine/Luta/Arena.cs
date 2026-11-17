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
        /// <summary>Andando atrás do herói, quanto anda por passo (o herói anda 64).</summary>
        public double Passo;
        /// <summary>Até que distância do herói ele chega, e de onde o golpe pode começar.</summary>
        public double Distancia;
    }

    /// <summary>
    /// TS: MonstroNaArena. Fase: "esperando", "avisando", "investindo", "descansando", "atordoado", "hesitando" ou
    /// "caido". Alvo -1 é o herói (no chão da sala); senão o índice do companheiro na equipe.
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
        /// <summary>
        /// Onde o monstro está de pé, em unidades da sala: começa no meio da casa dele e, depois de uma investida, fica
        /// onde ela acabou (2026-11-12). É dali que o alcance mede e que saem a investida e o tiro.
        /// </summary>
        public double CorpoX;
        public double CorpoY;
        /// <summary>O chefe final: o poder do golpe em curso (<see cref="ChefeFinal"/>). Ausente (null) no golpe comum.</summary>
        public string Poder;
        /// <summary>Na luta em dupla: ele anda atrás do parceiro, e o golpe em curso mira nele (<see cref="Dupla"/>).</summary>
        public bool? NoParceiro;
        /// <summary>No espelho de quem acompanha: este golpe já acertou o meu herói (a investida não acerta duas vezes).</summary>
        public bool? Acertou;

        public MonstroNaArena Clone() => (MonstroNaArena)MemberwiseClone();
    }

    /// <summary>
    /// TS: Dupla — a luta em dupla (o co-op do app, 2026-11-16): cada app cuida do próprio herói, e o de quem criou a
    /// sala cuida dos monstros. Papel "anfitriao": a luta de sempre, com o parceiro na sala (os monstros escolhem
    /// entre os dois, e o dano dele chega pela entrada). Papel "convidado": um espelho — o estado dos monstros chega
    /// pela entrada, o que mira o herói daqui é testado aqui, e o dano que ele causa sai em
    /// <see cref="QuadroDaLuta.Danos"/>. Quem cai vira fantasma, e a luta segue com o outro.
    /// </summary>
    public sealed class Dupla
    {
        public string Papel;
        public PontoNaSala Parceiro;
        public bool? ParceiroCaido;
        public bool? Fantasma;

        public Dupla Clone() => new Dupla
        {
            Papel = Papel,
            Parceiro = Parceiro != null ? new PontoNaSala { X = Parceiro.X, Y = Parceiro.Y } : null,
            ParceiroCaido = ParceiroCaido,
            Fantasma = Fantasma,
        };
    }

    /// <summary>TS: MonstroNoEspelho — um monstro como o anfitrião o manda pro espelho.</summary>
    public sealed class MonstroNoEspelho
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
        public double CorpoX;
        public double CorpoY;
        public string Poder;
        public bool? NoParceiro;
        public double Hp;
        /// <summary>O monstro inteiro: quando o espelho ainda não o tem (os lacaios) ou quando ele mudou além da vida.</summary>
        public CombatMonster Monstro;
    }

    /// <summary>TS: Espelho — o que o anfitrião manda dos monstros e das bolas, umas dez vezes por segundo.</summary>
    public sealed class Espelho
    {
        public List<MonstroNoEspelho> Monstros = new List<MonstroNoEspelho>();
        public List<Tiro> Tiros = new List<Tiro>();
    }

    /// <summary>TS: o parceiro na entrada — onde ele está agora, e se caiu.</summary>
    public sealed class ParceiroNaEntrada
    {
        public double X;
        public double Y;
        public bool? Caido;
    }

    /// <summary>TS: um dano de fora, ou um dano pra mandar: em qual monstro (índice na sala) e quanto.</summary>
    public sealed class DanoNoMonstro
    {
        public double Indice;
        public double Dano;
    }

    /// <summary>TS: CompanheiroNaArena.</summary>
    public sealed class CompanheiroNaArena
    {
        public double Indice;
        public double Tempo;

        public CompanheiroNaArena Clone() => (CompanheiroNaArena)MemberwiseClone();
    }

    /// <summary>TS: Tiro — a bola do mágico, voando pela sala.</summary>
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

    /// <summary>TS: EventoAberto — o evento da arma em curso.</summary>
    public sealed class EventoAberto
    {
        public EventoDeArma Evento;
        public double Passo;
        public JogadaDoEvento Jogada;
        public double Alvo;
        public string Estilo;
        /// <summary>O evento é de um poder mágico (o id dele), e não do ataque: no fim, é o poder que sai, na força do evento.</summary>
        public string Poder;
    }

    /// <summary>TS: Arena — tudo o que a luta em tempo real tem: os monstros, o herói na sala e os tempos.</summary>
    public sealed class Arena
    {
        public double Passo;
        public double Lento;
        public Walker Chegada;
        /// <summary>Onde o herói está na sala, e pra onde olha: é ali que ele fica quando a luta acaba.</summary>
        public Walker Heroi;
        public double Alvo;
        /// <summary>
        /// O jogador tocou na placa desse alvo (Mirar): no celular, o ataque vai nele enquanto estiver ao alcance. Sem
        /// escolha (null), vai no de pé mais perto.
        /// </summary>
        public bool? Escolhido;
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
        /// <summary>A luta em dupla; ausente (null) na luta de um só.</summary>
        public Dupla Dupla;
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
        /// <summary>O chefe final caiu e a masmorra foi zerada: a tela de vitória (<see cref="Conquistas"/>).</summary>
        public Conquista Conquista;
    }

    /// <summary>Onde o dedo está, na caixa do desenho.</summary>
    public sealed class DedoNoDesenho
    {
        public double X;
        public double Y;
    }

    /// <summary>Um ponto da sala, em unidades dela (o cursor do PC).</summary>
    public sealed class PontoNaSala
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
        /// <summary>No PC, onde o cursor está na sala, em unidades dela: o ataque vai no monstro da área em volta dele, ou no chão.</summary>
        public PontoNaSala Cursor;
        public bool? Atacar;
        public bool? Soltar;
        public bool? Tocar;
        public DedoNoDesenho Dedo;
        /// <summary>Letras: a tecla de letra apertada neste passo.</summary>
        public string Tecla;
        public string Poder;
        public string Item;
        public bool? Menu;
        /// <summary>Em dupla: onde o parceiro está agora, e se caiu.</summary>
        public ParceiroNaEntrada Parceiro;
        /// <summary>Em dupla, o anfitrião: o dano que o parceiro causou desde o último passo.</summary>
        public List<DanoNoMonstro> DanoDeFora;
        /// <summary>Em dupla, o convidado: o estado dos monstros que chegou do anfitrião neste passo.</summary>
        public Espelho Espelho;
        /// <summary>Em dupla: o parceiro saiu da sala. Quem ficou segue sozinho; se estava caído, perde.</summary>
        public bool? SemParceiro;
        /// <summary>Em dupla: o parceiro gastou uma Poção de Reviver em mim — com quantos % da vida máxima eu levanto.</summary>
        public double? Reviver;
    }

    /// <summary>TS: Acontecimento — algo que a tela mostra ou toca.</summary>
    public sealed class Acontecimento
    {
        /// <summary>"numero", "som", "diario" ou "aviso".</summary>
        public string Tipo;
        public string Texto;
        /// <summary>"monstro", "heroi", "companheiro" ou "chao" (o golpe que foi no chão, em X e Y).</summary>
        public string Onde;
        /// <summary>Número no chão: onde, em unidades da sala.</summary>
        public double? X;
        public double? Y;
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
        /// <summary>Em dupla, no convidado: o dano que o herói daqui (e a equipe dele) causou, pra mandar ao anfitrião. Ausente (null) sem dano.</summary>
        public List<DanoNoMonstro> Danos;
    }

    /// <summary>As tabelas de luta/arena.ts (fixtures/data/luta/arena.json).</summary>
    public sealed class ArenaData
    {
        [JsName("LENTIDAO")] public double Lentidao;
        [JsName("RODADA")] public double Rodada;
        [JsName("RECARGA_DO_ATAQUE")] public double RecargaDoAtaque;
        [JsName("RECARGA_DO_PODER")] public double RecargaDoPoder;
        [JsName("RECARGA_DO_ITEM")] public double RecargaDoItem;
        [JsName("TIPOS_DE_PODER_MAGICO")] public List<string> TiposDePoderMagico = new List<string>();
        [JsName("FORCA_DO_PODER_ERRADO")] public double ForcaDoPoderErrado;
        [JsName("RAIO_DO_HEROI")] public double RaioDoHeroi;
        [JsName("AREA_DA_MIRA")] public double AreaDaMira;
        [JsName("FOLGA_DO_ALCANCE")] public double FolgaDoAlcance;
        [JsName("VIDA_DO_TIRO")] public double VidaDoTiro;
        [JsName("TEMPO_ATORDOADO")] public double TempoAtordoado;
        [JsName("TEMPO_HESITANDO")] public double TempoHesitando;
        [JsName("ESPERA_INICIAL")] public double EsperaInicial;
        [JsName("ATACANDO_DE_UMA_VEZ")] public double AtacandoDeUmaVez;
        [JsName("INTERVALO_ENTRE_GOLPES")] public double IntervaloEntreGolpes;
        [JsName("RESPIRO_DO_MONSTRO")] public double RespiroDoMonstro;
        [JsName("ESPACO_ENTRE_MONSTROS")] public double EspacoEntreMonstros;
        [JsName("CADENCIA_DO_COMPANHEIRO")] public double CadenciaDoCompanheiro;
        [JsName("JEITOS_DE_LUTAR")] public OrderedMap<JeitoDeLutar> JeitosDeLutar = new OrderedMap<JeitoDeLutar>();
    }

    public static partial class GameData
    {
        private static ArenaData _arenaTable;

        /// <summary>luta/arena: os tempos, o alcance e os jeitos de lutar da luta em tempo real.</summary>
        public static ArenaData ArenaTable
        {
            get => Require(_arenaTable, "luta/arena");
            set => _arenaTable = value;
        }
    }

    /// <summary>
    /// Port de shared/src/luta/arena.ts: a luta em tempo real do app, na própria sala — a sala é a arena (doc do
    /// Breno de 2026-11-10, decidido com o usuário em 2026-11-11; antes o herói era um coração numa caixa). Os
    /// monstros ficam cada um na casa dele; o herói anda pela sala (RoomWalk.Tick), com as portas fechadas e os
    /// monstros de pé tomando a casa deles; todo golpe de monstro no herói é um desenho no chão com aviso antes, e
    /// só pega se encostar nele. O botão de ataque abre o evento da arma no alvo, em câmera lenta, e o ataque tem o
    /// alcance da classe (AlcanceNaArena; doc do Breno de 2026-11-15); no PC o alvo é o monstro na área do cursor
    /// (AreaDaMira), e sem nenhum o golpe vai no chão. Um monstro golpeia por vez, revezando; o golpe
    /// pode ir num companheiro pela regra do site. A recompensa é a do site (FimDaLuta). Tudo em passos e unidades
    /// inteiras; o sorteio atravessa a luta inteira.
    /// </summary>
    public static class Arenas
    {
        private static ArenaData D => GameData.ArenaTable;

        public static double Lentidao => D.Lentidao;
        public static double Rodada => D.Rodada;
        public static double RaioDoHeroi => D.RaioDoHeroi;
        public static double AreaDaMira => D.AreaDaMira;

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
            public Conquista Conquista;
            public RngFn Rng;
            public Func<double> Now;
            public List<Acontecimento> Acontecimentos = new List<Acontecimento>();
            /// <summary>O dano causado neste passo no espelho (<see cref="QuadroDaLuta.Danos"/>).</summary>
            public List<DanoNoMonstro> Danos = new List<DanoNoMonstro>();
        }

        // ---------- abrir ----------

        /// <summary>
        /// TS: abrirLuta — prepara os monstros e o herói (<see cref="FimDaLuta.PrepararLuta"/>), põe os monstros no
        /// palco (os caídos ficam no lugar, apagados), o herói um passo pra dentro da porta e os companheiros vivos ao lado.
        /// O alvo começa no primeiro de pé. <paramref name="chegada"/> é por onde o herói entrou: a luta guarda
        /// pra ele voltar ali quando acabar. <paramref name="teclado"/>: jogada no PC, onde o cajado pede letras em
        /// vez do desenho.
        /// </summary>
        public static QuadroDaLuta AbrirLuta(EstadoNaMasmorra estado, Walker chegada, string pet = null, bool teclado = false, string dupla = null)
        {
            var preparada = FimDaLuta.PrepararLuta(estado);
            var sala = (DungeonCell)Estados.CelulaAtual(preparada.Estado);
            var dePe = FimDaLuta.IndicesDePe(sala);

            var monstros = new List<MonstroNaArena>();
            int total = sala.Monsters?.Count ?? 0;
            var formato = ArteDaSala.GeometriaDaSala(((EstadoNaMasmorra)preparada.Estado).Masmorra.Dungeon);
            for (int indice = 0; indice < total; indice++)
            {
                var lugar = LugarDoMonstro(total, indice, formato);
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
                    CorpoX = lugar.X,
                    CorpoY = lugar.Y,
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
                Heroi = CopiaDe(LutaNoMapa.HeroiNaLuta(chegada, formato)),
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
            if (dupla != null)
            {
                arena.Dupla = new Dupla { Papel = dupla };
                // Quem já chega caído (o fantasma que ninguém reviveu) só acompanha.
                if (preparada.Estado.Hero.Hp <= 0) arena.Dupla.Fantasma = true;
            }
            return new QuadroDaLuta
            {
                Luta = new LutaEmTempoReal { Estado = preparada.Estado, Arena = arena, Pet = pet, Teclado = teclado, Fim = null, Loot = null },
                Acontecimentos = acontecimentos,
            };
        }

        // ---------- o passo ----------

        /// <summary>
        /// TS: passoDaLuta — um passo da luta. O evento da arma corre em tempo de verdade; o mundo (herói,
        /// monstros, companheiros, tiros, rodada) anda um passo, ou, em câmera lenta, um a cada LENTIDAO.
        /// <paramref name="now"/> é o relógio do uid do item que cai ao vencer (e do andar novo, se foi chefe).
        /// </summary>
        public static QuadroDaLuta PassoDaLuta(LutaEmTempoReal luta, EntradaDaLuta entrada, RngFn rng, Func<double> now = null)
        {
            if (luta.Fim != null) return new QuadroDaLuta { Luta = luta, Acontecimentos = new List<Acontecimento>() };
            var l = new Luta { Estado = luta.Estado, Arena = CopiarArena(luta.Arena), Pet = luta.Pet, Teclado = luta.Teclado, Fim = luta.Fim, Loot = luta.Loot, Conquista = luta.Conquista, Rng = rng, Now = now };

            if (l.Arena.Dupla != null) ReceberDoParceiro(l, entrada);
            if (l.Fim != null) return FecharPasso(l);
            if (entrada.Mirar != null) Mirar(l, entrada.Mirar.Value);
            // O fantasma anda, mas não age.
            if (l.Arena.Dupla?.Fantasma == true) l.Arena.Evento = null;
            else if (l.Arena.Evento != null) SeguirEvento(l, entrada);
            else if (entrada.Atacar == true && l.Arena.Recarga <= 0) AbrirEvento(l, entrada);
            else if (Js.Truthy(entrada.Poder)) PedirPoder(l, entrada.Poder);
            else if (Js.Truthy(entrada.Item)) UsarItem(l, entrada.Item);

            if (l.Fim == null)
            {
                // Em dupla não há câmera lenta (decisão do usuário, 2026-11-15): ninguém trava o outro.
                bool lento = l.Arena.Dupla == null && (l.Arena.Evento != null || entrada.Menu == true);
                if (lento) l.Arena.Lento += 1;
                if (!lento || l.Arena.Lento % D.Lentidao == 0) PassoDoMundo(l, entrada);
            }

            return FecharPasso(l);
        }

        private static QuadroDaLuta FecharPasso(Luta l) => new QuadroDaLuta
        {
            Luta = new LutaEmTempoReal { Estado = l.Estado, Arena = l.Arena, Pet = l.Pet, Teclado = l.Teclado, Fim = l.Fim, Loot = l.Loot, Conquista = l.Conquista },
            Acontecimentos = l.Acontecimentos,
            Danos = l.Danos.Count > 0 ? l.Danos : null,
        };

        /// <summary>TS: simularLuta — vários passos de uma vez, cada um com a sua entrada; para no fim da luta.</summary>
        public static QuadroDaLuta SimularLuta(LutaEmTempoReal luta, IReadOnlyList<EntradaDaLuta> entradas, RngFn rng, Func<double> now = null)
        {
            var atual = luta;
            var acontecimentos = new List<Acontecimento>();
            var danos = new List<DanoNoMonstro>();
            foreach (var entrada in entradas)
            {
                if (atual.Fim != null) break;
                var quadro = PassoDaLuta(atual, entrada, rng, now);
                atual = quadro.Luta;
                acontecimentos.AddRange(quadro.Acontecimentos);
                if (quadro.Danos != null) danos.AddRange(quadro.Danos);
            }
            return new QuadroDaLuta { Luta = atual, Acontecimentos = acontecimentos, Danos = danos.Count > 0 ? danos : null };
        }

        private static Arena CopiarArena(Arena arena)
        {
            var copia = new Arena
            {
                Passo = arena.Passo,
                Lento = arena.Lento,
                Chegada = new Walker { X = arena.Chegada.X, Y = arena.Chegada.Y, Facing = arena.Chegada.Facing },
                Heroi = CopiaDe(arena.Heroi),
                Alvo = arena.Alvo,
                Escolhido = arena.Escolhido,
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
                Dupla = arena.Dupla?.Clone(),
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
                    Poder = arena.Evento.Poder,
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

        /// <summary>
        /// TS: jeitoDoGolpe — o jeito do golpe em curso: o do comportamento, e o chefe final mexe nele. Na fúria o aviso
        /// e o descanso encurtam; o Golpe Devastador avisa por mais tempo e pega mais longe (a tela desenha o aviso
        /// com este tamanho).
        /// </summary>
        public static JeitoDeLutar JeitoDoGolpe(CombatMonsterView monstro, string poder = null)
        {
            var jeito = JeitoDe(monstro);
            if (monstro.ChefeFinal == true && monstro.Furia == true)
                jeito = Com(jeito, aviso: Math.Truncate(jeito.Aviso * 2 / 3), descanso: Math.Truncate(jeito.Descanso / 2));
            if (poder == ChefeFinal.Devastador)
                jeito = Com(jeito, aviso: Math.Truncate(jeito.Aviso * 3 / 2), tamanho: Math.Truncate(jeito.Tamanho * 13 / 10));
            return jeito;
        }

        /// <summary>O <c>{ ...jeito, campo }</c> do TS: um jeito novo, com só o que mudou.</summary>
        private static JeitoDeLutar Com(JeitoDeLutar jeito, double? aviso = null, double? descanso = null, double? tamanho = null) => new JeitoDeLutar
        {
            Aviso = aviso ?? jeito.Aviso,
            Golpe = jeito.Golpe,
            Tamanho = tamanho ?? jeito.Tamanho,
            Velocidade = jeito.Velocidade,
            Descanso = descanso ?? jeito.Descanso,
            Guarda = jeito.Guarda,
            Passo = jeito.Passo,
            Distancia = jeito.Distancia,
        };

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

        private static Walker CopiaDe(Walker w) => new Walker { X = w.X, Y = w.Y, Facing = w.Facing };

        private static GeometriaDaSala Geometria(Luta l) => ArteDaSala.GeometriaDaSala(Masmorra(l).Masmorra.Dungeon);

        /// <summary>TS: lugarDoMonstro — o meio da casa em que o monstro começa a luta, em unidades da sala.</summary>
        public static (double X, double Y) LugarDoMonstro(double quantos, double indice, GeometriaDaSala formato)
        {
            var lugares = LutaNoMapa.LugaresNaLuta(quantos, formato);
            var lugar = lugares[(int)Math.Min(indice, lugares.Count - 1)];
            return (lugar.Col * RoomWalk.TileUnits + RoomWalk.TileUnits / 2, lugar.Row * RoomWalk.TileUnits + RoomWalk.TileUnits / 2);
        }

        /// <summary>TS: lugarDe — onde o monstro está de pé agora: de onde sai a investida e o tiro, e o que o alcance mede.</summary>
        private static (double X, double Y) LugarDe(Luta l, double indice)
        {
            foreach (var m in l.Arena.Monstros)
                if (m.Indice == indice) return (m.CorpoX, m.CorpoY);
            return LugarDoMonstro(l.Arena.Monstros.Count, indice, Geometria(l));
        }

        /// <summary>
        /// TS: porOsLacaios — os lacaios entraram: cada novo aparece na casa dele pro novo tamanho do grupo; quem já
        /// estava na sala fica onde está (desde 2026-11-15 os monstros andam).
        /// </summary>
        private static void PorOsLacaios(Luta l, List<double> novos)
        {
            var formato = Geometria(l);
            foreach (var m in l.Arena.Monstros)
            {
                if (!novos.Contains(m.Indice)) continue;
                var lugar = LugarDoMonstro(l.Arena.Monstros.Count, m.Indice, formato);
                m.CorpoX = lugar.X;
                m.CorpoY = lugar.Y;
            }
        }

        /// <summary>
        /// TS: pousar — a investida acabou em (m.X, m.Y): o monstro fica ali, puxado pra dentro do chão se passou da
        /// parede. A que pegou no herói (<paramref name="raio"/> é o do corpo que investe) para encostada nele, e não em cima.
        /// </summary>
        private static void Pousar(Luta l, MonstroNaArena m, double? raio = null)
        {
            double x = m.X;
            double y = m.Y;
            if (raio.HasValue)
            {
                var heroi = l.Arena.Heroi;
                double limite = raio.Value + D.RaioDoHeroi;
                double dx = x - heroi.X;
                double dy = y - heroi.Y;
                if (dx == 0 && dy == 0)
                {
                    dx = -m.RumoX;
                    dy = -m.RumoY;
                }
                double distancia = Math.Sqrt(dx * dx + dy * dy);
                if (distancia > 0 && distancia < limite)
                {
                    x = heroi.X + Math.Truncate(dx * limite / distancia);
                    y = heroi.Y + Math.Truncate(dy * limite / distancia);
                }
            }
            var formato = Geometria(l);
            double meia = RoomWalk.TileUnits / 2;
            m.CorpoX = Math.Min(Math.Max(x, RoomWalk.TileUnits + meia), (formato.Cols - 1) * RoomWalk.TileUnits - meia);
            m.CorpoY = Math.Min(Math.Max(y, RoomWalk.TileUnits + meia), (formato.Rows - 1) * RoomWalk.TileUnits - meia);
        }

        /// <summary>
        /// TS: alcanceNaArena — até onde o ataque comum alcança, em unidades da sala, do pé do herói ao meio da casa do
        /// monstro: o alcance da classe em blocos e mais meia casa (com 1 bloco, a casa do lado).
        /// </summary>
        public static double AlcanceNaArena(Hero hero) =>
            ClassesDeLuta.AlcanceDoHeroi(hero) * RoomWalk.TileUnits + RoomWalk.TileUnits / 2;

        /// <summary>TS: velocidadeNaArena — a velocidade de andar na luta: a de sempre na % da classe; com a perna quebrada, o passo do mapa.</summary>
        public static double VelocidadeNaArena(Hero hero)
        {
            double pct = ClassesDeLuta.De(hero).Velocidade;
            double daClasse = pct == 100 ? RoomWalk.HeroSpeed : Math.Truncate(RoomWalk.HeroSpeed * pct / 100);
            return hero.Ferimentos?.Perna == true ? Math.Truncate(daClasse * FerimentosDoHeroi.PassoComPernaQuebrada) : daClasse;
        }

        /// <summary>O herói alcança o monstro com o ataque comum, com esta folga a mais?</summary>
        private static bool Alcanca(Luta l, double indice, double folga = 0)
        {
            var lugar = LugarDe(l, indice);
            double dx = l.Arena.Heroi.X - lugar.X;
            double dy = l.Arena.Heroi.Y - lugar.Y;
            double limite = AlcanceNaArena(Masmorra(l).Hero) + folga;
            return dx * dx + dy * dy <= limite * limite;
        }

        /// <summary>O monstro de pé na área da mira em volta de (x, y): o mais perto do cursor; null, nenhum. No empate, o primeiro.</summary>
        private static double? MonstroNaMira(Luta l, double x, double y)
        {
            double? melhor = null;
            double menor = 0;
            foreach (var m in l.Arena.Monstros)
            {
                if (m.Fase == "caido") continue;
                var lugar = LugarDe(l, m.Indice);
                double dx = x - lugar.X;
                double dy = y - lugar.Y;
                double distancia = dx * dx + dy * dy;
                if (distancia > D.AreaDaMira * D.AreaDaMira) continue;
                if (melhor == null || distancia < menor)
                {
                    melhor = m.Indice;
                    menor = distancia;
                }
            }
            return melhor;
        }

        /// <summary>O monstro de pé mais perto do herói que a arma de perto alcança; null, nenhum. No empate, o primeiro.</summary>
        private static double? MaisPertoAoAlcance(Luta l)
        {
            double? melhor = null;
            double menor = 0;
            foreach (var m in l.Arena.Monstros)
            {
                if (m.Fase == "caido" || !Alcanca(l, m.Indice)) continue;
                var lugar = LugarDe(l, m.Indice);
                double dx = l.Arena.Heroi.X - lugar.X;
                double dy = l.Arena.Heroi.Y - lugar.Y;
                double distancia = dx * dx + dy * dy;
                if (melhor == null || distancia < menor)
                {
                    melhor = m.Indice;
                    menor = distancia;
                }
            }
            return melhor;
        }

        /// <summary>Um rumo de comprimento <paramref name="velocidade"/> de (0,0) até (dx, dy), em inteiros.</summary>
        private static (double X, double Y) Rumo(double dx, double dy, double velocidade)
        {
            double comprimento = Math.Sqrt(dx * dx + dy * dy);
            if (comprimento == 0) return (0, velocidade);
            return (Math.Truncate(dx * velocidade / comprimento), Math.Truncate(dy * velocidade / comprimento));
        }

        /// <summary>O círculo de raio <paramref name="raio"/> em (x, y) encosta no herói?</summary>
        private static bool Encosta(Walker heroi, double x, double y, double raio)
        {
            double dx = heroi.X - x;
            double dy = heroi.Y - y;
            double limite = raio + D.RaioDoHeroi;
            return dx * dx + dy * dy <= limite * limite;
        }

        /// <summary>O ponto (x, y) chegou na parede em volta da sala? É onde a investida e o tiro acabam.</summary>
        private static bool ForaDoChao(Luta l, double x, double y)
        {
            var g = Geometria(l);
            double t = RoomWalk.TileUnits;
            return x < t || x > (g.Cols - 1) * t || y < t || y > (g.Rows - 1) * t;
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

        /// <summary>Tocar num monstro de pé faz dele o alvo. Caído, ou um índice que não existe, não muda nada.</summary>
        private static void Mirar(Luta l, double indice)
        {
            var m = MonstroDaArena(l, indice);
            if (m != null && m.Fase != "caido")
            {
                l.Arena.Alvo = m.Indice;
                l.Arena.Escolhido = true;
            }
        }

        /// <summary>Sem monstro na área do cursor: o golpe vai no chão, sem evento, e o botão espera a recarga como depois de um golpe.</summary>
        private static void GolpeNoChao(Luta l, double x, double y)
        {
            l.Arena.Recarga = D.RecargaDoAtaque;
            Contar(l, new Acontecimento { Tipo = "numero", Onde = "chao", X = Math.Truncate(x), Y = Math.Truncate(y), Texto = "Errou", Tom = "erro" });
            Contar(l, Som("miss"));
        }

        /// <summary>O ataque do botão: o da classe primeiro; o mágico sem mana pro golpe de magia cai pro físico.</summary>
        private static string EstiloDoBotao(Hero hero)
        {
            var ataques = Attack.AtaquesDisponiveis(hero);
            foreach (var a in ataques)
                if (hero.Mp >= a.Custo) return a.Estilo;
            return ataques[ataques.Count - 1].Estilo;
        }

        /// <summary>
        /// O botão de ataque abre o evento da arma no alvo, que precisa estar ao alcance da classe. No PC o alvo é o
        /// monstro na área do cursor; sem nenhum, o golpe vai no chão, ali. Sem cursor (o celular), é o da placa, se o
        /// jogador escolheu e ele está ao alcance, ou o de pé mais perto que estiver (e ele vira o alvo). Fora do
        /// alcance, o botão só avisa.
        /// </summary>
        private static void AbrirEvento(Luta l, EntradaDaLuta entrada)
        {
            double? alvo;
            if (entrada.Cursor != null)
            {
                alvo = MonstroNaMira(l, entrada.Cursor.X, entrada.Cursor.Y);
                if (alvo == null)
                {
                    GolpeNoChao(l, entrada.Cursor.X, entrada.Cursor.Y);
                    return;
                }
                l.Arena.Alvo = alvo.Value;
                if (!Alcanca(l, alvo.Value))
                {
                    Contar(l, Aviso("Chegue mais perto"));
                    return;
                }
            }
            else
            {
                alvo = AlvoAtual(l);
                if (alvo == null) return;
                if (l.Arena.Escolhido != true || !Alcanca(l, alvo.Value))
                {
                    var perto = MaisPertoAoAlcance(l);
                    if (perto == null)
                    {
                        Contar(l, Aviso("Chegue mais perto"));
                        return;
                    }
                    alvo = perto;
                    l.Arena.Alvo = perto.Value;
                }
            }
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
        /// (um companheiro, o veneno), cai no alvo de agora. Com arma de perto, quem se afastou do alvo durante o
        /// evento erra (sem dado).
        /// </summary>
        private static void Golpear(Luta l)
        {
            var aberto = l.Arena.Evento;
            l.Arena.Evento = null;
            l.Arena.Recarga = D.RecargaDoAtaque;
            var leitura = EventosDeArma.LerEvento(aberto.Evento, aberto.Jogada);
            if (aberto.Poder != null)
            {
                // O poder mágico sai na força do evento; errado, mais fraco.
                UsarPoder(l, aberto.Poder, leitura.Acerto ? leitura.Forca : D.ForcaDoPoderErrado);
                return;
            }
            var doEvento = l.Arena.Monstros[(int)aberto.Alvo];
            double? indice = doEvento.Fase != "caido" ? doEvento.Indice : AlvoAtual(l);
            if (indice == null) return;
            if (!Alcanca(l, indice.Value, D.FolgaDoAlcance))
            {
                Contar(l, Numero("monstro", indice.Value, "Longe", "erro"));
                Contar(l, Som("miss"));
                return;
            }
            double dado = 1 + Rng.RandomInt(Attack.LadosDoDano, l.Rng);
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
                new ResolveAttackOptions { Rng = l.Rng, PetCriticoBonus = Pets.Bonus(l.Pet).Critico ?? 0, DanoDaClasse = ClassesDeLuta.De(estado.Hero).Dano });
            var comHeroi = estado.Clone();
            // O golpe que acerta treina o atributo dele (Treino).
            comHeroi.Hero = golpe.Outcome == "hit" ? Treino.AnotarUso(golpe.Hero, Treino.AtributoDoGolpe(golpe.Hero, estilo)) : golpe.Hero;
            var ferida = FerirNaArena(l, comHeroi, alvo.Indice, golpe.Monster);

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
            Contar(l, NumeroNoMonstro(ferida, alvo.Indice, "-" + Js.NumberToString(golpe.Damage ?? 0), golpe.IsCrit == true ? "critico" : "dano"));
            Contar(l, Som(golpe.IsCrit == true ? "crit" : "hit"));
            if (!ferida.Protegido) RoubarVida(l, golpe.Damage ?? 0);
            if (ferida.Caiu)
            {
                Abater(l, alvo.Indice, golpe.Monster);
                return;
            }
            if (!ferida.Protegido) AplicarRunasDoGolpe(l, alvo.Indice, Monsters.View(ferida.Monstro), golpe.Damage ?? 0);
        }

        /// <summary>
        /// TS: ferirNaArena — grava o golpe no monstro com a regra do chefe final (<see cref="ChefeFinal.FerirMonstro"/>):
        /// o protegido não sente nada, e o que chega à metade chama os lacaios — eles entram no palco esperando a vez,
        /// e o alvo passa pro primeiro deles.
        /// </summary>
        private static Ferida FerirNaArena(Luta l, EstadoNaMasmorra estado, double indice, CombatMonster depois)
        {
            if (NoEspelho(l)) return FerirNoEspelho(l, estado, indice, depois);
            var ferida = ChefeFinal.FerirMonstro(estado, indice, depois, l.Rng);
            l.Estado = ferida.Estado;
            if (ferida.Lacaios.Count > 0)
            {
                foreach (var novo in ferida.Lacaios)
                    l.Arena.Monstros.Add(new MonstroNaArena { Indice = novo, Fase = "esperando", Tempo = 0, Forca = 1, Alvo = -1, X = 0, Y = 0, RumoX = 0, RumoY = 0, CorpoX = 0, CorpoY = 0 });
                PorOsLacaios(l, ferida.Lacaios);
                l.Arena.Alvo = ferida.Lacaios[0];
            }
            // O chefe final que chamou os lacaios tem o texto dele; o de andar 5 diz o que as mecânicas fizeram.
            var textos = ferida.Lacaios.Count > 0 && ferida.Monstro.ChefeFinal == true
                ? new List<string> { ChefeFinal.TextoDosLacaios(Js.Str(Monsters.View(ferida.Monstro).Name)) }
                : ferida.Textos;
            foreach (var texto in textos) Contar(l, Aviso(texto));
            if (textos.Count > 0) Diario(l, textos.ToArray());
            return ferida;
        }

        /// <summary>TS: numeroNoMonstro — o dano, ou o escudo quando o chefe final está protegido pelos lacaios.</summary>
        private static Acontecimento NumeroNoMonstro(Ferida ferida, double indice, string texto, string tom) =>
            ferida.Protegido ? Numero("monstro", indice, "🛡️", "erro") : Numero("monstro", indice, texto, tom);

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
            var ferida = FerirNaArena(l, comHeroi, indice, runas.Monster);
            foreach (var disparo in runas.Disparos)
            {
                string icone = Runas.IconeDe(disparo.Runa);
                if (disparo.Runa == "vampirica")
                {
                    if (disparo.Valor > 0) Contar(l, Numero("heroi", 0, icone + "+" + Js.NumberToString(disparo.Valor), "cura"));
                }
                else if (disparo.Runa == "eletrica")
                {
                    Contar(l, NumeroNoMonstro(ferida, indice, icone + "-" + Js.NumberToString(disparo.Valor), "dano"));
                }
                else
                {
                    // Queimar e gelar só marcam o monstro, como o 💫 e o 🐌: sem dano agora, ele não treme.
                    Contar(l, Numero("monstro", indice, icone, "erro"));
                }
            }
            if (ferida.Caiu) Abater(l, indice, runas.Monster);
        }

        // ---------- poderes e itens ----------

        /// <summary>
        /// TS: pedirPoder — o botão de um poder: o mágico (TiposDePoderMagico) abre o evento dele (as letras no PC, o
        /// desenho no celular) e só sai quando o evento acaba; os outros saem na hora. Sem mana, o mágico avisa antes.
        /// </summary>
        private static void PedirPoder(Luta l, string id)
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
            if (!D.TiposDePoderMagico.Contains(poder.Type))
            {
                UsarPoder(l, id);
                return;
            }
            var alvo = AlvoAtual(l);
            if (alvo == null) return;
            if (estado.Hero.Mp < UsePower.PowerManaCost(estado.Hero, poder, AcessoriosUnicos.DescontoDeMana(estado.Hero)))
            {
                Contar(l, Aviso("Mana insuficiente para " + poder.Name));
                return;
            }
            l.Arena.Evento = new EventoAberto { Evento = EventosDeArma.EventoDoPoder(l.Rng, l.Teclado), Passo = 0, Jogada = new JogadaDoEvento(), Alvo = alvo.Value, Estilo = "magic", Poder = id };
        }

        private static void UsarPoder(Luta l, string id, double forcaDoEvento = 1)
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
                new UsePowerOptions
                {
                    Rng = l.Rng,
                    PetCuraBonus = bonus.Healing ?? 0,
                    PetManaSaveChance = bonus.ManaSave ?? 0,
                    // A Coroa do Arquimago tira parte do custo: só aqui, na arena.
                    DescontoDeMana = AcessoriosUnicos.DescontoDeMana(estado.Hero) > 0 ? AcessoriosUnicos.DescontoDeMana(estado.Hero) : (double?)null,
                    DanoDaClasse = ClassesDeLuta.De(estado.Hero).Dano,
                    ForcaDoEvento = forcaDoEvento != 1 ? forcaDoEvento : (double?)null,
                });
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
            // O poder usado treina o atributo dele e sobe o próprio nível pelo uso.
            var treino = Treino.TreinarPoder(uso.Hero, poder.Id, poder.Type);
            if (treino.Subiu.HasValue)
            {
                Diario(l, new[] { Treino.TextoDaHabilidade(poder.Name, treino.Subiu.Value) });
                Contar(l, Aviso("⭐ " + poder.Name + " nível " + Js.NumberToString(treino.Subiu.Value)));
            }
            var comUso = estado.Clone();
            comUso.Hero = treino.Hero;
            comUso.Party = uso.Party;
            var ferida = FerirNaArena(l, comUso, alvo.Value, uso.Monster);

            if (uso.Outcome == UsePowerOutcomes.Damage)
            {
                Contar(l, NumeroNoMonstro(ferida, alvo.Value, poder.Icon + " -" + Js.NumberToString(uso.Damage ?? 0), "critico"));
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
            if (ferida.Caiu) Abater(l, alvo.Value, uso.Monster);
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

        /// <summary>
        /// TS: moverHeroi — o herói anda pela sala com a regra de sempre (RoomWalk.Tick): as portas fechadas (só se sai
        /// vencendo ou caindo), as paredes de dentro da masmorra e cada monstro de pé tomando a casa em que está (o que voa na investida não). A casa de
        /// monstro em que o herói já está pisando não conta: ele sai dela andando.
        /// </summary>
        private static Walker MoverHeroi(Luta l, EntradaDaLuta entrada)
        {
            var heroi = l.Arena.Heroi;
            if (Math.Truncate(entrada.X) == 0 && Math.Truncate(entrada.Y) == 0) return heroi;
            var formato = Geometria(l);
            var monstros = new List<RoomObject>();
            double t = RoomWalk.TileUnits;
            double meio = RoomWalk.HeroHalf;
            foreach (var m in l.Arena.Monstros)
            {
                if (m.Fase == "caido" || m.Fase == "investindo") continue;
                var lugar = (Col: Math.Floor(m.CorpoX / t), Row: Math.Floor(m.CorpoY / t));
                bool pisando =
                    heroi.X + meio > lugar.Col * t &&
                    heroi.X - meio < (lugar.Col + 1) * t &&
                    heroi.Y + meio > lugar.Row * t &&
                    heroi.Y - meio < (lugar.Row + 1) * t;
                if (!pisando) monstros.Add(new RoomObject { Id = "monstro_" + Js.NumberToString(m.Indice), Col = lugar.Col, Row = lugar.Row });
            }
            var planta = RoomWalk.Layout(new DoorMap(), monstros, ArteDaSala.ParedesDaSala(Masmorra(l).Masmorra.Dungeon), formato);
            return RoomWalk.Tick(planta, heroi, new WalkInput { X = entrada.X, Y = entrada.Y }, VelocidadeNaArena(Masmorra(l).Hero)).Walker;
        }

        private static void PassoDoMundo(Luta l, EntradaDaLuta entrada)
        {
            var arena = l.Arena;
            arena.Passo += 1;
            arena.Heroi = MoverHeroi(l, entrada);
            if (arena.Recarga > 0) arena.Recarga -= 1;
            if (arena.RecargaDoItem > 0) arena.RecargaDoItem -= 1;
            if (arena.Intervalo > 0) arena.Intervalo -= 1;
            foreach (var id in new List<string>(arena.RecargaDosPoderes.Keys))
            {
                double falta = arena.RecargaDosPoderes.Get(id) - 1;
                if (falta > 0) arena.RecargaDosPoderes.Set(id, falta);
                else arena.RecargaDosPoderes.Remove(id);
            }

            if (NoEspelho(l))
            {
                PassoDoEspelho(l);
            }
            else
            {
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
            }
            if (l.Fim != null) return;
            if (arena.Dupla?.Fantasma != true)
            {
                foreach (var c in arena.Companheiros)
                {
                    if (l.Fim != null) return;
                    AgirCompanheiro(l, c);
                }
            }
            if (!NoEspelho(l)) MoverTiros(l);
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
            var jeito = JeitoDoGolpe(MonstroNo(l, m.Indice), m.Poder);
            switch (m.Fase)
            {
                case "esperando":
                    // O respiro dele corre enquanto anda atrás do herói.
                    if (m.Tempo > 0) m.Tempo -= 1;
                    Aproximar(l, m, jeito);
                    return;
                case "avisando":
                    m.Tempo -= 1;
                    if (m.Tempo <= 0) SoltarGolpe(l, m, jeito);
                    return;
                case "investindo":
                    Investir(l, m, jeito);
                    return;
                default:
                    // Descansando, atordoado, hesitando: parado até o tempo acabar; aí volta a andar, no respiro dele.
                    m.Tempo -= 1;
                    if (m.Tempo <= 0)
                    {
                        m.Fase = "esperando";
                        m.Tempo = D.RespiroDoMonstro;
                    }
                    return;
            }
        }

        /// <summary>A distância (ao quadrado) do corpo do monstro ao herói.</summary>
        private static double DistanciaDoHeroi(Luta l, MonstroNaArena m)
        {
            var quem = PresaDe(l, m);
            double dx = quem.X - m.CorpoX;
            double dy = quem.Y - m.CorpoY;
            return dx * dx + dy * dy;
        }

        /// <summary>O monstro está perto o bastante do herói pro golpe dele começar?</summary>
        private static bool ADistanciaDoGolpe(Luta l, MonstroNaArena m, JeitoDeLutar jeito) =>
            DistanciaDoHeroi(l, m) <= jeito.Distancia * jeito.Distancia;

        /// <summary>
        /// TS: aproximar — o monstro esperando anda em linha reta pro herói, no passo dele, até a distância do golpe.
        /// Não sai do chão da sala, não entra em casa de parede e não encosta em outro monstro de pé: barrado, fica
        /// onde está neste passo.
        /// </summary>
        private static void Aproximar(Luta l, MonstroNaArena m, JeitoDeLutar jeito)
        {
            EscolherPresa(l, m);
            if (ADistanciaDoGolpe(l, m, jeito)) return;
            var heroi = PresaDe(l, m);
            var r = Rumo(heroi.X - m.CorpoX, heroi.Y - m.CorpoY, jeito.Passo);
            var formato = Geometria(l);
            double meia = RoomWalk.TileUnits / 2;
            double x = Math.Min(Math.Max(m.CorpoX + r.X, RoomWalk.TileUnits + meia), (formato.Cols - 1) * RoomWalk.TileUnits - meia);
            double y = Math.Min(Math.Max(m.CorpoY + r.Y, RoomWalk.TileUnits + meia), (formato.Rows - 1) * RoomWalk.TileUnits - meia);
            double col = Math.Floor(x / RoomWalk.TileUnits);
            double row = Math.Floor(y / RoomWalk.TileUnits);
            foreach (var casa in ArteDaSala.ParedesDaSala(Masmorra(l).Masmorra.Dungeon))
                if (casa.Col == col && casa.Row == row) return;
            foreach (var outro in l.Arena.Monstros)
            {
                if (outro == m || outro.Fase == "caido") continue;
                double dx = outro.CorpoX - x;
                double dy = outro.CorpoY - y;
                double antesX = outro.CorpoX - m.CorpoX;
                double antesY = outro.CorpoY - m.CorpoY;
                // Só barra quem chegaria mais perto do outro: afastar-se sempre pode.
                if (dx * dx + dy * dy < D.EspacoEntreMonstros * D.EspacoEntreMonstros && dx * dx + dy * dy < antesX * antesX + antesY * antesY) return;
            }
            m.CorpoX = x;
            m.CorpoY = y;
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
                if (m.Fase != "esperando" || m.Tempo > 0) continue;
                if (ADistanciaDoGolpe(l, m, JeitoDe(MonstroNo(l, m.Indice)))) return m;
            }
            return null;
        }

        /// <summary>
        /// O monstro tenta golpear: atordoado ou lento demais, perde o golpe; senão sorteia em quem cai, como no
        /// site, e o aviso começa. Golpe no herói trava o desenho no chão (o círculo e a investida miram onde o
        /// herói está agora). Perder a vez também é a vez: o respiro do próximo começa igual.
        ///
        /// O chefe final, na vez de um poder (<see cref="ChefeFinal.PoderDaVez"/>), avisa o nome dele e mira sempre o
        /// herói: o Golpe Devastador com o dobro da força, o Rugido com a de sempre, mas pegando também os
        /// companheiros quando o aviso acaba. O poder conta já no começo, pra o aviso do próximo sair certo.
        /// </summary>
        private static void ComecarGolpe(Luta l, MonstroNaArena m)
        {
            var estado = Masmorra(l);
            var monstro = MonstroNo(l, m.Indice);
            string poder = ChefeFinal.PoderDaVez(monstro);
            var jeito = JeitoDoGolpe(monstro, poder);
            var inicio = MonsterHit.StartMonsterAttack(monstro, estado.Hero, l.Rng);
            bool solta = poder != null && inicio.Outcome == MonsterAttackStart.Ready;
            CombatMonster gravado = inicio.Monster;
            if (solta)
            {
                var contado = inicio.Monster.Clone();
                contado.Poderes = (inicio.Monster.Poderes ?? 0) + 1;
                gravado = contado;
            }
            var comHeroi = estado.Clone();
            comHeroi.Hero = inicio.Hero;
            l.Estado = FimDaLuta.GravarMonstro(comHeroi, m.Indice, gravado);
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
            if (solta)
            {
                m.Poder = poder;
                m.Alvo = -1;
                if (poder == ChefeFinal.Devastador) m.Forca = inicio.AttackMult * ChefeFinal.ForcaDoDevastador;
                var def = ChefeFinal.Poder(poder);
                Contar(l, Aviso(def.Icone + " " + Js.Str(monstro.Name) + ": " + def.Nome + "!"));
            }
            else
            {
                m.Alvo = MonsterHit.PickMonsterTarget(Masmorra(l).Party ?? new List<Companion>(), l.Rng) ?? -1;
            }
            m.RumoX = 0;
            m.RumoY = 0;
            if (m.Alvo >= 0)
            {
                // No companheiro: fora do chão, cai como no site quando o aviso acaba.
                m.X = 0;
                m.Y = 0;
                return;
            }
            var heroi = PresaDe(l, m);
            if (jeito.Golpe == "perto")
            {
                m.X = heroi.X;
                m.Y = heroi.Y;
                return;
            }
            // A investida e o tiro saem da casa do monstro.
            var lugar = LugarDe(l, m.Indice);
            m.X = lugar.X;
            m.Y = lugar.Y;
            if (jeito.Golpe == "investida")
            {
                var r = Rumo(heroi.X - m.X, heroi.Y - m.Y, jeito.Velocidade);
                m.RumoX = r.X;
                m.RumoY = r.Y;
            }
        }

        /// <summary>O aviso acabou: o golpe sai. O Rugido do chefe final pega antes cada companheiro de pé.</summary>
        private static void SoltarGolpe(Luta l, MonstroNaArena m, JeitoDeLutar jeito)
        {
            if (m.Poder == ChefeFinal.Rugido) RugirNaEquipe(l, m);
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
                // A bola mira onde o herói está agora, no fim do aviso.
                var heroi = PresaDe(l, m);
                var v = Rumo(heroi.X - m.X, heroi.Y - m.Y, jeito.Velocidade);
                l.Arena.Tiros.Add(new Tiro { X = m.X, Y = m.Y, Vx = v.X, Vy = v.Y, Raio = jeito.Tamanho, Vida = D.VidaDoTiro, Indice = m.Indice, Forca = m.Forca });
                Descansar(l, m, jeito);
                return;
            }
            if (Pega(l, m.X, m.Y, jeito.Tamanho)) GolpeNoHeroi(l, m.Indice, m.Forca);
            // O golpe no parceiro quem julga é o app dele: daqui não dá pra dizer que errou.
            else if (m.NoParceiro != true) Contar(l, Numero("monstro", m.Indice, "Errou", "erro"));
            Descansar(l, m, jeito);
        }

        /// <summary>TS: rugirNaEquipe — o Rugido do chefe final pega cada companheiro de pé, na força do golpe.</summary>
        private static void RugirNaEquipe(Luta l, MonstroNaArena m)
        {
            var estado = Masmorra(l);
            var monstro = MonstroNo(l, m.Indice);
            var equipe = estado.Party ?? new List<Companion>();
            var novaEquipe = new List<Companion>(equipe.Count);
            for (int i = 0; i < equipe.Count; i++)
            {
                var membro = equipe[i];
                if (membro.Hp <= 0)
                {
                    novaEquipe.Add(membro);
                    continue;
                }
                var acerto = MonsterHit.HitPartyMember(membro, monstro, m.Forca, l.Rng);
                Contar(l, Numero("companheiro", i, "-" + Js.NumberToString(acerto.Damage), "dano"));
                if (acerto.Defeated) Diario(l, new[] { Js.Str(membro.Name) + " caiu!" });
                novaEquipe.Add(acerto.Member);
            }
            var comEquipe = estado.Clone();
            comEquipe.Party = novaEquipe;
            l.Estado = comEquipe;
        }

        /// <summary>O golpe acabou: o monstro descansa, e o próximo golpe espera o respiro.</summary>
        private static void Descansar(Luta l, MonstroNaArena m, JeitoDeLutar jeito)
        {
            m.Poder = null;
            if (l.Fim != null) return;
            m.Fase = "descansando";
            m.Tempo = jeito.Descanso;
            l.Arena.Intervalo = D.IntervaloEntreGolpes;
        }

        /// <summary>A investida segue pelo rumo travado: encostou no herói, pega e para; chegou na parede, acabou. O monstro fica onde ela acabou.</summary>
        private static void Investir(Luta l, MonstroNaArena m, JeitoDeLutar jeito)
        {
            m.X += m.RumoX;
            m.Y += m.RumoY;
            if (Pega(l, m.X, m.Y, jeito.Tamanho))
            {
                Pousar(l, m, jeito.Tamanho);
                GolpeNoHeroi(l, m.Indice, m.Forca);
                Descansar(l, m, jeito);
                return;
            }
            // Bateu no parceiro: para ali (o golpe quem julga é o app dele).
            if (PegaOParceiro(l, m.X, m.Y, jeito.Tamanho))
            {
                Pousar(l, m);
                Descansar(l, m, jeito);
                return;
            }
            if (ForaDoChao(l, m.X, m.Y))
            {
                Pousar(l, m);
                Contar(l, Numero("monstro", m.Indice, "Errou", "erro"));
                Descansar(l, m, jeito);
            }
        }

        /// <summary>
        /// O golpe do monstro pegou no herói: a regra do site, com a esquiva de sempre, mais a armadura encantada (que só
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
                // Esquivar treina a Destreza.
                desviou.Hero = Treino.AnotarUso(golpe.Hero, "destreza");
                l.Estado = FimDaLuta.GravarMonstro(desviou, indice, golpe.Monster);
                Contar(l, Numero("heroi", 0, "Desviou", "erro"));
                Contar(l, Som("miss"));
                return;
            }
            var hero = NoEscudo(l, estado.Hero.Hp, golpe.Hero, golpe.Damage);
            // Os pesados (os Brutamontes) também quebram osso, como o chefe já quebra (doc do Breno de 2026-11-15; só aqui).
            string quebrou = golpe.Quebrou;
            if (!Js.Truthy(quebrou) && !monstro.IsBoss && monstro.EnemyClassId == "brutamontes" && l.Rng() < FerimentosDoHeroi.ChanceDeQuebrarNoChefe)
            {
                var quebra = FerimentosDoHeroi.QuebrarMembro(hero, l.Rng);
                hero = quebra.Hero;
                quebrou = quebra.Membro;
            }
            var comHeroi = estado.Clone();
            comHeroi.Hero = hero;
            l.Estado = FimDaLuta.GravarMonstro(comHeroi, indice, golpe.Monster);
            Contar(l, Som("hit"));
            if (Js.Truthy(quebrou))
            {
                string texto = "🦴 " + Js.Str(monstro.Name) + " quebrou " + FerimentosDoHeroi.NomeDoMembro(quebrou) + "!";
                Contar(l, Aviso(texto));
                Diario(l, new List<string> { texto });
            }
            if (golpe.ManaDrained > 0) Contar(l, Aviso(Js.Str(monstro.Name) + " drena " + Js.NumberToString(golpe.ManaDrained) + " de mana"));
            if (golpe.DrainResisted == true) Contar(l, Aviso("Sua armadura segura o dreno de mana"));
            if (golpe.PoisonApplied) Contar(l, Aviso("Você foi envenenado"));
            if (golpe.PoisonResisted == true) Contar(l, Aviso("Sua armadura segura o veneno"));
            if (hero.Hp <= 0) Cair(l);
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
            var ferida = FerirNaArena(l, comHeroi, alvo.Value, acao.Monster);
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
                Contar(l, NumeroNoMonstro(ferida, alvo.Value, "-" + Js.NumberToString(resultado.Amount ?? 0), "dano"));
                if (ferida.Caiu) Abater(l, alvo.Value, Monsters.View(acao.Monster));
            }
        }

        /// <summary>As bolas voam; a que encosta no herói pega, a que chega na parede (ou acaba) errou.</summary>
        private static void MoverTiros(Luta l)
        {
            var ficam = new List<Tiro>();
            foreach (var t in l.Arena.Tiros)
            {
                if (l.Fim != null) break;
                t.X += t.Vx;
                t.Y += t.Vy;
                t.Vida -= 1;
                if (t.Vida <= 0 || ForaDoChao(l, t.X, t.Y))
                {
                    Contar(l, Numero("monstro", t.Indice, "Errou", "erro"));
                    continue;
                }
                if (Pega(l, t.X, t.Y, t.Raio))
                {
                    GolpeNoHeroi(l, t.Indice, t.Forca);
                    continue;
                }
                // A bola some no parceiro (o golpe quem julga é o app dele).
                if (PegaOParceiro(l, t.X, t.Y, t.Raio)) continue;
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
            if (heroi.Hp <= 0 && l.Arena.Dupla?.Fantasma != true)
            {
                Diario(l, new[] { "O veneno foi mais forte." });
                Cair(l);
                if (l.Fim != null) return;
            }
            Regenerar(l);

            // No espelho, o veneno e o fogo dos monstros correm no app do anfitrião.
            foreach (var indice in NoEspelho(l) ? new List<double>() : FimDaLuta.IndicesDePe(Sala(l)))
            {
                var monstro = MonstroNo(l, indice);
                var dot = StatusEffects.TickMonsterDot(monstro);
                var ferida = FerirNaArena(l, Masmorra(l), indice, dot.Monster);
                if (dot.Damage > 0) Contar(l, NumeroNoMonstro(ferida, indice, "-" + Js.NumberToString(dot.Damage), "dano"));
                if (ferida.Caiu) Abater(l, indice, Monsters.View(dot.Monster));
                if (l.Fim != null) return;
            }

            var comCancao = Masmorra(l).Clone();
            comCancao.Hero = Party.PassarRodadaDaCancao(comCancao.Hero);
            l.Estado = comCancao;
        }

        // ---------- os acessórios únicos (AcessoriosUnicos; só a arena os aplica) ----------

        /// <summary>TS: roubarVida — a Presa do Morcego: o golpe que acertou devolve em vida parte do dano.</summary>
        private static void RoubarVida(Luta l, double dano)
        {
            var estado = Masmorra(l);
            var efeito = AcessoriosUnicos.EfeitoDoUnico(estado.Hero);
            if (efeito == null || efeito.Efeito != "roubo_de_vida" || dano <= 0) return;
            var hero = estado.Hero;
            double cura = Js.Max(0, Js.Min(hero.MaxHp - hero.Hp, Js.Max(1, Js.Round(dano * efeito.Valor))));
            if (cura <= 0) return;
            var curado = hero.Clone();
            curado.Hp = hero.Hp + cura;
            var comCura = estado.Clone();
            comCura.Hero = curado;
            l.Estado = comCura;
            Contar(l, Numero("heroi", 0, "🦇+" + Js.NumberToString(cura), "cura"));
        }

        /// <summary>TS: regenerar — o Amuleto da Floresta Antiga: a cada rodada da luta, uma parte da vida máxima volta.</summary>
        private static void Regenerar(Luta l)
        {
            var estado = Masmorra(l);
            var efeito = AcessoriosUnicos.EfeitoDoUnico(estado.Hero);
            var hero = estado.Hero;
            if (efeito == null || efeito.Efeito != "regeneracao" || hero.Hp <= 0 || hero.Hp >= hero.MaxHp) return;
            double cura = Js.Min(hero.MaxHp - hero.Hp, Js.Max(1, Math.Floor(hero.MaxHp * efeito.Valor)));
            var curado = hero.Clone();
            curado.Hp = hero.Hp + cura;
            var comCura = estado.Clone();
            comCura.Hero = curado;
            l.Estado = comCura;
            Contar(l, Numero("heroi", 0, "🌲+" + Js.NumberToString(cura), "cura"));
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
            // O escolhido caiu: o ataque volta a ir no mais perto.
            if (indice == l.Arena.Alvo) l.Arena.Escolhido = null;
            var pago = FimDaLuta.PagarAbate(Masmorra(l), abatido);
            // Caiu o último lacaio: o chefe final fica furioso.
            var furia = ChefeFinal.Enfurecer(pago.Estado);
            l.Estado = furia.Estado;
            Diario(l, pago.Log);
            Diario(l, furia.Log);
            foreach (var texto in furia.Log) Contar(l, Aviso(texto));
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
            if (limpa.Conquista != null) l.Conquista = limpa.Conquista;
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
        // ---------- a luta em dupla ----------

        private static bool NoEspelho(Luta l) => l.Arena.Dupla?.Papel == "convidado";

        /// <summary>O parceiro está de pé na sala, e eu sei onde.</summary>
        private static PontoNaSala ParceiroDePe(Luta l)
        {
            var dupla = l.Arena.Dupla;
            if (dupla == null || dupla.Parceiro == null || dupla.ParceiroCaido == true) return null;
            return dupla.Parceiro;
        }

        /// <summary>Atrás de quem o monstro vai: o parceiro, se foi quem ele escolheu e ainda está de pé; senão o herói daqui.</summary>
        private static (double X, double Y) PresaDe(Luta l, MonstroNaArena m)
        {
            var parceiro = m.NoParceiro == true ? ParceiroDePe(l) : null;
            return parceiro != null ? (parceiro.X, parceiro.Y) : (l.Arena.Heroi.X, l.Arena.Heroi.Y);
        }

        /// <summary>TS: escolherPresa — em dupla, o monstro que espera escolhe o herói de pé mais perto do corpo dele. Sem sorteio.</summary>
        private static void EscolherPresa(Luta l, MonstroNaArena m)
        {
            var parceiro = ParceiroDePe(l);
            if (parceiro == null)
            {
                m.NoParceiro = null;
                return;
            }
            if (l.Arena.Dupla?.Fantasma == true)
            {
                m.NoParceiro = true;
                return;
            }
            var heroi = l.Arena.Heroi;
            double daqui = (heroi.X - m.CorpoX) * (heroi.X - m.CorpoX) + (heroi.Y - m.CorpoY) * (heroi.Y - m.CorpoY);
            double dele = (parceiro.X - m.CorpoX) * (parceiro.X - m.CorpoX) + (parceiro.Y - m.CorpoY) * (parceiro.Y - m.CorpoY);
            if (dele < daqui) m.NoParceiro = true;
            else m.NoParceiro = null;
        }

        /// <summary>O golpe pega o herói daqui (o fantasma não apanha).</summary>
        private static bool Pega(Luta l, double x, double y, double raio) =>
            l.Arena.Dupla?.Fantasma != true && Encosta(l.Arena.Heroi, x, y, raio);

        private static bool PegaOParceiro(Luta l, double x, double y, double raio)
        {
            var parceiro = ParceiroDePe(l);
            if (parceiro == null) return false;
            double dx = parceiro.X - x;
            double dy = parceiro.Y - y;
            double limite = raio + D.RaioDoHeroi;
            return dx * dx + dy * dy <= limite * limite;
        }

        /// <summary>TS: receberDoParceiro — onde ele está, o dano que causou (no anfitrião) e o espelho (no convidado).</summary>
        private static void ReceberDoParceiro(Luta l, EntradaDaLuta entrada)
        {
            var dupla = l.Arena.Dupla;
            if (entrada.SemParceiro == true)
            {
                // Sozinho de novo: quem estava caído não tem mais quem o levante.
                l.Arena.Dupla = null;
                foreach (var m in l.Arena.Monstros) m.NoParceiro = null;
                if (dupla.Fantasma == true) Perder(l);
                return;
            }
            if (entrada.Parceiro != null)
            {
                dupla.Parceiro = new PontoNaSala { X = Math.Truncate(entrada.Parceiro.X), Y = Math.Truncate(entrada.Parceiro.Y) };
                dupla.ParceiroCaido = entrada.Parceiro.Caido == true ? true : (bool?)null;
            }
            if (dupla.Fantasma == true && Js.Truthy(entrada.Reviver))
            {
                var levantado = Masmorra(l).Clone();
                levantado.Hero = Duplas.Reviver(levantado.Hero, entrada.Reviver.Value);
                l.Estado = levantado;
                dupla.Fantasma = null;
                const string texto = "✨ Seu parceiro reviveu você!";
                Contar(l, Aviso(texto));
                Diario(l, new[] { texto });
                Contar(l, Som("heal"));
            }
            if (dupla.Fantasma == true && dupla.ParceiroCaido == true)
            {
                Perder(l);
                return;
            }
            if (dupla.Papel == "anfitriao")
            {
                if (entrada.DanoDeFora == null) return;
                foreach (var golpe in entrada.DanoDeFora)
                {
                    if (l.Fim != null) return;
                    DanoDoParceiro(l, Math.Truncate(golpe.Indice), Math.Truncate(golpe.Dano));
                }
            }
            else if (entrada.Espelho != null)
            {
                AplicarEspelho(l, entrada.Espelho);
            }
        }

        /// <summary>TS: danoDoParceiro — no anfitrião, o parceiro feriu um monstro. Passa por ferirMonstro, como todo dano.</summary>
        private static void DanoDoParceiro(Luta l, double indice, double dano)
        {
            int i = (int)indice;
            if (i < 0 || i >= l.Arena.Monstros.Count) return;
            var m = l.Arena.Monstros[i];
            if (m.Fase == "caido" || !(dano > 0)) return;
            var depois = CombatMonster.From(Sala(l).Monsters[i]);
            depois.Hp = Math.Max(0, depois.Hp - dano);
            var ferida = FerirNaArena(l, Masmorra(l), indice, depois);
            Contar(l, NumeroNoMonstro(ferida, indice, "-" + Js.NumberToString(dano), "dano"));
            if (ferida.Caiu) Abater(l, indice, Monsters.View(depois));
        }

        /// <summary>
        /// TS: ferirNoEspelho — no espelho o golpe do herói daqui não derruba ninguém: a vida do monstro desce na tela
        /// (até 1), o dano vai pro anfitrião e a queda volta dele.
        /// </summary>
        private static Ferida FerirNoEspelho(Luta l, EstadoNaMasmorra estado, double indice, CombatMonster depois)
        {
            var antes = ((DungeonCell)Estados.CelulaAtual(estado)).Monsters[(int)indice];
            double dano = Math.Max(0, antes.Hp - depois.Hp);
            if (dano > 0) l.Danos.Add(new DanoNoMonstro { Indice = indice, Dano = dano });
            var monstro = CombatMonster.From(depois);
            monstro.Hp = Math.Max(1, Math.Min(antes.Hp, depois.Hp));
            var gravado = FimDaLuta.GravarMonstro(estado, indice, monstro);
            l.Estado = gravado;
            return new Ferida { Estado = gravado, Monstro = monstro, Caiu = false, Protegido = false };
        }

        /// <summary>TS: aplicarEspelho — o estado dos monstros do anfitrião por cima do daqui; quem caiu lá cai aqui, e paga o abate.</summary>
        private static void AplicarEspelho(Luta l, Espelho espelho)
        {
            var arena = l.Arena;
            foreach (var de in espelho.Monstros)
            {
                if (l.Fim != null) return;
                double indice = Math.Truncate(de.Indice);
                var lista = Sala(l).Monsters ?? new List<MonsterInstance>();
                if (indice < 0 || indice > lista.Count) continue;
                // Um lacaio que o espelho ainda não tinha: entra com o monstro inteiro.
                if (indice == lista.Count)
                {
                    if (de.Monstro == null) continue;
                    var estado = Masmorra(l);
                    var celula = ((DungeonCell)Estados.CelulaAtual(estado)).Clone();
                    celula.Monsters = new List<MonsterInstance>(lista) { de.Monstro };
                    l.Estado = Estados.SubstituirCelulaAtual(estado, celula);
                    arena.Monstros.Add(new MonstroNaArena { Indice = indice, Fase = "esperando", Tempo = 0, Forca = 1, Alvo = -1, X = 0, Y = 0, RumoX = 0, RumoY = 0, CorpoX = de.CorpoX, CorpoY = de.CorpoY });
                }
                int i = (int)indice;
                if (i >= arena.Monstros.Count) continue;
                var m = arena.Monstros[i];
                bool jaCaido = m.Fase == "caido";
                var agora = CombatMonster.From(de.Monstro ?? Sala(l).Monsters[i]);
                agora.Hp = Math.Max(0, Math.Truncate(de.Hp));
                l.Estado = FimDaLuta.GravarMonstro(Masmorra(l), indice, agora);
                if (jaCaido) continue;
                if (agora.Hp <= 0 || de.Fase == "caido")
                {
                    Abater(l, indice, Monsters.View(agora));
                    continue;
                }
                // O golpe é o mesmo de antes (mesma fase, ainda correndo): o que já me acertou continua contado.
                bool mesmoGolpe = m.Acertou == true && (de.Fase == "investindo" || de.Fase == "avisando") && (m.Fase == "investindo" || m.Fase == "avisando");
                bool caiuOCirculo = m.Fase == "avisando" && de.Fase != "avisando" && de.Fase != "investindo";
                if (caiuOCirculo) GolpeQueCaiu(l, m);
                m.Fase = de.Fase;
                m.Tempo = de.Tempo;
                m.Forca = de.Forca;
                m.Alvo = de.Alvo;
                m.X = de.X;
                m.Y = de.Y;
                m.RumoX = de.RumoX;
                m.RumoY = de.RumoY;
                m.CorpoX = de.CorpoX;
                m.CorpoY = de.CorpoY;
                m.Poder = Js.Truthy(de.Poder) ? de.Poder : null;
                // Lá ele mira o parceiro do anfitrião, que sou eu: aqui é o herói daqui. E o contrário.
                m.NoParceiro = de.NoParceiro == true ? (bool?)null : true;
                m.Acertou = mesmoGolpe ? true : (bool?)null;
            }
            if (l.Fim != null) return;
            // As bolas: as do anfitrião no lugar das daqui (a que já me acertou não volta).
            var tiros = new List<Tiro>(espelho.Tiros.Count);
            foreach (var t in espelho.Tiros) tiros.Add(t.Clone());
            arena.Tiros = tiros;
        }

        /// <summary>TS: golpeQueCaiu — no espelho, o aviso de um golpe de perto acabou no anfitrião: se o herói daqui está dentro, apanha.</summary>
        private static void GolpeQueCaiu(Luta l, MonstroNaArena m)
        {
            if (m.Alvo >= 0 || m.Acertou == true) return;
            var jeito = JeitoDoGolpe(MonstroNo(l, m.Indice), m.Poder);
            if (jeito.Golpe != "perto") return;
            if (Pega(l, m.X, m.Y, jeito.Tamanho)) GolpeNoHeroi(l, m.Indice, m.Forca);
        }

        /// <summary>
        /// TS: passoDoEspelho — os monstros não pensam: entre um estado e outro do anfitrião, a investida e as bolas
        /// seguem o rumo que tinham, e o que encostar no herói daqui acerta (uma vez por golpe).
        /// </summary>
        private static void PassoDoEspelho(Luta l)
        {
            foreach (var m in l.Arena.Monstros)
            {
                if (l.Fim != null) return;
                if (m.Fase == "avisando")
                {
                    if (m.Tempo > 0) m.Tempo -= 1;
                    continue;
                }
                if (m.Fase != "investindo" || m.Acertou == true) continue;
                m.X += m.RumoX;
                m.Y += m.RumoY;
                if (Pega(l, m.X, m.Y, JeitoDoGolpe(MonstroNo(l, m.Indice), m.Poder).Tamanho))
                {
                    m.Acertou = true;
                    GolpeNoHeroi(l, m.Indice, m.Forca);
                }
            }
            if (l.Fim != null) return;
            var ficam = new List<Tiro>();
            foreach (var t in l.Arena.Tiros)
            {
                if (l.Fim != null) break;
                t.X += t.Vx;
                t.Y += t.Vy;
                if (Pega(l, t.X, t.Y, t.Raio))
                {
                    GolpeNoHeroi(l, t.Indice, t.Forca);
                    continue;
                }
                ficam.Add(t);
            }
            l.Arena.Tiros = ficam;
        }

        /// <summary>
        /// TS: espelhoDaLuta — o que o anfitrião manda pro espelho: os monstros como estão, com a vida.
        /// <paramref name="inteiros"/>: os índices que vão com o monstro inteiro.
        /// </summary>
        public static Espelho EspelhoDaLuta(LutaEmTempoReal luta, IReadOnlyList<double> inteiros = null)
        {
            var espelho = new Espelho();
            if (!(luta.Estado is EstadoNaMasmorra masmorra)) return espelho;
            var lista = ((DungeonCell)Estados.CelulaAtual(masmorra)).Monsters ?? new List<MonsterInstance>();
            foreach (var m in luta.Arena.Monstros)
            {
                var monstro = lista[(int)m.Indice];
                bool inteiro = false;
                if (inteiros != null)
                    foreach (var i in inteiros)
                        if (i == m.Indice) inteiro = true;
                espelho.Monstros.Add(new MonstroNoEspelho
                {
                    Indice = m.Indice, Fase = m.Fase, Tempo = m.Tempo, Forca = m.Forca, Alvo = m.Alvo, X = m.X, Y = m.Y, RumoX = m.RumoX, RumoY = m.RumoY,
                    CorpoX = m.CorpoX, CorpoY = m.CorpoY, Poder = m.Poder, NoParceiro = m.NoParceiro, Hp = monstro.Hp,
                    Monstro = inteiro ? CombatMonster.From(monstro) : null,
                });
            }
            foreach (var t in luta.Arena.Tiros) espelho.Tiros.Add(t.Clone());
            return espelho;
        }

        /// <summary>
        /// TS: cair — o herói daqui ficou sem vida. Na luta de um só (ou sem parceiro de pé), é a derrota de sempre. Em
        /// dupla ele vira fantasma e a luta segue com o outro.
        /// </summary>
        private static void Cair(Luta l)
        {
            var dupla = l.Arena.Dupla;
            if (dupla == null || ParceiroDePe(l) == null)
            {
                Perder(l);
                return;
            }
            if (dupla.Fantasma == true) return;
            dupla.Fantasma = true;
            l.Arena.Evento = null;
            const string texto = "👻 Você caiu! Seu parceiro pode reviver você.";
            Contar(l, Aviso(texto));
            Diario(l, new[] { texto });
            Contar(l, Som("defeat"));
        }

        public static string EventoDoBotao(Hero hero, bool teclado = false) => EventosDeArma.EventoDaArma(hero.Equip.Get("arma")?.TemplateId, teclado);
    }
}
