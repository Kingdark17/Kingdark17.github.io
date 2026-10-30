using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: ProcTemplate — efeito de arma (queimadura, atordoar…).</summary>
    public sealed class ProcTemplate
    {
        public double Chance;
        public string Effect;
        public string Label;
        public string Icon;

        public ProcTemplate Clone() => (ProcTemplate)MemberwiseClone();
    }

    /// <summary>TS: ItemTemplate.</summary>
    public sealed class ItemTemplate
    {
        public string Id;
        public string Name;
        /// <summary>"m" ou "f": é com ele que a raridade concorda ("Espada Lendária").</summary>
        public string Genero;
        /// <summary>true quando o nome está no plural ("Botas Reforçadas"); ausente nos outros.</summary>
        public bool? Plural;
        public string Category;
        public string Desc;
        public string Sprite;
        /// <summary>Slot onde veste quando não é o da categoria (escudo → secundaria; elmo, calca, botas).</summary>
        public string Slot;
        public ItemStats Base;
        public double Value;
        public ProcTemplate Proc;
        /// <summary>A escada de material ("metal", "madeira", "couro", "tecido"); só armas e armaduras têm.</summary>
        public string Escada;
        /// <summary>O nome sem o material de hoje, quando ele está no nome ("Escudo" do "Escudo de Carvalho").</summary>
        public string NomeSemMaterial;
        /// <summary>Numa runa, o tipo dela ("eletrica", "fogo", "gelo", "vampirica").</summary>
        public string Runa;
        /// <summary>
        /// O acessório único de uma masmorra (<see cref="AcessoriosUnicos"/>): o efeito e o valor de cada versão. Fora dos
        /// sorteios de loja, baú e loot.
        /// </summary>
        public EfeitoDoUnico Unico;
    }

    /// <summary>TS: EfeitoDoUnico — "regeneracao", "roubo_de_vida" ou "desconto_de_mana", e uma fração por versão.</summary>
    public sealed class EfeitoDoUnico
    {
        public string Efeito;
        public List<double> Valores = new List<double>();
    }

    /// <summary>As tabelas de items/templates.ts (fixtures/data/items/templates.json).</summary>
    public sealed class ItemTemplatesData
    {
        [JsName("ITEM_CATEGORIES")] public List<string> ItemCategories = new List<string>();
        [JsName("CATEGORY_LABELS")] public OrderedMap<string> CategoryLabels = new OrderedMap<string>();
        [JsName("EQUIPPABLE_CATEGORIES")] public List<string> EquippableCategories = new List<string>();
        [JsName("CONSUMABLE_STAT_KEYS")] public List<string> ConsumableStatKeys = new List<string>();
        [JsName("STAT_LABELS")] public OrderedMap<string> StatLabels = new OrderedMap<string>();
        [JsName("PROC_EFFECTS")] public List<string> ProcEffects = new List<string>();
        [JsName("BURN")] public ProcTemplate Burn;
        [JsName("STUN")] public ProcTemplate Stun;
        [JsName("TEMPLATES")] public List<ItemTemplate> Templates = new List<ItemTemplate>();
        /// <summary>O tier de uma runa no nome dela: I, II, III.</summary>
        [JsName("ROMANOS")] public List<string> Romanos = new List<string>();
    }

    /// <summary>TS: Rarity.</summary>
    public sealed class RarityDef
    {
        public string Id;
        /// <summary>O nome do tier, sozinho: "Lendário".</summary>
        public string Label;
        /// <summary>As quatro formas que concordam com o item: m, f, m plural, f plural.</summary>
        public List<string> Adjetivo = new List<string>();
        public string ColorVar;
        public double Mult;
        public double Weight;
    }

    /// <summary>As tabelas de items/rarity.ts.</summary>
    public sealed class RarityData
    {
        [JsName("RARITY_IDS")] public List<string> RarityIds = new List<string>();
        [JsName("RARITIES")] public List<RarityDef> Rarities = new List<RarityDef>();
    }

    /// <summary>As tabelas de items/tiers.ts (inclusive as privadas).</summary>
    public sealed class TierData
    {
        [JsName("TIER_ORDER")] public List<string> TierOrder = new List<string>();
        [JsName("TIER_MIN")] public List<double> TierMin = new List<double>();
        [JsName("RARITY_BASE")] public List<double> RarityBase = new List<double>();
        [JsName("STAT_WEIGHTS")] public OrderedMap<double> StatWeights = new OrderedMap<double>();
        [JsName("DEFAULT_WEIGHT")] public double DefaultWeight;
    }
}
