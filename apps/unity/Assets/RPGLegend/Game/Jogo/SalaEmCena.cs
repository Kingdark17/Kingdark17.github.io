using System;
using System.Collections.Generic;
using RPGLegend.Engine;
using UnityEngine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>Uma sala da masmorra emendada, no lugar dela na grade do andar (desenho-da-sala.ts: SalaDesenhada).</summary>
    public sealed class SalaNaCena
    {
        public double X;
        public double Y;
        public RoomLayout Planta;
        /// <summary>A figura de cada objeto da planta, pelo id. A sala apagada não mostra nenhuma.</summary>
        public Dictionary<string, Figura> Figuras;
        /// <summary>Já entrou nela (ou é a atual): sem sombra.</summary>
        public bool Acesa;
    }

    /// <summary>
    /// A sala desenhada e o herói andando solto nela (o desenho-da-sala.ts e a cena-da-sala.tsx do site): chão xadrez
    /// e paredes na cor do lugar, o conteúdo e os extras ancorados no pé, a parede rachada riscada e o herói —
    /// tudo ordenado pelo pé, pra quem passa por trás do baú sumir atrás dele.
    ///
    /// A regra de andar é da engine (<see cref="AndarNaSala"/> e <see cref="RoomWalk"/>), a mesma do site: aqui ficam
    /// o relógio (passos fixos de 1/60 s) e o desenho. A cena desenha numa textura que a tela mostra no palco; as
    /// coordenadas são as do site (48 px por quadrado, y pra baixo), num canto longe da cena da porta.
    ///
    /// Na masmorra as salas são emendadas (2026-10-30, pedido do Breno, como no site): <see cref="MostrarMasmorra"/>
    /// desenha a sala atual e as em volta, cada uma no lugar dela no andar, e a câmera segue o herói, que fica na
    /// posição da sala atual mais a dele dentro dela. A vizinha em que ele ainda não entrou fica na sombra.
    /// </summary>
    public sealed partial class SalaEmCena : MonoBehaviour
    {
        public const float Lado = 48f;
        private const int OrdemDoChao = -20000;
        private const int OrdemDaRachadura = -19000;
        private static readonly Vector3 Origem = new Vector3(10000f, 0f, 0f);
        private static readonly Color Fundo = new Color32(5, 6, 10, 255);
        private static readonly Color CorDaRachadura = new Color32(0x1a, 0x0b, 0x09, 255);

        private float _largura, _altura, _escala, _escalaDaSala;
        /// <summary>A cena mostra a cidade desenhada do Breno (camadas e câmera seguindo o herói), e não uma sala.</summary>
        private bool _naCidade;
        private const int OrdemDeCima = 30000;
        /// <summary>A rachadura na sala desenhada: por cima das camadas de cima (as árvores dos lados cobrem a parede).</summary>
        private const int OrdemDaRachaduraNaArte = OrdemDeCima + 100;
        /// <summary>A sombra da vizinha em que o herói ainda não entrou: por cima de tudo, até das copas.</summary>
        private const int OrdemDaSombra = OrdemDaRachaduraNaArte + 100;
        private static readonly Color CorDaSombra = new Color(0.02f, 0.024f, 0.04f, 0.78f);
        /// <summary>A masmorra emendada: a câmera segue o herói, contado do canto da sala atual (em pixel do site).</summary>
        private bool _emendada;
        private float _origemX, _origemY;
        /// <summary>Na cidade, as camadas do meio, que ficam meio transparentes quando cobrem o herói.</summary>
        private readonly List<(CamadaDaCidade Camada, SpriteRenderer Desenho)> _doMeio = new List<(CamadaDaCidade, SpriteRenderer)>();
        /// <summary>Quanto se vê da camada que cobre o herói (meio transparente), e em quantos segundos chega lá.</summary>
        private const float AlfaDeQuemCobre = 0.5f;
        private const float SegundosDoEsmaecer = 0.15f;
        private Camera _camera;
        private Sprite _branco;
        private Transform _desenho;
        private Transform _boneco;
        private SpriteRenderer _corpo;
        private string _arteDoHeroi;
        private int _fase;

        private RoomLayout _planta;
        private string _assinaturaDoDesenho;
        private string _salaDaCena;
        private Walker _walker;
        private string _tocando;
        private double _sobra;
        private string _saiuDe;

        /// <summary>A textura onde a sala é desenhada (a tela a põe no palco).</summary>
        public RenderTexture Textura { get; private set; }

        /// <summary>Só anda quando a exploração está livre — sem tela, pergunta ou conversa na frente.</summary>
        public bool Ativo;
        /// <summary>Lida a cada passo: as teclas e o joystick, de -1 a 1.</summary>
        public Func<Vetor> Entrada;
        /// <summary>Atravessou o vão desta porta. Devolve se a sala mudou; se não, o herói volta pra dentro.</summary>
        public Func<string, bool> AoSair;
        /// <summary>Encostou neste objeto agora.</summary>
        public Action<string> AoEncostar;

        /// <summary>Onde o herói está, pra quem quiser saber (ex.: o diário de testes).</summary>
        public Walker Walker => _walker;

        public static SalaEmCena Criar()
        {
            var objeto = new GameObject("Sala do jogo");
            var sala = objeto.AddComponent<SalaEmCena>();
            sala.Montar();
            return sala;
        }

        private void Montar()
        {
            var regra = GameData.RoomWalkTable;
            _largura = (float)regra.RoomCols * Lado;
            _altura = (float)regra.RoomRows * Lado;
            _escala = Lado / (float)regra.TileUnits;
            _escalaDaSala = _escala;

            // 2× o tamanho do site, pra o emoji e o boneco não serrilharem quando a tela amplia. O URP (render graph)
            // exige depth na textura de saída da câmera: sem ele, reclama a cada quadro.
            Textura = new RenderTexture((int)(_largura * 2), (int)(_altura * 2), 24) { filterMode = FilterMode.Point, name = "Sala" };
            Textura.Create();

            var olho = new GameObject("Câmera da sala");
            olho.transform.SetParent(transform, false);
            _camera = olho.AddComponent<Camera>();
            _camera.orthographic = true;
            _camera.orthographicSize = _altura / 2f;
            _camera.clearFlags = CameraClearFlags.SolidColor;
            _camera.backgroundColor = Fundo;
            _camera.targetTexture = Textura;
            _camera.nearClipPlane = 0.1f;
            _camera.farClipPlane = 100f;
            olho.transform.position = Origem + new Vector3(_largura / 2f, _altura / 2f, -10f);

            var branco = new Texture2D(1, 1, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point };
            branco.SetPixel(0, 0, Color.white);
            branco.Apply();
            _branco = Sprite.Create(branco, new Rect(0, 0, 1, 1), new Vector2(0.5f, 0.5f), 1f);

            _desenho = new GameObject("Desenho").transform;
            _desenho.SetParent(transform, false);

            _boneco = new GameObject("Herói").transform;
            _boneco.SetParent(transform, false);
            var corpo = new GameObject("Corpo");
            corpo.transform.SetParent(_boneco, false);
            _corpo = corpo.AddComponent<SpriteRenderer>();
        }

        private void OnDestroy()
        {
            if (Textura != null) Textura.Release();
        }

        /// <summary>
        /// A proporção do palco (largura / altura), que é a tela toda: a textura acompanha, com a mesma altura, e a câmera
        /// mostra mais dos lados — na cidade, mais mapa; na sala, o escuro em volta dela. Devolve se a textura mudou
        /// (quem a mostra precisa pegar a nova).
        /// </summary>
        public bool AjustarVista(float proporcao)
        {
            int altura = Textura.height;
            int largura = Mathf.Max(2, Mathf.RoundToInt(altura * Mathf.Max(0.5f, proporcao)));
            if (largura == Textura.width) return false;
            var antiga = Textura;
            Textura = new RenderTexture(largura, altura, 24) { filterMode = FilterMode.Point, name = "Sala" };
            Textura.Create();
            _camera.targetTexture = Textura;
            _camera.ResetAspect();
            antiga.Release();
            Destroy(antiga);
            AjustarZoom();
            ColocarHeroi(false);
            return true;
        }

        /// <summary>
        /// A altura que a câmera mostra: na cidade, a de sempre (10,5 casas); na sala, a sala inteira, mesmo que a tela
        /// seja mais estreita que ela.
        /// </summary>
        private void AjustarZoom()
        {
            _camera.orthographicSize = _naCidade ? _altura / 2f : Mathf.Max(_altura, _largura / _camera.aspect) / 2f;
        }

        /// <summary>Do pixel do site (x pra direita, y pra baixo) para o mundo.</summary>
        private Vector3 Mundo(float x, float y) => Origem + new Vector3(x, _altura - y, 0f);

        // ---------- o boneco ----------

        /// <summary>O boneco: o corpo da raça do paperdoll (provisório), ou o emoji dela.</summary>
        public void DefinirHeroi(string raca, string emoji)
        {
            var arte = raca != null ? "Corpo/" + raca : null;
            var chave = arte + "|" + emoji;
            if (chave == _arteDoHeroi) return;
            _arteDoHeroi = chave;
            var sprite = (arte != null ? Resources.Load<Sprite>(arte) : null) ?? EmojiDoSistema.Sprite(emoji);
            PorNoPe(_corpo, sprite, Lado * 1.25f);
        }

        /// <summary>Põe o sprite com o pé no ponto do pai, na altura pedida.</summary>
        private static void PorNoPe(SpriteRenderer renderizador, Sprite sprite, float altura)
        {
            renderizador.sprite = sprite;
            if (sprite == null) return;
            float escala = altura / sprite.bounds.size.y;
            renderizador.transform.localScale = new Vector3(escala, escala, 1f);
            renderizador.transform.localPosition = new Vector3(-sprite.bounds.center.x * escala, -sprite.bounds.min.y * escala, 0f);
        }

        // ---------- a sala ----------

        /// <summary>
        /// Mostra a sala. <paramref name="chave"/> muda quando o jogador troca de sala (ou entra e sai da secreta): aí o
        /// herói aparece em <paramref name="chegada"/>. Com a mesma chave, só o desenho se atualiza. Com
        /// <paramref name="masmorra"/> que tem arte (<see cref="ArteDaSala"/>), a sala é a do Breno, e não os quadradinhos.
        /// </summary>
        public void Mostrar(string chave, RoomLayout planta, TemaDaSala tema, Dictionary<string, Figura> figuras, Walker chegada, string masmorra = null)
        {
            _planta = planta;
            if (_emendada)
            {
                _emendada = false;
                _assinaturaDoDesenho = null;
            }
            if (chave != _salaDaCena)
            {
                _salaDaCena = chave;
                _walker = chegada;
                _tocando = null;
                _sobra = 0;
                // Já é outra sala: a de que ele saiu pela porta não segura mais o andar. Sem isso, quem saía da sala
                // do início, caía na luta da vizinha e voltava pelo portão chegava à mesma chave e não andava mais.
                _saiuDe = null;
            }

            var assinatura = string.Join(",", planta.Doors) + "#" + DesenhoDasObjetos(planta) + "#" + FigurasDaSala.Assinatura(figuras) + "#" + tema.GetHashCode() + "#" + masmorra;
            if (assinatura != _assinaturaDoDesenho)
            {
                _assinaturaDoDesenho = assinatura;
                PrepararSala(planta);
                DesenharUmaSala(planta, tema, figuras, masmorra, 0f, 0f, true);
            }
            ColocarHeroi(false);
        }

        /// <summary>
        /// A masmorra emendada: as <paramref name="salas"/> em volta da atual (ela inclusive), cada uma no lugar dela, e a
        /// câmera seguindo o herói. <paramref name="planta"/> é a da sala atual, em que ele anda; (<paramref name="origemX"/>,
        /// <paramref name="origemY"/>) é a posição dela na grade do andar. A chave funciona como a de <see cref="Mostrar"/>.
        /// </summary>
        public void MostrarMasmorra(string chave, List<SalaNaCena> salas, RoomLayout planta, TemaDaSala tema, Walker chegada, string masmorra, double origemX, double origemY)
        {
            _planta = planta;
            if (chave != _salaDaCena)
            {
                _salaDaCena = chave;
                _walker = chegada;
                _tocando = null;
                _sobra = 0;
                _saiuDe = null;
            }

            var partes = new List<string> { tema.GetHashCode().ToString(), masmorra };
            foreach (var sala in salas)
                partes.Add(sala.X + "," + sala.Y + "," + sala.Acesa + "," + string.Join("", sala.Planta.Doors) + "," + DesenhoDasObjetos(sala.Planta) + "," + FigurasDaSala.Assinatura(sala.Figuras));
            var assinatura = "masmorra#" + string.Join(";", partes);
            if (assinatura != _assinaturaDoDesenho)
            {
                _assinaturaDoDesenho = assinatura;
                PrepararSala(planta);
                _emendada = true;
                foreach (var sala in salas)
                    DesenharUmaSala(sala.Planta, tema, sala.Acesa ? sala.Figuras : new Dictionary<string, Figura>(), masmorra, (float)sala.X * _largura, (float)sala.Y * _altura, sala.Acesa);
            }
            _emendada = true;
            _origemX = (float)origemX * _largura;
            _origemY = (float)origemY * _altura;
            ColocarHeroi(false);
        }

        private static string DesenhoDasObjetos(RoomLayout planta)
        {
            var partes = new List<string>();
            foreach (var o in planta.Objects) partes.Add(o.Id + ":" + o.Col + ":" + o.Row);
            return string.Join("|", partes);
        }

        /// <summary>
        /// Mostra a cidade desenhada do Breno no lugar da sala (city/mapa-da-cidade.ts): as camadas dele no tamanho da
        /// arte (32 px por casa), e a câmera seguindo o herói. <paramref name="troncos"/>: os troncos ainda fecham o
        /// caminho da caverna. A chave funciona como a da sala.
        /// </summary>
        public void MostrarCidade(string chave, RoomLayout planta, bool troncos, Walker chegada)
        {
            _planta = planta;
            _emendada = false;
            if (chave != _salaDaCena)
            {
                _salaDaCena = chave;
                _walker = chegada;
                _tocando = null;
                _sobra = 0;
                // Já é outra sala: a de que ele saiu pela porta não segura mais o andar. Sem isso, quem saía da sala
                // do início, caía na luta da vizinha e voltava pelo portão chegava à mesma chave e não andava mais.
                _saiuDe = null;
            }
            var assinatura = "cidade#" + troncos;
            if (assinatura != _assinaturaDoDesenho)
            {
                _assinaturaDoDesenho = assinatura;
                DesenharCidade(troncos);
            }
            ColocarHeroi(false);
        }

        /// <summary>
        /// O tamanho da sala em pixels do site: o da planta (a Torre é 11 × 12), ou o de sempre. A cidade fica com o de
        /// sempre, que é o tamanho da janela dela.
        /// </summary>
        private void Tamanho(double cols, double rows)
        {
            _largura = (float)cols * Lado;
            _altura = (float)rows * Lado;
        }

        private void DesenharCidade(bool troncos)
        {
            for (int i = _desenho.childCount - 1; i >= 0; i--) Destroy(_desenho.GetChild(i).gameObject);
            _doMeio.Clear();
            _naCidade = true;
            Tamanho(GameData.RoomWalkTable.RoomCols, GameData.RoomWalkTable.RoomRows);
            AjustarZoom();
            _escala = (float)(MapaDaCidade.PixelsPorCasa / GameData.RoomWalkTable.TileUnits);
            int noChao = 0, emCima = 0;
            foreach (var camada in MapaDaCidade.Camadas)
            {
                if (camada.SoComTroncos == true && !troncos) continue;
                var sprite = Resources.Load<Sprite>("Cidade/" + camada.Arquivo);
                if (sprite == null) continue;
                var objeto = new GameObject(camada.Arquivo);
                objeto.transform.SetParent(_desenho, false);
                // O canto de cima à esquerda da arte no (0, 0) do mapa.
                objeto.transform.position = Mundo(0f, 0f) + new Vector3(-sprite.bounds.min.x, -sprite.bounds.max.y, 0f);
                var renderizador = objeto.AddComponent<SpriteRenderer>();
                renderizador.sprite = sprite;
                // Ordenada com o herói pela linha onde a camada encosta no chão (o herói vai pelo pé, em pixel).
                // Dentro do mesmo plano, na ordem da lista (com a mesma ordem a Unity não garante quem fica por cima).
                renderizador.sortingOrder = camada.Plano == "chao" ? OrdemDoChao + noChao++ : camada.Plano == "cima" ? OrdemDeCima + emCima++ : (int)(camada.Base * MapaDaCidade.PixelsPorCasa);
                if (camada.Plano == "meio") _doMeio.Add((camada, renderizador));
            }
        }

        /// <summary>Apaga o desenho anterior e acerta o tamanho e a câmera pra uma sala do formato desta planta.</summary>
        private void PrepararSala(RoomLayout planta)
        {
            for (int i = _desenho.childCount - 1; i >= 0; i--) Destroy(_desenho.GetChild(i).gameObject);
            _doMeio.Clear();
            var regra = GameData.RoomWalkTable;
            float larguraAntes = _largura, alturaAntes = _altura;
            Tamanho(planta.Cols ?? regra.RoomCols, planta.Rows ?? regra.RoomRows);
            if (_naCidade || larguraAntes != _largura || alturaAntes != _altura)
            {
                _naCidade = false;
                _escala = _escalaDaSala;
                _camera.transform.position = Origem + new Vector3(_largura / 2f, _altura / 2f, -10f);
                AjustarZoom();
            }
        }

        /// <summary>
        /// Uma sala com o canto em (<paramref name="ox"/>, <paramref name="oy"/>), em pixel do site: a arte (ou os
        /// quadradinhos do tema), as rachaduras e as figuras. Apagada, ganha a sombra por cima.
        /// </summary>
        private void DesenharUmaSala(RoomLayout planta, TemaDaSala tema, Dictionary<string, Figura> figuras, string masmorra, float ox, float oy, bool acesa)
        {
            // A sala desenhada da masmorra, quando ela tem (a Floresta do Breno): o chão, os caminhos das portas que
            // existem e as copas por cima de tudo. Sem arte, os quadradinhos na cor do lugar.
            var camadas = masmorra != null ? ArteDaSala.CamadasDaSala(masmorra, planta.Doors) : null;
            if (camadas != null) DesenharArte(masmorra, camadas, ox, oy);
            int linhas = camadas != null ? 0 : planta.Solid.Count;
            for (int row = 0; row < linhas; row++)
            {
                var linha = planta.Solid[row];
                for (int col = 0; col < linha.Count; col++)
                {
                    float px = ox + col * Lado;
                    float py = oy + row * Lado;
                    bool borda = col == 0 || row == 0 || col == linha.Count - 1 || row == linhas - 1;
                    if (borda && linha[col])
                    {
                        // A parede com a borda interna de 2 px do site (o stroke a 2 px da beira).
                        Quadrado(px, py, Lado, Lado, tema.Parede, OrdemDoChao);
                        Quadrado(px + 1, py + 1, Lado - 2, Lado - 2, tema.BordaDaParede, OrdemDoChao + 1);
                        Quadrado(px + 3, py + 3, Lado - 6, Lado - 6, tema.Parede, OrdemDoChao + 2);
                    }
                    else
                    {
                        // Vão de porta na borda; dentro, chão xadrez — também debaixo do conteúdo.
                        var cor = borda ? tema.Vao : (col + row) % 2 == 0 ? tema.Chao : tema.ChaoAlternado;
                        Quadrado(px, py, Lado, Lado, cor, OrdemDoChao);
                    }
                }
            }

            foreach (var objeto in planta.Objects)
            {
                if (!figuras.TryGetValue(objeto.Id, out var figura)) continue;
                float px = ox + (float)objeto.Col * Lado;
                float py = oy + (float)objeto.Row * Lado;
                if (figura.Rachadura)
                {
                    // Na sala desenhada as árvores dos lados passam por cima da parede: a rachadura vai por cima delas.
                    Rachadura(px, py, camadas != null ? OrdemDaRachaduraNaArte : OrdemDaRachadura);
                    continue;
                }

                var sprite = (figura.Arte != null ? Resources.Load<Sprite>(figura.Arte) : null) ?? EmojiDoSistema.Sprite(figura.Emoji);
                if (sprite == null) continue;
                // O pé de quem está num quadrado: no meio dele, um pouco acima da borda de baixo.
                float peX = px + Lado / 2f;
                float peY = py + Lado - 4f;
                var pe = new GameObject(objeto.Id).transform;
                pe.SetParent(_desenho, false);
                pe.position = Mundo(peX, peY);
                var figuraDesenhada = new GameObject("Figura");
                figuraDesenhada.transform.SetParent(pe, false);
                var renderizador = figuraDesenhada.AddComponent<SpriteRenderer>();
                PorNoPe(renderizador, sprite, Lado * figura.Escala);
                renderizador.sortingOrder = (int)peY;
                if (figura.Apagada) renderizador.color = new Color(1f, 1f, 1f, 0.45f);
            }

            if (!acesa)
            {
                var regra = GameData.RoomWalkTable;
                Quadrado(ox, oy, (float)(planta.Cols ?? regra.RoomCols) * Lado, (float)(planta.Rows ?? regra.RoomRows) * Lado, CorDaSombra, OrdemDaSombra);
            }
        }

        private void Quadrado(float x, float y, float largura, float altura, Color cor, int ordem)
        {
            var quadrado = new GameObject("q");
            quadrado.transform.SetParent(_desenho, false);
            quadrado.transform.position = Mundo(x + largura / 2f, y + altura / 2f);
            quadrado.transform.localScale = new Vector3(largura, altura, 1f);
            var renderizador = quadrado.AddComponent<SpriteRenderer>();
            renderizador.sprite = _branco;
            renderizador.color = cor;
            renderizador.sortingOrder = ordem;
        }

        /// <summary>As camadas da arte da sala, no tamanho da sala (a arte tem 32 px por casa; a sala, <see cref="Lado"/>).</summary>
        private void DesenharArte(string masmorra, List<CamadaDaSala> camadas, float ox, float oy)
        {
            float escala = Lado / (float)ArteDaSala.PixelsDaSala;
            // Cada camada uma ordem acima da anterior no mesmo plano: com a mesma ordem a Unity não garante quem fica
            // por cima, e o caminho sumia debaixo da grama.
            int chao = 0, cima = 0;
            foreach (var camada in camadas)
            {
                var sprite = Resources.Load<Sprite>("Salas/" + masmorra + "/" + camada.Arquivo);
                if (sprite == null) continue;
                var objeto = new GameObject(camada.Arquivo);
                objeto.transform.SetParent(_desenho, false);
                objeto.transform.localScale = new Vector3(escala, escala, 1f);
                // O canto de cima à esquerda da arte no canto da sala.
                objeto.transform.position = Mundo(ox, oy) + new Vector3(-sprite.bounds.min.x * escala, -sprite.bounds.max.y * escala, 0f);
                var renderizador = objeto.AddComponent<SpriteRenderer>();
                renderizador.sprite = sprite;
                renderizador.sortingOrder = camada.Plano == "cima" ? OrdemDeCima + cima++ : OrdemDoChao + chao++;
            }
        }

        /// <summary>A parede rachada riscada na própria pedra (o mesmo zigue-zague do site).</summary>
        private void Rachadura(float px, float py, int ordem)
        {
            var pontos = new[]
            {
                new Vector2(px + Lado * 0.5f, py + 4), new Vector2(px + Lado * 0.38f, py + Lado * 0.32f), new Vector2(px + Lado * 0.6f, py + Lado * 0.52f),
                new Vector2(px + Lado * 0.42f, py + Lado * 0.78f), new Vector2(px + Lado * 0.52f, py + Lado - 4),
            };
            for (int i = 0; i + 1 < pontos.Length; i++) Risco(pontos[i], pontos[i + 1], ordem);
            Risco(new Vector2(px + Lado * 0.6f, py + Lado * 0.52f), new Vector2(px + Lado * 0.8f, py + Lado * 0.6f), ordem);
        }

        private void Risco(Vector2 de, Vector2 para, int ordem)
        {
            var meio = (de + para) / 2f;
            var delta = para - de;
            var risco = new GameObject("risco");
            risco.transform.SetParent(_desenho, false);
            risco.transform.position = Mundo(meio.x, meio.y);
            // O y do site é pra baixo: o ângulo no mundo é o oposto.
            risco.transform.rotation = Quaternion.Euler(0f, 0f, -Mathf.Atan2(delta.y, delta.x) * Mathf.Rad2Deg);
            risco.transform.localScale = new Vector3(delta.magnitude + 1f, 3f, 1f);
            var renderizador = risco.AddComponent<SpriteRenderer>();
            renderizador.sprite = _branco;
            renderizador.color = CorDaRachadura;
            renderizador.sortingOrder = ordem;
        }

        // ---------- o andar, a cada quadro ----------

        private void Update()
        {
            // Em luta quem põe o herói no lugar é a arena (SalaEmCena.Luta.cs).
            if (EmLuta || _planta == null || _walker == null) return;
            if (!Ativo || _saiuDe == _salaDaCena)
            {
                _sobra = 0;
                ColocarHeroi(false);
                return;
            }

            var passos = AndarNaSala.PassosDoQuadro(_sobra, Time.deltaTime * 1000.0);
            _sobra = passos.Sobra;
            var antes = _walker;
            var quadro = AndarNaSala.AndarNoQuadro(_planta, antes, Entrada?.Invoke() ?? AndarNaSala.Parado, passos.Passos, _tocando);
            _walker = quadro.Walker;
            _tocando = quadro.Tocando;

            if (quadro.Saida != null)
            {
                // A sala vizinha pode chegar já dentro do AoSair (a tela redesenha na hora): aí ela já está na cena, e não
                // há o que segurar. Senão, o andar para até ela chegar.
                var sala = _salaDaCena;
                if (AoSair != null && AoSair(quadro.Saida))
                {
                    if (_salaDaCena == sala) _saiuDe = sala;
                }
                else _walker = antes;
            }
            else if (quadro.Encostou != null)
            {
                AoEncostar?.Invoke(quadro.Encostou);
            }
            ColocarHeroi(quadro.Andou);
        }

        /// <summary>Põe o herói onde a regra diz. Andando, um pulinho a cada passo (ainda não há quadros de caminhada).</summary>
        private void ColocarHeroi(bool andando)
        {
            if (_walker == null) return;
            // Na masmorra emendada, contado do canto da sala atual, que fica no lugar dela no andar.
            float x = (_emendada ? _origemX : 0f) + (float)_walker.X * _escala;
            float y = (_emendada ? _origemY : 0f) + (float)(_walker.Y + GameData.RoomWalkTable.HeroHalf) * _escala;
            if (_emendada)
            {
                // A câmera no herói, em meio pixel (a textura é 2×): parado no meio da sala, ela a enquadra inteira.
                float cx = Mathf.Round(x * 2f) / 2f;
                float cy = Mathf.Round((y - Lado / 2f) * 2f) / 2f;
                _camera.transform.position = Mundo(cx, cy) + new Vector3(0f, 0f, -10f);
            }
            if (andando) _fase++;
            float pulo = andando ? Mathf.Abs(Mathf.Sin(_fase * 0.35f)) * 3f : 0f;
            _boneco.position = Mundo(x, y - pulo);
            _corpo.sortingOrder = (int)y;
            if (_naCidade)
            {
                // A janela segue o herói, sem passar da borda do mapa, em meio pixel (a textura é 2×): fração faz a arte tremer.
                float larguraDoMapa = (float)(MapaDaCidade.Cols * MapaDaCidade.PixelsPorCasa);
                float alturaDoMapa = (float)(MapaDaCidade.Rows * MapaDaCidade.PixelsPorCasa);
                // A janela tem a proporção da tela; mais larga que o mapa (não acontece deitado), fica no meio dele.
                float meiaJanela = Mathf.Min(_camera.orthographicSize * _camera.aspect, larguraDoMapa / 2f);
                float meiaAltura = Mathf.Min(_camera.orthographicSize, alturaDoMapa / 2f);
                float cx = Mathf.Round(Mathf.Clamp(x, meiaJanela, larguraDoMapa - meiaJanela) * 2f) / 2f;
                float cy = Mathf.Round(Mathf.Clamp(y - Lado / 2f, meiaAltura, alturaDoMapa - meiaAltura) * 2f) / 2f;
                _camera.transform.position = Mundo(cx, cy) + new Vector3(0f, 0f, -10f);

                // Quem cobre o herói (a árvore da praça, a loja...) fica meio transparente, pra ele não sumir atrás.
                float passo = Mathf.Min(1f, Time.deltaTime / SegundosDoEsmaecer) * (1f - AlfaDeQuemCobre);
                foreach (var (camada, desenho) in _doMeio)
                {
                    float alvo = MapaDaCidade.CobreOHeroi(camada, _walker) ? AlfaDeQuemCobre : 1f;
                    var cor = desenho.color;
                    cor.a = Mathf.MoveTowards(cor.a, alvo, passo);
                    desenho.color = cor;
                }
            }
            // Provisório: o corpo só tem frente. Espelhar pro lado que anda já diz pra onde ele vai.
            if (_walker.Facing == "W") _corpo.flipX = true;
            else if (_walker.Facing == "E") _corpo.flipX = false;
        }
    }
}
