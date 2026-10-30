using UnityEngine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// Se o som está ligado e em que volume (lib/som/preferencia.ts do site). É do aparelho, não da conta: mora no
    /// PlayerPrefs, como no site mora no localStorage, e quem joga no celular e no computador ajusta cada um do seu
    /// jeito. O volume dos efeitos é relativo ao geral: abaixar o geral abaixa tudo; o dos efeitos, só eles.
    /// </summary>
    public static class PreferenciaDeSom
    {
        /// <summary>O volume inicial do site (VOLUME_PADRAO).</summary>
        public const float VolumePadrao = 0.28f;

        private const string ChaveLigado = "rpgLegend.som.ligado";
        private const string ChaveVolume = "rpgLegend.som.volume";
        private const string ChaveEfeitos = "rpgLegend.som.efeitos";

        private static bool _lida;
        private static bool _ligado;
        private static float _volume, _efeitos;

        public static bool Ligado
        {
            get { Ler(); return _ligado; }
            set { Ler(); _ligado = value; PlayerPrefs.SetInt(ChaveLigado, value ? 1 : 0); }
        }

        /// <summary>O volume geral, de 0 a 1.</summary>
        public static float Volume
        {
            get { Ler(); return _volume; }
            set { Ler(); _volume = Mathf.Clamp01(value); PlayerPrefs.SetFloat(ChaveVolume, _volume); }
        }

        /// <summary>O volume dos efeitos, de 0 a 1, por cima do geral.</summary>
        public static float Efeitos
        {
            get { Ler(); return _efeitos; }
            set { Ler(); _efeitos = Mathf.Clamp01(value); PlayerPrefs.SetFloat(ChaveEfeitos, _efeitos); }
        }

        /// <summary>O ganho de cada efeito: o geral (zero com o som desligado) vezes o dos efeitos.</summary>
        public static float GanhoDosEfeitos => Ligado ? Volume * Efeitos : 0f;

        /// <summary>
        /// Grava no disco. Os deslizantes mudam a cada quadro do arraste, e gravar a cada um seria escrever o arquivo
        /// dezenas de vezes por segundo no celular: quem mexe chama isto ao fechar a tela.
        /// </summary>
        public static void Gravar() => PlayerPrefs.Save();

        private static void Ler()
        {
            if (_lida) return;
            _lida = true;
            _ligado = PlayerPrefs.GetInt(ChaveLigado, 1) != 0;
            _volume = Mathf.Clamp01(PlayerPrefs.GetFloat(ChaveVolume, VolumePadrao));
            _efeitos = Mathf.Clamp01(PlayerPrefs.GetFloat(ChaveEfeitos, 1f));
        }
    }
}
