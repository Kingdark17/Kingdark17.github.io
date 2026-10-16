using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>
    /// TS: Apresentacao — ícone, título e texto de cada sala, escolhidos uma vez pelo lugar (cidade ou masmorra).
    /// As funções recebem a sala da grade do próprio estado.
    /// </summary>
    public sealed class Apresentacao
    {
        /// <summary>Nome do lugar inteiro: "Cidade Inicial" ou "Floresta · Normal — Andar 3".</summary>
        public string Lugar;
        /// <summary>Legenda do minimapa: pares [tipo de sala, nome].</summary>
        public List<List<string>> Legenda;
        [JsIgnore] public Func<RoomCell, string> Icone;
        [JsIgnore] public Func<RoomCell, string> Descricao;
        [JsIgnore] public Func<RoomCell, string> TextoDeEntrada;
        /// <summary>Nome curto pra citar a sala de fora dela ("um baú fechado").</summary>
        [JsIgnore] public Func<RoomCell, string> Rotulo;
        /// <summary>Sala que já entregou o que tinha: baú aberto, monstro derrotado, evento resolvido.</summary>
        [JsIgnore] public Func<RoomCell, bool> Gasta;
    }

    /// <summary>As tabelas de jogo/apresentacao.ts (fixtures/data/jogo/apresentacao.json; as duas são privadas).</summary>
    public sealed class ApresentacaoData
    {
        [JsName("LEGENDA_DA_CIDADE")] public List<List<string>> LegendaDaCidade = new List<List<string>>();
        [JsName("LEGENDA_DA_MASMORRA")] public List<List<string>> LegendaDaMasmorra = new List<List<string>>();
    }

    public static partial class GameData
    {
        private static ApresentacaoData _apresentacaoTable;

        /// <summary>jogo/apresentacao: as legendas do minimapa.</summary>
        public static ApresentacaoData ApresentacaoTable
        {
            get => Require(_apresentacaoTable, "jogo/apresentacao");
            set => _apresentacaoTable = value;
        }
    }

    /// <summary>Port de shared/src/jogo/apresentacao.ts.</summary>
    public static class Apresentacoes
    {
        private static ApresentacaoData D => GameData.ApresentacaoTable;

        /// <summary>TS: apresentacaoDe.</summary>
        public static Apresentacao ApresentacaoDe(EstadoDoJogo estado)
        {
            if (estado.MapMode == "city")
            {
                return new Apresentacao
                {
                    Lugar = "Cidade Inicial",
                    Legenda = D.LegendaDaCidade,
                    Icone = c => City.IconFor((CityCell)c),
                    Descricao = c => City.RoomDesc((CityCell)c),
                    TextoDeEntrada = c => City.EntryText((CityCell)c),
                    Rotulo = c => City.ShortLabel((CityCell)c),
                    // Nada na cidade se esgota: a loja repõe estoque, a taverna sempre atende.
                    Gasta = c => false,
                };
            }

            return new Apresentacao
            {
                Lugar = Dungeons.RunName(estado.Masmorra) + " — Andar " + Js.NumberToString(estado.Floor) +
                        (DungeonFloors.IsBossFloor(estado.Floor) ? " ⚔️ Andar de Chefe" : ""),
                Legenda = D.LegendaDaMasmorra,
                Icone = c => DungeonFloors.IconFor((DungeonCell)c),
                Descricao = c => DungeonFloors.RoomDesc((DungeonCell)c),
                TextoDeEntrada = c => DungeonFloors.EntryText((DungeonCell)c),
                Rotulo = c => DungeonFloors.ShortLabel((DungeonCell)c),
                Gasta = c =>
                {
                    var sala = (DungeonCell)c;
                    return (sala.Collected ?? false) || (sala.Beaten ?? false) || (sala.Resolved ?? false);
                },
            };
        }
    }
}
