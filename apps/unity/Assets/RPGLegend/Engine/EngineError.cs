using System;

namespace RPGLegend.Engine
{
    /// <summary>
    /// Erro lançado pela engine. <see cref="Name"/> espelha o <c>.name</c> do erro no TypeScript
    /// ("Error", "TypeError", "RangeError"), e a mensagem é a mesma, palavra por palavra.
    /// </summary>
    public class EngineError : Exception
    {
        public string Name { get; }

        public EngineError(string message, string name = "Error") : base(message)
        {
            Name = name;
        }
    }
}
