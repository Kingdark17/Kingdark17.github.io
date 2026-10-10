using System;
using System.Collections;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Roda todos os resultados de referência do TypeScript (packages/shared/fixtures/*.json) contra o porte.
    /// Passou = o C# dá o mesmo resultado e tira o mesmo número de sorteios; Ignorado = ainda não portado.
    /// </summary>
    public class EngineFixtureTests
    {
        private static readonly string[] Modules =
        {
            "rng", "hero", "items", "monsters", "combat", "dungeon", "shop",
            "inventory", "events", "npc", "quests", "city", "pets",
        };

        public static IEnumerable Cases()
        {
            foreach (var module in Modules)
            {
                var cases = Fixtures.TryLoad(module);
                if (cases == null) continue;
                foreach (var c in cases)
                    yield return new TestCaseData(module, c).SetName(module + ": " + (string)c["name"]).SetCategory(module);
            }
        }

        [TestCaseSource(nameof(Cases))]
        public void MatchesTypeScript(string module, JToken c)
        {
            var input = c["input"];
            var expected = c["expected"];

            if (input["const"] != null)
            {
                var name = (string)input["const"];
                if (!FixtureRegistry.TryGetConst(module, name, out var value)) Assert.Ignore("constante ainda não portada: " + name);
                JsonAssert.AreEqual(expected["value"], value(), name);
                return;
            }

            var fn = (string)input["fn"];
            if (!FixtureRegistry.TryGetFn(module, fn, out var handler, out var countsItself)) Assert.Ignore("função ainda não portada: " + fn);

            var ctx = new CaseContext
            {
                Rng = Fixtures.BuildRng(input["rng"]),
                Now = JsJson.IsUndefined(input["now"]) ? (double?)null : JsJson.ToNumber(input["now"]),
            };
            var args = input["args"] ?? new JObject();

            JToken result = null;
            Exception error = null;
            try
            {
                if (!countsItself && !JsJson.IsUndefined(args["count"]))
                {
                    var list = new JArray();
                    int n = (int)JsJson.ToNumber(args["count"]);
                    for (int i = 0; i < n; i++) list.Add(handler(args, ctx) ?? JValue.CreateNull());
                    result = list;
                }
                else
                {
                    result = handler(args, ctx);
                }
            }
            catch (Exception ex) when (!(ex is AssertionException || ex is IgnoreException || ex is InconclusiveException || ex is SuccessException))
            {
                error = ex;
            }

            var throws = expected["throws"];
            if (throws != null)
            {
                Assert.IsNotNull(error, "o TS lançou \"" + (string)throws["message"] + "\", o C# não lançou nada");
                Assert.AreEqual((string)throws["message"], error.Message, "mensagem do erro");
                Assert.AreEqual((string)throws["name"], error is EngineError ee ? ee.Name : error.GetType().Name, "tipo do erro");
            }
            else
            {
                if (error != null) Assert.Fail("o C# lançou " + error.GetType().Name + ": " + error.Message + "\n" + error.StackTrace);
                if (expected["undefined"] != null) Assert.IsTrue(result == null, "o TS devolveu undefined, o C# devolveu " + result);
                else JsonAssert.AreEqual(expected["result"], result, "result");
            }

            if (expected["rngCalls"] != null)
                Assert.AreEqual((int)expected["rngCalls"], ctx.Rng.Calls, "quantidade de sorteios");
        }
    }
}
