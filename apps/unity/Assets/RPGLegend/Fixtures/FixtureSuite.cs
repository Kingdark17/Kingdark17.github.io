using System;
using System.Collections.Generic;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Todos os casos de fixtures de uma vez, com um relatório em linhas de texto: o placar por módulo, as
    /// primeiras falhas e o total. O texto não depende da máquina, então o relatório do celular tem que sair
    /// idêntico ao do Editor (é o que o "Build de teste (Android)" confere). A última linha é <see cref="Ok"/>
    /// ou começa com <see cref="FailPrefix"/>.
    /// </summary>
    public static class FixtureSuite
    {
        public const string Ok = "FIXTURES OK";
        public const string FailPrefix = "FIXTURES FALHOU";
        private const int MaxFailuresShown = 20;
        private const int MaxMessageLength = 300;

        /// <summary>Roda tudo de uma vez (no Editor).</summary>
        public static List<string> Run()
        {
            var lines = new List<string>();
            foreach (var _ in Steps(lines)) { }
            return lines;
        }

        public static bool Passed(IReadOnlyList<string> lines) => lines.Count > 0 && lines[lines.Count - 1] == Ok;

        /// <summary>
        /// Roda os casos um a um, devolvendo quantos já rodaram, e escreve o relatório em <paramref name="lines"/>
        /// no fim. No celular, quem chama dá uma pausa entre os passos para a tela não travar.
        /// </summary>
        public static IEnumerable<int> Steps(List<string> lines)
        {
            var placar = new List<string>();
            var falhas = new List<string>();
            int passou = 0, falhou = 0, falta = 0, feitos = 0;

            foreach (var module in FixtureCheck.Modules)
            {
                Newtonsoft.Json.Linq.JArray cases;
                try
                {
                    cases = Fixtures.TryLoad(module);
                }
                catch (Exception e)
                {
                    lines.Add(FailPrefix + ": não consegui ler " + module + ".json (" + e.GetType().Name + ": " + e.Message + ")");
                    yield break;
                }
                if (cases == null) continue;

                int p = 0, f = 0, n = 0;
                foreach (var c in cases)
                {
                    var r = FixtureCheck.Run(module, c);
                    if (r.Outcome == FixtureOutcome.Passed) p++;
                    else if (r.Outcome == FixtureOutcome.NotPorted) n++;
                    else
                    {
                        f++;
                        if (falhas.Count < MaxFailuresShown) falhas.Add("falhou " + module + ": " + (string)c["name"] + " — " + OneLine(r.Message));
                    }
                    yield return ++feitos;
                }
                placar.Add(module + ": " + p + " passaram, " + f + " falharam, " + n + " faltam");
                passou += p;
                falhou += f;
                falta += n;
            }

            lines.AddRange(placar);
            lines.AddRange(falhas);
            if (falhou > falhas.Count) lines.Add("(mais " + (falhou - falhas.Count) + " falha(s) além dessas)");
            lines.Add("total: " + feitos + " casos, " + passou + " passaram, " + falhou + " falharam, " + falta + " faltam");
            lines.Add(falhou == 0 ? Ok : FailPrefix + ": " + falhou + " caso(s) não bateram com o TypeScript");
        }

        /// <summary>Uma linha só (o log quebraria a mensagem em várias) e curta.</summary>
        private static string OneLine(string message)
        {
            var s = (message ?? "").Replace("\r", "").Replace("\n", " | ");
            return s.Length > MaxMessageLength ? s.Substring(0, MaxMessageLength) + "…" : s;
        }
    }
}
