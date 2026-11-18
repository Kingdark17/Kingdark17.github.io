using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: PecaSecreta — uma peça que só o negociante do app vende (rodada 6).</summary>
    public sealed class PecaSecreta
    {
        public string Id;
        public List<string> Classes;
        public double Preco;
        /// <summary>A peça rara: só 1 de cada tantos negociantes a tem. Null, comum.</summary>
        public double? Raro;
    }

    /// <summary>As tabelas de items/pecas-secretas.ts (fixtures/data/items/pecas-secretas.json).</summary>
    public sealed class PecasSecretasData
    {
        [JsName("PECAS_SECRETAS")] public List<PecaSecreta> Pecas = new List<PecaSecreta>();
        [JsName("CHANCE_DO_NEGOCIANTE")] public double ChanceDoNegociante;
        [JsName("CHAPEU_DO_ESPADACHIM")] public string ChapeuDoEspadachim;
        [JsName("PRECO_DO_CHAPEU")] public double PrecoDoChapeu;
        [JsName("CHANCE_DO_CHAPEU")] public double ChanceDoChapeu;
        [JsName("RARIDADE_DAS_PECAS_SECRETAS")] public string Raridade;
        [JsName("ARMAS_DO_MONGE")] public List<string> ArmasDoMonge = new List<string>();
        [JsName("VIDA_COM_A_ARMA_DO_MONGE")] public double VidaComAArmaDoMonge;
        [JsName("REGRAS_DAS_ALJAVAS")] public RegrasDasAljavas RegrasDasAljavas;
        [JsName("ALJAVAS")] public List<string> Aljavas = new List<string>();
        [JsName("REGRAS_DAS_ARMAS_NOVAS")] public RegrasDasArmasNovas RegrasDasArmasNovas;
    }

    /// <summary>TS: REGRAS_DAS_ARMAS_NOVAS — as armas novas na luta do app (rodada 6c).</summary>
    public sealed class RegrasDasArmasNovas
    {
        public double AlcanceDoBastao;
        public double AtordoaNoChute;
        public double KiComOBastao;
        public double PassosPorCargaComOBastao;
        public double CriticoDoLeque;
        public double EmpurraoDoLeque;
        public double VelocidadeComDoisLeques;
        public double EmpurraoDaExplosaoComDoisLeques;
        public double ExplosaoComDoisLeques;
        public double AlcanceDaKusarigama;
        public double LarguraDaKusarigama;
        public double FundoDaKusarigama;
        public double EscudoComAKusarigama;
        public double AlcanceDaLanca;
        public double ChanceDaLanca;
        public double FaixaDaLanca;
        public double DanoDoGuerreiro;
        public double KiDoChapeu;
        public double RecargaDoChapeu;
        public double ForcaDoChapeu;
        public double VelocidadeDoChapeu;
        public double RaioDoChapeu;
        public double VidaDoChapeu;
    }

    /// <summary>TS: REGRAS_DAS_ALJAVAS — as aljavas na luta do app (rodada 6b).</summary>
    public sealed class RegrasDasAljavas
    {
        public double Alcance;
        public double ParalisiaACada;
        public double Paralisia;
        public double Fraqueza;
        public double GolpesFracos;
        public double IncendioACada;
        public double Incendio;
        public double IncendioPorSegundo;
        public double RaioDaExplosao;
        public double CadeiaACada;
        public double EmpurraoDaExplosao;
        public double EstourosPorInimigo;
    }

    public static partial class GameData
    {
        private static PecasSecretasData _pecasSecretasTable;

        /// <summary>items/pecas-secretas: o negociante, as peças e o chapéu.</summary>
        public static PecasSecretasData PecasSecretasTable
        {
            get => Require(_pecasSecretasTable, "items/pecas-secretas");
            set => _pecasSecretasTable = value;
        }
    }

    /// <summary>
    /// As peças secretas (port de shared/src/items/pecas-secretas.ts; rodada 6 do doc do Breno): o negociante da
    /// masmorra (só o app, depois de zerar a Floresta, pra quem tem peça da classe), o chapéu do espadachim no
    /// ferreiro do app, e a vida a mais do Monge com a arma dele (em todo lugar).
    /// </summary>
    public static class PecasSecretas
    {
        private static PecasSecretasData D => GameData.PecasSecretasTable;

        public static string ChapeuDoEspadachim => D.ChapeuDoEspadachim;
        public static double ChanceDoChapeu => D.ChanceDoChapeu;
        public static string Raridade => D.Raridade;
        public static RegrasDasAljavas RegrasDasAljavas => D.RegrasDasAljavas;
        public static RegrasDasArmasNovas RegrasDasArmasNovas => D.RegrasDasArmasNovas;

        /// <summary>TS: naMao — a peça numa das mãos.</summary>
        public static bool NaMao(string arma, string secundaria, string id) => arma == id || secundaria == id;

        /// <summary>TS: comDoisLeques — um leque em cada mão.</summary>
        public static bool ComDoisLeques(string arma, string secundaria) => arma == "leque" && secundaria == "leque";

        /// <summary>TS: comOChapeu — o chapéu do espadachim no acessório.</summary>
        public static bool ComOChapeu(string acessorio) => acessorio != null && acessorio == D.ChapeuDoEspadachim;

        /// <summary>TS: aljavaNoArco — a aljava ao lado do arco: o modelo dela, com o arco na mão e uma aljava na secundária; senão null.</summary>
        public static string AljavaNoArco(string arma, string secundaria)
        {
            if (arma != "arco") return null;
            return secundaria != null && D.Aljavas.Contains(secundaria) ? secundaria : null;
        }

        public static string AljavaNoArco(Hero hero) => AljavaNoArco(hero.Equip?.Get("arma")?.TemplateId, hero.Equip?.Get("secundaria")?.TemplateId);

        /// <summary>TS: pecaSecreta.</summary>
        public static PecaSecreta PorId(string id)
        {
            if (id == null) return null;
            foreach (var p in D.Pecas)
                if (p.Id == id) return p;
            return null;
        }

        /// <summary>TS: pecasDaClasse.</summary>
        public static List<PecaSecreta> DaClasse(string classId, string className)
        {
            var id = Catalog.IdDaClasse(classId, className);
            var lista = new List<PecaSecreta>();
            if (!Js.Truthy(id)) return lista;
            foreach (var p in D.Pecas)
                if (p.Classes.Contains(id)) lista.Add(p);
            return lista;
        }

        /// <summary>TS: chanceDoNegociante.</summary>
        public static double ChanceDoNegociante(string classId, string className) => DaClasse(classId, className).Count > 0 ? D.ChanceDoNegociante : 0;

        /// <summary>TS: sortearPecaSecreta — as raras antes, 1 vez em tantas; senão uma comum.</summary>
        public static PecaSecreta Sortear(string classId, string className, RngFn rng)
        {
            var pecas = DaClasse(classId, className);
            if (pecas.Count == 0) return null;
            foreach (var p in pecas)
                if (p.Raro != null && p.Raro.Value != 0 && rng() * p.Raro.Value < 1) return p;
            var comuns = pecas.FindAll(p => p.Raro == null || p.Raro.Value == 0);
            if (comuns.Count == 0) return null;
            return comuns[(int)Rng.RandomInt(comuns.Count, rng)];
        }

        /// <summary>TS: vidaComAArma — +50% pro Monge com o bastão, o leque ou a kusarigama numa das mãos.</summary>
        public static double VidaComAArma(double vida, string classId, string className, string arma, string secundaria)
        {
            if (Catalog.IdDaClasse(classId, className) != "monge") return vida;
            bool naMao = (arma != null && D.ArmasDoMonge.Contains(arma)) || (secundaria != null && D.ArmasDoMonge.Contains(secundaria));
            return naMao ? Js.Round(vida * (100 + D.VidaComAArmaDoMonge) / 100) : vida;
        }
    }
}
