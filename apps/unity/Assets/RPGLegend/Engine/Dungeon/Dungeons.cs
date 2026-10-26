using System;
using System.Collections;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: DungeonRun — onde o jogador está descendo: qual masmorra, em que dificuldade. Vai no save.</summary>
    public sealed class DungeonRun
    {
        /// <summary>TS: DungeonId.</summary>
        public string Dungeon;
        /// <summary>TS: DifficultyId.</summary>
        public string Difficulty;

        /// <summary>Campos do save que o C# não conhece; voltam intactos ao salvar.</summary>
        [JsExtra] public JsExtras Extra;

        /// <summary>O <c>{ ...run }</c> do TS.</summary>
        public DungeonRun Clone()
        {
            var c = (DungeonRun)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }
    }

    /// <summary>TS: <c>Record&lt;string, number[]&gt;</c> — andares de totem tocados, por runKey ("floresta:normal").</summary>
    public sealed class TotemMap : OrderedMap<List<double>>
    {
        /// <summary>O <c>{ ...totems }</c> do JS (as listas continuam as mesmas).</summary>
        public TotemMap Clone()
        {
            var c = new TotemMap();
            CopyTo(c);
            return c;
        }
    }

    /// <summary>
    /// TS: DungeonProgress — o que o personagem já conquistou nas masmorras. Mora no save, ao lado do andar.
    /// Lista ou mapa ausente fica null (undefined), como no TS: use <see cref="Dungeons.EmptyProgress"/> para começar.
    /// </summary>
    public sealed class DungeonProgress
    {
        /// <summary>runKey das masmorras e dificuldades já zeradas (chefe do andar 100 vencido).</summary>
        public List<string> Cleared;
        /// <summary>Andares de totem já tocados, por runKey.</summary>
        public TotemMap Totems;

        /// <summary>Campos do save que o C# não conhece; voltam intactos ao salvar.</summary>
        [JsExtra] public JsExtras Extra;

        /// <summary>O <c>{ ...progress }</c> do TS: as listas e o mapa continuam os mesmos objetos.</summary>
        public DungeonProgress Clone()
        {
            var c = (DungeonProgress)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }
    }

    /// <summary>
    /// TS: LockReason — por que uma masmorra numa dificuldade está fechada. No TS é uma união pelo
    /// <c>kind</c>; aqui é uma classe só, e cada kind preenche só o seu campo (os outros ficam ausentes):
    /// "level" → MinLevel, "previous_dungeon" → Dungeon, "previous_difficulty" → Difficulty.
    /// </summary>
    public sealed class LockReason
    {
        public const string KindLevel = "level";
        public const string KindPreviousDungeon = "previous_dungeon";
        public const string KindPreviousDifficulty = "previous_difficulty";

        public string Kind;
        /// <summary>kind "level": o nível mínimo da masmorra.</summary>
        public double? MinLevel;
        /// <summary>kind "previous_dungeon": a masmorra que falta zerar no Normal.</summary>
        public string Dungeon;
        /// <summary>kind "previous_difficulty": a dificuldade que falta zerar nesta masmorra.</summary>
        public string Difficulty;

        public static LockReason Level(double minLevel) => new LockReason { Kind = KindLevel, MinLevel = minLevel };

        public static LockReason PreviousDungeon(string dungeon) => new LockReason { Kind = KindPreviousDungeon, Dungeon = dungeon };

        public static LockReason PreviousDifficulty(string difficulty) => new LockReason { Kind = KindPreviousDifficulty, Difficulty = difficulty };
    }

    /// <summary>
    /// As masmorras — Floresta, Caverna e Torre, cada uma do andar 1 ao 100, em três dificuldades — e o
    /// progresso do personagem nelas (port de shared/src/dungeon/dungeons.ts). Só regra e dado: gerar o andar
    /// é de dungeon/generate.ts; o portão, o totem e o save são de quem orquestra.
    ///
    /// <para>
    /// <see cref="NormalizeRun"/> e <see cref="NormalizeProgress"/> recebem o <c>unknown</c> do TS — o que veio
    /// do save ou da rede, sem forma garantida — como valor JS cru do C#: null (null e undefined), bool,
    /// número (double; int/long/float também valem), string, lista (<see cref="IList"/>) ou objeto
    /// (<see cref="IOrderedMap"/> ou <see cref="IDictionary"/>, com valores também crus). Um
    /// <see cref="DungeonRun"/>/<see cref="DungeonProgress"/> já tipado também serve. Do JSON para essa forma:
    /// <c>RPGLegend.Engine.Json.JsPlain.FromToken</c>. É assim que o <c>typeof x === 'string'</c> do TS
    /// continua valendo: um "40" texto não pode virar o número 40 no caminho.
    /// </para>
    /// </summary>
    public static class Dungeons
    {
        private static DungeonsData D => GameData.DungeonsTable;

        /// <summary>TS: DUNGEONS.</summary>
        public static List<DungeonDef> All => D.Dungeons;

        /// <summary>TS: DIFFICULTIES.</summary>
        public static List<DifficultyDef> Difficulties => D.Difficulties;

        /// <summary>TS: DUNGEON_FLOORS — andares de cada masmorra (zerar é vencer o chefe do último).</summary>
        public static double Floors => D.DungeonFloors;

        /// <summary>TS: TOTEM_FLOORS — andares com totem, que guarda o ponto de volta.</summary>
        public static List<double> TotemFloors => D.TotemFloors;

        /// <summary>TS: DEFAULT_RUN — Floresta Normal. O mesmo objeto sempre, como a constante do TS: não altere.</summary>
        public static DungeonRun DefaultRun => D.DefaultRun;

        /// <summary>
        /// TS: FLOORS_PER_DUNGEON — andares de força entre o começo de uma masmorra e o da seguinte, no Normal (77:
        /// a Caverna começa na força 78, monstros de nível 70); cada dificuldade sobe meio disso.
        /// </summary>
        public static double FloorsPerDungeon => D.FloorsPerDungeon;

        /// <summary>TS: dungeonById.</summary>
        public static DungeonDef ById(string id)
        {
            foreach (var d in All) if (d.Id == id) return d;
            return null;
        }

        /// <summary>TS: difficultyById.</summary>
        public static DifficultyDef DifficultyById(string id)
        {
            foreach (var d in Difficulties) if (d.Id == id) return d;
            return null;
        }

        /// <summary>
        /// TS: normalizeRun — o que veio do save ou da rede: o que não for masmorra e dificuldade conhecidas
        /// vira o de DEFAULT_RUN (Floresta Normal), campo a campo. Devolve sempre um objeto novo, só com os
        /// dois campos. <paramref name="raw"/>: valor JS cru (ver a nota da classe).
        /// </summary>
        public static DungeonRun NormalizeRun(object raw)
        {
            // (raw ?? {}) e typeof … === 'string': só objeto tem campo, e só texto é id.
            var dungeon = Prop(raw, "dungeon") is string dungeonId ? ById(dungeonId) : null;
            var difficulty = Prop(raw, "difficulty") is string difficultyId ? DifficultyById(difficultyId) : null;
            return new DungeonRun
            {
                Dungeon = dungeon?.Id ?? DefaultRun.Dungeon,
                Difficulty = difficulty?.Id ?? DefaultRun.Difficulty,
            };
        }

        /// <summary>TS: runName — "Floresta · Difícil"; id desconhecido aparece como está.</summary>
        public static string RunName(DungeonRun run) =>
            (ById(run.Dungeon)?.Name ?? Js.Str(run.Dungeon)) + " · " + (DifficultyById(run.Difficulty)?.Name ?? Js.Str(run.Difficulty));

        /// <summary>TS: runKey — "floresta:dificil", a chave do progresso.</summary>
        public static string RunKey(DungeonRun run) => Key(run.Dungeon, run.Difficulty);

        // ---------- força ----------

        /// <summary>
        /// TS: tierOf — o degrau de força: Floresta Normal 0, Difícil 1, Pesadelo 2; Caverna Normal 2… O
        /// Pesadelo de uma é o mesmo degrau do Normal da seguinte (o "* 2" é fixo no TS). Desconhecido conta
        /// como o primeiro.
        /// </summary>
        public static double TierOf(DungeonRun run)
        {
            double masmorra = Js.Max(0, IndexOfDungeon(run.Dungeon));
            double dificuldade = Js.Max(0, IndexOfDifficulty(run.Difficulty));
            return masmorra * 2 + dificuldade;
        }

        /// <summary>
        /// TS: effectiveFloor — o andar que os monstros, o ouro e os itens enxergam: dentro da masmorra sobe um
        /// por andar; o degrau só muda onde ela começa.
        /// </summary>
        public static double EffectiveFloor(DungeonRun run, double floor) => floor + TierOffset(run);

        /// <summary>TS: tierOffset — quantos andares de força o degrau soma: 0, 39, 77, 116, 154, 193, 231.</summary>
        public static double TierOffset(DungeonRun run) => Math.Floor((TierOf(run) * FloorsPerDungeon + 1) / 2);

        /// <summary>TS: isTotemFloor — <c>TOTEM_FLOORS.includes(floor)</c>.</summary>
        public static bool IsTotemFloor(double floor) => IncludesNumber(TotemFloors, floor);

        // ---------- progresso ----------

        /// <summary>TS: emptyProgress.</summary>
        public static DungeonProgress EmptyProgress() =>
            new DungeonProgress { Cleared = new List<string>(), Totems = new TotemMap() };

        /// <summary>
        /// TS: normalizeProgress — o que veio do save: só chave conhecida (runKey de masmorra e dificuldade que
        /// existem) e andar de totem de verdade (número, não texto) sobrevivem; repetição sai, os andares ficam
        /// em ordem e chave sem andar válido some. <paramref name="raw"/>: valor JS cru (ver a nota da classe).
        /// </summary>
        public static DungeonProgress NormalizeProgress(object raw)
        {
            var chaves = new HashSet<string>(StringComparer.Ordinal);
            foreach (var d in All)
                foreach (var f in Difficulties)
                    chaves.Add(Key(d.Id, f.Id));

            // Array.isArray(candidato.cleared) ? candidato.cleared.filter(texto conhecido) : []
            var cleared = new List<string>();
            if (Prop(raw, "cleared") is IList rawCleared)
                foreach (var c in rawCleared)
                    if (c is string s && chaves.Contains(s)) cleared.Add(s);

            var totems = new TotemMap();
            // candidato.totems && typeof candidato.totems === 'object' → Object.entries. Uma lista também é
            // objeto no JS, mas as chaves dela ("0", "1"…) nunca são runKey: não sobra nada, e por isso só os
            // mapas são percorridos aqui.
            foreach (var entry in Entries(Prop(raw, "totems")))
            {
                if (!chaves.Contains(entry.Key) || !(entry.Value is IList andares)) continue;
                // [...new Set(andares.filter(número que é andar de totem))].sort((a, b) => a - b)
                var vistos = new List<double>();
                foreach (var a in andares)
                    if (TryNumber(a, out double andar) && IsTotemFloor(andar) && !IncludesNumber(vistos, andar)) vistos.Add(andar);
                var validos = JsSort.SortLikeV8(vistos, (x, y) => x - y);
                if (validos.Count > 0) totems.Set(entry.Key, validos);
            }

            // [...new Set(cleared)]
            var unicos = new List<string>();
            foreach (var c in cleared) if (!unicos.Contains(c)) unicos.Add(c);

            return new DungeonProgress { Cleared = unicos, Totems = totems };
        }

        /// <summary>TS: isCleared.</summary>
        public static bool IsCleared(DungeonProgress progress, DungeonRun run) => progress.Cleared.Contains(RunKey(run));

        /// <summary>
        /// TS: lockReason — por que esta masmorra nesta dificuldade está fechada, ou null se abre (masmorra
        /// desconhecida também abre). Na ordem: nível mínimo; a masmorra anterior zerada no Normal; a
        /// dificuldade anterior desta masmorra zerada.
        /// </summary>
        public static LockReason LockReasonOf(DungeonProgress progress, double heroLevel, DungeonRun run)
        {
            var masmorra = ById(run.Dungeon);
            if (masmorra == null) return null;
            if (heroLevel < masmorra.MinLevel) return LockReason.Level(masmorra.MinLevel);
            // "normal" é literal no TS (não é DIFFICULTIES[0]).
            if (Js.Truthy(masmorra.Requires) && !IsCleared(progress, new DungeonRun { Dungeon = masmorra.Requires, Difficulty = "normal" }))
                return LockReason.PreviousDungeon(masmorra.Requires);
            int indice = IndexOfDifficulty(run.Difficulty);
            var anterior = indice > 0 ? Difficulties[indice - 1] : null;
            if (anterior != null && !IsCleared(progress, new DungeonRun { Dungeon = run.Dungeon, Difficulty = anterior.Id }))
                return LockReason.PreviousDifficulty(anterior.Id);
            return null;
        }

        /// <summary>TS: entryFloors — por onde dá para entrar: o andar 1 e os totens já tocados, em ordem.</summary>
        public static List<double> EntryFloors(DungeonProgress progress, DungeonRun run)
        {
            var floors = new List<double> { 1 };
            var tocados = progress.Totems.Get(RunKey(run));
            if (tocados != null) floors.AddRange(tocados);
            return floors;
        }

        /// <summary>
        /// TS: touchTotem — guarda o totem do andar. Andar sem totem ou já tocado devolve o mesmo progresso;
        /// senão, um progresso novo (cópia rasa) com um mapa de totens novo e a lista daquela chave em ordem.
        /// </summary>
        public static DungeonProgress TouchTotem(DungeonProgress progress, DungeonRun run, double floor)
        {
            if (!IsTotemFloor(floor)) return progress;
            string chave = RunKey(run);
            var tocados = progress.Totems.Get(chave) ?? new List<double>();
            if (IncludesNumber(tocados, floor)) return progress;

            var andares = new List<double>(tocados) { floor };
            var totems = progress.Totems.Clone();
            totems.Set(chave, JsSort.SortLikeV8(andares, (a, b) => a - b));
            var next = progress.Clone();
            next.Totems = totems;
            return next;
        }

        /// <summary>TS: markCleared — já zerada devolve o mesmo progresso; senão, um novo com a chave no fim.</summary>
        public static DungeonProgress MarkCleared(DungeonProgress progress, DungeonRun run)
        {
            if (IsCleared(progress, run)) return progress;
            var next = progress.Clone();
            next.Cleared = new List<string>(progress.Cleared) { RunKey(run) };
            return next;
        }

        /// <summary>
        /// TS: legacyProgress — o save de antes das masmorras: a masmorra sem fim vira a Floresta Normal, e quem
        /// estava no andar 37 ganha o totem do 20, que já passou. Andar que não é número finito conta como 1.
        /// </summary>
        public static DungeonProgress LegacyProgress(double floor)
        {
            double andar = Js.IsFinite(floor) ? floor : 1;
            var passados = new List<double>();
            foreach (var t in TotemFloors) if (t <= andar) passados.Add(t);
            if (passados.Count == 0) return EmptyProgress();

            var totems = new TotemMap();
            totems.Set(RunKey(DefaultRun), new List<double>(passados));
            return new DungeonProgress { Cleared = new List<string>(), Totems = totems };
        }

        // ---------- apoio ----------

        /// <summary>O template <c>`${dungeon}:${difficulty}`</c> (ausente vira "undefined").</summary>
        private static string Key(string dungeon, string difficulty) => Js.Str(dungeon) + ":" + Js.Str(difficulty);

        private static int IndexOfDungeon(string id)
        {
            for (int i = 0; i < All.Count; i++) if (All[i].Id == id) return i;
            return -1;
        }

        private static int IndexOfDifficulty(string id)
        {
            for (int i = 0; i < Difficulties.Count; i++) if (Difficulties[i].Id == id) return i;
            return -1;
        }

        /// <summary>Array.prototype.includes com número: SameValueZero (NaN acha NaN, -0 acha 0).</summary>
        private static bool IncludesNumber(IReadOnlyList<double> list, double value)
        {
            foreach (var v in list)
                if (v == value || (double.IsNaN(v) && double.IsNaN(value))) return true;
            return false;
        }

        /// <summary><c>typeof x === 'number'</c> num valor cru.</summary>
        private static bool TryNumber(object value, out double number)
        {
            switch (value)
            {
                case double d: number = d; return true;
                case float f: number = f; return true;
                case int i: number = i; return true;
                case long l: number = l; return true;
                default: number = 0; return false;
            }
        }

        /// <summary>
        /// <c>candidato[campo]</c> do JS num valor cru: só objeto (mapa ou modelo tipado) tem campo; null,
        /// texto, número e lista dão undefined (null).
        /// </summary>
        private static object Prop(object raw, string field)
        {
            switch (raw)
            {
                case DungeonRun run:
                    return field == "dungeon" ? run.Dungeon : field == "difficulty" ? run.Difficulty : null;
                case DungeonProgress progress:
                    return field == "cleared" ? progress.Cleared : field == "totems" ? (object)progress.Totems : null;
                default:
                    foreach (var entry in Entries(raw)) if (entry.Key == field) return entry.Value;
                    return null;
            }
        }

        /// <summary>Object.entries de um objeto cru (mapa), na ordem das chaves; qualquer outra coisa não tem entradas.</summary>
        private static IEnumerable<KeyValuePair<string, object>> Entries(object raw)
        {
            if (raw is IOrderedMap map) return map.UntypedEntries;
            if (raw is IDictionary dictionary) return DictionaryEntries(dictionary);
            return Array.Empty<KeyValuePair<string, object>>();
        }

        private static IEnumerable<KeyValuePair<string, object>> DictionaryEntries(IDictionary dictionary)
        {
            foreach (DictionaryEntry e in dictionary)
                if (e.Key is string key) yield return new KeyValuePair<string, object>(key, e.Value);
        }
    }
}
