using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: ResultadoDaArmadilha.</summary>
    public sealed class ResultadoDaArmadilha
    {
        public EstadoNaMasmorra Estado;
        public Aviso Aviso;
    }

    /// <summary>
    /// Pisar numa armadilha (port de shared/src/jogo/armadilhas.ts): o dano (que nunca mata: para em 1), o
    /// sangramento e o veneno, a chance de quebrar um membro, e a armadilha que fica à vista.
    /// </summary>
    public static class ArmadilhasDoJogo
    {
        /// <summary>TS: pisarNaArmadilha — null se a armadilha não existe ou já disparou.</summary>
        public static ResultadoDaArmadilha PisarNaArmadilha(EstadoNaMasmorra estado, int indice, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            var sala = Estados.CelulaAtual(estado) as DungeonCell;
            var lista = sala?.Armadilhas;
            if (sala == null || lista == null || indice < 0 || indice >= lista.Count || lista[indice].Disparada == true) return null;
            var armadilha = lista[indice];
            var def = Armadilhas.Def(armadilha.Tipo);

            double dano = Js.Min(Js.Max(1, Js.Round(estado.Hero.MaxHp * def.Dano)), Js.Max(0, estado.Hero.Hp - 1));
            var ferido = estado.Hero.Clone();
            ferido.Hp = estado.Hero.Hp - dano;
            var hero = FerimentosDoHeroi.Envenenar(ferido, def.Veneno, def.Sangramento);
            var textos = new List<string> { def.Nome + "! Você perde " + Js.NumberToString(dano) + " de vida." };
            if (Js.Truthy(def.Sangramento)) textos.Add("O corte sangra por " + Js.NumberToString(def.Sangramento.Value) + " salas.");
            if (Js.Truthy(def.Veneno)) textos.Add("O veneno corre por " + Js.NumberToString(def.Veneno.Value) + " salas.");
            if (Js.Truthy(def.Quebra) && rng() < def.Quebra.Value)
            {
                var quebra = FerimentosDoHeroi.QuebrarMembro(hero, rng);
                hero = quebra.Hero;
                textos.Add("As pedras quebram " + FerimentosDoHeroi.NomeDoMembro(quebra.Membro) + ". Uma tala ou uma noite na taverna resolvem.");
            }

            var armadilhas = new List<Armadilha>();
            for (int i = 0; i < lista.Count; i++)
            {
                if (i != indice)
                {
                    armadilhas.Add(lista[i]);
                    continue;
                }
                var disparada = lista[i].Clone();
                disparada.Disparada = true;
                armadilhas.Add(disparada);
            }
            var comHeroi = estado.Clone();
            comHeroi.Hero = hero;
            var novaSala = sala.Clone();
            novaSala.Armadilhas = armadilhas;
            return new ResultadoDaArmadilha
            {
                Estado = Estados.SubstituirCelulaAtual(comHeroi, novaSala),
                Aviso = new Aviso(def.Icone, "Armadilha", string.Join(" ", textos)),
            };
        }
    }
}
