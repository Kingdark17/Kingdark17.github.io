using System;
using System.Collections.Generic;
using RPGLegend.Engine;

namespace RPGLegend.Game.Jogo
{
    /// <summary>A sala secreta em que o herói está: fora do mapa e do save, e esquecida ao trocar de sala.</summary>
    public sealed class NaSecreta
    {
        /// <summary>A chave da sala da parede (<see cref="Partida.ChaveDaSala"/>).</summary>
        public string Sala;
        public string Lado;
        public double Indice;
    }

    /// <summary>
    /// A partida aberta no app: o espelho da tela de exploração do site (apps/web/app/jogo/tela-jogo.tsx), sem
    /// desenho nenhum. Guarda o estado, a tela aberta, o aviso, o recado do tutorial, o diário e a sala secreta, e
    /// decide quando gravar: 2,5 s depois da última mudança, com teto de 10 s desde a primeira ainda não gravada.
    /// Quem desenha e quem chama a API é a <c>TelaDeJogo</c>.
    ///
    /// Diferença de propósito (decisão do usuário, 2026-10-16): até a luta em tempo real existir, a porta da sala
    /// de monstro ainda não vencida fica trancada, com um aviso, e a luta que a sala abriria (o mímico) também só
    /// avisa.
    /// </summary>
    public sealed class Partida
    {
        public const double EsperaAntesDeSalvarMs = 2500;
        public const double EsperaMaximaMs = 10000;

        public static readonly Aviso LutaEmBreve =
            new Aviso("⚔️", "A luta chega na próxima atualização", "Por enquanto a luta só acontece no site. No app, as salas de monstro ficam fechadas.");

        public readonly int Slot;
        public EstadoDoJogo Estado { get; private set; }
        /// <summary>A assinatura do save carregado ou gravado por último: a baseSignature da próxima gravação.</summary>
        public string Assinatura { get; private set; }
        public TelaAberta Tela { get; private set; }
        public Aviso Aviso { get; private set; }
        public Recado Recado { get; private set; }
        /// <summary>A escada ou a saída perguntando antes, depois do encostão.</summary>
        public bool Confirmando { get; private set; }
        public List<Anotacao> Diario { get; private set; } = new List<Anotacao>();

        private NaSecreta _naSecreta;
        private bool _precisaSalvar;
        private double _esperandoDesde;
        private double _ultimaMudanca;
        private bool _salvando;

        /// <summary>Algo mudou e a tela precisa redesenhar.</summary>
        public event Action Mudou;
        /// <summary>Um efeito sonoro a tocar (TS: Efeito).</summary>
        public event Action<string> Som;

        public Partida(int slot, EstadoDoJogo estado, string assinatura)
        {
            Slot = slot;
            Estado = estado;
            Assinatura = assinatura ?? "";
        }

        // ---------- onde o herói está ----------

        /// <summary>A chave do mapa: lugar, masmorra, dificuldade e andar.</summary>
        public string ChaveDoMapa => Estado.MapMode + ":" + Estado.Masmorra?.Dungeon + ":" + Estado.Masmorra?.Difficulty + ":" + Js.NumberToString(Estado.Floor);

        /// <summary>A chave da sala atual (sem a secreta).</summary>
        public string ChaveDaSala => ChaveDoMapa + ":" + Js.NumberToString(Estado.Pos.X) + "," + Js.NumberToString(Estado.Pos.Y);

        /// <summary>A sala secreta, se o herói está nela agora.</summary>
        public NaSecreta Secreta => _naSecreta != null && _naSecreta.Sala == ChaveDaSala ? _naSecreta : null;

        public RoomCell CelulaAtual => Estados.CelulaAtual(Estado);

        // ---------- andar ----------

        /// <summary>
        /// O herói atravessou o vão desta porta. Devolve se a sala mudou — sem sala vizinha, ou com a porta da sala de
        /// monstro trancada, a cena o põe de volta pra dentro.
        /// </summary>
        public bool Mover(string direcao)
        {
            var secreta = Secreta;
            if (secreta != null)
            {
                // A sala secreta tem uma porta só, de volta pra sala da parede.
                if (direcao != Directions.Opposite.Get(secreta.Lado)) return false;
                _naSecreta = null;
                SaiuDaSecreta?.Invoke(direcao);
                TocarSom("step");
                Mudou?.Invoke();
                return true;
            }

            // A parede rachada já aberta é a passagem pra ela: o andar e o save não mudam.
            var passagem = ExtrasDaSala.PassagemSecreta(CelulaAtual);
            if (passagem != null && direcao == passagem.Lado)
            {
                _naSecreta = new NaSecreta { Sala = ChaveDaSala, Lado = passagem.Lado, Indice = passagem.Indice };
                TocarSom("door");
                Mudou?.Invoke();
                return true;
            }

            var destino = Estados.VizinhaEm(Estado, direcao);
            if (destino == null) return false;

            if (Salas.LutaAoEntrar(Estados.CelulaEm(Estado, destino)))
            {
                // Quem segura o joystick na porta bate nela a cada quadro: o aviso entra uma vez só no diário.
                if (!ReferenceEquals(Aviso, LutaEmBreve))
                {
                    Avisar(LutaEmBreve);
                    Mudou?.Invoke();
                }
                return false;
            }

            return Entrar(direcao);
        }

