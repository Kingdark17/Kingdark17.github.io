using System.IO;
using RPGLegend.Game.App;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;

namespace RPGLegend.EditorTools
{
    /// <summary>
    /// "RPG Legend > Montar cena do app": cria (ou refaz) a cena Scenes/App.unity — câmera, cena da porta, telas
    /// em UI Toolkit e o AppFlow — e a põe como a cena do build. Antes, garante o tema padrão e o PanelSettings
    /// (1280×720, escala pela altura, para a tela deitada). Monta numa cena aditiva: a cena aberta não é mexida.
    ///
    /// As fontes não viram FontAsset salvo: o Tema.uss aponta direto para os .ttf e a Unity monta o atlas só na
    /// memória. Uma FontAsset dinâmica salva guardaria os glifos desenhados a cada Play (uns 2 MB por fonte, e
    /// um arquivo diferente no git a cada vez).
    /// </summary>
    public static class AppSceneBuilder
    {
        public const string ScenePath = "Assets/RPGLegend/Scenes/App.unity";
        private const string Ui = "Assets/RPGLegend/UI/";
        private const string Arte = "Assets/RPGLegend/Art/Entrada/";
        private const string PanelSettingsPath = Ui + "PainelDoApp.asset";
        private const string SpriteSemLuz = "Packages/com.unity.render-pipelines.universal/Runtime/Materials/Sprite-Unlit-Default.mat";

        [MenuItem("RPG Legend/Montar cena do app", priority = 100)]
        public static void Montar()
        {
            var painel = GarantirPanelSettings();
            AssetDatabase.ImportAsset(Ui + "Tema.uss", ImportAssetOptions.ForceUpdate);

            var abertaAntes = SceneManager.GetActiveScene();
            var existente = SceneManager.GetSceneByPath(ScenePath);
            if (existente.IsValid() && existente.isLoaded) EditorSceneManager.CloseScene(existente, true);

            var cena = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Additive);
            SceneManager.SetActiveScene(cena);
            try
            {
                var camera = CriarCamera();
                var porta = CriarPorta(camera);
                var documento = CriarTelas(painel);
                var app = new GameObject("App").AddComponent<AppFlow>();
                var so = new SerializedObject(app);
                so.FindProperty("documento").objectReferenceValue = documento;
                so.FindProperty("cena").objectReferenceValue = porta;
                so.ApplyModifiedPropertiesWithoutUndo();

                Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
                EditorSceneManager.SaveScene(cena, ScenePath);
            }
            finally
            {
                if (abertaAntes.IsValid()) SceneManager.SetActiveScene(abertaAntes);
                EditorSceneManager.CloseScene(cena, true);
            }

            // A cena do app é a do build (os builds de teste passam a cena deles explicitamente).
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
            Debug.Log("Cena do app montada em " + ScenePath + " (e posta como a cena do build).");
        }

        private static Camera CriarCamera()
        {
            var go = new GameObject("Main Camera") { tag = "MainCamera" };
            var cam = go.AddComponent<Camera>();
            cam.orthographic = true;
            cam.orthographicSize = 180f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color32(0x10, 0x12, 0x1a, 0xff);
            cam.nearClipPlane = 0.1f;
            cam.farClipPlane = 100f;
            go.transform.position = new Vector3(0f, 0f, -10f);
            go.AddComponent<AudioListener>();
            return cam;
        }

        private static DoorScene CriarPorta(Camera camera)
        {
            var porta = new GameObject("Porta").AddComponent<DoorScene>();
            var so = new SerializedObject(porta);
            so.FindProperty("cam").objectReferenceValue = camera;
            foreach (var (campo, arquivo) in new[]
                     {
                         ("ceu", "ceu"), ("muralha", "muralha"), ("interior", "interior"), ("luz", "luz"),
                         ("folhaEsquerda", "folha-esquerda"), ("folhaDireita", "folha-direita"), ("corrente", "corrente"),
                         ("cadeadoFechado", "cadeado-fechado"), ("cadeadoAberto", "cadeado-aberto"), ("brilho", "brilho"),
                     })
                so.FindProperty(campo).objectReferenceValue = Sprite(arquivo);
            var fogo = so.FindProperty("fogo");
            fogo.arraySize = 3;
            for (int i = 0; i < 3; i++) fogo.GetArrayElementAtIndex(i).objectReferenceValue = Sprite("fogo-" + i);
            so.FindProperty("materialSemLuz").objectReferenceValue = AssetDatabase.LoadAssetAtPath<Material>(SpriteSemLuz);
            so.ApplyModifiedPropertiesWithoutUndo();
            return porta;
        }

        private static UIDocument CriarTelas(PanelSettings painel)
        {
            var documento = new GameObject("Telas").AddComponent<UIDocument>();
            documento.panelSettings = painel;
            documento.visualTreeAsset = AssetDatabase.LoadAssetAtPath<VisualTreeAsset>(Ui + "App.uxml");
            return documento;
        }

        private static Sprite Sprite(string nome)
        {
            var caminho = Arte + nome + ".png";
            var sprite = AssetDatabase.LoadAssetAtPath<Sprite>(caminho);
            if (sprite == null) throw new FileNotFoundException("Sprite não encontrado (importado como Sprite?): " + caminho);
            return sprite;
        }

        private static PanelSettings GarantirPanelSettings()
        {
            var painel = AssetDatabase.LoadAssetAtPath<PanelSettings>(PanelSettingsPath);
            if (painel == null)
            {
                painel = ScriptableObject.CreateInstance<PanelSettings>();
                AssetDatabase.CreateAsset(painel, PanelSettingsPath);
            }
            painel.themeStyleSheet = AssetDatabase.LoadAssetAtPath<ThemeStyleSheet>(Ui + "TemaPadrao.tss");
            painel.scaleMode = PanelScaleMode.ScaleWithScreenSize;
            painel.referenceResolution = new Vector2Int(1280, 720);
            painel.screenMatchMode = PanelScreenMatchMode.MatchWidthOrHeight;
            painel.match = 1f;
            painel.clearColor = false;
            EditorUtility.SetDirty(painel);
            return painel;
        }
    }
}
