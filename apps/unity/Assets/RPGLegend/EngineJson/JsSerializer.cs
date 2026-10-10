using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;

namespace RPGLegend.Engine.Json
{
    /// <summary>
    /// Lê e escreve os modelos da engine na forma exata do TypeScript, por reflexão:
    ///  - nome do campo = camelCase do nome C# (ou o de [JsName]);
    ///  - campo null é campo ausente (o undefined some do JSON), salvo os marcados com [KeepNull];
    ///  - número passa pelo Number() do JS na leitura e sai como {"$num":"NaN"} quando não é finito;
    ///  - OrderedMap vira objeto JSON na ordem das chaves; null dentro de mapa é o null do JS;
    ///  - campos que o C# não conhece ficam no membro [JsExtra] e voltam intactos.
    /// </summary>
    public static class JsSerializer
    {
        public static readonly JsonSerializer Serializer = JsonSerializer.Create(CreateSettings());

        static JsSerializer()
        {
            // Ensina a engine a converter os campos desconhecidos (JToken) quando um objeto vira um tipo que os conhece.
            JsExtras.Converter = (raw, type) => raw is JToken token ? token.ToObject(type, Serializer) : raw;
        }

        public static JsonSerializerSettings CreateSettings() => new JsonSerializerSettings
        {
            ContractResolver = new JsContractResolver(),
            NullValueHandling = NullValueHandling.Ignore,
            ObjectCreationHandling = ObjectCreationHandling.Replace,
            MetadataPropertyHandling = MetadataPropertyHandling.Ignore,
            DateParseHandling = DateParseHandling.None,
            FloatParseHandling = FloatParseHandling.Double,
            Converters = new List<JsonConverter> { new JsNumberConverter(), new OrderedMapConverter(), new AttributesConverter() },
        };

        /// <summary>Lê um valor JSON como T. Ausente ou null viram default(T).</summary>
        public static T Read<T>(JToken token)
        {
            if (JsJson.IsUndefined(token) || token.Type == JTokenType.Null) return default(T);
            return token.ToObject<T>(Serializer);
        }

        public static T Parse<T>(string json) => Read<T>(JsJson.Parse(json));

        /// <summary>Escreve um valor como JSON. null vira o null do JSON.</summary>
        public static JToken Write(object value) => value == null ? JValue.CreateNull() : JToken.FromObject(value, Serializer);
    }

    internal sealed class JsContractResolver : DefaultContractResolver
    {
        public JsContractResolver()
        {
            NamingStrategy = new CamelCaseNamingStrategy { ProcessDictionaryKeys = false, OverrideSpecifiedNames = false };
        }

        protected override JsonProperty CreateProperty(MemberInfo member, MemberSerialization memberSerialization)
        {
            var property = base.CreateProperty(member, memberSerialization);
            var name = member.GetCustomAttribute<JsNameAttribute>(true);
            if (name != null) property.PropertyName = name.Name;
            if (member.IsDefined(typeof(KeepNullAttribute), true)) property.NullValueHandling = NullValueHandling.Include;
            if (member.IsDefined(typeof(JsIgnoreAttribute), true) || member.IsDefined(typeof(JsExtraAttribute), true)) property.Ignored = true;
            return property;
        }

        protected override JsonObjectContract CreateObjectContract(Type objectType)
        {
            var contract = base.CreateObjectContract(objectType);
            var extra = FindExtraMember(objectType);
            if (extra != null)
            {
                contract.ExtensionDataValueType = typeof(JToken);
                contract.ExtensionDataSetter = (o, key, value) =>
                {
                    var bag = (JsExtras)extra.Get(o);
                    if (bag == null)
                    {
                        bag = new JsExtras();
                        extra.Set(o, bag);
                    }
                    bag.Set(key, value);
                };
                contract.ExtensionDataGetter = o =>
                {
                    var bag = (JsExtras)extra.Get(o);
                    return bag == null ? null : bag.Select(kv => new KeyValuePair<object, object>(kv.Key, kv.Value)).ToList();
                };
            }
            return contract;
        }

        private sealed class MemberAccess
        {
            public Func<object, object> Get;
            public Action<object, object> Set;
        }

        private static MemberAccess FindExtraMember(Type type)
        {
            foreach (var f in type.GetFields(BindingFlags.Public | BindingFlags.Instance))
                if (f.IsDefined(typeof(JsExtraAttribute), true) && f.FieldType == typeof(JsExtras))
                    return new MemberAccess { Get = f.GetValue, Set = f.SetValue };
            foreach (var p in type.GetProperties(BindingFlags.Public | BindingFlags.Instance))
                if (p.IsDefined(typeof(JsExtraAttribute), true) && p.PropertyType == typeof(JsExtras))
                    return new MemberAccess { Get = p.GetValue, Set = p.SetValue };
            return null;
        }
    }

    /// <summary>double e double? pelo Number() do JS; NaN/Infinity como {"$num": …}.</summary>
    internal sealed class JsNumberConverter : JsonConverter
    {
        public override bool CanConvert(Type objectType) => objectType == typeof(double) || objectType == typeof(double?);

        public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
        {
            var token = JToken.Load(reader);
            if (objectType == typeof(double?) && token.Type == JTokenType.Null) return null;
            return JsJson.ToNumber(token);
        }

        public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
        {
            if (value == null)
            {
                writer.WriteNull();
                return;
            }
            JsJson.FromNumber((double)value).WriteTo(writer);
        }
    }

    /// <summary>Qualquer OrderedMap (e suas subclasses: ItemStats, Equipment…) como objeto JSON.</summary>
    internal sealed class OrderedMapConverter : JsonConverter
    {
        public override bool CanConvert(Type objectType) => typeof(IOrderedMap).IsAssignableFrom(objectType);

        public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
        {
            var token = JToken.Load(reader);
            if (token.Type == JTokenType.Null) return null;
            var map = (IOrderedMap)Activator.CreateInstance(objectType);
            if (!(token is JObject obj)) return map;
            var valueType = map.ValueType;
            foreach (var p in obj.Properties())
            {
                object value;
                if (valueType == typeof(object)) value = p.Value.DeepClone();
                else if (p.Value.Type == JTokenType.Null && !valueType.IsValueType) value = null;
                else value = p.Value.ToObject(valueType, serializer);
                map.SetUntyped(p.Name, value);
            }
            return map;
        }

        public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
        {
            var map = (IOrderedMap)value;
            writer.WriteStartObject();
            foreach (var kv in map.UntypedEntries)
            {
                writer.WritePropertyName(kv.Key);
                if (kv.Value == null) writer.WriteNull();
                else serializer.Serialize(writer, kv.Value);
            }
            writer.WriteEndObject();
        }
    }

    /// <summary>Attributes: os seis atributos, com ausente virando NaN (o undefined numa conta do JS).</summary>
    internal sealed class AttributesConverter : JsonConverter
    {
        public override bool CanConvert(Type objectType) => objectType == typeof(Attributes);

        public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
        {
            var token = JToken.Load(reader);
            if (token.Type == JTokenType.Null) return null;
            var a = new Attributes();
            foreach (var key in StatKeys.Attrs) a[key] = JsJson.ToNumber(JsJson.Prop(token, key));
            return a;
        }

        public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
        {
            var a = (Attributes)value;
            writer.WriteStartObject();
            foreach (var key in StatKeys.Attrs)
            {
                writer.WritePropertyName(key);
                JsJson.FromNumber(a[key]).WriteTo(writer);
            }
            writer.WriteEndObject();
        }
    }
}
