// Executor de linha de comando dos testes de fixture (fora da Unity).
//
//   dotnet run --project build/Runner -- [--module combat] [--name "texto"] [--show 20] [--quiet]
//
// Mostra o placar por módulo (passou / falhou / ainda não portado) e as primeiras falhas.
// Variável RPG_FIXTURES_DIR: pasta packages/shared/fixtures.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using NUnit.Framework;
using RPGLegend.Tests;

internal static class Program
{
    private static int Main(string[] args)
    {
        string module = Arg(args, "--module");
        string name = Arg(args, "--name");
        int show = int.TryParse(Arg(args, "--show"), out var s) ? s : 15;
        bool quiet = args.Contains("--quiet");

        var tests = new EngineFixtureTests();
        var board = new SortedDictionary<string, int[]>(); // módulo → [passou, falhou, ignorado]
        var failures = new List<string>();
        var ignoredFns = new SortedDictionary<string, int>();

        foreach (TestCaseData data in EngineFixtureTests.Cases())
        {
            string mod = (string)data.Arguments[0];
            if (module != null && mod != module) continue;
            if (name != null && (data.TestName ?? "").IndexOf(name, StringComparison.OrdinalIgnoreCase) < 0) continue;
            if (!board.ContainsKey(mod)) board[mod] = new int[3];

            try
            {
                tests.MatchesTypeScript(mod, (Newtonsoft.Json.Linq.JToken)data.Arguments[1]);
                board[mod][0]++;
            }
            catch (IgnoreException e)
            {
                board[mod][2]++;
                string key = mod + " · " + e.Message;
                ignoredFns[key] = ignoredFns.TryGetValue(key, out var n) ? n + 1 : 1;
            }
            catch (Exception e)
            {
                board[mod][1]++;
                failures.Add("✗ " + data.TestName + "\n" + Indent(e is AssertionException ? e.Message : e.GetType().Name + ": " + e.Message + "\n" + e.StackTrace));
            }
        }

        // Testes [Test] comuns (regressões fora dos fixtures), no módulo "regressao".
        if (module == null || module == "regressao")
        {
            foreach (var type in typeof(EngineFixtureTests).Assembly.GetTypes())
            {
                foreach (var method in type.GetMethods(BindingFlags.Public | BindingFlags.Instance))
                {
                    if (method.GetCustomAttribute<TestAttribute>() == null || method.GetParameters().Length > 0) continue;
                    string testName = type.Name + "." + method.Name;
                    if (name != null && testName.IndexOf(name, StringComparison.OrdinalIgnoreCase) < 0) continue;
                    if (!board.ContainsKey("regressao")) board["regressao"] = new int[3];
                    try
                    {
                        method.Invoke(Activator.CreateInstance(type), null);
                        board["regressao"][0]++;
                    }
                    catch (TargetInvocationException tie)
                    {
                        var e = tie.InnerException ?? tie;
                        if (e is IgnoreException) { board["regressao"][2]++; continue; }
                        board["regressao"][1]++;
                        failures.Add("✗ " + testName + "\n" + Indent(e is AssertionException ? e.Message : e.GetType().Name + ": " + e.Message + "\n" + e.StackTrace));
                    }
                }
            }
        }

        int pass = 0, fail = 0, ign = 0;
        Console.WriteLine("módulo        passou  falhou  falta");
        foreach (var kv in board)
        {
            Console.WriteLine($"{kv.Key,-12} {kv.Value[0],7} {kv.Value[1],7} {kv.Value[2],6}");
            pass += kv.Value[0];
            fail += kv.Value[1];
            ign += kv.Value[2];
        }
        Console.WriteLine($"{"TOTAL",-12} {pass,7} {fail,7} {ign,6}");

        if (!quiet && ignoredFns.Count > 0 && module != null)
        {
            Console.WriteLine("\nainda não portado:");
            foreach (var kv in ignoredFns) Console.WriteLine($"  {kv.Key} ({kv.Value})");
        }

        if (failures.Count > 0)
        {
            Console.WriteLine($"\n{failures.Count} falha(s); mostrando {Math.Min(show, failures.Count)}:\n");
            foreach (var f in failures.Take(show)) Console.WriteLine(f + "\n");
        }
        return fail == 0 ? 0 : 1;
    }

    private static string Arg(string[] args, string flag)
    {
        int i = Array.IndexOf(args, flag);
        return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
    }

    private static string Indent(string text) => "    " + (text ?? "").Replace("\n", "\n    ");
}