        /// <summary>Quem saiu da secreta reaparece na passagem: a cena precisa saber por qual porta ele saiu.</summary>
        public event Action<string> SaiuDaSecreta;

        /// <summary>TS: entrar — anda pra sala vizinha e fecha "Dê o primeiro passo".</summary>
        private bool Entrar(string direcao)
        {
            var movido = Estados.Andar(Estado, direcao);
            if (ReferenceEquals(movido, Estado)) return false;

            var passo = Tutoriais.Marcar(movido, "move");
            TocarSom("step");
            RegistrarMudanca(passo.Estado, null);
            Recadar(passo.Recado);
            return true;
        }

        // ---------- encostar ----------

        /// <summary>O herói encostou em algo da sala: o conteúdo, um extra ou, na sala secreta, o baú dela.</summary>
        public void AoEncostar(string id)
        {
            if (Tela != null) return;
            var secreta = Secreta;
            if (secreta != null)
            {
                if (id == ExtrasDaSala.IdDoBauSecreto && Estado is EstadoNaMasmorra naSecreta) AplicarExtra(ExtrasDaSala.AbrirBauSecreto(naSecreta, secreta.Indice));
                return;
            }
            if (id == AndarNaSala.IdDoConteudo)
            {
                Encostar();
                return;
            }
            var indice = ExtrasDaSala.IndiceDoExtra(id);
            if (indice.HasValue && Estado is EstadoNaMasmorra masmorra) AplicarExtra(ExtrasDaSala.TocarExtra(masmorra, indice.Value, Rng.Default));
        }

        /// <summary>O resultado de um extra: o aviso sempre; o estado novo só quando algo mudou (a placa só se lê).</summary>
        private void AplicarExtra(ResultadoDoExtra resultado)
        {
            if (resultado == null) return;
            if (resultado.Som != null) TocarSom(resultado.Som);
            if (ReferenceEquals(resultado.Estado, Estado))
            {
                Avisar(resultado.Aviso);
                Mudou?.Invoke();
                return;
            }
            RegistrarMudanca(resultado.Estado, resultado.Aviso);
        }

        /// <summary>TS: encostar — a escada e a saída perguntam antes; o resto aciona na hora.</summary>
        private void Encostar()
        {
            var celula = CelulaAtual;
            if (celula == null) return;
            if (Salas.ConfirmaAoTocar(celula))
            {
                Aviso = null;
                Confirmando = true;
                Mudou?.Invoke();
                return;
            }
            InteragirAqui();
        }

        /// <summary>O "sim" da escada ou da saída.</summary>
        public void ConfirmarSim()
        {
            if (!Confirmando) return;
            InteragirAqui();
        }

        /// <summary>O "não": só fecha, o herói continua na sala.</summary>
        public void ConfirmarNao()
        {
            Confirmando = false;
            Mudou?.Invoke();
        }

        /// <summary>TS: interagirAqui — o que a sala tem, acionado agora.</summary>
        private void InteragirAqui()
        {
            var resultado = Salas.Interagir(Estado);
            if (resultado.Som != null) TocarSom(resultado.Som);
            RegistrarMudanca(resultado.Estado, resultado.Aviso);
            Recadar(resultado.Recado);
            AbrirTela(resultado.Tela);
        }

        private void AbrirTela(TelaAberta tela)
        {
            if (tela?.Tipo == "combate")
            {
                // A luta em tempo real é a etapa seguinte: até lá, a sala só avisa (o mímico já se revelou e fica lá).
                Avisar(LutaEmBreve);
                tela = null;
            }
            Tela = tela;
            Mudou?.Invoke();
        }

        // ---------- telas por cima da sala ----------

        /// <summary>TS: abrirTelaDaMochila — abrir a mochila fecha a etapa "Abra a mochila".</summary>
        public void AbrirMochila()
        {
            if (Tela != null) return;
            var passo = Tutoriais.Marcar(Estado, "inventory");
            if (passo.Recado != null)
            {
                Estado = passo.Estado;
                Recadar(passo.Recado);
                MarcarParaSalvar();
            }
            Tela = new TelaAberta { Tipo = "mochila", Mochila = Mochilas.AbrirMochila(Estado) };
            Mudou?.Invoke();
        }

