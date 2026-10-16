using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: MaestriaNoCartao — o medidor da maestria no cartão de guilda.</summary>
    public sealed class MaestriaNoCartao
    {
        public double Nivel;
        /// <summary>Vitórias no nível atual e quantas o próximo pede. No teto, 1 de 1 pra barra sair cheia.</summary>
        public double Atual;
        public double Maximo;
        /// <summary>"12/30", ou "máx." no teto.</summary>
        public string Contagem;
        /// <summary>A linha embaixo da barra: o bônus e de que arma ele depende.</summary>
        public string Bonus;
    }

    /// <summary>Port de shared/src/jogo/maestria.ts: o texto da maestria. A regra mora em <see cref="Mastery"/>.</summary>
    public static class Maestria
    {
        /// <summary>
        /// TS: armasDaMaestria — as armas da classe pelo nome curto, em minúscula ("espada", "adaga ou violão").
        /// Vazio pro Aprendiz.
        /// </summary>
        public static string ArmasDaMaestria(string classId, string className)
        {
            var classe = Catalog.ClassById(Catalog.IdDaClasse(classId, className) ?? "");
            if (classe == null) return "";
            var nomes = new List<string>();
            foreach (var id in Mastery.Weapons(classe)) nomes.Add((ItemTemplates.ById(id)?.Name ?? id).Split(' ')[0].ToLowerInvariant());
            return string.Join(" ou ", nomes);
        }

        public static string ArmasDaMaestria(Hero hero) => ArmasDaMaestria(hero.ClassId, hero.ClassName);

        private static string Porcento(double fracao) => "+" + Js.NumberToString(Js.Round(fracao * 100)) + "%";

        /// <summary>TS: maestriaNoCartao — null pro Aprendiz: a maestria é da classe.</summary>
        public static MaestriaNoCartao MaestriaNoCartao(Hero hero)
        {
            var armas = ArmasDaMaestria(hero);
            if (armas.Length == 0) return null;

            var progresso = Mastery.Progress(hero);
            double atual = progresso.Maxed ? 1 : progresso.IntoLevel;
            double maximo = progresso.Maxed ? 1 : progresso.ToNext;

            string bonus;
            if (progresso.Level == 0) bonus = Porcento(Mastery.DamagePerLevel) + " de dano por nível, com " + armas;
            else if (Mastery.WieldsMasteryWeapon(hero)) bonus = Porcento(progresso.Bonus) + " de dano com " + armas;
            else bonus = Porcento(progresso.Bonus) + " de dano só com " + armas;

            return new MaestriaNoCartao
            {
                Nivel = progresso.Level,
                Atual = atual,
                Maximo = maximo,
                Contagem = progresso.Maxed ? "máx." : Js.NumberToString(atual) + "/" + Js.NumberToString(maximo),
                Bonus = bonus,
            };
        }

        /// <summary>TS: maestriaSubiu — a linha do diário quando a maestria sobe.</summary>
        public static string MaestriaSubiu(Hero hero, double nivel) =>
            "Sua maestria de " + Js.Str(hero.ClassName) + " chegou ao nível " + Js.NumberToString(nivel) + ": " +
            Porcento(nivel * Mastery.DamagePerLevel) + " de dano com " + ArmasDaMaestria(hero) + ".";
    }
}
