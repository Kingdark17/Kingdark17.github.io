using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: o retorno de gastarPocaoDeReviver — o estado sem a poção e a força com que o parceiro levanta.</summary>
    public sealed class PocaoGasta
    {
        public EstadoDoJogo Estado;
        public double Porcento;
    }

    /// <summary>
    /// TS: jogo/dupla.ts — o que a dupla do co-op do app precisa fora da luta (2026-11-16, decisões do usuário): quem
    /// cai vira fantasma (nada o fere e ele não mexe em nada, só segue o parceiro), e só o parceiro o levanta, com a
    /// Poção de Reviver, que devolve metade da vida máxima. A luta em dupla em si mora em <see cref="Arenas"/>.
    /// </summary>
    public static class Duplas
    {
        /// <summary>TS: ehFantasma — sem vida numa partida em dupla: um fantasma até o parceiro o reviver.</summary>
        public static bool EhFantasma(Hero hero) => hero.Hp <= 0;

        /// <summary>TS: pocaoDeReviver — a primeira poção com o efeito "reviver" na mochila, ou null.</summary>
        public static Item PocaoDeReviver(IReadOnlyList<Item> inventory)
        {
            foreach (var item in inventory)
                if (Js.Truthy(item.Stats?.Get("reviver"))) return item;
            return null;
        }

        /// <summary>TS: forcaDaPocao — quanto da vida máxima a poção devolve, em %.</summary>
        public static double ForcaDaPocao(Item item) => Js.Max(1, Js.Min(100, Math.Truncate(item.Stats?.Get("reviver") ?? 0)));

        /// <summary>TS: gastarPocaoDeReviver — gasta uma poção pra levantar o parceiro; null sem poção.</summary>
        public static PocaoGasta GastarPocaoDeReviver(EstadoDoJogo estado)
        {
            var pocao = PocaoDeReviver(estado.Inventory);
            if (pocao == null) return null;
            var sem = estado.Clone();
            sem.Inventory = estado.Inventory.FindAll(item => item.Uid != pocao.Uid);
            return new PocaoGasta { Estado = sem, Porcento = ForcaDaPocao(pocao) };
        }

        /// <summary>TS: reviver — levanta o caído com <paramref name="porcento"/> da vida máxima (pelo menos 1).</summary>
        public static Hero Reviver(Hero hero, double porcento)
        {
            if (hero.Hp > 0) return hero;
            double pct = Js.Max(1, Js.Min(100, Math.Truncate(porcento)));
            var levantado = hero.Clone();
            levantado.Hp = Js.Max(1, Math.Floor(hero.MaxHp * pct / 100));
            return levantado;
        }

        /// <summary>TS: levantarSozinho — o parceiro foi embora: o fantasma se levanta por um fio, pra não ficar preso.</summary>
        public static Hero LevantarSozinho(Hero hero)
        {
            if (hero.Hp > 0) return hero;
            var levantado = hero.Clone();
            levantado.Hp = 1;
            return levantado;
        }
    }
}
