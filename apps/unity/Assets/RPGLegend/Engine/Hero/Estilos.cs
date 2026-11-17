using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: EstiloDef — um estilo de luta (rodada 5a).</summary>
    public sealed class EstiloDef
    {
        public string Id;
        public string Classe;
        public string Nome;
        public string Icone;
        public string Desc;
        /// <summary>O estilo raro: entra no sorteio 1 vez em tantas. Null, comum.</summary>
        public double? Raro;
    }

    public sealed class RegrasDoEspadachim
    {
        public double Avanco;
        public double Imunidade;
        public double Recarga;
        public double Atordoa;
        public double KiPorSegundo;
        public double Corte;
        public double LarguraDoCorte;
        public double AlcanceDoCorte;
        public double ForcaDoCorte;
    }

    public sealed class RegrasDoCavaleiro
    {
        public double Vida;
        public double Critico;
        public double Desvio;
    }

    public sealed class RegrasDoEmpurrao
    {
        public double Dano;
        public double Raio;
        public double Chance;
    }

    public sealed class RegrasDoChute
    {
        public double Alcance;
        public double Erro;
        public double Critico;
    }

    public sealed class RegrasDaConcentracao
    {
        public double PassosPorCarga;
        public double TetoDeCargas;
        public double PorCarga;
        public double Alcance;
    }

    /// <summary>As tabelas de hero/estilos.ts (fixtures/data/hero/estilos.json).</summary>
    public sealed class EstilosData
    {
        [JsName("ESTILOS")] public List<EstiloDef> Estilos = new List<EstiloDef>();
        [JsName("CHANCE_DO_MESTRE")] public OrderedMap<double> ChanceDoMestre = new OrderedMap<double>();
        [JsName("REGRAS_DO_ESPADACHIM")] public RegrasDoEspadachim Espadachim;
        [JsName("REGRAS_DO_CAVALEIRO")] public RegrasDoCavaleiro Cavaleiro;
        [JsName("REGRAS_DO_EMPURRAO")] public RegrasDoEmpurrao Empurrao;
        [JsName("REGRAS_DO_CHUTE")] public RegrasDoChute Chute;
        [JsName("REGRAS_DA_CONCENTRACAO")] public RegrasDaConcentracao Concentracao;
    }

    public static partial class GameData
    {
        private static EstilosData _estilosTable;

        /// <summary>hero/estilos: os estilos de luta e o mestre.</summary>
        public static EstilosData EstilosTable
        {
            get => Require(_estilosTable, "hero/estilos");
            set => _estilosTable = value;
        }
    }

    /// <summary>
    /// Os estilos de luta (port de shared/src/hero/estilos.ts; rodada 5a do doc do Breno): só o app os ensina (o
    /// mestre numa sala da masmorra, depois de zerar a Floresta) e só a luta do app usa os efeitos, menos a vida do
    /// Cavaleiro, que vale em todo lugar. O herói pode ter vários (Estilos) e escolhe o ativo na guilda (Estilo).
    /// </summary>
    public static class Estilos
    {
        private static EstilosData D => GameData.EstilosTable;

        public static RegrasDoEspadachim Espadachim => D.Espadachim;
        public static RegrasDoCavaleiro Cavaleiro => D.Cavaleiro;
        public static RegrasDoEmpurrao Empurrao => D.Empurrao;
        public static RegrasDoChute Chute => D.Chute;
        public static RegrasDaConcentracao Concentracao => D.Concentracao;

        /// <summary>TS: estiloPorId.</summary>
        public static EstiloDef PorId(string id)
        {
            if (id == null) return null;
            foreach (var e in D.Estilos)
                if (e.Id == id) return e;
            return null;
        }

        /// <summary>TS: estilosDaClasse.</summary>
        public static List<EstiloDef> DaClasse(string classId, string className)
        {
            var id = Catalog.IdDaClasse(classId, className);
            var lista = new List<EstiloDef>();
            foreach (var e in D.Estilos)
                if (e.Classe == id) lista.Add(e);
            return lista;
        }

        /// <summary>TS: estiloAtivo — o escolhido, se é dele e da classe dele; senão null.</summary>
        public static EstiloDef Ativo(string classId, string className, IReadOnlyList<string> estilos, string estilo)
        {
            var e = PorId(estilo);
            if (e == null || e.Classe != Catalog.IdDaClasse(classId, className) || estilos == null || !Contem(estilos, e.Id)) return null;
            return e;
        }

        /// <summary>TS: idDoEstilo.</summary>
        public static string IdDoEstilo(string classId, string className, IReadOnlyList<string> estilos, string estilo) => Ativo(classId, className, estilos, estilo)?.Id;

        public static string IdDoEstilo(Hero hero) => IdDoEstilo(hero.ClassId, hero.ClassName, hero.Estilos, hero.Estilo);

        private static bool Contem(IReadOnlyList<string> lista, string id)
        {
            foreach (var x in lista)
                if (x == id) return true;
            return false;
        }

        /// <summary>TS: estilosQueFaltam.</summary>
        public static List<EstiloDef> QueFaltam(string classId, string className, IReadOnlyList<string> estilos)
        {
            var faltam = new List<EstiloDef>();
            foreach (var e in DaClasse(classId, className))
                if (estilos == null || !Contem(estilos, e.Id)) faltam.Add(e);
            return faltam;
        }

        /// <summary>TS: sortearEstilo — um sorteado entre os que faltam (os raros antes, 1 vez em tantas).</summary>
        public static string Sortear(string classId, string className, IReadOnlyList<string> estilos, RngFn rng)
        {
            var faltam = QueFaltam(classId, className, estilos);
            if (faltam.Count == 0) return null;
            foreach (var e in faltam)
                if (e.Raro != null && rng() * e.Raro.Value < 1) return e.Id;
            var comuns = new List<EstiloDef>();
            foreach (var e in faltam)
                if (e.Raro == null) comuns.Add(e);
            if (comuns.Count == 0) return null;
            return comuns[(int)Rng.RandomInt(comuns.Count, rng)].Id;
        }

        /// <summary>TS: aprenderEstilo — aprende (e vira o ativo); já sabia, ou não é da classe: null (nada muda).</summary>
        public static List<string> ComOAprendido(string classId, string className, IReadOnlyList<string> estilos, string id)
        {
            var e = PorId(id);
            if (e == null || e.Classe != Catalog.IdDaClasse(classId, className) || (estilos != null && Contem(estilos, id))) return null;
            var novos = estilos != null ? new List<string>(estilos) : new List<string>();
            novos.Add(id);
            return novos;
        }

        /// <summary>TS: aprenderEstilo no herói.</summary>
        public static Hero Aprender(Hero hero, string id)
        {
            var novos = ComOAprendido(hero.ClassId, hero.ClassName, hero.Estilos, id);
            if (novos == null) return hero;
            var h = hero.Clone();
            h.Estilos = novos;
            h.Estilo = id;
            return h;
        }

        /// <summary>TS: trocarEstilo — o ativo entre os que tem; null volta a lutar sem estilo. Nada muda: o mesmo herói.</summary>
        public static Hero Trocar(Hero hero, string id)
        {
            if (id == null)
            {
                var sem = hero.Clone();
                sem.Estilo = null;
                return sem;
            }
            if (hero.Estilos == null || !Contem(hero.Estilos, id) || PorId(id)?.Classe != Catalog.IdDaClasse(hero.ClassId, hero.ClassName)) return hero;
            var h = hero.Clone();
            h.Estilo = id;
            return h;
        }

        /// <summary>TS: vidaComOEstilo — o Cavaleiro tem 40% a mais de vida (em todo lugar).</summary>
        public static double VidaComOEstilo(double vida, string classId, string className, IReadOnlyList<string> estilos, string estilo) =>
            IdDoEstilo(classId, className, estilos, estilo) == "cavaleiro" ? Js.Round(vida * (100 + D.Cavaleiro.Vida) / 100) : vida;

        /// <summary>TS: chanceDoMestre — a chance da classe, se ainda falta estilo; senão 0.</summary>
        public static double ChanceDoMestre(string classId, string className, IReadOnlyList<string> estilos)
        {
            var id = Catalog.IdDaClasse(classId, className);
            if (!Js.Truthy(id) || QueFaltam(classId, className, estilos).Count == 0) return 0;
            return D.ChanceDoMestre.TryGet(id, out var chance) ? chance : 0;
        }
    }
}
