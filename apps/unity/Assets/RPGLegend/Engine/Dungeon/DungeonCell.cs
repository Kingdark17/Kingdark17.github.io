using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: DungeonRoomType — os tipos de sala de um andar da masmorra.</summary>
    public static class DungeonRoomTypes
    {
        public const string Void = "void";
        public const string Start = "start";
        public const string Normal = "normal";
        public const string Npc = "npc";
        public const string Event = "event";
        public const string Treasure = "treasure";
        public const string Monster = "monster";
        public const string Boss = "boss";
        public const string Stairs = "stairs";
        public const string Exit = "exit";
        public const string Totem = "totem";
        public const string Teacher = "teacher";
    }

    /// <summary>TS: DungeonTeacher — o professor de classe numa sala (ver hero/teachers.ts).</summary>
    public sealed class DungeonTeacher
    {
        /// <summary>A classe dele, que é a de quem conduzia quando o andar nasceu.</summary>
        public string ClassId;
        /// <summary>1 ou 2.</summary>
        public double Number;
        /// <summary>Já ensinou: a sala vira só uma sala. Opcional.</summary>
        public bool? Taught;

        /// <summary>Campos do save que o C# não conhece; voltam intactos ao salvar.</summary>
        [JsExtra] public JsExtras Extra;

        /// <summary>O <c>{ ...teacher }</c> do TS.</summary>
        public DungeonTeacher Clone()
        {
            var c = (DungeonTeacher)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }
    }

    /// <summary>TS: DungeonNpc — o NPC de uma sala, com o serviço ainda por usar.</summary>
    public sealed class DungeonNpc
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
        public DungeonNpc Clone()
        {
            var c = (DungeonNpc)MemberwiseClone();
            c.Extra = Extra?.Clone();
            return c;
        }
    }

    /// <summary>TS: DungeonEventStub — o evento sorteado da sala, ainda não resolvido.</summary>
    public sealed class DungeonEventStub
    {
        /// <summary>TS: EventTemplateId.</summary>
        public string TemplateId;

        /// <summary>Campos do save que o C# não conhece; voltam intactos ao salvar.</summary>
        [JsExtra] public JsExtras Extra;
    }

    /// <summary>
    /// TS: DungeonTreasureBonus — <c>{ gold }</c> ou <c>{ item }</c>: a recompensa extra de uma sala com mais de
    /// um monstro. Só um dos dois campos vem preenchido.
    /// </summary>
    public sealed class DungeonTreasureBonus
    {
        public double? Gold;
        public Item Item;

        /// <summary>Campos do save que o C# não conhece; voltam intactos ao salvar.</summary>
        [JsExtra] public JsExtras Extra;
    }

    /// <summary>
    /// TS: DungeonCell — uma sala do andar da masmorra: a RoomCell do grafo mais o conteúdo que
    /// <see cref="DungeonFloors.Generate"/> põe nela. Tudo opcional (null = ausente), salvo o que a
    /// <see cref="RoomCell"/> já tem. Vai no save.
    /// </summary>
    public sealed class DungeonCell : RoomCell
    {
        public DungeonNpc Npc;
        public DungeonEventStub Event;
        /// <summary>Sala de evento: o evento já chegou ao fim.</summary>
        public bool? Resolved;
        public List<MonsterInstance> Monsters;
        /// <summary>O monstro da vez na sala (o índice em <see cref="Monsters"/>).</summary>
        public double? MonsterIndex;
        public bool? Beaten;
        public DungeonTreasureBonus BonusTreasure;
        /// <summary>Baú que é um Mímico.</summary>
        public bool? IsMimic;
        /// <summary>Baú que dá ouro em vez de item.</summary>
        public bool? GiveGold;

        private Item _item;

        /// <summary>
        /// O item do baú, ou null de propósito quando o baú dá ouro — o <c>item?: Item | null</c> do TS: ausente
        /// nas outras salas, null presente no baú de ouro. Atribuir (mesmo null) marca <see cref="ItemSpecified"/>.
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

        /// <summary>
        /// O campo <c>item</c> existe na sala (mesmo valendo null). É a convenção "XxxSpecified" que a camada de
        /// JSON segue ao ler e ao escrever: false = campo ausente (undefined), e é como fica uma sala que não é baú.
        /// </summary>
        [JsIgnore] public bool ItemSpecified;

        /// <summary>Baú já aberto.</summary>
        public bool? Collected;
        /// <summary>Escada e saída: a distância em portas até o início.</summary>
        public double? DistanceFromStart;
        /// <summary>Salas distantes: onde a rota até o início se ramifica ("x,y").</summary>
        public string StartBranch;
        public DungeonTeacher Teacher;

        /// <summary>O <c>{ ...cell }</c> do TS: cópia rasa (portas, monstros, NPC e item continuam os mesmos objetos).</summary>
        public new DungeonCell Clone() => (DungeonCell)base.Clone();
    }
}
