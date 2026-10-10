using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: MasteryProgress.</summary>
    public sealed class MasteryProgress
    {
        public double Level;
        /// <summary>Vitórias desde que o nível atual chegou. 0 no teto.</summary>
        public double IntoLevel;
        /// <summary>Quantas o próximo nível pede, contando do atual. 0 no teto.</summary>
        public double ToNext;
        public bool Maxed;
        /// <summary>Bônus do nível, em fração (0,06 = +6%). Só vale com a arma da classe.</summary>
        public double Bonus;
    }

    /// <summary>TS: BattleWonResult.</summary>
    public sealed class BattleWonResult
    {
        public Hero Hero;
        public bool LeveledUp;
        /// <summary>Nível de maestria depois da vitória.</summary>
        public double Level;
    }

    /// <summary>
    /// Maestria de classe (port de shared/src/hero/mastery.ts): 1 por sala vencida, 10 níveis
    /// (10, 30, 60… 550 vitórias), +2% de dano por nível só com a arma que a classe domina.
    /// </summary>
    public static class Mastery
    {
        private static MasteryData D => GameData.MasteryTable;

        /// <summary>TS: MASTERY_MAX_LEVEL.</summary>
        public static double MaxLevel => D.MasteryMaxLevel;

        /// <summary>TS: MASTERY_DAMAGE_PER_LEVEL — +2% de dano por nível.</summary>
        public static double DamagePerLevel => D.MasteryDamagePerLevel;

        /// <summary>TS: masteryBattlesFor — vitórias para chegar ao nível: 5·n·(n+1), n em [0, MASTERY_MAX_LEVEL].</summary>
        public static double BattlesFor(double level)
        {
            double n = Js.Min(MaxLevel, Contagem(level));
            return 5 * n * (n + 1);
        }

        /// <summary>TS: masteryLevel — o nível que a contagem de vitórias dá.</summary>
        public static double Level(double battles)
        {
            double total = Contagem(battles);
            double level = 0;
            while (level < MaxLevel && total >= BattlesFor(level + 1)) level++;
            return level;
        }

        /// <summary>TS: masteryProgress — nível, andamento no nível e bônus. Sem contagem no save = 0.</summary>
        public static MasteryProgress Progress(Hero hero)
        {
            double battles = Contagem(hero.MasteryBattles);
            double level = Level(battles);
            bool maxed = level >= MaxLevel;
            double start = BattlesFor(level);
            return new MasteryProgress
            {
                Level = level,
                IntoLevel = maxed ? 0 : battles - start,
                ToNext = maxed ? 0 : BattlesFor(level + 1) - start,
                Maxed = maxed,
                Bonus = level * DamagePerLevel,
            };
        }

        /// <summary>TS: masteryWeapons — ids das armas que a classe domina (afinidade 100), na ordem da tabela.</summary>
        public static List<string> Weapons(ClassDef cls)
        {
            var ids = new List<string>();
            foreach (var kv in cls.Affinity)
                if (kv.Value == 100) ids.Add(kv.Key);
            return ids;
        }

        /// <summary>
        /// TS: wieldsMasteryWeapon — arma que a classe domina na mão principal? Olha o número da tabela,
        /// não weaponAffinityPct (que dá 100 para mão vazia e para arma fora da tabela).
        /// </summary>
        public static bool WieldsMasteryWeapon(Hero hero)
        {
            var cls = Catalog.ClassById(Catalog.IdDaClasse(hero.ClassId, hero.ClassName) ?? "");
            var arma = hero.Equip.Get("arma");
            return cls != null && arma != null && cls.Affinity.TryGet(arma.TemplateId, out var pct) && pct == 100;
        }

        /// <summary>TS: masteryDamageMult — multiplicador do golpe e dos poderes; 1 sem a arma da classe.</summary>
        public static double DamageMult(Hero hero) => WieldsMasteryWeapon(hero) ? 1 + Progress(hero).Bonus : 1;

        /// <summary>
        /// TS: winBattle — uma sala vencida. Sem classe não conta (devolve o mesmo herói); com classe,
        /// devolve cópia com masteryBattles + 1 (a contagem saneada).
        /// </summary>
        public static BattleWonResult WinBattle(Hero hero)
        {
            double before = Contagem(hero.MasteryBattles);
            double levelBefore = Level(before);
            if (Catalog.IdDaClasse(hero.ClassId, hero.ClassName) == null)
                return new BattleWonResult { Hero = hero, LeveledUp = false, Level = levelBefore };

            double level = Level(before + 1);
            var next = hero.Clone();
            next.MasteryBattles = before + 1;
            return new BattleWonResult { Hero = next, LeveledUp = level > levelBefore, Level = level };
        }

        /// <summary>
        /// TS: veteranMasteryBattles — as vitórias de quem jogou antes da maestria: monstros × 5 ÷ 8, em
        /// inteiros (÷ 1,6 em ponto flutuante perderia uma vitória no arredondamento).
        /// </summary>
        public static double VeteranBattles(double killCount) => Math.Floor((Contagem(killCount) * 5) / 8);

        /// <summary>TS: contagem — inteiro, finito e positivo, ou zero (ausente também é zero).</summary>
        private static double Contagem(double? valor) =>
            valor.HasValue && Js.IsFinite(valor.Value) && valor.Value > 0 ? Math.Floor(valor.Value) : 0;
    }
}
