using System;
using System.Threading;
using UnityEngine;

namespace RPGLegend.Game.App
{
    /// <summary>Animação por código: um passo por quadro, de 0 a 1, com as curvas de suavização usadas no app.</summary>
    public static class Tween
    {
        /// <summary>Chama <paramref name="passo"/> a cada quadro com o progresso (0 → 1) ao longo de <paramref name="segundos"/>.</summary>
        public static async Awaitable Durante(float segundos, Action<float> passo, CancellationToken cancelar)
        {
            if (segundos <= 0f)
            {
                passo(1f);
                return;
            }
            float t = 0f;
            while (t < segundos)
            {
                passo(t / segundos);
                await Awaitable.NextFrameAsync(cancelar);
                t += Time.deltaTime;
            }
            passo(1f);
        }

        public static float SaiCubica(float t) => 1f - Mathf.Pow(1f - t, 3f);

        public static float EntraCubica(float t) => t * t * t;

        public static float EntraESaiSeno(float t) => -(Mathf.Cos(Mathf.PI * t) - 1f) / 2f;
    }
}
