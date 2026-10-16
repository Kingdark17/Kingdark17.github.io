using System;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;

namespace RPGLegend.Tests
{
    /// <summary>Um caso que não bateu com o TypeScript. A mensagem diz o quê (e mostra os dois valores).</summary>
    public sealed class FixtureFailure : Exception
    {
        public FixtureFailure(string message) : base(message) { }
    }

    public enum FixtureOutcome
    {
        Passed,
        Failed,
        /// <summary>A função ou constante ainda não foi portada (no Test Runner aparece como ignorado).</summary>
        NotPorted,
    }

    public readonly struct FixtureResult
    {
        public readonly FixtureOutcome Outcome;
        public readonly string Message;

        public FixtureResult(FixtureOutcome outcome, string message)
        {
            Outcome = outcome;
            Message = message;
        }
    }

    /// <summary>
    /// Confere um caso de packages/shared/fixtures contra o port: mesmo resultado (ou o mesmo erro) e o mesmo
    /// número de sorteios. Sem NUnit e sem UnityEngine: é o mesmo código no Test Runner (EngineFixtureTests),
    /// no executor de fora da Unity e no celular (DeviceTests).
    /// </summary>
    public static class FixtureCheck
    {
        /// <summary>Os módulos de fixtures, na ordem em que os testes rodam.</summary>
        public static readonly string[] Modules =
        {
            "rng", "hero", "items", "monsters", "combat", "dungeon", "shop",
            "inventory", "events", "npc", "quests", "city", "pets", "jogo",
        };

        public static FixtureResult Run(string module, JToken c)
        {
            try
            {
                var naoPortado = Check(module, c);
                return naoPortado == null
                    ? new FixtureResult(FixtureOutcome.Passed, null)
                    : new FixtureResult(FixtureOutcome.NotPorted, naoPortado);
            }
            catch (FixtureFailure f)
            {
                return new FixtureResult(FixtureOutcome.Failed, f.Message);
            }
            catch (Exception e)
            {
                return new FixtureResult(FixtureOutcome.Failed, e.GetType().Name + ": " + e.Message + "\n" + e.StackTrace);
            }
        }

        /// <summary>Lança FixtureFailure se não bater. Devolve o motivo quando ainda não foi portado, ou null.</summary>
        private static string Check(string module, JToken c)
        {
            var input = c["input"];
            var expected = c["expected"];

            if (input["const"] != null)
            {
                var name = (string)input["const"];
                if (!FixtureRegistry.TryGetConst(module, name, out var value)) return "constante ainda não portada: " + name;
                JsonAssert.AreEqual(expected["value"], value(), name);
                return null;
            }

            var fn = (string)input["fn"];
            if (!FixtureRegistry.TryGetFn(module, fn, out var handler, out var countsItself)) return "função ainda não portada: " + fn;

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
            catch (Exception ex) when (!(ex is FixtureFailure))
            {
                error = ex;
            }

            var throws = expected["throws"];
            if (throws != null)
            {
                if (error == null) throw new FixtureFailure("o TS lançou \"" + (string)throws["message"] + "\", o C# não lançou nada");
                Equal((string)throws["message"], error.Message, "mensagem do erro");
                Equal((string)throws["name"], error is EngineError ee ? ee.Name : error.GetType().Name, "tipo do erro");
            }
            else
            {
                if (error != null) throw new FixtureFailure("o C# lançou " + error.GetType().Name + ": " + error.Message + "\n" + error.StackTrace);
                if (expected["undefined"] != null)
                {
                    if (result != null) throw new FixtureFailure("o TS devolveu undefined, o C# devolveu " + result);
                }
                else JsonAssert.AreEqual(expected["result"], result, "result");
            }

            if (expected["rngCalls"] != null)
            {
                int esperado = (int)expected["rngCalls"];
                if (esperado != ctx.Rng.Calls)
                    throw new FixtureFailure("quantidade de sorteios\n  TS: " + esperado + "\n  C#: " + ctx.Rng.Calls);
            }
            return null;
        }

        private static void Equal(string esperado, string veio, string oQue)
        {
            if (esperado != veio) throw new FixtureFailure(oQue + "\n  TS: " + esperado + "\n  C#: " + veio);
        }
    }
}
