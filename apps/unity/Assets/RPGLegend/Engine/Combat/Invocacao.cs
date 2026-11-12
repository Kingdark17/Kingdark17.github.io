using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>As tabelas de combat/invocacao.ts (fixtures/data/combat/invocacao.json).</summary>
    public sealed class InvocacaoData
    {
        [JsName("MAX_ESQUELETOS")] public double MaxEsqueletos;
        [JsName("FIM_DOS_ESQUELETOS")] public string FimDosEsqueletos;
    }

    public static partial class GameData
    {
        private static InvocacaoData _invocacaoTable;

        /// <summary>combat/invocacao: quantos esqueletos de pé, e a linha do fim da luta.</summary>
        public static InvocacaoData InvocacaoTable
        {
            get => Require(_invocacaoTable, "combat/invocacao");
            set => _invocacaoTable = value;
        }
    }

    /// <summary>
    /// O esqueleto do necromante (port de shared/src/combat/invocacao.ts): o poder Levantar Esqueleto, do site e do
    /// app. Luta como um companheiro e some quando a luta acaba; até 3 de pé, à parte dos recrutas. Os esqueletos
    /// moram na equipe, marcados com Invocado; os caídos ficam na lista até a luta acabar (a arena guarda os
    /// companheiros pelo índice na equipe).
    /// </summary>
    public static class Invocacao
    {
        private static InvocacaoData D => GameData.InvocacaoTable;

        /// <summary>TS: MAX_ESQUELETOS — quantos podem estar de pé ao mesmo tempo.</summary>
        public static double MaxEsqueletos => D.MaxEsqueletos;

        /// <summary>TS: FIM_DOS_ESQUELETOS — a linha do registro quando a luta acaba com esqueletos caídos na equipe.</summary>
        public static string FimDosEsqueletos => D.FimDosEsqueletos;

        /// <summary>TS: esqueletosDePe — os esqueletos de pé agora.</summary>
        public static double EsqueletosDePe(IReadOnlyList<Companion> party)
        {
            double n = 0;
            foreach (var membro in party)
                if (membro.Invocado == true && membro.Hp > 0) n++;
            return n;
        }

        /// <summary>TS: temInvocadoCaido — há esqueleto caído na equipe.</summary>
        public static bool TemInvocadoCaido(IReadOnlyList<Companion> party)
        {
            foreach (var membro in party)
                if (membro.Invocado == true && membro.Hp <= 0) return true;
            return false;
        }

        /// <summary>TS: semInvocadosCaidos — a equipe sem os esqueletos que caíram; os de pé seguem o herói.</summary>
        public static List<Companion> SemInvocadosCaidos(IReadOnlyList<Companion> party)
        {
            var ficam = new List<Companion>();
            foreach (var membro in party)
                if (membro.Invocado != true || membro.Hp > 0) ficam.Add(membro);
            return ficam;
        }

        /// <summary>TS: semInvocados — a equipe sem os esqueletos: o que chega à cidade.</summary>
        public static List<Companion> SemInvocados(IReadOnlyList<Companion> party)
        {
            var ficam = new List<Companion>();
            foreach (var membro in party)
                if (membro.Invocado != true) ficam.Add(membro);
            return ficam;
        }

        private static string NomeDoNumero(double n) => n > 1 ? "Esqueleto " + Js.NumberToString(n) : "Esqueleto";

        /// <summary>
        /// TS: criarEsqueleto — um esqueleto novo, na força do necromante: vida (20 + 4 × nível + 2 × Inteligência) ÷ 2
        /// e ataque (3 + nível + Inteligência ÷ 2) ÷ 2 (a metade do que era até 2026-11-12), agressivo. O nome leva o primeiro número livre entre os esqueletos.
        /// </summary>
        public static Companion CriarEsqueleto(Hero hero, IReadOnlyList<Companion> party)
        {
            double inteligencia = hero.Attrs?.Intelecto ?? 0;
            double maxHp = Math.Max(1, Math.Floor((20 + 4 * hero.Level + 2 * inteligencia) / 2));
            var usados = new HashSet<string>();
            foreach (var membro in party)
                if (membro.Invocado == true) usados.Add(membro.Name);
            double numero = 1;
            while (usados.Contains(NomeDoNumero(numero))) numero++;
            return new Companion
            {
                Name = NomeDoNumero(numero),
                RaceIcon = "💀",
                Race = "Morto-vivo",
                ClassName = "Esqueleto",
                ClassIcon = "💀",
                Hp = maxHp,
                MaxHp = maxHp,
                Attack = Math.Max(1, Math.Floor((3 + hero.Level + Math.Floor(inteligencia / 2)) / 2)),
                Attrs = Attributes.Empty(),
                Stance = CompanionStances.Agressiva,
                Ability = "Ossos Erguidos",
                AbilityDesc = "Luta ao lado do necromante até cair ou até a volta à cidade.",
                Invocado = true,
            };
        }
    }
}
