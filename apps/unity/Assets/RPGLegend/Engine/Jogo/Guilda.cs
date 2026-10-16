using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Guilda — o Treinamento de Guilda aberto.</summary>
    public sealed class Guilda
    {
        public EstadoDoJogo Estado;
        public List<string> Log;
        /// <summary>A etapa "Treine na Guilda" fechada pelo treino de agora.</summary>
        [KeepNull] public Recado Recado;
    }

    /// <summary>
    /// Port de shared/src/jogo/guilda.ts: onde o Aprendiz escolhe a classe. A regra mora em
    /// <see cref="Heroes.TrainAtGuild"/>.
    /// </summary>
    public static class Guildas
    {
        /// <summary>TS: abrirGuilda.</summary>
        public static Guilda AbrirGuilda(EstadoDoJogo estado) => new Guilda { Estado = estado, Log = new List<string>(), Recado = null };

        /// <summary>
        /// TS: treinar — quem já tem classe não troca. É aqui que o Aprendiz fecha a etapa "Treine na Guilda".
        /// <paramref name="rng"/> e <paramref name="now"/> sorteiam o uid da arma inicial e a poção do prêmio.
        /// </summary>
        public static Guilda Treinar(Guilda guilda, ClassDef classe, RngFn rng = null, Func<double> now = null)
        {
            rng = rng ?? Rng.Default;
            var hero = guilda.Estado.Hero;
            var inventory = guilda.Estado.Inventory;
            if (Heroes.HasClass(hero))
                return new Guilda { Estado = guilda.Estado, Log = new List<string> { "Você já treinou como " + Js.Str(hero.ClassName) + "." }, Recado = null };

            var treino = Heroes.TrainAtGuild(hero, classe, rng, now);
            var poder = Catalog.PowerById(classe.SignatureId)?.Name ?? classe.SignatureId;
            var log = new List<string> { "Você treina como " + classe.Name + " e aprende " + poder + "." };
            // A arma inicial que não coube na mão vai pra mochila, e a pessoa precisa saber.
            if (treino.ToInventory != null) log.Add(Items.DisplayName(treino.ToInventory) + " vai para a mochila: sua mão já estava ocupada.");

            var treinado = guilda.Estado.Clone();
            treinado.Hero = treino.Hero;
            treinado.Inventory = treino.ToInventory != null ? Inventory.AddItem(inventory, treino.ToInventory) : inventory;
            var etapa = Tutoriais.Marcar(treinado, "guild", rng, now);
            return new Guilda { Estado = etapa.Estado, Log = log, Recado = etapa.Recado };
        }
    }
}