        /// <summary>TS: seguir — toda ação dentro de uma tela mexe no save, e o estado acompanha na hora.</summary>
        public void Seguir(TelaAberta proxima, EstadoDoJogo proximoEstado)
        {
            Tela = proxima;
            Estado = proximoEstado;
            MarcarParaSalvar();
            Mudou?.Invoke();
        }

        /// <summary>A tela muda sem mexer no save (o portão escolhendo masmorra, dificuldade e andar).</summary>
        public void TrocarTela(TelaAberta proxima)
        {
            Tela = proxima;
            Mudou?.Invoke();
        }

        /// <summary>TS: fechar — a tela fecha, e o estado final fica.</summary>
        public void Fechar(EstadoDoJogo estadoFinal, Aviso avisoFinal = null)
        {
            Tela = null;
            Estado = estadoFinal;
            Avisar(avisoFinal);
            MarcarParaSalvar();
            Mudou?.Invoke();
        }

        // ---------- avisos e diário ----------

        /// <summary>As duas portas por onde acontecimento chega ao jogador; o diário escreve daqui.</summary>
        private void Avisar(Aviso aviso)
        {
            Aviso = aviso;
            if (aviso != null) Diario = Engine.Diario.Anotar(Diario, new Anotacao { Icone = aviso.Icone, Titulo = aviso.Titulo, Texto = aviso.Texto });
        }

        public void Recadar(Recado recado)
        {
            if (recado == null) return;
            Recado = recado;
            Diario = Engine.Diario.Anotar(Diario, new Anotacao { Icone = "✨", Titulo = recado.Titulo, Texto = recado.Texto });
            Mudou?.Invoke();
        }

        public void FecharRecado()
        {
            Recado = null;
            Mudou?.Invoke();
        }

        public void FecharAviso()
        {
            Aviso = null;
            Mudou?.Invoke();
        }

        private void RegistrarMudanca(EstadoDoJogo proximo, Aviso aviso)
        {
            Estado = proximo;
            Avisar(aviso);
            Confirmando = false;
            MarcarParaSalvar();
            Mudou?.Invoke();
        }

        private void TocarSom(string efeito) => Som?.Invoke(efeito);

        // ---------- gravar ----------

        /// <summary>O relógio da partida, em ms (quem chama passa o do jogo).</summary>
        public double Agora { get; set; }

        private void MarcarParaSalvar()
        {
            _versao++;
            _precisaSalvar = true;
            if (_esperandoDesde == 0) _esperandoDesde = Agora > 0 ? Agora : 1;
            _ultimaMudanca = Agora;
        }

        /// <summary>Cada mudança conta uma versão; a gravada é a da última gravação que deu certo.</summary>
        private long _versao, _versaoGravando, _versaoGravada;

        /// <summary>
        /// Há mudança ainda não gravada — inclusive a de uma gravação automática que falhou. É o que a saída confere:
        /// no site, uma automática que falhou não volta pra fila, e sair logo depois perde a jogada sem avisar.
        /// </summary>
        public bool TemMudancaPorGravar => _versaoGravada != _versao;

        /// <summary>
        /// Já é hora de gravar: 2,5 s sem mudança nova, ou 10 s desde a primeira mudança ainda não gravada (senão quem
        /// joga sem parar nunca grava).
        /// </summary>
        public bool HoraDeGravar(double agora) =>
            _precisaSalvar && !_salvando && (agora - _ultimaMudanca >= EsperaAntesDeSalvarMs || agora - _esperandoDesde >= EsperaMaximaMs);

        /// <summary>Começa uma gravação: devolve o estado a mandar e esquece a fila (o que mudar daqui pra frente espera a próxima).</summary>
        public EstadoDoJogo ComecarAGravar()
        {
            _salvando = true;
            _precisaSalvar = false;
            _esperandoDesde = 0;
            _versaoGravando = _versao;
            return Estado;
        }

        public bool Gravando => _salvando;

        public void Gravou(string assinatura)
        {
            _salvando = false;
            _versaoGravada = _versaoGravando;
            Assinatura = assinatura;
        }

        /// <summary>
        /// A gravação falhou. Como no site, a automática não tenta de novo sozinha: espera a próxima mudança (um 409
        /// repetido a cada 2,5 s só encheria o servidor). A mudança continua contando como não gravada, então sair
        /// tenta de novo — e não sai se falhar.
        /// </summary>
        public void NaoGravou()
        {
            _salvando = false;
        }
    }
}
