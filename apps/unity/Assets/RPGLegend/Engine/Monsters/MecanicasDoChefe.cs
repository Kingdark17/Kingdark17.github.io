using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>As tabelas de monsters/mecanicas-do-chefe.ts (fixtures/data/monsters/mecanicas-do-chefe.json).</summary>
    public sealed class MecanicasDoChefeData
    {
        [JsName("MECANICAS_DO_CHEFE")] public List<string> Mecanicas = new List<string>();
        [JsName("BARREIRA_DO_CHEFE")] public double BarreiraDoChefe;
        [JsName("AJUDANTES_DO_CHEFE")] public double AjudantesDoChefe;
        [JsName("CARGA_A_CADA")] public double CargaACada;
        [JsName("LIMITE_DO_DESESPERO")] public double LimiteDoDesespero;
        [JsName("CURA_DO_CHEFE")] public double CuraDoChefe;
        [JsName("FORCA_NA_FURIA")] public double ForcaNaFuria;
        [JsName("VELOCIDADE_NA_FURIA_DO_CHEFE")] public double VelocidadeNaFuriaDoChefe;
        [JsName("PASSA_PELO_ESCUDO")] public double PassaPeloEscudo;
        [JsName("ESCUDO_TROCA_A_CADA")] public double EscudoTrocaACada;
    }

    public static partial class GameData
    {
        private static MecanicasDoChefeData _mecanicasDoChefeTable;

        /// <summary>monsters/mecanicas-do-chefe: as mecânicas dos chefes de andar 5.</summary>
        public static MecanicasDoChefeData MecanicasDoChefeTable
        {
            get => Require(_mecanicasDoChefeTable, "monsters/mecanicas-do-chefe");
            set => _mecanicasDoChefeTable = value;
        }
    }

    /// <summary>
    /// As mecânicas dos chefes de andar 5 (port de shared/src/monsters/mecanicas-do-chefe.ts; doc do Breno de
    /// 2026-11-06): uma por masmorra na metade da vida (os lobos da Floresta, o escuro da Caverna, o escudo elemental
    /// da Torre) e uma ou duas sorteadas (invocar, barreira, golpe carregado, cura, fúria). A regra de quando cada uma
    /// entra é do <see cref="ChefeFinal.FerirMonstro"/>.
    /// </summary>
    public static class MecanicasDoChefe
    {
        private static MecanicasDoChefeData D => GameData.MecanicasDoChefeTable;

        public static double BarreiraDoChefe => D.BarreiraDoChefe;
        public static double AjudantesDoChefe => D.AjudantesDoChefe;
        public static double CargaACada => D.CargaACada;
        public static double LimiteDoDesespero => D.LimiteDoDesespero;
        public static double CuraDoChefe => D.CuraDoChefe;
        public static double ForcaNaFuria => D.ForcaNaFuria;
        public static double VelocidadeNaFuriaDoChefe => D.VelocidadeNaFuriaDoChefe;
        public static double PassaPeloEscudo => D.PassaPeloEscudo;

        /// <summary>
        /// TS: sortearMecanicas — uma ou duas (um número), e cada uma da lista (mais um ou dois). Na Floresta o invocar
        /// sai da lista.
        /// </summary>
        public static List<string> SortearMecanicas(string masmorra, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            int quantas = rng() < 0.5 ? 1 : 2;
            var lista = new List<string>();
            foreach (var m in D.Mecanicas)
                if (!(masmorra == "floresta" && m == "invocar")) lista.Add(m);
            var escolhidas = new List<string>();
            for (int i = 0; i < quantas; i++)
            {
                var sobra = lista.FindAll(x => !escolhidas.Contains(x));
                escolhidas.Add(Rng.Pick(sobra, rng));
            }
            return escolhidas;
        }

        /// <summary>TS: escudoDoChefe — físico e mágico se revezam a cada dois golpes dele; null sem escudo.</summary>
        public static string EscudoDoChefe(MonsterInstance monstro)
        {
            if (monstro?.EscudoElemental != true) return null;
            double golpes = (monstro as CombatMonster)?.AttackCount ?? 0;
            return Math.Floor(golpes / D.EscudoTrocaACada) % 2 == 0 ? "fisico" : "magico";
        }

        /// <summary>TS: marcasDoChefe — o que a placa do chefe mostra das mecânicas dele que estão valendo.</summary>
        public static List<string> MarcasDoChefe(MonsterInstance monstro)
        {
            var marcas = new List<string>();
            var escudo = EscudoDoChefe(monstro);
            if (escudo != null) marcas.Add(escudo == "fisico" ? "🟥 escudo contra golpes" : "🟦 escudo contra magia");
            if (Js.Truthy(monstro.Barreira)) marcas.Add("🛡️ barreira " + Js.NumberToString(monstro.Barreira.Value));
            if (monstro.Escuro == true) marcas.Add("🌑 escuridão: a mira some");
            if (monstro.Furia == true && monstro.ChefeFinal != true) marcas.Add("😡 fúria");
            return marcas;
        }
    }
}
