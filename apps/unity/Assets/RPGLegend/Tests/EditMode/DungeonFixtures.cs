using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/dungeon.json: o sort do V8, graph e dungeons. Os de generate.ts (generateDungeonFloor,
    /// isBossFloor, monsterGroupSize, iconFor, shortLabel, roomDesc, entryText) estão em DungeonGenerateFixtures.
    /// </summary>
    internal sealed class DungeonFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "dungeon";

            // ---------- constantes ----------
            Const(M, "DIR_VECTORS", () => W(Directions.Vectors));
            Const(M, "DIR_LABEL", () => W(Directions.Labels));
            Const(M, "DIR_OPP", () => W(Directions.Opposite));
            Const(M, "DIR_ORDER", () => W(Directions.Order));
            Const(M, "DUNGEONS", () => W(Dungeons.All));
            Const(M, "DIFFICULTIES", () => W(Dungeons.Difficulties));
            Const(M, "DUNGEON_FLOORS", () => N(Dungeons.Floors));
            Const(M, "TOTEM_FLOORS", () => W(Dungeons.TotemFloors));
            Const(M, "DEFAULT_RUN", () => W(Dungeons.DefaultRun));
            Const(M, "FLOORS_PER_TIER", () => N(Dungeons.FloorsPerTier));

            // ---------- o sort do V8 (o embaralhamento do grafo e do andar) ----------
            Fn(M, "Array.prototype.sort", (a, c) =>
            {
                if (Str(a["comparator"]) != "rng() - 0.5")
                    throw new NotSupportedException("comparador desconhecido no caso: " + a["comparator"]);
                var rng = c.RngFn;

                // a.list.slice().sort(() => rng() - 0.5)
                if (a["list"] is JArray list)
                {
                    var shuffled = new JArray();
                    foreach (var t in JsSort.SortLikeV8(new List<JToken>(list), (x, y) => rng() - 0.5)) shuffled.Add(t.DeepClone());
                    return shuffled;
                }

                // Os índices 0..length-1, gravando cada par (x, y) que o comparador recebeu.
                var indices = new List<double>();
                for (int i = 0; i < (int)Num(a["length"]); i++) indices.Add(i);
                var comparisons = new JArray();
                var order = JsSort.SortLikeV8(indices, (x, y) =>
                {
                    comparisons.Add(new JArray(N(x), N(y)));
                    return rng() - 0.5;
                });
                return new JObject { ["order"] = W(order), ["comparisons"] = comparisons };
            });

            // ---------- graph ----------
            Fn(M, "inBounds", (a, c) => W(DungeonGraph.InBounds(Num(a["x"]), Num(a["y"]), Num(a["cols"]), Num(a["rows"]))));
            // O gerador grava rooms e start como [x, y]: são as mesmas células de grid.
            Fn(M, "generateRoomGraph", (a, c) =>
                Compact(DungeonGraph.GenerateRoomGraph(Num(a["rows"]), Num(a["cols"]), Num(a["roomCount"]), c.RngFn)));
            Fn(M, "distancesFrom", (a, c) =>
                W(DungeonGraph.DistancesFrom(R<List<List<RoomCell>>>(a["grid"]), R<RoomCell>(a["start"]), Num(a["cols"]), Num(a["rows"]))));
            Fn(M, "isRoom", (a, c) => W(DungeonGraph.IsRoom(R<RoomCell>(a["cell"]))));
            Fn(M, "isKnown", (a, c) =>
                W(DungeonGraph.IsKnown(R<List<List<RoomCell>>>(a["grid"]), R<RoomCell>(a["cell"]), Num(a["cols"]), Num(a["rows"]))));

            // ---------- dungeons ----------
            Fn(M, "tierOf", (a, c) => N(Dungeons.TierOf(R<DungeonRun>(a["run"]))));
            Fn(M, "runName", (a, c) => W(Dungeons.RunName(R<DungeonRun>(a["run"]))));
            Fn(M, "runKey", (a, c) => W(Dungeons.RunKey(R<DungeonRun>(a["run"]))));
            Fn(M, "effectiveFloor", (a, c) => N(Dungeons.EffectiveFloor(R<DungeonRun>(a["run"]), Num(a["floor"]))));
            Fn(M, "isTotemFloor", (a, c) => W(Dungeons.IsTotemFloor(Num(a["floor"]))));
            // raw é unknown no TS: chega cru, sem passar pelos tipos do modelo.
            Fn(M, "normalizeRun", (a, c) => W(Dungeons.NormalizeRun(JsPlain.FromToken(a["raw"]))));
            Fn(M, "dungeonById", (a, c) => W(Dungeons.ById(Str(a["id"]))));
            Fn(M, "difficultyById", (a, c) => W(Dungeons.DifficultyById(Str(a["id"]))));
            Fn(M, "emptyProgress", (a, c) => W(Dungeons.EmptyProgress()));
            Fn(M, "normalizeProgress", (a, c) => W(Dungeons.NormalizeProgress(JsPlain.FromToken(a["raw"]))));
            Fn(M, "lockReason", (a, c) =>
                W(Dungeons.LockReasonOf(R<DungeonProgress>(a["progress"]), Num(a["heroLevel"]), R<DungeonRun>(a["run"]))));
            Fn(M, "isCleared", (a, c) => W(Dungeons.IsCleared(R<DungeonProgress>(a["progress"]), R<DungeonRun>(a["run"]))));
            Fn(M, "entryFloors", (a, c) => W(Dungeons.EntryFloors(R<DungeonProgress>(a["progress"]), R<DungeonRun>(a["run"]))));
            Fn(M, "touchTotem", (a, c) =>
                W(Dungeons.TouchTotem(R<DungeonProgress>(a["progress"]), R<DungeonRun>(a["run"]), Num(a["floor"]))));
            Fn(M, "markCleared", (a, c) => W(Dungeons.MarkCleared(R<DungeonProgress>(a["progress"]), R<DungeonRun>(a["run"]))));
            Fn(M, "legacyProgress", (a, c) => W(Dungeons.LegacyProgress(Num(a["floor"]))));
        }

        /// <summary>O grafoCompacto do gerador: a grade inteira, e rooms/start como [x, y].</summary>
        private static JToken Compact<TCell>(RoomGraph<TCell> graph) where TCell : RoomCell
        {
            var rooms = new JArray();
            foreach (var room in graph.Rooms) rooms.Add(Position(room));
            return new JObject { ["grid"] = W(graph.Grid), ["rooms"] = rooms, ["start"] = Position(graph.Start) };
        }

        private static JArray Position(RoomCell cell) => new JArray(N(cell.X), N(cell.Y));
    }
}
