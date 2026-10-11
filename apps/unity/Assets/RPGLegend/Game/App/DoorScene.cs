using System.Threading;
using UnityEngine;

namespace RPGLegend.Game.App
{
    /// <summary>
    /// A cena de entrada: a muralha do castelo à noite, a porta de duas folhas com um cadeado na corrente e duas
    /// tochas. Monta as camadas sozinha a partir dos sprites (Art/Entrada) e sabe fazer as animações que o
    /// <see cref="AppFlow"/> encadeia: aproximar, destrancar, abrir e entrar.
    ///
    /// Coordenadas: 1 pixel da arte = 1 unidade. A muralha (864×360) fica centrada na origem; a porta tem o centro
    /// em (0, −76.5) e as dobradiças em x = ±48. A câmera começa vendo o castelo inteiro (tamanho 180) e chega
    /// perto da porta (tamanho 90, centro em y = −60).
    /// </summary>
    public sealed class DoorScene : MonoBehaviour
    {
        [Header("Câmera")]
        [SerializeField] private Camera cam;

        [Header("Sprites (Art/Entrada)")]
        [SerializeField] private Sprite ceu;
        [SerializeField] private Sprite muralha;
        [SerializeField] private Sprite interior;
        [SerializeField] private Sprite luz;
        [SerializeField] private Sprite folhaEsquerda;
        [SerializeField] private Sprite folhaDireita;
        [SerializeField] private Sprite corrente;
        [SerializeField] private Sprite cadeadoFechado;
        [SerializeField] private Sprite cadeadoAberto;
        [SerializeField] private Sprite brilho;
        [SerializeField] private Sprite[] fogo = new Sprite[0];

        [Tooltip("Material sem iluminação (Sprite-Unlit-Default do URP): a cena não usa luz 2D.")]
        [SerializeField] private Material materialSemLuz;

        // Enquadramentos da câmera.
        private static readonly Vector3 Longe = new Vector3(0f, 0f, -10f);
        private const float TamanhoLonge = 180f;
        private static readonly Vector3 Perto = new Vector3(0f, -60f, -10f);
        private const float TamanhoPerto = 90f;
        private static readonly Vector3 DentroDaPorta = new Vector3(0f, -78f, -10f);
        private const float TamanhoDentro = 12f;

        /// <summary>Quanto a câmera anda para a direita quando o cartão de entrada aparece (a porta vai para a esquerda).</summary>
        private const float DeslocamentoDoCartao = 58f;

        private Transform _ceu, _dobradicaEsquerda, _dobradicaDireita, _fecho;
        private SpriteRenderer _luz, _folhaEsquerda, _folhaDireita, _corrente, _cadeado;
        private SpriteRenderer[] _fogos = new SpriteRenderer[0], _brilhos = new SpriteRenderer[0];
        private float _progressoAproximacao;
        private float _deslocamentoX;
        private bool _balancarFecho = true;
        private float _proximoFogo;

        private CancellationToken Cancelar => destroyCancellationToken;

        private void Awake()
        {
            if (cam == null) cam = Camera.main;
            Montar();
            Enquadrar(0f);
        }

        // ---------- montagem ----------

        private void Montar()
        {
            _ceu = Camada("Céu", ceu, cam.transform, new Vector3(0f, 0f, 20f), -10).transform;
            Camada("Interior", interior, transform, new Vector3(0f, -76.5f), 0);
            _luz = Camada("Luz", luz, transform, new Vector3(0f, -76.5f), 1);
            _luz.color = new Color(1f, 1f, 1f, 0f);

            _dobradicaEsquerda = Vazio("Dobradiça esquerda", transform, new Vector3(-48f, -76.5f));
            _folhaEsquerda = Camada("Folha esquerda", folhaEsquerda, _dobradicaEsquerda, new Vector3(24f, 0f), 2);
            _dobradicaDireita = Vazio("Dobradiça direita", transform, new Vector3(48f, -76.5f));
            _folhaDireita = Camada("Folha direita", folhaDireita, _dobradicaDireita, new Vector3(-24f, 0f), 2);

            // O fecho pende do meio da corrente; o cadeado balança em volta desse ponto.
            _corrente = Camada("Corrente", corrente, transform, new Vector3(0.5f, -101.5f), 3);
            _fecho = Vazio("Fecho", transform, new Vector3(0f, -105f));
            _cadeado = Camada("Cadeado", cadeadoFechado, _fecho, new Vector3(0f, -9f), 4);

            Camada("Muralha", muralha, transform, Vector3.zero, 5);

            var posicoesDasTochas = new[] { new Vector3(-78f, -35f), new Vector3(77f, -35f) };
            _fogos = new SpriteRenderer[posicoesDasTochas.Length];
            _brilhos = new SpriteRenderer[posicoesDasTochas.Length];
            for (int i = 0; i < posicoesDasTochas.Length; i++)
            {
                _brilhos[i] = Camada("Brilho da tocha", brilho, transform, posicoesDasTochas[i] + new Vector3(0f, 1f), 6);
                _fogos[i] = Camada("Fogo da tocha", fogo.Length > 0 ? fogo[0] : null, transform, posicoesDasTochas[i], 7);
            }
        }

