using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: DungeonGenerateOptions.</summary>
    public sealed class DungeonGenerateOptions
    {
        public RngFn Rng;
        /// <summary>O relógio dos uid dos itens gerados (o InstantiateOptions.now). Ausente, Date.now.</summary>
        public Func<double> Now;
        /// <summary>Qual masmorra e em que dificuldade. Ausente, Floresta Normal (DEFAULT_RUN).</summary>
        public DungeonRun Run;
        /// <summary>
        /// Põe o professor de classe neste andar (o <c>Omit&lt;DungeonTeacher, 'taught'&gt;</c> do TS: só ClassId e
        /// Number são lidos). Quem chama decide, porque depende do herói.
        /// </summary>
        public DungeonTeacher Teacher;
        /// <summary>Quem gera o andar é o app: os itens dos baús e das salas podem vir com material.</summary>
        public bool App;
    }

    /// <summary>
    /// A geração do conteúdo de um andar da masmorra (port de shared/src/dungeon/generate.ts): sorteia o grafo
    /// de salas (<see cref="DungeonGraph"/>) e povoa cada sala com NPC, evento, tesouro, totem, professor,
    /// monstros ou chefe; e a apresentação pura da sala (ícone e textos). O andar devolvido é o TS: DungeonFloor
    /// — a <see cref="RoomGraph{TCell}"/> de <see cref="DungeonCell"/>.
    /// </summary>
    public static class DungeonFloors
    {
        private static DungeonGenerateData D => GameData.DungeonGenerateTable;

        /// <summary>TS: MAX_ROOMS (privada) — teto de salas por andar.</summary>
        public static double MaxRooms => D.MaxRooms;

        /// <summary>TS: MAX_TREASURES (privada) — teto de baús por andar.</summary>
        public static double MaxTreasures => D.MaxTreasures;

        /// <summary>
        /// TS: isBossFloor — chefe a cada 5 andares (o principal, a cada 10, quem decide é quem chama). O % do JS:
        /// -5 também é andar de chefe.
        /// </summary>
        public static bool IsBossFloor(double floor) => floor % 5 == 0;

        /// <summary>
        /// TS: monsterGroupSize — quantos monstros aparecem juntos numa sala: 2 com 35%, e a partir do andar 4
        /// mais um sorteio de 20% para 3. Um ou dois números do rng.
        /// </summary>
        public static double MonsterGroupSize(double floor, RngFn rng = null)
        {
            rng = rng ?? Rng.Default;
            double n = 1;
            if (rng() < 0.35) n = 2;
            if (floor >= 4 && rng() < 0.2) n = 3;
            return Js.Min(3, n);
        }

        /// <summary>
        /// TS: generateDungeonFloor — um andar completo: o grafo, a escada e a saída nas salas mais distantes do
        /// início (em ramificações diferentes, quando dá) e o conteúdo das outras salas.
        ///
        /// Dois andares em jogo: <paramref name="floor"/>, o andar em que o jogador está, decide o tamanho, o totem
        /// e onde há chefe; o andar de força (<see cref="Dungeons.EffectiveFloor"/>, pela masmorra e dificuldade de
        /// options.Run) decide os monstros, o ouro e os itens.
        ///
        /// Ordem dos sorteios (é contrato): os grafos e o embaralhamento das salas; NPC extra; evento extra (só do
        /// andar 4 em diante); os monstros sala a sala (grupo, monstros, bônus); o chefe; e, nas salas na ordem em
        /// que nasceram, o NPC, o evento e o baú. O totem não sorteia nada.
        /// </summary>
        public static RoomGraph<DungeonCell> Generate(double floor, double rows, double cols, DungeonGenerateOptions options = null)
        {
            var o = options ?? new DungeonGenerateOptions();
            var rng = o.Rng ?? Rng.Default;
            var now = o.Now;
            var run = o.Run ?? Dungeons.DefaultRun;
            double forca = Dungeons.EffectiveFloor(run, floor);
            IReadOnlyList<string> species = (IReadOnlyList<string>)Dungeons.ById(run.Dungeon)?.Species ?? Array.Empty<string>();
            double roomCount = Js.Min(MaxRooms, 9 + floor);

            var distant = ResolveDistantRooms(rows, cols, roomCount, rng);
            var res = distant.Res;
            var distances = distant.Distances;
            var distantRooms = distant.DistantRooms;
            var pool = distant.Pool;

            var stairsRoom = ReserveDistant(distantRooms, pool, distances, DungeonRoomTypes.Stairs);
            ReserveDistant(distantRooms, pool, distances, DungeonRoomTypes.Exit, stairsRoom?.StartBranch);

            // TS: place — tira salas do fim do pool embaralhado e dá o tipo a elas.
            List<DungeonCell> Place(string type, double count)
            {
                var placed = new List<DungeonCell>();
                for (double i = 0; i < count && pool.Count > 0; i++)
                {
                    var c = pool[pool.Count - 1];
                    pool.RemoveAt(pool.Count - 1);
                    c.Type = type;
                    placed.Add(c);
                }
                return placed;
            }

            Place(DungeonRoomTypes.Npc, 1 + (rng() < 0.5 ? 1 : 0));
            Place(DungeonRoomTypes.Event, 1 + (floor >= 4 && rng() < 0.4 ? 1 : 0));
            Place(DungeonRoomTypes.Treasure, Js.Min(MaxTreasures, 2 + Math.Floor(floor / 3)));
            // Sem sorteio: o totem é sempre a mesma coisa, e os andares sem totem saem iguais aos de antes.
            if (Dungeons.IsTotemFloor(floor)) Place(DungeonRoomTypes.Totem, 1);
            if (o.Teacher != null)
            {
                var sala = First(Place(DungeonRoomTypes.Teacher, 1));
                if (sala != null) sala.Teacher = new DungeonTeacher { ClassId = o.Teacher.ClassId, Number = o.Teacher.Number };
            }

            // Escada e saída já estão reservadas; em andar de chefe, uma sala fica para ele.
            double reservedRooms = IsBossFloor(floor) ? 1 : 0;
            double monsterRoomCount = Js.Min(pool.Count - reservedRooms, 3 + Math.Floor((floor - 1) * 1.3));
            PopulateMonsterRooms(Place(DungeonRoomTypes.Monster, Js.Max(2, monsterRoomCount)), forca, species, rng, now, o.App);

            if (IsBossFloor(floor)) PlaceBoss(First(Place(DungeonRoomTypes.Boss, 1)), forca, floor % 10 == 0, species, rng);

            PopulateRoomContent(res.Rooms, forca, rng, now, o.App);
            // Por último: o resto do andar sai igual ao de antes pra mesma semente.
            RoomExtras.PlaceExtras(res.Rooms, forca, rng, now, o.App);

            return new RoomGraph<DungeonCell> { Grid = res.Grid, Rooms = res.Rooms, Start = res.Start };
        }

        // ---------- apresentação pura (ícone/texto a partir da sala) ----------

        /// <summary>TS: iconFor — o ícone da sala no mapa; sala resolvida (baú aberto, monstro vencido…) fica sem.</summary>
        public static string IconFor(DungeonCell cell)
        {
            if (cell.Type == DungeonRoomTypes.Treasure) return cell.Collected == true ? "" : "🧰";
            if (cell.Type == DungeonRoomTypes.Monster)
            {
                if (cell.Beaten == true || !(cell.Monsters?.Count > 0)) return "";
                // cell.monsters[cell.monsterIndex || 0]
                double index = Js.Truthy(cell.MonsterIndex) ? cell.MonsterIndex.Value : 0;
                return Monsters.View(MonsterAt(cell.Monsters, index)).Icon;
            }
            if (cell.Type == DungeonRoomTypes.Boss) return cell.Beaten == true ? "" : "👑";
            if (cell.Type == DungeonRoomTypes.Event) return cell.Resolved == true ? "" : "❓";
            if (cell.Type == DungeonRoomTypes.Teacher) return cell.Teacher?.Taught == true ? "" : "🎓";
            return D.IconesFixos.TryGet(cell.Type, out var icon) && icon != null ? icon : "";
        }

        /// <summary>TS: shortLabel — o que se vê da sala de longe ("um baú fechado", "um mestre clérigo").</summary>
        public static string ShortLabel(DungeonCell cell)
        {
            if (cell.Type == DungeonRoomTypes.Monster)
            {
                if (cell.Beaten == true) return "os restos de uma batalha";
                return (cell.Monsters?.Count ?? 0) > 1 ? "um grupo de criaturas" : "uma criatura hostil";
            }
            if (cell.Type == DungeonRoomTypes.Boss) return cell.Beaten == true ? "um covil agora silencioso" : "uma presença poderosa e perigosa";
            if (cell.Type == DungeonRoomTypes.Event) return cell.Resolved == true ? "vestígios de um acontecimento" : "algo incomum";
            if (cell.Type == DungeonRoomTypes.Teacher) return cell.Teacher?.Taught == true ? "uma sala onde alguém ensinou" : NomeDoMestre(cell);
            switch (cell.Type)
            {
                case DungeonRoomTypes.Npc: return "alguém parado por perto";
                case DungeonRoomTypes.Treasure: return cell.Collected == true ? "um baú já vazio" : "um baú fechado";
                case DungeonRoomTypes.Stairs: return "escadas descendo";
                case DungeonRoomTypes.Exit: return "o caminho de volta à cidade";
                case DungeonRoomTypes.Start: return "o ponto de partida";
                case DungeonRoomTypes.Normal: return "uma sala vazia";
                case DungeonRoomTypes.Totem: return "um totem antigo";
                default: return "uma sala";
            }
        }

        /// <summary>TS: roomDesc — a descrição de quem está dentro da sala. Os nomes de monstro vêm com &lt;b&gt;.</summary>
        public static string RoomDesc(DungeonCell cell)
        {
            if (cell.Type == DungeonRoomTypes.Monster)
            {
                if (cell.Beaten == true) return "Os restos da batalha ainda marcam o chão desta sala.";
                IReadOnlyList<MonsterInstance> monsters = (IReadOnlyList<MonsterInstance>)cell.Monsters ?? Array.Empty<MonsterInstance>();
                return monsters.Count > 1
                    ? Js.NumberToString(monsters.Count) + " criaturas bloqueiam o caminho, observando cada movimento seu."
                    : "<b>" + Js.Str(Monsters.View(MonsterAt(monsters, 0)).Name) + "</b> bloqueia o caminho, observando cada movimento seu.";
            }
            if (cell.Type == DungeonRoomTypes.Boss)
            {
                return cell.Beaten == true
                    ? "O covil do guardião agora está silencioso e vazio."
                    : "Uma presença imensa e hostil domina esta câmara: <b>" + Js.Str(Monsters.View(MonsterAt(cell.Monsters, 0)).Name) + "</b>.";
            }
            if (cell.Type == DungeonRoomTypes.Event)
                return cell.Resolved == true ? "O acontecimento desta sala já chegou ao fim." : "Algo incomum nesta sala convida a uma escolha.";
            if (cell.Type == DungeonRoomTypes.Teacher)
            {
                return cell.Teacher?.Taught == true
                    ? "O mestre seguiu caminho. Ficaram as marcas do treino no chão."
                    : "Encostado na parede, " + NomeDoMestre(cell) + " observa você com atenção.";
            }
            switch (cell.Type)
            {
                case DungeonRoomTypes.Npc: return "Alguém está parado por aqui.";
                case DungeonRoomTypes.Treasure:
                    return cell.Collected == true ? "Um baú vazio jaz aberto no chão." : "Um baú de madeira reforçada repousa alguns passos à frente.";
                case DungeonRoomTypes.Stairs: return "Escadas de pedra descem para a escuridão, mais fundo na masmorra.";
                case DungeonRoomTypes.Exit: return "Um caminho iluminado sobe de volta em direção à cidade.";
                case DungeonRoomTypes.Start: return "Foi aqui que você chegou a este andar.";
                case DungeonRoomTypes.Normal: return "O ar aqui é frio e cheira a pedra úmida. Nada de especial nesta sala.";
                case DungeonRoomTypes.Totem:
                    return "Um totem de pedra pulsa com uma luz calma. Quem o toca pode voltar a este andar pelo portão da cidade.";
                default: return "";
            }
        }

        /// <summary>TS: entryText — a pergunta antes de entrar na sala.</summary>
        public static string EntryText(DungeonCell cell)
        {
            if (cell.Type == DungeonRoomTypes.Npc) return "Você avista " + Js.Str(cell.Npc?.Name) + ". Deseja se aproximar e conversar?";
            if (cell.Type == DungeonRoomTypes.Treasure) return "Um baú está logo à frente. Deseja abri-lo?";
            if (cell.Type == DungeonRoomTypes.Monster)
                return ((cell.Monsters?.Count ?? 0) > 1 ? "Várias criaturas bloqueiam" : "Uma criatura bloqueia") + " o caminho. Deseja entrar na sala?";
            if (cell.Type == DungeonRoomTypes.Boss) return "Uma presença poderosa emana desta sala. Deseja enfrentar o guardião?";
            if (cell.Type == DungeonRoomTypes.Event) return "Algo incomum aguarda nesta sala. Deseja investigar?";
            if (cell.Type == DungeonRoomTypes.Stairs) return "Escadas descem para um andar mais profundo da masmorra. Deseja descer?";
            if (cell.Type == DungeonRoomTypes.Exit) return "Um caminho leva de volta à cidade. Deseja sair da masmorra?";
            if (cell.Type == DungeonRoomTypes.Totem) return "Um totem antigo brilha nesta sala. Deseja tocá-lo?";
            if (cell.Type == DungeonRoomTypes.Teacher)
            {
                // nomeDoMestre(cell).replace(/^um/, 'Um')
                string nome = NomeDoMestre(cell);
                if (nome.StartsWith("um", StringComparison.Ordinal)) nome = "Um" + nome.Substring(2);
                return nome + " espera nesta sala. Deseja falar com ele?";
            }
            return "Deseja entrar na sala?";
        }

        // ---------- a geração, passo a passo ----------

        /// <summary>O retorno de resolveDistantRooms no TS.</summary>
        private sealed class DistantRoomsResult
        {
            public RoomGraph<DungeonCell> Res;
            public OrderedMap<double> Distances;
            public List<DungeonCell> DistantRooms;
            public List<DungeonCell> Pool;
        }

        /// <summary>
        /// TS: resolveDistantRooms — gera grafos até haver pelo menos duas salas "distantes" (4 portas ou mais do
        /// início pelo caminho, e 3 casas ou mais na grade), no máximo 80 tentativas. O primeiro grafo é sempre
        /// gerado e descartado, como no TS. Depois embaralha as salas (menos o início) no pool, com o sort do V8;
        /// sem duas distantes, cai nas do pool a 3 portas ou mais. As distantes saem ordenadas da mais longe para
        /// a mais perto (caminho, depois grade), com o sort estável do V8 nos empates.
        /// </summary>
        private static DistantRoomsResult ResolveDistantRooms(double rows, double cols, double roomCount, RngFn rng)
        {
            var res = DungeonGraph.GenerateRoomGraph<DungeonCell>(rows, cols, roomCount, rng);
            var distances = DungeonGraph.DistancesFrom(res.Grid, res.Start, cols, rows);
            var distantRooms = new List<DungeonCell>();
            double attempts = 0;

            while (attempts < 80 && distantRooms.Count < 2)
            {
                attempts++;
                res = DungeonGraph.GenerateRoomGraph<DungeonCell>(rows, cols, roomCount, rng);
                distances = DungeonGraph.DistancesFrom(res.Grid, res.Start, cols, rows);
                distantRooms = new List<DungeonCell>();
                for (int i = 1; i < res.Rooms.Count; i++)
                {
                    var cell = res.Rooms[i];
                    double pathDistance = DistanceOrZero(distances, cell);
                    double visualDistance = Math.Abs(cell.X - res.Start.X) + Math.Abs(cell.Y - res.Start.Y);
                    if (pathDistance >= 4 && visualDistance >= 3) distantRooms.Add(cell);
                }
            }
            foreach (var cell in distantRooms) cell.StartBranch = StartBranch(res.Grid, distances, cell);

            // res.rooms.slice(1).sort(() => rng() - 0.5)
            var pool = JsSort.SortLikeV8(res.Rooms.GetRange(1, res.Rooms.Count - 1), (a, b) => rng() - 0.5);

            if (distantRooms.Count < 2)
            {
                distantRooms = pool.FindAll(cell => DistanceOrZero(distances, cell) >= 3);
                foreach (var cell in distantRooms) cell.StartBranch = StartBranch(res.Grid, distances, cell);
            }

            var start = res.Start;
            distantRooms = JsSort.SortLikeV8(distantRooms, (a, b) =>
            {
                double pathDiff = DistanceOrZero(distances, b) - DistanceOrZero(distances, a);
                if (Js.Truthy(pathDiff)) return pathDiff;
                double aVisual = Math.Abs(a.X - start.X) + Math.Abs(a.Y - start.Y);
                double bVisual = Math.Abs(b.X - start.X) + Math.Abs(b.Y - start.Y);
                return bVisual - aVisual;
            });

            return new DistantRoomsResult { Res = res, Distances = distances, DistantRooms = distantRooms, Pool = pool };
        }

        /// <summary>
        /// TS: startBranch — a partir de uma sala distante, volta pelo caminho mais curto até a sala a 1 porta do
        /// início: é ali que a rota se ramifica. Serve para não pôr escada e saída na mesma ramificação. Em cada
        /// sala, segue a primeira porta (na ordem das portas) que leva a uma sala um passo mais perto.
        /// </summary>
        private static string StartBranch(List<List<DungeonCell>> grid, OrderedMap<double> distances, DungeonCell cell)
        {
            var current = cell;
            double guard = 0;
            while (DistanceOrZero(distances, current) > 1 && guard++ < 100)
            {
                double currentDistance = distances.Get(DungeonGraph.PositionKey(current.X, current.Y));
                DungeonCell previous = null;
                foreach (var dir in DoorKeys(current))
                {
                    var v = VectorOf(dir);
                    var candidate = DungeonGraph.CellAt(grid, current.X + v.X, current.Y + v.Y);
                    if (candidate != null
                        && distances.TryGet(DungeonGraph.PositionKey(candidate.X, candidate.Y), out var d)
                        && d == currentDistance - 1)
                    {
                        previous = candidate;
                        break;
                    }
                }
                if (previous == null) break;
                current = previous;
            }
            return DungeonGraph.PositionKey(current.X, current.Y);
        }

        /// <summary>
        /// TS: reserveDistant — reserva a sala distante disponível mais longe para um tipo fixo (escada, saída),
        /// tirando-a das distantes e do pool. Com <paramref name="otherBranch"/>, prefere a primeira de outra
        /// ramificação (se não houver, a primeira mesmo). null quando não sobrou sala distante.
        /// </summary>
        private static DungeonCell ReserveDistant(List<DungeonCell> distantRooms, List<DungeonCell> pool, OrderedMap<double> distances, string type, string otherBranch = null)
        {
            int pickIndex = 0;
            if (Js.Truthy(otherBranch))
            {
                pickIndex = distantRooms.FindIndex(candidate => candidate.StartBranch != otherBranch);
                if (pickIndex < 0) pickIndex = 0;
            }
            // distantRooms.splice(pickIndex, 1)[0]
            if (pickIndex >= distantRooms.Count) return null;
            var cell = distantRooms[pickIndex];
            distantRooms.RemoveAt(pickIndex);
            if (cell == null) return null;
            int index = pool.IndexOf(cell);
            if (index >= 0) pool.RemoveAt(index);
            cell.Type = type;
            cell.DistanceFromStart = DistanceOrZero(distances, cell);
            return cell;
        }

        /// <summary>
        /// TS: populateMonsterRooms — os monstros de cada sala de monstro (o grupo, um monstro por vez), e a
        /// chance de recompensa extra (35%) nas salas com mais de um: ouro (70%) ou um item. floor é o andar de
        /// força, e species, as da masmorra.
        /// </summary>
        private static void PopulateMonsterRooms(List<DungeonCell> rooms, double floor, IReadOnlyList<string> species, RngFn rng, Func<double> now, bool app)
        {
            foreach (var cell in rooms)
            {
                double groupSize = MonsterGroupSize(floor, rng);
                cell.Monsters = new List<MonsterInstance>();
                for (double i = 0; i < groupSize; i++)
                    cell.Monsters.Add(Monsters.Generate(floor, new Monsters.GenerateOptions { Rng = rng, Species = species }));
                cell.MonsterIndex = 0;
                cell.Beaten = false;
                if (groupSize > 1 && rng() < 0.35)
                {
                    cell.BonusTreasure = rng() < 0.7
                        ? new DungeonTreasureBonus { Gold = 10 + floor * 3 + Rng.RandomInt(15, rng) }
                        : new DungeonTreasureBonus { Item = Items.RandomItem(new Items.RandomItemOptions { Floor = floor, Rng = rng, Now = now, App = app }) };
                }
            }
        }

        /// <summary>TS: placeBoss — o chefe na sala reservada; sem sala, nada (nem sorteio).</summary>
        private static void PlaceBoss(DungeonCell bossRoom, double floor, bool main, IReadOnlyList<string> species, RngFn rng)
        {
            if (bossRoom == null) return;
            bossRoom.Monsters = new List<MonsterInstance>
            {
                Monsters.GenerateBoss(floor, new Monsters.GenerateOptions { Rng = rng, Species = species, Main = main }),
            };
            bossRoom.MonsterIndex = 0;
            bossRoom.Beaten = false;
        }

        /// <summary>
        /// TS: populateRoomContent — NPC, evento e baú das salas já tipadas, na ordem das salas (monstro e chefe já
        /// saíram prontos). O baú: Mímico (10% + 0,8% por andar, até 25%), ouro (70%) ou um item do andar.
        /// </summary>
        private static void PopulateRoomContent(List<DungeonCell> rooms, double floor, RngFn rng, Func<double> now, bool app)
        {
            foreach (var cell in rooms)
            {
                if (cell.Type == DungeonRoomTypes.Npc)
                {
                    var template = Rng.Pick(D.NpcTemplates, rng);
                    cell.Npc = new DungeonNpc
                    {
                        Name = template.Name,
                        Role = template.Role,
                        Service = template.Service,
                        Icon = template.Icon,
                        Lines = new List<string>(template.Lines),
                        ServiceUsed = false,
                    };
                }
                if (cell.Type == DungeonRoomTypes.Event)
                {
                    cell.Event = new DungeonEventStub { TemplateId = DungeonEvents.RandomTemplate(rng).Id };
                    cell.Resolved = false;
                }
                if (cell.Type == DungeonRoomTypes.Treasure)
                {
                    cell.IsMimic = rng() < Js.Min(0.25, 0.1 + floor * 0.008);
                    cell.GiveGold = rng() < 0.7;
                    cell.Item = cell.GiveGold == true ? null : Items.RandomItem(new Items.RandomItemOptions { Floor = floor, Rng = rng, Now = now, App = app });
                    cell.Collected = false;
                }
            }
        }

        // ---------- apoio ----------

        /// <summary>
        /// TS: nomeDoMestre — "um mestre clérigo": o nome da classe do professor em minúsculas; sem classe
        /// conhecida, só "um mestre" (o trim tira o espaço que sobra).
        /// </summary>
        private static string NomeDoMestre(DungeonCell cell)
        {
            string classe = Catalog.ClassById(cell.Teacher?.ClassId ?? "")?.Name ?? "";
            return JsTrim("um mestre " + classe.ToLowerInvariant());
        }

        /// <summary><c>distances[`${x},${y}`] || 0</c>: chave ausente, 0 e NaN valem 0.</summary>
        private static double DistanceOrZero(OrderedMap<double> distances, RoomCell cell) =>
            distances.TryGet(DungeonGraph.PositionKey(cell.X, cell.Y), out var d) && Js.Truthy(d) ? d : 0;

        /// <summary>Object.keys(cell.doors || {}).</summary>
        private static IReadOnlyList<string> DoorKeys(RoomCell cell) =>
            cell.Doors != null ? cell.Doors.Keys : (IReadOnlyList<string>)Array.Empty<string>();

        /// <summary>DIR_VECTORS[dir]; direção desconhecida dá undefined, e o JS lança ao ler v.y (a conta da linha vem antes).</summary>
        private static DirVector VectorOf(string dir)
        {
            if (Directions.Vectors.TryGet(dir, out var v) && v != null) return v;
            throw new EngineError("Cannot read properties of undefined (reading 'y')", "TypeError");
        }

        /// <summary>
        /// lista[i] do JS para o monsterView: fora da lista (ou lista ausente) vem undefined, e o monsterView lança
        /// ao ler speciesId.
        /// </summary>
        private static MonsterInstance MonsterAt(IReadOnlyList<MonsterInstance> list, double index)
        {
            if (list != null && index >= 0 && index < list.Count && Math.Floor(index) == index && list[(int)index] != null)
                return list[(int)index];
            throw new EngineError("Cannot read properties of undefined (reading 'speciesId')", "TypeError");
        }

        /// <summary>O <c>[0]</c> de uma lista do place (undefined, aqui null, quando vazia).</summary>
        private static DungeonCell First(List<DungeonCell> list) => list.Count > 0 ? list[0] : null;

        /// <summary>String.prototype.trim do JS: tira das pontas os espaços e fins de linha do ECMAScript.</summary>
        private static string JsTrim(string s)
        {
            int start = 0, end = s.Length - 1;
            while (start <= end && IsJsWhitespace(s[start])) start++;
            while (end >= start && IsJsWhitespace(s[end])) end--;
            return s.Substring(start, end - start + 1);
        }

        private static bool IsJsWhitespace(char c)
        {
            switch ((int)c)
            {
                case 0x0009: case 0x000A: case 0x000B: case 0x000C: case 0x000D: case 0x0020:
                case 0x00A0: case 0x1680: case 0x2028: case 0x2029: case 0x202F: case 0x205F:
                case 0x3000: case 0xFEFF:
                    return true;
                default:
                    return c >= ' ' && c <= ' ';
            }
        }
    }
}
