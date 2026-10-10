using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>
    /// TS: MonsterOverrides — troca pontual da fachada de um monstro especial. Hoje só o Mímico usa:
    /// ele é um monstro comum sorteado (fraqueza, resistência e classe de inimigo continuam as do
    /// sorteio) com outro nome, ícone, comportamento e texto de habilidade. Quem precisa desses campos
    /// lê pela visão (<see cref="Monsters.View"/>), nunca direto da espécie.
    /// </summary>
    public sealed class MonsterOverrides
    {
        public string Name;
        public string Icon;
        public string Behavior;
        public string Ability;
        public string AbilityDesc;

        /// <summary>Campos do save que o C# não conhece; voltam intactos ao salvar.</summary>
        [JsExtra] public JsExtras Extra;
    }

    /// <summary>
    /// TS: MonsterInstance — um monstro num andar. Guarda só o que a geração decide; nome, ícone,
    /// comportamento e textos vêm da espécie pela visão, pelo mesmo motivo que o item guarda o templateId:
    /// a instância vai salva dentro de cell.monsters[] do mapa, que trafega inteiro a cada sincronização.
    ///
    /// Hierarquia do porte: MonsterInstance ← <see cref="CombatMonster"/> (o estado de combate) ←
    /// <see cref="CombatMonsterView"/> (com os campos da espécie resolvidos).
    /// </summary>
    public class MonsterInstance
    {
        public string SpeciesId;
        public string EnemyClassId;
        public double Floor;
        public double Hp;
        public double MaxHp;
        public double Dmg;
        public double Speed;
        public double Xp;
        public double Gold;
        public bool IsBoss;
        /// <summary>Só no chefe: chefe principal (true) ou mini-chefe (false).</summary>
        public bool? IsMainBoss;
        /// <summary>Título sorteado do chefe — guardado porque é aleatório e precisa ficar estável.</summary>
        public string BossTitle;
        /// <summary>Só no Mímico.</summary>
        public MonsterOverrides Overrides;

        /// <summary>Campos do save que o C# não conhece; voltam intactos ao salvar.</summary>
        [JsExtra] public JsExtras Extra;

        /// <summary>
        /// O <c>{ ...monster }</c> do TS: cópia rasa e do mesmo tipo — uma visão continua visão, e status,
        /// overrides e espécie continuam sendo os mesmos objetos. Os campos desconhecidos são copiados.
        /// </summary>
        public MonsterInstance Clone()
        {
            var c = (MonsterInstance)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }

        /// <summary>Copia os campos de MonsterInstance (raso, como o spread do JS) para outro objeto.</summary>
        internal void CopyInstanceFieldsTo(MonsterInstance target)
        {
            target.SpeciesId = SpeciesId;
            target.EnemyClassId = EnemyClassId;
            target.Floor = Floor;
            target.Hp = Hp;
            target.MaxHp = MaxHp;
            target.Dmg = Dmg;
            target.Speed = Speed;
            target.Xp = Xp;
            target.Gold = Gold;
            target.IsBoss = IsBoss;
            target.IsMainBoss = IsMainBoss;
            target.BossTitle = BossTitle;
            target.Overrides = Overrides;
            target.Extra = Extra?.Clone();
        }

        /// <summary>
        /// Tira do Extra as chaves que um campo do C# acabou de sobrescrever. No JS, <c>{ ...m, status: {} }</c>
        /// troca a chave; aqui, se ela tinha vindo como desconhecida (lida num tipo mais pobre), o Extra a
        /// escreveria de novo por cima do campo.
        /// </summary>
        internal void ForgetExtras(params string[] keys)
        {
            if (Extra == null) return;
            foreach (var key in keys) Extra.Remove(key);
        }
    }

    /// <summary>Port de shared/src/monsters/generate.ts: geração de monstros, chefes e mímicos, e a visão.</summary>
    public static class Monsters
    {
        /// <summary>TS: GenerateOptions.</summary>
        public sealed class GenerateOptions
        {
            public RngFn Rng;

            /// <summary>
            /// Ids das espécies que podem sair (cada masmorra tem as suas). Ausente, vazio ou sem nenhum id
            /// conhecido, vale a lista inteira.
            /// </summary>
            public IReadOnlyList<string> Species;

            /// <summary>
            /// Só no chefe: chefe principal ou não. Ausente, é <c>floor % 10 == 0</c> — a masmorra passa o
            /// andar de força em floor, e quem decide se é o chefe principal é o andar real.
            /// </summary>
            public bool? Main;
        }

        /// <summary>TS: especiesPermitidas — o filtro guarda a ordem de SPECIES, não a da lista de ids.</summary>
        private static List<SpeciesDef> EspeciesPermitidas(IReadOnlyList<string> ids)
        {
            var all = MonsterCatalog.Species;
            if (ids == null || ids.Count == 0) return all;
            var permitidas = new List<SpeciesDef>();
            foreach (var especie in all)
                if (Includes(ids, especie.Id)) permitidas.Add(especie);
            return permitidas.Count > 0 ? permitidas : all;
        }

        /// <summary>
        /// TS: generate. Sorteia, nesta ordem: espécie, classe de inimigo, +0..3 de vida, +0..3 de XP e
        /// +0..5 de ouro (5 números do rng).
        /// </summary>
        public static MonsterInstance Generate(double floor, GenerateOptions options = null)
        {
            var rng = options?.Rng ?? Rng.Default;
            var species = Rng.Pick(EspeciesPermitidas(options?.Species), rng);
            var enemyClass = Rng.Pick(MonsterCatalog.EnemyClasses, rng);
            double scale = 1 + (floor - 1) * 0.27;
            double hp = Js.Round(species.BaseHp * scale * enemyClass.HpMult) + Rng.RandomInt(4, rng);

            var monster = new MonsterInstance
            {
                SpeciesId = species.Id,
                EnemyClassId = enemyClass.Id,
                Floor = floor,
                Hp = hp,
                MaxHp = hp,
                Dmg = Js.Max(1, Js.Round((species.BaseDmg + Math.Floor((floor - 1) * 0.6)) * enemyClass.DmgMult)),
                Speed = Js.Max(1, Js.Round(species.BaseSpeed * (1 + (floor - 1) * 0.09) * enemyClass.SpeedMult)),
            };
            monster.Xp = 6 + floor * 3 + Rng.RandomInt(4, rng);
            monster.Gold = 4 + floor * 2 + Rng.RandomInt(6, rng);
            monster.IsBoss = false;
            return monster;
        }

        /// <summary>
        /// TS: generateBoss — mini-chefe a cada 5 andares, chefe principal a cada 10. Sorteia espécie,
        /// classe de inimigo e título (3 números do rng); o resto é conta fixa.
        /// </summary>
        public static MonsterInstance GenerateBoss(double floor, GenerateOptions options = null)
        {
            var rng = options?.Rng ?? Rng.Default;
            var species = Rng.Pick(EspeciesPermitidas(options?.Species), rng);
            var enemyClass = Rng.Pick(MonsterCatalog.EnemyClasses, rng);
            bool isMain = options?.Main ?? floor % 10 == 0;
            string title = Rng.Pick(MonsterCatalog.BossTitles, rng);
            double mult = isMain ? 3.2 : 2.1;
            double hp = Js.Round(species.BaseHp * (1 + (floor - 1) * 0.27) * mult * enemyClass.HpMult) + 20;

            return new MonsterInstance
            {
                SpeciesId = species.Id,
                EnemyClassId = enemyClass.Id,
                Floor = floor,
                Hp = hp,
                MaxHp = hp,
                Dmg = Js.Round((species.BaseDmg + Math.Floor((floor - 1) * 0.65) + (isMain ? 5 : 3)) * enemyClass.DmgMult),
                Speed = Js.Round(species.BaseSpeed * (1 + (floor - 1) * 0.08) * 0.9),
                Xp = (isMain ? 60 : 30) + floor * 5,
                Gold = (isMain ? 80 : 40) + floor * 6,
                IsBoss = true,
                IsMainBoss = isMain,
                BossTitle = title,
            };
        }

        /// <summary>
        /// TS: generateMimic — a sala de tesouro armadilhada. É um monstro comum sorteado um andar acima
        /// (floor + 1, que fica gravado), mais forte, com a fachada trocada; fraqueza, resistência e classe
        /// de inimigo continuam as do sorteio. Não olha <see cref="GenerateOptions.Main"/>.
        /// </summary>
        public static MonsterInstance GenerateMimic(double floor, GenerateOptions options = null)
        {
            var rng = options?.Rng ?? Rng.Default;
            var b = Generate(floor + 1, new GenerateOptions { Rng = rng, Species = options?.Species });
            double hp = Js.Round(b.Hp * 1.45);

            var mimic = b.Clone();
            mimic.Hp = hp;
            mimic.MaxHp = hp;
            mimic.Dmg = Js.Round(b.Dmg * 1.25);
            mimic.Xp = b.Xp + 8 + floor * 2;
            mimic.Gold = b.Gold + 10 + floor * 2;
            mimic.Overrides = new MonsterOverrides
            {
                Name = "Mímico " + (floor >= 8 ? "Ancestral" : "Faminto"),
                Icon = "🧰",
                Behavior = "agressivo",
                Ability = "Mordida Surpresa",
                AbilityDesc = "Ataca com força depois de se revelar como um baú falso.",
            };
            return mimic;
        }

        /// <summary>
        /// TS: monsterView — o monstro com nome, ícone, comportamento, textos e classe resolvidos pela espécie
        /// (ou pelos overrides). Devolve cópia: todos os campos que o monstro já tinha continuam (os de
        /// combate e os desconhecidos também), e os da visão são sempre recalculados.
        ///
        /// No TS o retorno é <c>T &amp; MonsterViewFields</c>: a MonsterView de uma instância ou a
        /// CombatMonsterView de um monstro em combate. Aqui as duas são <see cref="CombatMonsterView"/>; na
        /// de uma instância, os campos de combate ficam ausentes (null), e o JSON sai igual.
        /// </summary>
        public static CombatMonsterView View(MonsterInstance monster)
        {
            var species = MonsterCatalog.SpeciesById(monster.SpeciesId);
            var enemyClass = MonsterCatalog.EnemyClassById(monster.EnemyClassId);
            if (species == null) throw new EngineError("Espécie desconhecida: " + Js.Str(monster.SpeciesId));
            if (enemyClass == null) throw new EngineError("Classe de inimigo desconhecida: " + Js.Str(monster.EnemyClassId));

            var overrides = monster.Overrides ?? new MonsterOverrides();
            string tierLabel = MonsterCatalog.TierLabelFor(monster.Floor);
            string baseName = Js.Truthy(tierLabel) ? Js.Str(species.Name) + " " + tierLabel : species.Name;
            string name = overrides.Name ?? (monster.IsBoss ? Js.Str(species.Name) + ", " + Js.Str(monster.BossTitle) : baseName);

            var view = CombatMonsterView.From(monster);
            view.Species = species;
            view.EnemyClass = enemyClass;
            view.Name = name;
            view.Icon = overrides.Icon ?? species.Icon;
            view.Behavior = overrides.Behavior ?? species.Behavior;
            view.Ability = overrides.Ability ?? species.Ability;
            view.AbilityDesc = overrides.AbilityDesc ?? species.AbilityDesc;
            view.EnemyClassLabel = monster.IsBoss ? "Chefe " + Js.Str(enemyClass.Name) : enemyClass.Name;
            view.ForgetExtras(CombatMonsterView.ViewKeys);
            return view;
        }

        /// <summary>Array.prototype.includes com texto: igualdade exata (ordinal).</summary>
        private static bool Includes(IReadOnlyList<string> list, string value)
        {
            for (int i = 0; i < list.Count; i++)
                if (string.Equals(list[i], value, StringComparison.Ordinal)) return true;
            return false;
        }
    }
}
