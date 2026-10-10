using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;

namespace RPGLegend.Tests
{
    /// <summary>O que cada caso recebe além dos argumentos: o rng contado e o relógio fixo.</summary>
    public sealed class CaseContext
    {
        public CountingRng Rng;
        public double? Now;

        public RngFn RngFn => Rng.Fn;

        public double NowOrFail()
        {
            if (Now == null) throw new AssertionException("o porte leu o relógio, mas o caso não traz now");
            return Now.Value;
        }
    }

    /// <summary>Executa um caso: recebe input.args e devolve o resultado como JSON (C# null = undefined).</summary>
    public delegate JToken FixtureFn(JToken args, CaseContext ctx);

    /// <summary>
    /// Os casos de um módulo. Para um módulo novo, crie <c>internal sealed class XxxFixtures : IFixtureModule</c>
    /// neste assembly: o registro acha sozinho, sem precisar editar este arquivo.
    /// </summary>
    public interface IFixtureModule
    {
        void Register();
    }

    /// <summary>
    /// Registro do que já foi portado. Cada módulo registra suas funções com o nome do TS; o que não
    /// estiver aqui aparece como "ainda não portado" (ignorado) no Test Runner — é o placar do porte.
    ///
    /// Para registrar um módulo novo: crie um XxxFixtures.cs que implemente IFixtureModule.
    /// </summary>
    public static class FixtureRegistry
    {
        private sealed class Entry
        {
            public FixtureFn Fn;
            public bool CountsItself;
        }

        private static readonly Dictionary<string, Entry> Fns = new Dictionary<string, Entry>();
        private static readonly Dictionary<string, Func<JToken>> Consts = new Dictionary<string, Func<JToken>>();
        private static bool _ready;

        /// <summary>
        /// Registra uma função. countsItself: o caso usa args.count do seu jeito (senão, o executor chama
        /// a função count vezes com o mesmo rng e junta os retornos numa lista, como o gerador).
        /// </summary>
        public static void Fn(string module, string fn, FixtureFn handler, bool countsItself = false)
        {
            Fns[module + "/" + fn] = new Entry { Fn = handler, CountsItself = countsItself };
        }

        public static void Const(string module, string name, Func<JToken> value)
        {
            Consts[module + "/" + name] = value;
        }

        public static bool TryGetFn(string module, string fn, out FixtureFn handler, out bool countsItself)
        {
            EnsureReady();
            if (Fns.TryGetValue(module + "/" + fn, out var e))
            {
                handler = e.Fn;
                countsItself = e.CountsItself;
                return true;
            }
            handler = null;
            countsItself = false;
            return false;
        }

        public static bool TryGetConst(string module, string name, out Func<JToken> value)
        {
            EnsureReady();
            return Consts.TryGetValue(module + "/" + name, out value);
        }

        private static void EnsureReady()
        {
            if (_ready) return;
            _ready = true;
            GameDataLoader.Load(Fixtures.ReadTableText);
            var modules = typeof(FixtureRegistry).Assembly.GetTypes()
                .Where(t => typeof(IFixtureModule).IsAssignableFrom(t) && !t.IsAbstract && !t.IsInterface)
                .OrderBy(t => t.FullName, StringComparer.Ordinal);
            foreach (var t in modules) ((IFixtureModule)Activator.CreateInstance(t, true)).Register();
        }

        // ---------- atalhos para os handlers ----------

        /// <summary>Escreve qualquer modelo como JSON (null vira o null do JSON).</summary>
        public static JToken W(object value) => JsSerializer.Write(value);

        /// <summary>Número como JSON.</summary>
        public static JToken N(double value) => JsJson.FromNumber(value);

        /// <summary>Lê um modelo de um argumento.</summary>
        public static T R<T>(JToken token) => JsSerializer.Read<T>(token);

        /// <summary>Lê um número de um argumento (Number() do JS; ausente vira NaN).</summary>
        public static double Num(JToken token) => JsJson.ToNumber(token);

        /// <summary>Lê um texto de um argumento (ausente ou não-texto vira null).</summary>
        public static string Str(JToken token) => JsJson.Text(token);
    }
}
