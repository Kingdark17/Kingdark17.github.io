using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/dungeon.json que são de dungeon/extras.ts: os prêmios e a placa. O sorteio dos extras roda
    /// dentro de generateDungeonFloor, e esses casos ficam em DungeonGenerateFixtures.
    /// </summary>
    internal sealed class ExtrasFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "dungeon";

            Const(M, "EXTRA_TILES", () => W(RoomExtras.ExtraTiles));
            Const(M, "CRACK_CHANCE", () => N(RoomExtras.CrackChance));
            Const(M, "EXTRA_CHEST_CHANCE", () => N(RoomExtras.ExtraChestChance));
            Const(M, "EXTRA_POT_CHANCE", () => N(RoomExtras.ExtraPotChance));
            Const(M, "EXTRA_POTIONS", () => W(RoomExtras.ExtraPotions));
            Const(M, "DOOR_TILE", () => W(GameData.RoomWalkTable.DoorTile));

            Fn(M, "extraChestGold", (a, c) => N(RoomExtras.ExtraChestGold(Num(a["floor"]), c.RngFn)));
            Fn(M, "potCoins", (a, c) => N(RoomExtras.PotCoins(c.RngFn)));
            Fn(M, "signHint", (a, c) => W(RoomExtras.SignHint(R<List<List<DungeonCell>>>(a["grid"]), R<DungeonCell>(a["cell"]))));

            // Cola de teste (o mesmo laço do gerador): gera o andar e lê a placa de todas as salas.
            Fn(M, "signHint (andar gerado)", (a, c) =>
            {
                var andar = DungeonFloors.Generate(Num(a["floor"]), Num(a["rows"]), Num(a["cols"]), new DungeonGenerateOptions
                {
                    Rng = c.RngFn,
                    Now = c.NowOrFail,
                });
                var placas = new JArray();
                foreach (var sala in andar.Rooms)
                    placas.Add(new JObject { ["x"] = N(sala.X), ["y"] = N(sala.Y), ["hint"] = RoomExtras.SignHint(andar.Grid, sala) });
                return placas;
            });
        }
    }
}
