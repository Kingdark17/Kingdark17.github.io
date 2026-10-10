using System;

namespace RPGLegend.Engine
{
    /// <summary>
    /// Fórmulas derivadas do herói (port de shared/src/hero/derived.ts).
    /// O save pode vir editado: texto vira número na leitura, e NaN/ausente são saneados aqui como no TS.
    /// </summary>
    public static class Derived
    {
        /// <summary>TS: CRIT_PENALTY.</summary>
        public const double CritPenalty = 8;

        /// <summary>TS: equipmentCap — teto que o servidor aplica à vida/mana vinda de equipamento.</summary>
        public static double EquipmentCap(double level) => 500 + ToInt(level, 1, 500) * 50;

        /// <summary>TS: equipmentStat. Com cap, cada item fica em [0, cap] e o total também para no cap.</summary>
        public static double EquipmentStat(Equipment equip, string key, double? cap = null)
        {
            double total = 0;
            foreach (var slot in StatKeys.EquipSlots)
            {
                if (equip == null || !equip.TryGet(slot, out var item) || item == null || item.Stats == null) continue;
                double raw = item.Stats.ToNumber(key);
                total += cap == null ? Finite(raw) : ToInt(raw, 0, cap.Value);
            }
            return cap == null ? total : Js.Min(total, cap.Value);
        }

        /// <summary>TS: equipmentBonus — todos os stats de ITEM_STAT_KEYS, sem teto.</summary>
        public static OrderedMap<double> EquipmentBonus(Equipment equip)
        {
            var sum = new OrderedMap<double>();
            foreach (var key in StatKeys.ItemStats) sum.Set(key, EquipmentStat(equip, key));
            return sum;
        }

        /// <summary>TS: xpForLevel — XP para sair do nível informado.</summary>
        public static double XpForLevel(double level) => 40 + (ToInt(level, 1, 500) - 1) * 35;

        /// <summary>TS: attrModifier — piso, não truncamento (7 → -2).</summary>
        public static double AttrModifier(double value) => Math.Floor((Finite(value) - 10) / 2);

        /// <summary>TS: totalAttributePoints.</summary>
        public static double TotalAttributePoints(Attributes attrs)
        {
            double total = 0;
            foreach (var key in StatKeys.Attrs) total += Finite(attrs[key]);
            return total;
        }

        /// <summary>TS: derivedStats. Sempre do zero; critPenalty = debuff de crítico ativo.</summary>
        public static DerivedStats Compute(IHeroCore hero, bool critPenalty = false)
        {
            var a = hero.Attrs;
            double cap = EquipmentCap(hero.Level);
            var eq = EquipmentBonus(hero.Equip);
            return new DerivedStats
            {
                MaxHp = 20 + hero.Level * 5 + a.Constituicao * 10 + EquipmentStat(hero.Equip, "vida", cap),
                MaxMp = 10 + hero.Level * 2 + a.Intelecto * 5 + EquipmentStat(hero.Equip, "mana", cap),
                DmgFisico = a.Forca * 2,
                DmgMagico = a.Intelecto * 3,
                Esquiva = Js.Max(0.0, a.Destreza * 0.5 + eq["esquiva"]),
                Critico = Js.Max(0.0, 5 + a.Destreza * 0.5 - (critPenalty ? CritPenalty : 0)),
                Velocidade = a.Destreza + eq["velocidade"],
                CuraBonus = a.Sabedoria,
                ResistMagica = a.Sabedoria,
                DescontoLoja = a.Carisma * 0.5,
            };
        }

        // ---------- finite/toInt do TS ----------

        public static double Finite(double value) => Js.IsFinite(value) ? value : 0;

        public static double ToInt(double value, double min, double max) =>
            !Js.IsFinite(value) ? min : Math.Floor(Js.Max(min, Js.Min(max, value)));
    }
}
