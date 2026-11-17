using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>As tabelas de combat/invocacao.ts (fixtures/data/combat/invocacao.json).</summary>
    public sealed class InvocacaoData
    {
        [JsName("MAX_ESQUELETOS")] public double MaxEsqueletos;
        [JsName("FIM_DOS_ESQUELETOS")] public string FimDosEsqueletos;
        [JsName("REGRAS_DO_NECROMANTE")] public RegrasDoNecromante Necromante;
        [JsName("ESPECIE_DO_LACAIO")] public string EspecieDoLacaio;
    }

    /// <summary>TS: REGRAS_DO_NECROMANTE — o lacaio do app, os estados, a Magia Proibida e o cristal do chefe.</summary>
    public sealed class RegrasDoNecromante
    {
        public double DanoPorInteligencia;
        public double VidaDoHeroi;
        public double Custo;
        public double Retaguarda;
        public double DanoNaRetaguarda;
        public double ResistenciaNoOfensivo;
        public double Passo;
        public double RecargaDaMagia;
        public double RequisitoDaMagia;
        public double LevantaCom;
        public double FalhaNoChefe;
    }

    /// <summary>TS: CristalDoInimigo — o cristal que fica onde o inimigo caiu: a espécie, o nível e se era chefe.</summary>
    public class CristalDoInimigo
    {
        public string Especie;
        public double Nivel;
        public bool? Chefe;
    }

    /// <summary>TS: UsoDoCristal — a equipe (com o lacaio trocado, se deu), o texto, e se o cristal se gastou.</summary>
    public sealed class UsoDoCristal
    {
        public List<Companion> Party;
        public string Texto;
        public bool Trocou;
        public bool Gasto;
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
        // ---------- o lacaio do Necromante na luta do app (rodada 4b) ----------

        public static RegrasDoNecromante Necromante => D.Necromante;

        /// <summary>TS: especieDoLacaio — a espécie do lacaio (o esqueleto, se ainda não trocou).</summary>
        public static string EspecieDoLacaio(Companion membro) => membro.Especie ?? D.EspecieDoLacaio;

        /// <summary>TS: estadoDoLacaio — o estado do lacaio (a retaguarda, se ainda não mudou).</summary>
        public static string EstadoDoLacaio(Companion membro) => membro.EstadoDoLacaio ?? "retaguarda";

        private static string NomeDaEspecie(string especie) =>
            especie == D.EspecieDoLacaio ? "Esqueleto" : (MonsterCatalog.SpeciesById(especie)?.Name ?? "Esqueleto");

        private static string NomeLivre(string nomeBase, IReadOnlyList<Companion> party, int exceto = -1)
        {
            var usados = new HashSet<string>();
            for (int i = 0; i < party.Count; i++)
                if (party[i].Invocado == true && i != exceto) usados.Add(party[i].Name);
            int n = 1;
            string Nome(int k) => k > 1 ? nomeBase + " " + Js.NumberToString(k) : nomeBase;
            while (usados.Contains(Nome(n))) n++;
            return Nome(n);
        }

        /// <summary>TS: custoDoLacaio — 65% da mana máxima, arredondado.</summary>
        public static double CustoDoLacaio(Hero hero) => Js.Round(hero.MaxMp * D.Necromante.Custo / 100);

        /// <summary>TS: criarLacaio — um lacaio novo, com os números do Breno, da espécie pedida (o esqueleto, sem pedir).</summary>
        public static Companion CriarLacaio(Hero hero, IReadOnlyList<Companion> party, string especie = null)
        {
            var r = D.Necromante;
            string qual = especie != null && MonsterCatalog.SpeciesById(especie) != null ? especie : D.EspecieDoLacaio;
            string icone = MonsterCatalog.SpeciesById(qual)?.Icon ?? "💀";
            double maxHp = Math.Max(1, Math.Truncate(hero.MaxHp * r.VidaDoHeroi));
            return new Companion
            {
                Name = NomeLivre(NomeDaEspecie(qual), party),
                RaceIcon = icone,
                Race = "Morto-vivo",
                ClassName = NomeDaEspecie(qual),
                ClassIcon = icone,
                Hp = maxHp,
                MaxHp = maxHp,
                Attack = Math.Max(1, Math.Truncate((hero.Attrs?.Intelecto ?? 0) * r.DanoPorInteligencia)),
                Attrs = Attributes.Empty(),
                Stance = CompanionStances.Agressiva,
                Ability = "Lacaio",
                AbilityDesc = "Luta ao lado do Necromante até cair ou até a volta à cidade.",
                Invocado = true,
                Especie = qual,
                EstadoDoLacaio = "retaguarda",
            };
        }

        /// <summary>TS: mudarEstadoDoLacaio — muda o estado de um lacaio (a janela do K); quem não é lacaio fica como está.</summary>
        public static List<Companion> MudarEstadoDoLacaio(IReadOnlyList<Companion> party, int indice, string estado)
        {
            var nova = new List<Companion>(party.Count);
            for (int i = 0; i < party.Count; i++)
            {
                if (i == indice && party[i].Invocado == true)
                {
                    var c = party[i].Clone();
                    c.EstadoDoLacaio = estado;
                    nova.Add(c);
                }
                else nova.Add(party[i]);
            }
            return nova;
        }

        /// <summary>TS: trocarPeloCristal — o lacaio vira a espécie do cristal (o do chefe, só acima do nível dele e com 65% de falha).</summary>
        public static UsoDoCristal TrocarPeloCristal(Hero hero, IReadOnlyList<Companion> party, int indice, CristalDoInimigo cristal, RngFn rng)
        {
            var membro = indice >= 0 && indice < party.Count ? party[indice] : null;
            UsoDoCristal Sem(string texto) => new UsoDoCristal { Party = new List<Companion>(party), Texto = texto, Trocou = false, Gasto = false };
            if (membro == null || membro.Invocado != true || membro.Hp <= 0) return Sem("Escolha um lacaio de pé.");
            if (MonsterCatalog.SpeciesById(cristal.Especie) == null) return Sem("Este cristal não guarda alma nenhuma.");
            if (cristal.Chefe == true)
            {
                if (hero.Level <= cristal.Nivel) return Sem("A alma do chefe é forte demais: só acima do nível " + Js.NumberToString(cristal.Nivel) + ".");
                if (rng() * 100 < D.Necromante.FalhaNoChefe)
                    return new UsoDoCristal { Party = new List<Companion>(party), Texto = "O cristal se parte: a alma do chefe resiste.", Trocou = false, Gasto = true };
            }
            string nomeBase = NomeDaEspecie(cristal.Especie);
            string icone = MonsterCatalog.SpeciesById(cristal.Especie)?.Icon ?? membro.ClassIcon;
            string nome = NomeLivre(nomeBase, party, indice);
            var novo = membro.Clone();
            novo.Name = nome;
            novo.RaceIcon = icone;
            novo.ClassName = nomeBase;
            novo.ClassIcon = icone;
            novo.Especie = cristal.Especie;
            var nova = new List<Companion>(party);
            nova[indice] = novo;
            return new UsoDoCristal { Party = nova, Texto = membro.Name + " agora é " + nome + ".", Trocou = true, Gasto = true };
        }

        /// <summary>TS: liberarMagia — a masmorra foi zerada: a Magia Proibida volta, se era essa que ele devia.</summary>
        public static Hero LiberarMagia(Hero hero, string masmorra)
        {
            if (hero.BloqueioDaMagia != masmorra) return hero;
            var livre = hero.Clone();
            livre.BloqueioDaMagia = null;
            return livre;
        }

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
