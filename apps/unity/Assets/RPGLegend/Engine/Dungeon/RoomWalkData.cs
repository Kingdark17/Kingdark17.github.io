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
