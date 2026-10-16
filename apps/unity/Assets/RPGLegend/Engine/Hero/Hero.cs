using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: HeroCreation — o que a criação antiga (buildHero) decide.</summary>
    public sealed class HeroCreation
    {
        public string Name;
        public RaceDef Race;
        public ClassDef Cls;
        public DebuffDef Debuff;
        /// <summary>Ids dos poderes escolhidos pelo jogador (a assinatura da classe entra sozinha).</summary>
        public List<string> ChosenPowerIds;
        /// <summary>Opcional: sem ele, os atributos são sorteados por rollAttrs.</summary>
        public Attributes Attrs;
        /// <summary>Penteado. Opcional.</summary>
        public string Hair;
    }

    /// <summary>TS: ApprenticeCreation — nome, raça e aparência; a fraqueza é sorteada por quem chama.</summary>
    public sealed class ApprenticeCreation
    {
        public string Name;
        public RaceDef Race;
        public DebuffDef Debuff;
        /// <summary>Penteado. Opcional.</summary>
        public string Hair;
    }

    /// <summary>TS: GuildTraining.</summary>
    public sealed class GuildTraining
    {
        public Hero Hero;
        /// <summary>A arma inicial que não coube na mão (quem chama põe na mochila); null quando ela foi para a mão.</summary>
        [KeepNull] public Item ToInventory;
    }

    /// <summary>TS: EquipResult['reason'].</summary>
    public static class EquipFailReasons
    {
        /// <summary>A peça cabe na secundária, mas a arma principal ocupa as duas mãos.</summary>
        public const string TwoHandedWeapon = "two_handed_weapon";
    }

    /// <summary>TS: EquipResult.</summary>
    public sealed class EquipResult
    {
        public Hero Hero;
        public bool Equipped;
        /// <summary>Opcional: só quando a peça cabe no slot e mesmo assim foi recusada (<see cref="EquipFailReasons"/>).</summary>
        public string Reason;
    }

    /// <summary>O retorno de gainXP no TS: <c>{ hero, leveledUp, levels }</c>.</summary>
    public sealed class GainXpResult
    {
        public Hero Hero;
        public bool LeveledUp;
        public double Levels;
    }

    /// <summary>
    /// Port de shared/src/hero/hero.ts: poderes, criação (antiga e do Aprendiz), guilda, nível,
    /// equipamento, debuff, afinidade de arma, companheiro e a hidratação do save.
    /// Como no TS, nada aqui muta o herói recebido: quando muda algo, devolve uma cópia.
    /// </summary>
    public static class Heroes
    {
        private static HeroData D => GameData.HeroTable;

        /// <summary>TS: BASE_ATTR — a base de quem nasce sem classe (8 em tudo).</summary>
        public static double BaseAttr => D.BaseAttr;

        /// <summary>TS: APPRENTICE — nome e ícone de quem ainda não treinou. Nenhuma classe se chama assim.</summary>
        public static ApprenticeDef Apprentice => D.Apprentice;

        /// <summary>O papel do companheiro de classe sem entrada em COMPANION_ROLES (literal do código TS, não tabela).</summary>
        private static readonly CompanionRoleDef PapelPadrao = new CompanionRoleDef { Ability = "Ataque", Desc = "Ajuda durante o combate." };

        // ---------- poderes ----------

        /// <summary>
        /// TS: heroPowers — os poderes escolhidos (pelos ids; o save antigo, pelos nomes) e, depois, os que a
        /// classe dá (<c>soDaClasse</c>) e ainda não estão na lista. Devolve os objetos do catálogo.
        /// </summary>
        public static List<PowerDef> HeroPowers(Hero hero)
        {
            // hero.powerIds ?? (nomes → ids): é ??, então uma lista vazia de ids continua vazia.
            List<string> ids;
            if (hero.PowerIds != null)
            {
                ids = hero.PowerIds;
            }
            else
            {
                ids = new List<string>();
                foreach (var name in hero.PowerNames)
                {
                    string id = Catalog.PowerByName(name)?.Id;
                    if (Js.Truthy(id)) ids.Add(id);
                }
            }

            var poderes = new List<PowerDef>();
            foreach (var id in ids)
            {
                var p = Catalog.PowerById(id);
                if (p != null) poderes.Add(p);
            }

            string classe = Catalog.IdDaClasse(hero.ClassId, hero.ClassName);
            foreach (var p in Catalog.Powers)
                if (Js.Truthy(p.SoDaClasse) && p.SoDaClasse == classe && !ids.Contains(p.Id)) poderes.Add(p);
            return poderes;
        }

        // ---------- criação ----------

        /// <summary>
        /// TS: rollAttrs — 6 + d6 nos seis atributos (seis sorteios, na ordem de ATTR_KEYS), bônus da raça,
        /// viés da classe e −1 no atributo da fraqueza, tudo travado em [1, 20].
        /// </summary>
        public static Attributes RollAttrs(RaceDef race, ClassDef cls, DebuffDef debuff, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            var attrs = Attributes.Empty();
            foreach (var key in StatKeys.Attrs) attrs[key] = 6 + Rng.RandomInt(6, rng);
            foreach (var kv in race.Bonus) attrs[kv.Key] += kv.Value;
            foreach (var kv in cls.Bias) attrs[kv.Key] += kv.Value;
            if (Js.Truthy(debuff.Attr)) attrs[debuff.Attr] -= 1;
            foreach (var key in StatKeys.Attrs) attrs[key] = Clamp(attrs[key], 1, 20);
            return attrs;
        }

        /// <summary>
        /// TS: buildHero — o herói pronto da criação antiga (classe, arma e poderes de saída).
        /// Sorteios do <paramref name="rng"/>: os seis de rollAttrs (quando creation.Attrs não vem) e o ouro.
        /// O uid da arma inicial sai de <paramref name="armaRng"/> e <paramref name="armaNow"/> (o
        /// <c>armaInicial</c> do TS); ausentes, do sorteio e do relógio padrão — não do <paramref name="rng"/>.
        /// </summary>
        public static Hero BuildHero(HeroCreation creation, RngFn rng = null, RngFn armaRng = null, Func<double> armaNow = null)
        {
            rng = rng ?? Rng.Default;
            var attrs = creation.Attrs ?? RollAttrs(creation.Race, creation.Cls, creation.Debuff, rng);
            var weaponTemplate = ItemTemplates.ById(creation.Cls.WeaponTemplate);
            if (weaponTemplate == null) throw new EngineError("Arma inicial desconhecida: " + Js.Str(creation.Cls.WeaponTemplate));
            var startWeapon = Espalhar(Items.Instantiate(weaponTemplate, Rarities.All[0], armaRng, armaNow));
            startWeapon.Equipped = true;

            // Poder de assinatura da classe (automático) + os escolhidos, sem duplicar a assinatura.
            var powerIds = new List<string> { creation.Cls.SignatureId };
            foreach (var id in creation.ChosenPowerIds)
                if (id != creation.Cls.SignatureId) powerIds.Add(id);
            var powerNames = new List<string>();
            foreach (var id in powerIds) powerNames.Add(Catalog.PowerById(id)?.Name ?? id);

            var equip = SlotsVazios();
            equip.Set("arma", startWeapon);
            var derived = Derived.Compute(new HeroCore { Level = 1, Attrs = attrs, Equip = equip });

            return new Hero
            {
                Level = 1,
                Attrs = attrs,
                Equip = equip,
                Name = creation.Name,
                Race = creation.Race.Name,
                RaceIcon = creation.Race.Icon,
                ClassName = creation.Cls.Name,
                ClassIcon = creation.Cls.Icon,
                ClassId = creation.Cls.Id,
                RaceId = creation.Race.Id,
                Hair = Js.Truthy(creation.Hair) ? creation.Hair : null,
                Xp = 0,
                XpNext = Derived.XpForLevel(1),
                AttrPoints = 0,
                Gold = 30 + Rng.RandomInt(21, rng),
                PowerNames = powerNames,
                PowerIds = powerIds,
                Debuff = creation.Debuff,
                KillCount = 0,
                MasteryBattles = 0,
                Derived = derived,
                MaxHp = derived.MaxHp,
                Hp = derived.MaxHp,
                MaxMp = derived.MaxMp,
                Mp = derived.MaxMp,
            };
        }

        /// <summary>
        /// TS: apprenticeAttrs — BASE_ATTR em tudo, mais o bônus da raça e −1 no atributo da fraqueza,
        /// travados em [1, 20]. O viés da classe entra depois, na guilda.
        /// </summary>
        public static Attributes ApprenticeAttrs(RaceDef race, DebuffDef debuff)
        {
            var attrs = Attributes.Empty();
            foreach (var key in StatKeys.Attrs) attrs[key] = BaseAttr;
            foreach (var kv in race.Bonus) attrs[kv.Key] += kv.Value;
            if (Js.Truthy(debuff.Attr)) attrs[debuff.Attr] -= 1;
            foreach (var key in StatKeys.Attrs) attrs[key] = Clamp(attrs[key], 1, 20);
            return attrs;
        }

        /// <summary>
        /// TS: buildApprentice — o herói nasce Aprendiz: sem classe, sem arma, sem poder. Sem classId.
        /// Um sorteio: o ouro inicial (30 + 0..20).
        /// </summary>
        public static Hero BuildApprentice(ApprenticeCreation creation, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            var attrs = ApprenticeAttrs(creation.Race, creation.Debuff);
            var equip = SlotsVazios();
            var derived = Derived.Compute(new HeroCore { Level = 1, Attrs = attrs, Equip = equip });

            return new Hero
            {
                Level = 1,
                Attrs = attrs,
                Equip = equip,
                Name = creation.Name,
                Race = creation.Race.Name,
                RaceIcon = creation.Race.Icon,
                ClassName = Apprentice.Name,
                ClassIcon = Apprentice.Icon,
                RaceId = creation.Race.Id,
                Hair = Js.Truthy(creation.Hair) ? creation.Hair : null,
                Xp = 0,
                XpNext = Derived.XpForLevel(1),
                AttrPoints = 0,
                Gold = 30 + Rng.RandomInt(21, rng),
                PowerNames = new List<string>(),
                PowerIds = new List<string>(),
                Debuff = creation.Debuff,
                KillCount = 0,
                MasteryBattles = 0,
                Derived = derived,
                MaxHp = derived.MaxHp,
                Hp = derived.MaxHp,
                MaxMp = derived.MaxMp,
                Mp = derived.MaxMp,
            };
        }

        // ---------- a guilda ----------

        /// <summary>TS: hasClass — já treinou na guilda? Pelo id (o nome antigo é traduzido); o Aprendiz não tem.</summary>
        public static bool HasClass(Hero hero) => Catalog.IdDaClasse(hero.ClassId, hero.ClassName) != null;

        /// <summary>
        /// TS: trainAtGuild — o Aprendiz vira da classe: viés de atributos (travado em [1, 99]), a arma
        /// inicial e só o poder da classe. Quem já tem classe sai como entrou (o mesmo objeto).
        /// A arma vai para a mão quando a principal está livre e não há escudo no caminho de uma arma de
        /// duas mãos; senão volta em <see cref="GuildTraining.ToInventory"/>.
        /// O uid da arma sai de <paramref name="armaRng"/> e <paramref name="armaNow"/> (o <c>armaInicial</c> do
        /// TS); ausentes, do sorteio e do relógio padrão.
        /// </summary>
        public static GuildTraining TrainAtGuild(Hero hero, ClassDef cls, RngFn armaRng = null, Func<double> armaNow = null)
        {
            if (HasClass(hero)) return new GuildTraining { Hero = hero, ToInventory = null };

            var attrs = hero.Attrs.Clone();
            foreach (var kv in cls.Bias) attrs[kv.Key] = Clamp(attrs[kv.Key] + kv.Value, 1, 99);

            var template = ItemTemplates.ById(cls.WeaponTemplate);
            if (template == null) throw new EngineError("Arma inicial desconhecida: " + Js.Str(cls.WeaponTemplate));
            var arma = Items.Instantiate(template, Rarities.All[0], armaRng, armaNow);
            // Mão principal livre, e sem escudo no caminho de uma arma de duas mãos.
            bool cabe = hero.Equip.Get("arma") == null && !(IsTwoHanded(arma) && hero.Equip.Get("secundaria") != null);

            var treinado = hero.Clone();
            treinado.Attrs = attrs;
            if (cabe)
            {
                var equip = hero.Equip.Clone();
                var naMao = Espalhar(arma);
                naMao.Equipped = true;
                equip.Set("arma", naMao);
                treinado.Equip = equip;
            }
            else
            {
                treinado.Equip = hero.Equip;
            }
            treinado.ClassName = cls.Name;
            treinado.ClassIcon = cls.Icon;
            treinado.ClassId = cls.Id;
            treinado.PowerIds = new List<string> { cls.SignatureId };
            treinado.PowerNames = new List<string> { Catalog.PowerById(cls.SignatureId)?.Name ?? cls.SignatureId };
            return new GuildTraining { Hero = RecomputeDerived(treinado), ToInventory = cabe ? null : arma };
        }

        // ---------- derivados, pontos e XP ----------

        /// <summary>
        /// TS: recomputeDerived — derived/maxHp/maxMp do zero, devolvendo cópia. Aumento de vida (mana)
        /// máxima cura pela diferença; redução só limita. hp/mp 0 contam como cheios (o <c>||</c> do original).
        /// </summary>
        public static Hero RecomputeDerived(Hero hero, bool critPenalty = false)
        {
            double oldMaxHp = Js.Truthy(hero.MaxHp) ? hero.MaxHp : 0;
            double oldMaxMp = Js.Truthy(hero.MaxMp) ? hero.MaxMp : 0;
            var derived = Derived.Compute(hero, critPenalty);
            double deltaHp = derived.MaxHp - oldMaxHp;
            double deltaMp = derived.MaxMp - oldMaxMp;

            var next = hero.Clone();
            next.Derived = derived;
            next.MaxHp = derived.MaxHp;
            next.MaxMp = derived.MaxMp;
            next.Hp = Clamp((Js.Truthy(hero.Hp) ? hero.Hp : derived.MaxHp) + Js.Max(0.0, deltaHp), 1, derived.MaxHp);
            next.Mp = Clamp((Js.Truthy(hero.Mp) ? hero.Mp : derived.MaxMp) + Js.Max(0.0, deltaMp), 0, derived.MaxMp);
            return next;
        }

        /// <summary>
        /// TS: spendAttrPoint — gasta 1 ponto livre no atributo (teto 99) e recalcula. Sem pontos
        /// (ausente, 0, NaN ou negativo), devolve o mesmo herói.
        /// </summary>
        public static Hero SpendAttrPoint(Hero hero, string key)
        {
            if (!Js.Truthy(hero.AttrPoints) || hero.AttrPoints.Value <= 0) return hero;
            var attrs = hero.Attrs.Clone();
            attrs[key] = Clamp(hero.Attrs[key] + 1, 1, 99);
            var next = hero.Clone();
            next.Attrs = attrs;
            next.AttrPoints = hero.AttrPoints.Value - 1;
            return RecomputeDerived(next);
        }

        /// <summary>
        /// TS: gainXP — soma o XP e sobe quantos níveis o total permitir (2 pontos livres por nível),
        /// no máximo MAX_NIVEIS_POR_GANHO de uma vez. XP e xpNext estragados (NaN, Infinity, negativo)
        /// viram o padrão em vez de envenenar o save. Só recalcula os derivados se subiu de nível.
        /// </summary>
        public static GainXpResult GainXP(Hero hero, double amount)
        {
            double xp = NumeroSao(hero.Xp, 0) + NumeroSao(amount, 0);
            double level = hero.Level;
            double xpNext = NumeroSao(hero.XpNext, Derived.XpForLevel(NumeroSao(level, 1)));
            // attrPoints pode não existir no save antigo: ausente continua ausente se não subir de nível,
            // e vira NaN se subir (o undefined + 2 do JS).
            double? attrPoints = hero.AttrPoints;
            double levels = 0;

            while (xp >= xpNext && levels < D.MaxNiveisPorGanho)
            {
                xp -= xpNext;
                level += 1;
                xpNext = Derived.XpForLevel(level);
                attrPoints = Js.Num(attrPoints) + 2;
                levels++;
            }

            var next = hero.Clone();
            next.Xp = xp;
            next.Level = level;
            next.XpNext = xpNext;
            next.AttrPoints = attrPoints;
            if (levels > 0) next = RecomputeDerived(next);
            return new GainXpResult { Hero = next, LeveledUp = levels > 0, Levels = levels };
        }

        // ---------- equipamento ----------

        /// <summary>TS: isOffhandEligible — escudo, ou arma leve (OFFHAND_WEAPON_IDS).</summary>
        public static bool IsOffhandEligible(Item item)
        {
            if (item == null) return false;
            if (item.TemplateId == "escudo") return true;
            var template = ItemTemplates.ById(item.TemplateId);
            return template?.Category == "arma" && D.OffhandWeaponIds.Contains(item.TemplateId);
        }

        /// <summary>TS: isTwoHanded — arma que ocupa as duas mãos (TWO_HANDED_WEAPON_IDS).</summary>
        public static bool IsTwoHanded(Item item)
        {
            if (item == null) return false;
            var template = ItemTemplates.ById(item.TemplateId);
            return template?.Category == "arma" && D.TwoHandedWeaponIds.Contains(item.TemplateId);
        }

        /// <summary>
        /// TS: equippedSlot — o slot que carrega este item, pela referência ou, se ela mudou, pelo uid;
        /// null quando não está vestido.
        /// </summary>
        public static string EquippedSlot(Hero hero, Item item)
        {
            foreach (var slot in StatKeys.EquipSlots)
            {
                var current = hero.Equip.Get(slot);
                // current?.uid === item.uid: slot vazio dá undefined, que só bate com item sem uid — igual aqui.
                if (ReferenceEquals(current, item) || current?.Uid == item.Uid) return slot;
            }
            return null;
        }

        /// <summary>
        /// TS: equipItem — veste a peça no slot pedido (ou no do template). Recusa sem mudar o herói
        /// quando a peça não veste ou não vai naquele slot, e com reason <c>two_handed_weapon</c> quando a
        /// secundária esbarra numa arma de duas mãos. Arma de duas mãos na principal esvazia a secundária.
        /// Não muta o item nem o herói.
        /// </summary>
        public static EquipResult EquipItem(Hero hero, Item item, string requestedSlot = null)
        {
            var template = ItemTemplates.ById(item.TemplateId);
            if (template == null || !ItemTemplates.IsEquippable(template.Category)) return new EquipResult { Hero = hero, Equipped = false };

            string slot = requestedSlot ?? ItemTemplates.SlotFor(template);
            if (!SlotAccepts(slot, item, template)) return new EquipResult { Hero = hero, Equipped = false };
            if (slot == "secundaria" && IsTwoHanded(hero.Equip.Get("arma")))
                return new EquipResult { Hero = hero, Equipped = false, Reason = EquipFailReasons.TwoHandedWeapon };

            var equip = hero.Equip.Clone();
            foreach (var otherSlot in StatKeys.EquipSlots)
            {
                var current = equip.Get(otherSlot);
                if (otherSlot == slot) continue;
                if (ReferenceEquals(current, item)) equip.Set(otherSlot, null);
            }
            var vestido = Espalhar(item);
            vestido.Equipped = true;
            equip.Set(slot, vestido);
            // Quem recolhe a peça expulsa é a camada de mochila.
            if (slot == "arma" && IsTwoHanded(item)) equip.Set("secundaria", null);

            var next = hero.Clone();
            next.Equip = equip;
            return new EquipResult { Hero = RecomputeDerived(next), Equipped = true };
        }

        /// <summary>TS: unequipItem — esvazia o slot e recalcula; slot já vazio devolve o mesmo herói.</summary>
        public static Hero UnequipItem(Hero hero, string slot)
        {
            if (hero.Equip.Get(slot) == null) return hero;
            var equip = hero.Equip.Clone();
            equip.Set(slot, null);
            var next = hero.Clone();
            next.Equip = equip;
            return RecomputeDerived(next);
        }

        // ---------- debuff ----------

        /// <summary>
        /// TS: hasDebuffEffect — o herói está sob este efeito? Cobre o save antigo que só gravou o nome
        /// do debuff (LEGACY_DEBUFF_EFFECTS). Herói nulo ou sem debuff: falso.
        /// </summary>
        public static bool HasDebuffEffect(Hero hero, string effect)
        {
            if (hero?.Debuff == null) return false;
            if (hero.Debuff.Effect == effect) return true;
            return GameData.HeroCatalog.LegacyDebuffEffects.TryGet(hero.Debuff.Name, out var legado) && legado == effect;
        }

        // ---------- afinidade de arma ----------

        /// <summary>TS: weaponAffinityPct — % de eficiência com a arma na mão, pela classe; 100 sem arma ou sem entrada.</summary>
        public static double WeaponAffinityPct(Hero hero)
        {
            var weapon = hero.Equip.Get("arma");
            if (weapon == null) return 100;
            var cls = Catalog.ClassById(Catalog.IdDaClasse(hero.ClassId, hero.ClassName) ?? "");
            return cls != null && cls.Affinity.TryGet(weapon.TemplateId, out var pct) ? pct : 100;
        }

        // ---------- companheiro ----------

        /// <summary>
        /// TS: generateCompanion — raça, classe, 6 + d6 nos atributos (com bônus e viés, sem trava),
        /// nome e sobrenome. Dez sorteios, nessa ordem.
        /// </summary>
        public static Companion GenerateCompanion(RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            var race = Rng.Pick(Catalog.Races, rng);
            var cls = Rng.Pick(Catalog.Classes, rng);
            var attrs = Attributes.Empty();
            foreach (var key in StatKeys.Attrs) attrs[key] = 6 + Rng.RandomInt(6, rng);
            foreach (var kv in race.Bonus) attrs[kv.Key] += kv.Value;
            foreach (var kv in cls.Bias) attrs[kv.Key] += kv.Value;

            double maxHp = 18 + attrs.Constituicao * 3;
            var role = D.CompanionRoles.TryGet(cls.Id, out var r) && r != null ? r : PapelPadrao;

            // O template literal sorteia o nome antes do sobrenome.
            string nome = Rng.Pick(GameData.HeroCatalog.FirstNames, rng);
            string sobrenome = Rng.Pick(GameData.HeroCatalog.Surnames, rng);

            return new Companion
            {
                Name = nome + " " + sobrenome,
                RaceIcon = race.Icon,
                Race = race.Name,
                ClassName = cls.Name,
                ClassIcon = cls.Icon,
                ClassId = cls.Id,
                Hp = maxHp,
                MaxHp = maxHp,
                Attack = 4 + Math.Floor((attrs.Forca + attrs.Destreza) / 3),
                Attrs = attrs,
                Stance = CompanionStances.Equilibrada,
                Ability = role.Ability,
                AbilityDesc = role.Desc,
            };
        }

        // ---------- save ----------

        /// <summary>
        /// TS: hydrateSavedHero — normaliza o herói de um save que pode não ter os campos atuais, sem
        /// mutar a entrada: os sete slots (null onde faltava; slot desconhecido some), a regra das duas mãos,
        /// classId/raceId resolvidos pelo nome, poderes pelos ids (ou nomes, ou o da classe), nomes de
        /// poder regenerados do catálogo, attrPoints <c>|| 0</c>, buffs zerados e a contagem de maestria
        /// (a gravada, ou a dos monstros abatidos para quem tem classe). Recalcula os derivados.
        /// </summary>
        public static Hero HydrateSavedHero(Hero hero)
        {
            // Todos os slots, pela lista.
            var equip = new Equipment();
            foreach (var slot in StatKeys.EquipSlots) equip.Set(slot, hero.Equip?.Get(slot));

            // Save de antes da regra das duas mãos: a secundária sai (a peça continua na lista do save).
            if (IsTwoHanded(equip.Get("arma"))) equip.Set("secundaria", null);

            string classId = Catalog.IdDaClasse(hero.ClassId, hero.ClassName);
            string raceId = Catalog.IdDaRaca(hero.RaceId, hero.Race);
            var cls = Catalog.ClassById(classId ?? "");

            // hero.powerIds?.length ? hero.powerIds : (nomes → ids) — a lista do save é a mesma, sem cópia.
            List<string> powerIds;
            if (hero.PowerIds != null && hero.PowerIds.Count > 0)
            {
                powerIds = hero.PowerIds;
            }
            else
            {
                powerIds = new List<string>();
                if (hero.PowerNames != null)
                {
                    foreach (var name in hero.PowerNames)
                    {
                        string id = Catalog.PowerByName(name)?.Id;
                        if (Js.Truthy(id)) powerIds.Add(id);
                    }
                }
            }
            if (powerIds.Count == 0 && cls != null) powerIds = new List<string> { cls.SignatureId };

            // Regenerados do catálogo, não copiados do save.
            var powerNames = new List<string>();
            foreach (var id in powerIds)
            {
                string name = Catalog.PowerById(id)?.Name;
                if (Js.Truthy(name)) powerNames.Add(name);
            }

            var next = hero.Clone();
            next.Equip = equip;
            next.AttrPoints = Js.Truthy(hero.AttrPoints) ? hero.AttrPoints : 0;
            next.Buffs = new HeroBuffs();
            next.ClassId = classId;
            next.RaceId = raceId;
            next.MasteryBattles = MaestriaAoCarregar(hero, cls != null);
            next.PowerIds = powerIds;
            next.PowerNames = powerNames;
            return RecomputeDerived(next);
        }

        /// <summary>
        /// TS: maestriaAoCarregar — a contagem gravada (piso), se for número finito e não negativo;
        /// senão, para quem tem classe, as vitórias de antes, convertidas do killCount; senão 0.
        /// </summary>
        private static double MaestriaAoCarregar(Hero hero, bool temClasse)
        {
            double? gravada = hero.MasteryBattles;
            if (gravada.HasValue && Js.IsFinite(gravada.Value) && gravada.Value >= 0) return Math.Floor(gravada.Value);
            return temClasse ? Mastery.VeteranBattles(hero.KillCount) : 0;
        }

        // ---------- utilitários ----------

        /// <summary>TS: slotAccepts — o slot do template, e mais nenhum; a secundária aceita escudo e arma leve.</summary>
        private static bool SlotAccepts(string slot, Item item, ItemTemplate template)
        {
            if (slot == "secundaria") return IsOffhandEligible(item);
            return ItemTemplates.SlotFor(template) == slot;
        }

        /// <summary>TS: numeroSao — número finito e não negativo, ou o padrão.</summary>
        private static double NumeroSao(double valor, double padrao) => Js.IsFinite(valor) && valor >= 0 ? valor : padrao;

        /// <summary>TS: clamp — Math.max(min, Math.min(max, value)), com NaN passando adiante.</summary>
        private static double Clamp(double value, double min, double max) => Js.Max(min, Js.Min(max, value));

        /// <summary>Os sete slots vazios, na ordem de EQUIP_SLOTS (o literal do buildHero/buildApprentice).</summary>
        private static Equipment SlotsVazios()
        {
            var equip = new Equipment();
            foreach (var slot in StatKeys.EquipSlots) equip.Set(slot, null);
            return equip;
        }

        /// <summary>
        /// O <c>{ ...item }</c> do TS: cópia rasa, que continua dividindo o objeto de stats com o original
        /// (Item.Clone copia os stats, que é o <c>{ ...item, stats: { ...item.stats } }</c>).
        /// </summary>
        private static Item Espalhar(Item item)
        {
            var c = item.Clone();
            c.Stats = item.Stats;
            return c;
        }
    }
}
