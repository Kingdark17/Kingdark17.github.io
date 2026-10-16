using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: DungeonExtra — baú pequeno, vaso, placa ou parede rachada numa sala.</summary>
    public sealed class DungeonExtra
    {
        /// <summary>TS: DungeonExtraKind — "chest", "pot", "sign" ou "crack".</summary>
        public string Kind;
        public double Col;
        public double Row;

        private Item _item;

        /// <summary>
        /// Baú pequeno: a poção que ele guarda, ou null de propósito quando dá ouro — o <c>item?: Item | null</c> do
        /// TS: ausente no vaso, na placa e na parede. Atribuir (mesmo null) marca <see cref="ItemSpecified"/>.
        /// </summary>
        [KeepNull]
        public Item Item
        {
            get => _item;
            set
            {
                _item = value;
                ItemSpecified = true;
            }
        }

        /// <summary>O campo <c>item</c> existe no extra (mesmo valendo null): só no baú.</summary>
        [JsIgnore] public bool ItemSpecified;

        /// <summary>Parede rachada: de que lado da sala ela fica.</summary>
        public string Side;
        /// <summary>Baú aberto, vaso quebrado, parede aberta.</summary>
        public bool? Used;
        /// <summary>Parede rachada: o equipamento do baú da sala secreta.</summary>
        public Item SecretItem;
        /// <summary>Parede rachada: o baú da sala secreta já foi aberto.</summary>
        public bool? SecretCollected;
    }

    /// <summary>As tabelas de dungeon/extras.ts (fixtures/data/dungeon/extras.json).</summary>
    public sealed class ExtrasData
    {
        [JsName("EXTRA_TILES")] public List<TileRef> ExtraTiles = new List<TileRef>();
        [JsName("CRACK_CHANCE")] public double CrackChance;
        [JsName("EXTRA_CHEST_CHANCE")] public double ExtraChestChance;
        [JsName("EXTRA_POT_CHANCE")] public double ExtraPotChance;
        [JsName("EXTRA_POTIONS")] public List<string> ExtraPotions = new List<string>();
    }

    public static partial class GameData
    {
        private static ExtrasData _extrasTable;

        /// <summary>dungeon/extras: onde os extras ficam e as chances de cada um.</summary>
        public static ExtrasData ExtrasTable
        {
            get => Require(_extrasTable, "dungeon/extras");
            set => _extrasTable = value;
        }
    }

    /// <summary>
    /// Os extras das salas (port de shared/src/dungeon/extras.ts): cada sala ganha 1 ou 2 nos cantos (baú pequeno,
    /// vaso, placa) e, no máximo uma por andar, uma parede rachada que abre uma sala secreta fora do mapa.
    /// </summary>
    public static class RoomExtras
    {
        private static ExtrasData D => GameData.ExtrasTable;

        public static List<TileRef> ExtraTiles => D.ExtraTiles;
        public static double CrackChance => D.CrackChance;
        public static double ExtraChestChance => D.ExtraChestChance;
        public static double ExtraPotChance => D.ExtraPotChance;
        public static List<string> ExtraPotions => D.ExtraPotions;

        /// <summary>TS: placeExtras — roda por último na geração do andar; <paramref name="floor"/> é o andar de força.</summary>
        public static void PlaceExtras(List<DungeonCell> rooms, double floor, RngFn rng, Func<double> now)
        {
            foreach (var cell in rooms)
            {
                var livres = new List<TileRef>();
                foreach (var t in ExtraTiles) livres.Add(new TileRef { Col = t.Col, Row = t.Row });
                int quantos = rng() < 0.5 ? 1 : 2;
                var extras = new List<DungeonExtra>();
                for (int i = 0; i < quantos; i++)
                {
                    int indice = (int)Rng.RandomInt(livres.Count, rng);
                    var lugar = livres[indice];
                    livres.RemoveAt(indice);
                    double sorteio = rng();
                    if (sorteio < ExtraChestChance)
                    {
                        var bau = new DungeonExtra { Kind = "chest", Col = lugar.Col, Row = lugar.Row };
                        bau.Item = rng() < 0.5 ? SmallPotion(rng, now) : null;
                        bau.Used = false;
                        extras.Add(bau);
                    }
                    else if (sorteio < ExtraChestChance + ExtraPotChance)
                    {
                        extras.Add(new DungeonExtra { Kind = "pot", Col = lugar.Col, Row = lugar.Row, Used = false });
                    }
                    else
                    {
                        extras.Add(new DungeonExtra { Kind = "sign", Col = lugar.Col, Row = lugar.Row });
                    }
                }
                cell.Extras = extras;
            }

            if (rng() >= CrackChance) return;
            var candidatas = new List<DungeonCell>();
            foreach (var cell in rooms)
                if (LadosSemPorta(cell).Count > 0) candidatas.Add(cell);
            if (candidatas.Count == 0) return;
            var sala = Rng.Pick(candidatas, rng);
            var side = Rng.Pick(LadosSemPorta(sala), rng);
            var vao = GameData.RoomWalkTable.DoorTile[side];
            if (sala.Extras == null) sala.Extras = new List<DungeonExtra>();
            sala.Extras.Add(new DungeonExtra
            {
                Kind = "crack",
                Col = vao.Col,
                Row = vao.Row,
                Side = side,
                Used = false,
                SecretItem = SecretItem(floor, rng, now),
                SecretCollected = false,
            });
        }

        private static List<string> LadosSemPorta(DungeonCell cell)
        {
            var lados = new List<string>();
            foreach (var d in Directions.Order)
                if (cell.Doors == null || !cell.Doors.TryGet(d, out var aberta) || !aberta) lados.Add(d);
            return lados;
        }

        /// <summary>A poção do baú pequeno: vida ou mana, comum.</summary>
        private static Item SmallPotion(RngFn rng, Func<double> now)
        {
            var template = ItemTemplates.ById(Rng.Pick(ExtraPotions, rng));
            if (template == null) throw new InvalidOperationException("poção do baú pequeno sumiu do catálogo");
            return Items.Instantiate(template, Rarities.All[0], rng, now);
        }

        /// <summary>O item da sala secreta: um equipamento um degrau acima da raridade que o andar sortearia.</summary>
        private static Item SecretItem(double floor, RngFn rng, Func<double> now)
        {
            var normal = Rarities.Pick(floor, rng);
            var todas = Rarities.All;
            var acima = todas[Math.Min(todas.IndexOf(normal) + 1, todas.Count - 1)];
            return Items.RandomItem(new Items.RandomItemOptions
            {
                Category = Rng.Pick(GameData.ItemTable.EquippableCategories, rng),
                Rarity = acima.Id,
                Floor = floor,
                Rng = rng,
                Now = now,
            });
        }

        /// <summary>TS: extraChestGold — o ouro do baú pequeno, menos que o do baú da sala de tesouro.</summary>
        public static double ExtraChestGold(double floor, RngFn rng) => 3 + Rng.RandomInt(8, rng) + floor;

        /// <summary>TS: potCoins — as moedas de um vaso quebrado, de 1 a 5.</summary>
        public static double PotCoins(RngFn rng) => 1 + Rng.RandomInt(5, rng);

        /// <summary>TS: signHint — a dica da placa, sempre a mesma pra mesma placa (sem sorteio).</summary>
        public static string SignHint(List<List<DungeonCell>> grid, DungeonCell cell)
        {
            var salas = new List<DungeonCell>();
            foreach (var linha in grid) salas.AddRange(linha);
            var dicas = new List<string>();

            var escada = salas.Find(c => c.Type == "stairs");
            if (escada != null && !ReferenceEquals(escada, cell))
                dicas.Add("Uma seta riscada na madeira aponta o caminho: a escada fica " + Rumo(cell, escada) + ".");

            var oca = salas.Find(c => c.Extras != null && c.Extras.Exists(e => e.Kind == "crack" && e.Used != true));
            if (oca != null)
                dicas.Add(ReferenceEquals(oca, cell)
                    ? "Alguém escreveu, com pressa: \"uma parede desta sala soa oca\"."
                    : "Alguém escreveu, com pressa: \"há uma parede oca neste andar, " + Rumo(cell, oca) + "\".");

            var chefe = salas.Find(c => c.Type == "boss" && c.Beaten != true);
            string fraqueza = null;
            if (chefe?.Monsters != null && chefe.Monsters.Count > 0) fraqueza = MonsterCatalog.SpeciesById(chefe.Monsters[0].SpeciesId)?.Weakness;
            if (fraqueza == "magico") dicas.Add("Um aviso gasto: \"o guardião deste andar teme a magia\".");
            if (fraqueza == "fisico") dicas.Add("Um aviso gasto: \"o guardião deste andar teme o aço\".");

            if (dicas.Count == 0) return "A placa está gasta demais para ler.";
            return dicas[(int)((cell.X * 5 + cell.Y * 7) % dicas.Count)];
        }

        private static string Rumo(RoomCell de, RoomCell para)
        {
            double dx = para.X - de.X;
            double dy = para.Y - de.Y;
            string vertical = dy < 0 ? "norte" : "sul";
            string horizontal = dx > 0 ? "leste" : "oeste";
            if (Math.Abs(dx) >= 2 * Math.Abs(dy)) return horizontal == "leste" ? "a leste" : "a oeste";
            if (Math.Abs(dy) >= 2 * Math.Abs(dx)) return "ao " + vertical;
            return "a " + (vertical == "norte" ? "nor" : "su") + (horizontal == "leste" ? "deste" : "doeste");
        }
    }
}