        private SpriteRenderer Camada(string nome, Sprite sprite, Transform pai, Vector3 posicao, int ordem)
        {
            var go = new GameObject(nome);
            go.transform.SetParent(pai, false);
            go.transform.localPosition = posicao;
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.sortingOrder = ordem;
            if (materialSemLuz != null) sr.sharedMaterial = materialSemLuz;
            return sr;
        }

        private static Transform Vazio(string nome, Transform pai, Vector3 posicao)
        {
            var go = new GameObject(nome);
            go.transform.SetParent(pai, false);
            go.transform.localPosition = posicao;
            return go.transform;
        }

        // ---------- todo quadro: tochas, balanço do cadeado, céu ----------

        private void Update()
        {
            if (fogo.Length > 1 && Time.time >= _proximoFogo)
            {
                _proximoFogo = Time.time + Random.Range(0.08f, 0.16f);
                foreach (var f in _fogos) f.sprite = fogo[Random.Range(0, fogo.Length)];
                foreach (var b in _brilhos) b.color = new Color(1f, 1f, 1f, Random.Range(0.82f, 1f));
            }
            if (_balancarFecho) _fecho.localRotation = Quaternion.Euler(0f, 0f, Mathf.Sin(Time.time * 1.7f) * 3f);

            // O céu fica do mesmo tamanho na tela, crescendo só um pouco: está longe (paralaxe).
            _ceu.localScale = Vector3.one * (cam.orthographicSize / TamanhoLonge) * (1f + 0.08f * _progressoAproximacao);
        }

        /// <summary>Posição da câmera no caminho do castelo inteiro (0) até a porta (1), com o deslocamento do cartão.</summary>
        private void Enquadrar(float progresso)
        {
            _progressoAproximacao = progresso;
            var p = Vector3.Lerp(Longe, Perto, progresso);
            p.x += _deslocamentoX;
            cam.transform.position = p;
            cam.orthographicSize = Mathf.Lerp(TamanhoLonge, TamanhoPerto, progresso);
        }

        // ---------- animações ----------

        /// <summary>
        /// Um quadro da aproximação (t de 0 a 1): a câmera sai do castelo inteiro e chega à porta, com um leve
        /// balanço de passos. Quem anima é o AppFlow, que no mesmo passo clareia o véu.
        /// </summary>
        public void PassoAproximar(float t)
        {
            Enquadrar(Tween.EntraESaiSeno(t));
            if (t < 1f) cam.transform.position += new Vector3(0f, Mathf.Sin(t * Mathf.PI * 7f) * 1.5f * (1f - t), 0f);
        }

        /// <summary>Com o cartão de entrada à direita, a porta vai para a esquerda; sem ele, volta ao meio.</summary>
        public async Awaitable AbrirEspacoParaOCartao(bool abrir, float segundos = 0.5f)
        {
            float de = _deslocamentoX, para = abrir ? DeslocamentoDoCartao : 0f;
            await Tween.Durante(segundos, t =>
            {
                _deslocamentoX = Mathf.Lerp(de, para, Tween.EntraESaiSeno(t));
                Enquadrar(_progressoAproximacao);
            }, Cancelar);
        }

