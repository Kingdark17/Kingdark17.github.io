using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using RPGLegend.Engine.Json;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// A costura entre a partida do app e a sala do co-op: o que <c>packages/shared/src/jogo/coop.ts</c> faz no
    /// site, aqui em cima do JSON do save (o mesmo que vai pra nuvem), porque o que chega da rede é JSON de outro
    /// jogador, já saneado pelo servidor.
    ///
    /// A regra é a do site: <b>o mapa é compartilhado, o personagem não</b>. Quem conduz manda mapa, posição, andar,
    /// masmorra e missões; cada um guarda o próprio herói, mochila e equipe.
    ///
    /// Duas diferenças de propósito, porque o co-op do app corre em tempo real (2026-11-16):
    /// - <b>só quem conduz manda o estado</b>; quem acompanha manda só o perfil. No site os dois mandam, uma jogada
    ///   por vez; aqui o mapa velho de quem acompanha, chegando atrasado, desfaria o que o outro acabou de fazer.
    /// - <b>o herói que vale é o local</b>: o perfil que o servidor devolve chega atrasado em relação à luta, e
    ///   adotá-lo voltaria a vida e o XP no tempo.
    /// </summary>
    public static class Coop
    {
        /// <summary>Os campos que viajam pela rede (os de <c>CAMPOS_COMPARTILHADOS</c> do TS).</summary>
        private static readonly string[] Compartilhados = { "quests", "floor", "mapMode", "map", "mapRows", "mapCols", "pos", "masmorra" };

        /// <summary>O meu perfil na sala: nome, herói, mochila e equipe (os cosméticos o app ainda não manda).</summary>
        public static JObject Perfil(EstadoDoJogo estado)
        {
            var save = (JObject)JogoJson.ParaSave(estado);
            return new JObject
            {
                ["name"] = estado.Hero.Name,
                ["hero"] = save["hero"],
                ["inventory"] = save["inventory"],
                ["party"] = save["party"],
                ["publicProfile"] = JValue.CreateNull(),
            };
        }

        /// <summary>TS: instantaneoDaSala — o que quem conduz manda: o que é compartilhado, e o próprio perfil no papel dele.</summary>
        public static JObject Instantaneo(EstadoDoJogo estado, int papel)
        {
            var save = (JObject)JogoJson.ParaSave(estado);
            var pacote = new JObject();
            foreach (var campo in Compartilhados)
                if (save[campo] != null) pacote[campo] = save[campo];
            pacote["profiles"] = new JObject
            {
                [papel.ToString()] = new JObject
                {
                    ["name"] = estado.Hero.Name,
                    ["hero"] = save["hero"],
                    ["inventory"] = save["inventory"],
                    ["party"] = save["party"],
                    ["publicProfile"] = JValue.CreateNull(),
                },
            };
            return pacote;
        }

        /// <summary>
        /// TS: aplicarRemoto — o estado de quem conduz por cima do local. Devolve o próprio <paramref name="local"/>
        /// quando o pacote não dá pra aplicar (sem posição, sem mapa nenhum, ou trocando de modo sem trazer o mapa).
        /// Mapa ausente quer dizer "não mudou": o servidor só o manda quando esta conexão ainda não tem a versão dele.
        /// </summary>
        public static EstadoDoJogo AplicarRemoto(EstadoDoJogo local, JObject remoto)
        {
            if (local == null || remoto == null) return local;
            var save = (JObject)JogoJson.ParaSave(local);
            bool veioMapa = remoto["map"] is JArray mapaRemoto && mapaRemoto.Count > 0;
            bool temMapa = veioMapa || (save["map"] is JArray mapaLocal && mapaLocal.Count > 0);
            if (!temMapa || !(remoto["pos"] is JObject)) return local;

            var modo = remoto["mapMode"] != null && remoto["mapMode"].Type == JTokenType.String ? (string)remoto["mapMode"] : local.MapMode;
            if (modo != "dungeon" && modo != "city") return local;
            // Trocar de modo exige o mapa no pacote: cidade e masmorra têm células de formato diferente.
            if (modo != local.MapMode && !veioMapa) return local;

            foreach (var campo in Compartilhados)
            {
                if (campo == "map" && !veioMapa) continue;
                var valor = remoto[campo];
                if (valor != null && valor.Type != JTokenType.Null) save[campo] = valor.DeepClone();
            }
            save["mapMode"] = modo;
            try
            {
                return JogoJson.LerEstado(save) ?? local;
            }
            catch (Newtonsoft.Json.JsonException)
            {
                // Pacote torto não derruba a partida: fica o que havia.
                return local;
            }
        }
    }
}
