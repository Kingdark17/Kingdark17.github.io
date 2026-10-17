using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>Port de shared/src/items/rarity.ts.</summary>
    public static class Rarities
    {
        /// <summary>TS: RARITY_IDS.</summary>
        public static List<string> Ids => GameData.RarityTable.RarityIds;

        /// <summary>TS: RARITIES.</summary>
        public static List<RarityDef> All => GameData.RarityTable.Rarities;

        /// <summary>TS: rarityById.</summary>
        public static RarityDef ById(string id)
        {
            foreach (var r in All) if (r.Id == id) return r;
            return null;
        }

        /// <summary>
        /// TS: rarityWeights — comum/incomum não mudam com a profundidade; o bônus de andar fundo é dividido
        /// proporcionalmente entre as raras.
        /// </summary>
        public static List<double> Weights(double floor)
        {
            var all = All;
            double depth = Js.Min(1, (Js.Max(1, floor) - 1) / 12);
            double rareWeightSum = 0;
            for (int i = 2; i < all.Count; i++) rareWeightSum = rareWeightSum + all[i].Weight;
            double bonus = depth * 12;

            var weights = new List<double>(all.Count);
            for (int index = 0; index < all.Count; index++)
            {
                var r = all[index];
                if (index < 2)
                {
                    weights.Add(r.Weight);
                    continue;
                }
                double scaled = r.Weight * (0.12 + 0.88 * depth);
                weights.Add(scaled + bonus * (r.Weight / rareWeightSum));
            }
            return weights;
        }

        /// <summary>TS: pickRarity — um sorteio.</summary>
        public static RarityDef Pick(double floor = 1, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            var all = All;
            var weights = Weights(floor);
            double total = 0;
            foreach (var w in weights) total = total + w;
            double roll = rng() * total;
            for (int i = 0; i < all.Count; i++)
            {
                roll -= weights[i];
                if (roll < 0) return all[i];
            }
            return all[all.Count - 1];
        }
    }

    /// <summary>Port de shared/src/items/templates.ts.</summary>
    public static class ItemTemplates
    {
        /// <summary>TS: TEMPLATES.</summary>
        public static List<ItemTemplate> All => GameData.ItemTable.Templates;

        /// <summary>TS: templateById.</summary>
        public static ItemTemplate ById(string id)
        {
            foreach (var t in All) if (t.Id == id) return t;
            return null;
        }

        /// <summary>TS: templatesByCategory.</summary>
        public static List<ItemTemplate> ByCategory(string category)
        {
            var list = new List<ItemTemplate>();
            foreach (var t in All) if (t.Category == category) list.Add(t);
            return list;
        }

        /// <summary>TS: isEquippable — arma, armadura e acessório.</summary>
        public static bool IsEquippable(string category) =>
            category != null && GameData.ItemTable.EquippableCategories.Contains(category);

        /// <summary>TS: slotForTemplate — a categoria, salvo quando o template diz outro slot.</summary>
        public static string SlotFor(ItemTemplate template) => template.Slot ?? template.Category;
    }

    /// <summary>Port de shared/src/items/item.ts.</summary>
    public static class Items
    {
        /// <summary>TS: itemTemplate — lança se o template sumiu do catálogo.</summary>
        public static ItemTemplate TemplateOf(Item item)
        {
            var template = ItemTemplates.ById(item.TemplateId);
            if (template == null) throw new EngineError("Template desconhecido: " + Js.Str(item.TemplateId));
            return template;
        }

        /// <summary>TS: concordar — das quatro formas (m, f, mp, fp), a que concorda com o nome do item.</summary>
        public static string Concordar(Item item, IReadOnlyList<string> formas)
        {
            var template = TemplateOf(item);
            bool plural = template.Plural == true;
            if (template.Genero == "f") return plural ? At(formas, 3) : At(formas, 1);
            return plural ? At(formas, 2) : At(formas, 0);
        }

        /// <summary>
        /// TS: displayName — o nome com o material e a raridade depois: "Espada Lendária", "Espada de Aço Rara",
        /// "Botas Reforçadas Raras"; comum não ganha nada.
        /// </summary>
        public static string DisplayName(Item item)
        {
            var template = TemplateOf(item);
            string nome = Materiais.NomeComMaterial(template, item.Degrau);
            var rarity = Rarities.ById(item.Rarity);
            if (rarity == null || rarity.Id == "comum") return nome;
            return nome + " " + Concordar(item, rarity.Adjetivo);
        }

        /// <summary>TS: itemView.</summary>
        public static ItemView View(Item item)
        {
            var template = TemplateOf(item);
            var rarity = Rarities.ById(item.Rarity) ?? Rarities.ById("comum");
            var view = ItemView.From(item);
            view.Template = template;
            view.Name = DisplayName(item);
            view.Desc = template.Desc;
            view.Sprite = template.Sprite;
            view.Category = template.Category;
            view.RarityLabel = Concordar(item, rarity.Adjetivo);
            view.RarityColorVar = rarity.ColorVar;
            if (template.Proc != null && item.ProcChance != null)
            {
                var proc = template.Proc.Clone();
                proc.Chance = item.ProcChance.Value;
                view.Proc = proc;
            }
            else
            {
                view.Proc = null;
            }
            return view;
        }

        /// <summary>TS: itemCategory.</summary>
        public static string CategoryOf(Item item) => TemplateOf(item).Category;

        /// <summary>
        /// TS: instantiate. O uid é "templateId_agora_sorteio" e tira um número do rng. <paramref name="degrau"/> é o do
        /// material (1 a 3, só em peça com escada): multiplica o que a peça dá, antes da raridade, e deixa a
        /// penalidade (a velocidade do machado) como está.
        /// </summary>
        public static Item Instantiate(ItemTemplate template, RarityDef rarity, RngFn rng = null, Func<double> now = null, double? degrau = null)
        {
            rng = rng ?? Rng.Default;
            now = now ?? Js.DateNow;
            double naEscada = Js.Truthy(template.Escada) ? Js.Max(1, Js.Min(Materiais.UltimoDegrau, Math.Truncate(degrau ?? 1))) : 1;
            double material = Materiais.MultiplicadorDoDegrau(naEscada);

            var stats = new ItemStats();
            foreach (var key in template.Base.Keys)
            {
                double baseDaPeca = template.Base.OrZero(key);
                stats.Set(key, Js.Round((baseDaPeca > 0 ? baseDaPeca * material : baseDaPeca) * rarity.Mult));
            }

            var item = new Item
            {
                Uid = template.Id + "_" + Js.NumberToString(now()) + "_" + Js.NumberToString(Rng.RandomInt(99999, rng)),
                TemplateId = template.Id,
                Rarity = rarity.Id,
                Stats = stats,
                Value = Js.Round(template.Value * material * rarity.Mult),
                Equipped = false,
            };

            if (template.Proc != null)
                item.ProcChance = Js.Min(0.5, template.Proc.Chance + (rarity.Mult - 1) * 0.05);
            if (naEscada > 1) item.Degrau = naEscada;

            return item;
        }

        /// <summary>TS: RandomItemOptions.</summary>
        public sealed class RandomItemOptions
        {
            public string Category;
            public string Rarity;
            public double? Floor;
            public RngFn Rng;
            public Func<double> Now;
            /// <summary>Quem pede é o app: arma e armadura sorteiam o degrau do material, com um número a mais do rng.</summary>
            public bool App;
            /// <summary>O item é do chefe: a chance dos degraus 2 e 3 dobra.</summary>
            public bool Chefe;
            /// <summary>O degrau mais alto que pode sair (a loja do app vende até o 2).</summary>
            public double? TetoDoDegrau;
        }

        /// <summary>
        /// TS: randomItem. Sorteia o template, depois a raridade (se não veio forçada) e o uid.
        /// Equipamento achado fundo ganha até +75% nos stats e o foundFloor.
        /// </summary>
        public static Item RandomItem(RandomItemOptions options = null)
        {
            var o = options ?? new RandomItemOptions();
            double floor = o.Floor ?? 1;
            var rng = o.Rng ?? Rng.Default;

            var pool = Js.Truthy(o.Category) ? ItemTemplates.ByCategory(o.Category) : ItemTemplates.All;
            var template = Rng.Pick(pool, rng);
            // Uma raridade forçada e desconhecida cai para comum, igual ao original.
            var rarity = (Js.Truthy(o.Rarity) ? Rarities.ById(o.Rarity) : Rarities.Pick(floor, rng)) ?? Rarities.All[0];
            double degrau = o.App && Js.Truthy(template.Escada) ? Materiais.SortearDegrau(floor, o.Chefe, rng, o.TetoDoDegrau) : 1;

            var item = Instantiate(template, rarity, rng, o.Now, degrau);

            double depth = Js.Max(1, floor);
            if (ItemTemplates.IsEquippable(template.Category) && depth > 1)
            {
                double mult = 1 + Js.Min(0.75, (depth - 1) * 0.015);
                foreach (var key in new List<string>(item.Stats.Keys))
                {
                    double value = item.Stats.OrZero(key);
                    if (value > 0) item.Stats.Set(key, Js.Max(1, Js.Round(value * mult)));
                }
                item.FoundFloor = depth;
            }

            return item;
        }

        /// <summary>TS: statTags — "+5 Ataque", "-2 Defesa"; stat zerado não aparece.</summary>
        public static List<StatTag> StatTags(Item item)
        {
            var tags = new List<StatTag>();
            foreach (var kv in item.Stats)
            {
                if (!Js.Truthy(kv.Value)) continue;
                double value = kv.Value.Value;
                string label = GameData.ItemTable.StatLabels.TryGet(kv.Key, out var l) && l != null ? l : kv.Key;
                tags.Add(new StatTag { Text = (value > 0 ? "+" : "") + Js.NumberToString(value) + " " + label, Positive = value > 0 });
            }
            return tags;
        }

        private static string At(IReadOnlyList<string> list, int index) => index < list.Count ? list[index] : null;
    }

    /// <summary>Port de shared/src/items/tiers.ts.</summary>
    public static class Tiers
    {
        private static TierData D => GameData.TierTable;

        /// <summary>TS: TIER_ORDER.</summary>
        public static List<string> Order => D.TierOrder;

        /// <summary>TS: TIER_MIN.</summary>
        public static List<double> Min => D.TierMin;

        /// <summary>TS: powerScore — só equipamento tem tier; consumível e material dão 0.</summary>
        public static double PowerScore(Item item)
        {
            if (!ItemTemplates.IsEquippable(Items.CategoryOf(item))) return 0;

            int rarityIndex = Math.Max(0, Rarities.Ids.IndexOf(item.Rarity));
            double score = rarityIndex < D.RarityBase.Count ? D.RarityBase[rarityIndex] : 10;

            foreach (var kv in item.Stats)
            {
                double value = Js.Max(0, kv.Value ?? 0);
                score += value * (D.StatWeights.TryGet(kv.Key, out var weight) ? weight : D.DefaultWeight);
            }

            if (item.ProcChance != null) score += item.ProcChance.Value * 30;

            // Number(item.tierAdjustment) || 0
            double adjustment = Js.Num(item.TierAdjustment);
            return Js.Round(score + (Js.Truthy(adjustment) ? adjustment : 0));
        }

        /// <summary>TS: tierFromScore.</summary>
        public static string FromScore(double score)
        {
            for (int i = D.TierMin.Count - 1; i >= 0; i--)
                if (score >= D.TierMin[i]) return D.TierOrder[i];
            return "E";
        }

        /// <summary>TS: tierFor — null para o que não é equipamento.</summary>
        public static string TierFor(Item item) =>
            ItemTemplates.IsEquippable(Items.CategoryOf(item)) ? FromScore(PowerScore(item)) : null;

        /// <summary>TS: tierRank(item).</summary>
        public static double RankOf(Item item) => RankOf(TierFor(item));

        /// <summary>TS: tierRank(tier) — -1 quando não há tier.</summary>
        public static double RankOf(string tier) => Js.Truthy(tier) ? D.TierOrder.IndexOf(tier) : -1;

        /// <summary>TS: tierClass — "SSS+" vira "tier-sss-plus".</summary>
        public static string CssClass(string tier) => "tier-" + ReplaceFirst((tier ?? "").ToLowerInvariant(), "+", "-plus");

        /// <summary>TS: tierInfo.</summary>
        public static TierInfo Info(Item item)
        {
            double score = PowerScore(item);
            int rank = (int)Js.Max(0, RankOf(item));
            double min = D.TierMin[rank];
            double? next = rank < D.TierOrder.Count - 1 ? D.TierMin[rank + 1] : (double?)null;
            return new TierInfo
            {
                Score = score,
                Tier = D.TierOrder[rank],
                Rank = rank,
                Min = min,
                Next = next,
                Progress = next == null ? 100 : ClampPercent(((score - min) / (next.Value - min)) * 100),
            };
        }

        /// <summary>
        /// TS: reforge — move o item delta tiers sem mutar o original: devolve uma cópia nova e o resultado.
        /// </summary>
        public static ReforgeOutcome Reforge(Item item, double delta)
        {
            int last = D.TierOrder.Count - 1;
            double oldRank = Js.Max(0, RankOf(item));
            double target = Js.Max(0, Js.Min(last, oldRank + delta));

            var result = new ReforgeResult
            {
                OldTier = D.TierOrder[(int)oldRank],
                NewTier = D.TierOrder[(int)target],
                OldRank = oldRank,
                NewRank = target,
                Changed = target != oldRank,
            };

            if (target == oldRank) return new ReforgeOutcome { Item = item.Clone(), Result = result };

            double oldScore = Js.Max(1, PowerScore(item));
            double nextMin = D.TierMin[(int)target];
            double nextMax = target < last ? D.TierMin[(int)target + 1] - 1 : 300;
            double desired = Js.Round((nextMin + nextMax) / 2);
            double factor = Js.Max(0.55, Js.Min(1.8, desired / oldScore));

            var next = item.Clone();
            foreach (var key in new List<string>(next.Stats.Keys))
            {
                double value = next.Stats.OrZero(key);
                if (value > 0) next.Stats.Set(key, Js.Max(1, Js.Round(value * factor)));
            }
            next.Value = Js.Max(1, Js.Round(item.Value * (1 + (target - oldRank) * 0.16)));
            next.ReforgeCount = (item.ReforgeCount ?? 0) + 1;
            next.TierAdjustment = 0;

            if (item.ProcChance != null)
                next.ProcChance = Js.Max(0.05, Js.Min(0.65, item.ProcChance.Value + (target - oldRank) * 0.015));

            // O ajuste fecha a diferença até o centro da faixa do tier alvo, para o item cair nele.
            next.TierAdjustment = desired - PowerScore(next);

            return new ReforgeOutcome { Item = next, Result = result };
        }

        private static double ClampPercent(double value) => Js.Max(0, Js.Min(100, Js.Round(value)));

        private static string ReplaceFirst(string s, string search, string replacement)
        {
            int i = s.IndexOf(search, StringComparison.Ordinal);
            return i < 0 ? s : s.Substring(0, i) + replacement + s.Substring(i + search.Length);
        }
    }
}
