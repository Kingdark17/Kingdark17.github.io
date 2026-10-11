using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine.Json;

namespace RPGLegend.Tests
{
    /// <summary>
    /// Comparação de JSON com as regras dos fixtures: número compara por valor (NaN = NaN, 0 = -0),
    /// {"$num": …} vale como número, objeto compara chave a chave sem olhar a ordem, lista compara na ordem.
    /// Campo a mais ou a menos é diferença — o undefined do TS some do JSON, então o C# também tem que omitir.
    /// </summary>
    public static class JsonAssert
    {
        public static void AreEqual(JToken expected, JToken actual, string path)
        {
            var diff = FirstDifference(expected, actual, path);
            if (diff != null) throw new FixtureFailure(diff);
        }

        public static string FirstDifference(JToken e, JToken a, string path)
        {
            bool eu = JsJson.IsUndefined(e), au = JsJson.IsUndefined(a);
            if (eu || au) return eu == au ? null : Mismatch(path, e, a);

            if (IsNumber(e, out var en))
            {
                if (!IsNumber(a, out var an)) return Mismatch(path, e, a);
                if (double.IsNaN(en) && double.IsNaN(an)) return null;
                return en == an ? null : Mismatch(path, e, a);
            }

            if (e.Type == JTokenType.Array)
            {
                if (a.Type != JTokenType.Array) return Mismatch(path, e, a);
                var ea = (JArray)e;
                var aa = (JArray)a;
                if (ea.Count != aa.Count)
                    return path + ": o TS tem " + ea.Count + " itens, o C# tem " + aa.Count + "\n  TS: " + Show(e) + "\n  C#: " + Show(a);
                for (int i = 0; i < ea.Count; i++)
                {
                    var d = FirstDifference(ea[i], aa[i], path + "[" + i + "]");
                    if (d != null) return d;
                }
                return null;
            }

            if (e.Type == JTokenType.Object)
            {
                if (a.Type != JTokenType.Object) return Mismatch(path, e, a);
                var eo = (JObject)e;
                var ao = (JObject)a;
                foreach (var p in eo.Properties())
                {
                    var d = FirstDifference(p.Value, ao[p.Name], path + "." + p.Name);
                    if (d != null) return d;
                }
                foreach (var p in ao.Properties())
                    if (eo[p.Name] == null) return path + "." + p.Name + ": o C# tem este campo e o TS não (" + Show(p.Value) + ")";
                return null;
            }

            return JToken.DeepEquals(e, a) ? null : Mismatch(path, e, a);
        }

        private static bool IsNumber(JToken t, out double v)
        {
            if (t.Type == JTokenType.Integer || t.Type == JTokenType.Float)
            {
                v = (double)t;
                return true;
            }
            return JsJson.TryReadSpecialNumber(t, out v);
        }

        private static string Mismatch(string path, JToken e, JToken a) => path + ":\n  TS: " + Show(e) + "\n  C#: " + Show(a);

        private static string Show(JToken t)
        {
            if (JsJson.IsUndefined(t)) return "undefined";
            var s = t.ToString(Formatting.None);
            return s.Length > 400 ? s.Substring(0, 400) + "…" : s;
        }
    }
}
