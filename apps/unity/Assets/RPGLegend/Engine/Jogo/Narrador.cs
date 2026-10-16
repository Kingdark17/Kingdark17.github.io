using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Narracao — a descrição da sala onde o herói está parado.</summary>
    public sealed class Narracao
    {
        /// <summary>Frase de ambiente, estável por sala.</summary>
        public string Ambiente;
        /// <summary>O que há nesta sala (pode ser vazio).</summary>
        public string Conteudo;
        /// <summary>Uma pista por ponto cardeal, na ordem de DIR_ORDER.</summary>
        public List<string> Portas;
    }

    /// <summary>As tabelas de jogo/narrador.ts (fixtures/data/jogo/narrador.json; as duas são privadas).</summary>
    public sealed class NarradorData
    {
        [JsName("AMBIENTE_DA_CIDADE")] public List<string> AmbienteDaCidade = new List<string>();
        [JsName("AMBIENTE_DA_MASMORRA")] public List<string> AmbienteDaMasmorra = new List<string>();
    }

    public static partial class GameData
    {
        private static NarradorData _narradorTable;

        /// <summary>jogo/narrador: as frases de ambiente.</summary>
        public static NarradorData NarradorTable
        {
            get => Require(_narradorTable, "jogo/narrador");
            set => _narradorTable = value;
        }
    }

    /// <summary>
    /// Port de shared/src/jogo/narrador.ts: a frase de ambiente, o que há na sala e uma pista por porta. A frase
    /// sai de uma semente da própria sala, então a mesma sala tem sempre a mesma frase.
    /// </summary>
    public static class Narrador
    {
        private static NarradorData D => GameData.NarradorTable;

        /// <summary>TS: narrar — null quando o herói não está numa sala da grade.</summary>
        public static Narracao Narrar(EstadoDoJogo estado)
        {
            var aqui = Estados.CelulaAtual(estado);
            if (aqui == null) return null;

            var visual = Apresentacoes.ApresentacaoDe(estado);
            var portas = new List<string>();
            foreach (var direcao in Directions.Order) portas.Add(PistaDaPorta(estado, direcao, visual.Rotulo));
            return new Narracao { Ambiente = AmbienteDe(estado, aqui), Conteudo = visual.Descricao(aqui), Portas = portas };
        }

        /// <summary>TS: ambienteDe — os multiplicadores são primos grandes, pra salas vizinhas não rimarem.</summary>
        private static string AmbienteDe(EstadoDoJogo estado, RoomCell celula)
        {
            bool cidade = estado.MapMode == "city";
            double semente = celula.X * 73856093 + celula.Y * 19349663 + estado.Floor * 83492791 + (cidade ? 0 : 1);
            return Rng.Pick(cidade ? D.AmbienteDaCidade : D.AmbienteDaMasmorra, Rng.SeededRng(semente));
        }

        /// <summary>TS: pistaDaPorta — só descreve o que o jogador já conhece.</summary>
        private static string PistaDaPorta(EstadoDoJogo estado, string direcao, Func<RoomCell, string> rotulo)
        {
            var nome = Directions.Labels.Get(direcao);
            var destino = Estados.VizinhaEm(estado, direcao);
            if (destino == null) return nome + ": parede.";

            var alvo = Estados.CelulaEm(estado, destino);
            if (alvo == null) return nome + ": parede.";
            if (!(alvo.Visited ?? false) && !(alvo.Revealed ?? false)) return nome + ": porta fechada.";

            return nome + ": " + rotulo(alvo) + ".";
        }
    }
}
