using System;

namespace RPGLegend.Engine
{
    /// <summary>
    /// Impede o UnityLinker de remover o tipo/membro no build (ele reconhece qualquer atributo chamado
    /// PreserveAttribute, de qualquer namespace). Usado no que só é alcançado por reflexão, como os ITableSet.
    /// </summary>
    [AttributeUsage(AttributeTargets.All, Inherited = false)]
    public sealed class PreserveAttribute : Attribute
    {
    }
}
