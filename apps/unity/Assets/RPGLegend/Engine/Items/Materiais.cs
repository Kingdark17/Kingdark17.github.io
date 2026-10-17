using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: a rampa de chance de um degrau ({ desde, cheio, chance }).</summary>
    public sealed class RampaDoDegrau
    {
        public double Desde;
        public double Cheio;
        public double Chance;
    }

    /// <summary>TS: o que chancesDoDegrau devolve.</summary>
    public sealed class ChancesDoDegrau
    {
        public double Dois;
        public double Tres;
    }

    /// <summary>As tabelas de items/materiais.ts (fixtures/data/items/materiais.json).</summary>
    public sealed class MateriaisData
    {
        /// <summary>O nome do material em cada degrau de cada escada.</summary>
        [JsName("MATERIAIS")] public OrderedMap<List<string>> Materiais = new OrderedMap<List<string>>();
        [JsName("ULTIMO_DEGRAU")] public double UltimoDegrau;
        [JsName("BONUS_POR_DEGRAU")] public double BonusPorDegrau;
        [JsName("CHANCE_DO_DEGRAU_2")] public RampaDoDegrau ChanceDoDegrau2;
        [JsName("CHANCE_DO_DEGRAU_3")] public RampaDoDegrau ChanceDoDegrau3;
        [JsName("CHANCE_DO_CHEFE")] public double ChanceDoChefe;
    }

    public static partial class GameData
    {
        private static MateriaisData _materiaisTable;

        /// <summary>items/materiais: as escadas de material, o bônus por degrau e a chance de cada um.</summary>
        public static MateriaisData MateriaisTable
        {
            get => Require(_materiaisTable, "items/materiais");
            set => _materiaisTable = value;
        }
    }

    /// <summary>
    /// Port de shared/src/items/materiais.ts: os materiais das armas e armaduras, só do app (decisão do usuário,
    /// 2026-10-17). Cada peça tem uma escada de três degraus pelo tipo dela (metal, madeira, couro, tecido), o
    /// primeiro é a peça de hoje, e cada degrau acima soma +25% na base, antes da raridade. Os degraus 2 e 3 só
    /// nascem quando quem pede é o app.
    /// </summary>
    public static class Materiais
    {
        private static MateriaisData D => GameData.MateriaisTable;

        /// <summary>O degrau mais alto da escada.</summary>
        public static double UltimoDegrau => D.UltimoDegrau;

        /// <summary>TS: multiplicadorDoDegrau — o multiplicador da base da peça neste degrau.</summary>
        public static double MultiplicadorDoDegrau(double degrau) => 1 + D.BonusPorDegrau * (degrau - 1);

        private static double Rampa(double andar, RampaDoDegrau r)
        {
            if (andar <= r.Desde) return 0;
            return r.Chance * Js.Min(1, (andar - r.Desde) / (r.Cheio - r.Desde));
        }

        /// <summary>TS: chancesDoDegrau — a chance de cair no degrau 2 e no 3; as duas juntas nunca passam de 1.</summary>
        public static ChancesDoDegrau ChancesDoDegrau(double andar, bool chefe = false)
        {
            double vezes = chefe ? D.ChanceDoChefe : 1;
            double tres = Js.Min(1, Rampa(andar, D.ChanceDoDegrau3) * vezes);
            double dois = Js.Min(1 - tres, Rampa(andar, D.ChanceDoDegrau2) * vezes);
            return new ChancesDoDegrau { Dois = dois, Tres = tres };
        }

        /// <summary>
        /// TS: sortearDegrau — o degrau de uma peça que cai, com um número do rng. <paramref name="teto"/> 2 é a loja do
        /// app: o que seria 3 vira 2.
        /// </summary>
        public static double SortearDegrau(double andar, bool chefe = false, RngFn rng = null, double? teto = null)
        {
            rng = rng ?? Rng.Default;
            double limite = teto ?? D.UltimoDegrau;
            var chances = ChancesDoDegrau(andar, chefe);
            double sorteio = rng();
            if (sorteio < chances.Tres) return Js.Min(3, limite);
            if (sorteio < chances.Tres + chances.Dois) return Js.Min(2, limite);
            return 1;
        }

        /// <summary>TS: nomeDoMaterial — o material da peça neste degrau; null no primeiro e em peça sem escada.</summary>
        public static string NomeDoMaterial(ItemTemplate template, double? degrau)
        {
            if (!Js.Truthy(template.Escada) || degrau == null || degrau.Value < 2) return null;
            if (!D.Materiais.TryGet(template.Escada, out var nomes) || nomes == null) return null;
            // MATERIAIS[escada][min(degrau, 3) - 1]: índice quebrado (2,5) não acha nada, como no JS.
            double indice = Js.Min(degrau.Value, D.UltimoDegrau) - 1;
            if (indice != System.Math.Floor(indice) || indice < 0 || indice >= nomes.Count) return null;
            return nomes[(int)indice];
        }

        /// <summary>TS: nomeComMaterial — o nome de hoje no primeiro degrau, e "de" mais o material nos outros.</summary>
        public static string NomeComMaterial(ItemTemplate template, double? degrau)
        {
            string material = NomeDoMaterial(template, degrau);
            if (material == null) return template.Name;
            return (template.NomeSemMaterial ?? template.Name) + " de " + material;
        }
    }
}
