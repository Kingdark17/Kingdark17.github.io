using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: CityRoomType — os tipos de sala da cidade.</summary>
    public static class CityRoomTypes
    {
        public const string Void = "void";
        public const string Start = "start";
        public const string Normal = "normal";
        public const string Gate = "gate";
        public const string Shop = "shop";
        public const string Blacksmith = "blacksmith";
        public const string Tavern = "tavern";
        public const string Questboard = "questboard";
        public const string Npc = "npc";
        public const string Guild = "guild";
        public const string Encantadora = "encantadora";
    }

    /// <summary>TS: CityNpc — um morador da cidade, com o serviço ainda por usar.</summary>
    public sealed class CityNpc
    {
        public string Name;
        public string Role;
        /// <summary>TS: NpcService — um de <see cref="NpcServiceIds"/>.</summary>
        public string Service;
        public string Icon;
        public List<string> Lines;
        public bool ServiceUsed;

        /// <summary>Campos do save que o C# não conhece; voltam intactos ao salvar.</summary>
        [JsExtra] public JsExtras Extra;

        /// <summary>O <c>{ ...npc }</c> do TS (a lista de falas continua a mesma).</summary>
        public CityNpc Clone()
        {
            var c = (CityNpc)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }
    }

    /// <summary>TS: CityCell — uma sala da cidade: a RoomCell mais o NPC e o estoque da loja. Vai no save.</summary>
    public sealed class CityCell : RoomCell
    {
        public CityNpc Npc;
        /// <summary>
        /// Estoque da loja/ferreiro, sorteado na primeira visita e guardado na própria sala (fica no save de
        /// propósito: sair e voltar não rola um estoque novo de graça).
        /// </summary>
        public List<Item> ForSale;

        /// <summary>O <c>{ ...cell }</c> do TS: cópia rasa (portas, NPC e estoque continuam os mesmos objetos).</summary>
        public new CityCell Clone() => (CityCell)base.Clone();
    }

    /// <summary>O retorno de restAtTavern no TS: <c>{ hero, party }</c>.</summary>
    public sealed class TavernRest
    {
        public Hero Hero;
        public List<Companion> Party;
    }

    /// <summary>
    /// A cidade inicial (port de shared/src/city/city.ts): o desenho FIXO de salas (o mesmo mapa para todo
    /// mundo, sem sorteio) — loja, ferreiro, taverna, quadro de missões, NPCs, Guilda e o portão da masmorra —,
    /// o descanso da taverna e a apresentação pura das salas. O desenho gerado é o TS: CityLayout — a
    /// <see cref="RoomGraph{TCell}"/> de <see cref="CityCell"/>.
    /// </summary>
    public static class City
    {
        private static CityData D => GameData.CityTable;

        /// <summary>
        /// TS: GUILD_POS — onde fica a Guilda. Exportado porque a cidade vai no save, e quem carrega uma cidade de
        /// antes precisa saber onde abrir a porta (<see cref="WithGuild"/>). O mesmo objeto sempre: não altere.
        /// </summary>
        public static GridPosition GuildPos => D.GuildPos;

        /// <summary>
        /// TS: ENCANTADORA_POS — onde fica a Encantadora (2026-10), na pracinha do outro lado do caminho do portão. Ela
        /// só atende no app; no site a sala existe, com a porta fechada. O mesmo objeto sempre: não altere.
        /// </summary>
        public static GridPosition EncantadoraPos => D.EncantadoraPos;

        /// <summary>
        /// TS: generateCityLayout — a grade rows × cols, as salas do desenho que cabem nela (na ordem do desenho),
        /// as portas entre salas que existem e o início em (3, 3). Grade pequena demais fica sem início (null).
        /// Determinístico: o mesmo mapa sempre.
        /// </summary>
        public static RoomGraph<CityCell> GenerateLayout(double rows, double cols)
        {
            var grid = new List<List<CityCell>>();
            for (double y = 0; y < rows; y++)
            {
                var row = new List<CityCell>();
                for (double x = 0; x < cols; x++) row.Add(new CityCell { Type = CityRoomTypes.Void, X = x, Y = y, Doors = new DoorMap() });
                grid.Add(row);
            }

            foreach (var spec in D.Layout)
            {
                var cell = DungeonGraph.CellAt(grid, spec.X, spec.Y);
                if (cell == null) continue;
                cell.Type = spec.Type;
                if (spec.Type == CityRoomTypes.Npc && spec.NpcIndex != null) cell.Npc = PickNpc(spec.NpcIndex.Value);
            }

            foreach (var door in D.LayoutDoors)
            {
                var v = VectorOf(door.Dir);
                var cell = DungeonGraph.CellAt(grid, door.X, door.Y);
                var target = DungeonGraph.CellAt(grid, door.X + v.X, door.Y + v.Y);
                if (cell == null || target == null) continue;
                cell.Doors.Set(door.Dir, true);
                target.Doors.Set(Js.Str(Directions.Opposite.Get(door.Dir)), true);
            }

            var rooms = new List<CityCell>();
            foreach (var spec in D.Layout)
            {
                var cell = DungeonGraph.CellAt(grid, spec.X, spec.Y);
                if (cell != null) rooms.Add(cell);
            }
            var start = DungeonGraph.CellAt(grid, 3, 3);
            return new RoomGraph<CityCell> { Grid = grid, Rooms = rooms, Start = start };
        }

        /// <summary>
        /// TS: withGuild — a cidade gravada antes de a Guilda existir, com ela no lugar: a pracinha vazia em
        /// GUILD_POS vira Guilda (uma cópia da sala, numa linha nova; o resto da grade continua o mesmo). Sem
        /// pracinha "normal" ali, devolve a mesma grade.
        /// </summary>
        public static List<List<CityCell>> WithGuild(List<List<CityCell>> grid) => ComSalaNoLugarDaPracinha(grid, GuildPos, CityRoomTypes.Guild);

        /// <summary>TS: withEncantadora — a cidade gravada antes de a Encantadora existir, com ela no lugar. A mesma troca do <see cref="WithGuild"/>.</summary>
        public static List<List<CityCell>> WithEncantadora(List<List<CityCell>> grid) => ComSalaNoLugarDaPracinha(grid, EncantadoraPos, CityRoomTypes.Encantadora);

        /// <summary>A pracinha vazia em <paramref name="pos"/> vira a sala do <paramref name="tipo"/> (uma cópia, numa linha nova); sem pracinha ali, a mesma grade.</summary>
        private static List<List<CityCell>> ComSalaNoLugarDaPracinha(List<List<CityCell>> grid, GridPosition pos, string tipo)
        {
            if (DungeonGraph.CellAt(grid, pos.X, pos.Y)?.Type != CityRoomTypes.Normal) return grid;

            var next = new List<List<CityCell>>(grid.Count);
            for (int y = 0; y < grid.Count; y++)
            {
                var linha = grid[y];
                if (y != pos.Y)
                {
                    next.Add(linha);
                    continue;
                }
                var nova = new List<CityCell>(linha.Count);
                for (int x = 0; x < linha.Count; x++)
                {
                    var cell = linha[x];
                    if (x == pos.X)
                    {
                        var sala = cell.Clone();
                        sala.Type = tipo;
                        nova.Add(sala);
                    }
                    else
                    {
                        nova.Add(cell);
                    }
                }
                next.Add(nova);
            }
            return next;
        }

        /// <summary>TS: restAtTavern — vida e mana do herói cheias, e a vida da equipe inteira (cópias).</summary>
        public static TavernRest RestAtTavern(Hero hero, IReadOnlyList<Companion> party)
        {
            var nextHero = hero.Clone();
            nextHero.Hp = hero.MaxHp;
            nextHero.Mp = hero.MaxMp;
            var nextParty = new List<Companion>(party.Count);
            foreach (var m in party)
            {
                var c = m.Clone();
                c.Hp = m.MaxHp;
                nextParty.Add(c);
            }
            return new TavernRest { Hero = nextHero, Party = nextParty };
        }

        // ---------- apresentação pura ----------

        /// <summary>TS: cityIconFor — o ícone da sala no mapa ("" nas salas sem).</summary>
        public static string IconFor(CityCell cell)
        {
            switch (cell.Type)
            {
                case CityRoomTypes.Npc: return "🧙";
                case CityRoomTypes.Shop: return "🏵";
                case CityRoomTypes.Blacksmith: return "🔨";
                case CityRoomTypes.Tavern: return "🍺";
                case CityRoomTypes.Questboard: return "📜";
                case CityRoomTypes.Gate: return "🌟";
                case CityRoomTypes.Start: return "🚀";
                case CityRoomTypes.Guild: return "⚜️";
                case CityRoomTypes.Encantadora: return "✨";
                default: return "";
            }
        }

        /// <summary>TS: cityShortLabel — o que se vê da sala de longe.</summary>
        public static string ShortLabel(CityCell cell)
        {
            switch (cell.Type)
            {
                case CityRoomTypes.Npc: return "um NPC";
                case CityRoomTypes.Shop: return "uma loja";
                case CityRoomTypes.Blacksmith: return "a forja de um ferreiro";
                case CityRoomTypes.Tavern: return "uma taverna";
                case CityRoomTypes.Questboard: return "um quadro de missões";
                case CityRoomTypes.Gate: return "o portão da masmorra";
                case CityRoomTypes.Start: return "o ponto de partida";
                case CityRoomTypes.Normal: return "uma sala vazia";
                case CityRoomTypes.Guild: return "a Guilda dos Aventureiros";
                case CityRoomTypes.Encantadora: return "a sala da Encantadora";
                default: return "uma sala";
            }
        }

        /// <summary>TS: cityRoomDesc — a descrição de quem está dentro da sala ("" nas salas sem).</summary>
        public static string RoomDesc(CityCell cell)
        {
            switch (cell.Type)
            {
                case CityRoomTypes.Npc: return "Um morador da cidade está por aqui.";
                case CityRoomTypes.Shop: return "Um vendedor organiza suas mercadorias.";
                case CityRoomTypes.Blacksmith: return "O calor da forja aquece o ar; um ferreiro trabalha o metal.";
                case CityRoomTypes.Tavern: return "Risadas e cheiro de cerveja escapam pela porta entreaberta.";
                case CityRoomTypes.Questboard: return "Um quadro coberto de pergaminhos e anúncios está afixado na parede.";
                case CityRoomTypes.Gate: return "Um portão de pedra antiga marca a entrada da masmorra.";
                case CityRoomTypes.Start: return "Este foi o ponto onde você chegou à cidade.";
                case CityRoomTypes.Normal: return "Uma pracinha tranquila, sem nada de especial.";
                case CityRoomTypes.Guild: return "Estandartes de todas as classes pendem do salão da Guilda dos Aventureiros.";
                case CityRoomTypes.Encantadora: return "Pedras e frascos brilham na mesa da Encantadora.";
                default: return "";
            }
        }

        /// <summary>TS: cityEntryText — a pergunta antes de entrar na sala.</summary>
        public static string EntryText(CityCell cell)
        {
            switch (cell.Type)
            {
                case CityRoomTypes.Npc: return "Você avista " + Js.Str(cell.Npc?.Name) + ". Deseja se aproximar e conversar?";
                case CityRoomTypes.Shop: return "Um vendedor itinerante oferece suas mercadorias. Deseja negociar?";
                case CityRoomTypes.Blacksmith: return "A forja do ferreiro está acesa. Deseja ver os equipamentos?";
                case CityRoomTypes.Tavern: return "Uma taverna aconchegante convida a um descanso. Deseja entrar?";
                case CityRoomTypes.Questboard: return "Um quadro de missões está afixado na parede. Deseja ver os anúncios?";
                case CityRoomTypes.Gate: return "Um portão misterioso leva à masmorra. Deseja atravessar?";
                case CityRoomTypes.Guild: return "A Guilda dos Aventureiros treina quem vai descer à masmorra. Deseja entrar?";
                case CityRoomTypes.Encantadora: return "A Encantadora fortifica armaduras em troca de ouro. Deseja entrar?";
                default: return "Deseja entrar?";
            }
        }

        // ---------- apoio ----------

        /// <summary>
        /// TS: pickNpc — o NPC <c>NPC_TEMPLATES[index % length]</c>, com a lista de falas copiada e o serviço por
        /// usar. Índice fora da lista dá undefined, e o JS lança ao ler o nome.
        /// </summary>
        private static CityNpc PickNpc(double index)
        {
            var templates = D.NpcTemplates;
            double i = index % templates.Count;
            if (!(i >= 0) || i >= templates.Count || Math.Floor(i) != i || templates[(int)i] == null)
                throw new EngineError("Cannot read properties of undefined (reading 'name')", "TypeError");
            var source = templates[(int)i];
            return new CityNpc
            {
                Name = source.Name,
                Role = source.Role,
                Service = source.Service,
                Icon = source.Icon,
                Lines = new List<string>(source.Lines),
                ServiceUsed = false,
            };
        }

        /// <summary>DIR_VECTORS[dir]; direção desconhecida dá undefined, e o JS lança ao ler v.y.</summary>
        private static DirVector VectorOf(string dir)
        {
            if (Directions.Vectors.TryGet(dir, out var v) && v != null) return v;
            throw new EngineError("Cannot read properties of undefined (reading 'y')", "TypeError");
        }
    }
}
