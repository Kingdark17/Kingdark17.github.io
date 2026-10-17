using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>
    /// TS: AttackStyle. <c>normal</c> e <c>physical</c> são o mesmo golpe para quem não é mago; para o mago,
    /// <c>physical</c> é o golpe de cajado, com metade do dano físico. <c>ranged</c> é o tiro de arco do
    /// arqueiro e do caçador — dano de golpe físico, dado de classe.
    /// </summary>
    public static class AttackStyles
    {
        public const string Normal = "normal";
        public const string Magic = "magic";
        public const string Physical = "physical";
        public const string Ranged = "ranged";
    }

    /// <summary>TS: ResolveAttackResult['outcome'].</summary>
    public static class ResolveAttackOutcomes
    {
        public const string NoMana = "no_mana";
        public const string Miss = "miss";
        public const string Dodged = "dodged";
        public const string Hit = "hit";
    }

    /// <summary>TS: AtaqueDisponivel — um botão de ataque da classe.</summary>
    public sealed class AtaqueDisponivel
    {
        /// <summary>Um de <see cref="AttackStyles"/>.</summary>
        public string Estilo;
        /// <summary>O ataque que combina com a classe — vem primeiro e tem a zona maior.</summary>
        public bool DaClasse;
        /// <summary>Largura da zona de acerto, em fração da barra (<see cref="Attack.ZonaDoAtaque"/>).</summary>
        public double Zona;
        /// <summary>Mana gasta ao atacar — só o ataque mágico cobra.</summary>
        public double Custo;
    }

    /// <summary>TS: JogadaDeAtaque — o que o jogador fez no ataque: a face do d20 de dano e onde a barra parou.</summary>
    public sealed class JogadaDeAtaque
    {
        /// <summary>Face do d20 de dano, de 1 a 20.</summary>
        public double Dado;
        /// <summary>
        /// Onde o cursor parou, de 0 (começo da barra) a 1 (fim). null quando ele passou do fim sem toque —
        /// como no Undertale, isso é erro. Sempre presente (o <c>number | null</c> do TS).
        /// </summary>
        [KeepNull] public double? Mira;
    }

    /// <summary>TS: LeituraDaMira — o que a barra disse: acertou, com que força, e se parou na faixa do crítico.</summary>
    public sealed class LeituraDaMira
    {
        public bool Acerto;
        /// <summary>Multiplicador do dano: 0,5 na borda da zona, 1,5 no centro. 0 no erro.</summary>
        public double Forca;
        public bool Critico;
    }

    /// <summary>TS: ResolveAttackOptions.</summary>
    public sealed class ResolveAttackOptions
    {
        /// <summary>De onde saem os sorteios; ausente, <see cref="Rng.Default"/>.</summary>
        public RngFn Rng;
        /// <summary>Bônus de crítico vindo do sistema de pets — 0 se ausente.</summary>
        public double? PetCriticoBonus;
    }

    /// <summary>
    /// TS: ResolveAttackResult. Campo opcional do TS é anulável aqui (null = ausente), salvo
    /// <see cref="ProcTriggered"/> e <see cref="ClassPassiveTriggered"/>, que são opcionais e aceitam null ao
    /// mesmo tempo: no acerto vêm sempre (null quando nada disparou); no erro, na esquiva e sem mana, não vêm.
    /// Quem diz se estão presentes são os campos <c>…Specified</c> — a convenção do Newtonsoft que o
    /// JsContractResolver herda: com false, o campo some do JSON mesmo com [KeepNull].
    /// </summary>
    public sealed class ResolveAttackResult
    {
        public Hero Hero;
        public CombatMonsterView Monster;
        /// <summary>Um de <see cref="ResolveAttackOutcomes"/>.</summary>
        public string Outcome;
        public bool Magical;
        public double AffinityPct;
        /// <summary>O que a barra disse — a tela mostra a força, o log não precisa repetir.</summary>
        public LeituraDaMira Mira;
        public double? Damage;
        public bool? IsCrit;

        /// <summary>O proc da arma que disparou no acerto, ou null.</summary>
        [KeepNull] public ProcTemplate ProcTriggered;
        /// <summary>Se <see cref="ProcTriggered"/> existe no resultado (só no acerto).</summary>
        [JsIgnore] public bool ProcTriggeredSpecified;

        /// <summary>A passiva de classe que disparou no acerto, ou null.</summary>
        [KeepNull] public HeroClassPassiveTrigger ClassPassiveTriggered;
        /// <summary>Se <see cref="ClassPassiveTriggered"/> existe no resultado (só no acerto).</summary>
        [JsIgnore] public bool ClassPassiveTriggeredSpecified;

        public bool MonsterDefeated;
    }

    /// <summary>
    /// Port de shared/src/combat/resolve-attack.ts: o ataque em duas partes, como no combate do Undertale.
    /// O d20 é o dado de dano de todo ataque, e a barra de mira decide o acerto e a força. A zona da barra
    /// mora aqui (e não na tela) porque é regra: a tela pergunta o tamanho para desenhar, o resolveAttack
    /// pergunta o mesmo para ler onde ela parou, e um servidor que confira a jogada também.
    /// </summary>
    public static class Attack
    {
        private static ResolveAttackData D => GameData.ResolveAttackTable;

        /// <summary>TS: LADOS_DO_DANO — o d20 é o dado de dano de todo ataque.</summary>
        public static double LadosDoDano => D.LadosDoDano;

        /// <summary>TS: FAIXA_CRITICA — a faixa do centro que crita (o papel do 20 natural, com a mesma largura: 5%).</summary>
        public static double FaixaCritica => D.FaixaCritica;

        /// <summary>TS: FORCA_NA_BORDA — a força do golpe na borda da zona.</summary>
        public static double ForcaNaBorda => D.ForcaNaBorda;

        /// <summary>TS: FORCA_NO_CENTRO — a força do golpe no centro da zona.</summary>
        public static double ForcaNoCentro => D.ForcaNoCentro;

        /// <summary>TS: MAGIC_ATTACK_COST (privada) — a mana do golpe mágico do mago.</summary>
        public static double MagicAttackCost => D.MagicAttackCost;

        /// <summary>
        /// TS: ehAtaqueDaClasse — se este é o ataque que combina com a classe (ClassDef.ataquePrincipal). O
        /// tiro só conta com arco na mão. A classe sai do id (ou do nome antigo, traduzido).
        /// </summary>
        public static bool EhAtaqueDaClasse(Hero hero, string estilo)
        {
            string principal = AtaquePrincipal(hero);
            if (estilo == AttackStyles.Magic) return principal == "magico";
            if (estilo == AttackStyles.Ranged) return principal == "distancia" && hero.Equip.Get("arma")?.TemplateId == "arco";
            return principal == "fisico";
        }

        /// <summary>
        /// TS: zonaDoAtaque — a largura da zona de acerto deste ataque agora, em fração da barra: 2/3 no
        /// ataque da classe e metade nos outros, mais a Precisão (5% a cada 5 pontos, até 85%) e menos a
        /// Visão Fraca com arco ou cajado (10%); nunca menos que duas faixas críticas. Mesma ordem e mesmas
        /// fatias de quando eram pontos no d20.
        /// </summary>
        public static double ZonaDoAtaque(Hero hero, string estilo)
        {
            var buffs = hero.Buffs ?? new HeroBuffs();
            double zona = EhAtaqueDaClasse(hero, estilo) ? D.ZonaDaClasse : D.ZonaComum;
            if (Js.Truthy(buffs.PrecisaoTurns) && buffs.PrecisaoTurns.Value > 0)
            {
                zona = Js.Min(D.ZonaMaxima, zona + D.FatiaPorPonto * Math.Floor((buffs.PrecisaoAmount ?? 0) / 5));
            }
            var arma = hero.Equip.Get("arma");
            if (Heroes.HasDebuffEffect(hero, "rangedPenalty") && arma != null && (arma.TemplateId == "arco" || arma.TemplateId == "cajado"))
            {
                zona -= 2 * D.FatiaPorPonto;
            }
            return Js.Max(2 * D.FaixaCritica, zona);
        }

        /// <summary>
        /// TS: ataquesDisponiveis — os botões de ataque desta classe, o da classe primeiro. O físico está
        /// sempre na lista (o "physical" do mago, o "normal" dos outros); quem tem outro ataque principal o
        /// tem antes dele (o tiro, só com arco na mão).
        /// </summary>
        public static List<AtaqueDisponivel> AtaquesDisponiveis(Hero hero)
        {
            string principal = AtaquePrincipal(hero);
            var estilos = new List<string>();
            if (principal == "magico") estilos.Add(AttackStyles.Magic);
            if (principal == "distancia" && hero.Equip.Get("arma")?.TemplateId == "arco") estilos.Add(AttackStyles.Ranged);
            estilos.Add(principal == "magico" ? AttackStyles.Physical : AttackStyles.Normal);

            var ataques = new List<AtaqueDisponivel>(estilos.Count);
            foreach (var estilo in estilos)
            {
                ataques.Add(new AtaqueDisponivel
                {
                    Estilo = estilo,
                    DaClasse = EhAtaqueDaClasse(hero, estilo),
                    Zona = ZonaDoAtaque(hero, estilo),
                    Custo = estilo == AttackStyles.Magic ? D.MagicAttackCost : 0,
                });
            }
            return ataques;
        }

        /// <summary>
        /// TS: lerMira — lê a barra. A zona fica no meio dela; fora, erra (null também). Dentro, a força cresce
        /// em linha reta da borda (0,5×) até o centro (1,5×), arredondada a duas casas; a faixa do centro
        /// (metade de FAIXA_CRITICA para cada lado) crita.
        ///
        /// A ordem das contas é a do TS, de propósito: lerMira(0.5, 0.525) não crita por um fio
        /// (|0,525 − 0,5| sai um pouco acima de 0,025). O erro devolve sempre o mesmo objeto ERROU da tabela,
        /// como o TS — não o altere.
        /// </summary>
        public static LeituraDaMira LerMira(double zona, double? mira)
        {
            if (mira == null) return D.Errou;
            double distancia = Math.Abs(mira.Value - 0.5);
            double meia = zona / 2;
            if (distancia > meia) return D.Errou;
            double forca = D.ForcaNoCentro - (D.ForcaNoCentro - D.ForcaNaBorda) * (distancia / meia);
            return new LeituraDaMira { Acerto = true, Forca = Js.Round(forca * 100) / 100, Critico = distancia <= D.FaixaCritica / 2 };
        }

        /// <summary>
        /// TS: resolveAttack — o ataque do herói contra o monstro: acerto/erro pela barra, dano físico ou
        /// mágico, crítico, proc de arma e passiva de classe. Não decide o que vem depois (turno da equipe,
        /// status contínuo, turno do monstro) nem chama tickHeroStatus — isso é de quem orquestra a rodada.
        ///
        /// Dado fora de 1..LADOS_DO_DANO (ou não inteiro) e mira fora de [0, 1] (ou não finita) lançam
        /// RangeError antes de tudo, inclusive da mana. Ordem dos sorteios: a esquiva do monstro ágil (só se
        /// a barra acertou, sem crítico garantido e fora da faixa crítica), o crítico de sorte (pulado só com
        /// o crítico garantido — a faixa crítica vem depois no <c>||</c> e não poupa o sorteio), o proc da
        /// arma (só com arma que tenha proc) e a passiva de classe (só a da classe do herói). Não muta nada.
        /// </summary>
        public static ResolveAttackResult ResolveAttack(Hero hero, CombatMonsterView monster, JogadaDeAtaque jogada, string attackStyle, ResolveAttackOptions options = null)
        {
            // Número fora do dado ou mira fora da barra é defeito de quem chamou: o servidor que conferir a
            // jogada quer exatamente esta recusa. Vem antes da mana: a jogada é inválida com ou sem ela.
            double dado = jogada.Dado;
            double? mira = jogada.Mira;
            ConferirDado(dado, attackStyle);
            if (mira != null && (!Js.IsFinite(mira.Value) || mira.Value < 0 || mira.Value > 1))
            {
                throw new EngineError("mira " + Js.NumberToString(mira.Value) + " fora da barra (ataque " + Js.Str(attackStyle) + ")", "RangeError");
            }

            return ResolverGolpe(hero, monster, dado, LerMira(ZonaDoAtaque(hero, attackStyle), mira), attackStyle, options);
        }

        /// <summary>
        /// TS: resolverGolpe — o golpe com a mira já lida: tudo o que a <see cref="ResolveAttack"/> faz depois de
        /// ler a barra. Existe à parte para a luta em tempo real do app, onde a leitura vem do evento da arma
        /// (<see cref="EventosDeArma.LerEvento"/>) e não da barra; o resto do golpe é o mesmo, sorteio por sorteio.
        /// Dado fora do d20 e força fora de 0 a FORCA_NO_CENTRO (ou não finita) lançam RangeError, o dado primeiro.
        /// </summary>
        public static ResolveAttackResult ResolverGolpe(Hero hero, CombatMonsterView monster, double dado, LeituraDaMira leitura, string attackStyle, ResolveAttackOptions options = null)
        {
            options = options ?? new ResolveAttackOptions();
            var rng = options.Rng ?? Rng.Default;
            double petCritico = options.PetCriticoBonus ?? 0;

            ConferirDado(dado, attackStyle);
            if (!Js.IsFinite(leitura.Forca) || leitura.Forca < 0 || leitura.Forca > D.ForcaNoCentro)
            {
                throw new EngineError("força " + Js.NumberToString(leitura.Forca) + " fora da régua (ataque " + Js.Str(attackStyle) + ")", "RangeError");
            }

            bool isMage = IdDaClasse(hero) == "mago";
            bool magicalAttack = isMage && attackStyle == AttackStyles.Magic;

            if (magicalAttack && hero.Mp < D.MagicAttackCost)
            {
                return new ResolveAttackResult
                {
                    Hero = hero,
                    Monster = monster,
                    Outcome = ResolveAttackOutcomes.NoMana,
                    Magical = true,
                    AffinityPct = Heroes.WeaponAffinityPct(hero),
                    Mira = leitura,
                    MonsterDefeated = false,
                };
            }
            var heroAfterCost = hero;
            if (magicalAttack)
            {
                heroAfterCost = hero.Clone();
                heroAfterCost.Mp = hero.Mp - D.MagicAttackCost;
            }

            var d = heroAfterCost.Derived;
            var bonus = Derived.EquipmentBonus(heroAfterCost.Equip);
            double affinity = Heroes.WeaponAffinityPct(heroAfterCost);
            var buffs = heroAfterCost.Buffs ?? new HeroBuffs();
            bool guaranteedCrit = buffs.CritNext == true;

            bool hit = leitura.Acerto || guaranteedCrit;
            bool dodgedByAgility = false;
            // O crítico garantido e a faixa do crítico pulam esta checagem, como o 20 natural pulava: golpe
            // crítico não é esquivado pelo monstro ágil.
            if (hit && !guaranteedCrit && !leitura.Critico && monster.Behavior == "agil" && rng() < 0.15)
            {
                hit = false;
                dodgedByAgility = true;
            }

            if (!hit)
            {
                return new ResolveAttackResult
                {
                    Hero = ConsumeTurnBuffs(heroAfterCost),
                    Monster = monster,
                    Outcome = dodgedByAgility ? ResolveAttackOutcomes.Dodged : ResolveAttackOutcomes.Miss,
                    Magical = magicalAttack,
                    AffinityPct = affinity,
                    Mira = leitura,
                    MonsterDefeated = false,
                };
            }

            // O crítico garantido acerta mesmo com a barra fora da zona; aí ela não pesa para nenhum lado (1×).
            double forcaDaMira = leitura.Acerto ? leitura.Forca : 1;

            double forcaMult = Js.Truthy(buffs.ForcaTurns) && buffs.ForcaTurns.Value > 0 ? 1 + (buffs.ForcaAmount ?? 0) : 1;
            if (IdDaClasse(heroAfterCost) == "barbaro" && heroAfterCost.Hp < heroAfterCost.MaxHp * 0.5)
            {
                forcaMult *= 1.35;
            }

            // Canção de Batalha: ao contrário da força, vale para o golpe mágico também. Quem a desconta é a
            // rodada, não o golpe (Party.PassarRodadaDaCancao).
            double inspiracao = Js.Truthy(buffs.InspiracaoTurns) && buffs.InspiracaoTurns.Value > 0 ? 1 + (buffs.InspiracaoAmount ?? 0) : 1;

            // Maestria: +2% por nível, só com a arma que a classe domina na mão.
            double maestria = Mastery.DamageMult(heroAfterCost);

            // O d20 de dano entra onde ficava o d6 escondido: a base é 2 + d20.
            double baseDoGolpe = 2 + dado;
            double dmg;
            CombatMonsterView nextMonster;

            if (magicalAttack)
            {
                dmg = Js.Round(
                    (baseDoGolpe + d.DmgMagico + Damage.WeaponAtkContribution(heroAfterCost, affinity) + Damage.OtherEquipAtk(heroAfterCost)) * inspiracao * maestria * forcaDaMira);
                var mod = Damage.ModifyDamageByAffinity(monster, monster.Species.Weakness, monster.Species.Resistance, dmg, "magico", isMage);
                dmg = mod.Dmg;
                nextMonster = ComoVisao(mod.Monster).Clone(); // { ...monster, ...mod.monster }
            }
            else
            {
                double physicalBase = isMage && attackStyle == AttackStyles.Physical ? Js.Round(d.DmgFisico * 0.5) : d.DmgFisico;
                dmg = Js.Round(
                    (baseDoGolpe + physicalBase + Damage.WeaponAtkContribution(heroAfterCost, affinity) + Damage.OtherEquipAtk(heroAfterCost)) *
                        forcaMult *
                        inspiracao *
                        maestria *
                        forcaDaMira);
                var mod = Damage.ModifyDamageByAffinity(monster, monster.Species.Weakness, monster.Species.Resistance, dmg, "fisico", false);
                dmg = mod.Dmg;
                nextMonster = ComoVisao(mod.Monster).Clone(); // { ...monster, ...mod.monster }
            }

            double critChance = (d.Critico + bonus["critico"] + petCritico + (IdDaClasse(heroAfterCost) == "arqueiro" ? 8 : 0)) / 100;
            bool isCrit = guaranteedCrit || rng() < critChance || leitura.Critico;
            if (isCrit) dmg = Js.Round(dmg * 1.6);

            var golpeado = nextMonster.Clone();
            golpeado.Hp = nextMonster.Hp - dmg;
            nextMonster = golpeado;

            // consumeTurnBuffs({ ...heroAfterCost, buffs: { ...buffs, critNext: false } })
            var semCritNext = buffs.Clone();
            semCritNext.CritNext = false;
            var comBuffs = heroAfterCost.Clone();
            comBuffs.Buffs = semCritNext;
            var afterHero = ConsumeTurnBuffs(comBuffs);

            var procResult = WeaponProc.ApplyWeaponProc(afterHero, nextMonster, rng);
            afterHero = procResult.Hero;
            nextMonster = ComoVisao(procResult.Monster).Clone(); // { ...nextMonster, ...procResult.monster }

            var passiveResult = ClassPassives.ApplyHeroClassPassive(afterHero, nextMonster, dmg, rng);
            afterHero = passiveResult.Hero;
            nextMonster = ComoVisao(passiveResult.Monster).Clone(); // { ...nextMonster, ...passiveResult.monster }

            return new ResolveAttackResult
            {
                Hero = afterHero,
                Monster = nextMonster,
                Outcome = ResolveAttackOutcomes.Hit,
                Magical = magicalAttack,
                AffinityPct = affinity,
                Mira = leitura,
                Damage = dmg,
                IsCrit = isCrit,
                ProcTriggered = procResult.Triggered,
                ProcTriggeredSpecified = true,
                ClassPassiveTriggered = passiveResult.Triggered,
                ClassPassiveTriggeredSpecified = true,
                MonsterDefeated = nextMonster.Hp <= 0,
            };
        }

        /// <summary>
        /// TS: consumeTurnBuffs (privada) — desconta um turno de Precisão e de Força, no acerto e no erro;
        /// critNext não. Os dois campos ficam como estavam quando não há turno a descontar (ausente continua
        /// ausente). Devolve cópia, com buffs novo.
        /// </summary>
        private static Hero ConsumeTurnBuffs(Hero hero)
        {
            var b = hero.Buffs ?? new HeroBuffs();
            var nextBuffs = b.Clone();
            nextBuffs.PrecisaoTurns = Js.Truthy(b.PrecisaoTurns) && b.PrecisaoTurns.Value > 0 ? b.PrecisaoTurns.Value - 1 : b.PrecisaoTurns;
            nextBuffs.ForcaTurns = Js.Truthy(b.ForcaTurns) && b.ForcaTurns.Value > 0 ? b.ForcaTurns.Value - 1 : b.ForcaTurns;
            var next = hero.Clone();
            next.Buffs = nextBuffs;
            return next;
        }

        /// <summary>O dado fora de 1..LADOS_DO_DANO (ou não inteiro) é defeito de quem chamou.</summary>
        private static void ConferirDado(double dado, string attackStyle)
        {
            if (!Dodge.EhInteiro(dado) || dado < 1 || dado > D.LadosDoDano)
            {
                throw new EngineError(
                    "rolagem " + Js.NumberToString(dado) + " não existe num d" + Js.NumberToString(D.LadosDoDano) + " (ataque " + Js.Str(attackStyle) + ")",
                    "RangeError");
            }
        }

        private static string IdDaClasse(Hero hero) => Catalog.IdDaClasse(hero.ClassId, hero.ClassName);

        /// <summary>O <c>classById(idDaClasse(hero) ?? '')?.ataquePrincipal</c> do TS.</summary>
        private static string AtaquePrincipal(Hero hero) => Catalog.ClassById(IdDaClasse(hero) ?? "")?.AtaquePrincipal;

        /// <summary>As funções de combate copiam com Clone, que guarda o tipo: a partir de uma visão, sai visão.</summary>
        private static CombatMonsterView ComoVisao(CombatMonster monster) =>
            monster as CombatMonsterView ?? throw new InvalidOperationException("esperava a visão do monstro de volta");
    }
}
