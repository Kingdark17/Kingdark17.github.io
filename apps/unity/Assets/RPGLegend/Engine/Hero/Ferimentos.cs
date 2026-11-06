using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>
    /// TS: Ferimentos — o membro quebrado e o que tira vida de sala em sala. Todos opcionais: null = ausente. Moram no
    /// herói (<see cref="Hero.Ferimentos"/>); ausentes, ele está inteiro.
    /// </summary>
    public sealed class Ferimentos
    {
        public bool? Braco;
        public bool? Perna;
        /// <summary>Salas que ainda faltam de veneno.</summary>
        public double? Veneno;
        /// <summary>Salas que ainda faltam de sangramento.</summary>
        public double? Sangramento;

        public Ferimentos Clone() => (Ferimentos)MemberwiseClone();

        internal bool Vazio => Braco == null && Perna == null && Veneno == null && Sangramento == null;
    }

    /// <summary>As tabelas de hero/ferimentos.ts (fixtures/data/hero/ferimentos.json).</summary>
    public sealed class FerimentosData
    {
        [JsName("DANO_COM_BRACO_QUEBRADO")] public double DanoComBracoQuebrado;
        [JsName("PASSO_COM_PERNA_QUEBRADA")] public double PassoComPernaQuebrada;
        [JsName("FUGA_COM_PERNA_QUEBRADA")] public double FugaComPernaQuebrada;
        [JsName("VENENO_POR_SALA")] public double VenenoPorSala;
        [JsName("SANGRAMENTO_POR_SALA")] public double SangramentoPorSala;
        [JsName("CHANCE_DE_QUEBRAR_NO_CHEFE")] public double ChanceDeQuebrarNoChefe;
    }

    public static partial class GameData
    {
        private static FerimentosData _ferimentosTable;

        /// <summary>hero/ferimentos: os números dos ferimentos.</summary>
        public static FerimentosData FerimentosTable
        {
            get => Require(_ferimentosTable, "hero/ferimentos");
            set => _ferimentosTable = value;
        }
    }

    /// <summary>TS: o que quebrarMembro devolve.</summary>
    public sealed class MembroQuebrado
    {
        public Hero Hero;
        /// <summary>"braco" ou "perna".</summary>
        public string Membro;
    }

    /// <summary>TS: o que passarDeSala devolve.</summary>
    public sealed class SalaPassada
    {
        public Hero Hero;
        public double Dano;
    }

    /// <summary>
    /// Os ferimentos do herói (port de shared/src/hero/ferimentos.ts; doc do Breno de 2026-11-06): braço quebrado bate
    /// 30% mais fraco, perna quebrada anda mais devagar e foge pior, e o veneno e o sangramento tiram vida a cada sala.
    /// Saram na taverna (tudo) ou com a tala (os membros).
    /// </summary>
    public static class FerimentosDoHeroi
    {
        private static FerimentosData D => GameData.FerimentosTable;

        public static double DanoComBracoQuebrado => D.DanoComBracoQuebrado;
        public static double PassoComPernaQuebrada => D.PassoComPernaQuebrada;
        public static double FugaComPernaQuebrada => D.FugaComPernaQuebrada;
        public static double ChanceDeQuebrarNoChefe => D.ChanceDeQuebrarNoChefe;

        /// <summary>TS: quebrarMembro — quebra um braço ou uma perna (um número do rng); o que já está quebrado continua.</summary>
        public static MembroQuebrado QuebrarMembro(Hero hero, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            string membro = rng() < 0.5 ? "braco" : "perna";
            var ferimentos = hero.Ferimentos?.Clone() ?? new Ferimentos();
            if (membro == "braco") ferimentos.Braco = true;
            else ferimentos.Perna = true;
            var depois = hero.Clone();
            depois.Ferimentos = ferimentos;
            return new MembroQuebrado { Hero = depois, Membro = membro };
        }

        /// <summary>TS: nomeDoMembro.</summary>
        public static string NomeDoMembro(string membro) => membro == "braco" ? "um braço" : "uma perna";

        /// <summary>TS: envenenar — junta veneno e sangramento novos aos que o herói já tem: fica o mais longo.</summary>
        public static Hero Envenenar(Hero hero, double? veneno, double? sangramento)
        {
            if (!Js.Truthy(veneno) && !Js.Truthy(sangramento)) return hero;
            var atual = hero.Ferimentos;
            var ferimentos = atual?.Clone() ?? new Ferimentos();
            if (Js.Truthy(veneno)) ferimentos.Veneno = Js.Max(atual?.Veneno ?? 0, veneno.Value);
            if (Js.Truthy(sangramento)) ferimentos.Sangramento = Js.Max(atual?.Sangramento ?? 0, sangramento.Value);
            var depois = hero.Clone();
            depois.Ferimentos = ferimentos;
            return depois;
        }

        /// <summary>
        /// TS: passarDeSala — o veneno e o sangramento tiram a parte deles da vida máxima (nunca matam: param em 1) e
        /// contam uma sala a menos.
        /// </summary>
        public static SalaPassada PassarDeSala(Hero hero)
        {
            var atual = hero.Ferimentos;
            if (!Js.Truthy(atual?.Veneno) && !Js.Truthy(atual?.Sangramento)) return new SalaPassada { Hero = hero, Dano = 0 };
            double parte = (Js.Truthy(atual.Veneno) ? D.VenenoPorSala : 0) + (Js.Truthy(atual.Sangramento) ? D.SangramentoPorSala : 0);
            double dano = Js.Min(Js.Max(1, Js.Round(hero.MaxHp * parte)), Js.Max(0, hero.Hp - 1));
            var ferimentos = atual.Clone();
            if (Js.Truthy(atual.Veneno)) ferimentos.Veneno = atual.Veneno > 1 ? atual.Veneno - 1 : null;
            if (Js.Truthy(atual.Sangramento)) ferimentos.Sangramento = atual.Sangramento > 1 ? atual.Sangramento - 1 : null;
            var depois = hero.Clone();
            depois.Hp = hero.Hp - dano;
            depois.Ferimentos = ferimentos;
            return new SalaPassada { Hero = Limpo(depois), Dano = dano };
        }

        /// <summary>TS: curarMembros — a tala: conserta o braço e a perna.</summary>
        public static Hero CurarMembros(Hero hero)
        {
            if (hero.Ferimentos?.Braco != true && hero.Ferimentos?.Perna != true) return hero;
            var ferimentos = hero.Ferimentos.Clone();
            ferimentos.Braco = null;
            ferimentos.Perna = null;
            var depois = hero.Clone();
            depois.Ferimentos = ferimentos;
            return Limpo(depois);
        }

        /// <summary>TS: curarTudo — a taverna: sara tudo.</summary>
        public static Hero CurarTudo(Hero hero)
        {
            if (hero.Ferimentos == null) return hero;
            var depois = hero.Clone();
            depois.Ferimentos = null;
            return depois;
        }

        /// <summary>TS: limpo — sem ferimento nenhum, o campo sai do herói.</summary>
        private static Hero Limpo(Hero hero)
        {
            if (hero.Ferimentos != null && !hero.Ferimentos.Vazio) return hero;
            hero.Ferimentos = null;
            return hero;
        }

        /// <summary>TS: forcaDoBraco — o multiplicador do dano do herói: o braço quebrado bate mais fraco.</summary>
        public static double ForcaDoBraco(Hero hero) => hero.Ferimentos?.Braco == true ? D.DanoComBracoQuebrado : 1;

        /// <summary>TS: ritmoDoAndar — o ritmo do andar na sala: a perna quebrada anda mais devagar.</summary>
        public static double RitmoDoAndar(Hero hero) => hero.Ferimentos?.Perna == true ? D.PassoComPernaQuebrada : 1;

        /// <summary>TS: textosDosFerimentos — os ferimentos em palavras, pro cartão do herói.</summary>
        public static List<string> TextosDosFerimentos(Hero hero)
        {
            var f = hero.Ferimentos;
            var textos = new List<string>();
            if (f == null) return textos;
            if (f.Braco == true) textos.Add("🦴 Braço quebrado");
            if (f.Perna == true) textos.Add("🦵 Perna quebrada");
            if (Js.Truthy(f.Veneno)) textos.Add("☠️ Envenenado (" + Js.NumberToString(f.Veneno.Value) + " " + (f.Veneno == 1 ? "sala" : "salas") + ")");
            if (Js.Truthy(f.Sangramento)) textos.Add("🩸 Sangrando (" + Js.NumberToString(f.Sangramento.Value) + " " + (f.Sangramento == 1 ? "sala" : "salas") + ")");
            return textos;
        }
    }
}
