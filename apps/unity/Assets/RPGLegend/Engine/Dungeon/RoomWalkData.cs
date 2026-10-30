using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>Um quadrado da sala (TS: <c>{ col, row }</c>).</summary>
    public sealed class TileRef
    {
        public double Col;
        public double Row;
    }

    /// <summary>As tabelas de dungeon/room-walk.ts (fixtures/data/dungeon/room-walk.json).</summary>
    public sealed class RoomWalkData
    {
        [JsName("ROOM_COLS")] public double RoomCols;
        [JsName("ROOM_ROWS")] public double RoomRows;
        [JsName("TILE_UNITS")] public double TileUnits;
        [JsName("WALK_TICKS_PER_SECOND")] public double WalkTicksPerSecond;
        [JsName("HERO_SPEED")] public double HeroSpeed;
        [JsName("HERO_HALF")] public double HeroHalf;
        [JsName("TOUCH_REACH")] public double TouchReach;
        [JsName("STICK_MAX")] public double StickMax;
        [JsName("DOOR_ASSIST")] public double DoorAssist;
        [JsName("CONTENT_TILE")] public TileRef ContentTile;
        /// <summary>Privada no TS: o vão de cada porta.</summary>
        [JsName("DOOR_TILE")] public OrderedMap<TileRef> DoorTile = new OrderedMap<TileRef>();
        /// <summary>A sala de sempre: 9 × 9, o conteúdo no meio e um vão de 1 casa no meio de cada parede.</summary>
        [JsName("GEOMETRIA_PADRAO")] public GeometriaDaSala GeometriaPadrao;
    }

    /// <summary>
    /// TS: PortaDaSala — a casa do vão mais pra dentro, no meio dele (onde a parede rachada fica e por onde se chega), a
    /// largura do vão em casas e a grossura da parede daquele lado.
    /// </summary>
    public sealed class PortaDaSala
    {
        public double Col;
        public double Row;
        public double Largura;
        public double Fundo;

        public PortaDaSala Clone() => (PortaDaSala)MemberwiseClone();
    }

    /// <summary>TS: GeometriaDaSala — o tamanho, o meio (onde fica o conteúdo) e as portas de uma sala.</summary>
    public sealed class GeometriaDaSala
    {
        public double Cols;
        public double Rows;
        public TileRef Conteudo;
        public OrderedMap<PortaDaSala> Portas = new OrderedMap<PortaDaSala>();
        /// <summary>Onde ficam os extras, na ordem de EXTRA_TILES; null, onde foram gravados.</summary>
        public List<TileRef> Extras;
    }

    public static partial class GameData
    {
        private static RoomWalkData _roomWalkTable;

        /// <summary>dungeon/room-walk: o tamanho da sala, a velocidade e o corpo do herói.</summary>
        public static RoomWalkData RoomWalkTable
        {
            get => Require(_roomWalkTable, "dungeon/room-walk");
            set => _roomWalkTable = value;
        }
    }
}
