// Substituto mínimo do NUnit, SÓ para rodar os testes fora da Unity (o nuget.org está fora de alcance
// neste ambiente). Implementa apenas o que os testes de Assets/RPGLegend/Tests usam. Na Unity, o mesmo
// código de teste roda com o NUnit de verdade — este arquivo nunca vai para o projeto.
using System;
using System.Collections.Generic;
using System.Globalization;

namespace NUnit.Framework
{
    public class AssertionException : Exception { public AssertionException(string message) : base(message) { } }
    public class IgnoreException : Exception { public IgnoreException(string message) : base(message) { } }
    public class InconclusiveException : Exception { public InconclusiveException(string message) : base(message) { } }
    public class SuccessException : Exception { public SuccessException(string message) : base(message) { } }

    [AttributeUsage(AttributeTargets.Method, AllowMultiple = true)]
    public sealed class TestCaseSourceAttribute : Attribute
    {
        public string SourceName { get; }
        public TestCaseSourceAttribute(string sourceName) { SourceName = sourceName; }
    }

    [AttributeUsage(AttributeTargets.Method)]
    public sealed class TestAttribute : Attribute { }

    public sealed class TestCaseData
    {
        public object[] Arguments { get; }
        public string TestName { get; private set; }
        public List<string> Categories { get; } = new List<string>();

        public TestCaseData(params object[] args) { Arguments = args; }

        public TestCaseData SetName(string name) { TestName = name; return this; }

        public TestCaseData SetCategory(string category) { Categories.Add(category); return this; }
    }

    public static class Assert
    {
        public static void Fail(string message) => throw new AssertionException(message);

        public static void Ignore(string message) => throw new IgnoreException(message);

        public static void IsTrue(bool condition, string message = null)
        {
            if (!condition) throw new AssertionException(message ?? "esperava true");
        }

        public static void IsNotNull(object value, string message = null)
        {
            if (value == null) throw new AssertionException(message ?? "esperava não-nulo");
        }

        public static void AreEqual(object expected, object actual, string message = null)
        {
            if (Same(expected, actual)) return;
            throw new AssertionException((message != null ? message + "\n" : "") + "  Esperado: " + Show(expected) + "\n  Veio:     " + Show(actual));
        }

        private static bool Same(object a, object b)
        {
            if (a == null || b == null) return a == null && b == null;
            if (IsNumeric(a) && IsNumeric(b))
                return Convert.ToDouble(a, CultureInfo.InvariantCulture) == Convert.ToDouble(b, CultureInfo.InvariantCulture);
            return a.Equals(b);
        }

        private static bool IsNumeric(object o) =>
            o is int || o is long || o is double || o is float || o is decimal || o is short || o is uint || o is ulong;

        private static string Show(object o) => o == null ? "null" : o is string s ? "\"" + s + "\"" : Convert.ToString(o, CultureInfo.InvariantCulture);
    }
}
