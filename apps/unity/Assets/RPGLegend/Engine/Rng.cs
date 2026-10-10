using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>Retorna um número em [0, 1), igual ao contrato de Math.random (port de shared/src/rng.ts).</summary>
    public delegate double RngFn();

    public static class Rng
    {
        private static readonly Random SystemRandom = new Random();

        /// <summary>Equivalente ao defaultRng (Math.random) do TypeScript.</summary>
        public static readonly RngFn Default = () => SystemRandom.NextDouble();

        /// <summary>Inteiro em [0, max). TS: randomInt.</summary>
        public static double RandomInt(double max, RngFn rng = null)
        {
            rng = rng ?? Default;
            return Math.Floor(rng() * max);
        }

        /// <summary>Escolhe um elemento; lança se a lista estiver vazia, sem sortear. TS: pick.</summary>
        public static T Pick<T>(IReadOnlyList<T> list, RngFn rng = null)
        {
            if (list.Count == 0) throw new EngineError("pick() recebeu uma lista vazia");
            rng = rng ?? Default;
            return list[(int)RandomInt(list.Count, rng)];
        }

        /// <summary>
        /// PRNG determinístico mulberry32, bit a bit igual ao seededRng do TypeScript.
        /// A seed passa por ToUint32 (o "seed &gt;&gt;&gt; 0" do JS).
        /// </summary>
        public static RngFn SeededRng(double seed)
        {
            uint state = Js.ToUint32(seed);
            return () =>
            {
                unchecked
                {
                    state += 0x6D2B79F5u;
                    uint t = state;
                    t = (t ^ (t >> 15)) * (t | 1u);
                    t ^= t + (t ^ (t >> 7)) * (t | 61u);
                    return (t ^ (t >> 14)) / 4294967296.0;
                }
            };
        }
    }
}
