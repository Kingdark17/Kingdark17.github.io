using System;
using System.Collections;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>Acesso sem tipo a um <see cref="OrderedMap{TValue}"/> — é por onde a camada de JSON lê e escreve qualquer mapa.</summary>
    public interface IOrderedMap
    {
        Type ValueType { get; }
        void SetUntyped(string key, object value);
        IEnumerable<KeyValuePair<string, object>> UntypedEntries { get; }
    }

    /// <summary>
    /// Mapa que guarda a ordem de inserção das chaves, como um objeto do JS.
    /// Chave ausente é o <c>undefined</c> do TypeScript; chave presente com valor null é o <c>null</c>.
    ///
    /// Cuidado do porte: o JS deixa adicionar chaves enquanto percorre <c>Object.keys(obj)</c>,
    /// porque a lista é uma cópia. Aqui, percorra <c>new List&lt;string&gt;(map.Keys)</c> se for alterar o mapa.
    /// </summary>
    public class OrderedMap<TValue> : IEnumerable<KeyValuePair<string, TValue>>, IOrderedMap
    {
        private readonly List<string> _keys = new List<string>();
        private readonly Dictionary<string, TValue> _values = new Dictionary<string, TValue>();

        public int Count => _keys.Count;

        public IReadOnlyList<string> Keys => _keys;

        public bool Has(string key) => key != null && _values.ContainsKey(key);

        public bool TryGet(string key, out TValue value)
        {
            if (key == null)
            {
                value = default(TValue);
                return false;
            }
            return _values.TryGetValue(key, out value);
        }

        /// <summary>O valor, ou default quando a chave não existe (o <c>obj[key]</c> do JS, com undefined virando default).</summary>
        public TValue Get(string key) => TryGet(key, out var v) ? v : default(TValue);

        public void Set(string key, TValue value)
        {
            if (!_values.ContainsKey(key)) _keys.Add(key);
            _values[key] = value;
        }

        public bool Remove(string key)
        {
            if (key == null || !_values.Remove(key)) return false;
            _keys.Remove(key);
            return true;
        }

        public TValue this[string key]
        {
            get => _values[key];
            set => Set(key, value);
        }

        /// <summary>Copia as entradas, na ordem, para outro mapa (o <c>{ ...obj }</c> raso do JS).</summary>
        public void CopyTo(OrderedMap<TValue> target)
        {
            foreach (var k in _keys) target.Set(k, _values[k]);
        }

        public IEnumerator<KeyValuePair<string, TValue>> GetEnumerator()
        {
            foreach (var k in _keys) yield return new KeyValuePair<string, TValue>(k, _values[k]);
        }

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        Type IOrderedMap.ValueType => typeof(TValue);

        void IOrderedMap.SetUntyped(string key, object value) => Set(key, (TValue)value);

        IEnumerable<KeyValuePair<string, object>> IOrderedMap.UntypedEntries
        {
            get
            {
                foreach (var k in _keys) yield return new KeyValuePair<string, object>(k, _values[k]);
            }
        }
    }
}
