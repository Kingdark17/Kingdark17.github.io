using System.Collections;
using Newtonsoft.Json.Linq;
using NUnit.Framework;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Roda todos os resultados de referência do TypeScript (packages/shared/fixtures/*.json) contra o porte.
    /// Passou = o C# dá o mesmo resultado e tira o mesmo número de sorteios; Ignorado = ainda não portado.
    /// A conferência em si é o <see cref="FixtureCheck"/> (assembly RPGLegend.Fixtures, sem NUnit), que também
    /// roda no celular; aqui ela só vira teste do NUnit.
    /// </summary>
    public class EngineFixtureTests
    {
        public static IEnumerable Cases()
        {
            foreach (var module in FixtureCheck.Modules)
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
            var r = FixtureCheck.Run(module, c);
            if (r.Outcome == FixtureOutcome.NotPorted) Assert.Ignore(r.Message);
            if (r.Outcome == FixtureOutcome.Failed) Assert.Fail(r.Message);
        }
    }
}
