namespace RPGLegend.Engine
{
    /// <summary>TS: MestreDeEstiloNaSala — o mestre da sala de agora e o estilo que ele ensina.</summary>
    public sealed class MestreDeEstiloNaSala
    {
        public EstiloDef Estilo;
        /// <summary>O herói já tem este estilo (aprendeu com outro mestre).</summary>
        public bool JaTem;
    }

    /// <summary>TS: o retorno de aprenderComMestre.</summary>
    public sealed class AprendeuComMestre
    {
        public EstadoDoJogo Estado;
        public string Texto;
    }

    /// <summary>
    /// Port de shared/src/jogo/mestre-de-estilo.ts: a sala do mestre de estilo (rodada 5a, só o app a gera; a regra
    /// mora em <see cref="Estilos"/>). Ele ensina o estilo sorteado quando o andar nasceu, e a sala vira só uma sala.
    /// </summary>
    public static class MestresDeEstilo
    {
        /// <summary>TS: abrirMestreDeEstilo — null fora da sala dele, depois de ensinar ou com estilo que não existe.</summary>
        public static MestreDeEstiloNaSala Abrir(EstadoDoJogo estado)
        {
            if (estado.MapMode != "dungeon") return null;
            var sala = Estados.CelulaAtual(estado) as DungeonCell;
            var estilo = Estilos.PorId(sala?.MestreDeEstilo?.Estilo);
            if (sala?.MestreDeEstilo == null || sala.MestreDeEstilo.Ensinado == true || estilo == null) return null;
            var tem = estado.Hero.Estilos;
            return new MestreDeEstiloNaSala { Estilo = estilo, JaTem = tem != null && tem.Contains(estilo.Id) };
        }

        /// <summary>TS: aprenderComMestre — o estilo entra pro herói (e vira o ativo), e o mestre segue caminho.</summary>
        public static AprendeuComMestre Aprender(EstadoDoJogo estado)
        {
            var mestre = Abrir(estado);
            if (mestre == null) return new AprendeuComMestre { Estado = estado, Texto = "" };
            var masmorra = (EstadoNaMasmorra)estado;
            var sala = (DungeonCell)Estados.CelulaAtual(masmorra);
            var comHeroi = masmorra.Clone();
            // A vida máxima acompanha o estilo (o Cavaleiro tem 40% a mais).
            comHeroi.Hero = Heroes.RecomputeDerived(Estilos.Aprender(masmorra.Hero, mestre.Estilo.Id));
            var novaSala = sala.Clone();
            novaSala.MestreDeEstilo = sala.MestreDeEstilo.Clone();
            novaSala.MestreDeEstilo.Ensinado = true;
            var depois = Estados.SubstituirCelulaAtual(comHeroi, novaSala);
            // O elemento do Mago é pra sempre (rodada 5c): nada de trocar na guilda.
            string texto = Estilos.EstiloUnico(masmorra.Hero.ClassId, masmorra.Hero.ClassName)
                ? "Você aprendeu o elemento " + mestre.Estilo.Nome + ". Ele é seu pra sempre."
                : "Você aprendeu o estilo " + mestre.Estilo.Nome + ". Troque o estilo ativo na guilda.";
            return new AprendeuComMestre { Estado = depois, Texto = texto };
        }
    }
}
