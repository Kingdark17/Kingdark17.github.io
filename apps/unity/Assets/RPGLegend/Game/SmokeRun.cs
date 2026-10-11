using System;
using System.Collections.Generic;
using RPGLegend.Engine;

namespace RPGLegend.Game
{
    /// <summary>
    /// Uma partida curta e determinística da engine, para provar que ela roda fora dos testes: cria o herói,
    /// gera o andar 1 e enfrenta os monstros do andar, um por um, até o herói cair ou o andar ficar limpo
    /// (falha se o turno do monstro não rodar nenhuma vez). Sem UnityEngine: o mesmo código roda no
    /// Editor e no executável, e o relatório tem que sair igual nos dois (é o que o "Build de teste" confere).
    ///
    /// Tudo sai de <c>Rng.SeededRng(Seed)</c> e de um relógio fixo, menos o uid da arma inicial: o BuildHero o
    /// sorteia com Rng.Default e Date.now, como o buildHero do TS. Por isso o relatório não mostra uid.
    ///
    /// Pressupõe as tabelas carregadas (GameDataLoader.Load); quem roda é que carrega.
    /// </summary>
    public static class SmokeRun
    {
        public const double Seed = 42;

        /// <summary>O relógio dos uid de item do andar — o mesmo dos fixtures do TS.</summary>
        public const double Now = 1700000000000;

        /// <summary>Uma luta (um monstro) que passa disto não vai terminar: o monstro sempre tira pelo menos 1.</summary>
        public const int MaxRounds = 200;

        public const string Ok = "SMOKE OK";
        public const string FailPrefix = "SMOKE FALHOU: ";

        /// <summary>As linhas do relatório. A última é <see cref="Ok"/> ou começa com <see cref="FailPrefix"/>.</summary>
        public static List<string> Run()
        {
            var lines = new List<string>();
            try
            {
                Play(lines);
                lines.Add(Ok);
            }
            catch (Exception e)
            {
                lines.Add(FailPrefix + e.GetType().Name + ": " + e.Message);
            }
            return lines;
        }

        public static bool Passed(IReadOnlyList<string> lines) => lines.Count > 0 && lines[lines.Count - 1] == Ok;

        private static void Play(List<string> lines)
        {
            var rng = Rng.SeededRng(Seed);
            Func<double> relogio = () => Now;
            lines.Add("RPG Legend: smoke da engine, seed " + N(Seed));

            // a) O herói.
            var hero = Heroes.BuildHero(new HeroCreation
            {
                Name = "Smoke",
                Race = Exigir(Catalog.RaceById("humano"), "a raça humano"),
                Cls = Exigir(Catalog.ClassById("guerreiro"), "a classe guerreiro"),
                Debuff = Exigir(Catalog.DebuffById("orgulhoso"), "o debuff orgulhoso"),
                ChosenPowerIds = new List<string>(),
            }, rng);
            var a = hero.Attrs;
            var arma = hero.Equip?.Get("arma");
            lines.Add("herói: " + hero.Name + ", " + hero.Race + " " + hero.ClassName + ", nível " + N(hero.Level) +
                      ", vida " + N(hero.Hp) + "/" + N(hero.MaxHp) + ", mana " + N(hero.Mp) + "/" + N(hero.MaxMp) + ", ouro " + N(hero.Gold));
            lines.Add("atributos: FOR " + N(a.Forca) + ", DES " + N(a.Destreza) + ", CON " + N(a.Constituicao) +
                      ", INT " + N(a.Intelecto) + ", SAB " + N(a.Sabedoria) + ", CAR " + N(a.Carisma));
            lines.Add("arma: " + (arma == null ? "nenhuma" : arma.TemplateId + " " + arma.Rarity) + "; poderes: " + string.Join(", ", hero.PowerIds ?? new List<string>()));

            // b) O andar.
            var andar = DungeonFloors.Generate(1, 6, 6, new DungeonGenerateOptions { Rng = rng, Now = relogio });
            lines.Add("andar 1, grade 6x6: " + N(andar.Rooms.Count) + " salas, início em (" + N(andar.Start.X) + ", " + N(andar.Start.Y) + ")");
            lines.Add("salas: " + ContarTipos(andar.Rooms));

            // c) As lutas: os monstros do andar, sala a sala e na ordem da fila de cada sala, com a vida do herói
            // passando de uma luta para a outra, até o herói cair ou o andar ficar limpo.
            var lutas = 0;
            var turnosDoMonstro = 0;
            IReadOnlyList<Companion> party = new List<Companion>();
            foreach (var sala in andar.Rooms)
            {
                if (sala.Monsters == null) continue;
                foreach (var instancia in sala.Monsters)
                {
                    var monstro = Monsters.View(MonsterState.FreshCombatMonster(instancia));
                    lutas++;
                    lines.Add("monstro " + N(lutas) + ": " + monstro.Name + " (" + monstro.EnemyClassLabel + ") na sala (" + N(sala.X) + ", " + N(sala.Y) + "), vida " +
                              N(monstro.Hp) + "/" + N(monstro.MaxHp) + ", dano " + N(monstro.Dmg) + ", velocidade " + N(monstro.Speed));
                    if (!Lutar(lines, rng, ref hero, ref party, monstro, ref turnosDoMonstro))
                    {
                        lines.Add("fim: herói derrotado na luta " + N(lutas) + "; turnos do monstro " + N(turnosDoMonstro));
                        return;
                    }
                }
            }
            if (lutas == 0) throw new InvalidOperationException("o andar não tem sala com monstro");
            // O smoke existe para exercitar os dois lados da luta.
            if (turnosDoMonstro == 0) throw new InvalidOperationException("o turno do monstro não rodou nenhuma vez");
            lines.Add("fim: andar limpo, " + N(lutas) + " lutas, turnos do monstro " + N(turnosDoMonstro) + "; herói com " + N(hero.Hp) + "/" + N(hero.MaxHp));
        }

