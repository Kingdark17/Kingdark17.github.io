using System;
using System.Globalization;

namespace RPGLegend.Engine
{
    /// <summary>
    /// Semântica numérica do JavaScript.
    ///
    /// Regra do porte: todo número da engine é <c>double</c>, como no JS, e toda operação
    /// em que C# e JS discordam passa por aqui. Os casos clássicos:
    ///  - <c>Math.round</c> do JS sobe no .5 (2.5 → 3, -2.5 → -2); o Math.Round do C# vai para o par.
    ///  - <c>Math.max/min</c> do JS propagam NaN e consideram +0 maior que -0.
    ///  - <c>x &gt;&gt;&gt; 0</c> e <c>x | 0</c> são ToUint32/ToInt32 (dão a volta em 2^32).
    ///  - <c>Number("…")</c> tem regras próprias de texto (espaços, hexadecimal, "Infinity").
    /// </summary>
    public static class Js
    {
        // ---------- Math ----------

        /// <summary>Math.round do JS: o meio sobe (2.5 → 3, -2.5 → -2, -0.4 → -0).</summary>
        public static double Round(double x)
        {
            if (double.IsNaN(x) || double.IsInfinity(x)) return x;
            double r = Math.Floor(x);
            if (x - r >= 0.5) r += 1.0;
            if (r == 0.0 && (x < 0.0 || IsNegativeZero(x))) return -0.0;
            return r;
        }

        /// <summary>Math.max do JS com dois valores: NaN contamina e +0 vence -0.</summary>
        public static double Max(double a, double b)
        {
            if (double.IsNaN(a) || double.IsNaN(b)) return double.NaN;
            if (a == b) return (a == 0.0 && IsNegativeZero(a)) ? b : a;
            return a > b ? a : b;
        }

        /// <summary>Math.min do JS com dois valores: NaN contamina e -0 vence +0.</summary>
        public static double Min(double a, double b)
        {
            if (double.IsNaN(a) || double.IsNaN(b)) return double.NaN;
            if (a == b) return (a == 0.0 && IsNegativeZero(b)) ? b : a;
            return a < b ? a : b;
        }

        /// <summary>Math.max do JS com vários valores (sem nenhum, dá -Infinity).</summary>
        public static double Max(params double[] values)
        {
            double r = double.NegativeInfinity;
            foreach (var v in values) r = Max(r, v);
            return r;
        }

        /// <summary>Math.min do JS com vários valores (sem nenhum, dá Infinity).</summary>
        public static double Min(params double[] values)
        {
            double r = double.PositiveInfinity;
            foreach (var v in values) r = Min(r, v);
            return r;
        }

        public static bool IsNegativeZero(double x) => x == 0.0 && double.IsNegativeInfinity(1.0 / x);

        /// <summary>Number.isFinite.</summary>
        public static bool IsFinite(double x) => !double.IsNaN(x) && !double.IsInfinity(x);

        /// <summary>Verdade de um número no JS: 0, -0 e NaN são falsos.</summary>
        public static bool Truthy(double x) => !(x == 0.0 || double.IsNaN(x));

        /// <summary>Verdade de um número opcional: ausente (undefined) também é falso.</summary>
        public static bool Truthy(double? x) => x.HasValue && Truthy(x.Value);

        /// <summary>Verdade de um texto no JS: null/undefined e "" são falsos.</summary>
        public static bool Truthy(string s) => !string.IsNullOrEmpty(s);

        /// <summary>O número de um campo opcional numa conta do JS: undefined vira NaN.</summary>
        public static double Num(double? x) => x ?? double.NaN;

        /// <summary>ToUint32 do ECMAScript (o que <c>x &gt;&gt;&gt; 0</c> faz).</summary>
        public static uint ToUint32(double d)
        {
            if (!IsFinite(d)) return 0u;
            d = Math.Truncate(d);
            d %= 4294967296.0;
            if (d < 0) d += 4294967296.0;
            return (uint)d;
        }

        /// <summary>ToInt32 do ECMAScript (o que <c>x | 0</c> faz).</summary>
        public static int ToInt32(double d) => unchecked((int)ToUint32(d));

        // ---------- relógio e texto ----------

        /// <summary>Date.now() do JS: milissegundos desde 1970, em UTC.</summary>
        public static double DateNow() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        /// <summary>Texto como o template literal do JS escreve um campo de texto: ausente vira "undefined".</summary>
        public static string Str(string s) => s ?? "undefined";

        // ---------- Number(texto) ----------

