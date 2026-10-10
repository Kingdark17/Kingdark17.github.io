using System;

namespace RPGLegend.Engine
{
    // Marcações que a camada de JSON (RPGLegend.Engine.Json) lê para escrever os modelos na forma
    // exata do TypeScript. A engine não depende de biblioteca de JSON nenhuma: só marca os campos.
    //
    // Regra geral: o nome no JSON é o camelCase do nome C#; campo null é campo ausente (undefined).

    /// <summary>Nome do campo no JSON quando não é o camelCase do nome C# (ex.: "RACES", "power").</summary>
    [AttributeUsage(AttributeTargets.Field | AttributeTargets.Property)]
    public sealed class JsNameAttribute : Attribute
    {
        public string Name { get; }

        public JsNameAttribute(string name)
        {
            Name = name;
        }
    }

    /// <summary>null neste campo é o null do JS e vai escrito no JSON — não é ausência. Ex.: <c>attr: null</c>.</summary>
    [AttributeUsage(AttributeTargets.Field | AttributeTargets.Property)]
    public sealed class KeepNullAttribute : Attribute
    {
    }

    /// <summary>Campo só do C#, que não entra no JSON.</summary>
    [AttributeUsage(AttributeTargets.Field | AttributeTargets.Property)]
    public sealed class JsIgnoreAttribute : Attribute
    {
    }

    /// <summary>
    /// Guarda os campos do JSON que o C# não conhece, para devolvê-los intactos ao salvar.
    /// Sem isso, um campo que o cliente web gravou e o C# ainda não conhece sumiria do save
    /// na primeira vez que o jogo da Unity o regravasse.
    /// </summary>
    [AttributeUsage(AttributeTargets.Field | AttributeTargets.Property)]
    public sealed class JsExtraAttribute : Attribute
    {
    }

    /// <summary>Os campos desconhecidos de um objeto. Os valores são opacos para a engine: ela só os copia.</summary>
    public sealed class JsExtras : OrderedMap<object>
    {
        /// <summary>
        /// Converte um valor guardado aqui para um tipo da engine. Quem preenche é a camada de JSON
        /// (RPGLegend.Engine.Json.JsSerializer), porque só ela sabe ler o valor opaco.
        /// </summary>
        public static Func<object, Type, object> Converter;

        public JsExtras Clone()
        {
            var c = new JsExtras();
            CopyTo(c);
            return c;
        }

        /// <summary>
        /// Tira a chave daqui e devolve o valor convertido para T. Serve para quando um objeto lido como um
        /// tipo mais pobre (ex.: MonsterInstance) vira um tipo que conhece o campo (CombatMonster): no JS o
        /// spread leva a chave junto e ela continua valendo; aqui ela sai do Extra e vai para o campo.
        /// </summary>
        public bool TryTake<T>(string key, out T value)
        {
            value = default(T);
            if (!TryGet(key, out var raw)) return false;
            Remove(key);
            if (raw == null) return true;
            if (raw is T typed)
            {
                value = typed;
                return true;
            }
            if (Converter == null)
                throw new InvalidOperationException("JsExtras.Converter não configurado: carregue RPGLegend.Engine.Json antes.");
            value = (T)Converter(raw, typeof(T));
            return true;
        }
    }
}
