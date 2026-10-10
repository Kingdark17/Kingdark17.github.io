using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: RemoveByUidResult — a mochila sem o item e o item tirado (null quando o uid não estava lá).</summary>
    public sealed class RemoveByUidResult
    {
        public List<Item> Inventory;
        /// <summary>O próprio objeto que estava na mochila; null de propósito quando o uid não foi achado.</summary>
        [KeepNull] public Item Removed;
    }

    /// <summary>
    /// TS: ConsumeItemOutcome. No TS é uma união pelo <c>kind</c>; aqui é uma classe só, e cada kind preenche
    /// só os seus campos (os outros ficam ausentes): "no_effect" → nada; "used" → HpGained e MpGained.
    /// </summary>
    public sealed class ConsumeItemOutcome
    {
        public const string KindNoEffect = "no_effect";
        public const string KindUsed = "used";

        public string Kind;
        /// <summary>kind "used": vida recuperada (já limitada pelo máximo).</summary>
        public double? HpGained;
        /// <summary>kind "used": mana recuperada (já limitada pelo máximo).</summary>
        public double? MpGained;

        public static ConsumeItemOutcome NoEffect() => new ConsumeItemOutcome { Kind = KindNoEffect };

        public static ConsumeItemOutcome Used(double hpGained, double mpGained) =>
            new ConsumeItemOutcome { Kind = KindUsed, HpGained = hpGained, MpGained = mpGained };
    }

    /// <summary>TS: ConsumeItemResult.</summary>
    public sealed class ConsumeItemResult
    {
        public Hero Hero;
        public List<Item> Inventory;
        public ConsumeItemOutcome Outcome;
    }

    /// <summary>
    /// A mochila do jogador (port de shared/src/inventory/inventory.ts): as três operações puras de coleção
    /// (<see cref="AddItem"/>, <see cref="RemoveByUid"/>, <see cref="FindByUid"/>) e o uso de consumível
    /// (<see cref="ConsumeItem"/>).
    ///
    /// A mochila (TS: <c>Inventory = Item[]</c>) é uma <c>List&lt;Item&gt;</c>. Como no TS, nada aqui muta a
    /// lista recebida: devolve uma lista nova, com os mesmos objetos de item.
    ///
    /// Item null dentro da lista (o null de um save estragado) lança o mesmo TypeError do JS quando a busca
    /// chega nele (<c>it.uid</c> de null).
    /// </summary>
    public static class Inventory
    {
        /// <summary>TS: addItem — <c>[...inventory, item]</c>: o item vai para o fim de uma lista nova.</summary>
        public static List<Item> AddItem(IReadOnlyList<Item> inventory, Item item)
        {
            var next = new List<Item>(inventory.Count + 1);
            foreach (var it in inventory) next.Add(it);
            next.Add(item);
            return next;
        }

        /// <summary>
        /// TS: removeByUid — tira só o primeiro item com esse uid (uid repetido: os outros ficam). Sem o uid,
        /// devolve uma cópia da lista e <c>removed: null</c>. O item tirado é o próprio objeto da lista.
        /// </summary>
        public static RemoveByUidResult RemoveByUid(IReadOnlyList<Item> inventory, string uid)
        {
            int idx = FindIndexByUid(inventory, uid);
            if (idx < 0) return new RemoveByUidResult { Inventory = Copy(inventory), Removed = null };

            var next = new List<Item>(inventory.Count - 1);
            for (int i = 0; i < inventory.Count; i++)
                if (i != idx) next.Add(inventory[i]);
            return new RemoveByUidResult { Inventory = next, Removed = inventory[idx] };
        }

        /// <summary>TS: findByUid — o primeiro item com esse uid (o próprio objeto da lista), ou null.</summary>
        public static Item FindByUid(IReadOnlyList<Item> inventory, string uid)
        {
            int idx = FindIndexByUid(inventory, uid);
            return idx < 0 ? null : inventory[idx];
        }

        /// <summary>
        /// TS: consumeItem — bebe/usa um consumível: devolve vida (<c>cura</c>) e mana (<c>curaMana</c>) até o
        /// máximo e tira o item da mochila (pelo uid, mesmo que o objeto não seja o da lista; item fora da
        /// mochila cura do mesmo jeito). Item sem <c>cura</c> nem <c>curaMana</c> não é gasto: devolve o mesmo
        /// herói, uma cópia da mochila e <c>no_effect</c>. Com herói cheio, o item é gasto e os ganhos são 0.
        /// Não recalcula os derivados: cura mexe em hp/mp, não em atributo.
        /// </summary>
        public static ConsumeItemResult ConsumeItem(Hero hero, IReadOnlyList<Item> inventory, Item item)
        {
            // item.stats.cura do JS: sem stats, o JS lança ao ler a primeira chave.
            var stats = item.Stats ?? throw ReadOfUndefined("cura");

            double hpGained = stats.Truthy("cura") ? Js.Min(hero.MaxHp, hero.Hp + stats.OrZero("cura")) - hero.Hp : 0;
            double mpGained = stats.Truthy("curaMana") ? Js.Min(hero.MaxMp, hero.Mp + stats.OrZero("curaMana")) - hero.Mp : 0;

            if (!stats.Truthy("cura") && !stats.Truthy("curaMana"))
                return new ConsumeItemResult { Hero = hero, Inventory = Copy(inventory), Outcome = ConsumeItemOutcome.NoEffect() };

            var next = hero.Clone();
            next.Hp = hero.Hp + hpGained;
            next.Mp = hero.Mp + mpGained;
            return new ConsumeItemResult
            {
                Hero = next,
                Inventory = RemoveByUid(inventory, item.Uid).Inventory,
                Outcome = ConsumeItemOutcome.Used(hpGained, mpGained),
            };
        }

        // ---------- apoio ----------

        /// <summary>O <c>findIndex((it) =&gt; it.uid === uid)</c> do TS: para no primeiro; item null lança como no JS.</summary>
        private static int FindIndexByUid(IReadOnlyList<Item> inventory, string uid)
        {
            for (int i = 0; i < inventory.Count; i++)
                if (UidOf(inventory[i]) == uid) return i;
            return -1;
        }

        /// <summary><c>it.uid</c> do JS: de um item null, lança o TypeError do JS.</summary>
        internal static string UidOf(Item it) =>
            it != null ? it.Uid : throw new EngineError("Cannot read properties of null (reading 'uid')", "TypeError");

        /// <summary>O <c>[...inventory]</c> do TS.</summary>
        internal static List<Item> Copy(IReadOnlyList<Item> inventory)
        {
            var copy = new List<Item>(inventory.Count);
            foreach (var it in inventory) copy.Add(it);
            return copy;
        }

        private static EngineError ReadOfUndefined(string property) =>
            new EngineError("Cannot read properties of undefined (reading '" + property + "')", "TypeError");
    }
}
