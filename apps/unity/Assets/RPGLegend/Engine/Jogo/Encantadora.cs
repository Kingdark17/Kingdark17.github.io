using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Encantadora — a sala da Encantadora aberta.</summary>
    public sealed class Encantadora
    {
        public EstadoDoJogo Estado;
        public List<string> Log;
    }

    /// <summary>
    /// Port de shared/src/jogo/encantadora.ts: a sala da cidade que fortifica armaduras (só o app abre a porta dela).
    /// As regras das fortificações estão em <see cref="Encantamentos"/>.
    /// </summary>
    public static class Encantadoras
    {
        /// <summary>TS: abrirEncantadora.</summary>
        public static Encantadora AbrirEncantadora(EstadoDoJogo estado) => new Encantadora { Estado = estado, Log = new List<string>() };

        /// <summary>TS: pecasParaEncantar — as armaduras vestidas, na ordem dos slots, e depois as guardadas na mochila.</summary>
        public static List<Item> PecasParaEncantar(EstadoDoJogo estado)
        {
            var pecas = new List<Item>();
            foreach (var slot in StatKeys.EquipSlots)
            {
                var peca = estado.Hero.Equip?.Get(slot);
                if (peca != null && Encantamentos.PodeEncantar(peca)) pecas.Add(peca);
            }
            foreach (var item in estado.Inventory)
                if (!item.Equipped && Encantamentos.PodeEncantar(item)) pecas.Add(item);
            return pecas;
        }

        /// <summary>
        /// TS: encantar — fortifica a peça com o tipo e o nível pedidos, cobrando o preço do nível; a fortificação que
        /// ela tinha se desfaz. Sem ouro, com a mesma fortificação que a peça já tem, ou com uma peça que não é armadura,
        /// nada muda e o log diz por quê. Uma peça que não está com o herói é ignorada.
        /// </summary>
        public static Encantadora Encantar(Encantadora encantadora, Item peca, string tipo, double nivel)
        {
            var estado = encantadora.Estado;
            if (!Mochilas.TemPeca(estado, peca)) return encantadora;
            var encantada = Encantamentos.EncantarPeca(peca, tipo, nivel);
            if (encantada?.Encantamento == null) return ComLog(encantadora, "A Encantadora só fortifica armaduras.");

            var nova = encantada.Encantamento;
            var antes = peca.Encantamento;
            if (antes != null && antes.Tipo == nova.Tipo && antes.Nivel == nova.Nivel)
                return ComLog(encantadora, Items.DisplayName(peca) + " já tem " + Encantamentos.NomeDoEncantamento(nova) + ".");
            double custo = Encantamentos.CustoDoEncantamento(nova.Nivel);
            if (estado.Hero.Gold < custo) return ComLog(encantadora, "Faltam " + Js.NumberToString(custo - estado.Hero.Gold) + " de ouro.");

            var pago = estado.Clone();
            var heroi = estado.Hero.Clone();
            heroi.Gold = estado.Hero.Gold - custo;
            pago.Hero = heroi;
            string troca = antes != null ? " (" + Encantamentos.NomeDoEncantamento(antes) + " se desfaz)" : "";
            return new Encantadora
            {
                Estado = Mochilas.ComPecaTrocada(pago, encantada),
                Log = new List<string> { "A Encantadora fortifica " + Items.DisplayName(peca) + " com " + Encantamentos.NomeDoEncantamento(nova) + troca + "." },
            };
        }

        private static Encantadora ComLog(Encantadora encantadora, string linha) =>
            new Encantadora { Estado = encantadora.Estado, Log = new List<string> { linha } };
    }
}
