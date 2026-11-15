namespace RPGLegend.Engine
{
    /// <summary>TS: ClasseDeLuta — os números de uma classe na luta: o alcance em blocos, e a vida, o dano e a velocidade em %.</summary>
    public sealed class ClasseDeLuta
    {
        public double Alcance;
        public double Vida;
        public double Dano;
        public double Velocidade;
    }

    /// <summary>As tabelas de hero/classes-de-luta.ts (fixtures/data/hero/classes-de-luta.json).</summary>
    public sealed class ClassesDeLutaData
    {
        [JsName("CLASSE_PADRAO")] public ClasseDeLuta ClassePadrao;
        [JsName("CLASSES_DE_LUTA")] public OrderedMap<ClasseDeLuta> Classes;
        [JsName("ALCANCE_DO_BARBARO")] public OrderedMap<double> AlcanceDoBarbaro;
        [JsName("ALCANCE_SEM_CLASSE")] public OrderedMap<double> AlcanceSemClasse;
    }

    public static partial class GameData
    {
        private static ClassesDeLutaData _classesDeLutaTable;

        /// <summary>hero/classes-de-luta: os números de cada classe na luta.</summary>
        public static ClassesDeLutaData ClassesDeLutaTable
        {
            get => Require(_classesDeLutaTable, "hero/classes-de-luta");
            set => _classesDeLutaTable = value;
        }
    }

    /// <summary>
    /// Os números de cada classe na luta (port de shared/src/hero/classes-de-luta.ts; doc do Breno de 2026-11-15): o
    /// alcance do ataque comum em blocos (só a arena usa), a vida em % (vale em todo lugar, dentro de
    /// <see cref="Derived.Compute"/>), e o dano e a velocidade de andar em % (só a arena).
    /// </summary>
    public static class ClassesDeLuta
    {
        private static ClassesDeLutaData D => GameData.ClassesDeLutaTable;

        /// <summary>TS: classeDeLuta — os números da classe; sem classe (ou uma que a tabela não traz), os do padrão.</summary>
        public static ClasseDeLuta De(string classId, string className)
        {
            var id = Catalog.IdDaClasse(classId, className);
            if (Js.Truthy(id) && D.Classes.TryGet(id, out var classe) && classe != null) return classe;
            return D.ClassePadrao;
        }

        public static ClasseDeLuta De(Hero hero) => De(hero.ClassId, hero.ClassName);

        /// <summary>TS: alcanceDoHeroi — em blocos: o da classe, o da arma pesada no Bárbaro, o da arma sem classe.</summary>
        public static double AlcanceDoHeroi(string classId, string className, string arma)
        {
            var id = Catalog.IdDaClasse(classId, className);
            arma = arma ?? "";
            if (id == "barbaro")
                return D.AlcanceDoBarbaro.TryGet(arma, out var pesada) ? pesada : D.Classes.Get("barbaro").Alcance;
            if (!Js.Truthy(id) || !D.Classes.TryGet(id, out var classe) || classe == null)
                return D.AlcanceSemClasse.TryGet(arma, out var semClasse) ? semClasse : D.ClassePadrao.Alcance;
            return classe.Alcance;
        }

        public static double AlcanceDoHeroi(Hero hero) => AlcanceDoHeroi(hero.ClassId, hero.ClassName, hero.Equip?.Get("arma")?.TemplateId);

        /// <summary>TS: vidaComAClasse — a vida de sempre vezes a % da classe, arredondada.</summary>
        public static double VidaComAClasse(double vida, string classId, string className)
        {
            double pct = De(classId, className).Vida;
            return pct == 100 ? vida : Js.Round(vida * pct / 100);
        }
    }
}
