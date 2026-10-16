namespace RPGLegend.Engine
{
    /// <summary>TS: Aviso — a caixinha de diálogo que a tela mostra depois de algo acontecer na sala.</summary>
    public sealed class Aviso
    {
        public string Icone;
        public string Titulo;
        public string Texto;

        public Aviso() { }

        public Aviso(string icone, string titulo, string texto)
        {
            Icone = icone;
            Titulo = titulo;
            Texto = texto;
        }
    }
}
