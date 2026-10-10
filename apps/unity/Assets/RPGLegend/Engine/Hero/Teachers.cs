using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: TeacherMode.</summary>
    public static class TeacherModes
    {
        /// <summary>Ainda tem vaga: aprende um poder da lista.</summary>
        public const string Learn = "learn";
        /// <summary>Já tem os poderes da criação antiga: troca um extra por um da lista.</summary>
        public const string Swap = "swap";
    }

    /// <summary>
    /// Os professores de classe (port de shared/src/hero/teachers.ts): o primeiro nos andares 25–50 com
    /// maestria 4, o segundo nos 75–80 com maestria 8. Quem tem vaga aprende; o veterano troca.
    /// </summary>
    public static class Teachers
    {
        private static TeacherData D => GameData.TeacherTable;

        /// <summary>TS: CLASS_TEACHER_POWERS — a lista de 3 poderes de cada classe, por id.</summary>
        public static OrderedMap<List<string>> ClassTeacherPowers => D.ClassTeacherPowers;

        /// <summary>TS: TEACHERS.</summary>
        public static List<TeacherDef> All => D.Teachers;

        /// <summary>TS: teacherOffer — os poderes da lista da classe que o herói ainda não tem (e que existem no catálogo).</summary>
        public static List<string> Offer(Hero hero)
        {
            List<string> lista = ClassTeacherPowers.TryGet(Catalog.IdDaClasse(hero.ClassId, hero.ClassName) ?? "", out var l) && l != null
                ? l
                : new List<string>();
            var tem = hero.PowerIds ?? new List<string>();
            var oferta = new List<string>();
            foreach (var id in lista)
                if (!tem.Contains(id) && Catalog.PowerById(id) != null) oferta.Add(id);
            return oferta;
        }

        /// <summary>
        /// TS: teacherMode — aprender, para quem ainda tem vaga (o da classe + um por professor já
        /// encontrado + o deste); trocar, para quem já tem poderes nessa conta ou mais.
        /// </summary>
        public static string Mode(Hero hero)
        {
            double vagas = 1 + Encontrados(hero) + 1;
            return (hero.PowerIds?.Count ?? 0) >= vagas ? TeacherModes.Swap : TeacherModes.Learn;
        }

        /// <summary>TS: swappablePowers — os poderes que o herói pode dar na troca: todos menos o da classe.</summary>
        public static List<string> SwappablePowers(Hero hero)
        {
            string daClasse = Assinatura(hero);
            var trocaveis = new List<string>();
            foreach (var id in hero.PowerIds ?? new List<string>())
                if (id != daClasse) trocaveis.Add(id);
            return trocaveis;
        }

        /// <summary>
        /// TS: teacherFor — o professor que este herói pode encontrar neste andar (o objeto da tabela), ou
        /// null: sem classe, os dois já encontrados, fora da faixa, maestria baixa, lista esgotada ou nada a trocar.
        /// </summary>
        public static TeacherDef For(Hero hero, double floor)
        {
            if (Catalog.IdDaClasse(hero.ClassId, hero.ClassName) == null) return null;
            double indice = Encontrados(hero);
            if (indice >= All.Count) return null;
            var professor = All[(int)indice];
            if (professor == null) return null;
            if (floor < professor.Floors[0] || floor > professor.Floors[1]) return null;
            if (Mastery.Level(hero.MasteryBattles ?? 0) < professor.Mastery) return null;
            // Lista esgotada (o veterano que já tinha os três): não há o que ensinar.
            if (Offer(hero).Count == 0) return null;
            if (Mode(hero) == TeacherModes.Swap && SwappablePowers(hero).Count == 0) return null;
            return professor;
        }

        /// <summary>TS: teacherAppears — ele aparece neste andar? O último andar da faixa garante.</summary>
        public static bool Appears(TeacherDef professor, double floor, double roll) =>
            floor >= professor.Floors[1] || roll < professor.Chance;

        /// <summary>
        /// TS: learnFromTeacher — aprende um poder da lista (vai para o fim). null se não é a vez de
        /// aprender ou se o poder não está na oferta.
        /// </summary>
        public static Hero Learn(Hero hero, string powerId)
        {
            if (Mode(hero) != TeacherModes.Learn || !Offer(hero).Contains(powerId)) return null;
            var ids = new List<string>(hero.PowerIds ?? new List<string>()) { powerId };
            return ComPoderes(hero, ids);
        }

        /// <summary>
        /// TS: swapWithTeacher — troca um poder extra por um da lista, no mesmo lugar. null se a troca não vale.
        /// </summary>
        public static Hero Swap(Hero hero, string giveUp, string learn)
        {
            if (Mode(hero) != TeacherModes.Swap || !SwappablePowers(hero).Contains(giveUp) || !Offer(hero).Contains(learn)) return null;
            var ids = new List<string>();
            foreach (var id in hero.PowerIds ?? new List<string>()) ids.Add(id == giveUp ? learn : id);
            return ComPoderes(hero, ids);
        }

        /// <summary>TS: encontrados — professores já encontrados: inteiro, finito e positivo, ou zero.</summary>
        private static double Encontrados(Hero hero)
        {
            double? n = hero.TeachersMet;
            return n.HasValue && Js.IsFinite(n.Value) && n.Value > 0 ? Math.Floor(n.Value) : 0;
        }

        /// <summary>TS: assinatura — o poder da classe do herói, ou null.</summary>
        private static string Assinatura(Hero hero) =>
            Catalog.ClassById(Catalog.IdDaClasse(hero.ClassId, hero.ClassName) ?? "")?.SignatureId;

        /// <summary>TS: comPoderes — cópia com os poderes novos, os nomes do catálogo e mais um professor encontrado.</summary>
        private static Hero ComPoderes(Hero hero, List<string> powerIds)
        {
            var powerNames = new List<string>();
            foreach (var id in powerIds)
            {
                string nome = Catalog.PowerById(id)?.Name;
                if (Js.Truthy(nome)) powerNames.Add(nome);
            }
            var next = hero.Clone();
            next.PowerIds = powerIds;
            next.PowerNames = powerNames;
            next.TeachersMet = Encontrados(hero) + 1;
            return next;
        }
    }
}