        /// <summary>O cadeado treme, abre e cai com a corrente.</summary>
        public async Awaitable Destrancar()
        {
            _balancarFecho = false;
            await Tween.Durante(0.35f, t => _fecho.localRotation = Quaternion.Euler(0f, 0f, Mathf.Sin(t * Mathf.PI * 10f) * 9f * (1f - t)), Cancelar);
            _cadeado.sprite = cadeadoAberto;
            _cadeado.transform.localPosition = new Vector3(0f, -9f - 2f, 0f); // o desenho aberto é 4 px mais alto
            await Awaitable.WaitForSecondsAsync(0.18f, Cancelar);

            var inicioFecho = _fecho.localPosition;
            var inicioCorrente = _corrente.transform.localPosition;
            await Tween.Durante(0.85f, t =>
            {
                var queda = 260f * t * t;                       // gravidade
                _fecho.localPosition = inicioFecho + new Vector3(6f * t, -queda, 0f);
                _fecho.localRotation = Quaternion.Euler(0f, 0f, -140f * t);
                _corrente.transform.localPosition = inicioCorrente + new Vector3(-3f * t, -queda * 0.9f, 0f);
                _corrente.transform.localRotation = Quaternion.Euler(0f, 0f, 60f * t);
                var a = 1f - Mathf.Clamp01((t - 0.6f) / 0.4f);
                _cadeado.color = new Color(1f, 1f, 1f, a);
                _corrente.color = new Color(1f, 1f, 1f, a);
            }, Cancelar);
        }

        /// <summary>As folhas giram para dentro nas dobradiças (estreitam e escurecem) e a luz de dentro acende.</summary>
        public async Awaitable Abrir(float segundos = 1.2f)
        {
            await Tween.Durante(segundos, t =>
            {
                var e = Tween.EntraESaiSeno(t);
                var largura = Mathf.Lerp(1f, 0.1f, e);
                _dobradicaEsquerda.localScale = new Vector3(largura, 1f, 1f);
                _dobradicaDireita.localScale = new Vector3(largura, 1f, 1f);
                var tom = Mathf.Lerp(1f, 0.45f, e);
                _folhaEsquerda.color = _folhaDireita.color = new Color(tom, tom, tom, 1f);
                _luz.color = new Color(1f, 1f, 1f, Mathf.Clamp01((t - 0.15f) / 0.6f));
            }, Cancelar);
        }

        private Vector3 _entradaDe;
        private float _entradaTamanho;

        /// <summary>Marca de onde a câmera parte para mergulhar na porta (chame antes dos <see cref="PassoEntrar"/>).</summary>
        public void ComecarEntrada()
        {
            _entradaDe = cam.transform.position;
            _entradaTamanho = cam.orthographicSize;
        }

        /// <summary>Um quadro do mergulho na luz da porta aberta (t de 0 a 1).</summary>
        public void PassoEntrar(float t)
        {
            var e = Tween.EntraCubica(t);
            cam.transform.position = Vector3.Lerp(_entradaDe, DentroDaPorta, e);
            cam.orthographicSize = Mathf.Lerp(_entradaTamanho, TamanhoDentro, e);
        }

        /// <summary>De volta à porta trancada, já de perto (quem saiu da conta volta para cá).</summary>
        public void Resetar()
        {
            _balancarFecho = true;
            _fecho.localPosition = new Vector3(0f, -105f);
            _fecho.localRotation = Quaternion.identity;
            _cadeado.sprite = cadeadoFechado;
            _cadeado.transform.localPosition = new Vector3(0f, -9f);
            _cadeado.color = Color.white;
            _corrente.transform.localPosition = new Vector3(0.5f, -101.5f);
            _corrente.transform.localRotation = Quaternion.identity;
            _corrente.color = Color.white;
            _dobradicaEsquerda.localScale = _dobradicaDireita.localScale = Vector3.one;
            _folhaEsquerda.color = _folhaDireita.color = Color.white;
            _luz.color = new Color(1f, 1f, 1f, 0f);
            _deslocamentoX = 0f;
            Enquadrar(1f);
        }

        /// <summary>A cena só gasta bateria enquanto aparece: no menu ela é desligada (o céu, que mora na câmera, junto).</summary>
        public void Mostrar(bool mostrar)
        {
            gameObject.SetActive(mostrar);
            _ceu.gameObject.SetActive(mostrar);
        }
    }
}
