using System;
using RPGLegend.Game.Jogo;
using UnityEngine;
using UnityEngine.UIElements;

namespace RPGLegend.Game.App
{
    /// <summary>
    /// Configurações (painel-configuracoes.tsx do site): o som liga e desliga, o volume geral e o dos efeitos, um
    /// efeito de teste e os créditos. A preferência é do aparelho (<see cref="PreferenciaDeSom"/>), e o app ainda não
    /// tem música: o volume geral vale pra todo o som que há.
    /// </summary>
    public sealed class TelaDeConfiguracoes
    {
        private const string PaginaDaFonte = "https://www.dafont.com/alkhemikal.font";
        private const string Licenca = "https://creativecommons.org/licenses/by/4.0/deed.pt-br";

        private readonly VisualElement _tela;
        private readonly Button _som, _testar;
        private readonly SliderInt _volume, _efeitos;
        private readonly Label _valorDoVolume, _valorDosEfeitos;

        public event Action AoVoltar;

        public TelaDeConfiguracoes(VisualElement raiz)
        {
            _tela = raiz.Q("configuracoes");
            _som = raiz.Q<Button>("botao-som");
            _testar = raiz.Q<Button>("botao-testar-som");
            _volume = raiz.Q<SliderInt>("volume-geral");
            _efeitos = raiz.Q<SliderInt>("volume-dos-efeitos");
            _valorDoVolume = raiz.Q<Label>("valor-do-volume");
            _valorDosEfeitos = raiz.Q<Label>("valor-dos-efeitos");

            _som.clicked += () =>
            {
                PreferenciaDeSom.Ligado = !PreferenciaDeSom.Ligado;
                Desenhar();
            };
            _volume.RegisterValueChangedCallback(e =>
            {
                PreferenciaDeSom.Volume = e.newValue / 100f;
                Desenhar();
            });
            _efeitos.RegisterValueChangedCallback(e =>
            {
                PreferenciaDeSom.Efeitos = e.newValue / 100f;
                Desenhar();
            });
            // Sem isto o controle é cego: ninguém arrasta o volume numa tela em silêncio e sabe onde parou. É o mesmo
            // "gold" do jogo, então o que se ouve aqui é o que se ouve lá.
            _testar.clicked += () => Sons.Tocar("gold");
            raiz.Q<Button>("link-da-fonte").clicked += () => Application.OpenURL(PaginaDaFonte);
            raiz.Q<Button>("link-da-licenca").clicked += () => Application.OpenURL(Licenca);
            raiz.Q<Button>("botao-voltar-config").clicked += () => AoVoltar?.Invoke();
        }

        public void Abrir()
        {
            Desenhar();
            _tela.RemoveFromClassList("oculto");
        }

        public void Fechar()
        {
            PreferenciaDeSom.Gravar();
            _tela.AddToClassList("oculto");
        }

        private void Desenhar()
        {
            bool ligado = PreferenciaDeSom.Ligado;
            int volume = Mathf.RoundToInt(PreferenciaDeSom.Volume * 100f);
            int efeitos = Mathf.RoundToInt(PreferenciaDeSom.Efeitos * 100f);
            _som.text = ligado ? "🔊 LIGADO" : "🔇 DESLIGADO";
            _volume.SetValueWithoutNotify(volume);
            _efeitos.SetValueWithoutNotify(efeitos);
            _valorDoVolume.text = volume + "%";
            _valorDosEfeitos.text = efeitos + "%";
            _volume.SetEnabled(ligado);
            _efeitos.SetEnabled(ligado);
            _testar.SetEnabled(ligado);
        }
    }
}
