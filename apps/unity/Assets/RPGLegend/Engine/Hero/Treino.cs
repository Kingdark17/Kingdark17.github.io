using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>As tabelas de hero/treino.ts (fixtures/data/hero/treino.json).</summary>
    public sealed class TreinoData
    {
        [JsName("ATRIBUTOS_DE_USO")] public List<string> AtributosDeUso = new List<string>();
        [JsName("PONTOS_POR_NIVEL")] public double PontosPorNivel;
        [JsName("XP_DO_PONTO_GUARDADO")] public double XpDoPontoGuardado;
        [JsName("PONTOS_CONVERTIDOS_POR_ABATE")] public double PontosConvertidosPorAbate;
        [JsName("USOS_POR_NIVEL_DA_HABILIDADE")] public List<double> UsosPorNivelDaHabilidade = new List<double>();
        [JsName("EFEITO_POR_NIVEL_DA_HABILIDADE")] public double EfeitoPorNivelDaHabilidade;
        [JsName("MANA_POR_NIVEL_DA_HABILIDADE")] public double ManaPorNivelDaHabilidade;
        [JsName("ICONES")] public OrderedMap<string> Icones = new OrderedMap<string>();
        [JsName("NOMES")] public OrderedMap<string> Nomes = new OrderedMap<string>();
    }

    public static partial class GameData
    {
        private static TreinoData _treinoTable;

        /// <summary>hero/treino: os números dos atributos e das habilidades pelo uso.</summary>
        public static TreinoData TreinoTable
        {
            get => Require(_treinoTable, "hero/treino");
            set => _treinoTable = value;
        }
    }

    /// <summary>TS: ResultadoDoTreino — o herói e o que se diz no registro.</summary>
    public sealed class ResultadoDoTreino
    {
        public Hero Hero;
        public List<string> Log = new List<string>();
    }

    /// <summary>TS: o que usarHabilidade e treinarPoder devolvem. Subiu: o nível novo, ou null.</summary>
    public sealed class HabilidadeUsada
    {
        public Hero Hero;
        public double? Subiu;
    }

    /// <summary>
    /// Atributos e habilidades que sobem pelo uso (port de shared/src/hero/treino.ts; doc do Breno de 2026-11-10).
    /// Cada ação anota um uso no atributo dela; o XP de cada abate se reparte pelos usos e vira progresso; um ponto
    /// custa uma fração do XP do nível. A Constituição sobe 1 por nível (Heroes.GainXP). Os pontos guardados de antes
    /// viram XP aos poucos. Cada poder conta os próprios usos, e o nível dele dá mais efeito e poupa mana.
    /// </summary>
    public static class Treino
    {
        private static TreinoData D => GameData.TreinoTable;

        public static IReadOnlyList<string> AtributosDeUso => D.AtributosDeUso;

        /// <summary>O atributo sobe pelo uso (a Constituição sobe com o nível).</summary>
        public static bool EhDeUso(string chave) => D.AtributosDeUso.Contains(chave);

        /// <summary>TS: custoDoPonto — o XP de treino que o próximo ponto custa, pro personagem deste nível.</summary>
        public static double CustoDoPonto(double nivel) => Math.Max(1, Js.Round(Derived.XpForLevel(nivel) / D.PontosPorNivel));

        private static OrderedMap<double> Copia(OrderedMap<double> mapa)
        {
            var copia = new OrderedMap<double>();
            mapa?.CopyTo(copia);
            return copia;
        }

        private static double De(OrderedMap<double> mapa, string chave) => mapa != null && mapa.TryGet(chave, out var v) ? v : 0;

        /// <summary>TS: anotarUso — anota um uso do atributo; a Constituição não é de uso.</summary>
        public static Hero AnotarUso(Hero hero, string chave, double quantos = 1)
        {
            if (!D.AtributosDeUso.Contains(chave) || quantos <= 0) return hero;
            var usos = Copia(hero.UsosDeAtributo);
            usos.Set(chave, De(hero.UsosDeAtributo, chave) + quantos);
            var next = hero.Clone();
            next.UsosDeAtributo = usos;
            return next;
        }

        /// <summary>TS: treinarComXp — o XP de um abate treina os atributos usados desde o anterior, e zera a anotação.</summary>
        public static ResultadoDoTreino TreinarComXp(Hero hero, double xp)
        {
            var usados = new List<string>();
            double total = 0;
            foreach (var chave in D.AtributosDeUso)
            {
                if (De(hero.UsosDeAtributo, chave) > 0)
                {
                    usados.Add(chave);
                    total += De(hero.UsosDeAtributo, chave);
                }
            }
            if (usados.Count == 0 || !(xp > 0))
            {
                if (hero.UsosDeAtributo == null) return new ResultadoDoTreino { Hero = hero };
                var zerado = hero.Clone();
                zerado.UsosDeAtributo = new OrderedMap<double>();
                return new ResultadoDoTreino { Hero = zerado };
            }

            double custo = CustoDoPonto(hero.Level);
            var attrs = hero.Attrs.Clone();
            var treino = Copia(hero.Treino);
            var log = new List<string>();
            foreach (var chave in usados)
            {
                double progresso = De(treino, chave) + xp * De(hero.UsosDeAtributo, chave) / total;
                double subiu = 0;
                while (progresso >= custo && attrs[chave] < Heroes.AtributoMaximo)
                {
                    progresso -= custo;
                    attrs[chave] += 1;
                    subiu++;
                }
                if (attrs[chave] >= Heroes.AtributoMaximo) treino.Remove(chave);
                else treino.Set(chave, progresso);
                if (subiu > 0) log.Add(D.Icones.Get(chave) + " " + D.Nomes.Get(chave) + " subiu para " + Js.NumberToString(attrs[chave]) + "!");
            }
            var treinado = hero.Clone();
            treinado.Attrs = attrs;
            treinado.Treino = treino;
            treinado.UsosDeAtributo = new OrderedMap<double>();
            return new ResultadoDoTreino { Hero = log.Count > 0 ? Heroes.RecomputeDerived(treinado) : treinado, Log = log };
        }

        /// <summary>TS: progressoDoTreino — quanto do próximo ponto já foi treinado, de 0 a 1.</summary>
        public static double ProgressoDoTreino(Hero hero, string chave)
        {
            if (!D.AtributosDeUso.Contains(chave) || hero.Attrs[chave] >= Heroes.AtributoMaximo) return 0;
            return Math.Max(0, Math.Min(1, De(hero.Treino, chave) / CustoDoPonto(hero.Level)));
        }

        /// <summary>TS: converterPontosGuardados — os pontos por distribuir de antes viram XP do personagem, alguns por abate.</summary>
        public static ResultadoDoTreino ConverterPontosGuardados(Hero hero)
        {
            double guardados = Math.Floor(Js.Truthy(hero.AttrPoints) ? hero.AttrPoints.Value : 0);
            if (guardados <= 0) return new ResultadoDoTreino { Hero = hero };
            double pontos = Math.Min(guardados, D.PontosConvertidosPorAbate);
            double xp = Js.Round(Derived.XpForLevel(hero.Level) * D.XpDoPontoGuardado) * pontos;
            var sem = hero.Clone();
            sem.AttrPoints = guardados - pontos;
            var ganho = Heroes.GainXP(sem, xp);
            var log = new List<string>
            {
                "🎓 " + Js.NumberToString(pontos) + " " + (pontos == 1 ? "ponto guardado virou" : "pontos guardados viraram") + " " + Js.NumberToString(xp) + " de XP.",
            };
            if (ganho.LeveledUp) log.Add("Você subiu " + Js.NumberToString(ganho.Levels) + " nível(is)!");
            return new ResultadoDoTreino { Hero = ganho.Hero, Log = log };
        }

        /// <summary>TS: atributoDoGolpe — o tiro (e todo golpe de arco) é Destreza, o mágico é Inteligência, o resto é Força.</summary>
        public static string AtributoDoGolpe(Hero hero, string estilo)
        {
            if (estilo == "magic") return "intelecto";
            if (estilo == "ranged" || hero.Equip?.Get("arma")?.TemplateId == "arco") return "destreza";
            return "forca";
        }

        /// <summary>TS: atributoDoPoder — dano físico é Força; dano mágico e invocação, Inteligência; cura e apoio, Sabedoria.</summary>
        public static string AtributoDoPoder(string tipo)
        {
            if (tipo == "dano_fisico") return "forca";
            if (tipo == "dano_magico" || tipo == "invocar") return "intelecto";
            return "sabedoria";
        }

        /// <summary>TS: treinarPoder — anota o uso no atributo do poder e conta o uso da habilidade.</summary>
        public static HabilidadeUsada TreinarPoder(Hero hero, string id, string tipo) => UsarHabilidade(AnotarUso(hero, AtributoDoPoder(tipo)), id);

        /// <summary>TS: textoDaHabilidade — a linha do registro quando um poder passa de nível.</summary>
        public static string TextoDaHabilidade(string nome, double nivel) => "⭐ " + nome + " subiu para o nível " + Js.NumberToString(nivel) + "!";

        // ---------- habilidades ----------

        private static double NivelPelosUsos(OrderedMap<double> usosDePoder, string poder)
        {
            double usos = string.IsNullOrEmpty(poder) ? 0 : De(usosDePoder, poder);
            if (double.IsNaN(usos)) usos = 0;
            double nivel = 1;
            foreach (var marco in D.UsosPorNivelDaHabilidade)
                if (usos >= marco) nivel++;
            return nivel;
        }

        /// <summary>TS: nivelDaHabilidade — o nível de um poder (1 a 10), pelos usos dele.</summary>
        public static double NivelDaHabilidade(Hero hero, string poder) => NivelPelosUsos(hero.UsosDePoder, poder);

        /// <summary>TS: efeitoDaHabilidade — por quanto o nível do poder multiplica o dano e a cura dele.</summary>
        public static double EfeitoDaHabilidade(Hero hero, string poder) => 1 + D.EfeitoPorNivelDaHabilidade * (NivelDaHabilidade(hero, poder) - 1);

        /// <summary>TS: descontoDaHabilidade — a fração da mana que o nível do poder poupa.</summary>
        public static double DescontoDaHabilidade(Hero hero, string poder) => D.ManaPorNivelDaHabilidade * (NivelDaHabilidade(hero, poder) - 1);

        /// <summary>TS: usosAteOProximoNivel — quantos usos faltam pro poder passar de nível (0 no último).</summary>
        public static double UsosAteOProximoNivel(Hero hero, string poder)
        {
            double usos = De(hero.UsosDePoder, poder);
            foreach (var marco in D.UsosPorNivelDaHabilidade)
                if (usos < marco) return marco - usos;
            return 0;
        }

        /// <summary>TS: usarHabilidade — conta um uso do poder; Subiu é o nível novo, se passou de nível com este uso.</summary>
        public static HabilidadeUsada UsarHabilidade(Hero hero, string poder)
        {
            double antes = NivelDaHabilidade(hero, poder);
            var usos = Copia(hero.UsosDePoder);
            usos.Set(poder, De(hero.UsosDePoder, poder) + 1);
            double depois = NivelPelosUsos(usos, poder);
            var next = hero.Clone();
            next.UsosDePoder = usos;
            return new HabilidadeUsada { Hero = next, Subiu = depois > antes ? depois : (double?)null };
        }
    }
}
