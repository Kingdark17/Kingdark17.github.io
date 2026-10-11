using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Lê os resultados de referência gerados pelo TypeScript (packages/shared/fixtures).
    /// O projeto Unity mora em apps/unity, dentro do repositório do jogo: a pasta é achada subindo a partir
    /// da pasta atual (na Unity, a raiz do projeto) e, se não der, da pasta do executável. A variável de
    /// ambiente RPG_FIXTURES_DIR passa por cima das duas. No celular não há pasta: o build de teste troca
    /// <see cref="ReadText"/> por uma leitura dos Resources.
    /// </summary>
    public static class Fixtures
    {
        private static readonly Dictionary<string, JArray> Cases = new Dictionary<string, JArray>();
        private static string _dir;

        /// <summary>
        /// Texto de um arquivo dos fixtures pelo caminho relativo, com "/" ("combat.json",
        /// "data/hero/catalog.json"), ou null se não existir. Por padrão lê do disco, a partir de <see cref="Dir"/>.
        /// </summary>
        public static Func<string, string> ReadText = ReadFromDisk;

        private static string ReadFromDisk(string relative)
        {
            var path = Path.Combine(Dir, relative.Replace('/', Path.DirectorySeparatorChar));
            return File.Exists(path) ? File.ReadAllText(path) : null;
        }

        public static string Dir
        {
            get
            {
                if (_dir != null) return _dir;
                var env = Environment.GetEnvironmentVariable("RPG_FIXTURES_DIR");
                if (!string.IsNullOrEmpty(env)) return _dir = env;
                var found = FindUp(Directory.GetCurrentDirectory()) ?? FindUp(AppDomain.CurrentDomain.BaseDirectory);
                if (found == null)
                    throw new DirectoryNotFoundException(
                        "Não achei packages/shared/fixtures subindo a partir de " + Directory.GetCurrentDirectory() +
                        ". O projeto Unity precisa estar dentro do repositório do jogo (apps/unity); " +
                        "ou aponte a pasta com a variável de ambiente RPG_FIXTURES_DIR.");
                return _dir = found;
            }
        }

        /// <summary>Sobe de <paramref name="start"/> até a raiz do disco procurando packages/shared/fixtures.</summary>
        private static string FindUp(string start)
        {
            if (string.IsNullOrEmpty(start)) return null;
            for (var dir = new DirectoryInfo(start); dir != null; dir = dir.Parent)
            {
                var candidate = Path.Combine(dir.FullName, "packages", "shared", "fixtures");
                if (Directory.Exists(candidate)) return candidate;
            }
            return null;
        }

        /// <summary>Casos de fixtures/&lt;modulo&gt;.json, ou null se o arquivo não existir.</summary>
        public static JArray TryLoad(string module)
        {
            if (Cases.TryGetValue(module, out var cached)) return cached;
            var text = ReadText(module + ".json");
            if (text == null) return null;
            var arr = (JArray)JsJson.Parse(text);
            Cases[module] = arr;
            return arr;
        }

        /// <summary>Texto de uma tabela de fixtures/data (ex.: "hero/catalog"), para o GameDataLoader.</summary>
        public static string ReadTableText(string table) =>
            ReadText("data/" + table + ".json") ?? throw new FileNotFoundException("Tabela não encontrada: data/" + table + ".json");

        /// <summary>
        /// O rng de input.rng, contando as chamadas. { seed } é o mulberry32; { sequence } devolve os valores
        /// em ordem e, acabada a lista, repete o último (0 se vazia) — o sequenceRng do gerador.
        /// Sem rng no caso, sortear é erro: o TS não sorteou ali.
        /// </summary>
        public static CountingRng BuildRng(JToken spec)
        {
            if (JsJson.IsUndefined(spec) || spec.Type == JTokenType.Null)
                return new CountingRng(() => throw new FixtureFailure("o porte sorteou, mas o caso não traz rng (o TS não sorteou aqui)"));

            if (!JsJson.IsUndefined(spec["seed"]))
                return new CountingRng(Rng.SeededRng(JsJson.ToNumber(spec["seed"])));

            if (spec["sequence"] is JArray arr)
            {
                var seq = new List<double>();
                foreach (var v in arr) seq.Add(JsJson.ToNumber(v));
                int i = 0;
                return new CountingRng(() => i < seq.Count ? seq[i++] : (seq.Count > 0 ? seq[seq.Count - 1] : 0.0));
            }

            throw new NotSupportedException("rng desconhecido no caso: " + spec);
        }
    }

    public sealed class CountingRng
    {
        private readonly RngFn _inner;

        public int Calls { get; private set; }

        public CountingRng(RngFn inner) { _inner = inner; }

        public double Next()
        {
            Calls++;
            return _inner();
        }

        public RngFn Fn => Next;
    }
}
