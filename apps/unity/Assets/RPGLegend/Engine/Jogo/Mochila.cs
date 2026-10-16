using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: Mochila — o estado com a mochila aberta e o que ela escreveu.</summary>
    public sealed class Mochila
    {
        public EstadoDoJogo Estado;
        public List<string> Log;
    }

    /// <summary>
    /// Port de shared/src/jogo/mochila.ts: equipar, desequipar, beber poção, descartar e gastar os pontos de
    /// atributo. As regras estão em <see cref="Heroes"/> e <see cref="Inventory"/>; aqui mora a costura com o
    /// save. O <c>equipped</c> de cada item é derivado dos slots do herói, recalculado depois de cada troca.
    /// </summary>
    public static class Mochilas
    {
        private static readonly string[] NaoVai = { "não vai", "não vai", "não vão", "não vão" };

        private static Mochila ComLog(EstadoDoJogo estado, string linha) => new Mochila { Estado = estado, Log = new List<string> { linha } };

        /// <summary>TS: abrirMochila.</summary>
        public static Mochila AbrirMochila(EstadoDoJogo estado) => new Mochila { Estado = ComEquipadosEmDia(estado), Log = new List<string>() };

        /// <summary>TS: podeEquipar — só arma, armadura e acessório vão pra um slot.</summary>
        public static bool PodeEquipar(Item item)
        {
            var categoria = Items.CategoryOf(item);
            return categoria == "arma" || categoria == "armadura" || categoria == "acessorio";
        }

        /// <summary>TS: podeUsar — consumível que cura Vida ou Mana.</summary>
        public static bool PodeUsar(Item item) =>
            Items.CategoryOf(item) == "consumivel" && (Js.Truthy(item.Stats?.Get("cura")) || Js.Truthy(item.Stats?.Get("curaMana")));

        /// <summary>TS: slotDoItem.</summary>
        public static string SlotDoItem(EstadoDoJogo estado, Item item) => Heroes.EquippedSlot(estado.Hero, item);

        /// <summary>TS: equipar — recusa com o motivo certo (a arma que ocupa as duas mãos, ou o espaço errado).</summary>
        public static Mochila Equipar(Mochila mochila, Item item, string slot = null)
        {
            var naMaoAntes = mochila.Estado.Hero.Equip;
            var resultado = Heroes.EquipItem(mochila.Estado.Hero, item, slot);
            if (!resultado.Equipped)
            {
                var recusa = resultado.Reason == EquipFailReasons.TwoHandedWeapon
                    ? "Suas duas mãos estão ocupadas com " + Items.DisplayName(naMaoAntes.Get("arma")) + "."
                    : Items.DisplayName(item) + " " + Items.Concordar(item, NaoVai) + " nesse espaço.";
                return ComLog(mochila.Estado, recusa);
            }

            var destino = Heroes.EquippedSlot(resultado.Hero, item);
            var log = new List<string> { "Você equipa " + Items.DisplayName(item) + (destino == "secundaria" ? " na mão secundária" : "") + "." };

            // Arma de duas mãos esvazia a secundária: avisar, senão o escudo some da ficha sem explicação.
            var largado = naMaoAntes.Get("secundaria");
            if (destino == "arma" && largado != null && Heroes.EquippedSlot(resultado.Hero, largado) == null)
                log.Add(Items.DisplayName(largado) + " volta para a mochila: essa arma ocupa as duas mãos.");

            return new Mochila { Estado = TrocaDeEquipamento(mochila.Estado, resultado.Hero), Log = log };
        }

        /// <summary>TS: desequipar — slot vazio devolve a mesma mochila.</summary>
        public static Mochila Desequipar(Mochila mochila, string slot)
        {
            var peca = mochila.Estado.Hero.Equip.Get(slot);
            if (peca == null) return mochila;
            return ComLog(TrocaDeEquipamento(mochila.Estado, Heroes.UnequipItem(mochila.Estado.Hero, slot)), "Você guarda " + Items.DisplayName(peca) + ".");
        }

        /// <summary>TS: usar — bebe a poção e diz o que recuperou.</summary>
        public static Mochila Usar(Mochila mochila, Item item)
        {
            var resultado = Inventory.ConsumeItem(mochila.Estado.Hero, mochila.Estado.Inventory, item);
            if (resultado.Outcome.Kind == ConsumeItemOutcome.KindNoEffect) return ComLog(mochila.Estado, Items.DisplayName(item) + " não faz nada agora.");

            double vida = resultado.Outcome.HpGained ?? 0;
            double mana = resultado.Outcome.MpGained ?? 0;
            var partes = new List<string>();
            if (vida > 0) partes.Add(Js.NumberToString(vida) + " de Vida");
            if (mana > 0) partes.Add(Js.NumberToString(mana) + " de Mana");

            var estado = mochila.Estado.Clone();
            estado.Hero = resultado.Hero;
            estado.Inventory = resultado.Inventory;
            return ComLog(estado, partes.Count > 0
                ? "Você usa " + Items.DisplayName(item) + " e recupera " + string.Join(" e ", partes) + "."
                : "Você usa " + Items.DisplayName(item) + ".");
        }

        /// <summary>TS: aceitaMaoSecundaria — só escudo e arma leve.</summary>
        public static bool AceitaMaoSecundaria(Item item) =>
            item.TemplateId == "escudo" || (Items.CategoryOf(item) == "arma" && Heroes.IsOffhandEligible(item));

        /// <summary>
        /// TS: armaQueOcupaAsMaos — a arma de duas mãos que impede esta peça de ir pra mão secundária, ou null
        /// (a peça não vai pra lá, já está vestida, ou a mão principal não ocupa as duas).
        /// </summary>
        public static Item ArmaQueOcupaAsMaos(EstadoDoJogo estado, Item item)
        {
            if (Heroes.EquippedSlot(estado.Hero, item) != null) return null;
            if (!AceitaMaoSecundaria(item)) return null;
            var arma = estado.Hero.Equip.Get("arma");
            return Heroes.IsTwoHanded(arma) ? arma : null;
        }

        /// <summary>TS: equiparNoLugarDaArma — guarda a arma de duas mãos e põe a peça na secundária.</summary>
        public static Mochila EquiparNoLugarDaArma(Mochila mochila, Item item)
        {
            var arma = ArmaQueOcupaAsMaos(mochila.Estado, item);
            if (arma == null) return Equipar(mochila, item, "secundaria");

            var resultado = Heroes.EquipItem(Heroes.UnequipItem(mochila.Estado.Hero, "arma"), item, "secundaria");
            if (!resultado.Equipped) return ComLog(mochila.Estado, Items.DisplayName(item) + " não vai nesse espaço.");

            return ComLog(TrocaDeEquipamento(mochila.Estado, resultado.Hero),
                "Você guarda " + Items.DisplayName(arma) + " e equipa " + Items.DisplayName(item) + " na mão secundária.");
        }

        /// <summary>TS: descartar — tira do slot antes de tirar da mochila. Peça que não está na mochila: a mesma.</summary>
        public static Mochila Descartar(Mochila mochila, Item item)
        {
            var resultado = Inventory.RemoveByUid(mochila.Estado.Inventory, item.Uid);
            if (resultado.Removed == null) return mochila;

            var slot = Heroes.EquippedSlot(mochila.Estado.Hero, item);
            var estado = mochila.Estado.Clone();
            estado.Hero = slot != null ? Heroes.UnequipItem(mochila.Estado.Hero, slot) : mochila.Estado.Hero;
            estado.Inventory = resultado.Inventory;
            return ComLog(estado, "Você descarta " + Items.DisplayName(item) + ".");
        }

        /// <summary>TS: gastarPonto — level up é manual, um ponto por vez.</summary>
        public static Mochila GastarPonto(Mochila mochila, string chave)
        {
            var hero = Heroes.SpendAttrPoint(mochila.Estado.Hero, chave);
            if (ReferenceEquals(hero, mochila.Estado.Hero)) return ComLog(mochila.Estado, "Você não tem pontos para distribuir.");

            var estado = mochila.Estado.Clone();
            estado.Hero = hero;
            return new Mochila { Estado = estado, Log = new List<string>() };
        }

        /// <summary>
        /// TS: trocaDeEquipamento — recolhe pra mochila o que saiu do slot (a arma inicial nasce só no slot) e
        /// recalcula o equipped de todo mundo.
        /// </summary>
        private static EstadoDoJogo TrocaDeEquipamento(EstadoDoJogo antes, Hero hero)
        {
            var inventory = antes.Inventory;
            foreach (var slot in StatKeys.EquipSlots)
            {
                var saiu = antes.Hero.Equip.Get(slot);
                if (saiu == null || Heroes.EquippedSlot(hero, saiu) != null) continue;
                if (inventory.Exists(guardado => guardado.Uid == saiu.Uid)) continue;
                inventory = Inventory.AddItem(inventory, saiu);
            }

            var estado = antes.Clone();
            estado.Hero = hero;
            estado.Inventory = inventory;
            return ComEquipadosEmDia(estado);
        }

        /// <summary>TS: comEquipadosEmDia — o mesmo estado quando nada mudou.</summary>
        private static EstadoDoJogo ComEquipadosEmDia(EstadoDoJogo estado)
        {
            var inventory = Sincronizar(estado.Hero, estado.Inventory);
            if (ReferenceEquals(inventory, estado.Inventory)) return estado;
            var novo = estado.Clone();
            novo.Inventory = inventory;
            return novo;
        }

        /// <summary>TS: sincronizar — a mesma lista quando nenhum item mudou de marca.</summary>
        private static List<Item> Sincronizar(Hero hero, List<Item> inventory)
        {
            bool mudou = false;
            var proximo = new List<Item>(inventory.Count);
            foreach (var item in inventory)
            {
                bool equipado = Heroes.EquippedSlot(hero, item) != null;
                if (item.Equipped == equipado)
                {
                    proximo.Add(item);
                    continue;
                }
                mudou = true;
                var marcado = item.Clone();
                marcado.Equipped = equipado;
                proximo.Add(marcado);
            }
            return mudou ? proximo : inventory;
        }
    }
}
