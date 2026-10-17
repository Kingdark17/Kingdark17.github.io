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
        /// <summary>No inimigo: em qual monstro do grupo (o índice em <c>cell.monsters</c>).</summary>
        public double? Indice;
    }

    /// <summary>TS: InimigoNaLuta — um monstro do grupo, com o índice na sala e se ainda está de pé.</summary>
    public sealed class InimigoNaLuta
    {
        public double Indice;
        public CombatMonsterView Monstro;
        public bool Vivo;
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
        /// <summary>O monstro que o jogador escolheu atacar: o índice em <c>cell.monsters</c>.</summary>
        public double Alvo;

        public Combate Clone() => (Combate)MemberwiseClone();
    }

    /// <summary>
    /// O começo do encontro de shared/src/jogo/combate.ts: ler a sala de monstro e abrir a luta (a bênção do
    /// NPC e o grupo pronto pra receber status), e as leituras da luta em grupo (quem está de pé, de quem é a vez,
    /// o alvo). A luta por turnos em si fica só no site: no app ela é em tempo real (decisão do usuário,
    /// 2026-10-16), e o que a vitória dá entra com ela.
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

        /// <summary>TS: monstroAtual — o primeiro de pé (o que monsterIndex aponta), com nome, ícone e espécie resolvidos.</summary>
        public static CombatMonsterView MonstroAtual(EstadoDoJogo estado)
        {
            var sala = SalaDeCombate(estado);
            if (sala == null) return null;
            var bruto = MonstroEm(sala.Monsters, sala.MonsterIndex ?? 0);
            return bruto != null ? Monsters.View(bruto) : null;
        }

        /// <summary>TS: vivoNaSala — com vida e não atrás do monsterIndex (nos saves da fila, quem ficou pra trás caiu).</summary>
        private static bool VivoNaSala(DungeonCell sala, double indice)
        {
            var bruto = MonstroEm(sala.Monsters, indice);
            return bruto != null && indice >= (sala.MonsterIndex ?? 0) && bruto.Hp > 0;
        }

        private static List<double> IndicesDePe(DungeonCell sala)
        {
            var dePe = new List<double>();
            for (int i = 0; i < (sala.Monsters?.Count ?? 0); i++)
                if (VivoNaSala(sala, i)) dePe.Add(i);
            return dePe;
        }

        /// <summary>TS: inimigosRestantes — quantos ainda estão de pé.</summary>
        public static double InimigosRestantes(EstadoDoJogo estado)
        {
            var sala = SalaDeCombate(estado);
            return sala == null ? 0 : IndicesDePe(sala).Count;
        }

        /// <summary>TS: inimigosDaLuta — o grupo inteiro, na ordem da sala, com quem ainda está de pé.</summary>
        public static List<InimigoNaLuta> InimigosDaLuta(EstadoDoJogo estado)
        {
            var grupo = new List<InimigoNaLuta>();
            var sala = SalaDeCombate(estado);
            if (sala?.Monsters == null) return grupo;
            for (int i = 0; i < sala.Monsters.Count; i++)
                grupo.Add(new InimigoNaLuta { Indice = i, Monstro = Monsters.View(sala.Monsters[i]), Vivo = VivoNaSala(sala, i) });
            return grupo;
        }

        /// <summary>TS: vezDoMonstro — o primeiro de pé a partir de monsterTurn, dando a volta; null sem ninguém.</summary>
        public static double? VezDoMonstro(EstadoDoJogo estado)
        {
            var sala = SalaDeCombate(estado);
            if (sala == null) return null;
            var dePe = IndicesDePe(sala);
            double desde = sala.MonsterTurn ?? 0;
            foreach (var indice in dePe)
                if (indice >= desde) return indice;
            return dePe.Count > 0 ? dePe[0] : (double?)null;
        }

        /// <summary>TS: alvoDaLuta — o alvo do jogador se ainda está de pé; senão o primeiro de pé.</summary>
        public static double? AlvoDaLuta(Combate combate)
        {
            var sala = SalaDeCombate(combate.Estado);
            if (sala == null) return null;
            if (VivoNaSala(sala, combate.Alvo)) return combate.Alvo;
            var dePe = IndicesDePe(sala);
            return dePe.Count > 0 ? dePe[0] : (double?)null;
        }

        /// <summary>TS: escolherAlvo — trocar o alvo não gasta turno; caído ou inexistente devolve o mesmo combate.</summary>
        public static Combate EscolherAlvo(Combate combate, double indice)
        {
            var sala = SalaDeCombate(combate.Estado);
            if (sala == null || !VivoNaSala(sala, indice)) return combate;
            var c = combate.Clone();
            c.Alvo = indice;
            return c;
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
                Alvo = SalaDeCombate(estado)?.MonsterIndex ?? 0,
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

        /// <summary>
        /// TS: comecarCombate — zera os buffs do combate anterior, consome uma bênção de NPC, se houver, e prepara
        /// cada criatura de pé pra receber status (o grupo inteiro está na luta).
        /// </summary>
        public static Combate ComecarCombate(Combate combate)
        {
            var estado = ExigirMasmorra(combate);
            var sala = SalaDeCombate(estado);
            if (sala == null || MonstroAtual(estado) == null)
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
            var monsters = new List<MonsterInstance>(sala.Monsters.Count);
            for (int i = 0; i < sala.Monsters.Count; i++)
                monsters.Add(VivoNaSala(sala, i) ? MonsterState.FreshCombatMonster(sala.Monsters[i]) : sala.Monsters[i]);
            var preparada = sala.Clone();
            preparada.Monsters = monsters;
            var c = combate.Clone();
            c.Estado = Estados.SubstituirCelulaAtual(comHeroi, preparada);
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
