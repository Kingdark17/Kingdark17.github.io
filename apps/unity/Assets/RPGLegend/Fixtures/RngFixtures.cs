using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;

namespace RPGLegend.Tests
{
    /// <summary>Casos de fixtures/rng.json.</summary>
    internal sealed class RngFixtures : IFixtureModule
    {
        public void Register()
        {
            // O gerador devolve { values, u32 } nos lotes curtos (12) e a lista pura no lote de 1000.
            FixtureRegistry.Fn("rng", "seededRng", (args, ctx) =>
            {
                var next = Rng.SeededRng(JsJson.ToNumber(args["seed"]));
                int count = (int)JsJson.ToNumber(args["count"]);
                var values = new JArray();
                var u32 = new JArray();
                for (int i = 0; i < count; i++)
                {
                    double v = next();
                    values.Add(JsJson.FromNumber(v));
                    u32.Add(JsJson.FromNumber(v * 4294967296.0));
                }
                return count <= 12 ? new JObject { ["values"] = values, ["u32"] = u32 } : (JToken)values;
            }, countsItself: true);

            FixtureRegistry.Fn("rng", "randomInt", (args, ctx) =>
                JsJson.FromNumber(Rng.RandomInt(JsJson.ToNumber(args["max"]), ctx.RngFn)));

            FixtureRegistry.Fn("rng", "pick", (args, ctx) =>
            {
                var list = new List<JToken>((JArray)args["list"]);
                return Rng.Pick(list, ctx.RngFn).DeepClone();
            });
        }
    }
}
