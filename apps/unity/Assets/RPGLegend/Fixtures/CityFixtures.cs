using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Casos de fixtures/city.json (city/city.ts). Cada handler reproduz o executor do gerador
    /// (scripts/gen-fixtures.ts, seção modulo('city')).
    /// </summary>
    internal sealed class CityFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "city";

            Const(M, "GUILD_POS", () => W(City.GuildPos));

            Fn(M, "generateCityLayout", (a, c) => Compact(City.GenerateLayout(Num(a["rows"]), Num(a["cols"]))));
            Fn(M, "withGuild", (a, c) => W(City.WithGuild(R<List<List<CityCell>>>(a["grid"]))));
            Fn(M, "restAtTavern", (a, c) => W(City.RestAtTavern(R<Hero>(a["hero"]), R<List<Companion>>(a["party"]))));

            Fn(M, "cityIconFor", (a, c) => W(City.IconFor(R<CityCell>(a["cell"]))));
            Fn(M, "cityShortLabel", (a, c) => W(City.ShortLabel(R<CityCell>(a["cell"]))));
            Fn(M, "cityRoomDesc", (a, c) => W(City.RoomDesc(R<CityCell>(a["cell"]))));
            Fn(M, "cityEntryText", (a, c) => W(City.EntryText(R<CityCell>(a["cell"]))));
        }

        /// <summary>A cidadeCompacta do gerador: a grade inteira, rooms como [x, y] e start como [x, y] — ausente sem início.</summary>
        private static JToken Compact(RoomGraph<CityCell> cidade)
        {
            var rooms = new JArray();
            foreach (var room in cidade.Rooms) rooms.Add(Position(room));
            var result = new JObject { ["grid"] = W(cidade.Grid), ["rooms"] = rooms };
            if (cidade.Start != null) result["start"] = Position(cidade.Start);
            return result;
        }

        private static JArray Position(RoomCell cell) => new JArray(N(cell.X), N(cell.Y));
    }
}
