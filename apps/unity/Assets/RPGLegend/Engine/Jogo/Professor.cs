using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Professor — a conversa com o mestre de classe na sala.</summary>
    public sealed class Professor
    {
        public EstadoNaMasmorra Estado;
        public ClassDef Classe;
        /// <summary>TS: TeacherMode — null quando não há o que ensinar a este herói.</summary>
        [KeepNull] public string Modo;
        public List<string> Log;
        public bool Concluido;

        public Professor Clone() => (Professor)MemberwiseClone();
    }

    /// <summary>
    /// Port de shared/src/jogo/professor.ts: o mestre ensina um poder da lista da classe a quem tem vaga, e
    /// oferece troca a quem já tem três. A regra mora em <see cref="Teachers"/>.
    /// </summary>
    public static class Professores
    {
        private static List<PowerDef> Poderes(List<string> ids)
        {
            var poderes = new List<PowerDef>();
            foreach (var id in ids)
            {
                var poder = Catalog.PowerById(id);
                if (poder != null) poderes.Add(poder);
            }
            return poderes;
        }

        private static Professor Concluido(EstadoNaMasmorra estado, ClassDef classe, string fala) =>
            new Professor { Estado = estado, Classe = classe, Modo = null, Log = new List<string> { fala }, Concluido = true };

        /// <summary>TS: abrirProfessor — null quando a sala não tem mestre (ou a classe dele não existe).</summary>
        public static Professor AbrirProfessor(EstadoNaMasmorra estado)
        {
            var sala = Estados.CelulaAtual(estado) as DungeonCell;
            var classe = Catalog.ClassById(sala?.Teacher?.ClassId ?? "");
            if (sala?.Teacher == null || classe == null) return null;

            var mestre = "O mestre " + classe.Name.ToLowerInvariant();
            // No co-op o andar nasce com o mestre da classe de quem conduz.
            if (Catalog.IdDaClasse(estado.Hero.ClassId, estado.Hero.ClassName) != classe.Id)
                return Concluido(estado, classe, mestre + " acena com a cabeça: ele só ensina quem segue o caminho de " + classe.Name + ".");
            if (Teachers.For(estado.Hero, estado.Floor)?.Number != sala.Teacher.Number)
                return Concluido(estado, classe, mestre + " reconhece você: o que ele tinha a ensinar, você já sabe.");

            var modo = Teachers.Mode(estado.Hero);
            var fala = modo == TeacherModes.Learn
                ? mestre + " se aproxima: \"Sua maestria chegou longe. Escolha o que quer aprender.\""
                : mestre + " olha seus poderes: \"Você já carrega três. Se quiser, troco um deles por um do nosso caminho.\"";
            return new Professor { Estado = estado, Classe = classe, Modo = modo, Log = new List<string> { fala }, Concluido = false };
        }

        /// <summary>TS: ofertas — a lista da classe, menos o que o herói já tem.</summary>
        public static List<PowerDef> Ofertas(Professor professor) => Poderes(Teachers.Offer(professor.Estado.Hero));

        /// <summary>TS: trocaveis — na troca, tudo menos o poder da classe.</summary>
        public static List<PowerDef> Trocaveis(Professor professor) => Poderes(Teachers.SwappablePowers(professor.Estado.Hero));

        /// <summary>TS: ensinado — o mestre marca que já ensinou.</summary>
        private static EstadoNaMasmorra Ensinado(EstadoNaMasmorra estado)
        {
            var sala = (DungeonCell)Estados.CelulaAtual(estado);
            if (sala.Teacher == null) return estado;
            var professor = sala.Teacher.Clone();
            professor.Taught = true;
            var nova = sala.Clone();
            nova.Teacher = professor;
            return Estados.SubstituirCelulaAtual(estado, nova);
        }

        private static Professor Ensinou(Professor professor, Hero hero, string linha)
        {
            var comHeroi = professor.Estado.Clone();
            comHeroi.Hero = hero;
            var c = professor.Clone();
            c.Estado = Ensinado(comHeroi);
            c.Log = new List<string> { linha };
            c.Concluido = true;
            return c;
        }

        /// <summary>TS: aprender — fora da lista devolve o mesmo professor.</summary>
        public static Professor Aprender(Professor professor, string powerId)
        {
            var hero = Teachers.Learn(professor.Estado.Hero, powerId);
            if (hero == null) return professor;
            var nome = Catalog.PowerById(powerId)?.Name ?? powerId;
            return Ensinou(professor, hero, "Você aprende " + nome + ". O mestre segue caminho.");
        }

        /// <summary>TS: trocar — troca inválida devolve o mesmo professor.</summary>
        public static Professor Trocar(Professor professor, string esquecer, string aprenderId)
        {
            var hero = Teachers.Swap(professor.Estado.Hero, esquecer, aprenderId);
            if (hero == null) return professor;
            var antigo = Catalog.PowerById(esquecer)?.Name ?? esquecer;
            var novo = Catalog.PowerById(aprenderId)?.Name ?? aprenderId;
            return Ensinou(professor, hero, "Você troca " + antigo + " por " + novo + ". O mestre segue caminho.");
        }
    }
}
