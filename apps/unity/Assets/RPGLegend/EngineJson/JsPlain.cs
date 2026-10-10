using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace RPGLegend.Engine.Json
{
    /// <summary>
    /// JSON → valor JS "cru" do C#, para as funções da engine que recebem o <c>unknown</c> do TS (o que veio
    /// do save ou da rede, sem forma garantida — ex.: Dungeons.NormalizeRun/NormalizeProgress).
    ///
    /// Diferente do JsSerializer, aqui nada é convertido para o tipo do modelo: texto continua texto e número
    /// continua número, para o <c>typeof x === 'string'</c> do TS valer igual.
    /// Forma: null (null e undefined), bool, double, string, <c>List&lt;object&gt;</c> (lista) e
    /// <c>OrderedMap&lt;object&gt;</c> (objeto, chaves na ordem do JSON). <c>{"$num": "NaN"}</c> vira o double.
    /// </summary>
    public static class JsPlain
    {
        public static object FromToken(JToken token)
        {
            if (JsJson.IsUndefined(token)) return null;
            switch (token.Type)
            {
                case JTokenType.Null:
                    return null;
                case JTokenType.Boolean:
                    return (bool)token;
                case JTokenType.Integer:
                case JTokenType.Float:
                    return (double)token;
                case JTokenType.String:
                    return (string)token;
                case JTokenType.Array:
                {
                    var list = new List<object>();
                    foreach (var element in (JArray)token) list.Add(FromToken(element));
                    return list;
                }
                case JTokenType.Object:
                {
                    if (JsJson.TryReadSpecialNumber(token, out var special)) return special;
                    var map = new OrderedMap<object>();
                    foreach (var p in ((JObject)token).Properties()) map.Set(p.Name, FromToken(p.Value));
                    return map;
                }
                default:
                    return null;
            }
        }
    }
}
