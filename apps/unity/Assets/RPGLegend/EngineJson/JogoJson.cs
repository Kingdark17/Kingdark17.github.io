using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace RPGLegend.Engine.Json
{
    /// <summary>
    /// O estado do jogo e o save vindos do JSON (shared/src/jogo/estado.ts). O estado é a união do TS
    /// discriminada por <c>mapMode</c>: quem escolhe a classe (cidade ou masmorra) é o
    /// <see cref="EstadoDoJogoConverter"/>, registrado no <see cref="JsSerializer"/>, então um campo
    /// <see cref="EstadoDoJogo"/> dentro de outro objeto (a mochila, a loja) também sai certo. Escrever não precisa
    /// de nada: cada classe já escreve o próprio map.
    /// </summary>
    public static class JogoJson
    {
        /// <summary>O estado: "dungeon" é masmorra; o resto, cidade (como o <c>!== 'dungeon'</c> do TS).</summary>
        public static EstadoDoJogo LerEstado(JToken token) => JsSerializer.Read<EstadoDoJogo>(token);

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

    /// <summary>
    /// Lê um <see cref="EstadoDoJogo"/> (a base abstrata) como <see cref="EstadoNaMasmorra"/> quando o mapMode é
    /// "dungeon", e como <see cref="EstadoNaCidade"/> no resto. As duas classes concretas se leem sozinhas, e a
    /// escrita fica com o padrão.
    /// </summary>
    internal sealed class EstadoDoJogoConverter : JsonConverter
    {
        public override bool CanConvert(Type objectType) => objectType == typeof(EstadoDoJogo);

        public override bool CanWrite => false;

        public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
        {
            var token = JToken.Load(reader);
            if (token.Type == JTokenType.Null) return null;
            var modo = token is JObject objeto ? JsJson.Text(objeto["mapMode"]) : null;
            var classe = modo == "dungeon" ? typeof(EstadoNaMasmorra) : typeof(EstadoNaCidade);
            return token.ToObject(classe, serializer);
        }

        public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer) =>
            throw new NotSupportedException("o estado se escreve pela classe concreta");
    }
}
