using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace RPGLegend.Engine.Json
{
    /// <summary>
    /// Tabelas de city/city.ts: city/city (GUILD_POS, NPC_TEMPLATES, LAYOUT, LAYOUT_DOORS). LAYOUT_DOORS é uma
    /// lista de trios <c>[x, y, direção]</c> (tupla do TS), e por isso é montada aqui, à mão.
    /// </summary>
    [Preserve]
    internal sealed class CityTables : ITableSet
    {
        public void Load(Func<string, string> readTable)
        {
            var token = JsJson.Parse(readTable("city/city"));
            var data = JsSerializer.Read<CityData>(token);

            var doors = new List<CityDoorSpec>();
            if (JsJson.Prop(token, "LAYOUT_DOORS") is JArray list)
            {
                foreach (var door in list)
                {
                    if (!(door is JArray trio)) throw new FormatException("city/city: LAYOUT_DOORS espera [x, y, direção], veio " + door);
                    doors.Add(new CityDoorSpec
                    {
                        X = JsJson.ToNumber(trio.Count > 0 ? trio[0] : null),
                        Y = JsJson.ToNumber(trio.Count > 1 ? trio[1] : null),
                        Dir = JsJson.Text(trio.Count > 2 ? trio[2] : null),
                    });
                }
            }
            data.LayoutDoors = doors;

            GameData.CityTable = data;
        }
    }
}
