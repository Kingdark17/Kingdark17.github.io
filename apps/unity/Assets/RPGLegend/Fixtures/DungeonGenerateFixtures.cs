using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/dungeon.json que são de dungeon/generate.ts (generateDungeonFloor, isBossFloor,
    /// monsterGroupSize, iconFor, shortLabel, roomDesc, entryText). O resto do módulo (sort do V8, graph e
    /// dungeons) está em DungeonFixtures. Cada handler reproduz o executor do gerador (scripts/gen-fixtures.ts,
    /// seção "--- generate ---" de modulo('dungeon')).
    /// </summary>
    internal sealed class DungeonGenerateFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "dungeon";

            Fn(M, "isBossFloor", (a, c) => W(DungeonFloors.IsBossFloor(Num(a["floor"]))));
            Fn(M, "monsterGroupSize", (a, c) => N(DungeonFloors.MonsterGroupSize(Num(a["floor"]), c.RngFn)));

            // O gerador chama generateDungeonFloor(floor, rows, cols, { ...args.options, rng, now }): run e
            // teacher vêm das opções gravadas; o now gravado nelas é só registro (vale o relógio do caso).
            Fn(M, "generateDungeonFloor", (a, c) =>
            {
                var o = a["options"];
                var andar = DungeonFloors.Generate(Num(a["floor"]), Num(a["rows"]), Num(a["cols"]), new DungeonGenerateOptions
                {
                    Rng = c.RngFn,
                    Now = c.NowOrFail,
                    Run = R<DungeonRun>(JsJson.Prop(o, "run")),
                    Teacher = R<DungeonTeacher>(JsJson.Prop(o, "teacher")),
                });
                return Compact(andar);
            });

            Fn(M, "iconFor", (a, c) => W(DungeonFloors.IconFor(R<DungeonCell>(a["cell"]))));
            Fn(M, "shortLabel", (a, c) => W(DungeonFloors.ShortLabel(R<DungeonCell>(a["cell"]))));
            Fn(M, "roomDesc", (a, c) => W(DungeonFloors.RoomDesc(R<DungeonCell>(a["cell"]))));
            Fn(M, "entryText", (a, c) => W(DungeonFloors.EntryText(R<DungeonCell>(a["cell"]))));
        }

        /// <summary>O andarCompacto do gerador: a grade inteira, e rooms/start como [x, y].</summary>
        private static JToken Compact(RoomGraph<DungeonCell> andar)
        {
            var rooms = new JArray();
            foreach (var room in andar.Rooms) rooms.Add(Position(room));
            return new JObject { ["grid"] = W(andar.Grid), ["rooms"] = rooms, ["start"] = Position(andar.Start) };
        }

        private static JArray Position(RoomCell cell) => new JArray(N(cell.X), N(cell.Y));
    }
}