        /// <summary>Number(s) do JS para texto: espaços nas pontas são ignorados, vazio vira 0, aceita 0x/0o/0b e "Infinity", resto inválido vira NaN.</summary>
        public static double StringToNumber(string s)
        {
            if (s == null) return double.NaN;
            s = TrimJsWhitespace(s);
            if (s.Length == 0) return 0.0;

            if (s.Length > 2 && s[0] == '0')
            {
                char p = s[1];
                int radix = (p == 'x' || p == 'X') ? 16 : (p == 'o' || p == 'O') ? 8 : (p == 'b' || p == 'B') ? 2 : 0;
                if (radix != 0) return ParseRadix(s.Substring(2), radix);
            }

            bool negative = s[0] == '-';
            string unsigned = (s[0] == '+' || s[0] == '-') ? s.Substring(1) : s;
            if (unsigned == "Infinity") return negative ? double.NegativeInfinity : double.PositiveInfinity;
            if (!IsDecimalLiteral(unsigned)) return double.NaN;

            try
            {
                return double.Parse(s,
                    NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint | NumberStyles.AllowExponent,
                    CultureInfo.InvariantCulture);
            }
            catch (OverflowException)
            {
                return negative ? double.NegativeInfinity : double.PositiveInfinity;
            }
        }

        private static bool IsDecimalLiteral(string t)
        {
            int i = 0, n = t.Length, digits = 0;
            while (i < n && IsDigit(t[i])) { i++; digits++; }
            if (i < n && t[i] == '.')
            {
                i++;
                while (i < n && IsDigit(t[i])) { i++; digits++; }
            }
            if (digits == 0) return false;
            if (i < n && (t[i] == 'e' || t[i] == 'E'))
            {
                i++;
                if (i < n && (t[i] == '+' || t[i] == '-')) i++;
                int exp = 0;
                while (i < n && IsDigit(t[i])) { i++; exp++; }
                if (exp == 0) return false;
            }
            return i == n;
        }

        private static double ParseRadix(string digits, int radix)
        {
            if (digits.Length == 0) return double.NaN;
            double v = 0;
            foreach (char c in digits)
            {
                int d = (c >= '0' && c <= '9') ? c - '0'
                      : (c >= 'a' && c <= 'z') ? c - 'a' + 10
                      : (c >= 'A' && c <= 'Z') ? c - 'A' + 10
                      : 99;
                if (d >= radix) return double.NaN;
                v = v * radix + d;
            }
            return v;
        }

        private static bool IsDigit(char c) => c >= '0' && c <= '9';

        private static string TrimJsWhitespace(string s)
        {
            int start = 0, end = s.Length - 1;
            while (start <= end && IsJsWhitespace(s[start])) start++;
            while (end >= start && IsJsWhitespace(s[end])) end--;
            return s.Substring(start, end - start + 1);
        }

        /// <summary>Espaço em branco e fim de linha do ECMAScript (pelo código do caractere).</summary>
        private static bool IsJsWhitespace(char c)
        {
            int code = c;
            switch (code)
            {
                case 0x0009: case 0x000A: case 0x000B: case 0x000C: case 0x000D: case 0x0020:
                case 0x00A0: case 0x1680: case 0x2028: case 0x2029: case 0x202F: case 0x205F:
                case 0x3000: case 0xFEFF:
                    return true;
                default:
                    return code >= 0x2000 && code <= 0x200A;
            }
        }

        // ---------- String(número) ----------

        /// <summary>
        /// String(x) do JS: menor quantidade de dígitos que reproduz o número, inteiro sem casa
        /// decimal, notação científica fora de [1e-6, 1e21).
        /// </summary>
        public static string NumberToString(double x)
        {
            if (double.IsNaN(x)) return "NaN";
            if (x == 0) return "0";
            if (double.IsPositiveInfinity(x)) return "Infinity";
            if (double.IsNegativeInfinity(x)) return "-Infinity";
            if (x < 0) return "-" + NumberToString(-x);

            // Dígitos mais curtos que voltam ao mesmo double (o "shortest round-trip" do JS).
            string sci = null;
            for (int p = 1; p <= 17; p++)
            {
                string candidate = x.ToString("E" + (p - 1), CultureInfo.InvariantCulture);
                if (double.Parse(candidate, NumberStyles.Float, CultureInfo.InvariantCulture) == x) { sci = candidate; break; }
            }
            if (sci == null) sci = x.ToString("E16", CultureInfo.InvariantCulture);

            int e = sci.IndexOf('E');
            string mantissa = sci.Substring(0, e);
            int exponent = int.Parse(sci.Substring(e + 1), NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture);
            string digits = mantissa.Replace(".", "").TrimEnd('0');
            if (digits.Length == 0) digits = "0";

            int k = digits.Length;
            int n = exponent + 1; // valor = 0.d1d2...dk * 10^n
            if (k <= n && n <= 21) return digits + new string('0', n - k);
            if (0 < n && n <= 21) return digits.Substring(0, n) + "." + digits.Substring(n);
            if (-6 < n && n <= 0) return "0." + new string('0', -n) + digits;

            int e1 = n - 1;
            string expText = e1 >= 0 ? "+" + e1.ToString(CultureInfo.InvariantCulture) : e1.ToString(CultureInfo.InvariantCulture);
            return k == 1 ? digits + "e" + expText : digits.Substring(0, 1) + "." + digits.Substring(1) + "e" + expText;
        }
    }
}
