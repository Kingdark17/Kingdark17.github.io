using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Fortificacao — o nome, o ícone, a força por nível (I, II, III) e o teto da soma.</summary>
    public sealed class Fortificacao
    {
        public string Nome;
        public string Icone;
        /// <summary>A fração de dano a menos, a chance de não ser envenenado, ou a fração da vida máxima que vira escudo.</summary>
        public List<double> Forca = new List<double>();
        public double Teto;
    }

    /// <summary>As tabelas de items/encantamentos.ts (fixtures/data/items/encantamentos.json).</summary>
    public sealed class EncantamentosData
    {
        [JsName("ENCANTAMENTOS")] public OrderedMap<Fortificacao> Encantamentos = new OrderedMap<Fortificacao>();
        [JsName("TIPOS_DE_ENCANTAMENTO")] public List<string> TiposDeEncantamento = new List<string>();
        [JsName("EVITA_DRENO")] public List<double> EvitaDreno = new List<double>();
        [JsName("TETO_DO_DRENO")] public double TetoDoDreno;
        [JsName("CUSTO_DO_ENCANTAMENTO")] public List<double> CustoDoEncantamento = new List<double>();
    }

    public static partial class GameData
    {
        private static EncantamentosData _encantamentosTable;

        /// <summary>items/encantamentos: as fortificações da Encantadora, os níveis e os preços.</summary>
        public static EncantamentosData EncantamentosTable
        {
            get => Require(_encantamentosTable, "items/encantamentos");
            set => _encantamentosTable = value;
        }
    }

    /// <summary>TS: DefesasDoHeroi — o que a arena desconta e evita no herói, somando as armaduras vestidas.</summary>
    public sealed class DefesasDoHeroi
    {
        /// <summary>A fração de dano a menos dos monstros que não são mágicos.</summary>
        public double Robustez;
        /// <summary>A fração de dano a menos dos monstros mágicos.</summary>
        public double ResistenciaMagica;
        /// <summary>A chance de o dreno de mana não pegar.</summary>
        public double EvitaDreno;
        /// <summary>A chance de não ser envenenado.</summary>
        public double ResistenciaVeneno;
        /// <summary>A fração da vida máxima que vira escudo no começo da luta.</summary>
        public double Vigor;
    }

    /// <summary>
    /// Os encantamentos, só do app (port de shared/src/items/encantamentos.ts): a Encantadora da cidade fortifica uma
    /// armadura em troca de ouro. Robustez, resistência mágica, resistência a veneno e vigor (o escudo da luta); só
    /// armaduras, um por peça; três níveis; peças com a mesma fortificação somam até o teto. Só a arena aplica.
    /// </summary>
    public static class Encantamentos
    {
        private static EncantamentosData D => GameData.EncantamentosTable;

        private static double NivelValido(double? nivel) =>
            Js.Min(GameData.ItemTable.Romanos.Count, Js.Max(1, Math.Truncate(nivel ?? 1)));

        private static string Percentual(double fracao) => Js.NumberToString(Js.Round(fracao * 100)) + "%";

        private static Fortificacao Def(string tipo)
        {
            if (!D.Encantamentos.TryGet(tipo, out var def) || def == null) throw new EngineError("fortificação desconhecida: " + Js.Str(tipo), "Error");
            return def;
        }

        /// <summary>TS: podeEncantar — só armadura recebe encantamento (o escudo é armadura).</summary>
        public static bool PodeEncantar(Item item) => Items.CategoryOf(item) == "armadura";

        /// <summary>TS: encantamentoDaPeca — o encantamento da peça, ou null.</summary>
        public static EncantamentoNaPeca EncantamentoDaPeca(Item item) => item.Encantamento;

        /// <summary>TS: nomeDoEncantamento — "Robustez II".</summary>
        public static string NomeDoEncantamento(EncantamentoNaPeca encantamento) =>
            Def(encantamento.Tipo).Nome + " " + GameData.ItemTable.Romanos[(int)NivelValido(encantamento.Nivel) - 1];

        /// <summary>TS: custoDoEncantamento — o preço do nível, em ouro.</summary>
        public static double CustoDoEncantamento(double nivel) => D.CustoDoEncantamento[(int)NivelValido(nivel) - 1];

        /// <summary>TS: efeitoDoEncantamento — o que a fortificação faz no nível, com os números dele.</summary>
        public static string EfeitoDoEncantamento(string tipo, double nivel)
        {
            int n = (int)NivelValido(nivel) - 1;
            string forca = Percentual(Def(tipo).Forca[n]);
            switch (tipo)
            {
                case "robustez": return "-" + forca + " de dano dos monstros que batem de perto ou investem.";
                case "resistencia_magica":
                    return "-" + forca + " de dano dos monstros mágicos, e " + Percentual(D.EvitaDreno[n]) + " de chance de evitar o dreno de mana.";
                case "resistencia_veneno": return forca + " de chance de não ser envenenado.";
                case "vigor": return "No começo de cada luta, um escudo de " + forca + " da vida máxima, que apanha primeiro.";
                default: throw new EngineError("fortificação desconhecida: " + Js.Str(tipo), "Error");
            }
        }

        /// <summary>TS: encantarPeca — a peça com a fortificação no nível pedido, no lugar da que houver. Fora das armaduras, null.</summary>
        public static Item EncantarPeca(Item peca, string tipo, double nivel)
        {
            if (!PodeEncantar(peca)) return null;
            var copia = peca.Clone();
            copia.Encantamento = new EncantamentoNaPeca { Tipo = tipo, Nivel = NivelValido(nivel) };
            return copia;
        }

        /// <summary>
        /// TS: defesasDoHeroi — as fortificações das armaduras vestidas, somadas por tipo (na ordem dos slots), cada
        /// uma até o teto.
        /// </summary>
        public static DefesasDoHeroi DefesasDoHeroi(Hero hero)
        {
            double robustez = 0, magica = 0, veneno = 0, vigor = 0, evitaDreno = 0;
            foreach (var slot in StatKeys.EquipSlots)
            {
                var peca = hero.Equip?.Get(slot);
                if (peca?.Encantamento == null || !PodeEncantar(peca)) continue;
                string tipo = peca.Encantamento.Tipo;
                int n = (int)NivelValido(peca.Encantamento.Nivel) - 1;
                double forca = Def(tipo).Forca[n];
                switch (tipo)
                {
                    case "robustez": robustez += forca; break;
                    case "resistencia_magica":
                        magica += forca;
                        evitaDreno += D.EvitaDreno[n];
                        break;
                    case "resistencia_veneno": veneno += forca; break;
                    case "vigor": vigor += forca; break;
                }
            }
            return new DefesasDoHeroi
            {
                Robustez = Js.Min(Def("robustez").Teto, robustez),
                ResistenciaMagica = Js.Min(Def("resistencia_magica").Teto, magica),
                EvitaDreno = Js.Min(D.TetoDoDreno, evitaDreno),
                ResistenciaVeneno = Js.Min(Def("resistencia_veneno").Teto, veneno),
                Vigor = Js.Min(Def("vigor").Teto, vigor),
            };
        }

        /// <summary>TS: escudoDoVigor — o escudo do vigor no começo da luta: a fração da vida máxima, arredondada. Sem vigor, 0.</summary>
        public static double EscudoDoVigor(Hero hero) => Js.Round(hero.MaxHp * DefesasDoHeroi(hero).Vigor);
    }
}