        /// <summary>Alterna o golpe do herói e o do monstro até um cair. Devolve false quando quem caiu foi o herói.</summary>
        private static bool Lutar(List<string> lines, RngFn rng, ref Hero hero, ref IReadOnlyList<Companion> party, CombatMonsterView monstro, ref int turnosDoMonstro)
        {
            for (int rodada = 1; rodada <= MaxRounds; rodada++)
            {
                var jogada = new JogadaDeAtaque { Dado = 1 + Rng.RandomInt(20, rng), Mira = rng() };
                var golpe = Attack.ResolveAttack(hero, monstro, jogada, AttackStyles.Normal, new ResolveAttackOptions { Rng = rng });
                hero = golpe.Hero;
                monstro = golpe.Monster;
                lines.Add("  rodada " + N(rodada) + ", herói: d20 " + N(jogada.Dado) + ", força " + N(golpe.Mira.Forca) + ", " + golpe.Outcome +
                          Dano(golpe.Damage) + (golpe.IsCrit == true ? " crítico" : "") + "; monstro " + N(monstro.Hp) + "/" + N(monstro.MaxHp));
                ConferirVidas(hero, monstro);
                if (golpe.MonsterDefeated)
                {
                    lines.Add("  monstro derrotado na rodada " + N(rodada) + "; herói com " + N(hero.Hp) + "/" + N(hero.MaxHp));
                    return true;
                }

                var resposta = MonsterHit.ApplyMonsterHit(hero, party, monstro, new MonsterHitOptions { Rng = rng });
                turnosDoMonstro++;
                hero = resposta.Hero;
                monstro = resposta.Monster;
                party = resposta.Party;
                lines.Add("  rodada " + N(rodada) + ", monstro: " + resposta.Outcome + Dano(resposta.Damage) + "; herói " + N(hero.Hp) + "/" + N(hero.MaxHp));
                ConferirVidas(hero, monstro);
                if (resposta.HeroDefeated)
                {
                    lines.Add("  herói derrotado na rodada " + N(rodada) + "; monstro com " + N(monstro.Hp) + "/" + N(monstro.MaxHp));
                    return false;
                }
            }
            throw new InvalidOperationException("a luta não terminou em " + MaxRounds + " rodadas");
        }

        /// <summary>Quantas salas de cada tipo, na ordem em que o tipo aparece na lista de salas do andar.</summary>
        private static string ContarTipos(List<DungeonCell> salas)
        {
            var ordem = new List<string>();
            var contagem = new Dictionary<string, int>();
            foreach (var sala in salas)
            {
                if (!contagem.ContainsKey(sala.Type))
                {
                    ordem.Add(sala.Type);
                    contagem[sala.Type] = 0;
                }
                contagem[sala.Type]++;
            }
            var partes = new List<string>();
            foreach (var tipo in ordem) partes.Add(tipo + " " + N(contagem[tipo]));
            return string.Join(", ", partes);
        }

        private static void ConferirVidas(Hero hero, CombatMonster monstro)
        {
            if (double.IsNaN(hero.Hp) || double.IsNaN(monstro.Hp)) throw new InvalidOperationException("a vida virou NaN");
            if (hero.Hp < 0 || hero.Hp > hero.MaxHp) throw new InvalidOperationException("a vida do herói saiu de [0, máximo]: " + N(hero.Hp));
        }

        private static string Dano(double? dano) => dano.HasValue ? " " + N(dano.Value) : "";

        /// <summary>Número como o String() do JS: o texto não depende da cultura da máquina.</summary>
        private static string N(double x) => Js.NumberToString(x);

        private static T Exigir<T>(T valor, string oQue) where T : class =>
            valor ?? throw new InvalidOperationException("não achei " + oQue + " nas tabelas");
    }
}
