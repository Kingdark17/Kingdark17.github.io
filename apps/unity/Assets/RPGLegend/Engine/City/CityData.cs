using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: CityNpcTemplate (privada de city/city.ts) — um dos NPCs da cidade.</summary>
    public sealed class CityNpcTemplate
    {
        public string Name;
        public string Role;
        /// <summary>TS: NpcService — um de <see cref="NpcServiceIds"/>.</summary>
        public string Service;
        public string Icon;
        public List<string> Lines = new List<string>();
    }

    /// <summary>TS: LayoutSpec (privada) — uma sala do desenho fixo da cidade.</summary>
    public sealed class CityLayoutSpec
    {
        public double X;
        public double Y;
        /// <summary>TS: CityRoomType — um de <see cref="CityRoomTypes"/>.</summary>
        public string Type;
        /// <summary>Só nas salas de NPC: qual dos NPC_TEMPLATES mora ali.</summary>
        public double? NpcIndex;
    }

    /// <summary>Uma entrada de LAYOUT_DOORS: a porta que sai da sala (X, Y) na direção Dir (e a de volta, na vizinha).</summary>
    public sealed class CityDoorSpec
    {
        public double X;
        public double Y;
        /// <summary>TS: Direction — "N", "S", "E" ou "W".</summary>
        public string Dir;
    }

    /// <summary>As tabelas de city/city.ts (fixtures/data/city/city.json), inclusive as privadas.</summary>
    public sealed class CityData
    {
        /// <summary>Onde fica a Guilda (a pracinha a oeste do caminho do portão).</summary>
        [JsName("GUILD_POS")] public GridPosition GuildPos;
        [JsName("NPC_TEMPLATES")] public List<CityNpcTemplate> NpcTemplates = new List<CityNpcTemplate>();
        /// <summary>O desenho fixo: coordenadas numa grade 6×6, com o início em (3, 3).</summary>
        [JsName("LAYOUT")] public List<CityLayoutSpec> Layout = new List<CityLayoutSpec>();
        /// <summary>
        /// LAYOUT_DOORS, na ordem da tabela. No JSON cada porta é um trio <c>[x, y, direção]</c>, que o leitor de
        /// objetos não sabe ler: quem preenche esta lista é o CityTables (RPGLegend.Engine.Json).
        /// </summary>
        [JsIgnore] public List<CityDoorSpec> LayoutDoors = new List<CityDoorSpec>();
    }

    /// <summary>A parte da cidade em GameData (carregada por CityTables).</summary>
    public static partial class GameData
    {
        private static CityData _cityTable;

        /// <summary>city/city: a Guilda, os NPCs, o desenho e as portas da cidade.</summary>
        public static CityData CityTable
        {
            get => Require(_cityTable, "city/city");
            set => _cityTable = value;
        }
    }
}
