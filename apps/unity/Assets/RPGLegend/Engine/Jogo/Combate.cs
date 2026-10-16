using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Rolagem — o último dado rolado, pra tela mostrar.</summary>
    public sealed class Rolagem
    {
        public double Valor;
        public double Lados;
    }

    /// <summary>TS: Flutuante — um número que sobe e some na tela.</summary>
    public sealed class Flutuante
    {
        public string Texto;
        /// <summary>"dano" ou "critico".</summary>
        public string Tom;
        /// <summary>"inimigo" ou "heroi".</summary>
        public string Alvo;
    }

    /// <summary>TS: Combate — a luta aberta na sala.</summary>
    public sealed class Combate
    {
        public EstadoDoJogo Estado;
        /// <summary>TS: FaseDoCombate — "combate", "vitoria", "fuga" ou "derrota".</summary>
        public string Fase;
        public List<string> Log;
        [KeepNull] public Rolagem Dado;
        [KeepNull] public Item Loot;
        /// <summary>TS: PetId — o cosmético da conta, não do save.</summary>
        [KeepNull] public string Pet;
        /// <summary>TS: Efeito.</summary>
        [KeepNull] public string Som;
        public List<Flutuante> Flutuantes;

        public Combate Clone() => (Combate)MemberwiseClone();
    }

    /// <summary>
    /// O começo do encontro de shared/src/jogo/combate.ts: ler a sala de monstro e abrir a luta (a bênção do
    /// NPC e o monstro pronto pra receber status). A luta por turnos em si fica só no site: no app ela é em tempo
    /// real (decisão do usuário, 2026-10-16), e o que a vitória dá entra com ela.
    /// </summary>
    public static class Combates
    {
        /// <summary>TS: salaDeCombate — a sala atual, se for de monstro com criatura.</summary>
        public static DungeonCell SalaDeCombate(EstadoDoJogo estado)
        {
            if (estado.MapMode != "dungeon") return null;
            var celula = Estados.CelulaAtual(estado) as DungeonCell;
            if (celula == null || (celula.Type != DungeonRoomTypes.Monster && celula.Type != DungeonRoomTypes.Boss)) return null;
            return celula.Monsters != null && celula.Monsters.Count > 0 ? celula : null;
        }

        /// <summary>O <c>lista[indice]</c> do JS: fora da lista, negativo ou quebrado é undefined (null).</summary>
        private static MonsterInstance MonstroEm(List<MonsterInstance> lista, double indice)
        {
            if (lista == null || !(indice >= 0) || indice >= lista.Count || Math.Floor(indice) != indice) return null;
            return lista[(int)indice];
        }

        /// <summary>TS: monstroAtual — a criatura da vez, com nome, ícone e espécie resolvidos.</summary>
        public static CombatMonsterView MonstroAtual(EstadoDoJogo estado)
        {
            var sala = SalaDeCombate(estado);
            if (sala == null) return null;
            var bruto = MonstroEm(sala.Monsters, sala.MonsterIndex ?? 0);
            return bruto != null ? Monsters.View(bruto) : null;
        }

        /// <summary>TS: inimigosRestantes — quantos ainda faltam, contando o que está na frente.</summary>
        public static double InimigosRestantes(EstadoDoJogo estado)
        {
            var sala = SalaDeCombate(estado);
            if (sala?.Monsters == null) return 0;
            return sala.Monsters.Count - (sala.MonsterIndex ?? 0);
        }

        /// <summary>TS: comMonstro — grava a criatura da vez de volta na sala, sem os campos da visão.</summary>
        private static EstadoNaMasmorra ComMonstro(EstadoNaMasmorra estado, CombatMonster monstro)
        {
            var sala = (DungeonCell)Estados.CelulaAtual(estado);
            double indice = sala.MonsterIndex ?? 0;
            var atuais = sala.Monsters ?? new List<MonsterInstance>();
            var monsters = new List<MonsterInstance>(atuais.Count);
            for (int i = 0; i < atuais.Count; i++) monsters.Add(i == indice ? DespirView(monstro) : atuais[i]);
            var nova = sala.Clone();
            nova.Monsters = monsters;
            return Estados.SubstituirCelulaAtual(estado, nova);
        }

        /// <summary>
        /// TS: despirView — tira o que <see cref="Monsters.View"/> acrescenta (nome, ícone, espécie…) antes de
        /// guardar na sala, senão a espécie inteira iria pro save. Sempre um objeto novo, como o resto do TS.
        /// </summary>
        private static CombatMonster DespirView(CombatMonster monstro)
        {
            var cru = new CombatMonster();
            monstro.CopyInstanceFieldsTo(cru);
            monstro.CopyCombatFieldsTo(cru);
            cru.ForgetExtras(CombatMonsterView.ViewKeys);
            return cru;
        }

        /// <summary>TS: iniciarEncontro — entrar na sala já é entrar na luta.</summary>
        public static Combate IniciarEncontro(EstadoNaMasmorra estado, string pet = null)
        {
            var monstro = MonstroAtual(estado);
            double restantes = InimigosRestantes(estado);
            string abertura = monstro == null
                ? "A sala está vazia."
                : restantes > 1
                    ? "Um grupo de " + Js.NumberToString(restantes) + " criaturas aparece!"
                    : Js.Str(monstro.Name) + " aparece!";

            var aberto = new Combate
            {
                Estado = estado,
                Fase = "combate",
                Log = new List<string> { abertura },
                Dado = null,
                Loot = null,
                Pet = pet,
                Som = null,
                Flutuantes = new List<Flutuante>(),
            };
            // Sala sem criatura não vira vitória: o combate nunca começou.
            if (monstro == null) return aberto;

            var comecado = ComecarCombate(aberto);
            var log = new List<string> { abertura };
            log.AddRange(comecado.Log);
            var c = comecado.Clone();
            c.Log = log;
            return c;
        }

        /// <summary>TS: comecarCombate — zera os buffs do combate anterior e consome uma bênção de NPC, se houver.</summary>
        public static Combate ComecarCombate(Combate combate)
        {
            var estado = ExigirMasmorra(combate);
            var monstro = MonstroAtual(estado);
            if (monstro == null)
            {
                var vitoria = combate.Clone();
                vitoria.Fase = "vitoria";
                return vitoria;
            }

            var log = new List<string>();
            double dodge = estado.Hero.NpcBlessing?.Dodge ?? 0;
            var semBuffs = estado.Hero.Clone();
            semBuffs.Buffs = new HeroBuffs();
            var bencao = NpcServices.ApplyNpcBlessing(semBuffs);
            if (bencao.Applied) log.Add("A bênção recebida concede +" + Js.NumberToString(dodge) + "% de Esquiva neste combate.");
            log.Add("O combate começa! Ataque, use um poder ou tente fugir.");

            var comHeroi = estado.Clone();
            comHeroi.Hero = bencao.Hero;
            var c = combate.Clone();
            c.Estado = ComMonstro(comHeroi, MonsterState.FreshCombatMonster(monstro));
            c.Fase = "combate";
            c.Log = log;
            c.Som = null;
            c.Flutuantes = new List<Flutuante>();
            return c;
        }

        private static EstadoNaMasmorra ExigirMasmorra(Combate combate)
        {
            if (combate.Estado.MapMode != "dungeon") throw new EngineError("combate só acontece na masmorra", "Error");
            return (EstadoNaMasmorra)combate.Estado;
        }
    }
}
