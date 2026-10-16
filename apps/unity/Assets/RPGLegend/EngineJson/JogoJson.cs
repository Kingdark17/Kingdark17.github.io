using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace RPGLegend.Engine.Json
{
    /// <summary>
    /// O estado do jogo e o save vindos do JSON (shared/src/jogo/estado.ts). O estado é a união do TS
    /// discriminada por <c>mapMode</c>, e por isso não sai de um <c>JsSerializer.Read</c> simples: a classe
    /// (cidade ou masmorra) é escolhida aqui. Escrever não precisa de nada: cada classe já escreve o próprio map.
    /// </summary>
    public static class JogoJson
    {
        /// <summary>O estado: "dungeon" é masmorra; o resto, cidade (como o <c>!== 'dungeon'</c> do TS).</summary>
        public static EstadoDoJogo LerEstado(JToken token)
        {
            if (JsJson.IsUndefined(token) || token.Type == JTokenType.Null) return null;
            return JsJson.Text(token["mapMode"]) == "dungeon"
                ? (EstadoDoJogo)JsSerializer.Read<EstadoNaMasmorra>(token)
                : JsSerializer.Read<EstadoNaCidade>(token);
        }

        /// <summary>
        /// O save como veio da nuvem. A masmorra e o progresso ficam crus (o normalize do TS é que dá a forma);
        /// a grade só é lida quando o save está na masmorra e ela é mesmo uma lista — o único caso em que o
        /// TS a usa.
        /// </summary>
        public static SaveCarregado LerSave(JToken token)
        {
            var save = JsSerializer.Read<SaveCarregado>(token);
            if (save == null) return null;
            save.Masmorra = JsPlain.FromToken(token["masmorra"]);
            save.Progresso = JsPlain.FromToken(token["progresso"]);
            var mapa = token["map"];
            if (save.MapMode == "dungeon" && mapa is JArray) save.Map = JsSerializer.Read<List<List<DungeonCell>>>(mapa);
            return save;
        }
    }
}
