using RPGLegend.Game.App;
using UnityEditor;
using UnityEngine;

namespace RPGLegend.EditorTools
{
    /// <summary>
    /// "RPG Legend > Jogar direto": atalho de teste do Editor. Com um slot escolhido, o Play pula a porta e o menu e
    /// abre a partida desse slot (precisa de sessão salva — entre uma vez pelo cartão). Sair da partida cai na lista
    /// de personagens. Fica nas preferências do Editor desta máquina, fora do git; os builds não têm o atalho.
    /// </summary>
    public static class JogarDiretoMenu
    {
        private const string Raiz = "RPG Legend/Jogar direto/";
        private const string MenuDesligado = Raiz + "Desligado (porta e menu)";

        [MenuItem(MenuDesligado, priority = 220)]
        private static void Desligar()
        {
            EditorPrefs.DeleteKey(AppFlow.ChaveJogarDireto);
            Debug.Log("Jogar direto: desligado. O Play começa pela porta.");
        }

        [MenuItem(MenuDesligado, true)]
        private static bool MarcarDesligado()
        {
            Menu.SetChecked(MenuDesligado, EditorPrefs.GetInt(AppFlow.ChaveJogarDireto, 0) == 0);
            return true;
        }

        [MenuItem(Raiz + "Slot 1", priority = 221)] private static void Slot1() => Escolher(1);
        [MenuItem(Raiz + "Slot 2", priority = 222)] private static void Slot2() => Escolher(2);
        [MenuItem(Raiz + "Slot 3", priority = 223)] private static void Slot3() => Escolher(3);
        [MenuItem(Raiz + "Slot 4", priority = 224)] private static void Slot4() => Escolher(4);

        [MenuItem(Raiz + "Slot 1", true)] private static bool Marcar1() => Marcar(1);
        [MenuItem(Raiz + "Slot 2", true)] private static bool Marcar2() => Marcar(2);
        [MenuItem(Raiz + "Slot 3", true)] private static bool Marcar3() => Marcar(3);
        [MenuItem(Raiz + "Slot 4", true)] private static bool Marcar4() => Marcar(4);

        private static void Escolher(int slot)
        {
            EditorPrefs.SetInt(AppFlow.ChaveJogarDireto, slot);
            Debug.Log("Jogar direto: o Play abre a partida do slot " + slot + " (com a sessão salva e o servidor do menu \"Servidor do jogo\").");
        }

        private static bool Marcar(int slot)
        {
            Menu.SetChecked(Raiz + "Slot " + slot, EditorPrefs.GetInt(AppFlow.ChaveJogarDireto, 0) == slot);
            return true;
        }
    }
}
