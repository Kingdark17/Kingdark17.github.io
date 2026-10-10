using System;
using System.IO;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace RPGLegend.Engine.Json
{
    /// <summary>
    /// Ponte entre JSON e os valores do JS. Usada para ler saves e fixtures:
    /// campo ausente é undefined, {"$num":"NaN"} é NaN, e número chega pelo Number() do JS.
    /// </summary>
    public static class JsJson
    {
        /// <summary>Lê JSON sem as conversões automáticas do Newtonsoft (texto com cara de data continua texto).</summary>
        public static JToken Parse(string json)
        {
            using (var reader = new JsonTextReader(new StringReader(json)))
            {
                reader.DateParseHandling = DateParseHandling.None;
                reader.FloatParseHandling = FloatParseHandling.Double;
                return JToken.ReadFrom(reader);
            }
        }

        public static bool IsUndefined(JToken t) => t == null || t.Type == JTokenType.Undefined;

        public static bool IsNull(JToken t) => t != null && t.Type == JTokenType.Null;

        /// <summary>Filho de um objeto, ou null (undefined) quando o pai não é objeto.</summary>
        public static JToken Prop(JToken obj, string key) => obj is JObject o ? o[key] : null;

        /// <summary>Texto de um campo, ou null quando ausente, null ou não for texto.</summary>
        public static string Text(JToken t) => t != null && t.Type == JTokenType.String ? (string)t : null;

        /// <summary>Reconhece {"$num": "NaN" | "Infinity" | "-Infinity"}.</summary>
        public static bool TryReadSpecialNumber(JToken t, out double value)
        {
            value = 0;
            if (t is JObject o && o.Count == 1 && o.TryGetValue("$num", out var raw) && raw.Type == JTokenType.String)
            {
                value = Js.StringToNumber((string)raw);
                return true;
            }
            return false;
        }

        /// <summary>Number(valor) do JS aplicado a um valor JSON.</summary>
        public static double ToNumber(JToken t)
        {
            if (IsUndefined(t)) return double.NaN;
            switch (t.Type)
            {
                case JTokenType.Null: return 0.0;
                case JTokenType.Boolean: return (bool)t ? 1.0 : 0.0;
                case JTokenType.Integer:
                case JTokenType.Float: return (double)t;
                case JTokenType.String: return Js.StringToNumber((string)t);
                case JTokenType.Array: return Js.StringToNumber(JoinArray((JArray)t));
                case JTokenType.Object: return TryReadSpecialNumber(t, out var v) ? v : double.NaN;
                default: return double.NaN;
            }
        }

        /// <summary>Número opcional: ausente vira null (undefined); o resto passa pelo Number() do JS.</summary>
        public static double? ToOptionalNumber(JToken t) => IsUndefined(t) ? (double?)null : ToNumber(t);

        /// <summary>Verdade de um valor no JS: undefined, null, false, 0, NaN e "" são falsos.</summary>
        public static bool Truthy(JToken t)
        {
            if (IsUndefined(t)) return false;
            switch (t.Type)
            {
                case JTokenType.Null: return false;
                case JTokenType.Boolean: return (bool)t;
                case JTokenType.Integer:
                case JTokenType.Float: return Js.Truthy((double)t);
                case JTokenType.String: return ((string)t).Length > 0;
                case JTokenType.Object: return !TryReadSpecialNumber(t, out var v) || Js.Truthy(v);
                default: return true;
            }
        }

        /// <summary>Número do JS como JSON: inteiro sem casa decimal; NaN/Infinity no formato {"$num": …}.</summary>
        public static JToken FromNumber(double d)
        {
            if (double.IsNaN(d)) return new JObject { ["$num"] = "NaN" };
            if (double.IsPositiveInfinity(d)) return new JObject { ["$num"] = "Infinity" };
            if (double.IsNegativeInfinity(d)) return new JObject { ["$num"] = "-Infinity" };
            if (d == Math.Floor(d) && Math.Abs(d) < 9007199254740992.0) return new JValue((long)d);
            return new JValue(d);
        }

        /// <summary>double? do C# como JSON: null vira null.</summary>
        public static JToken FromNullableNumber(double? d) => d.HasValue ? FromNumber(d.Value) : JValue.CreateNull();

        /// <summary>String(valor) do JS para texto, número, booleano e listas (Array.prototype.join).</summary>
        public static string ToJsString(JToken t)
        {
            if (IsUndefined(t)) return "undefined";
            switch (t.Type)
            {
                case JTokenType.Null: return "null";
                case JTokenType.Boolean: return (bool)t ? "true" : "false";
                case JTokenType.Integer:
                case JTokenType.Float: return Js.NumberToString((double)t);
                case JTokenType.String: return (string)t;
                case JTokenType.Array: return JoinArray((JArray)t);
                case JTokenType.Object: return TryReadSpecialNumber(t, out var v) ? Js.NumberToString(v) : "[object Object]";
                default: return t.ToString();
            }
        }

        private static string JoinArray(JArray a)
        {
            var sb = new StringBuilder();
            for (int i = 0; i < a.Count; i++)
            {
                if (i > 0) sb.Append(',');
                var e = a[i];
                if (IsUndefined(e) || e.Type == JTokenType.Null) continue;
                sb.Append(ToJsString(e));
            }
            return sb.ToString();
        }
    }
}
