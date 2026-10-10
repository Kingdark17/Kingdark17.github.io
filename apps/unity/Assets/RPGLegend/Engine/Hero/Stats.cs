using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>Listas de chaves do herói (port de shared/src/hero/stats.ts).</summary>
    public static class StatKeys
    {
        /// <summary>TS: ATTR_KEYS.</summary>
        public static readonly IReadOnlyList<string> Attrs = new[] { "forca", "destreza", "constituicao", "intelecto", "sabedoria", "carisma" };

        /// <summary>TS: EQUIP_SLOTS — da cabeça aos pés, na ordem em que a mochila desenha.</summary>
        public static readonly IReadOnlyList<string> EquipSlots = new[] { "arma", "secundaria", "elmo", "armadura", "calca", "botas", "acessorio" };

        /// <summary>TS: ITEM_STAT_KEYS.</summary>
        public static readonly IReadOnlyList<string> ItemStats = new[] { "ataque", "defesa", "vida", "mana", "critico", "velocidade", "esquiva" };
    }

    /// <summary>
    /// TS: Attributes. Atributo ausente no save chega como NaN — é o que o undefined vira numa conta do JS.
    /// </summary>
    public sealed class Attributes
    {
        public double Forca;
        public double Destreza;
        public double Constituicao;
        public double Intelecto;
        public double Sabedoria;
        public double Carisma;

        public double this[string key]
        {
            get
            {
                switch (key)
                {
                    case "forca": return Forca;
                    case "destreza": return Destreza;
                    case "constituicao": return Constituicao;
                    case "intelecto": return Intelecto;
                    case "sabedoria": return Sabedoria;
                    case "carisma": return Carisma;
                    default: throw new KeyNotFoundException("atributo desconhecido: " + key);
                }
            }
            set
            {
                switch (key)
                {
                    case "forca": Forca = value; break;
                    case "destreza": Destreza = value; break;
                    case "constituicao": Constituicao = value; break;
                    case "intelecto": Intelecto = value; break;
                    case "sabedoria": Sabedoria = value; break;
                    case "carisma": Carisma = value; break;
                    default: throw new KeyNotFoundException("atributo desconhecido: " + key);
                }
            }
        }

        public static bool IsKey(string key) => key == "forca" || key == "destreza" || key == "constituicao" || key == "intelecto" || key == "sabedoria" || key == "carisma";

        /// <summary>TS: emptyAttributes.</summary>
        public static Attributes Empty() => new Attributes();

        public Attributes Clone() => (Attributes)MemberwiseClone();
    }

    /// <summary>
    /// TS: ItemStats / StatBlock. Chave ausente = undefined; valor null = null. Aceita chaves fora de
    /// ITEM_STAT_KEYS (cura, curaMana…), como o objeto do JS.
    /// </summary>
    public sealed class ItemStats : OrderedMap<double?>
    {
        /// <summary>Number(stats[key]) do JS: ausente → NaN, null → 0.</summary>
        public double ToNumber(string key) => TryGet(key, out var v) ? (v ?? 0.0) : double.NaN;

        /// <summary>stats[key] ?? 0 do JS: ausente ou null → 0 (NaN continua NaN).</summary>
        public double OrZero(string key) => TryGet(key, out var v) && v.HasValue ? v.Value : 0.0;

        /// <summary>Verdade de stats[key] no JS (ausente, null, 0 e NaN são falsos).</summary>
        public bool Truthy(string key) => TryGet(key, out var v) && v.HasValue && Js.Truthy(v.Value);

        /// <summary>O <c>{ ...stats }</c> do JS.</summary>
        public ItemStats Clone()
        {
            var c = new ItemStats();
            CopyTo(c);
            return c;
        }
    }

    /// <summary>
    /// TS: Item. O campo de stats mora aqui porque é o que hero/derived usa; o resto dos campos está em Items/Item.cs.
    /// </summary>
    public partial class Item
    {
        /// <summary>null quando o item não tem stats (o JS pula esse item).</summary>
        public ItemStats Stats;
    }

    /// <summary>TS: Equipment — slot ausente = undefined; slot com null = vazio de propósito.</summary>
    public sealed class Equipment : OrderedMap<Item>
    {
        /// <summary>O <c>{ ...equip }</c> do JS (os itens são os mesmos objetos).</summary>
        public Equipment Clone()
        {
            var c = new Equipment();
            CopyTo(c);
            return c;
        }
    }

    /// <summary>TS: HeroCore — o que os atributos derivados precisam saber do herói.</summary>
    public interface IHeroCore
    {
        double Level { get; }
        Attributes Attrs { get; }
        Equipment Equip { get; }
    }

    public sealed class HeroCore : IHeroCore
    {
        public double Level { get; set; }
        public Attributes Attrs { get; set; } = new Attributes();
        public Equipment Equip { get; set; } = new Equipment();
    }

    /// <summary>TS: DerivedStats.</summary>
    public sealed class DerivedStats
    {
        public double MaxHp;
        public double MaxMp;
        public double DmgFisico;
        public double DmgMagico;
        public double Esquiva;
        public double Critico;
        public double Velocidade;
        public double CuraBonus;
        public double ResistMagica;
        public double DescontoLoja;

        public DerivedStats Clone() => (DerivedStats)MemberwiseClone();
    }
}
