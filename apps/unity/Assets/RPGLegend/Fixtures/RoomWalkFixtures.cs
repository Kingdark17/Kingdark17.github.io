using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using RPGLegend.Engine;
using static RPGLegend.Tests.FixtureRegistry;

namespace RPGLegend.Tests
{
    /// <summary>Casos de fixtures/dungeon.json que são de dungeon/room-walk.ts: o andar solto dentro da sala.</summary>
    internal sealed class RoomWalkFixtures : IFixtureModule
    {
        public void Register()
        {
            const string M = "dungeon";

            Const(M, "ROOM_COLS", () => N(RoomWalk.RoomCols));
            Const(M, "ROOM_ROWS", () => N(RoomWalk.RoomRows));
            Const(M, "TILE_UNITS", () => N(RoomWalk.TileUnits));
            Const(M, "WALK_TICKS_PER_SECOND", () => N(RoomWalk.WalkTicksPerSecond));
            Const(M, "HERO_SPEED", () => N(RoomWalk.HeroSpeed));
            Const(M, "HERO_HALF", () => N(RoomWalk.HeroHalf));
            Const(M, "TOUCH_REACH", () => N(RoomWalk.TouchReach));
            Const(M, "STICK_MAX", () => N(RoomWalk.StickMax));
            Const(M, "DOOR_ASSIST", () => N(RoomWalk.DoorAssist));
            Const(M, "CONTENT_TILE", () => W(RoomWalk.ContentTile));

            Fn(M, "roomLayout", (a, c) => W(RoomWalk.Layout(R<DoorMap>(a["doors"]), R<List<RoomObject>>(a["objects"]),
                a["walls"] == null ? null : R<List<TileRef>>(a["walls"]))));
            Fn(M, "stickInput", (a, c) => W(RoomWalk.StickInput(Num(a["x"]), Num(a["y"]))));
            Fn(M, "roomArrival", (a, c) => W(RoomWalk.Arrival(a["movedTowards"].Type == JTokenType.Null ? null : Str(a["movedTowards"]))));
            Fn(M, "walkTick", (a, c) => W(RoomWalk.Tick(R<RoomLayout>(a["layout"]), R<Walker>(a["walker"]), R<WalkInput>(a["input"]))));

            // Cola de teste (o mesmo laço do gerador): vários passos, segmento por segmento, parando no vão.
            Fn(M, "walkTicks", (a, c) =>
            {
                var layout = RoomWalk.Layout(R<DoorMap>(a["doors"]), R<List<RoomObject>>(a["objects"]));
                var walker = R<Walker>(a["walker"]);
                double ticks = 0;
                var trace = new JArray();
                var touches = new JArray();
                string tocando = null;
                foreach (var segmento in (JArray)a["inputs"])
                {
                    var input = new WalkInput { X = Num(segmento["x"]), Y = Num(segmento["y"]) };
                    WalkStep passo = null;
                    for (int i = 0; i < Num(segmento["ticks"]); i++)
                    {
                        passo = RoomWalk.Tick(layout, walker, input);
                        walker = passo.Walker;
                        ticks++;
                        if (passo.Touching != tocando)
                        {
                            tocando = passo.Touching;
                            touches.Add(new JObject { ["tick"] = N(ticks), ["id"] = tocando == null ? JValue.CreateNull() : new JValue(tocando) });
                        }
                        if (passo.Exit != null) break;
                    }
                    if (passo != null) trace.Add(W(passo));
                    if (passo?.Exit != null) break;
                }
                return new JObject { ["trace"] = trace, ["touches"] = touches, ["ticks"] = N(ticks) };
            });
        }
    }
}
