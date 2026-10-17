using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Posicao — onde o jogador está na grade (<c>{ x, y }</c>).</summary>
    public sealed class Posicao
    {
        public double X;
        public double Y;

        public Posicao() { }

        public Posicao(double x, double y)
        {
            X = x;
            Y = y;
        }
    }

    /// <summary>
    /// TS: EstadoDoJogo — o estado que vive dentro do save (port de shared/src/jogo/estado.ts). É a união
    /// discriminada por <see cref="MapMode"/> do TS: <see cref="EstadoNaCidade"/> (grade de CityCell) ou
    /// <see cref="EstadoNaMasmorra"/> (grade de DungeonCell). Os nomes dos campos são os do save que já está
    /// na nuvem. Do JSON: <c>RPGLegend.Engine.Json.JogoJson.LerEstado</c>, que escolhe a classe pelo mapMode.
    /// </summary>
    public abstract class EstadoDoJogo
    {
        public Hero Hero;
        public List<Companion> Party;
        public List<Item> Inventory;
        public List<Quest> Quests;
        public double Floor;
        public double MapRows;
        public double MapCols;
        /// <summary>A cidade guardada enquanto o jogador está na masmorra (pra ela não ser regerada na volta).</summary>
        [KeepNull] public List<List<CityCell>> CityMap;
        [KeepNull] public Posicao CityStart;
        public Posicao Pos;
        /// <summary>Progresso dos Primeiros Passos. Ausente (null) em save antigo — <see cref="Tutoriais.TutorialDe"/>.</summary>
        public Tutorial Tutorial;
        /// <summary>A masmorra e a dificuldade da descida atual, ou da última. Floor é o andar dentro dela.</summary>
        public DungeonRun Masmorra;
        /// <summary>Masmorras zeradas e totens tocados — o que o portão oferece.</summary>
        public DungeonProgress Progresso;
        /// <summary>"city" ou "dungeon" — fixo em cada subclasse.</summary>
        public string MapMode;

        /// <summary>Campos que o C# não conhece; o <c>{ ...estado }</c> do TS os leva junto.</summary>
        [JsExtra] public JsExtras Extra;

        /// <summary>A grade, qualquer que seja o tipo da sala.</summary>
        [JsIgnore] public abstract IReadOnlyList<IReadOnlyList<RoomCell>> Grade { get; }

        /// <summary>O <c>{ ...estado }</c> do TS: cópia rasa, da mesma classe.</summary>
        public EstadoDoJogo Clone()
        {
            var c = (EstadoDoJogo)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }

        /// <summary>Copia os campos comuns (e os desconhecidos) para outro estado — o <c>{ ...base }</c> do TS.</summary>
        internal void CopiarComunsPara(EstadoDoJogo destino)
        {
            destino.Hero = Hero;
            destino.Party = Party;
            destino.Inventory = Inventory;
            destino.Quests = Quests;
            destino.Floor = Floor;
            destino.MapRows = MapRows;
            destino.MapCols = MapCols;
            destino.CityMap = CityMap;
            destino.CityStart = CityStart;
            destino.Pos = Pos;
            destino.Tutorial = Tutorial;
            destino.Masmorra = Masmorra;
            destino.Progresso = Progresso;
            destino.Extra = Extra?.Clone();
        }
    }

    /// <summary>TS: EstadoNaCidade — <c>mapMode: 'city'</c>.</summary>
    public sealed class EstadoNaCidade : EstadoDoJogo
    {
        public List<List<CityCell>> Map;

        public EstadoNaCidade()
        {
            MapMode = "city";
        }

        [JsIgnore] public override IReadOnlyList<IReadOnlyList<RoomCell>> Grade => Map;

        public new EstadoNaCidade Clone() => (EstadoNaCidade)base.Clone();
    }

    /// <summary>TS: EstadoNaMasmorra — <c>mapMode: 'dungeon'</c>.</summary>
    public sealed class EstadoNaMasmorra : EstadoDoJogo
    {
        public List<List<DungeonCell>> Map;

        public EstadoNaMasmorra()
        {
            MapMode = "dungeon";
        }

        [JsIgnore] public override IReadOnlyList<IReadOnlyList<RoomCell>> Grade => Map;

        public new EstadoNaMasmorra Clone() => (EstadoNaMasmorra)base.Clone();
    }

    /// <summary>
    /// TS: SaveCarregado — o save como veio da nuvem; o de um personagem recém-criado ainda não tem mapa nem
    /// posição. <see cref="Masmorra"/> e <see cref="Progresso"/> chegam crus (o JSON solto que
    /// <see cref="Dungeons.NormalizeRun"/> e <see cref="Dungeons.NormalizeProgress"/> aceitam). Do JSON:
    /// <c>RPGLegend.Engine.Json.JogoJson.LerSave</c>.
    /// </summary>
    public sealed class SaveCarregado
    {
        public Hero Hero;
        public double Floor;
        public List<Companion> Party;
        public List<Item> Inventory;
        public List<Quest> Quests;
        public string MapMode;
        /// <summary>A grade da masmorra. Só é lida quando <see cref="MapMode"/> é "dungeon".</summary>
        [JsIgnore] public List<List<DungeonCell>> Map;
        public double? MapRows;
        public double? MapCols;
        public List<List<CityCell>> CityMap;
        public Posicao CityStart;
        public Posicao Pos;
        public Tutorial Tutorial;
        /// <summary>Valor JS cru (ver a nota de <see cref="Dungeons"/>), ou um DungeonRun já tipado.</summary>
        [JsIgnore] public object Masmorra;
        /// <summary>Valor JS cru, ou um DungeonProgress já tipado.</summary>
        [JsIgnore] public object Progresso;

        /// <summary>O <c>{ ...save }</c> do TS.</summary>
        public SaveCarregado Clone() => (SaveCarregado)MemberwiseClone();

        /// <summary>Um estado que já está em jogo, lido como save — o TS passa um pelo outro, os campos batem.</summary>
        public static SaveCarregado De(EstadoDoJogo estado) => new SaveCarregado
        {
            Hero = estado.Hero,
            Floor = estado.Floor,
            Party = estado.Party,
            Inventory = estado.Inventory,
            Quests = estado.Quests,
            MapMode = estado.MapMode,
            Map = (estado as EstadoNaMasmorra)?.Map,
            MapRows = estado.MapRows,
            MapCols = estado.MapCols,
            CityMap = estado.CityMap,
            CityStart = estado.CityStart,
            Pos = estado.Pos,
            Tutorial = estado.Tutorial,
            Masmorra = estado.Masmorra,
            Progresso = estado.Progresso,
        };
    }

    /// <summary>TS: ResultadoDaEscada — "selado", "fundo" ou "desceu" (só este traz o estado).</summary>
    public sealed class ResultadoDaEscada
    {
        public string Kind;
        public EstadoNaMasmorra Estado;
    }

    /// <summary>As tabelas de jogo/estado.ts (fixtures/data/jogo/estado.json).</summary>
    public sealed class EstadoData
    {
        [JsName("LINHAS_DO_MAPA")] public double LinhasDoMapa;
        [JsName("COLUNAS_DO_MAPA")] public double ColunasDoMapa;
        [JsName("PRIMEIRO_ANDAR")] public double PrimeiroAndar;
    }

    public static partial class GameData
    {
        private static EstadoData _estadoTable;

        /// <summary>jogo/estado: o tamanho da grade e o andar de entrada.</summary>
        public static EstadoData EstadoTable
        {
            get => Require(_estadoTable, "jogo/estado");
            set => _estadoTable = value;
        }
    }

    /// <summary>
    /// O estado de jogo e as transições de lugar (port de shared/src/jogo/estado.ts): cidade → portão →
    /// masmorra, escada pra baixo, saída de volta pra cidade, e o passo de sala em sala.
    /// </summary>
    public static class Estados
    {
        private static EstadoData D => GameData.EstadoTable;

        /// <summary>TS: LINHAS_DO_MAPA.</summary>
        public static double LinhasDoMapa => D.LinhasDoMapa;

        /// <summary>TS: COLUNAS_DO_MAPA.</summary>
        public static double ColunasDoMapa => D.ColunasDoMapa;

        /// <summary>TS: PRIMEIRO_ANDAR — atravessar o portão recomeça do andar 1.</summary>
        public static double PrimeiroAndar => D.PrimeiroAndar;

        /// <summary>TS: comuns — tudo que não depende de onde o jogador está, normalizado.</summary>
        private static void Comuns(SaveCarregado save, EstadoDoJogo destino)
        {
            destino.Hero = save.Hero;
            destino.Party = save.Party ?? new List<Companion>();
            destino.Inventory = save.Inventory ?? new List<Item>();
            destino.Quests = save.Quests ?? new List<Quest>();
            destino.Floor = save.Floor;
            destino.MapRows = save.MapRows ?? LinhasDoMapa;
            destino.MapCols = save.MapCols ?? ColunasDoMapa;
            destino.CityMap = save.CityMap;
            destino.CityStart = save.CityStart;
            // Só entra se o save já tinha (o ...(save.tutorial ? { tutorial } : {}) do TS).
            destino.Tutorial = save.Tutorial;
            destino.Masmorra = Dungeons.NormalizeRun(save.Masmorra);
            destino.Progresso = Verdadeiro(save.Progresso) ? Dungeons.NormalizeProgress(save.Progresso) : Dungeons.LegacyProgress(save.Floor);
        }

        /// <summary>O <c>if (valor)</c> do JS para um valor cru.</summary>
        private static bool Verdadeiro(object valor)
        {
            switch (valor)
            {
                case null:
                    return false;
                case bool b:
                    return b;
                case double d:
                    return Js.Truthy(d);
                case string s:
                    return s.Length > 0;
                default:
                    return true;
            }
        }

        /// <summary>TS: andarDeForca — o andar que os monstros, o ouro e os itens enxergam.</summary>
        public static double AndarDeForca(DungeonRun masmorra, double floor) => Dungeons.EffectiveFloor(masmorra, floor);

        public static double AndarDeForca(EstadoDoJogo estado) => AndarDeForca(estado.Masmorra, estado.Floor);

        private static bool TemCidade(SaveCarregado save) => save.CityMap != null && save.CityMap.Count > 0 && save.CityStart != null;

        /// <summary>
        /// TS: retomarSave — retoma o save onde ele foi gravado. Quem estava na masmorra volta pra ela com o
        /// mesmo andar; save antigo sem mapa gera um andar novo. É o único ponto que hidrata o herói.
        /// </summary>
        public static EstadoDoJogo RetomarSave(SaveCarregado entrada, RngFn rng = null, Func<double> now = null)
        {
            rng = rng ?? Rng.Default;
            var save = entrada.Clone();
            save.Hero = Heroes.HydrateSavedHero(entrada.Hero);

            if (save.MapMode != "dungeon") return EntrarNaCidade(save);

            if (save.Map != null && save.Map.Count > 0 && save.Pos != null)
            {
                var estado = new EstadoNaMasmorra();
                Comuns(save, estado);
                estado.Map = MarcarVisitada(save.Map, save.Pos);
                estado.Pos = save.Pos;
                return estado;
            }

            var semAndar = new EstadoNaMasmorra();
            Comuns(save, semAndar);
            return GerarAndar(semAndar, save.Floor, rng, now);
        }

        /// <summary>
        /// TS: entrarNaCidade — prepara o estado pra jogar na cidade. Gera o desenho só quando ainda não há um
        /// guardado; voltar da masmorra cai na mesma cidade, no ponto de partida dela.
        /// </summary>
        public static EstadoNaCidade EntrarNaCidade(SaveCarregado save)
        {
            var estado = new EstadoNaCidade();
            Comuns(save, estado);

            List<List<CityCell>> grade;
            Posicao inicio;
            if (TemCidade(save))
            {
                // withGuild: a cidade de quem já jogava foi gravada antes da Guilda existir.
                grade = City.WithGuild(save.CityMap);
                inicio = save.CityStart;
            }
            else
            {
                var desenho = City.GenerateLayout(estado.MapRows, estado.MapCols);
                grade = desenho.Grid;
                inicio = new Posicao(desenho.Start.X, desenho.Start.Y);
            }

            var posicao = save.MapMode == "city" && save.Pos != null ? save.Pos : inicio;
            var mapa = MarcarVisitada(grade, posicao);
            estado.Map = mapa;
            estado.CityMap = mapa;
            estado.CityStart = inicio;
            estado.Pos = posicao;
            return estado;
        }

        /// <summary>
        /// TS: entrarNaMasmorra — o portão: entra na masmorra e dificuldade escolhidas, pelo andar 1 ou por um
        /// totem já tocado. Quem confere se a escolha está aberta é o portão.
        /// </summary>
        public static EstadoNaMasmorra EntrarNaMasmorra(EstadoNaCidade estado, RngFn rng = null, DungeonRun masmorra = null, double? andar = null,
            Func<double> now = null, bool app = false)
        {
            var comMasmorra = estado.Clone();
            comMasmorra.Masmorra = masmorra ?? estado.Masmorra;
            return GerarAndar(comMasmorra, andar ?? PrimeiroAndar, rng ?? Rng.Default, now, app);
        }

        /// <summary>TS: voltarParaCidade — a saída devolve o jogador à cidade guardada. O andar não é zerado.</summary>
        public static EstadoNaCidade VoltarParaCidade(EstadoNaMasmorra estado) => EntrarNaCidade(SaveCarregado.De(estado));

        /// <summary>
        /// TS: descerEscada — em andar de chefe com o chefe vivo o caminho fica selado; no último andar não há
        /// mais pra onde descer.
        /// </summary>
        public static ResultadoDaEscada DescerEscada(EstadoNaMasmorra estado, RngFn rng = null, Func<double> now = null, bool app = false)
        {
            if (DungeonFloors.IsBossFloor(estado.Floor) && TemChefeVivo(estado)) return new ResultadoDaEscada { Kind = "selado" };
            if (estado.Floor >= Dungeons.Floors) return new ResultadoDaEscada { Kind = "fundo" };
            return new ResultadoDaEscada { Kind = "desceu", Estado = AvancarAndar(estado, rng, now, app) };
        }

        /// <summary>TS: avancarAndar — o próximo andar sem passar pela escada (depois de vencer o chefe).</summary>
        public static EstadoNaMasmorra AvancarAndar(EstadoNaMasmorra estado, RngFn rng = null, Func<double> now = null, bool app = false) =>
            GerarAndar(estado, estado.Floor + 1, rng ?? Rng.Default, now, app);

        /// <summary>TS: temChefeVivo.</summary>
        public static bool TemChefeVivo(EstadoNaMasmorra estado)
        {
            foreach (var linha in estado.Map)
                foreach (var celula in linha)
                    if (celula.Type == DungeonRoomTypes.Boss && !(celula.Beaten ?? false))
                        return true;
            return false;
        }

        /// <summary>
        /// TS: professorDoAndar — o professor de classe, se ele aparece neste andar pra este herói. O rng só é
        /// gasto quando ele pode aparecer.
        /// </summary>
        private static DungeonTeacher ProfessorDoAndar(Hero hero, double floor, RngFn rng)
        {
            var professor = Teachers.For(hero, floor);
            var classe = Catalog.IdDaClasse(hero.ClassId, hero.ClassName);
            if (professor == null || string.IsNullOrEmpty(classe) || !Teachers.Appears(professor, floor, rng())) return null;
            return new DungeonTeacher { ClassId = classe, Number = professor.Number };
        }

        /// <summary>
        /// TS: gerarAndar. <paramref name="now"/> é o relógio do uid dos itens que o andar sorteia; ausente,
        /// o relógio de verdade. <paramref name="app"/>: quem desce é o app, e os itens do andar podem vir com material.
        /// </summary>
        private static EstadoNaMasmorra GerarAndar(EstadoDoJogo baseDoAndar, double floor, RngFn rng, Func<double> now, bool app = false)
        {
            var teacher = ProfessorDoAndar(baseDoAndar.Hero, floor, rng);
            var andar = DungeonFloors.Generate(floor, baseDoAndar.MapRows, baseDoAndar.MapCols, new DungeonGenerateOptions
            {
                Rng = rng,
                Run = baseDoAndar.Masmorra,
                Teacher = teacher,
                Now = now,
                App = app,
            });
            var inicio = new Posicao(andar.Start.X, andar.Start.Y);

            var estado = new EstadoNaMasmorra();
            baseDoAndar.CopiarComunsPara(estado);
            estado.Quests = Quests.OnFloorReached(baseDoAndar.Quests, floor);
            estado.Floor = floor;
            estado.Map = MarcarVisitada(andar.Grid, inicio);
            estado.Pos = inicio;
            return estado;
        }

        /// <summary>TS: alterarCelula — grade nova (todas as linhas novas), com a sala da posição copiada e mudada.</summary>
        private static List<List<TCell>> AlterarCelula<TCell>(List<List<TCell>> grade, Posicao posicao, Action<TCell> mudanca) where TCell : RoomCell
        {
            var nova = new List<List<TCell>>(grade.Count);
            for (int y = 0; y < grade.Count; y++)
            {
                var linha = grade[y];
                var novaLinha = new List<TCell>(linha.Count);
                for (int x = 0; x < linha.Count; x++)
                {
                    var celula = linha[x];
                    if (x == posicao.X && y == posicao.Y)
                    {
                        var copia = (TCell)celula.Clone();
                        mudanca(copia);
                        novaLinha.Add(copia);
                    }
                    else
                    {
                        novaLinha.Add(celula);
                    }
                }
                nova.Add(novaLinha);
            }
            return nova;
        }

        /// <summary>TS: marcarVisitada — entrar numa sala marca visitada e revelada.</summary>
        private static List<List<TCell>> MarcarVisitada<TCell>(List<List<TCell>> grade, Posicao posicao) where TCell : RoomCell =>
            AlterarCelula(grade, posicao, c =>
            {
                c.Visited = true;
                c.Revealed = true;
            });

        /// <summary>TS: celulaEm — a sala nessa posição, ou null (fora da grade, negativa ou não inteira).</summary>
        public static RoomCell CelulaEm(EstadoDoJogo estado, Posicao posicao) => DungeonGraph.CellAt(estado.Grade, posicao.X, posicao.Y);

        /// <summary>TS: celulaAtual.</summary>
        public static RoomCell CelulaAtual(EstadoDoJogo estado) => CelulaEm(estado, estado.Pos);

        /// <summary>TS: vizinhaEm — a posição da sala do outro lado da porta, ou null (sem porta, ou fora da grade).</summary>
        public static Posicao VizinhaEm(EstadoDoJogo estado, string direcao)
        {
            var atual = CelulaAtual(estado);
            if (atual?.Doors == null || !atual.Doors.TryGet(direcao, out var aberta) || !aberta) return null;

            var vetor = Directions.Vectors.Get(direcao);
            var destino = new Posicao(atual.X + vetor.X, atual.Y + vetor.Y);
            if (!DungeonGraph.InBounds(destino.X, destino.Y, estado.MapCols, estado.MapRows)) return null;

            return CelulaEm(estado, destino) != null ? destino : null;
        }

        /// <summary>TS: podeAndar — só dá pra sair por porta aberta, e só pra dentro da grade.</summary>
        public static bool PodeAndar(EstadoDoJogo estado, string direcao) => VizinhaEm(estado, direcao) != null;

        /// <summary>TS: andar — devolve o mesmo estado quando o passo não é possível.</summary>
        public static EstadoDoJogo Andar(EstadoDoJogo estado, string direcao)
        {
            var destino = VizinhaEm(estado, direcao);
            if (destino == null) return estado;

            if (estado is EstadoNaCidade cidade)
            {
                var mapa = MarcarVisitada(cidade.Map, destino);
                var naCidade = cidade.Clone();
                naCidade.Pos = destino;
                naCidade.Map = mapa;
                naCidade.CityMap = mapa;
                return naCidade;
            }

            var masmorra = (EstadoNaMasmorra)estado;
            var naMasmorra = masmorra.Clone();
            naMasmorra.Pos = destino;
            naMasmorra.Map = MarcarVisitada(masmorra.Map, destino);
            return naMasmorra;
        }

        public static EstadoNaCidade Andar(EstadoNaCidade estado, string direcao) => (EstadoNaCidade)Andar((EstadoDoJogo)estado, direcao);

        public static EstadoNaMasmorra Andar(EstadoNaMasmorra estado, string direcao) => (EstadoNaMasmorra)Andar((EstadoDoJogo)estado, direcao);

        /// <summary>TS: revelar — a sala aparece no minimapa sem o jogador ter entrado.</summary>
        public static EstadoDoJogo Revelar(EstadoDoJogo estado, Posicao posicao)
        {
            if (estado is EstadoNaCidade cidade)
            {
                var mapa = AlterarCelula(cidade.Map, posicao, c => c.Revealed = true);
                var naCidade = cidade.Clone();
                naCidade.Map = mapa;
                naCidade.CityMap = mapa;
                return naCidade;
            }

            var masmorra = (EstadoNaMasmorra)estado;
            var naMasmorra = masmorra.Clone();
            naMasmorra.Map = AlterarCelula(masmorra.Map, posicao, c => c.Revealed = true);
            return naMasmorra;
        }

        public static EstadoNaCidade Revelar(EstadoNaCidade estado, Posicao posicao) => (EstadoNaCidade)Revelar((EstadoDoJogo)estado, posicao);

        public static EstadoNaMasmorra Revelar(EstadoNaMasmorra estado, Posicao posicao) => (EstadoNaMasmorra)Revelar((EstadoDoJogo)estado, posicao);

        /// <summary>TS: troca — grade nova (todas as linhas novas), com a sala da posição atual trocada pela nova.</summary>
        private static List<List<TCell>> Trocar<TCell>(List<List<TCell>> grade, Posicao posicao, TCell nova) where TCell : RoomCell
        {
            var resultado = new List<List<TCell>>(grade.Count);
            for (int y = 0; y < grade.Count; y++)
            {
                var linha = grade[y];
                var novaLinha = new List<TCell>(linha.Count);
                for (int x = 0; x < linha.Count; x++) novaLinha.Add(x == posicao.X && y == posicao.Y ? nova : linha[x]);
                resultado.Add(novaLinha);
            }
            return resultado;
        }

        /// <summary>
        /// TS: substituirCelulaAtual — troca a sala onde o jogador está (baú aberto, estoque da loja). Na cidade
        /// o cityMap acompanha, porque ele e o map são o mesmo mapa.
        /// </summary>
        public static EstadoNaCidade SubstituirCelulaAtual(EstadoNaCidade estado, CityCell celula)
        {
            var mapa = Trocar(estado.Map, estado.Pos, celula);
            var novo = estado.Clone();
            novo.Map = mapa;
            novo.CityMap = mapa;
            return novo;
        }

        public static EstadoNaMasmorra SubstituirCelulaAtual(EstadoNaMasmorra estado, DungeonCell celula)
        {
            var novo = estado.Clone();
            novo.Map = Trocar(estado.Map, estado.Pos, celula);
            return novo;
        }
    }
}
