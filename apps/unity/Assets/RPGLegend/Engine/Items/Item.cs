namespace RPGLegend.Engine
{
    /// <summary>
    /// TS: Item — instância no inventário. Guarda só o que não sai do template: identidade, raridade,
    /// stats rolados e o que a reforja mudou. Nome, sprite e proc saem do template na hora de mostrar.
    /// </summary>
    public partial class Item
    {
        public string Uid;
        public string TemplateId;
        public string Rarity;
        public double Value;
        public bool Equipped;
        /// <summary>Só presente quando o template tem proc; a reforja altera este número.</summary>
        public double? ProcChance;
        /// <summary>Andar em que caiu, quando houve bônus de profundidade.</summary>
        public double? FoundFloor;
        public double? TierAdjustment;
        public double? ReforgeCount;
        /// <summary>Tentativas seguidas de reforja sem melhorar o tier (o "pity" da forja).</summary>
        public double? ReforgeFails;

        /// <summary>Campos do save que o C# não conhece; voltam intactos ao salvar.</summary>
        [JsExtra] public JsExtras Extra;

        /// <summary>O <c>{ ...item, stats: { ...item.stats } }</c> do TS.</summary>
        public Item Clone()
        {
            var c = (Item)MemberwiseClone();
            c.Stats = Stats?.Clone();
            c.Extra = Extra?.Clone();
            return c;
        }

        /// <summary>Copia os campos de item (raso, como o spread do JS) para outro objeto.</summary>
        internal void CopyItemFieldsTo(Item target)
        {
            target.Uid = Uid;
            target.TemplateId = TemplateId;
            target.Rarity = Rarity;
            target.Stats = Stats;
            target.Value = Value;
            target.Equipped = Equipped;
            target.ProcChance = ProcChance;
            target.FoundFloor = FoundFloor;
            target.TierAdjustment = TierAdjustment;
            target.ReforgeCount = ReforgeCount;
            target.ReforgeFails = ReforgeFails;
            target.Extra = Extra;
        }
    }

    /// <summary>TS: ItemView — o item com o que se deriva do template, montado na hora de desenhar.</summary>
    public sealed class ItemView : Item
    {
        public ItemTemplate Template;
        public string Name;
        public string Desc;
        public string Sprite;
        public string Category;
        /// <summary>A raridade no gênero e número do item ("Mítica").</summary>
        public string RarityLabel;
        public string RarityColorVar;
        /// <summary>O proc do template com a chance do item, ou null quando não há.</summary>
        [KeepNull] public ProcTemplate Proc;

        public static ItemView From(Item item)
        {
            var view = new ItemView();
            item.CopyItemFieldsTo(view);
            return view;
        }
    }

    /// <summary>TS: StatTag.</summary>
    public sealed class StatTag
    {
        public string Text;
        public bool Positive;
    }

    /// <summary>TS: TierInfo.</summary>
    public sealed class TierInfo
    {
        public double Score;
        public string Tier;
        public double Rank;
        public double Min;
        [KeepNull] public double? Next;
        /// <summary>Progresso até o próximo tier, 0–100. MAX devolve 100.</summary>
        public double Progress;
    }

    /// <summary>TS: ReforgeResult.</summary>
    public sealed class ReforgeResult
    {
        public string OldTier;
        public string NewTier;
        public double OldRank;
        public double NewRank;
        public bool Changed;
    }

    /// <summary>O retorno de reforge no TS: <c>{ item, result }</c>.</summary>
    public sealed class ReforgeOutcome
    {
        public Item Item;
        public ReforgeResult Result;
    }
}
