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
    /// A diferença do site é a luta: onde o site abre a tela de combate por turnos, aqui começa a luta em tempo real
    /// (<see cref="Arenas"/>, etapa 5) — ao entrar na sala de monstro, ao abrir o baú que era mímico e ao voltar pra
    /// uma partida fechada no meio de uma luta. Quando ela acaba, o herói fica na porta por onde entrou. E o que a
    /// sala faz nascer aqui é do app (<c>app: true</c>): as armas e armaduras podem vir com material (aço, ébano…).
    /// </summary>
    public sealed class Partida
    {
        public const double EsperaAntesDeSalvarMs = 2500;
        public const double EsperaMaximaMs = 10000;

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

        /// <summary>A luta em tempo real em curso nesta sala, ou null.</summary>
        public LutaEmTempoReal Luta { get; private set; }
        /// <summary>O pet da conta (os bônus de combate dele); quem abre a partida diz qual é, quando souber.</summary>
        public string Pet;
        /// <summary>Jogando no teclado (o PC): na luta, o cajado pede letras em vez do desenho.</summary>
        public bool Teclado;
        /// <summary>Onde o herói está na sala agora: é onde a luta começa quando a sala vira de monstro (o mímico).</summary>
        public Func<Walker> PosicaoDoHeroi;

        private NaSecreta _naSecreta;
        private bool _precisaSalvar;
        private double _esperandoDesde;
        private double _ultimaMudanca;
        private bool _salvando;

        /// <summary>Algo mudou e a tela precisa redesenhar.</summary>
        public event Action Mudou;
        /// <summary>Um efeito sonoro a tocar (TS: Efeito).</summary>
        public event Action<string> Som;
        /// <summary>O que a luta fez neste passo, pra tela mostrar (números, sons, avisos).</summary>
        public event Action<List<Acontecimento>> NaLuta;
        /// <summary>A luta acabou, com o herói neste ponto da sala (a cena continua dali, se a sala for a mesma).</summary>
        public event Action<Walker> LutaAcabou;
        /// <summary>O chefe final caiu e a masmorra foi zerada: a tela de vitória (<see cref="Conquistas"/>).</summary>
        public event Action<Conquista> Zerou;

        // ---------- em sala (o co-op do app) ----------

        /// <summary>A partida está numa sala de co-op.</summary>
        public bool EmCoop;
        /// <summary>Sou eu quem conduz (o papel 1). Fora de sala, sempre.</summary>
        public bool Conduzo = true;
        /// <summary>Em sala e sem conduzir: ando livre, mas não passo por porta nem encosto em nada.</summary>
        public bool Acompanho => EmCoop && !Conduzo;
        /// <summary>Sobe a cada mudança do estado: quem conduz manda o estado pra sala quando ela muda.</summary>
        public long Versao => _versao;

        /// <summary>O estado com que entrei na sala acompanhando: o meu mapa, o meu andar e as minhas missões.</summary>
        private EstadoDoJogo _casa;

        /// <summary>A partida entra numa sala de co-op (ou muda de papel nela).</summary>
        public void EntrarEmSala(bool conduzo)
        {
            // Quem entra acompanhando guarda de onde veio, antes de adotar o mapa do outro.
            if (!EmCoop && !conduzo) _casa = Estado;
            EmCoop = true;
            Conduzo = conduzo;
        }

        /// <summary>
        /// O que vai pra nuvem. Em sala cada um grava o próprio herói (decisão do usuário, 2026-11-16): quem conduz
        /// grava tudo, que o mapa é dele; quem entrou acompanhando grava o herói, a mochila e a equipe de agora por
        /// cima do save com que entrou, sem levar o mapa, o andar nem as missões de quem criou a sala.
        /// </summary>
        public EstadoDoJogo ParaGravar()
        {
            EstadoDoJogo gravar;
            if (_casa == null) gravar = Estado;
            else
            {
                gravar = _casa.Clone();
                gravar.Hero = Estado.Hero;
                gravar.Inventory = Estado.Inventory;
                gravar.Party = Estado.Party;
            }
            // O fantasma não vai pro save: quem sai da sala caído volta a jogar sozinho por um fio de vida.
            if (gravar.Hero != null && Duplas.EhFantasma(gravar.Hero))
            {
                if (ReferenceEquals(gravar, Estado)) gravar = Estado.Clone();
                gravar.Hero = Duplas.LevantarSozinho(gravar.Hero);
            }
            return gravar;
        }

        /// <summary>
        /// Em sala e sem vida: um fantasma (2026-11-16, decisão do usuário). Ele só segue o parceiro: não passa por porta,
        /// não pisa em armadilha, não encosta em nada e não mexe na mochila, até o parceiro o reviver.
        /// </summary>
        public bool Fantasma => EmCoop && Estado?.Hero != null && Duplas.EhFantasma(Estado.Hero);

        /// <summary>
        /// Gasta uma Poção de Reviver da mochila (no meio da luta, da mochila da luta). Devolve com quantos % da vida o
        /// parceiro levanta, ou 0 sem poção.
        /// </summary>
        public double GastarPocaoDeReviver()
        {
            var gasto = Duplas.GastarPocaoDeReviver(Estado);
            if (gasto == null) return 0;
            if (Luta != null) Luta.Estado = gasto.Estado;
            Estado = gasto.Estado;
            MarcarParaSalvar();
            Mudou?.Invoke();
            return gasto.Porcento;
        }

        /// <summary>Fora da luta, o parceiro me reviveu: levanto com <paramref name="porcento"/> da vida máxima.</summary>
        public void Reviver(double porcento)
        {
            if (!Fantasma || Luta != null) return;
            var levantado = Estado.Clone();
            levantado.Hero = Duplas.Reviver(Estado.Hero, porcento);
            RegistrarMudanca(levantado, new Aviso("✨", "Revivido", "Seu parceiro reviveu você com a Poção de Reviver."));
        }

        /// <summary>O parceiro foi embora com o fantasma fora da luta: ele se levanta com 1 de vida, pra não ficar preso.</summary>
        public void LevantarSozinho()
        {
            if (!Fantasma || Luta != null) return;
            var levantado = Estado.Clone();
            levantado.Hero = Duplas.LevantarSozinho(Estado.Hero);
            RegistrarMudanca(levantado, new Aviso("👻", "De pé de novo", "Seu parceiro saiu da sala, e você se levantou com 1 de Vida."));
        }

        /// <summary>O estado de quem conduz, já por cima do meu (<see cref="Coop.AplicarRemoto"/>).</summary>
        public void AdotarRemoto(EstadoDoJogo proximo)
        {
            if (proximo == null || ReferenceEquals(proximo, Estado)) return;
            // A sala secreta é de onde eu estava: a sala de quem conduz é outra.
            if (proximo.MapMode != Estado.MapMode || proximo.Pos?.X != Estado.Pos?.X || proximo.Pos?.Y != Estado.Pos?.Y || proximo.Floor != Estado.Floor) _naSecreta = null;
            Estado = proximo;
            Mudou?.Invoke();
        }

        /// <summary>Em dupla, quem acompanha: o dano que o herói daqui causou e ainda não foi mandado a quem conduz.</summary>
        public readonly List<DanoNoMonstro> DanosPraMandar = new List<DanoNoMonstro>();
        /// <summary>Como acabou a última luta ("vitoria" ou "derrota"); null enquanto uma corre.</summary>
        public string UltimoFim { get; private set; }

        /// <summary>
        /// Quem acompanha não abre luta passando por porta: ela abre quando o estado de quem conduz o põe numa sala de
        /// monstro. O herói fica onde está na sala.
        /// </summary>
        public void LutarSeQuemConduzLuta()
        {
            if (!Acompanho || Luta != null || Tela != null || Estado.MapMode != "dungeon" || !Salas.LutaAoEntrar(CelulaAtual)) return;
            AbrirLuta(PosicaoDoHeroi?.Invoke() ?? RoomWalk.Arrival(null, Geometria));
            Mudou?.Invoke();
        }

        public Partida(int slot, EstadoDoJogo estado, string assinatura)
        {
            Slot = slot;
            Estado = estado;
            Assinatura = assinatura ?? "";
        }

        // ---------- onde o herói está ----------

        /// <summary>A chave do mapa: lugar, masmorra, dificuldade e andar.</summary>
        /// <summary>O formato das salas da masmorra em que se está (a Torre é 11 × 12): onde se chega por cada porta.</summary>
        public GeometriaDaSala Geometria => ArteDaSala.GeometriaDaSala(Estado.MapMode == "dungeon" ? Estado.Masmorra?.Dungeon : null);

        public string ChaveDoMapa => Estado.MapMode + ":" + Estado.Masmorra?.Dungeon + ":" + Estado.Masmorra?.Difficulty + ":" + Js.NumberToString(Estado.Floor);

        /// <summary>A chave da sala atual (sem a secreta).</summary>
        /// <remarks>
        /// Na cidade desenhada (desde 2026-10-23) não há salas pra andar: entrar por uma porta muda a sala do save, mas o
        /// herói continua onde está, e a chave é uma só pra cidade inteira (como no site).
        /// </remarks>
        public string ChaveDaSala => Estado.MapMode == "city" ? ChaveDoMapa + ":cidade" : ChaveDoMapa + ":" + Js.NumberToString(Estado.Pos.X) + "," + Js.NumberToString(Estado.Pos.Y);

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
            if (Luta != null || Acompanho || Fantasma) return false;
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
            return Entrar(direcao);
        }

        /// <summary>Quem saiu da secreta reaparece na passagem: a cena precisa saber por qual porta ele saiu.</summary>
        public event Action<string> SaiuDaSecreta;

        /// <summary>
        /// TS: entrar — anda pra sala vizinha e fecha "Dê o primeiro passo". Só a sala de monstro aciona alguma coisa
        /// na entrada: a luta, que começa com o herói na porta por onde entrou.
        /// </summary>
        private bool Entrar(string direcao)
        {
            var movido = Estados.Andar(Estado, direcao);
            if (ReferenceEquals(movido, Estado)) return false;

            var passo = Tutoriais.Marcar(movido, "move");
            if (!Salas.LutaAoEntrar(Estados.CelulaAtual(passo.Estado)))
            {
                TocarSom("step");
                RegistrarMudanca(passo.Estado, null);
                Recadar(passo.Recado);
                return true;
            }

            var resultado = Salas.Interagir(passo.Estado, Rng.Default, Pet, null, app: true);
            TocarSom(resultado.Som ?? "step");
            RegistrarMudanca(resultado.Estado, resultado.Aviso);
            Recadar(resultado.Recado ?? passo.Recado);
            AbrirTela(resultado.Tela, RoomWalk.Arrival(direcao, Geometria));
            return true;
        }

        // ---------- encostar ----------

        /// <summary>O herói encostou em algo da sala: o conteúdo, um extra ou, na sala secreta, o baú dela.</summary>
        /// <summary>
        /// O herói deu um passo na sala: se pisou numa armadilha ainda armada, ela dispara (o aviso e o estado novo,
        /// como no site).
        /// </summary>
        public void AoPassar(Walker walker)
        {
            if (Acompanho || Fantasma || Tela != null || Luta != null || Secreta != null || !(Estado is EstadoNaMasmorra masmorra)) return;
            var indice = Armadilhas.ArmadilhaSob(CelulaAtual as DungeonCell, walker);
            if (indice == null) return;
            var pisou = ArmadilhasDoJogo.PisarNaArmadilha(masmorra, (int)indice.Value, Rng.Default);
            if (pisou == null) return;
            TocarSom("hit");
            RegistrarMudanca(pisou.Estado, pisou.Aviso);
        }

        public void AoEncostar(string id)
        {
            if (Acompanho || Fantasma || Tela != null || Luta != null) return;
            if (Estado is EstadoNaCidade cidade)
            {
                EntrarPelaPorta(cidade, id);
                return;
            }
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

        /// <summary>TS: entrarPelaPorta (tela-jogo.tsx) — a porta da cidade desenhada: a sala dela no save, e o que ela faz.</summary>
        private void EntrarPelaPorta(EstadoNaCidade cidade, string ponto)
        {
            var resultado = Cidades.EntrarNoPonto(cidade, ponto, Rng.Default, Pet, null, app: true);
            if (resultado.Som != null) TocarSom(resultado.Som);
            RegistrarMudanca(resultado.Estado, resultado.Aviso);
            Recadar(resultado.Recado);
            AbrirTela(resultado.Tela);
        }

        /// <summary>TS: conversarComBram — o Bram atende dentro do ferreiro: a forja oferece a conversa com ele.</summary>
        public void FalarComOBram(EstadoDoJogo estadoDaForja)
        {
            if (!(estadoDaForja is EstadoNaCidade cidade)) return;
            var resultado = Cidades.FalarComOBram(cidade, Rng.Default, null, app: true);
            RegistrarMudanca(resultado.Estado, resultado.Aviso);
            Recadar(resultado.Recado);
            AbrirTela(resultado.Tela);
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
        private void InteragirAqui(Walker chegada = null)
        {
            var resultado = Salas.Interagir(Estado, Rng.Default, Pet, null, app: true);
            if (resultado.Som != null) TocarSom(resultado.Som);
            RegistrarMudanca(resultado.Estado, resultado.Aviso);
            Recadar(resultado.Recado);
            AbrirTela(resultado.Tela, chegada);
        }

        /// <summary>
        /// Abre a tela da sala. A de combate não abre: no lugar dela começa a luta em tempo real, na sala, com o herói em
        /// <paramref name="chegada"/> (ou onde ele estiver). O encontro por turnos que veio junto fica de lado — a luta
        /// prepara o estado de antes dele, e a bênção do NPC se gasta uma vez só.
        /// </summary>
        private void AbrirTela(TelaAberta tela, Walker chegada = null)
        {
            if (tela?.Tipo == "combate")
            {
                AbrirLuta(chegada ?? PosicaoDoHeroi?.Invoke() ?? RoomWalk.Arrival(null, Geometria));
                tela = null;
            }
            Tela = tela;
            Mudou?.Invoke();
        }

        // ---------- a luta em tempo real ----------

        /// <summary>Quem fechou o app no meio de uma luta volta pra ela: a porta continua trancada.</summary>
        public void RetomarLutaSeHouver()
        {
            if (Luta != null || Estado.MapMode != "dungeon" || !Salas.LutaAoEntrar(CelulaAtual)) return;
            InteragirAqui(RoomWalk.Arrival(null, Geometria));
        }

        private void AbrirLuta(Walker chegada)
        {
            if (!(Estado is EstadoNaMasmorra masmorra)) return;
            var quadro = Arenas.AbrirLuta(masmorra, chegada, Pet, Teclado, EmCoop ? (Conduzo ? "anfitriao" : "convidado") : null);
            DanosPraMandar.Clear();
            UltimoFim = null;
            Luta = quadro.Luta;
            Estado = Luta.Estado;
            MarcarParaSalvar();
            if (quadro.Acontecimentos.Count > 0) NaLuta?.Invoke(quadro.Acontecimentos);
        }

        /// <summary>Um passo da luta (1/60 s de jogo). O estado acompanha a cada golpe, e grava como o resto.</summary>
        public void PassoDaLuta(EntradaDaLuta entrada)
        {
            if (Luta == null) return;
            var antes = Luta.Estado;
            var quadro = Arenas.PassoDaLuta(Luta, entrada, Rng.Default);
            Luta = quadro.Luta;
            if (quadro.Danos != null) DanosPraMandar.AddRange(quadro.Danos);
            if (quadro.Acontecimentos.Count > 0) NaLuta?.Invoke(quadro.Acontecimentos);
            if (Luta.Fim != null)
            {
                TerminarLuta(quadro.Acontecimentos);
                return;
            }
            if (!ReferenceEquals(Luta.Estado, antes))
            {
                Estado = Luta.Estado;
                MarcarParaSalvar();
                Mudou?.Invoke();
            }
        }

        /// <summary>O fim da luta, com o aviso do site: a vitória (e o item achado) ou a derrota, contada como foi.</summary>
        private void TerminarLuta(List<Acontecimento> ultimos)
        {
            var final = Luta;
            Luta = null;
            UltimoFim = final.Fim;
            Aviso aviso;
            if (final.Fim == "derrota")
            {
                var linhas = new List<string>();
                foreach (var a in ultimos)
                    if (a.Tipo == "diario" && a.Texto != null) linhas.Add(a.Texto);
                aviso = new Aviso("💀", "Derrota", string.Join(" ", linhas));
            }
            else if (final.Conquista != null)
            {
                // A masmorra zerada tem a tela de vitória dela (TelaDeJogo): o diário guarda a conquista, e a caixa de
                // aviso fica livre.
                var c = final.Conquista;
                Diario = Engine.Diario.Anotar(Diario, new Anotacao
                {
                    Icone = "🏆",
                    Titulo = c.Nome + " zerada!",
                    Texto = "Você venceu " + c.Chefe + ". No baú do chefe: <b>" + Items.DisplayName(c.Item) + "</b> e " + Js.NumberToString(c.Ouro) + " de ouro. Título conquistado: " + c.Titulo + ".",
                });
                aviso = null;
            }
            else
            {
                // O chefe vencido deixa a chave da escada e o pilar de volta (o mesmo aviso do site).
                bool chefe = Estados.CelulaAtual(final.Estado)?.Type == DungeonRoomTypes.Boss;
                aviso = new Aviso("🏆", "Vitória", "Você venceu a batalha!" + (final.Loot != null ? " Encontrou <b>" + Items.DisplayName(final.Loot) + "</b>." : "") +
                    (chefe ? " O guardião deixou a chave da escada, e o pilar do covil pode levar você de volta à cidade." : ""));
            }
            // O herói fica onde estava na sala quando a luta acabou (a sala é a arena).
            LutaAcabou?.Invoke(final.Arena.Heroi);
            RegistrarMudanca(final.Estado, aviso);
            if (final.Conquista != null) Zerou?.Invoke(final.Conquista);
        }

        // ---------- telas por cima da sala ----------

        /// <summary>TS: abrirTelaDaMochila — abrir a mochila fecha a etapa "Abra a mochila".</summary>
        public void AbrirMochila()
        {
            if (Tela != null || Luta != null || Fantasma) return;
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
            return ParaGravar();
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
