using System;
using System.Collections.Generic;
using UnityEngine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>
    /// Os efeitos da luta (2026-11-13): folhas de quadros em <c>Art/Jogo/Resources/Efeitos</c>, desenhadas em código
    /// com a pixelfx no estilo do Breno e exportadas por <c>apps/unity/Efeitos~/exporta.mjs</c>, que também escreve o
    /// <c>efeitos.json</c> (tamanho do quadro, colunas, fps e o ponto de apoio de cada uma). Aqui os quadros são
    /// recortados uma vez, com o apoio no ponto do efeito (o pé, o ponto do golpe), 1 pixel = 1 unidade.
    /// </summary>
    public static class Efeitos
    {
        [Serializable]
        private sealed class Indice
        {
            public List<Dados> efeitos = new List<Dados>();
        }

        [Serializable]
        public sealed class Dados
        {
            public string nome;
            public float fps;
            public int quadros;
            public int largura;
            public int altura;
            public int colunas;
            public float origemX;
            public float origemY;
            public bool laco;
        }

        public sealed class Folha
        {
            public Dados Dados;
            public Sprite[] Quadros;
        }

        private static Dictionary<string, Dados> _indice;
        private static readonly Dictionary<string, Folha> Folhas = new Dictionary<string, Folha>();

        /// <summary>A folha do efeito, ou null se não existir (o jogo segue sem ele).</summary>
        public static Folha Pegar(string nome)
        {
            if (string.IsNullOrEmpty(nome)) return null;
            // Os quadros recortados fora do Play (num teste) morrem ao entrar nele: aí a folha é recortada de novo.
            if (Folhas.TryGetValue(nome, out var pronta) && (pronta == null || pronta.Quadros.Length == 0 || pronta.Quadros[0] != null)) return pronta;
            Folha folha = null;
            if (LerIndice().TryGetValue(nome, out var dados))
            {
                var textura = Resources.Load<Texture2D>("Efeitos/" + nome);
                if (textura != null) folha = new Folha { Dados = dados, Quadros = Recortar(textura, dados) };
            }
            Folhas[nome] = folha;
            return folha;
        }

        private static Dictionary<string, Dados> LerIndice()
        {
            if (_indice != null) return _indice;
            _indice = new Dictionary<string, Dados>();
            var texto = Resources.Load<TextAsset>("Efeitos/efeitos");
            if (texto == null) return _indice;
            var lido = JsonUtility.FromJson<Indice>(texto.text);
            if (lido?.efeitos != null)
                foreach (var dados in lido.efeitos)
                    if (!string.IsNullOrEmpty(dados.nome)) _indice[dados.nome] = dados;
            return _indice;
        }

        /// <summary>Os quadros, da esquerda pra direita e de cima pra baixo na folha (a Unity conta y de baixo).</summary>
        private static Sprite[] Recortar(Texture2D textura, Dados d)
        {
            var quadros = new Sprite[d.quadros];
            var apoio = new Vector2(d.origemX / d.largura, 1f - d.origemY / d.altura);
            for (int i = 0; i < d.quadros; i++)
            {
                int coluna = i % d.colunas, linha = i / d.colunas;
                var retangulo = new Rect(coluna * d.largura, textura.height - (linha + 1) * d.altura, d.largura, d.altura);
                quadros[i] = Sprite.Create(textura, retangulo, apoio, 1f);
                quadros[i].name = d.nome + " " + i;
            }
            return quadros;
        }
    }
}
