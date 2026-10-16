using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Anotacao — uma linha do Diário de Aventura.</summary>
    public sealed class Anotacao
    {
        /// <summary>Chave estável de lista; cresce sempre.</summary>
        public double Id;
        public string Icone;
        public string Titulo;
        public string Texto;

        [JsExtra] public JsExtras Extra;
    }

    /// <summary>As tabelas de jogo/diario.ts (fixtures/data/jogo/diario.json).</summary>
    public sealed class DiarioData
    {
        [JsName("LIMITE_DO_DIARIO")] public double LimiteDoDiario;
    }

    public static partial class GameData
    {
        private static DiarioData _diarioTable;

        /// <summary>jogo/diario: quantas anotações o diário guarda.</summary>
        public static DiarioData DiarioTable
        {
            get => Require(_diarioTable, "jogo/diario");
            set => _diarioTable = value;
        }
    }

    /// <summary>
    /// Port de shared/src/jogo/diario.ts: o registro do que aconteceu nesta partida. Vive na memória da sessão,
    /// não no save.
    /// </summary>
    public static class Diario
    {
        /// <summary>TS: LIMITE_DO_DIARIO.</summary>
        public static double LimiteDoDiario => GameData.DiarioTable.LimiteDoDiario;

        /// <summary>TS: anotar — o mais novo entra na frente; o que passa do limite sai do fim.</summary>
        public static List<Anotacao> Anotar(IReadOnlyList<Anotacao> diario, Anotacao entrada)
        {
            double id = (diario.Count > 0 ? diario[0].Id : 0) + 1;
            var nova = new Anotacao { Id = id, Icone = entrada.Icone, Titulo = entrada.Titulo, Texto = entrada.Texto, Extra = entrada.Extra?.Clone() };

            var lista = new List<Anotacao> { nova };
            lista.AddRange(diario);
            int limite = (int)LimiteDoDiario;
            if (lista.Count > limite) lista.RemoveRange(limite, lista.Count - limite);
            return lista;
        }
    }
}
