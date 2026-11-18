using System;
using System.Collections.Generic;

namespace RPGLegend.Engine
{
    /// <summary>TS: JeitoDeLutar — o jeito de lutar de um comportamento de monstro.</summary>
    public sealed class JeitoDeLutar
    {
        /// <summary>Quanto dura o aviso antes do golpe.</summary>
        public double Aviso;
        /// <summary>"perto", "investida" ou "tiro".</summary>
        public string Golpe;
        /// <summary>O raio do que pega: o círculo (perto), o corpo que mergulha (investida), a bola (tiro).</summary>
        public double Tamanho;
        /// <summary>Por passo, o mergulho ou a bola. O golpe de perto não anda.</summary>
        public double Velocidade;
        /// <summary>Parado depois do golpe.</summary>
        public double Descanso;
        /// <summary>Descansando, ele se protege: o golpe do herói chega com metade da força.</summary>
        public bool? Guarda;
        /// <summary>Andando atrás do herói, quanto anda por passo (o herói anda 64).</summary>
        public double Passo;
        /// <summary>Até que distância do herói ele chega, e de onde o golpe pode começar.</summary>
        public double Distancia;
    }

    /// <summary>
    /// TS: MonstroNaArena. Fase: "esperando", "avisando", "investindo", "descansando", "atordoado", "hesitando" ou
    /// "caido". Alvo -1 é o herói (no chão da sala); senão o índice do companheiro na equipe.
    /// </summary>
    public sealed class MonstroNaArena
    {
        public double Indice;
        public string Fase;
        public double Tempo;
        public double Forca;
        public double Alvo;
        public double X;
        public double Y;
        public double RumoX;
        public double RumoY;
        /// <summary>
        /// Onde o monstro está de pé, em unidades da sala: começa no meio da casa dele e, depois de uma investida, fica
        /// onde ela acabou (2026-11-12). É dali que o alcance mede e que saem a investida e o tiro.
        /// </summary>
        public double CorpoX;
        public double CorpoY;
        /// <summary>O chefe final: o poder do golpe em curso (<see cref="ChefeFinal"/>). Ausente (null) no golpe comum.</summary>
        public string Poder;
        /// <summary>Na luta em dupla: ele anda atrás do parceiro, e o golpe em curso mira nele (<see cref="Dupla"/>).</summary>
        public bool? NoParceiro;
        /// <summary>No espelho de quem acompanha: este golpe já acertou o meu herói (a investida não acerta duas vezes).</summary>
        public bool? Acertou;
        /// <summary>Ele vai atrás de um lacaio do Necromante (o índice na equipe), e o golpe em curso cai nele (rodada 4b).</summary>
        public double? NoLacaio;
        /// <summary>Preso pelas Raízes Ocultas (rodada 5b): os passos que faltam. Não anda nem investe; o golpe de onde está, sim.</summary>
        public double? Preso;
        /// <summary>O Vento do Mago (rodada 5c) ou a aljava paralisante (6b) o acertou: ele golpeia de 1 bloco mais perto até o fim da luta.</summary>
        public bool? Encurtado;
        /// <summary>O redemoinho da Água (rodada 5c): os passos que ainda anda mais devagar.</summary>
        public double? Lerdo;
        /// <summary>A aljava flamejante (rodada 6b): os próximos golpes dele que ainda saem mais fracos.</summary>
        public double? Fraco;
        /// <summary>A aljava flamejante (rodada 6b): incendiado, os passos que faltam e o dano de cada segundo. Nunca muda no lugar (troca inteiro).</summary>
        public IncendioNaArena Incendio;
        /// <summary>Domar (rodada 7b): quantas vezes ele aceitou e recusou a comida do Caçador, e se já foi domado (saiu da luta).</summary>
        public double? Aceitou;
        public double? Recusou;
        public bool? Domado;

        public MonstroNaArena Clone() => (MonstroNaArena)MemberwiseClone();
    }

    /// <summary>TS: o incendio do MonstroNaArena (rodada 6b).</summary>
    public sealed class IncendioNaArena
    {
        public double Tempo;
        public double Dano;
    }

    /// <summary>
    /// TS: Dupla — a luta em dupla (o co-op do app, 2026-11-16): cada app cuida do próprio herói, e o de quem criou a
    /// sala cuida dos monstros. Papel "anfitriao": a luta de sempre, com o parceiro na sala (os monstros escolhem
    /// entre os dois, e o dano dele chega pela entrada). Papel "convidado": um espelho — o estado dos monstros chega
    /// pela entrada, o que mira o herói daqui é testado aqui, e o dano que ele causa sai em
    /// <see cref="QuadroDaLuta.Danos"/>. Quem cai vira fantasma, e a luta segue com o outro.
    /// </summary>
    public sealed class Dupla
    {
        public string Papel;
        public PontoNaSala Parceiro;
        public bool? ParceiroCaido;
        /// <summary>O parceiro é Paladino: os monstros o escolhem como se ele estivesse mais perto.</summary>
        public bool? ParceiroPuxa;
        /// <summary>O dano que o parceiro levou nos últimos 30 s (ele diz): a duração da Comunhão sagrada conta com ele.</summary>
        public double? ParceiroDano;
        /// <summary>As flores do Florescimento que o parceiro plantou (rodada 5b): curam o herói daqui também.</summary>
        public List<FlorNaSala> FloresDoParceiro;
        public bool? Fantasma;

        public Dupla Clone() => new Dupla
        {
            FloresDoParceiro = FloresDoParceiro != null ? FloresDoParceiro.ConvertAll(f => f.Clone()) : null,
            Papel = Papel,
            Parceiro = Parceiro != null ? new PontoNaSala { X = Parceiro.X, Y = Parceiro.Y } : null,
            ParceiroCaido = ParceiroCaido,
            ParceiroPuxa = ParceiroPuxa,
            ParceiroDano = ParceiroDano,
            Fantasma = Fantasma,
        };
    }

    /// <summary>
    /// TS: ApoioDoParceiro — o apoio que um herói solta no parceiro (rodada 3b): "bardo", "clerigo", "purificar" ou
    /// "comunhao" (com a duração, em passos). Sai em <see cref="QuadroDaLuta.Apoios"/> de um lado e chega em
    /// <see cref="EntradaDaLuta.Apoios"/> do outro, que faz a conta com o herói dele.
    /// </summary>
    public sealed class ApoioDoParceiro
    {
        public string Tipo;
        public double? Passos;
        /// <summary>Os pontos de % de cura a mais (a Purificação da Metamorfose, rodada 5b).</summary>
        public double? Mais;
    }

    /// <summary>TS: EscuridaoNaSala — a área de escuridão do Mago (rodada 5c): o meio dela e os passos que ainda dura.</summary>
    public sealed class EscuridaoNaSala
    {
        public double X;
        public double Y;
        public double Tempo;

        public EscuridaoNaSala Clone() => new EscuridaoNaSala { X = X, Y = Y, Tempo = Tempo };
    }

    /// <summary>TS: FlorNaSala — uma flor do Florescimento (rodada 5b): o meio dela, em unidades da sala.</summary>
    public sealed class FlorNaSala
    {
        public double X;
        public double Y;

        public FlorNaSala Clone() => new FlorNaSala { X = X, Y = Y };
    }

    /// <summary>TS: MemoriaDaLuta — o que a luta leva de uma pra outra, na memória do app (fora do save): a moral e a recarga da fé.</summary>
    public sealed class MemoriaDaLuta
    {
        public Moral Moral;
        public double? RecargaDaFe;
        /// <summary>A espera da Magia Proibida do Necromante, em passos.</summary>
        public double? RecargaDaMagia;
        /// <summary>O ki do Monge que sobrou.</summary>
        public double? Ki;
        /// <summary>A espera do chapéu do espadachim (rodada 6c), em passos.</summary>
        public double? RecargaDoChapeu;
    }

    /// <summary>
    /// TS: ChapeuNaSala — o chapéu do espadachim voando (rodada 6c): onde está e o passo dele, se já bateu na parede
    /// e volta, quem ele já pegou nesta ida (ou nesta volta), o dano que o primeiro levou e os passos que ainda voa.
    /// </summary>
    public sealed class ChapeuNaSala
    {
        public double X;
        public double Y;
        public double Vx;
        public double Vy;
        public bool? Voltando;
        public List<double> Pegos = new List<double>();
        public double? Dano;
        public double Vida;

        public ChapeuNaSala Clone()
        {
            var copia = (ChapeuNaSala)MemberwiseClone();
            copia.Pegos = new List<double>(Pegos);
            return copia;
        }
    }

    /// <summary>Um dano levado pelo herói daqui, com o passo do mundo (a janela de 30 s do Poder da fé).</summary>
    public sealed class DanoLevado
    {
        public double Passo;
        public double Dano;
    }

    /// <summary>TS: MonstroNoEspelho — um monstro como o anfitrião o manda pro espelho.</summary>
    public sealed class MonstroNoEspelho
    {
        public double Indice;
        public string Fase;
        public double Tempo;
        public double Forca;
        public double Alvo;
        public double X;
        public double Y;
        public double RumoX;
        public double RumoY;
        public double CorpoX;
        public double CorpoY;
        public string Poder;
        public bool? NoParceiro;
        public double Hp;
        /// <summary>O monstro inteiro: quando o espelho ainda não o tem (os lacaios) ou quando ele mudou além da vida.</summary>
        public CombatMonster Monstro;
    }

    /// <summary>TS: Espelho — o que o anfitrião manda dos monstros e das bolas, umas dez vezes por segundo.</summary>
    public sealed class Espelho
    {
        public List<MonstroNoEspelho> Monstros = new List<MonstroNoEspelho>();
        public List<Tiro> Tiros = new List<Tiro>();
    }

    /// <summary>TS: o parceiro na entrada — onde ele está agora, se caiu, e se é Paladino (Puxa: os monstros o preferem).</summary>
    public sealed class ParceiroNaEntrada
    {
        public double X;
        public double Y;
        public bool? Caido;
        public bool? Puxa;
        /// <summary>O dano que ele levou nos últimos 30 s (a Comunhão sagrada conta com ele).</summary>
        public double? Dano;
        /// <summary>As flores do Florescimento que ele plantou (rodada 5b).</summary>
        public List<FlorNaSala> Flores;
    }

    /// <summary>TS: um dano de fora, ou um dano pra mandar: em qual monstro (índice na sala) e quanto.</summary>
    public sealed class DanoNoMonstro
    {
        public double Indice;
        public double Dano;
    }

    /// <summary>TS: CompanheiroNaArena.</summary>
    public sealed class CompanheiroNaArena
    {
        public double Indice;
        public double Tempo;
        /// <summary>O lacaio do Necromante tem corpo na arena (rodada 4b): onde ele está. Null, fora do chão (os recrutas).</summary>
        public double? X;
        public double? Y;

        public CompanheiroNaArena Clone() => (CompanheiroNaArena)MemberwiseClone();
    }

    /// <summary>TS: CristalNaSala — o cristal que ficou onde o inimigo caiu, na luta do Necromante: fica até o herói sair da sala.</summary>
    public sealed class CristalNaSala : CristalDoInimigo
    {
        public double X;
        public double Y;

        public CristalNaSala Clone() => (CristalNaSala)MemberwiseClone();
    }

    /// <summary>TS: Tiro — a bola do mágico, voando pela sala.</summary>
    public sealed class Tiro
    {
        public double X;
        public double Y;
        public double Vx;
        public double Vy;
        public double Raio;
        public double Vida;
        public double Indice;
        public double Forca;

        public Tiro Clone() => (Tiro)MemberwiseClone();
    }

    /// <summary>TS: EventoAberto — o evento da arma em curso.</summary>
    public sealed class EventoAberto
    {
        public EventoDeArma Evento;
        public double Passo;
        public JogadaDoEvento Jogada;
        public double Alvo;
        public string Estilo;
        /// <summary>O evento é de um poder mágico (o id dele), e não do ataque: no fim, é o poder que sai, na força do evento.</summary>
        public string Poder;
        /// <summary>O ataque do Bardo, do Clérigo ou do Druida mirado num aliado ("eu" ou "parceiro"): no fim, sai o apoio.</summary>
        public string Aliado;
    }

    /// <summary>TS: Arena — tudo o que a luta em tempo real tem: os monstros, o herói na sala e os tempos.</summary>
    public sealed class Arena
    {
        public double Passo;
        public double Lento;
        public Walker Chegada;
        /// <summary>Onde o herói está na sala, e pra onde olha: é ali que ele fica quando a luta acaba.</summary>
        public Walker Heroi;
        public double Alvo;
        /// <summary>
        /// O jogador tocou na placa desse alvo (Mirar): no celular, o ataque vai nele enquanto estiver ao alcance. Sem
        /// escolha (null), vai no de pé mais perto.
        /// </summary>
        public bool? Escolhido;
        public List<MonstroNaArena> Monstros;
        public List<CompanheiroNaArena> Companheiros;
        public List<Tiro> Tiros;
        [KeepNull] public EventoAberto Evento;
        public double Recarga;
        public OrderedMap<double> RecargaDosPoderes;
        public double RecargaDoItem;
        public double Rodada;
        public double Intervalo;
        public double Vez;
        /// <summary>
        /// O que sobra do escudo do vigor (a Encantadora, <see cref="Encantamentos"/>): apanha antes da vida e some com a
        /// luta. Ausente (null) quando o herói não tem vigor.
        /// </summary>
        public double? Escudo;
        /// <summary>A luta em dupla; ausente (null) na luta de um só.</summary>
        public Dupla Dupla;
        /// <summary>O que a classe do herói junta nesta luta (a fúria, o combo…; <see cref="ClassesDeLuta"/>). Ausente até juntar algo.</summary>
        public ContadoresDaClasse Classe;
        /// <summary>No celular: o jogador tocou na placa de um aliado ("eu" ou "parceiro"), e o apoio vai nele.</summary>
        public string AlvoAliado;
        /// <summary>A moral do grupo (o Bardo): chega da memória do app na abertura e volta no fim.</summary>
        public Moral Moral;
        /// <summary>O reforço do Bardo: os passos que ainda faltam do dano a mais.</summary>
        public double? Reforco;
        /// <summary>O Poder da fé: os passos até ele voltar, e os que ainda faltam do que está de pé.</summary>
        public double? RecargaDaFe;
        public double? Fe;
        /// <summary>O dano que o herói daqui levou, com o passo do mundo (só o Clérigo e a dupla contam).</summary>
        public List<DanoLevado> DanosLevados;
        /// <summary>O ki do Monge (rodada 4a), e se ele está revestido (até o próximo golpe levado).</summary>
        public double? Ki;
        public bool? Revestido;
        /// <summary>Segurando K: os passos desde o último ponto de mana ou de ki, e se segurou neste passo.</summary>
        public double? Canal;
        public bool? Canalizando;
        /// <summary>O Necromante (rodada 4b): os cristais dos inimigos que caíram nesta luta, e a espera da Magia Proibida.</summary>
        public List<CristalNaSala> Cristais;
        public double? RecargaDaMagia;
        /// <summary>O Florescimento (rodada 5b): as flores que o herói daqui plantou (a mais antiga primeiro), e os passos dentro de uma até a próxima cura.</summary>
        public List<FlorNaSala> Flores;
        public double? RelogioDaFlor;
        /// <summary>A área de escuridão do Mago (rodada 5c).</summary>
        public EscuridaoNaSala Escuridao;
        /// <summary>O chapéu do espadachim voando, e a espera dele (rodada 6c).</summary>
        public ChapeuNaSala Chapeu;
        public double? RecargaDoChapeu;
        /// <summary>O meio da área que os animais no estratégico guardam (rodada 7c), em unidades da sala: só nesta luta.</summary>
        public PontoNaSala Guarda;
    }

    /// <summary>TS: LutaEmTempoReal. Fim: null, "vitoria" ou "derrota".</summary>
    public class LutaEmTempoReal
    {
        public EstadoDoJogo Estado;
        public Arena Arena;
        [KeepNull] public string Pet;
        /// <summary>Jogada no teclado (o PC): o cajado pede letras em vez do desenho (EVENTO_NO_TECLADO).</summary>
        public bool Teclado;
        [KeepNull] public string Fim;
        [KeepNull] public Item Loot;
        /// <summary>O chefe final caiu e a masmorra foi zerada: a tela de vitória (<see cref="Conquistas"/>).</summary>
        public Conquista Conquista;
    }

    /// <summary>Onde o dedo está, na caixa do desenho.</summary>
    public sealed class DedoNoDesenho
    {
        public double X;
        public double Y;
    }

    /// <summary>Um ponto da sala, em unidades dela (o cursor do PC).</summary>
    public sealed class PontoNaSala
    {
        public double X;
        public double Y;
    }

    /// <summary>TS: EntradaDaLuta — o que a pessoa fez neste passo.</summary>
    public sealed class EntradaDaLuta
    {
        public double X;
        public double Y;
        public double? Mirar;
        /// <summary>No PC, onde o cursor está na sala, em unidades dela: o ataque vai no monstro da área em volta dele, ou no chão.</summary>
        public PontoNaSala Cursor;
        public bool? Atacar;
        public bool? Soltar;
        public bool? Tocar;
        public DedoNoDesenho Dedo;
        /// <summary>Letras: a tecla de letra apertada neste passo.</summary>
        public string Tecla;
        public string Poder;
        public string Item;
        public bool? Menu;
        /// <summary>Em dupla: onde o parceiro está agora, e se caiu.</summary>
        public ParceiroNaEntrada Parceiro;
        /// <summary>Em dupla, o anfitrião: o dano que o parceiro causou desde o último passo.</summary>
        public List<DanoNoMonstro> DanoDeFora;
        /// <summary>Em dupla, o convidado: o estado dos monstros que chegou do anfitrião neste passo.</summary>
        public Espelho Espelho;
        /// <summary>Em dupla: o parceiro saiu da sala. Quem ficou segue sozinho; se estava caído, perde.</summary>
        public bool? SemParceiro;
        /// <summary>Em dupla: o parceiro gastou uma Poção de Reviver em mim — com quantos % da vida máxima eu levanto.</summary>
        public double? Reviver;
        /// <summary>Tocou na placa de um aliado (o celular): "eu" ou "parceiro".</summary>
        public string MirarAliado;
        /// <summary>Apertou o botão do Poder da fé (o Clérigo).</summary>
        public bool? Fe;
        /// <summary>Em dupla: o apoio que o parceiro soltou em mim desde o último passo.</summary>
        public List<ApoioDoParceiro> Apoios;
        /// <summary>Em dupla: a moral do grupo, que o Bardo do parceiro subiu.</summary>
        public double? Moral;
        /// <summary>Segurando K neste passo (parado e sem atacar).</summary>
        public bool? Canalizar;
        /// <summary>O Monge: apertou o revestimento de ki, ou a explosão de ki.</summary>
        public bool? Revestir;
        public bool? Explodir;
        /// <summary>O Necromante: apertou a Magia Proibida.</summary>
        public bool? Magia;
        /// <summary>O Espadachim: apertou o Corte Invernal.</summary>
        public bool? Corte;
        /// <summary>O Florescimento no celular (rodada 5b): o botão 🌸 planta uma flor no pé do herói.</summary>
        public bool? Florescer;
        /// <summary>O Monge e o Espadachim (rodada 6c): apertou o chapéu do espadachim (vai rumo ao cursor, ou ao alvo).</summary>
        public bool? Chapeu;
        /// <summary>O Caçador (rodada 7b): ofereceu a comida a este monstro (no PC, o botão direito nele; no celular, segurar o dedo nele).</summary>
        public double? Alimentar;
        /// <summary>O Caçador (rodada 7c): marcou a área que os animais no estratégico guardam (no PC, o botão direito no chão; no celular, segurar o dedo no chão).</summary>
        public PontoNaSala Guardar;
    }

    /// <summary>TS: Acontecimento — algo que a tela mostra ou toca.</summary>
    public sealed class Acontecimento
    {
        /// <summary>"numero", "som", "diario" ou "aviso".</summary>
        public string Tipo;
        public string Texto;
        /// <summary>"monstro", "heroi", "companheiro" ou "chao" (o golpe que foi no chão, em X e Y).</summary>
        public string Onde;
        /// <summary>Número no chão: onde, em unidades da sala.</summary>
        public double? X;
        public double? Y;
        public double? Indice;
        /// <summary>"dano", "critico", "cura" ou "erro".</summary>
        public string Tom;
        public string Som;
    }

    /// <summary>TS: QuadroDaLuta.</summary>
    public sealed class QuadroDaLuta
    {
        public LutaEmTempoReal Luta;
        public List<Acontecimento> Acontecimentos;
        /// <summary>Em dupla, no convidado: o dano que o herói daqui (e a equipe dele) causou, pra mandar ao anfitrião. Ausente (null) sem dano.</summary>
        public List<DanoNoMonstro> Danos;
        /// <summary>Em dupla: o apoio que o herói daqui soltou no parceiro, pra mandar a ele. Ausente (null) sem nenhum.</summary>
        public List<ApoioDoParceiro> Apoios;
        /// <summary>O Bardo daqui subiu a moral do grupo: o nível novo, pra mandar ao parceiro.</summary>
        public double? Moral;
        /// <summary>A Magia Proibida levantou o parceiro: com quantos % (vai pela rede como a Poção de Reviver).</summary>
        public double? Reviver;
        /// <summary>O Caçador domou um bicho neste passo: o id do animal (o app abre a janela do nome).</summary>
        public string Domou;
    }

    /// <summary>As tabelas de luta/arena.ts (fixtures/data/luta/arena.json).</summary>
    public sealed class ArenaData
    {
        [JsName("LENTIDAO")] public double Lentidao;
        [JsName("RODADA")] public double Rodada;
        [JsName("RECARGA_DO_ATAQUE")] public double RecargaDoAtaque;
        [JsName("RECARGA_DO_PODER")] public double RecargaDoPoder;
        [JsName("RECARGA_DO_ITEM")] public double RecargaDoItem;
        [JsName("TIPOS_DE_PODER_MAGICO")] public List<string> TiposDePoderMagico = new List<string>();
        [JsName("FORCA_DO_PODER_ERRADO")] public double ForcaDoPoderErrado;
        [JsName("RAIO_DO_HEROI")] public double RaioDoHeroi;
        [JsName("AREA_DA_MIRA")] public double AreaDaMira;
        [JsName("FOLGA_DO_ALCANCE")] public double FolgaDoAlcance;
        [JsName("VIDA_DO_TIRO")] public double VidaDoTiro;
        [JsName("TEMPO_ATORDOADO")] public double TempoAtordoado;
        [JsName("TEMPO_HESITANDO")] public double TempoHesitando;
        [JsName("ESPERA_INICIAL")] public double EsperaInicial;
        [JsName("ATACANDO_DE_UMA_VEZ")] public double AtacandoDeUmaVez;
        [JsName("INTERVALO_ENTRE_GOLPES")] public double IntervaloEntreGolpes;
        [JsName("RESPIRO_DO_MONSTRO")] public double RespiroDoMonstro;
        [JsName("ESPACO_ENTRE_MONSTROS")] public double EspacoEntreMonstros;
        [JsName("CADENCIA_DO_COMPANHEIRO")] public double CadenciaDoCompanheiro;
        [JsName("JEITOS_DE_LUTAR")] public OrderedMap<JeitoDeLutar> JeitosDeLutar = new OrderedMap<JeitoDeLutar>();
    }

    public static partial class GameData
    {
        private static ArenaData _arenaTable;

        /// <summary>luta/arena: os tempos, o alcance e os jeitos de lutar da luta em tempo real.</summary>
        public static ArenaData ArenaTable
        {
            get => Require(_arenaTable, "luta/arena");
            set => _arenaTable = value;
        }
    }

    /// <summary>
    /// Port de shared/src/luta/arena.ts: a luta em tempo real do app, na própria sala — a sala é a arena (doc do
    /// Breno de 2026-11-10, decidido com o usuário em 2026-11-11; antes o herói era um coração numa caixa). Os
    /// monstros ficam cada um na casa dele; o herói anda pela sala (RoomWalk.Tick), com as portas fechadas e os
    /// monstros de pé tomando a casa deles; todo golpe de monstro no herói é um desenho no chão com aviso antes, e
    /// só pega se encostar nele. O botão de ataque abre o evento da arma no alvo, em câmera lenta, e o ataque tem o
    /// alcance da classe (AlcanceNaArena; doc do Breno de 2026-11-15); no PC o alvo é o monstro na área do cursor
    /// (AreaDaMira), e sem nenhum o golpe vai no chão. Um monstro golpeia por vez, revezando; o golpe
    /// pode ir num companheiro pela regra do site. A recompensa é a do site (FimDaLuta). Tudo em passos e unidades
    /// inteiras; o sorteio atravessa a luta inteira.
    /// </summary>
    public static class Arenas
    {
        private static ArenaData D => GameData.ArenaTable;

        public static double Lentidao => D.Lentidao;
        public static double Rodada => D.Rodada;
        public static double RaioDoHeroi => D.RaioDoHeroi;
        public static double AreaDaMira => D.AreaDaMira;

        /// <summary>O jeito de lutar de um comportamento (o agressivo, se não houver), pra tela desenhar o golpe.</summary>
        public static JeitoDeLutar JeitoDoComportamento(string behavior) =>
            behavior != null && D.JeitosDeLutar.TryGet(behavior, out var jeito) ? jeito : D.JeitosDeLutar.Get("agressivo");

        /// <summary>A luta enquanto o passo corre: a mesma, mais o sorteio, o relógio e o que vai pra tela.</summary>
        private sealed class Luta
        {
            public EstadoDoJogo Estado;
            public Arena Arena;
            public string Pet;
            public bool Teclado;
            public string Fim;
            public Item Loot;
            public Conquista Conquista;
            public RngFn Rng;
            public Func<double> Now;
            public List<Acontecimento> Acontecimentos = new List<Acontecimento>();
            /// <summary>O dano causado neste passo no espelho (<see cref="QuadroDaLuta.Danos"/>).</summary>
            public List<DanoNoMonstro> Danos = new List<DanoNoMonstro>();
            /// <summary>O apoio solto no parceiro neste passo (<see cref="QuadroDaLuta.Apoios"/>).</summary>
            public List<ApoioDoParceiro> Apoios = new List<ApoioDoParceiro>();
            /// <summary>A moral que o Bardo daqui subiu neste passo.</summary>
            public double? MoralSubiu;
            /// <summary>A Magia Proibida levantou o parceiro neste passo.</summary>
            public double? ReviverParceiro;
            /// <summary>O Caçador domou um bicho neste passo.</summary>
            public string Domou;
        }

        // ---------- abrir ----------

        /// <summary>
        /// TS: abrirLuta — prepara os monstros e o herói (<see cref="FimDaLuta.PrepararLuta"/>), põe os monstros no
        /// palco (os caídos ficam no lugar, apagados), o herói um passo pra dentro da porta e os companheiros vivos ao lado.
        /// O alvo começa no primeiro de pé. <paramref name="chegada"/> é por onde o herói entrou: a luta guarda
        /// pra ele voltar ali quando acabar. <paramref name="teclado"/>: jogada no PC, onde o cajado pede letras em
        /// vez do desenho.
        /// </summary>
        public static QuadroDaLuta AbrirLuta(EstadoNaMasmorra estado, Walker chegada, string pet = null, bool teclado = false, string dupla = null, MemoriaDaLuta memoria = null)
        {
            var preparada = FimDaLuta.PrepararLuta(estado);
            var sala = (DungeonCell)Estados.CelulaAtual(preparada.Estado);
            var dePe = FimDaLuta.IndicesDePe(sala);

            var monstros = new List<MonstroNaArena>();
            int total = sala.Monsters?.Count ?? 0;
            var formato = ArteDaSala.GeometriaDaSala(((EstadoNaMasmorra)preparada.Estado).Masmorra.Dungeon);
            for (int indice = 0; indice < total; indice++)
            {
                var lugar = LugarDoMonstro(total, indice, formato);
                monstros.Add(new MonstroNaArena
                {
                    Indice = indice,
                    Fase = dePe.Contains(indice) ? "esperando" : "caido",
                    Tempo = 0,
                    Forca = 1,
                    Alvo = -1,
                    X = 0,
                    Y = 0,
                    RumoX = 0,
                    RumoY = 0,
                    CorpoX = lugar.X,
                    CorpoY = lugar.Y,
                });
            }

            var companheiros = new List<CompanheiroNaArena>();
            var equipe = ((EstadoNaMasmorra)preparada.Estado).Party ?? new List<Companion>();
            var heroiNaSala = LutaNoMapa.HeroiNaLuta(chegada, formato);
            var paredes = ArteDaSala.ParedesDaSala(((EstadoNaMasmorra)preparada.Estado).Masmorra.Dungeon);
            int comCorpo = 0;
            for (int indice = 0; indice < equipe.Count; indice++)
            {
                if (equipe[indice].Hp <= 0) continue;
                var c = new CompanheiroNaArena { Indice = indice, Tempo = D.CadenciaDoCompanheiro / 2 + indice * 10 };
                // O lacaio do Necromante entra ao lado do herói (rodada 4b).
                if (equipe[indice].Invocado == true || equipe[indice].Animal != null)
                {
                    var lugar = LugarAoLado(heroiNaSala.X, heroiNaSala.Y, comCorpo++, formato, paredes);
                    c.X = lugar.X;
                    c.Y = lugar.Y;
                }
                companheiros.Add(c);
            }

            var arena = new Arena
            {
                Passo = 0,
                Lento = 0,
                Chegada = new Walker { X = chegada.X, Y = chegada.Y, Facing = chegada.Facing },
                Heroi = CopiaDe(LutaNoMapa.HeroiNaLuta(chegada, formato)),
                Alvo = dePe.Count > 0 ? dePe[0] : 0,
                Monstros = monstros,
                Companheiros = companheiros,
                Tiros = new List<Tiro>(),
                Evento = null,
                Recarga = 0,
                RecargaDosPoderes = new OrderedMap<double>(),
                RecargaDoItem = 0,
                Rodada = D.Rodada,
                Intervalo = D.EsperaInicial,
                Vez = -1,
            };
            var acontecimentos = new List<Acontecimento>();
            foreach (var texto in preparada.Log) acontecimentos.Add(new Acontecimento { Tipo = "diario", Texto = texto });
            // O vigor da armadura encantada ergue o escudo na entrada da luta (só o app tem a arena).
            double escudo = Encantamentos.EscudoDoVigor(preparada.Estado.Hero);
            if (escudo > 0)
            {
                arena.Escudo = escudo;
                acontecimentos.Add(Aviso("💪 Vigor: escudo de " + Js.NumberToString(escudo)));
            }
            if (dupla != null)
            {
                arena.Dupla = new Dupla { Papel = dupla };
                // Quem já chega caído (o fantasma que ninguém reviveu) só acompanha.
                if (preparada.Estado.Hero.Hp <= 0) arena.Dupla.Fantasma = true;
            }
            if (memoria != null)
            {
                if ((memoria.Moral?.Nivel ?? 0) > 0 || (memoria.Moral?.Criticos ?? 0) > 0) arena.Moral = memoria.Moral.Clone();
                if ((memoria.RecargaDaFe ?? 0) > 0) arena.RecargaDaFe = Math.Truncate(memoria.RecargaDaFe.Value);
                if ((memoria.Ki ?? 0) > 0) arena.Ki = Math.Min(CD.Monge.TetoDoKi, Math.Truncate(memoria.Ki.Value));
                if ((memoria.RecargaDaMagia ?? 0) > 0) arena.RecargaDaMagia = Math.Truncate(memoria.RecargaDaMagia.Value);
                if ((memoria.RecargaDoChapeu ?? 0) > 0) arena.RecargaDoChapeu = Math.Truncate(memoria.RecargaDoChapeu.Value);
            }
            return new QuadroDaLuta
            {
                Luta = new LutaEmTempoReal { Estado = preparada.Estado, Arena = arena, Pet = pet, Teclado = teclado, Fim = null, Loot = null },
                Acontecimentos = acontecimentos,
            };
        }

        // ---------- o passo ----------

        /// <summary>
        /// TS: passoDaLuta — um passo da luta. O evento da arma corre em tempo de verdade; o mundo (herói,
        /// monstros, companheiros, tiros, rodada) anda um passo, ou, em câmera lenta, um a cada LENTIDAO.
        /// <paramref name="now"/> é o relógio do uid do item que cai ao vencer (e do andar novo, se foi chefe).
        /// </summary>
        public static QuadroDaLuta PassoDaLuta(LutaEmTempoReal luta, EntradaDaLuta entrada, RngFn rng, Func<double> now = null)
        {
            if (luta.Fim != null) return new QuadroDaLuta { Luta = luta, Acontecimentos = new List<Acontecimento>() };
            var l = new Luta { Estado = luta.Estado, Arena = CopiarArena(luta.Arena), Pet = luta.Pet, Teclado = luta.Teclado, Fim = luta.Fim, Loot = luta.Loot, Conquista = luta.Conquista, Rng = rng, Now = now };
            // A recarga do Poder da fé corre no tempo de verdade, mesmo na câmera lenta.
            if (l.Arena.RecargaDaFe != null)
            {
                if (l.Arena.RecargaDaFe.Value > 1) l.Arena.RecargaDaFe -= 1;
                else l.Arena.RecargaDaFe = null;
            }
            if (l.Arena.RecargaDaMagia != null)
            {
                if (l.Arena.RecargaDaMagia.Value > 1) l.Arena.RecargaDaMagia -= 1;
                else l.Arena.RecargaDaMagia = null;
            }
            if (l.Arena.RecargaDoChapeu != null)
            {
                if (l.Arena.RecargaDoChapeu.Value > 1) l.Arena.RecargaDoChapeu -= 1;
                else l.Arena.RecargaDoChapeu = null;
            }

            if (l.Arena.Dupla != null) ReceberDoParceiro(l, entrada);
            if (l.Fim != null) return FecharPasso(l);
            if (entrada.Mirar != null) Mirar(l, entrada.Mirar.Value);
            if (Js.Truthy(entrada.MirarAliado)) MirarAliado(l, entrada.MirarAliado);
            if (entrada.Guardar != null) MarcarGuarda(l, entrada.Guardar);
            // O fantasma anda, mas não age.
            if (l.Arena.Dupla?.Fantasma == true) l.Arena.Evento = null;
            else if (l.Arena.Evento != null) SeguirEvento(l, entrada);
            else if (entrada.Atacar == true && l.Arena.Recarga <= 0) AbrirEvento(l, entrada);
            else if (Js.Truthy(entrada.Poder)) PedirPoder(l, entrada.Poder);
            else if (entrada.Fe == true) UsarFe(l);
            else if (entrada.Revestir == true) Revestir(l);
            else if (entrada.Explodir == true) Explodir(l);
            else if (entrada.Magia == true) UsarMagia(l);
            else if (entrada.Corte == true) CorteInvernal(l);
            else if (entrada.Chapeu == true) LancarChapeu(l, entrada);
            else if (entrada.Alimentar != null) Alimentar(l, entrada.Alimentar.Value);
            else if (entrada.Florescer == true && l.Arena.Recarga <= 0) Plantar(l, l.Arena.Heroi.X, l.Arena.Heroi.Y);
            else if (Js.Truthy(entrada.Item)) UsarItem(l, entrada.Item);

            if (l.Fim == null)
            {
                // Em dupla não há câmera lenta (decisão do usuário, 2026-11-15): ninguém trava o outro.
                bool lento = l.Arena.Dupla == null && (l.Arena.Evento != null || entrada.Menu == true);
                if (lento) l.Arena.Lento += 1;
                if (!lento || l.Arena.Lento % D.Lentidao == 0) PassoDoMundo(l, entrada);
            }

            return FecharPasso(l);
        }

        private static QuadroDaLuta FecharPasso(Luta l) => new QuadroDaLuta
        {
            Luta = new LutaEmTempoReal { Estado = l.Estado, Arena = l.Arena, Pet = l.Pet, Teclado = l.Teclado, Fim = l.Fim, Loot = l.Loot, Conquista = l.Conquista },
            Acontecimentos = l.Acontecimentos,
            Danos = l.Danos.Count > 0 ? l.Danos : null,
            Apoios = l.Apoios.Count > 0 ? l.Apoios : null,
            Moral = l.MoralSubiu,
            Reviver = l.ReviverParceiro,
            Domou = l.Domou,
        };

        /// <summary>TS: simularLuta — vários passos de uma vez, cada um com a sua entrada; para no fim da luta.</summary>
        public static QuadroDaLuta SimularLuta(LutaEmTempoReal luta, IReadOnlyList<EntradaDaLuta> entradas, RngFn rng, Func<double> now = null)
        {
            var atual = luta;
            var acontecimentos = new List<Acontecimento>();
            var danos = new List<DanoNoMonstro>();
            var apoios = new List<ApoioDoParceiro>();
            double? moral = null;
            double? reviver = null;
            string domou = null;
            foreach (var entrada in entradas)
            {
                if (atual.Fim != null) break;
                var quadro = PassoDaLuta(atual, entrada, rng, now);
                atual = quadro.Luta;
                acontecimentos.AddRange(quadro.Acontecimentos);
                if (quadro.Danos != null) danos.AddRange(quadro.Danos);
                if (quadro.Apoios != null) apoios.AddRange(quadro.Apoios);
                if (quadro.Moral != null) moral = quadro.Moral;
                if (quadro.Reviver != null) reviver = quadro.Reviver;
                if (quadro.Domou != null) domou = quadro.Domou;
            }
            return new QuadroDaLuta { Luta = atual, Acontecimentos = acontecimentos, Danos = danos.Count > 0 ? danos : null, Apoios = apoios.Count > 0 ? apoios : null, Moral = moral, Reviver = reviver, Domou = domou };
        }

        private static Arena CopiarArena(Arena arena)
        {
            var copia = new Arena
            {
                Passo = arena.Passo,
                Lento = arena.Lento,
                Chegada = new Walker { X = arena.Chegada.X, Y = arena.Chegada.Y, Facing = arena.Chegada.Facing },
                Heroi = CopiaDe(arena.Heroi),
                Alvo = arena.Alvo,
                Escolhido = arena.Escolhido,
                Monstros = new List<MonstroNaArena>(arena.Monstros.Count),
                Companheiros = new List<CompanheiroNaArena>(arena.Companheiros.Count),
                Tiros = new List<Tiro>(arena.Tiros.Count),
                Evento = null,
                Recarga = arena.Recarga,
                RecargaDosPoderes = new OrderedMap<double>(),
                RecargaDoItem = arena.RecargaDoItem,
                Rodada = arena.Rodada,
                Intervalo = arena.Intervalo,
                Vez = arena.Vez,
                Escudo = arena.Escudo,
                Dupla = arena.Dupla?.Clone(),
                Classe = arena.Classe?.Clone(),
                AlvoAliado = arena.AlvoAliado,
                Moral = arena.Moral?.Clone(),
                Reforco = arena.Reforco,
                RecargaDaFe = arena.RecargaDaFe,
                Fe = arena.Fe,
                Ki = arena.Ki,
                Revestido = arena.Revestido,
                Canal = arena.Canal,
                Canalizando = arena.Canalizando,
                RecargaDaMagia = arena.RecargaDaMagia,
                Flores = arena.Flores != null ? arena.Flores.ConvertAll(f => f.Clone()) : null,
                RelogioDaFlor = arena.RelogioDaFlor,
                Escuridao = arena.Escuridao?.Clone(),
                Chapeu = arena.Chapeu?.Clone(),
                RecargaDoChapeu = arena.RecargaDoChapeu,
                Guarda = arena.Guarda != null ? new PontoNaSala { X = arena.Guarda.X, Y = arena.Guarda.Y } : null,
            };
            if (arena.Cristais != null)
            {
                copia.Cristais = new List<CristalNaSala>(arena.Cristais.Count);
                foreach (var cristal in arena.Cristais) copia.Cristais.Add(cristal.Clone());
            }
            if (arena.DanosLevados != null)
            {
                copia.DanosLevados = new List<DanoLevado>(arena.DanosLevados.Count);
                foreach (var d in arena.DanosLevados) copia.DanosLevados.Add(new DanoLevado { Passo = d.Passo, Dano = d.Dano });
            }
            foreach (var m in arena.Monstros) copia.Monstros.Add(m.Clone());
            foreach (var c in arena.Companheiros) copia.Companheiros.Add(c.Clone());
            foreach (var t in arena.Tiros) copia.Tiros.Add(t.Clone());
            foreach (var par in arena.RecargaDosPoderes) copia.RecargaDosPoderes.Set(par.Key, par.Value);
            if (arena.Evento != null)
            {
                var j = arena.Evento.Jogada ?? new JogadaDoEvento();
                copia.Evento = new EventoAberto
                {
                    Evento = arena.Evento.Evento,
                    Poder = arena.Evento.Poder,
                    Passo = arena.Evento.Passo,
                    Jogada = new JogadaDoEvento
                    {
                        Toque = j.Toque,
                        Soltou = j.Soltou,
                        Toques = j.Toques != null ? new List<double>(j.Toques) : null,
                        Traco = j.Traco != null ? new List<PontoDoTraco>(j.Traco) : null,
                        Teclas = j.Teclas != null ? new List<TeclaDoEvento>(j.Teclas) : null,
                    },
                    Alvo = arena.Evento.Alvo,
                    Estilo = arena.Evento.Estilo,
                    Aliado = arena.Evento.Aliado,
                };
            }
            return copia;
        }

        private static EstadoNaMasmorra Masmorra(Luta l)
        {
            if (l.Estado.MapMode != "dungeon") throw new EngineError("a luta só acontece na masmorra", "Error");
            return (EstadoNaMasmorra)l.Estado;
        }

        private static DungeonCell Sala(Luta l) => (DungeonCell)Estados.CelulaAtual(Masmorra(l));

        private static CombatMonsterView MonstroNo(Luta l, double indice) => Monsters.View(Sala(l).Monsters[(int)indice]);

        private static JeitoDeLutar JeitoDe(CombatMonsterView monstro) => JeitoDoComportamento(monstro.Behavior);

        /// <summary>
        /// TS: jeitoDoGolpe — o jeito do golpe em curso: o do comportamento, e o chefe final mexe nele. Na fúria o aviso
        /// e o descanso encurtam; o Golpe Devastador avisa por mais tempo e pega mais longe (a tela desenha o aviso
        /// com este tamanho).
        /// </summary>
        public static JeitoDeLutar JeitoDoGolpe(CombatMonsterView monstro, string poder = null)
        {
            var jeito = JeitoDe(monstro);
            if (monstro.ChefeFinal == true && monstro.Furia == true)
                jeito = Com(jeito, aviso: Math.Truncate(jeito.Aviso * 2 / 3), descanso: Math.Truncate(jeito.Descanso / 2));
            if (poder == ChefeFinal.Devastador)
                jeito = Com(jeito, aviso: Math.Truncate(jeito.Aviso * 3 / 2), tamanho: Math.Truncate(jeito.Tamanho * 13 / 10));
            return jeito;
        }

        /// <summary>O <c>{ ...jeito, campo }</c> do TS: um jeito novo, com só o que mudou.</summary>
        private static JeitoDeLutar Com(JeitoDeLutar jeito, double? aviso = null, double? descanso = null, double? tamanho = null) => new JeitoDeLutar
        {
            Aviso = aviso ?? jeito.Aviso,
            Golpe = jeito.Golpe,
            Tamanho = tamanho ?? jeito.Tamanho,
            Velocidade = jeito.Velocidade,
            Descanso = descanso ?? jeito.Descanso,
            Guarda = jeito.Guarda,
            Passo = jeito.Passo,
            Distancia = jeito.Distancia,
        };

        /// <summary>O monstro da arena no índice, se o índice for um inteiro dentro da lista (o <c>monstros[i]</c> do TS).</summary>
        private static MonstroNaArena MonstroDaArena(Luta l, double indice)
        {
            if (indice != Math.Floor(indice) || indice < 0 || indice >= l.Arena.Monstros.Count) return null;
            return l.Arena.Monstros[(int)indice];
        }

        /// <summary>O alvo do jogador, se ainda está de pé; senão o primeiro de pé. null, ninguém de pé.</summary>
        private static double? AlvoAtual(Luta l)
        {
            var escolhido = MonstroDaArena(l, l.Arena.Alvo);
            if (escolhido != null && escolhido.Fase != "caido") return escolhido.Indice;
            foreach (var m in l.Arena.Monstros)
                if (m.Fase != "caido") return m.Indice;
            return null;
        }

        private static Walker CopiaDe(Walker w) => new Walker { X = w.X, Y = w.Y, Facing = w.Facing };

        private static GeometriaDaSala Geometria(Luta l) => ArteDaSala.GeometriaDaSala(Masmorra(l).Masmorra.Dungeon);

        /// <summary>TS: lugarDoMonstro — o meio da casa em que o monstro começa a luta, em unidades da sala.</summary>
        public static (double X, double Y) LugarDoMonstro(double quantos, double indice, GeometriaDaSala formato)
        {
            var lugares = LutaNoMapa.LugaresNaLuta(quantos, formato);
            var lugar = lugares[(int)Math.Min(indice, lugares.Count - 1)];
            return (lugar.Col * RoomWalk.TileUnits + RoomWalk.TileUnits / 2, lugar.Row * RoomWalk.TileUnits + RoomWalk.TileUnits / 2);
        }

        /// <summary>TS: lugarDe — onde o monstro está de pé agora: de onde sai a investida e o tiro, e o que o alcance mede.</summary>
        private static (double X, double Y) LugarDe(Luta l, double indice)
        {
            foreach (var m in l.Arena.Monstros)
                if (m.Indice == indice) return (m.CorpoX, m.CorpoY);
            return LugarDoMonstro(l.Arena.Monstros.Count, indice, Geometria(l));
        }

        /// <summary>
        /// TS: porOsLacaios — os lacaios entraram: cada novo aparece na casa dele pro novo tamanho do grupo; quem já
        /// estava na sala fica onde está (desde 2026-11-15 os monstros andam).
        /// </summary>
        private static void PorOsLacaios(Luta l, List<double> novos)
        {
            var formato = Geometria(l);
            foreach (var m in l.Arena.Monstros)
            {
                if (!novos.Contains(m.Indice)) continue;
                var lugar = LugarDoMonstro(l.Arena.Monstros.Count, m.Indice, formato);
                m.CorpoX = lugar.X;
                m.CorpoY = lugar.Y;
            }
        }

        /// <summary>
        /// TS: pousar — a investida acabou em (m.X, m.Y): o monstro fica ali, puxado pra dentro do chão se passou da
        /// parede. A que pegou no herói (<paramref name="raio"/> é o do corpo que investe) para encostada nele, e não em cima.
        /// </summary>
        private static void Pousar(Luta l, MonstroNaArena m, double? raio = null)
        {
            double x = m.X;
            double y = m.Y;
            if (raio.HasValue)
            {
                var heroi = l.Arena.Heroi;
                double limite = raio.Value + D.RaioDoHeroi;
                double dx = x - heroi.X;
                double dy = y - heroi.Y;
                if (dx == 0 && dy == 0)
                {
                    dx = -m.RumoX;
                    dy = -m.RumoY;
                }
                double distancia = Math.Sqrt(dx * dx + dy * dy);
                if (distancia > 0 && distancia < limite)
                {
                    x = heroi.X + Math.Truncate(dx * limite / distancia);
                    y = heroi.Y + Math.Truncate(dy * limite / distancia);
                }
            }
            var formato = Geometria(l);
            double meia = RoomWalk.TileUnits / 2;
            m.CorpoX = Math.Min(Math.Max(x, RoomWalk.TileUnits + meia), (formato.Cols - 1) * RoomWalk.TileUnits - meia);
            m.CorpoY = Math.Min(Math.Max(y, RoomWalk.TileUnits + meia), (formato.Rows - 1) * RoomWalk.TileUnits - meia);
        }

        /// <summary>
        /// TS: alcanceNaArena — até onde o ataque comum alcança, em unidades da sala, do pé do herói ao meio da casa do
        /// monstro: o alcance da classe em blocos e mais meia casa (com 1 bloco, a casa do lado).
        /// </summary>
        public static double AlcanceNaArena(Hero hero) =>
            ClassesDeLuta.AlcanceDoHeroi(hero) * RoomWalk.TileUnits + RoomWalk.TileUnits / 2;

        /// <summary>TS: velocidadeNaArena — a velocidade de andar na luta: a de sempre na % da classe; com a perna quebrada, o passo do mapa.</summary>
        public static double VelocidadeNaArena(Hero hero)
        {
            double pct = ClassesDeLuta.De(hero).Velocidade;
            double daClasse = pct == 100 ? RoomWalk.HeroSpeed : Math.Truncate(RoomWalk.HeroSpeed * pct / 100);
            return hero.Ferimentos?.Perna == true ? Math.Truncate(daClasse * FerimentosDoHeroi.PassoComPernaQuebrada) : daClasse;
        }

        /// <summary>O herói alcança o monstro com o ataque comum, com esta folga a mais?</summary>
        private static bool Alcanca(Luta l, double indice, double folga = 0)
        {
            var lugar = LugarDe(l, indice);
            var quem = Masmorra(l).Hero;
            if (Catalog.IdDaClasse(quem.ClassId, quem.ClassName) == "druida")
            {
                // Os estilos (rodada 5b): as Raízes pegam qualquer um da sala; a garra e a flor shuriken saem do herói.
                string estilo = Estilos.IdDoEstilo(quem);
                if (estilo == "raizes") return true;
                if (estilo != "metamorfose" && estilo != "florescimento") return NasVinhas(l, lugar.X, lugar.Y, folga);
            }
            double dx = l.Arena.Heroi.X - lugar.X;
            double dy = l.Arena.Heroi.Y - lugar.Y;
            // O Espadachim com o avanço pronto alcança mais: ele vai até o alvo (rodada 5a).
            double avanco = AvancoPronto(l) ? Estilos.Espadachim.Avanco * RoomWalk.TileUnits : 0;
            double limite = AlcanceNaArena(Masmorra(l).Hero) + folga + avanco;
            return dx * dx + dy * dy <= limite * limite;
        }

        /// <summary>TS: nasVinhas — as vinhas do Druida pegam o monstro a até VINHAS blocos de uma parede ou de um herói de pé.</summary>
        private static bool NasVinhas(Luta l, double x, double y, double folga)
        {
            double t = RoomWalk.TileUnits;
            double alcance = CD.Druida.Vinhas * t + folga;
            var g = Geometria(l);
            double daParede = Math.Min(Math.Min(x - t, (g.Cols - 1) * t - x), Math.Min(y - t, (g.Rows - 1) * t - y));
            if (daParede <= alcance) return true;
            foreach (var casa in ArteDaSala.ParedesDaSala(Masmorra(l).Masmorra.Dungeon))
            {
                double dx = Math.Max(Math.Max(casa.Col * t - x, 0), x - (casa.Col + 1) * t);
                double dy = Math.Max(Math.Max(casa.Row * t - y, 0), y - (casa.Row + 1) * t);
                if (dx * dx + dy * dy <= alcance * alcance) return true;
            }
            double doHeroi = alcance + t / 2;
            var heroi = l.Arena.Heroi;
            if ((heroi.X - x) * (heroi.X - x) + (heroi.Y - y) * (heroi.Y - y) <= doHeroi * doHeroi) return true;
            var parceiro = ParceiroDePe(l);
            return parceiro != null && (parceiro.X - x) * (parceiro.X - x) + (parceiro.Y - y) * (parceiro.Y - y) <= doHeroi * doHeroi;
        }

        /// <summary>TS: areaDaMira — a área da mira do herói daqui: a de todo mundo, e a do Arqueiro maior.</summary>
        private static double AreaDaMiraDe(Luta l)
        {
            double pct = ClassesDeLuta.MiraDaClasse(Masmorra(l).Hero);
            return pct == 100 ? D.AreaDaMira : Math.Truncate(D.AreaDaMira * pct / 100);
        }

        /// <summary>O monstro de pé na área da mira em volta de (x, y): o mais perto do cursor; null, nenhum. No empate, o primeiro.</summary>
        private static double? MonstroNaMira(Luta l, double x, double y) => MaisPertoNaMira(l, x, y, out _);

        /// <summary>TS: maisPertoNaMira — o monstro de pé na área da mira em volta de (x, y), e a distância dele (ao quadrado).</summary>
        private static double? MaisPertoNaMira(Luta l, double x, double y, out double menor)
        {
            double area = AreaDaMiraDe(l);
            double? melhor = null;
            menor = 0;
            foreach (var m in l.Arena.Monstros)
            {
                if (m.Fase == "caido") continue;
                var lugar = LugarDe(l, m.Indice);
                double dx = x - lugar.X;
                double dy = y - lugar.Y;
                double distancia = dx * dx + dy * dy;
                if (distancia > area * area) continue;
                if (melhor == null || distancia < menor)
                {
                    melhor = m.Indice;
                    menor = distancia;
                }
            }
            return melhor;
        }

        /// <summary>O monstro de pé mais perto do herói que a arma de perto alcança; null, nenhum. No empate, o primeiro.</summary>
        private static double? MaisPertoAoAlcance(Luta l)
        {
            double? melhor = null;
            double menor = 0;
            foreach (var m in l.Arena.Monstros)
            {
                if (m.Fase == "caido" || !Alcanca(l, m.Indice)) continue;
                var lugar = LugarDe(l, m.Indice);
                double dx = l.Arena.Heroi.X - lugar.X;
                double dy = l.Arena.Heroi.Y - lugar.Y;
                double distancia = dx * dx + dy * dy;
                if (melhor == null || distancia < menor)
                {
                    melhor = m.Indice;
                    menor = distancia;
                }
            }
            return melhor;
        }

        /// <summary>Um rumo de comprimento <paramref name="velocidade"/> de (0,0) até (dx, dy), em inteiros.</summary>
        private static (double X, double Y) Rumo(double dx, double dy, double velocidade)
        {
            double comprimento = Math.Sqrt(dx * dx + dy * dy);
            if (comprimento == 0) return (0, velocidade);
            return (Math.Truncate(dx * velocidade / comprimento), Math.Truncate(dy * velocidade / comprimento));
        }

        /// <summary>O círculo de raio <paramref name="raio"/> em (x, y) encosta no herói?</summary>
        private static bool Encosta(Walker heroi, double x, double y, double raio)
        {
            double dx = heroi.X - x;
            double dy = heroi.Y - y;
            double limite = raio + D.RaioDoHeroi;
            return dx * dx + dy * dy <= limite * limite;
        }

        /// <summary>O ponto (x, y) chegou na parede em volta da sala? É onde a investida e o tiro acabam.</summary>
        private static bool ForaDoChao(Luta l, double x, double y)
        {
            var g = Geometria(l);
            double t = RoomWalk.TileUnits;
            return x < t || x > (g.Cols - 1) * t || y < t || y > (g.Rows - 1) * t;
        }

        private static void Contar(Luta l, Acontecimento acontecimento) => l.Acontecimentos.Add(acontecimento);

        private static void Diario(Luta l, IEnumerable<string> linhas)
        {
            foreach (var texto in linhas) Contar(l, new Acontecimento { Tipo = "diario", Texto = texto });
        }

        private static Acontecimento Numero(string onde, double indice, string texto, string tom) =>
            new Acontecimento { Tipo = "numero", Onde = onde, Indice = indice, Texto = texto, Tom = tom };

        private static Acontecimento Som(string som) => new Acontecimento { Tipo = "som", Som = som };

        private static Acontecimento Aviso(string texto) => new Acontecimento { Tipo = "aviso", Texto = texto };

        // ---------- o ataque do herói ----------

        /// <summary>Tocar num monstro de pé faz dele o alvo. Caído, ou um índice que não existe, não muda nada.</summary>
        private static void Mirar(Luta l, double indice)
        {
            var m = MonstroDaArena(l, indice);
            if (m != null && m.Fase != "caido")
            {
                l.Arena.Alvo = m.Indice;
                l.Arena.Escolhido = true;
                l.Arena.AlvoAliado = null;
            }
        }

        /// <summary>TS: mirarAliado — tocar na placa de um aliado (o celular) faz dele o alvo do Bardo, do Clérigo e do Druida.</summary>
        private static void MirarAliado(Luta l, string aliado)
        {
            if (!ClassesDeLuta.ApoiaAliado(Masmorra(l).Hero)) return;
            if (aliado != "eu" && aliado != "parceiro") return;
            if (aliado == "parceiro" && ParceiroDePe(l) == null) return;
            l.Arena.AlvoAliado = aliado;
        }

        /// <summary>Onde o aliado está na sala; null, o parceiro que não está de pé.</summary>
        private static PontoNaSala LugarDoAliado(Luta l, string aliado) =>
            aliado == "eu" ? new PontoNaSala { X = l.Arena.Heroi.X, Y = l.Arena.Heroi.Y } : ParceiroDePe(l);

        /// <summary>TS: aliadoNaMira — o aliado em que o ataque vai: no PC, o herói na área do cursor (mais perto que o monstro); no celular, o da placa.</summary>
        private static string AliadoNaMira(Luta l, EntradaDaLuta entrada)
        {
            if (!ClassesDeLuta.ApoiaAliado(Masmorra(l).Hero)) return null;
            if (entrada.Cursor == null)
            {
                var escolhido = l.Arena.AlvoAliado;
                if (escolhido != null && LugarDoAliado(l, escolhido) != null) return escolhido;
                l.Arena.AlvoAliado = null;
                return null;
            }
            double x = entrada.Cursor.X;
            double y = entrada.Cursor.Y;
            double area = AreaDaMiraDe(l);
            string melhor = null;
            double menor = 0;
            foreach (var aliado in new[] { "eu", "parceiro" })
            {
                var lugar = LugarDoAliado(l, aliado);
                if (lugar == null) continue;
                double distancia = (x - lugar.X) * (x - lugar.X) + (y - lugar.Y) * (y - lugar.Y);
                if (distancia > area * area) continue;
                if (melhor == null || distancia < menor)
                {
                    melhor = aliado;
                    menor = distancia;
                }
            }
            if (melhor == null) return null;
            var monstro = MaisPertoNaMira(l, x, y, out double doMonstro);
            return monstro != null && doMonstro < menor ? null : melhor;
        }

        /// <summary>TS: alcancaOAliado — ele mesmo sempre; o parceiro, no alcance da classe (o Druida, sempre).</summary>
        private static bool AlcancaOAliado(Luta l, string aliado)
        {
            if (aliado == "eu") return true;
            var lugar = ParceiroDePe(l);
            if (lugar == null) return false;
            var hero = Masmorra(l).Hero;
            if (Catalog.IdDaClasse(hero.ClassId, hero.ClassName) == "druida") return true;
            double dx = l.Arena.Heroi.X - lugar.X;
            double dy = l.Arena.Heroi.Y - lugar.Y;
            double limite = AlcanceNaArena(hero);
            return dx * dx + dy * dy <= limite * limite;
        }

        /// <summary>O que a moral do grupo dá agora.</summary>
        private static EfeitosDaMoral MoralAqui(Luta l) => ClassesDeLuta.EfeitosDaMoral(l.Arena.Moral?.Nivel ?? 0);

        /// <summary>TS: eventoComAMoral — o evento do ataque, com a faixa do crítico da moral (o degrau 12 a alarga).</summary>
        private static EventoDeArma EventoComAMoral(Luta l, EventoDeArma evento)
        {
            // A lança (rodada 6c): o golpe da vez com a faixa do crítico maior.
            double faixa = MoralAqui(l).FaixaCritica + (Contadores(l).CriticoMaior == true ? PecasSecretas.RegrasDasArmasNovas.FaixaDaLanca : 0);
            if (!(faixa > 0)) return evento;
            return new EventoDeArma
            {
                Tipo = evento.Tipo,
                Zona = evento.Zona,
                Duracao = evento.Duracao,
                Notas = evento.Notas,
                Janela = evento.Janela,
                Simbolo = evento.Simbolo,
                Letras = evento.Letras,
                Faixa = Attack.FaixaCritica * (100 + faixa) / 100,
            };
        }

        /// <summary>Sem monstro na área do cursor: o golpe vai no chão, sem evento, e o botão espera a recarga como depois de um golpe.</summary>
        private static void GolpeNoChao(Luta l, double x, double y)
        {
            // O Florescimento (rodada 5b): o ataque no chão vazio planta uma flor.
            if (Estilos.IdDoEstilo(Masmorra(l).Hero) == "florescimento")
            {
                Plantar(l, x, y);
                return;
            }
            l.Arena.Recarga = D.RecargaDoAtaque;
            Contar(l, new Acontecimento { Tipo = "numero", Onde = "chao", X = Math.Truncate(x), Y = Math.Truncate(y), Texto = "Errou", Tom = "erro" });
            Contar(l, Som("miss"));
        }

        /// <summary>O ataque do botão: o da classe primeiro; o mágico sem mana pro golpe de magia cai pro físico.</summary>
        private static string EstiloDoBotao(Hero hero)
        {
            var ataques = Attack.AtaquesDisponiveis(hero);
            // O disparo do Mago custa o da arena.
            double? daArena = ClassesDeLuta.CustoDaMagia(hero);
            foreach (var a in ataques)
            {
                double custo = a.Estilo == AttackStyles.Magic && daArena != null ? daArena.Value : a.Custo;
                if (hero.Mp >= custo) return a.Estilo;
            }
            return ataques[ataques.Count - 1].Estilo;
        }

        /// <summary>
        /// O botão de ataque abre o evento da arma no alvo, que precisa estar ao alcance da classe. No PC o alvo é o
        /// monstro na área do cursor; sem nenhum, o golpe vai no chão, ali. Sem cursor (o celular), é o da placa, se o
        /// jogador escolheu e ele está ao alcance, ou o de pé mais perto que estiver (e ele vira o alvo). Fora do
        /// alcance, o botão só avisa.
        /// </summary>
        private static void AbrirEvento(Luta l, EntradaDaLuta entrada)
        {
            // O Bardo, o Clérigo e o Druida podem mirar num aliado: o evento é o mesmo, e no fim sai o apoio.
            string aliado = AliadoNaMira(l, entrada);
            if (aliado != null)
            {
                if (!AlcancaOAliado(l, aliado))
                {
                    Contar(l, Aviso("Chegue mais perto"));
                    return;
                }
                var quem = Masmorra(l).Hero;
                string estiloDoApoio = EstiloDoBotao(quem);
                var doApoio = EventoComAMoral(l, EventosDeArma.EventoDoAtaque(quem, estiloDoApoio, l.Rng, l.Teclado));
                l.Arena.Evento = new EventoAberto { Evento = doApoio, Passo = 0, Jogada = new JogadaDoEvento(), Alvo = l.Arena.Alvo, Estilo = estiloDoApoio, Aliado = aliado };
                return;
            }
            double? alvo;
            if (entrada.Cursor != null)
            {
                alvo = MonstroNaMira(l, entrada.Cursor.X, entrada.Cursor.Y);
                if (alvo == null)
                {
                    GolpeNoChao(l, entrada.Cursor.X, entrada.Cursor.Y);
                    return;
                }
                l.Arena.Alvo = alvo.Value;
                if (!Alcanca(l, alvo.Value))
                {
                    Contar(l, Aviso("Chegue mais perto"));
                    return;
                }
            }
            else
            {
                alvo = AlvoAtual(l);
                if (alvo == null) return;
                if (l.Arena.Escolhido != true || !Alcanca(l, alvo.Value))
                {
                    var perto = MaisPertoAoAlcance(l);
                    if (perto == null)
                    {
                        Contar(l, Aviso("Chegue mais perto"));
                        return;
                    }
                    alvo = perto;
                    l.Arena.Alvo = perto.Value;
                }
            }
            var hero = Masmorra(l).Hero;
            string estilo = EstiloDoBotao(hero);
            var evento = EventoComAMoral(l, EventosDeArma.EventoDoAtaque(hero, estilo, l.Rng, l.Teclado));
            l.Arena.Evento = new EventoAberto { Evento = evento, Passo = 0, Jogada = new JogadaDoEvento(), Alvo = alvo.Value, Estilo = estilo };
        }

        /// <summary>O evento aberto anda um passo de verdade e lê o que a pessoa fez nele; terminado, o golpe sai.</summary>
        private static void SeguirEvento(Luta l, EntradaDaLuta entrada)
        {
            var aberto = l.Arena.Evento;
            aberto.Passo += 1;
            var evento = aberto.Evento;
            var jogada = aberto.Jogada;
            double passo = aberto.Passo;
            bool tocou = entrada.Tocar == true || entrada.Atacar == true;
            bool pronto = passo >= evento.Duracao;

            switch (evento.Tipo)
            {
                case TiposDeEvento.Barra:
                case TiposDeEvento.Circulo:
                    if (tocou && passo < evento.Duracao)
                    {
                        jogada.Toque = passo;
                        pronto = true;
                    }
                    break;
                case TiposDeEvento.Carga:
                    if (entrada.Soltar == true && passo < evento.Duracao)
                    {
                        jogada.Soltou = passo;
                        pronto = true;
                    }
                    break;
                case TiposDeEvento.Ritmo:
                case TiposDeEvento.ToqueDuplo:
                    if (tocou && passo <= evento.Duracao)
                    {
                        var toques = jogada.Toques != null ? new List<double>(jogada.Toques) : new List<double>();
                        toques.Add(passo);
                        jogada.Toques = toques;
                    }
                    break;
                case TiposDeEvento.Desenho:
                {
                    var traco = jogada.Traco ?? new List<PontoDoTraco>();
                    if (entrada.Dedo != null && passo <= evento.Duracao)
                    {
                        double tamanho = GameData.EventosDeArmaTable.TamanhoDoDesenho;
                        double x = Js.Max(0, Js.Min(tamanho, Math.Truncate(entrada.Dedo.X)));
                        double y = Js.Max(0, Js.Min(tamanho, Math.Truncate(entrada.Dedo.Y)));
                        var ultimo = traco.Count > 0 ? traco[traco.Count - 1] : null;
                        if (ultimo == null || ultimo.X != x || ultimo.Y != y)
                        {
                            var novo = new List<PontoDoTraco>(traco) { new PontoDoTraco { X = x, Y = y, T = passo } };
                            jogada.Traco = novo;
                        }
                    }
                    else if (entrada.Dedo == null && traco.Count > 0)
                    {
                        // Levantou o dedo: o desenho acabou.
                        pronto = true;
                    }
                    break;
                }
                case TiposDeEvento.Letras:
                    if (Js.Truthy(entrada.Tecla) && passo <= evento.Duracao)
                    {
                        var teclas = jogada.Teclas != null ? new List<TeclaDoEvento>(jogada.Teclas) : new List<TeclaDoEvento>();
                        teclas.Add(new TeclaDoEvento { Letra = entrada.Tecla, T = passo });
                        jogada.Teclas = teclas;
                        // Uma tecla na janela da última letra decide ela: não sobra nada pra apertar.
                        var batidas = evento.Notas ?? new List<double>();
                        double ultima = batidas.Count > 0 ? batidas[batidas.Count - 1] : 0;
                        if (passo >= ultima - (evento.Janela ?? 0)) pronto = true;
                    }
                    break;
            }

            if (pronto) Golpear(l);
        }

        /// <summary>
        /// O evento terminou: lê, rola o d20 e o golpe cai no alvo do evento. Se ele caiu enquanto o evento corria
        /// (um companheiro, o veneno), cai no alvo de agora. Com arma de perto, quem se afastou do alvo durante o
        /// evento erra (sem dado).
        /// </summary>
        private static void Golpear(Luta l)
        {
            var aberto = l.Arena.Evento;
            l.Arena.Evento = null;
            l.Arena.Recarga = D.RecargaDoAtaque;
            var leitura = EventosDeArma.LerEvento(aberto.Evento, aberto.Jogada);
            if (aberto.Poder != null)
            {
                // O poder mágico sai na força do evento; errado, mais fraco.
                UsarPoder(l, aberto.Poder, leitura.Acerto ? leitura.Forca : D.ForcaDoPoderErrado);
                return;
            }
            if (aberto.Aliado != null)
            {
                Apoiar(l, aberto.Aliado, leitura);
                return;
            }
            // A lança do Guerreiro (rodada 6c): a faixa maior já valeu neste evento; sorteia a do próximo.
            SortearLanca(l);
            var doEvento = l.Arena.Monstros[(int)aberto.Alvo];
            double? indice = doEvento.Fase != "caido" ? doEvento.Indice : AlvoAtual(l);
            if (indice == null) return;
            if (!Alcanca(l, indice.Value, D.FolgaDoAlcance))
            {
                Contar(l, Numero("monstro", indice.Value, "Longe", "erro"));
                Contar(l, Som("miss"));
                return;
            }
            var heroDoGolpe = Masmorra(l).Hero;
            bool paladino = Catalog.IdDaClasse(heroDoGolpe.ClassId, heroDoGolpe.ClassName) == "paladino";
            string estiloAtivo = Estilos.IdDoEstilo(heroDoGolpe);
            bool atordoarDepois = false;
            // O avanço: o do Paladino e o chute do Monge sempre; o do Espadachim, a cada 5 s (colado no alvo, atordoa em vez de avançar).
            if (paladino || estiloAtivo == "chute") Avancar(l, indice.Value);
            else if (AvancoPronto(l))
            {
                if (Colado(l, indice.Value)) atordoarDepois = true;
                else
                {
                    Avancar(l, indice.Value, Estilos.Espadachim.Avanco);
                    var imune = Contadores(l).Clone();
                    imune.Imune = Estilos.Espadachim.Imunidade;
                    l.Arena.Classe = imune;
                }
                var recarga = Contadores(l).Clone();
                recarga.RecargaDoEstilo = Estilos.Espadachim.Recarga;
                l.Arena.Classe = recarga;
            }
            // O Druida com estilo conta os ataques da luta; o Mago com elemento, os disparos (rodada 5c).
            string classeDoGolpe = Catalog.IdDaClasse(heroDoGolpe.ClassId, heroDoGolpe.ClassName);
            bool conta = estiloAtivo != null && (classeDoGolpe == "druida" || (classeDoGolpe == "mago" && aberto.Estilo == AttackStyles.Magic));
            double golpeDoDruida = conta ? ContarGolpeDoEstilo(l, estiloAtivo) : 0;
            bool disparo = classeDoGolpe == "mago" && conta;
            // O chute erra 1 vez em 10.
            if (estiloAtivo == "chute" && l.Rng() * 100 < Estilos.Chute.Erro)
            {
                Contar(l, Numero("monstro", indice.Value, "Errou", "erro"));
                Contar(l, Som("miss"));
                return;
            }
            double dado = 1 + Rng.RandomInt(Attack.LadosDoDano, l.Rng);
            double? dano = AcertarMonstro(l, l.Arena.Monstros[(int)indice.Value], dado, leitura, aberto.Estilo);
            // A Concentração gasta as cargas no golpe, acertando ou não.
            if (estiloAtivo == "concentracao" && l.Arena.Classe != null)
            {
                var gastou = l.Arena.Classe.Clone();
                gastou.Cargas = 0;
                gastou.SemGolpe = 0;
                l.Arena.Classe = gastou;
            }
            // O Arcano desperto dá mana a cada disparo, acertando ou não.
            if (disparo && estiloAtivo == "arcano" && golpeDoDruida >= Estilos.Arcano.GolpesDoArcano) ManaDoArcano(l);
            if (dano == null || l.Fim != null) return;
            // O Bardo e o Clérigo também se curam batendo; as vinhas do Druida deixam o monstro lento e envenenado.
            ApoiarAqui(l);
            VinhasNoMonstro(l, indice.Value);
            SangrarNoMonstro(l, indice.Value, dano.Value);
            GolpeEmArea(l, indice.Value, dano.Value);
            // A kusarigama do Monge (rodada 6c): a área 3 × 2 no alvo.
            if (ClassesDeLuta.KusarigamaNaMao(heroDoGolpe) && l.Fim == null) AreaDaKusarigama(l, indice.Value, dano.Value);
            if (estiloAtivo == "empurrao") EmpurraoEmVolta(l, indice.Value, dano.Value);
            // O avanço do Paladino empurra o alvo que ficou de pé.
            var alvo = l.Arena.Monstros[(int)indice.Value];
            if (atordoarDepois && l.Fim == null && alvo.Fase != "caido") Atordoar(l, alvo, Estilos.Espadachim.Atordoa);
            // O bastão no chute (rodada 6c): às vezes atordoa quem ficou de pé.
            double chuteAtordoa = ClassesDeLuta.AtordoaNoChute(heroDoGolpe);
            if (chuteAtordoa > 0 && l.Fim == null && alvo.Fase != "caido" && l.Rng() * 100 < chuteAtordoa) Atordoar(l, alvo);
            // Todo 9º golpe das Raízes prende o alvo (o chefe não).
            if (estiloAtivo == "raizes" && ClassesDeLuta.GolpeQuePrende(golpeDoDruida) && l.Fim == null) Prender(l, alvo);
            // Os elementos do Mago (rodada 5c), no disparo que acertou.
            if (disparo && l.Fim == null) ElementoNoGolpe(l, indice.Value, dano.Value, golpeDoDruida, estiloAtivo);
            // A aljava ao lado do arco (rodada 6b), na flecha que acertou.
            if (l.Fim == null) FlechaComAljava(l, indice.Value, dano.Value);
            if (paladino && l.Fim == null && alvo.Fase != "caido") Empurrar(l, alvo, l.Arena.Heroi.X, l.Arena.Heroi.Y, CD.Paladino.Empurrao);
        }

        private static ClassesDeLutaData CD => GameData.ClassesDeLutaTable;

        /// <summary>
        /// TS: acertarMonstro — o golpe do herói chega no monstro: a regra do site, com a guarda do defensivo, e o que a
        /// classe põe na arena (o dano a mais, o crítico do Ladino, sem a passiva antiga da classe refeita). Acertou: o
        /// dano; senão null.
        /// </summary>
        private static double? AcertarMonstro(Luta l, MonstroNaArena alvo, double dado, LeituraDaMira leitura, string estilo, double aMais = 0)
        {
            var monstro = MonstroNo(l, alvo.Indice);
            var lida = leitura;
            if (JeitoDe(monstro).Guarda == true && alvo.Fase == "descansando" && leitura.Acerto)
            {
                lida = new LeituraDaMira { Acerto = true, Forca = Js.Round(leitura.Forca * 50) / 100, Critico = false };
                Contar(l, Aviso(Js.Str(monstro.Name) + " se protege!"));
            }
            var estado = Masmorra(l);
            var h = estado.Hero;
            var moral = MoralAqui(l);
            // O dano a mais: o da classe, o da moral do grupo e o reforço do Bardo.
            double bonus =
                ClassesDeLuta.BonusDoAtaque(h.ClassId, h.ClassName, h.Equip?.Get("arma")?.TemplateId, Contadores(l), Colado(l, alvo.Indice), monstro.IsBoss, BlocosAte(l, alvo.Indice), Estilos.IdDoEstilo(h),
                    h.Equip?.Get("secundaria")?.TemplateId, h.Equip?.Get("acessorio")?.TemplateId) +
                moral.Dano +
                ((l.Arena.Reforco ?? 0) > 0 ? CD.Bardo.Forca : 0) +
                (l.Arena.Revestido == true ? CD.Monge.DanoRevestido : 0) +
                // O disparo do Mago com elemento (rodada 5c): a rocha, o Arcano, a orbe.
                (estilo == AttackStyles.Magic && Catalog.IdDaClasse(h.ClassId, h.ClassName) == "mago" ? ClassesDeLuta.DanoDoMago(Estilos.IdDoEstilo(h), Contadores(l).Golpes ?? 0) : 0) +
                aMais;
            double? daClasse = ClassesDeLuta.CriticoDaClasse(h.ClassId, h.ClassName);
            // O crítico a mais: o da moral, o do estilo e o do leque (rodada 6c).
            double criticoAMais = moral.Critico + ClassesDeLuta.CriticoDoEstilo(h) + ClassesDeLuta.CriticoDaArma(h);
            double? critico = criticoAMais > 0 ? (daClasse ?? 1.6) + criticoAMais / 100 : daClasse;
            // O golpe sagrado do Clérigo num morto-vivo.
            bool sagrado = Catalog.IdDaClasse(h.ClassId, h.ClassName) == "clerigo" && estilo == AttackStyles.Magic && ClassesDeLuta.MortoVivo(monstro.SpeciesId);
            var opcoes = new ResolveAttackOptions
            {
                Rng = l.Rng,
                PetCriticoBonus = Pets.Bonus(l.Pet).Critico ?? 0,
                DanoDaClasse = ClassesDeLuta.De(h).Dano,
                BonusDeDano = bonus != 0 ? bonus : (double?)null,
                MultiplicadorDoCritico = critico,
                SemPassivaDaClasse = ClassesDeLuta.ClasseRefeita(h),
                MultiplicadorDoDano = sagrado ? CD.Clerigo.MortoVivo : (double?)null,
                CustoDaMagia = ClassesDeLuta.CustoDaMagia(h),
            };
            var golpe = Attack.ResolverGolpe(estado.Hero, monstro, dado, lida, estilo, opcoes);
            var comHeroi = estado.Clone();
            // O golpe que acerta treina o atributo dele (Treino).
            comHeroi.Hero = golpe.Outcome == "hit" ? Treino.AnotarUso(golpe.Hero, Treino.AtributoDoGolpe(golpe.Hero, estilo)) : golpe.Hero;
            var ferida = FerirNaArena(l, comHeroi, alvo.Indice, golpe.Monster);

            if (golpe.Outcome == ResolveAttackOutcomes.NoMana)
            {
                Contar(l, Aviso("Mana insuficiente"));
                return null;
            }
            if (golpe.Outcome != ResolveAttackOutcomes.Hit)
            {
                Contar(l, Numero("monstro", alvo.Indice, golpe.Outcome == ResolveAttackOutcomes.Dodged ? "Desviou" : "Errou", "erro"));
                Contar(l, Som("miss"));
                return null;
            }
            Contar(l, NumeroNoMonstro(ferida, alvo.Indice, "-" + Js.NumberToString(golpe.Damage ?? 0), golpe.IsCrit == true ? "critico" : "dano"));
            Contar(l, Som(golpe.IsCrit == true ? "crit" : "hit"));
            ContarAcertoDaClasse(l, golpe.IsCrit == true);
            double acerto = golpe.Damage ?? 0;
            if (!ferida.Protegido) RoubarVida(l, golpe.Damage ?? 0);
            if (ferida.Caiu)
            {
                Abater(l, alvo.Indice, golpe.Monster);
                return acerto;
            }
            if (!ferida.Protegido) AplicarRunasDoGolpe(l, alvo.Indice, Monsters.View(ferida.Monstro), golpe.Damage ?? 0);
            return acerto;
        }

        // ---------- a classe na arena (rodada 3a: Guerreiro, Ladino, Bárbaro e Paladino) ----------

        private static ContadoresDaClasse Contadores(Luta l) => l.Arena.Classe ?? new ContadoresDaClasse();

        /// <summary>TS: blocosAte — quantos blocos inteiros do pé do herói ao meio da casa do monstro (o dano do Arqueiro).</summary>
        private static double BlocosAte(Luta l, double indice)
        {
            var lugar = LugarDe(l, indice);
            double dx = l.Arena.Heroi.X - lugar.X;
            double dy = l.Arena.Heroi.Y - lugar.Y;
            return Math.Floor(Math.Sqrt(dx * dx + dy * dy) / RoomWalk.TileUnits);
        }

        /// <summary>TS: colado — o herói está a 1 bloco do monstro: o Guerreiro colado no alvo bate mais forte.</summary>
        private static bool Colado(Luta l, double indice)
        {
            var lugar = LugarDe(l, indice);
            double dx = l.Arena.Heroi.X - lugar.X;
            double dy = l.Arena.Heroi.Y - lugar.Y;
            double limite = RoomWalk.TileUnits + RoomWalk.TileUnits / 2;
            return dx * dx + dy * dy <= limite * limite;
        }

        /// <summary>TS: contarAcertoDaClasse — o combo do Guerreiro e a furtividade do Ladino contam, e avisam quando sobem.</summary>
        private static void ContarAcertoDaClasse(Luta l, bool critico)
        {
            var h = Masmorra(l).Hero;
            var acerto = ClassesDeLuta.ContarAcerto(h.ClassId, h.ClassName, Contadores(l), critico);
            if (acerto == null) return;
            l.Arena.Classe = acerto.Contadores;
            if (acerto.Combo != null) Contar(l, Aviso("⚔️ Combo! +" + Js.NumberToString(acerto.Combo.Value) + "% de dano"));
            if (acerto.Furtividade != null) Contar(l, Aviso("🗡️ Furtividade " + Js.NumberToString(acerto.Furtividade.Value)));
        }

        /// <summary>TS: naParede — a casa em (x, y) é parede de dentro da sala (os cantos da Caverna)?</summary>
        private static bool NaParede(Luta l, double x, double y)
        {
            double col = Math.Floor(x / RoomWalk.TileUnits);
            double row = Math.Floor(y / RoomWalk.TileUnits);
            foreach (var casa in ArteDaSala.ParedesDaSala(Masmorra(l).Masmorra.Dungeon))
                if (casa.Col == col && casa.Row == row) return true;
            return false;
        }

        /// <summary>
        /// TS: avancar — o golpe que avança (o Paladino, o chute do Monge, o Espadachim): ele vai em linha reta até 1
        /// bloco do alvo, no máximo <paramref name="maxBlocos"/> blocos (se não cair numa parede de dentro).
        /// </summary>
        private static void Avancar(Luta l, double indice, double? maxBlocos = null)
        {
            var heroi = l.Arena.Heroi;
            var lugar = LugarDe(l, indice);
            double dx = lugar.X - heroi.X;
            double dy = lugar.Y - heroi.Y;
            double distancia = Math.Sqrt(dx * dx + dy * dy);
            if (distancia <= RoomWalk.TileUnits) return;
            double anda = maxBlocos == null ? distancia - RoomWalk.TileUnits : Math.Min(distancia - RoomWalk.TileUnits, maxBlocos.Value * RoomWalk.TileUnits);
            double x = heroi.X + Math.Truncate(dx * anda / distancia);
            double y = heroi.Y + Math.Truncate(dy * anda / distancia);
            if (NaParede(l, x, y)) return;
            string olhando = Math.Abs(dx) > Math.Abs(dy) ? (dx > 0 ? "E" : "W") : dy > 0 ? "S" : "N";
            l.Arena.Heroi = new Walker { X = x, Y = y, Facing = olhando };
        }

        /// <summary>
        /// TS: empurrar — empurra o monstro tantos blocos pra longe de (deX, deY), sem sair do chão nem entrar em parede.
        /// Quem está no aviso ou investindo segue o golpe dele; no espelho, não.
        /// </summary>
        private static void Empurrar(Luta l, MonstroNaArena m, double deX, double deY, double blocos)
        {
            if (NoEspelho(l) || m.Fase == "caido" || m.Fase == "avisando" || m.Fase == "investindo") return;
            var r = Rumo(m.CorpoX - deX, m.CorpoY - deY, blocos * RoomWalk.TileUnits);
            var formato = Geometria(l);
            double meia = RoomWalk.TileUnits / 2;
            double x = Math.Min(Math.Max(m.CorpoX + r.X, RoomWalk.TileUnits + meia), (formato.Cols - 1) * RoomWalk.TileUnits - meia);
            double y = Math.Min(Math.Max(m.CorpoY + r.Y, RoomWalk.TileUnits + meia), (formato.Rows - 1) * RoomWalk.TileUnits - meia);
            if (NaParede(l, x, y)) return;
            m.CorpoX = x;
            m.CorpoY = y;
        }

        /// <summary>TS: atordoar — o monstro fica atordoado na hora e perde o golpe que vinha (o que já investe segue).</summary>
        private static void Atordoar(Luta l, MonstroNaArena m, double? tempo = null)
        {
            if (NoEspelho(l) || m.Fase == "caido" || m.Fase == "investindo") return;
            m.Poder = null;
            m.Fase = "atordoado";
            m.Tempo = tempo ?? D.TempoAtordoado;
            Contar(l, Numero("monstro", m.Indice, "💫", "erro"));
        }

        /// <summary>TS: ferirComDano — o monstro leva este dano (a área, a devolução, o parceiro), com a regra do chefe. Caiu?</summary>
        private static bool FerirComDano(Luta l, double indice, double dano, string texto)
        {
            var depois = CombatMonster.From(Sala(l).Monsters[(int)indice]);
            depois.Hp = Math.Max(0, depois.Hp - dano);
            var ferida = FerirNaArena(l, Masmorra(l), indice, depois);
            Contar(l, NumeroNoMonstro(ferida, indice, texto, "dano"));
            if (ferida.Caiu) Abater(l, indice, Monsters.View(depois));
            return ferida.Caiu;
        }

        /// <summary>TS: naAreaDaArma — o monstro de pé está na área da arma pesada do Bárbaro?</summary>
        private static bool NaAreaDaArma(Luta l, string arma, MonstroNaArena m, double centroX, double centroY)
        {
            var r = CD.Barbaro;
            var heroi = l.Arena.Heroi;
            if (arma == "marreta")
            {
                double meia = r.LadoDoTremor * RoomWalk.TileUnits / 2;
                return Math.Abs(m.CorpoX - heroi.X) <= meia && Math.Abs(m.CorpoY - heroi.Y) <= meia;
            }
            if (arma == "maca")
            {
                double meia = r.LadoDaBola * RoomWalk.TileUnits / 2;
                return Math.Abs(m.CorpoX - centroX) <= meia && Math.Abs(m.CorpoY - centroY) <= meia;
            }
            // O machadão: a faixa do herói rumo ao alvo, até o alcance.
            double dx = centroX - heroi.X;
            double dy = centroY - heroi.Y;
            double comprimento = Math.Sqrt(dx * dx + dy * dy);
            if (comprimento == 0) return false;
            double px = m.CorpoX - heroi.X;
            double py = m.CorpoY - heroi.Y;
            double ao = px * dx + py * dy;
            double fora = px * dy - py * dx;
            return ao >= 0 && ao <= AlcanceNaArena(Masmorra(l).Hero) * comprimento && Math.Abs(fora) <= (r.LarguraDoCorte * RoomWalk.TileUnits / 2) * comprimento;
        }

        /// <summary>TS: efeitoDaArma — o machadão pode atordoar (o chefe não), a maça pode empurrar pra longe do herói.</summary>
        private static void EfeitoDaArma(Luta l, string arma, MonstroNaArena m)
        {
            if (NoEspelho(l) || m.Fase == "caido") return;
            var r = CD.Barbaro;
            if (arma == "machado" && !MonstroNo(l, m.Indice).IsBoss && l.Rng() * 100 < r.AtordoaNoMachado) Atordoar(l, m);
            else if (arma == "maca" && l.Rng() * 100 < r.EmpurraNaMaca) Empurrar(l, m, l.Arena.Heroi.X, l.Arena.Heroi.Y, 1);
        }

        /// <summary>
        /// TS: golpeEmArea — o Bárbaro de arma pesada bate em área: o alvo já levou o golpe inteiro, e quem mais estiver
        /// na área leva metade. Depois do dano, o efeito da arma: primeiro no alvo, depois em cada um, na ordem da sala.
        /// </summary>
        private static void GolpeEmArea(Luta l, double alvo, double dano)
        {
            var hero = Masmorra(l).Hero;
            string arma = hero.Equip?.Get("arma")?.TemplateId ?? "";
            if (Catalog.IdDaClasse(hero.ClassId, hero.ClassName) != "barbaro" || !(arma == "machado" || arma == "marreta" || arma == "maca")) return;
            var centro = LugarDe(l, alvo);
            EfeitoDaArma(l, arma, l.Arena.Monstros[(int)alvo]);
            double parte = Js.Max(1, Math.Truncate(dano * CD.Barbaro.NosOutros / 100));
            // Por índice, como o for...of do JS: o lacaio que entra no meio também é visto (o foreach quebraria).
            for (int i = 0; i < l.Arena.Monstros.Count; i++)
            {
                var m = l.Arena.Monstros[i];
                if (l.Fim != null) return;
                if (m.Indice == alvo || m.Fase == "caido" || !NaAreaDaArma(l, arma, m, centro.X, centro.Y)) continue;
                if (!FerirComDano(l, m.Indice, parte, "-" + Js.NumberToString(parte))) EfeitoDaArma(l, arma, m);
            }
        }

        /// <summary>
        /// TS: apanhou — o herói levou um golpe com dano: a fúria e a absorção juntam, e o Paladino de pé devolve parte do
        /// dano a quem bateu.
        /// </summary>
        private static void Apanhou(Luta l, double indice, double dano, bool vivo)
        {
            var h = Masmorra(l).Hero;
            var novos = ClassesDeLuta.ContarGolpeLevado(h.ClassId, h.ClassName, Contadores(l));
            if (novos != null) l.Arena.Classe = novos;
            double pct = ClassesDeLuta.DevolucaoDaClasse(h.ClassId, h.ClassName, Contadores(l));
            int i = (int)indice;
            var m = i >= 0 && i < l.Arena.Monstros.Count ? l.Arena.Monstros[i] : null;
            if (!vivo || pct <= 0 || dano <= 0 || m == null || m.Fase == "caido") return;
            double devolvido = Js.Max(1, Math.Truncate(dano * pct / 100));
            FerirComDano(l, indice, devolvido, "↩️-" + Js.NumberToString(devolvido));
        }

        /// <summary>
        /// TS: ferirNaArena — grava o golpe no monstro com a regra do chefe final (<see cref="ChefeFinal.FerirMonstro"/>):
        /// o protegido não sente nada, e o que chega à metade chama os lacaios — eles entram no palco esperando a vez,
        /// e o alvo passa pro primeiro deles.
        /// </summary>
        private static Ferida FerirNaArena(Luta l, EstadoNaMasmorra estado, double indice, CombatMonster depois)
        {
            if (NoEspelho(l)) return FerirNoEspelho(l, estado, indice, depois);
            var ferida = ChefeFinal.FerirMonstro(estado, indice, depois, l.Rng);
            l.Estado = ferida.Estado;
            if (ferida.Lacaios.Count > 0)
            {
                foreach (var novo in ferida.Lacaios)
                    l.Arena.Monstros.Add(new MonstroNaArena { Indice = novo, Fase = "esperando", Tempo = 0, Forca = 1, Alvo = -1, X = 0, Y = 0, RumoX = 0, RumoY = 0, CorpoX = 0, CorpoY = 0 });
                PorOsLacaios(l, ferida.Lacaios);
                l.Arena.Alvo = ferida.Lacaios[0];
            }
            // O chefe final que chamou os lacaios tem o texto dele; o de andar 5 diz o que as mecânicas fizeram.
            var textos = ferida.Lacaios.Count > 0 && ferida.Monstro.ChefeFinal == true
                ? new List<string> { ChefeFinal.TextoDosLacaios(Js.Str(Monsters.View(ferida.Monstro).Name)) }
                : ferida.Textos;
            foreach (var texto in textos) Contar(l, Aviso(texto));
            if (textos.Count > 0) Diario(l, textos.ToArray());
            return ferida;
        }

        /// <summary>TS: numeroNoMonstro — o dano, ou o escudo quando o chefe final está protegido pelos lacaios.</summary>
        private static Acontecimento NumeroNoMonstro(Ferida ferida, double indice, string texto, string tom) =>
            ferida.Protegido ? Numero("monstro", indice, "🛡️", "erro") : Numero("monstro", indice, texto, tom);

        /// <summary>
        /// TS: aplicarRunasDoGolpe — as runas da arma no golpe que acertou. Só a arena as aplica: no site a arma vale só
        /// pelos atributos. O choque pode derrubar.
        /// </summary>
        private static void AplicarRunasDoGolpe(Luta l, double indice, CombatMonsterView monstro, double dano)
        {
            var estado = Masmorra(l);
            var runas = Runas.AplicarRunas(estado.Hero, monstro, dano, l.Rng);
            if (runas.Disparos.Count == 0) return;
            var comHeroi = (EstadoNaMasmorra)estado.Clone();
            comHeroi.Hero = runas.Hero;
            var ferida = FerirNaArena(l, comHeroi, indice, runas.Monster);
            foreach (var disparo in runas.Disparos)
            {
                string icone = Runas.IconeDe(disparo.Runa);
                if (disparo.Runa == "vampirica")
                {
                    if (disparo.Valor > 0) Contar(l, Numero("heroi", 0, icone + "+" + Js.NumberToString(disparo.Valor), "cura"));
                }
                else if (disparo.Runa == "eletrica")
                {
                    Contar(l, NumeroNoMonstro(ferida, indice, icone + "-" + Js.NumberToString(disparo.Valor), "dano"));
                }
                else
                {
                    // Queimar e gelar só marcam o monstro, como o 💫 e o 🐌: sem dano agora, ele não treme.
                    Contar(l, Numero("monstro", indice, icone, "erro"));
                }
            }
            if (ferida.Caiu) Abater(l, indice, runas.Monster);
        }

        // ---------- poderes e itens ----------

        /// <summary>
        /// TS: pedirPoder — o botão de um poder: o mágico (TiposDePoderMagico) abre o evento dele (as letras no PC, o
        /// desenho no celular) e só sai quando o evento acaba; os outros saem na hora. Sem mana, o mágico avisa antes.
        /// </summary>
        private static void PedirPoder(Luta l, string id)
        {
            var estado = Masmorra(l);
            PowerDef poder = null;
            foreach (var p in Heroes.HeroPowers(estado.Hero))
            {
                if (p.Id == id)
                {
                    poder = p;
                    break;
                }
            }
            if (poder == null || (l.Arena.RecargaDosPoderes.TryGet(id, out var falta) ? falta : 0) > 0) return;
            if (!D.TiposDePoderMagico.Contains(poder.Type))
            {
                UsarPoder(l, id);
                return;
            }
            var alvo = AlvoAtual(l);
            if (alvo == null) return;
            if (estado.Hero.Mp < UsePower.PowerManaCost(estado.Hero, poder, AcessoriosUnicos.DescontoDeMana(estado.Hero)))
            {
                Contar(l, Aviso("Mana insuficiente para " + poder.Name));
                return;
            }
            l.Arena.Evento = new EventoAberto { Evento = EventosDeArma.EventoDoPoder(l.Rng, l.Teclado), Passo = 0, Jogada = new JogadaDoEvento(), Alvo = alvo.Value, Estilo = "magic", Poder = id };
        }

        private static void UsarPoder(Luta l, string id, double forcaDoEvento = 1)
        {
            var estado = Masmorra(l);
            PowerDef poder = null;
            foreach (var p in Heroes.HeroPowers(estado.Hero))
            {
                if (p.Id == id)
                {
                    poder = p;
                    break;
                }
            }
            if (poder == null || (l.Arena.RecargaDosPoderes.TryGet(id, out var falta) ? falta : 0) > 0) return;
            // O Necromante invoca o lacaio do Breno (rodada 4b; só aqui, o site continua com o esqueleto de antes).
            if (poder.Type == "invocar" && Catalog.IdDaClasse(estado.Hero.ClassId, estado.Hero.ClassName) == "necromante")
            {
                InvocarLacaio(l, poder);
                return;
            }
            var alvo = AlvoAtual(l);
            if (alvo == null) return;

            var bonus = Pets.Bonus(l.Pet);
            var monstro = MonstroNo(l, alvo.Value);
            var uso = UsePower.CastPower(estado.Hero, estado.Party, monstro, poder,
                new UsePowerOptions
                {
                    Rng = l.Rng,
                    PetCuraBonus = bonus.Healing ?? 0,
                    PetManaSaveChance = bonus.ManaSave ?? 0,
                    // A Coroa do Arquimago tira parte do custo: só aqui, na arena.
                    DescontoDeMana = AcessoriosUnicos.DescontoDeMana(estado.Hero) > 0 ? AcessoriosUnicos.DescontoDeMana(estado.Hero) : (double?)null,
                    DanoDaClasse = ClassesDeLuta.De(estado.Hero).Dano,
                    ForcaDoEvento = forcaDoEvento != 1 ? forcaDoEvento : (double?)null,
                });
            if (uso.Outcome == UsePowerOutcomes.NoMana)
            {
                Contar(l, Aviso("Mana insuficiente para " + poder.Name));
                return;
            }
            if (uso.Outcome == UsePowerOutcomes.SummonFull)
            {
                Contar(l, Aviso("Seus " + Js.NumberToString(Invocacao.MaxEsqueletos) + " esqueletos já estão de pé"));
                return;
            }
            l.Arena.RecargaDosPoderes.Set(id, D.RecargaDoPoder);
            // O poder usado treina o atributo dele e sobe o próprio nível pelo uso.
            var treino = Treino.TreinarPoder(uso.Hero, poder.Id, poder.Type);
            if (treino.Subiu.HasValue)
            {
                Diario(l, new[] { Treino.TextoDaHabilidade(poder.Name, treino.Subiu.Value) });
                Contar(l, Aviso("⭐ " + poder.Name + " nível " + Js.NumberToString(treino.Subiu.Value)));
            }
            var comUso = estado.Clone();
            comUso.Hero = treino.Hero;
            comUso.Party = uso.Party;
            var ferida = FerirNaArena(l, comUso, alvo.Value, uso.Monster);

            if (uso.Outcome == UsePowerOutcomes.Damage)
            {
                Contar(l, NumeroNoMonstro(ferida, alvo.Value, poder.Icon + " -" + Js.NumberToString(uso.Damage ?? 0), "critico"));
                Contar(l, Som("crit"));
            }
            else if (uso.Outcome == UsePowerOutcomes.Heal)
            {
                Contar(l, Numero("heroi", 0, "+" + Js.NumberToString(uso.Healed ?? 0), "cura"));
                Contar(l, Som("heal"));
            }
            else if (uso.Outcome == UsePowerOutcomes.Summon)
            {
                // O esqueleto entra no fim da equipe e começa a bater no tempo dele, como os companheiros da entrada.
                l.Arena.Companheiros.Add(new CompanheiroNaArena { Indice = uso.Party.Count - 1, Tempo = D.CadenciaDoCompanheiro / 2 });
                Contar(l, Aviso(poder.Icon + " " + (uso.Summoned?.Name ?? "Esqueleto") + " se ergue"));
            }
            else
            {
                Contar(l, Aviso(poder.Icon + " " + poder.Name));
            }
            if (Js.Truthy(uso.Healed) && uso.Outcome == UsePowerOutcomes.Damage) Contar(l, Numero("heroi", 0, "+" + Js.NumberToString(uso.Healed.Value), "cura"));
            if (ferida.Caiu) Abater(l, alvo.Value, uso.Monster);
        }

        private static void UsarItem(Luta l, string uid)
        {
            var estado = Masmorra(l);
            Item item = null;
            foreach (var atual in estado.Inventory)
            {
                if (atual.Uid == uid)
                {
                    item = atual;
                    break;
                }
            }
            if (item == null || !Mochilas.PodeUsar(item) || l.Arena.RecargaDoItem > 0) return;
            var usado = Mochilas.Usar(new Mochila { Estado = estado, Log = new List<string>() }, item);
            if (usado.Estado.MapMode != "dungeon") return;
            l.Arena.RecargaDoItem = D.RecargaDoItem;
            double cura = usado.Estado.Hero.Hp - estado.Hero.Hp;
            l.Estado = usado.Estado;
            Diario(l, usado.Log);
            if (cura > 0) Contar(l, Numero("heroi", 0, "+" + Js.NumberToString(cura), "cura"));
            Contar(l, Som("heal"));
        }

        // ---------- o mundo ----------

        /// <summary>
        /// TS: moverHeroi — o herói anda pela sala com a regra de sempre (RoomWalk.Tick): as portas fechadas (só se sai
        /// vencendo ou caindo), as paredes de dentro da masmorra e cada monstro de pé tomando a casa em que está (o que voa na investida não). A casa de
        /// monstro em que o herói já está pisando não conta: ele sai dela andando.
        /// </summary>
        private static Walker MoverHeroi(Luta l, EntradaDaLuta entrada)
        {
            var heroi = l.Arena.Heroi;
            if (Math.Truncate(entrada.X) == 0 && Math.Truncate(entrada.Y) == 0) return heroi;
            var formato = Geometria(l);
            var monstros = new List<RoomObject>();
            double t = RoomWalk.TileUnits;
            double meio = RoomWalk.HeroHalf;
            foreach (var m in l.Arena.Monstros)
            {
                if (m.Fase == "caido" || m.Fase == "investindo") continue;
                var lugar = (Col: Math.Floor(m.CorpoX / t), Row: Math.Floor(m.CorpoY / t));
                bool pisando =
                    heroi.X + meio > lugar.Col * t &&
                    heroi.X - meio < (lugar.Col + 1) * t &&
                    heroi.Y + meio > lugar.Row * t &&
                    heroi.Y - meio < (lugar.Row + 1) * t;
                if (!pisando) monstros.Add(new RoomObject { Id = "monstro_" + Js.NumberToString(m.Indice), Col = lugar.Col, Row = lugar.Row });
            }
            var planta = RoomWalk.Layout(new DoorMap(), monstros, ArteDaSala.ParedesDaSala(Masmorra(l).Masmorra.Dungeon), formato);
            // A moral do grupo (o degrau 1) também deixa o passo mais ligeiro.
            double daMoral = MoralAqui(l).Velocidade;
            double base_ = VelocidadeNaArena(Masmorra(l).Hero);
            // As Raízes fundas (rodada 5b) também: o Druida anda 10% mais rápido.
            double fundas = Estilos.IdDoEstilo(Masmorra(l).Hero) == "raizes" && ClassesDeLuta.RaizesFundas(Contadores(l).Golpes ?? 0) ? Estilos.Raizes.Velocidade : 0;
            // E a ventania do Vento (rodada 5c).
            double ventania = (Contadores(l).Ventania ?? 0) > 0 ? Estilos.Vento.Velocidade : 0;
            // Os dois leques do Monge (rodada 6c).
            double daMais = daMoral + fundas + ventania + ClassesDeLuta.VelocidadeDaArma(Masmorra(l).Hero);
            double velocidade = daMais > 0 ? Math.Truncate(base_ * (100 + daMais) / 100) : base_;
            return RoomWalk.Tick(planta, heroi, new WalkInput { X = entrada.X, Y = entrada.Y }, velocidade).Walker;
        }

        private static void PassoDoMundo(Luta l, EntradaDaLuta entrada)
        {
            var arena = l.Arena;
            arena.Passo += 1;
            var antes = arena.Heroi;
            arena.Heroi = MoverHeroi(l, entrada);
            // O Arqueiro conta o tempo parado.
            var quemAnda = Masmorra(l).Hero;
            var parado = ClassesDeLuta.ContarParado(quemAnda.ClassId, quemAnda.ClassName, Contadores(l), arena.Heroi.X != antes.X || arena.Heroi.Y != antes.Y);
            if (parado != null) arena.Classe = parado;
            if (arena.Reforco != null)
            {
                if (arena.Reforco.Value > 1) arena.Reforco -= 1;
                else arena.Reforco = null;
            }
            PassarAFe(l);
            PassarOsEstilos(l);
            PassarAsFlores(l);
            Canalizar(l, entrada);
            MoverChapeu(l);
            if (l.Fim != null) return;
            if (arena.Recarga > 0) arena.Recarga -= 1;
            if (arena.RecargaDoItem > 0) arena.RecargaDoItem -= 1;
            if (arena.Intervalo > 0) arena.Intervalo -= 1;
            foreach (var id in new List<string>(arena.RecargaDosPoderes.Keys))
            {
                double falta = arena.RecargaDosPoderes.Get(id) - 1;
                if (falta > 0) arena.RecargaDosPoderes.Set(id, falta);
                else arena.RecargaDosPoderes.Remove(id);
            }
            // A fúria do Bárbaro esfria sem apanhar.
            var heroiDaVez = Masmorra(l).Hero;
            var frio = ClassesDeLuta.Esfriar(heroiDaVez.ClassId, heroiDaVez.ClassName, Contadores(l));
            if (frio != null) arena.Classe = frio;

            if (NoEspelho(l))
            {
                PassoDoEspelho(l);
            }
            else
            {
                foreach (var m in arena.Monstros)
                {
                    if (l.Fim != null) return;
                    if (m.Fase != "caido") AgirMonstro(l, m);
                }
                if (l.Fim != null) return;
                if (PodeGolpear(l))
                {
                    var proximo = ProximoDaVez(l);
                    if (proximo != null) ComecarGolpe(l, proximo);
                }
            }
            if (l.Fim != null) return;
            if (arena.Dupla?.Fantasma != true)
            {
                foreach (var c in arena.Companheiros)
                {
                    if (l.Fim != null) return;
                    AgirCompanheiro(l, c);
                }
            }
            if (!NoEspelho(l)) MoverTiros(l);
            if (l.Fim != null) return;

            arena.Rodada -= 1;
            if (arena.Rodada <= 0)
            {
                arena.Rodada = D.Rodada;
                RodadaDaLuta(l);
            }
        }

        private static void AgirMonstro(Luta l, MonstroNaArena m)
        {
            // Incendiado pela aljava flamejante (rodada 6b): queima a cada segundo.
            if (m.Incendio != null)
            {
                double tempo = m.Incendio.Tempo - 1;
                double danoDoFogo = m.Incendio.Dano;
                m.Incendio = tempo > 0 ? new IncendioNaArena { Tempo = tempo, Dano = danoDoFogo } : null;
                if (tempo % 60 == 0 && (FerirComDano(l, m.Indice, danoDoFogo, "🔥-" + Js.NumberToString(danoDoFogo)) || l.Fim != null)) return;
            }
            // Preso pelas Raízes (rodada 5b): o tempo corre aqui.
            if (m.Preso != null) m.Preso = m.Preso.Value > 1 ? m.Preso.Value - 1 : (double?)null;
            if (m.Lerdo != null) m.Lerdo = m.Lerdo.Value > 1 ? m.Lerdo.Value - 1 : (double?)null;
            var jeito = JeitoDoGolpe(MonstroNo(l, m.Indice), m.Poder);
            switch (m.Fase)
            {
                case "esperando":
                    // O respiro dele corre enquanto anda atrás do herói.
                    if (m.Tempo > 0) m.Tempo -= 1;
                    Aproximar(l, m, jeito);
                    return;
                case "avisando":
                    m.Tempo -= 1;
                    if (m.Tempo <= 0) SoltarGolpe(l, m, jeito);
                    return;
                case "investindo":
                    Investir(l, m, jeito);
                    return;
                default:
                    // Descansando, atordoado, hesitando: parado até o tempo acabar; aí volta a andar, no respiro dele.
                    m.Tempo -= 1;
                    if (m.Tempo <= 0)
                    {
                        m.Fase = "esperando";
                        m.Tempo = D.RespiroDoMonstro;
                    }
                    return;
            }
        }

        /// <summary>A distância (ao quadrado) do corpo do monstro ao herói.</summary>
        private static double DistanciaDoHeroi(Luta l, MonstroNaArena m)
        {
            var quem = PresaDe(l, m);
            double dx = quem.X - m.CorpoX;
            double dy = quem.Y - m.CorpoY;
            return dx * dx + dy * dy;
        }

        /// <summary>O monstro está perto o bastante do herói pro golpe dele começar?</summary>
        private static bool ADistanciaDoGolpe(Luta l, MonstroNaArena m, JeitoDeLutar jeito)
        {
            // O Vento do Mago (rodada 5c): o monstro que ele acertou golpeia de 1 bloco mais perto (até meio bloco).
            double distancia = m.Encurtado == true ? Js.Max(RoomWalk.TileUnits / 2, jeito.Distancia - Estilos.Vento.Encurta * RoomWalk.TileUnits) : jeito.Distancia;
            return DistanciaDoHeroi(l, m) <= distancia * distancia;
        }

        /// <summary>
        /// TS: aproximar — o monstro esperando anda em linha reta pro herói, no passo dele, até a distância do golpe.
        /// Não sai do chão da sala, não entra em casa de parede e não encosta em outro monstro de pé: barrado, fica
        /// onde está neste passo.
        /// </summary>
        private static void Aproximar(Luta l, MonstroNaArena m, JeitoDeLutar jeito)
        {
            EscolherPresa(l, m);
            if (ADistanciaDoGolpe(l, m, jeito)) return;
            // Preso pelas Raízes, não sai do lugar.
            if ((m.Preso ?? 0) > 0) return;
            var heroi = PresaDe(l, m);
            // Lento (as vinhas do Druida, as canções…), anda menos.
            var lento = (Sala(l).Monsters[(int)m.Indice] as CombatMonster)?.Status?.Lento;
            double passoLento = lento != null && lento.Turns > 0 ? Math.Truncate(jeito.Passo * (1 - ((lento.Amount ?? 0) != 0 ? lento.Amount.Value : 0.2))) : jeito.Passo;
            // O redemoinho da Água (rodada 5c) também.
            double passo = (m.Lerdo ?? 0) > 0 ? Math.Truncate(passoLento * (100 - Estilos.Agua.Lento) / 100) : passoLento;
            var r = Rumo(heroi.X - m.CorpoX, heroi.Y - m.CorpoY, passo);
            var formato = Geometria(l);
            double meia = RoomWalk.TileUnits / 2;
            double x = Math.Min(Math.Max(m.CorpoX + r.X, RoomWalk.TileUnits + meia), (formato.Cols - 1) * RoomWalk.TileUnits - meia);
            double y = Math.Min(Math.Max(m.CorpoY + r.Y, RoomWalk.TileUnits + meia), (formato.Rows - 1) * RoomWalk.TileUnits - meia);
            double col = Math.Floor(x / RoomWalk.TileUnits);
            double row = Math.Floor(y / RoomWalk.TileUnits);
            foreach (var casa in ArteDaSala.ParedesDaSala(Masmorra(l).Masmorra.Dungeon))
                if (casa.Col == col && casa.Row == row) return;
            foreach (var outro in l.Arena.Monstros)
            {
                if (outro == m || outro.Fase == "caido") continue;
                double dx = outro.CorpoX - x;
                double dy = outro.CorpoY - y;
                double antesX = outro.CorpoX - m.CorpoX;
                double antesY = outro.CorpoY - m.CorpoY;
                // Só barra quem chegaria mais perto do outro: afastar-se sempre pode.
                if (dx * dx + dy * dy < D.EspacoEntreMonstros * D.EspacoEntreMonstros && dx * dx + dy * dy < antesX * antesX + antesY * antesY) return;
            }
            m.CorpoX = x;
            m.CorpoY = y;
        }

        /// <summary>Há vaga pra mais um golpe começar: menos de ATACANDO_DE_UMA_VEZ golpeando e o respiro passado.</summary>
        private static bool PodeGolpear(Luta l)
        {
            if (l.Arena.Intervalo > 0) return false;
            int golpeando = 0;
            foreach (var m in l.Arena.Monstros)
                if (m.Fase == "avisando" || m.Fase == "investindo") golpeando++;
            return golpeando < D.AtacandoDeUmaVez;
        }

        /// <summary>O próximo da vez: depois de quem golpeou por último, o primeiro esperando, dando a volta.</summary>
        private static MonstroNaArena ProximoDaVez(Luta l)
        {
            var monstros = l.Arena.Monstros;
            int n = monstros.Count;
            for (int k = 1; k <= n; k++)
            {
                var m = monstros[(int)((l.Arena.Vez + k + n) % n)];
                if (m.Fase != "esperando" || m.Tempo > 0) continue;
                var jeito = JeitoDe(MonstroNo(l, m.Indice));
                // Preso pelas Raízes, não investe (o golpe de onde está, sim).
                if ((m.Preso ?? 0) > 0 && jeito.Golpe == "investida") continue;
                if (ADistanciaDoGolpe(l, m, jeito)) return m;
            }
            return null;
        }

        /// <summary>
        /// O monstro tenta golpear: atordoado ou lento demais, perde o golpe; senão sorteia em quem cai, como no
        /// site, e o aviso começa. Golpe no herói trava o desenho no chão (o círculo e a investida miram onde o
        /// herói está agora). Perder a vez também é a vez: o respiro do próximo começa igual.
        ///
        /// O chefe final, na vez de um poder (<see cref="ChefeFinal.PoderDaVez"/>), avisa o nome dele e mira sempre o
        /// herói: o Golpe Devastador com o dobro da força, o Rugido com a de sempre, mas pegando também os
        /// companheiros quando o aviso acaba. O poder conta já no começo, pra o aviso do próximo sair certo.
        /// </summary>
        private static void ComecarGolpe(Luta l, MonstroNaArena m)
        {
            var estado = Masmorra(l);
            var monstro = MonstroNo(l, m.Indice);
            string poder = ChefeFinal.PoderDaVez(monstro);
            var jeito = JeitoDoGolpe(monstro, poder);
            var inicio = MonsterHit.StartMonsterAttack(monstro, estado.Hero, l.Rng);
            bool solta = poder != null && inicio.Outcome == MonsterAttackStart.Ready;
            CombatMonster gravado = inicio.Monster;
            if (solta)
            {
                var contado = inicio.Monster.Clone();
                contado.Poderes = (inicio.Monster.Poderes ?? 0) + 1;
                gravado = contado;
            }
            var comHeroi = estado.Clone();
            comHeroi.Hero = inicio.Hero;
            l.Estado = FimDaLuta.GravarMonstro(comHeroi, m.Indice, gravado);
            l.Arena.Vez = m.Indice;
            if (inicio.Outcome == MonsterAttackStart.Stunned)
            {
                m.Fase = "atordoado";
                m.Tempo = D.TempoAtordoado;
                l.Arena.Intervalo = D.IntervaloEntreGolpes;
                Contar(l, Numero("monstro", m.Indice, "💫", "erro"));
                return;
            }
            if (inicio.Outcome == MonsterAttackStart.LentoSkip)
            {
                m.Fase = "hesitando";
                m.Tempo = D.TempoHesitando;
                l.Arena.Intervalo = D.IntervaloEntreGolpes;
                Contar(l, Numero("monstro", m.Indice, "🐌", "erro"));
                return;
            }
            if (inicio.RageTriggered) Contar(l, Aviso(Js.Str(monstro.Name) + " fica furioso!"));

            m.Fase = "avisando";
            m.Tempo = jeito.Aviso;
            m.Forca = inicio.AttackMult;
            // Fraco pela aljava flamejante (rodada 6b): este golpe sai mais fraco, e gasta um.
            double fraco = m.Fraco ?? 0;
            if (fraco > 0)
            {
                m.Forca = m.Forca * (100 - PecasSecretas.RegrasDasAljavas.Fraqueza) / 100;
                m.Fraco = fraco > 1 ? fraco - 1 : (double?)null;
            }
            // Sangrando pelo golpe do Caçador (rodada 7a): bate mais fraco.
            if (Catalog.IdDaClasse(estado.Hero.ClassId, estado.Hero.ClassName) == "cacador" && (inicio.Monster.Status?.Sangramento?.Turns ?? 0) > 0)
                m.Forca = m.Forca * (100 - CD.Cacador.Fraqueza) / 100;
            if (solta)
            {
                m.Poder = poder;
                m.Alvo = -1;
                if (poder == ChefeFinal.Devastador) m.Forca = m.Forca * ChefeFinal.ForcaDoDevastador;
                var def = ChefeFinal.Poder(poder);
                Contar(l, Aviso(def.Icone + " " + Js.Str(monstro.Name) + ": " + def.Nome + "!"));
            }
            else
            {
                if (m.NoLacaio != null && LacaioDePe(l, m.NoLacaio.Value) != null)
                {
                    // Foi atrás de um lacaio: o golpe cai nele.
                    m.Alvo = m.NoLacaio.Value;
                }
                else
                {
                    double escolhido = MonsterHit.PickMonsterTarget(Masmorra(l).Party ?? new List<Companion>(), l.Rng) ?? -1;
                    // O lacaio com corpo só leva o golpe de quem foi atrás dele.
                    m.Alvo = escolhido >= 0 && TemCorpo(l, escolhido) ? -1 : escolhido;
                }
                // O Paladino puxa os monstros: parte dos golpes que iam num companheiro vem nele.
                if (m.Alvo >= 0 && ClassesDeLuta.PuxaOsMonstros(Masmorra(l).Hero) && l.Rng() * 100 < CD.Paladino.Foco) m.Alvo = -1;
            }
            m.RumoX = 0;
            m.RumoY = 0;
            if (m.Alvo >= 0)
            {
                // No companheiro: fora do chão, cai como no site quando o aviso acaba.
                m.X = 0;
                m.Y = 0;
                return;
            }
            var heroi = PresaDe(l, m);
            if (jeito.Golpe == "perto")
            {
                m.X = heroi.X;
                m.Y = heroi.Y;
                return;
            }
            // A investida e o tiro saem da casa do monstro.
            var lugar = LugarDe(l, m.Indice);
            m.X = lugar.X;
            m.Y = lugar.Y;
            if (jeito.Golpe == "investida")
            {
                var r = Rumo(heroi.X - m.X, heroi.Y - m.Y, jeito.Velocidade);
                m.RumoX = r.X;
                m.RumoY = r.Y;
            }
        }

        /// <summary>O aviso acabou: o golpe sai. O Rugido do chefe final pega antes cada companheiro de pé.</summary>
        private static void SoltarGolpe(Luta l, MonstroNaArena m, JeitoDeLutar jeito)
        {
            if (m.Poder == ChefeFinal.Rugido) RugirNaEquipe(l, m);
            if (m.Alvo >= 0)
            {
                GolpeNoCompanheiro(l, m, m.Alvo);
                Descansar(l, m, jeito);
                return;
            }
            if (jeito.Golpe == "investida")
            {
                m.Fase = "investindo";
                Investir(l, m, jeito);
                return;
            }
            if (jeito.Golpe == "tiro")
            {
                // A bola mira onde o herói está agora, no fim do aviso.
                var heroi = PresaDe(l, m);
                var v = Rumo(heroi.X - m.X, heroi.Y - m.Y, jeito.Velocidade);
                l.Arena.Tiros.Add(new Tiro { X = m.X, Y = m.Y, Vx = v.X, Vy = v.Y, Raio = jeito.Tamanho, Vida = D.VidaDoTiro, Indice = m.Indice, Forca = m.Forca });
                Descansar(l, m, jeito);
                return;
            }
            if (Pega(l, m.X, m.Y, jeito.Tamanho)) GolpeNoHeroi(l, m.Indice, m.Forca);
            // O golpe no parceiro quem julga é o app dele: daqui não dá pra dizer que errou.
            else if (m.NoParceiro != true) Contar(l, Numero("monstro", m.Indice, "Errou", "erro"));
            Descansar(l, m, jeito);
        }

        /// <summary>TS: rugirNaEquipe — o Rugido do chefe final pega cada companheiro de pé, na força do golpe.</summary>
        private static void RugirNaEquipe(Luta l, MonstroNaArena m)
        {
            var estado = Masmorra(l);
            var monstro = MonstroNo(l, m.Indice);
            var equipe = estado.Party ?? new List<Companion>();
            var novaEquipe = new List<Companion>(equipe.Count);
            for (int i = 0; i < equipe.Count; i++)
            {
                var membro = equipe[i];
                if (membro.Hp <= 0)
                {
                    novaEquipe.Add(membro);
                    continue;
                }
                var acerto = GolpeNoMembro(membro, monstro, m.Forca, l.Rng);
                Contar(l, Numero("companheiro", i, "-" + Js.NumberToString(acerto.Damage), "dano"));
                if (acerto.Defeated) Diario(l, new[] { Js.Str(membro.Name) + " caiu!" });
                novaEquipe.Add(acerto.Member);
            }
            var comEquipe = estado.Clone();
            comEquipe.Party = novaEquipe;
            l.Estado = comEquipe;
        }

        /// <summary>O golpe acabou: o monstro descansa, e o próximo golpe espera o respiro.</summary>
        private static void Descansar(Luta l, MonstroNaArena m, JeitoDeLutar jeito)
        {
            m.Poder = null;
            if (l.Fim != null) return;
            m.Fase = "descansando";
            m.Tempo = jeito.Descanso;
            l.Arena.Intervalo = D.IntervaloEntreGolpes;
        }

        /// <summary>A investida segue pelo rumo travado: encostou no herói, pega e para; chegou na parede, acabou. O monstro fica onde ela acabou.</summary>
        private static void Investir(Luta l, MonstroNaArena m, JeitoDeLutar jeito)
        {
            m.X += m.RumoX;
            m.Y += m.RumoY;
            if (Pega(l, m.X, m.Y, jeito.Tamanho))
            {
                Pousar(l, m, jeito.Tamanho);
                GolpeNoHeroi(l, m.Indice, m.Forca);
                Descansar(l, m, jeito);
                return;
            }
            // Bateu no parceiro: para ali (o golpe quem julga é o app dele).
            if (PegaOParceiro(l, m.X, m.Y, jeito.Tamanho))
            {
                Pousar(l, m);
                Descansar(l, m, jeito);
                return;
            }
            if (ForaDoChao(l, m.X, m.Y))
            {
                Pousar(l, m);
                Contar(l, Numero("monstro", m.Indice, "Errou", "erro"));
                Descansar(l, m, jeito);
            }
        }

        /// <summary>
        /// O golpe do monstro pegou no herói: a regra do site, com a esquiva de sempre, mais a armadura encantada (que só
        /// a arena aplica) e o escudo do vigor, que apanha antes da vida.
        /// </summary>
        private static void GolpeNoHeroi(Luta l, double indice, double forca)
        {
            // O Espadachim fica imune logo depois do avanço (rodada 5a).
            if ((Contadores(l).Imune ?? 0) > 0)
            {
                Contar(l, Numero("heroi", 0, "Imune", "erro"));
                Contar(l, Som("miss"));
                return;
            }
            var estado = Masmorra(l);
            var monstro = MonstroNo(l, indice);
            var c = Contadores(l);
            var h = estado.Hero;
            // A esquiva da classe (a furtividade do Ladino, o desvio do Cavaleiro) soma com a do pet.
            // Na escuridão do Mago (rodada 5c), o monstro bate mais fraco e acerta menos.
            bool escuro = NaEscuridao(l, MonstroDaArena(l, indice));
            var rEscuro = Estilos.Escuridao;
            double esquiva = (Pets.Bonus(l.Pet).Esquiva ?? 0) + ClassesDeLuta.EsquivaDaClasse(h.ClassId, h.ClassName, c, monstro.IsBoss, Estilos.IdDoEstilo(h)) + (escuro ? rEscuro.Erra : 0);
            double forcaNoEscuro = escuro ? forca * (100 - rEscuro.Fraqueza) / 100 : forca;
            var golpe = MonsterHit.LandHitOnHero(estado.Hero, monstro, forcaNoEscuro, l.Rng, esquiva, Encantamentos.DefesasDoHeroi(estado.Hero), ClassesDeLuta.ClasseRefeita(h));
            if (golpe.Dodged)
            {
                var desviou = estado.Clone();
                // Esquivar treina a Destreza.
                desviou.Hero = Treino.AnotarUso(golpe.Hero, "destreza");
                l.Estado = FimDaLuta.GravarMonstro(desviou, indice, golpe.Monster);
                Contar(l, Numero("heroi", 0, "Desviou", "erro"));
                Contar(l, Som("miss"));
                return;
            }
            // A resistência da classe (a vida que falta no Guerreiro, a fúria, a absorção) e a da moral tiram parte do dano.
            var moral = MoralAqui(l);
            // O revestimento de ki do Monge segura parte deste golpe, e quebra.
            bool revestido = l.Arena.Revestido == true;
            double resistencia = ClassesDeLuta.ResistenciaDaClasse(h.ClassId, h.ClassName, h.Hp, h.MaxHp, c, Estilos.IdDoEstilo(h)) + moral.Resistencia + (revestido ? ClassesDeLuta.EscudoDoRevestimento(h) : 0);
            double dano = resistencia > 0 ? Js.Max(1, golpe.Damage - Math.Floor(golpe.Damage * resistencia / 100)) : golpe.Damage;
            var ferido = golpe.Hero;
            if (resistencia > 0)
            {
                ferido = golpe.Hero.Clone();
                ferido.Hp = Js.Max(0, estado.Hero.Hp - dano);
            }
            var hero = NoEscudo(l, estado.Hero.Hp, ferido, dano);
            // Os pesados (os Brutamontes) também quebram osso, como o chefe já quebra (doc do Breno de 2026-11-15; só aqui).
            string quebrou = golpe.Quebrou;
            if (!Js.Truthy(quebrou) && !monstro.IsBoss && monstro.EnemyClassId == "brutamontes" && l.Rng() < FerimentosDoHeroi.ChanceDeQuebrarNoChefe)
            {
                var quebra = FerimentosDoHeroi.QuebrarMembro(hero, l.Rng);
                hero = quebra.Hero;
                quebrou = quebra.Membro;
            }
            // A moral 5 do grupo segura os ossos: o sorteio corre igual, mas nada quebra.
            if (Js.Truthy(quebrou) && moral.SemQuebrar)
            {
                hero = hero.Clone();
                hero.Ferimentos = estado.Hero.Ferimentos;
                quebrou = null;
            }
            // O Poder da fé segura a vida no piso; e o dano levado entra na janela dele.
            hero = PisoDaFe(l, estado.Hero.Hp, hero);
            AnotarDanoLevado(l, dano);
            var comHeroi = estado.Clone();
            comHeroi.Hero = hero;
            l.Estado = FimDaLuta.GravarMonstro(comHeroi, indice, golpe.Monster);
            Contar(l, Som("hit"));
            if (revestido)
            {
                l.Arena.Revestido = null;
                Contar(l, Aviso("☯️ O revestimento se quebra"));
            }
            if (Js.Truthy(quebrou))
            {
                string texto = "🦴 " + Js.Str(monstro.Name) + " quebrou " + FerimentosDoHeroi.NomeDoMembro(quebrou) + "!";
                Contar(l, Aviso(texto));
                Diario(l, new List<string> { texto });
            }
            if (golpe.ManaDrained > 0) Contar(l, Aviso(Js.Str(monstro.Name) + " drena " + Js.NumberToString(golpe.ManaDrained) + " de mana"));
            if (golpe.DrainResisted == true) Contar(l, Aviso("Sua armadura segura o dreno de mana"));
            if (golpe.PoisonApplied) Contar(l, Aviso("Você foi envenenado"));
            if (golpe.PoisonResisted == true) Contar(l, Aviso("Sua armadura segura o veneno"));
            Apanhou(l, indice, dano, hero.Hp > 0);
            if (l.Fim != null) return;
            if (hero.Hp <= 0) Cair(l);
        }

        /// <summary>
        /// O dano no herói passa primeiro pelo escudo do vigor: ele aguenta o que tiver, e a vida perde só o resto. Conta
        /// os números (o do escudo no tom dele) e devolve o herói com a vida certa. Sem escudo, é o dano de sempre.
        /// </summary>
        private static Hero NoEscudo(Luta l, double vidaAntes, Hero hero, double dano)
        {
            double escudo = l.Arena.Escudo ?? 0;
            double absorvido = Js.Min(escudo, dano);
            if (absorvido <= 0)
            {
                Contar(l, Numero("heroi", 0, "-" + Js.NumberToString(dano), "dano"));
                return hero;
            }
            l.Arena.Escudo = escudo - absorvido;
            Contar(l, Numero("heroi", 0, "💪-" + Js.NumberToString(absorvido), "escudo"));
            double resto = dano - absorvido;
            if (resto > 0) Contar(l, Numero("heroi", 0, "-" + Js.NumberToString(resto), "dano"));
            var comVida = hero.Clone();
            comVida.Hp = Js.Max(0, vidaAntes - resto);
            return comVida;
        }

        /// <summary>O golpe do monstro cai no companheiro <paramref name="alvo"/>, como no site. Se ele já caiu, o golpe vai no vazio.</summary>
        private static void GolpeNoCompanheiro(Luta l, MonstroNaArena m, double alvo)
        {
            var estado = Masmorra(l);
            var equipe = estado.Party ?? new List<Companion>();
            int indice = (int)alvo;
            var membro = indice >= 0 && indice < equipe.Count ? equipe[indice] : null;
            if (membro == null || membro.Hp <= 0)
            {
                Contar(l, Numero("monstro", m.Indice, "Errou", "erro"));
                return;
            }
            var acerto = GolpeNoMembro(membro, MonstroNo(l, m.Indice), m.Forca, l.Rng);
            var novaEquipe = new List<Companion>(equipe.Count);
            for (int i = 0; i < equipe.Count; i++) novaEquipe.Add(i == indice ? acerto.Member : equipe[i]);
            var comEquipe = estado.Clone();
            comEquipe.Party = novaEquipe;
            l.Estado = comEquipe;
            Contar(l, Numero("companheiro", alvo, "-" + Js.NumberToString(acerto.Damage), "dano"));
            Contar(l, Som("hit"));
            if (acerto.Defeated) Diario(l, new[] { Js.Str(membro.Name) + " caiu!" });
        }

        /// <summary>O companheiro bate no alvo do jogador, no tempo dele.</summary>
        private static void AgirCompanheiro(Luta l, CompanheiroNaArena c)
        {
            var estado = Masmorra(l);
            var equipe = estado.Party ?? new List<Companion>();
            int i = (int)c.Indice;
            if (i >= equipe.Count || equipe[i].Hp <= 0) return;
            var membro = equipe[i];
            if (c.X != null && c.Y != null)
            {
                AgirLacaio(l, c, membro);
                return;
            }
            if (c.Tempo > 0) c.Tempo -= 1;
            if (c.Tempo > 0) return;
            var alvo = AlvoAtual(l);
            if (alvo == null) return;
            c.Tempo = D.CadenciaDoCompanheiro;
            var monstro = MonstroNo(l, alvo.Value);
            var acao = Party.PartyMemberAct(estado.Hero, membro, monstro, l.Rng);
            var comHeroi = estado.Clone();
            comHeroi.Hero = acao.Hero;
            var ferida = FerirNaArena(l, comHeroi, alvo.Value, acao.Monster);
            var resultado = acao.Outcome;
            if (resultado.Kind == PartyOutcomeKinds.HealedHero)
            {
                Contar(l, Numero("heroi", 0, "+" + Js.NumberToString(resultado.Amount ?? 0), "cura"));
            }
            else if (resultado.Kind == PartyOutcomeKinds.Miss)
            {
                Contar(l, Numero("monstro", alvo.Value, "Errou", "erro"));
            }
            else
            {
                Contar(l, NumeroNoMonstro(ferida, alvo.Value, "-" + Js.NumberToString(resultado.Amount ?? 0), "dano"));
                if (ferida.Caiu) Abater(l, alvo.Value, Monsters.View(acao.Monster));
            }
        }

        /// <summary>As bolas voam; a que encosta no herói pega, a que chega na parede (ou acaba) errou.</summary>
        private static void MoverTiros(Luta l)
        {
            var ficam = new List<Tiro>();
            foreach (var t in l.Arena.Tiros)
            {
                if (l.Fim != null) break;
                t.X += t.Vx;
                t.Y += t.Vy;
                t.Vida -= 1;
                if (t.Vida <= 0 || ForaDoChao(l, t.X, t.Y))
                {
                    Contar(l, Numero("monstro", t.Indice, "Errou", "erro"));
                    continue;
                }
                if (Pega(l, t.X, t.Y, t.Raio))
                {
                    GolpeNoHeroi(l, t.Indice, t.Forca);
                    continue;
                }
                // A bola some no parceiro (o golpe quem julga é o app dele).
                if (PegaOParceiro(l, t.X, t.Y, t.Raio)) continue;
                ficam.Add(t);
            }
            l.Arena.Tiros = ficam;
        }

        /// <summary>A rodada: o veneno do herói, o dano contínuo de cada monstro de pé e a Canção de Batalha.</summary>
        private static void RodadaDaLuta(Luta l)
        {
            var antes = Masmorra(l).Hero;
            var veneno = HeroStatus.TickHeroStatus(antes);
            // O veneno também passa primeiro pelo escudo do vigor (e pelo piso do Poder da fé).
            var heroi = veneno.Damage > 0 ? PisoDaFe(l, antes.Hp, NoEscudo(l, antes.Hp, veneno.Hero, veneno.Damage)) : veneno.Hero;
            AnotarDanoLevado(l, veneno.Damage);
            var comVeneno = Masmorra(l).Clone();
            comVeneno.Hero = heroi;
            l.Estado = comVeneno;
            if (heroi.Hp <= 0 && l.Arena.Dupla?.Fantasma != true)
            {
                Diario(l, new[] { "O veneno foi mais forte." });
                Cair(l);
                if (l.Fim != null) return;
            }
            Regenerar(l);

            // No espelho, o veneno e o fogo dos monstros correm no app do anfitrião.
            foreach (var indice in NoEspelho(l) ? new List<double>() : FimDaLuta.IndicesDePe(Sala(l)))
            {
                var monstro = MonstroNo(l, indice);
                var dot = StatusEffects.TickMonsterDot(monstro);
                var ferida = FerirNaArena(l, Masmorra(l), indice, dot.Monster);
                if (dot.Damage > 0) Contar(l, NumeroNoMonstro(ferida, indice, "-" + Js.NumberToString(dot.Damage), "dano"));
                if (ferida.Caiu) Abater(l, indice, Monsters.View(dot.Monster));
                if (l.Fim != null) return;
            }

            var comCancao = Masmorra(l).Clone();
            comCancao.Hero = Party.PassarRodadaDaCancao(comCancao.Hero);
            l.Estado = comCancao;
        }

        // ---------- os acessórios únicos (AcessoriosUnicos; só a arena os aplica) ----------

        /// <summary>TS: roubarVida — a Presa do Morcego: o golpe que acertou devolve em vida parte do dano.</summary>
        private static void RoubarVida(Luta l, double dano)
        {
            var estado = Masmorra(l);
            var efeito = AcessoriosUnicos.EfeitoDoUnico(estado.Hero);
            if (efeito == null || efeito.Efeito != "roubo_de_vida" || dano <= 0) return;
            var hero = estado.Hero;
            double cura = Js.Max(0, Js.Min(hero.MaxHp - hero.Hp, Js.Max(1, Js.Round(dano * efeito.Valor))));
            if (cura <= 0) return;
            var curado = hero.Clone();
            curado.Hp = hero.Hp + cura;
            var comCura = estado.Clone();
            comCura.Hero = curado;
            l.Estado = comCura;
            Contar(l, Numero("heroi", 0, "🦇+" + Js.NumberToString(cura), "cura"));
        }

        /// <summary>TS: regenerar — o Amuleto da Floresta Antiga: a cada rodada da luta, uma parte da vida máxima volta.</summary>
        private static void Regenerar(Luta l)
        {
            var estado = Masmorra(l);
            var efeito = AcessoriosUnicos.EfeitoDoUnico(estado.Hero);
            var hero = estado.Hero;
            if (efeito == null || efeito.Efeito != "regeneracao" || hero.Hp <= 0 || hero.Hp >= hero.MaxHp) return;
            double cura = Js.Min(hero.MaxHp - hero.Hp, Js.Max(1, Math.Floor(hero.MaxHp * efeito.Valor)));
            var curado = hero.Clone();
            curado.Hp = hero.Hp + cura;
            var comCura = estado.Clone();
            comCura.Hero = curado;
            l.Estado = comCura;
            Contar(l, Numero("heroi", 0, "🌲+" + Js.NumberToString(cura), "cura"));
        }

        // ---------- quem cai ----------

        /// <summary>
        /// O monstro caiu: é pago, e o alvo passa pro primeiro de pé; foi o último, a sala está limpa e a luta
        /// acaba em vitória.
        /// </summary>
        private static void Abater(Luta l, double indice, CombatMonsterView abatido)
        {
            int i = (int)indice;
            if (i >= 0 && i < l.Arena.Monstros.Count) l.Arena.Monstros[i].Fase = "caido";
            // Na luta do Necromante, quem cai deixa um cristal no chão (rodada 4b).
            var quemMatou = Masmorra(l).Hero;
            if (i >= 0 && i < l.Arena.Monstros.Count && Catalog.IdDaClasse(quemMatou.ClassId, quemMatou.ClassName) == "necromante")
            {
                var caido = l.Arena.Monstros[i];
                var cristais = l.Arena.Cristais != null ? new List<CristalNaSala>(l.Arena.Cristais) : new List<CristalNaSala>();
                cristais.Add(new CristalNaSala { X = caido.CorpoX, Y = caido.CorpoY, Especie = abatido.SpeciesId, Nivel = Monsters.MonsterLevel(abatido.Floor), Chefe = abatido.IsBoss ? true : (bool?)null });
                l.Arena.Cristais = cristais;
            }
            // O escolhido caiu: o ataque volta a ir no mais perto.
            if (indice == l.Arena.Alvo) l.Arena.Escolhido = null;
            var pago = FimDaLuta.PagarAbate(Masmorra(l), abatido);
            // Caiu o último lacaio: o chefe final fica furioso.
            var furia = ChefeFinal.Enfurecer(pago.Estado);
            l.Estado = furia.Estado;
            Diario(l, pago.Log);
            Diario(l, furia.Log);
            foreach (var texto in furia.Log) Contar(l, Aviso(texto));
            SeguirOuVencer(l, abatido);
        }

        /// <summary>TS: seguirOuVencer — alguém saiu da luta (caiu ou foi domado): o alvo passa pro primeiro de pé; foi o último, a luta acaba em vitória.</summary>
        private static void SeguirOuVencer(Luta l, CombatMonsterView abatido)
        {
            var dePe = FimDaLuta.IndicesDePe(Sala(l));
            if (dePe.Count > 0)
            {
                if (!dePe.Contains(l.Arena.Alvo)) l.Arena.Alvo = dePe[0];
                return;
            }

            // A arena só existe no app: o item achado pode vir com material.
            var limpa = FimDaLuta.LimparSala(Masmorra(l), abatido, l.Rng, l.Now, true);
            l.Estado = limpa.Estado;
            l.Loot = limpa.Loot;
            if (limpa.Conquista != null) l.Conquista = limpa.Conquista;
            l.Fim = "vitoria";
            l.Arena.Evento = null;
            l.Arena.Tiros = new List<Tiro>();
            Diario(l, limpa.Log);
            Contar(l, Som("victory"));
        }

        private static void Perder(Luta l)
        {
            var perdida = FimDaLuta.PerderLuta(Masmorra(l), l.Rng);
            l.Estado = perdida.Estado;
            l.Fim = "derrota";
            l.Arena.Evento = null;
            l.Arena.Tiros = new List<Tiro>();
            Diario(l, perdida.Log);
            Contar(l, Som("defeat"));
        }

        // ---------- o apoio (rodada 3b: Bardo, Clérigo e Druida) ----------

        private static readonly string[] TiposDeApoio = { "bardo", "clerigo", "purificar", "comunhao" };

        /// <summary>TS: ICONE_DO_APOIO — o ícone do número da cura de cada apoio.</summary>
        private static string IconeDoApoio(string tipo) => tipo == "bardo" ? "🎵" : tipo == "purificar" ? "🌿" : "✝️";

        /// <summary>TS: apoiar — o ataque mirado num aliado terminou: o Druida purifica; o Bardo e o Clérigo curam (e o Bardo conta a moral).</summary>
        private static void Apoiar(Luta l, string aliado, LeituraDaMira leitura)
        {
            if (!leitura.Acerto)
            {
                Contar(l, Numero("heroi", 0, "Errou", "erro"));
                Contar(l, Som("miss"));
                return;
            }
            var estado = Masmorra(l).Clone();
            estado.Hero = Treino.AnotarUso(estado.Hero, "sabedoria");
            l.Estado = estado;
            string id = Catalog.IdDaClasse(estado.Hero.ClassId, estado.Hero.ClassName);
            if (id == "druida")
            {
                // A Purificação da Metamorfose cura mais (rodada 5b).
                double mais = Estilos.IdDoEstilo(estado.Hero) == "metamorfose" ? Estilos.Metamorfose.Purificacao : 0;
                if (aliado == "eu") PurificarAqui(l, mais);
                else l.Apoios.Add(new ApoioDoParceiro { Tipo = "purificar", Mais = mais > 0 ? mais : (double?)null });
                l.Arena.Recarga = CD.Druida.SemAtacar;
                Contar(l, Aviso(aliado == "eu" ? "🌿 Purificação Ancestral" : "🌿 Purificação Ancestral no parceiro"));
                return;
            }
            string tipo = id == "bardo" ? "bardo" : "clerigo";
            // Ele mesmo recebe sempre; o parceiro, quando é o mirado.
            ApoiarAqui(l);
            if (aliado == "parceiro") l.Apoios.Add(new ApoioDoParceiro { Tipo = tipo });
            if (tipo == "bardo" && leitura.Critico) ContarMoral(l);
        }

        /// <summary>TS: apoiarAqui — o Bardo e o Clérigo recebem o próprio apoio a cada golpe que acerta (e a cada apoio).</summary>
        private static void ApoiarAqui(Luta l)
        {
            var h = Masmorra(l).Hero;
            string id = Catalog.IdDaClasse(h.ClassId, h.ClassName);
            if (id == "bardo") ReceberApoio(l, new ApoioDoParceiro { Tipo = "bardo" });
            else if (id == "clerigo") ReceberApoio(l, new ApoioDoParceiro { Tipo = "clerigo" });
        }

        /// <summary>TS: receberApoio — o apoio cai no herói daqui: a cura, o reforço do Bardo, a Purificação, a Comunhão.</summary>
        private static void ReceberApoio(Luta l, ApoioDoParceiro apoio)
        {
            if (apoio.Tipo == "purificar")
            {
                PurificarAqui(l, apoio.Mais ?? 0);
                return;
            }
            if (apoio.Tipo == "comunhao")
            {
                TocarAFe(l, apoio.Passos ?? 0, true);
                return;
            }
            CurarAqui(l, apoio.Tipo);
            // O Poder da fé de pé apaga os efeitos até acabar: o reforço não pega.
            if (apoio.Tipo == "bardo" && !((l.Arena.Fe ?? 0) > 0)) l.Arena.Reforco = CD.Bardo.TempoDaForca;
        }

        /// <summary>TS: curarAqui — a cura do apoio no herói daqui, com o número em cima dele.</summary>
        private static void CurarAqui(Luta l, string tipo, double mais = 0)
        {
            var estado = Masmorra(l);
            double cura = ClassesDeLuta.CuraDoApoio(tipo, estado.Hero.Hp, estado.Hero.MaxHp, mais);
            if (cura <= 0) return;
            var curado = estado.Clone();
            curado.Hero = estado.Hero.Clone();
            curado.Hero.Hp = estado.Hero.Hp + cura;
            l.Estado = curado;
            Contar(l, Numero("heroi", 0, IconeDoApoio(tipo) + "+" + Js.NumberToString(cura), "cura"));
            Contar(l, Som("heal"));
        }

        /// <summary>TS: purificarAqui — a Purificação Ancestral no herói daqui: o veneno e os ferimentos somem, e a cura.</summary>
        private static void PurificarAqui(Luta l, double mais = 0)
        {
            var estado = Masmorra(l);
            var buffs = estado.Hero.Buffs?.Clone() ?? new HeroBuffs();
            buffs.PoisonTurns = null;
            buffs.PoisonDmg = null;
            var limpo = estado.Clone();
            limpo.Hero = estado.Hero.Clone();
            limpo.Hero.Buffs = buffs;
            limpo.Hero.Ferimentos = null;
            l.Estado = limpo;
            CurarAqui(l, "purificar", mais);
            Contar(l, Aviso("🌿 Purificado"));
        }

        /// <summary>TS: contarMoral — um crítico do Bardo num aliado: a moral do grupo conta, e avisa quando sobe.</summary>
        private static void ContarMoral(Luta l)
        {
            var conta = ClassesDeLuta.ContarCriticoNoAliado(l.Arena.Moral ?? new Moral());
            l.Arena.Moral = conta.Moral;
            if (conta.Subiu == null) return;
            l.MoralSubiu = conta.Subiu;
            string texto = "🎵 Moral " + Js.NumberToString(conta.Subiu.Value) + "!";
            Contar(l, Aviso(texto));
            Diario(l, new[] { texto });
        }

        /// <summary>TS: vinhasNoMonstro — as vinhas do Druida deixam o monstro de pé lento e envenenado. No espelho, não.</summary>
        /// <summary>TS: sangrarNoMonstro — o golpe do Caçador: o monstro de pé sangra 1 turno com 20% do dano (sem encurtar nem enfraquecer o que já tinha).</summary>
        private static void SangrarNoMonstro(Luta l, double indice, double dano)
        {
            var h = Masmorra(l).Hero;
            if (Catalog.IdDaClasse(h.ClassId, h.ClassName) != "cacador" || NoEspelho(l)) return;
            var m = MonstroDaArena(l, indice);
            if (m == null || m.Fase == "caido") return;
            var r = CD.Cacador;
            var monstro = CombatMonster.From(Sala(l).Monsters[(int)indice]);
            var antes = monstro.Status?.Sangramento;
            double dmg = Js.Max(1, Math.Truncate(dano * r.Sangramento / 100));
            var status = monstro.Status?.Clone() ?? new MonsterStatus();
            status.Sangramento = new DotStatus { Turns = Js.Max(r.Turnos, antes?.Turns ?? 0), Dmg = Js.Max(dmg, antes?.Dmg ?? 0) };
            monstro.Status = status;
            l.Estado = FimDaLuta.GravarMonstro(Masmorra(l), indice, monstro);
            if (!((antes?.Turns ?? 0) > 0)) Contar(l, Numero("monstro", indice, "🩸", "erro"));
        }

        private static void VinhasNoMonstro(Luta l, double indice)
        {
            var h = Masmorra(l).Hero;
            if (Catalog.IdDaClasse(h.ClassId, h.ClassName) != "druida" || NoEspelho(l)) return;
            var m = MonstroDaArena(l, indice);
            if (m == null || m.Fase == "caido") return;
            var r = CD.Druida;
            var monstro = CombatMonster.From(Sala(l).Monsters[(int)indice]);
            // Os estilos (rodada 5b): o golpe forte das Raízes deixa mais lento, e as Raízes fundas envenenam pela vida que resta.
            string estilo = Estilos.IdDoEstilo(h);
            double golpes = Contadores(l).Golpes ?? 0;
            double lento = estilo == "raizes" && ClassesDeLuta.GolpeForte(golpes) ? Estilos.Raizes.Lento : r.Lento;
            double veneno = estilo == "raizes" && ClassesDeLuta.RaizesFundas(golpes)
                ? Js.Max(1, Math.Truncate(monstro.Hp * Estilos.Raizes.Veneno / 100))
                : Js.Max(1, Math.Truncate(monstro.MaxHp * r.Veneno / 100));
            var status = monstro.Status?.Clone() ?? new MonsterStatus();
            status.Lento = new AmountStatus { Turns = r.Turnos, Amount = lento / 100 };
            status.Veneno = new DotStatus { Turns = r.Turnos, Dmg = veneno };
            monstro.Status = status;
            l.Estado = FimDaLuta.GravarMonstro(Masmorra(l), indice, monstro);
            string icone = estilo == "metamorfose" ? "🐾" : estilo == "florescimento" ? "🌸" : estilo == "raizes" ? "🌱" : "🌿";
            Contar(l, Numero("monstro", indice, icone, "erro"));
        }

        /// <summary>TS: usarFe — o botão do Poder da fé (o Clérigo): em dupla, a Comunhão; sozinho, o Santo Egoísta (com a mana cheia).</summary>
        private static void UsarFe(Luta l)
        {
            var hero = Masmorra(l).Hero;
            if (Catalog.IdDaClasse(hero.ClassId, hero.ClassName) != "clerigo" || (l.Arena.RecargaDaFe ?? 0) > 0 || (l.Arena.Fe ?? 0) > 0) return;
            bool comunhao = ParceiroDePe(l) != null;
            if (!comunhao && hero.Mp < hero.MaxMp)
            {
                Contar(l, Aviso("O Santo Egoísta pede a mana cheia"));
                return;
            }
            double levado = DanoLevadoNaJanela(l.Arena) + (comunhao ? (l.Arena.Dupla?.ParceiroDano ?? 0) : 0);
            double passos = ClassesDeLuta.DuracaoDaFe(comunhao, levado, comunhao ? 2 : 1);
            l.Arena.RecargaDaFe = CD.Clerigo.RecargaDaFe;
            if (comunhao) l.Apoios.Add(new ApoioDoParceiro { Tipo = "comunhao", Passos = passos });
            string texto = comunhao ? "✝️ Comunhão sagrada!" : "✝️ Santo Egoísta!";
            Contar(l, Aviso(texto));
            Diario(l, new[] { texto });
            TocarAFe(l, passos, false);
        }

        /// <summary>TS: tocarAFe — o Poder da fé cai no herói daqui: a cura, a mana vai embora, os efeitos somem, e o piso.</summary>
        private static void TocarAFe(Luta l, double passos, bool doParceiro)
        {
            var estado = Masmorra(l).Clone();
            estado.Hero = estado.Hero.Clone();
            estado.Hero.Mp = 0;
            estado.Hero.Buffs = new HeroBuffs();
            l.Estado = estado;
            l.Arena.Reforco = null;
            CurarAqui(l, "comunhao");
            if (passos > (l.Arena.Fe ?? 0)) l.Arena.Fe = passos;
            if (doParceiro) Contar(l, Aviso("✝️ Comunhão sagrada do parceiro!"));
        }

        /// <summary>TS: pisoDaFe — com o Poder da fé de pé, a vida não desce do piso (e não sobe quem já estava abaixo).</summary>
        private static Hero PisoDaFe(Luta l, double antes, Hero hero)
        {
            if (!((l.Arena.Fe ?? 0) > 0)) return hero;
            double piso = Js.Min(antes, Math.Ceiling(hero.MaxHp * CD.Clerigo.PisoDaVida / 100));
            if (!(hero.Hp < piso)) return hero;
            var segurado = hero.Clone();
            segurado.Hp = piso;
            return segurado;
        }

        /// <summary>TS: passarAFe — um passo do mundo com o Poder da fé de pé: ele vai acabando, e nenhum efeito pega.</summary>
        private static void PassarAFe(Luta l)
        {
            if (l.Arena.Fe == null) return;
            if (l.Arena.Fe.Value > 1) l.Arena.Fe -= 1;
            else
            {
                l.Arena.Fe = null;
                return;
            }
            l.Arena.Reforco = null;
            var estado = Masmorra(l);
            if (TemEfeito(estado.Hero.Buffs))
            {
                var limpo = estado.Clone();
                limpo.Hero = estado.Hero.Clone();
                limpo.Hero.Buffs = new HeroBuffs();
                l.Estado = limpo;
            }
        }

        /// <summary>O herói tem algum efeito (um campo dos buffs com valor).</summary>
        private static bool TemEfeito(HeroBuffs b) =>
            b != null && (b.CritNext != null || b.PrecisaoTurns != null || b.PrecisaoAmount != null || b.ForcaTurns != null || b.ForcaAmount != null ||
                b.EsquivaTurns != null || b.EsquivaAmount != null || b.Shield != null || b.PoisonTurns != null || b.PoisonDmg != null ||
                b.InspiracaoTurns != null || b.InspiracaoAmount != null || (b.Extra != null && b.Extra.Count > 0));

        /// <summary>TS: anotarDanoLevado — anota o dano que o herói daqui levou (só o Clérigo e a dupla precisam).</summary>
        private static void AnotarDanoLevado(Luta l, double dano)
        {
            var h = Masmorra(l).Hero;
            if (dano <= 0 || (Catalog.IdDaClasse(h.ClassId, h.ClassName) != "clerigo" && l.Arena.Dupla == null)) return;
            double janela = l.Arena.Passo - CD.Clerigo.Janela;
            var lista = new List<DanoLevado>();
            if (l.Arena.DanosLevados != null)
                foreach (var d in l.Arena.DanosLevados)
                    if (d.Passo > janela) lista.Add(d);
            lista.Add(new DanoLevado { Passo = l.Arena.Passo, Dano = dano });
            l.Arena.DanosLevados = lista;
        }

        private static double DanoLevadoNaJanela(Arena arena)
        {
            double janela = arena.Passo - CD.Clerigo.Janela;
            double soma = 0;
            if (arena.DanosLevados != null)
                foreach (var d in arena.DanosLevados)
                    if (d.Passo > janela) soma += d.Dano;
            return soma;
        }

        /// <summary>TS: danoLevadoNaJanela — o dano que o herói levou nos últimos 30 s da luta (o app manda pro parceiro).</summary>
        public static double DanoLevadoNaJanela(LutaEmTempoReal luta) => DanoLevadoNaJanela(luta.Arena);

        /// <summary>TS: extrasDaLuta — o que a linha da classe mostra além dos contadores.</summary>
        public static ExtrasDaClasse ExtrasDaLuta(LutaEmTempoReal luta)
        {
            var a = luta.Arena;
            var extras = new ExtrasDaClasse();
            if ((a.Moral?.Nivel ?? 0) > 0) extras.Moral = a.Moral.Nivel;
            if ((a.RecargaDaFe ?? 0) > 0) extras.RecargaDaFe = a.RecargaDaFe;
            if ((a.Fe ?? 0) > 0) extras.Fe = a.Fe;
            if (a.Recarga > D.RecargaDoAtaque) extras.SemAtacar = a.Recarga;
            if ((a.Ki ?? 0) > 0) extras.Ki = a.Ki;
            if (a.Revestido == true) extras.Revestido = true;
            if (a.Canalizando == true) extras.Canalizando = true;
            if ((a.RecargaDaMagia ?? 0) > 0) extras.RecargaDaMagia = a.RecargaDaMagia;
            if (luta.Estado.Hero.BloqueioDaMagia != null) extras.MagiaSelada = true;
            if ((a.Flores?.Count ?? 0) > 0) extras.Flores = a.Flores.Count;
            if (ClassesDeLuta.PodeLancarChapeu(luta.Estado.Hero)) extras.Chapeu = a.RecargaDoChapeu ?? 0;
            return extras;
        }

        /// <summary>TS: memoriaDaLuta — o que a luta deixa pra próxima, na memória do app.</summary>
        public static MemoriaDaLuta MemoriaDaLuta(LutaEmTempoReal luta)
        {
            var memoria = new MemoriaDaLuta();
            if (luta.Arena.Moral != null) memoria.Moral = luta.Arena.Moral.Clone();
            if ((luta.Arena.RecargaDaFe ?? 0) > 0) memoria.RecargaDaFe = luta.Arena.RecargaDaFe;
            if ((luta.Arena.Ki ?? 0) > 0) memoria.Ki = luta.Arena.Ki;
            if ((luta.Arena.RecargaDaMagia ?? 0) > 0) memoria.RecargaDaMagia = luta.Arena.RecargaDaMagia;
            if ((luta.Arena.RecargaDoChapeu ?? 0) > 0) memoria.RecargaDoChapeu = luta.Arena.RecargaDoChapeu;
            return memoria;
        }

        // ---------- o Necromante: os lacaios com corpo e a Magia Proibida (rodada 4b) ----------

        private static readonly double[][] PassosAoLado =
        {
            new double[] { -1, 0 }, new double[] { 1, 0 }, new double[] { 0, 1 }, new double[] { -1, 1 }, new double[] { 1, 1 }, new double[] { 0, -1 },
        };

        /// <summary>TS: lugarAoLado — um lugar ao lado de (x, y) pro lacaio número k, no chão e fora das paredes de dentro.</summary>
        public static (double X, double Y) LugarAoLado(double cx, double cy, int k, GeometriaDaSala formato, IReadOnlyList<TileRef> paredes)
        {
            double t = RoomWalk.TileUnits;
            double meia = t / 2;
            for (int tentativa = 0; tentativa < PassosAoLado.Length; tentativa++)
            {
                var passo = PassosAoLado[(k + tentativa) % PassosAoLado.Length];
                double x = Math.Min(Math.Max(cx + passo[0] * t, t + meia), (formato.Cols - 1) * t - meia);
                double y = Math.Min(Math.Max(cy + passo[1] * t, t + meia), (formato.Rows - 1) * t - meia);
                double col = Math.Floor(x / t);
                double row = Math.Floor(y / t);
                bool naParede = false;
                foreach (var casa in paredes)
                    if (casa.Col == col && casa.Row == row) naParede = true;
                if (!naParede) return (x, y);
            }
            return (cx, cy);
        }

        private static CompanheiroNaArena CompanheiroDe(Luta l, double indice)
        {
            foreach (var comp in l.Arena.Companheiros)
                if (comp.Indice == indice) return comp;
            return null;
        }

        private static bool TemCorpo(Luta l, double indice) => CompanheiroDe(l, indice)?.X != null;

        private static CompanheiroNaArena LacaioDePe(Luta l, double indice)
        {
            var c = CompanheiroDe(l, indice);
            if (c == null || c.X == null) return null;
            var party = Masmorra(l).Party ?? new List<Companion>();
            int i = (int)indice;
            return i >= 0 && i < party.Count && party[i].Hp > 0 ? c : null;
        }

        private static List<CompanheiroNaArena> LacaiosComCorpo(Luta l)
        {
            var party = Masmorra(l).Party ?? new List<Companion>();
            var lista = new List<CompanheiroNaArena>();
            foreach (var c in l.Arena.Companheiros)
            {
                int i = (int)c.Indice;
                if (c.X != null && i < party.Count && party[i].Hp > 0) lista.Add(c);
            }
            return lista;
        }

        /// <summary>TS: escolherComLacaios — com lacaios na sala, o monstro vai atrás de quem estiver mais perto.</summary>
        private static void EscolherComLacaios(Luta l, MonstroNaArena m, PontoNaSala parceiro, List<CompanheiroNaArena> lacaios)
        {
            double perto = (100 - CD.Paladino.Foco) * (100 - CD.Paladino.Foco);
            double Distancia(double x, double y) => (x - m.CorpoX) * (x - m.CorpoX) + (y - m.CorpoY) * (y - m.CorpoY);
            string melhor = null;
            double melhorLacaio = -1;
            double menor = 0;
            void Pesar(string quem, double lacaio, double valor)
            {
                if (melhor == null || valor < menor)
                {
                    melhor = quem;
                    melhorLacaio = lacaio;
                    menor = valor;
                }
            }
            if (l.Arena.Dupla?.Fantasma != true) Pesar("heroi", -1, Distancia(l.Arena.Heroi.X, l.Arena.Heroi.Y) * (ClassesDeLuta.PuxaOsMonstros(Masmorra(l).Hero) ? perto : 10000));
            if (parceiro != null) Pesar("parceiro", -1, Distancia(parceiro.X, parceiro.Y) * (l.Arena.Dupla?.ParceiroPuxa == true ? perto : 10000));
            foreach (var c in lacaios) Pesar("lacaio", c.Indice, Distancia(c.X.Value, c.Y.Value) * 10000);
            m.NoParceiro = null;
            m.NoLacaio = null;
            if (melhor == "parceiro") m.NoParceiro = true;
            else if (melhor == "lacaio") m.NoLacaio = melhorLacaio;
        }

        /// <summary>TS: golpeNoMembro — o golpe do monstro num membro da equipe; o lacaio no ofensivo leva 10% a menos.</summary>
        private static PartyMemberHit GolpeNoMembro(Companion membro, CombatMonsterView monstro, double forca, RngFn rng)
        {
            var golpe = MonsterHit.HitPartyMember(membro, monstro, forca, rng);
            // O animal do Caçador no ofensivo (rodada 7c) leva 20% a menos; o lacaio, 10%.
            double resistencia = membro.Animal != null
                ? (Animais.EstadoDoAnimal(membro) == "ofensivo" ? Animais.NaLuta.ResistenciaNoOfensivo : 0)
                : (membro.Invocado == true && Invocacao.EstadoDoLacaio(membro) == "ofensivo" ? Invocacao.Necromante.ResistenciaNoOfensivo : 0);
            if (resistencia == 0) return golpe;
            double dano = Js.Max(1, golpe.Damage - Math.Floor(golpe.Damage * resistencia / 100));
            var ferido = membro.Clone();
            ferido.Hp = Js.Max(0, membro.Hp - dano);
            return new PartyMemberHit { Member = ferido, Damage = dano, Defeated = ferido.Hp <= 0 };
        }

        private static JeitoDeLutar JeitoDoLacaio(Companion membro)
        {
            var especie = MonsterCatalog.SpeciesById(Invocacao.EspecieDoLacaio(membro));
            return especie != null && D.JeitosDeLutar.TryGet(especie.Behavior, out var jeito) ? jeito : D.JeitosDeLutar.Get("defensivo");
        }

        private static double AlcanceDoLacaio(Companion membro)
        {
            var jeito = JeitoDoLacaio(membro);
            return jeito.Golpe == "tiro" ? jeito.Distancia : RoomWalk.TileUnits + RoomWalk.TileUnits / 2;
        }

        /// <summary>TS: alvoDoLacaio — na retaguarda, o mais perto entre os que estão perto do dono; no ofensivo, o mais perto na sala.</summary>
        private static double? AlvoDoLacaio(Luta l, CompanheiroNaArena c, Companion membro)
        {
            string estadoDele = EstadoNaArena(l, membro);
            bool retaguarda = estadoDele == "retaguarda";
            double doDono = (membro.Animal != null ? Animais.NaLuta.Retaguarda : Invocacao.Necromante.Retaguarda) * RoomWalk.TileUnits + RoomWalk.TileUnits / 2;
            var heroi = l.Arena.Heroi;
            double? melhor = null;
            double menor = 0;
            foreach (var m in l.Arena.Monstros)
            {
                if (m.Fase == "caido") continue;
                var lugar = LugarDe(l, m.Indice);
                if (retaguarda && (lugar.X - heroi.X) * (lugar.X - heroi.X) + (lugar.Y - heroi.Y) * (lugar.Y - heroi.Y) > doDono * doDono) continue;
                // O estratégico (o animal do Caçador, rodada 7c) só vai em quem entra na área dele.
                if (estadoDele == "estrategico" && !NaGuarda(l, lugar.X, lugar.Y)) continue;
                double distancia = (lugar.X - c.X.Value) * (lugar.X - c.X.Value) + (lugar.Y - c.Y.Value) * (lugar.Y - c.Y.Value);
                if (melhor == null || distancia < menor)
                {
                    melhor = m.Indice;
                    menor = distancia;
                }
            }
            return melhor;
        }

        private static void AndarLacaio(Luta l, CompanheiroNaArena c, double x, double y)
        {
            var r = Rumo(x - c.X.Value, y - c.Y.Value, Invocacao.Necromante.Passo);
            var g = Geometria(l);
            double t = RoomWalk.TileUnits;
            double meia = t / 2;
            double nx = Math.Min(Math.Max(c.X.Value + r.X, t + meia), (g.Cols - 1) * t - meia);
            double ny = Math.Min(Math.Max(c.Y.Value + r.Y, t + meia), (g.Rows - 1) * t - meia);
            if (NaParede(l, nx, ny)) return;
            c.X = nx;
            c.Y = ny;
        }

        /// <summary>TS: agirLacaio — vai atrás do alvo até o alcance e bate no tempo dele (na retaguarda, +10%); sem alvo, volta pro dono.</summary>
        private static void AgirLacaio(Luta l, CompanheiroNaArena c, Companion membro)
        {
            if (c.Tempo > 0) c.Tempo -= 1;
            var alvo = AlvoDoLacaio(l, c, membro);
            bool estrategico = EstadoNaArena(l, membro) == "estrategico";
            if (alvo == null)
            {
                // Sem alvo: volta pra perto do dono (o estratégico, pro meio da área dele).
                double casaX = estrategico && l.Arena.Guarda != null ? l.Arena.Guarda.X : l.Arena.Heroi.X;
                double casaY = estrategico && l.Arena.Guarda != null ? l.Arena.Guarda.Y : l.Arena.Heroi.Y;
                double perto = RoomWalk.TileUnits + RoomWalk.TileUnits / 2;
                double hx = casaX - c.X.Value, hy = casaY - c.Y.Value;
                if (hx * hx + hy * hy > perto * perto) AndarLacaio(l, c, casaX, casaY);
                return;
            }
            var lugar = LugarDe(l, alvo.Value);
            double alcance = AlcanceDoLacaio(membro);
            double dx = lugar.X - c.X.Value, dy = lugar.Y - c.Y.Value;
            if (dx * dx + dy * dy > alcance * alcance)
            {
                AndarLacaio(l, c, lugar.X, lugar.Y);
                return;
            }
            if (c.Tempo > 0) return;
            c.Tempo = D.CadenciaDoCompanheiro;
            var estado = Masmorra(l);
            var acao = Party.PartyMemberAct(estado.Hero, membro, MonstroNo(l, alvo.Value), l.Rng);
            var resultado = acao.Outcome;
            var depois = acao.Monster;
            double dano = resultado.Kind == PartyOutcomeKinds.Miss ? 0 : (resultado.Amount ?? 0);
            if (resultado.Kind != PartyOutcomeKinds.Miss && resultado.Kind != PartyOutcomeKinds.HealedHero && EstadoNaArena(l, membro) == "retaguarda")
            {
                // Na retaguarda o lacaio bate 10% mais forte; o animal do Caçador, 20% (rodada 7c).
                double extra = Math.Truncate(dano * (membro.Animal != null ? Animais.NaLuta.DanoNaRetaguarda : Invocacao.Necromante.DanoNaRetaguarda) / 100);
                dano += extra;
                depois = depois.Clone();
                depois.Hp = acao.Monster.Hp - extra;
            }
            var comHeroi = estado.Clone();
            comHeroi.Hero = acao.Hero;
            var ferida = FerirNaArena(l, comHeroi, alvo.Value, depois);
            if (resultado.Kind == PartyOutcomeKinds.Miss)
            {
                Contar(l, Numero("monstro", alvo.Value, "Errou", "erro"));
                return;
            }
            if (resultado.Kind == PartyOutcomeKinds.HealedHero) return;
            Contar(l, NumeroNoMonstro(ferida, alvo.Value, "-" + Js.NumberToString(dano), "dano"));
            if (ferida.Caiu) Abater(l, alvo.Value, Monsters.View(depois));
            // O estratégico pega todos os outros dentro da área, com o mesmo dano (rodada 7c).
            if (estrategico)
            {
                for (int i = 0; i < l.Arena.Monstros.Count; i++)
                {
                    if (l.Fim != null) return;
                    var m = l.Arena.Monstros[i];
                    if (m.Indice == alvo.Value || m.Fase == "caido") continue;
                    var lugarDele = LugarDe(l, m.Indice);
                    if (!NaGuarda(l, lugarDele.X, lugarDele.Y)) continue;
                    FerirComDano(l, m.Indice, dano, "-" + Js.NumberToString(dano));
                }
            }
        }

        /// <summary>TS: estadoNaArena — o estado do lacaio ou do animal nesta luta: o estratégico sem área marcada fica de retaguarda.</summary>
        private static string EstadoNaArena(Luta l, Companion membro)
        {
            string estado = membro.Animal != null ? Animais.EstadoDoAnimal(membro) : Invocacao.EstadoDoLacaio(membro);
            if (estado == "estrategico" && (membro.Animal == null || l.Arena.Guarda == null)) return "retaguarda";
            return estado;
        }

        /// <summary>TS: naGuarda — o ponto está dentro da área de guarda (4 × 4 casas em volta do meio marcado)?</summary>
        private static bool NaGuarda(Luta l, double x, double y)
        {
            var g = l.Arena.Guarda;
            if (g == null) return false;
            double meia = Animais.NaLuta.LadoDaGuarda * RoomWalk.TileUnits / 2;
            return Math.Abs(x - g.X) <= meia && Math.Abs(y - g.Y) <= meia;
        }

        /// <summary>TS: marcarGuarda — só o Caçador com um animal da equipe no estratégico; dentro do chão da sala.</summary>
        private static void MarcarGuarda(Luta l, PontoNaSala ponto)
        {
            var estado = Masmorra(l);
            if (Catalog.IdDaClasse(estado.Hero.ClassId, estado.Hero.ClassName) != "cacador" || l.Arena.Dupla?.Fantasma == true) return;
            bool algum = false;
            foreach (var membro in estado.Party ?? new List<Companion>())
                if (membro.Animal != null && membro.Hp > 0 && Animais.EstadoDoAnimal(membro) == "estrategico") algum = true;
            if (!algum) return;
            var g = Geometria(l);
            double t = RoomWalk.TileUnits;
            double x = Math.Min(Math.Max(Math.Truncate(ponto.X), t), (g.Cols - 1) * t);
            double y = Math.Min(Math.Max(Math.Truncate(ponto.Y), t), (g.Rows - 1) * t);
            l.Arena.Guarda = new PontoNaSala { X = x, Y = y };
            Contar(l, Aviso("🐾 Área de guarda marcada"));
        }

        /// <summary>TS: invocarLacaio — o Necromante invoca um lacaio: 65% da mana máxima, até 3 de pé, ao lado dele.</summary>
        private static void InvocarLacaio(Luta l, PowerDef poder)
        {
            var estado = Masmorra(l);
            var party = estado.Party ?? new List<Companion>();
            if (Invocacao.EsqueletosDePe(party) >= Invocacao.MaxEsqueletos)
            {
                Contar(l, Aviso("Seus " + Js.NumberToString(Invocacao.MaxEsqueletos) + " lacaios já estão de pé"));
                return;
            }
            double custo = Invocacao.CustoDoLacaio(estado.Hero);
            if (estado.Hero.Mp < custo)
            {
                Contar(l, Aviso("Mana insuficiente para " + poder.Name));
                return;
            }
            var lacaio = Invocacao.CriarLacaio(estado.Hero, party);
            var pago = estado.Hero.Clone();
            pago.Mp = estado.Hero.Mp - custo;
            var treino = Treino.TreinarPoder(pago, poder.Id, poder.Type);
            if (treino.Subiu.HasValue)
            {
                Diario(l, new[] { Treino.TextoDaHabilidade(poder.Name, treino.Subiu.Value) });
                Contar(l, Aviso("⭐ " + poder.Name + " nível " + Js.NumberToString(treino.Subiu.Value)));
            }
            var novaEquipe = new List<Companion>(party) { lacaio };
            var comLacaio = estado.Clone();
            comLacaio.Hero = treino.Hero;
            comLacaio.Party = novaEquipe;
            l.Estado = comLacaio;
            l.Arena.RecargaDosPoderes.Set(poder.Id, D.RecargaDoPoder);
            int comCorpo = 0;
            foreach (var c in l.Arena.Companheiros)
                if (c.X != null) comCorpo++;
            var lugar = LugarAoLado(l.Arena.Heroi.X, l.Arena.Heroi.Y, comCorpo, Geometria(l), ArteDaSala.ParedesDaSala(estado.Masmorra.Dungeon));
            l.Arena.Companheiros.Add(new CompanheiroNaArena { Indice = novaEquipe.Count - 1, Tempo = D.CadenciaDoCompanheiro / 2, X = lugar.X, Y = lugar.Y });
            Contar(l, Aviso(poder.Icon + " " + lacaio.Name + " se ergue"));
        }

        /// <summary>TS: usarMagia — a Magia Proibida: com 90% de vida e de mana, levanta o parceiro caído com 50%.</summary>
        private static void UsarMagia(Luta l)
        {
            var r = Invocacao.Necromante;
            var hero = Masmorra(l).Hero;
            if (Catalog.IdDaClasse(hero.ClassId, hero.ClassName) != "necromante" || (l.Arena.RecargaDaMagia ?? 0) > 0) return;
            if (hero.BloqueioDaMagia != null)
            {
                Contar(l, Aviso("A Magia Proibida está selada até zerar a masmorra"));
                return;
            }
            if (l.Arena.Dupla?.ParceiroCaido != true)
            {
                Contar(l, Aviso("Ninguém caído pra levantar"));
                return;
            }
            if (hero.Hp * 100 < hero.MaxHp * r.RequisitoDaMagia || hero.Mp * 100 < hero.MaxMp * r.RequisitoDaMagia)
            {
                Contar(l, Aviso("A Magia Proibida pede 90% de vida e de mana"));
                return;
            }
            l.Arena.RecargaDaMagia = r.RecargaDaMagia;
            l.ReviverParceiro = r.LevantaCom;
            const string texto = "☠️ Magia Proibida: seu parceiro se levanta!";
            Contar(l, Aviso(texto));
            Diario(l, new[] { texto });
        }

        // ---------- segurar K, o revestimento e a explosão de ki (rodada 4a) ----------

        /// <summary>TS: canalizar — segurando K, parado e sem atacar: o Mago e o Necromante puxam mana, o Monge junta ki.</summary>
        private static void Canalizar(Luta l, EntradaDaLuta entrada)
        {
            var arena = l.Arena;
            var hero = Masmorra(l).Hero;
            string tipo = ClassesDeLuta.OQueCanaliza(hero);
            bool parado = Math.Truncate(entrada.X) == 0 && Math.Truncate(entrada.Y) == 0;
            bool agiu = entrada.Atacar == true || Js.Truthy(entrada.Poder) || Js.Truthy(entrada.Item) || entrada.Fe == true || entrada.Revestir == true || entrada.Explodir == true || entrada.Chapeu == true;
            if (tipo == null || entrada.Canalizar != true || !parado || agiu || arena.Evento != null || arena.Dupla?.Fantasma == true)
            {
                arena.Canal = null;
                arena.Canalizando = null;
                return;
            }
            arena.Canalizando = true;
            double canal = (arena.Canal ?? 0) + 1;
            if (canal < ClassesDeLuta.PassosDoCanal(hero))
            {
                arena.Canal = canal;
                return;
            }
            arena.Canal = null;
            if (tipo == "ki") arena.Ki = Js.Min(CD.Monge.TetoDoKi, (arena.Ki ?? 0) + 1);
            else if (hero.Mp < hero.MaxMp)
            {
                var comMana = Masmorra(l).Clone();
                comMana.Hero = hero.Clone();
                comMana.Hero.Mp = hero.Mp + 1;
                l.Estado = comMana;
            }
        }

        // ---------- os estilos de luta (rodada 5a: Espadachim, Cavaleiro, Empurrão, Dash/chute, Concentração) ----------

        /// <summary>TS: avancoPronto — o Espadachim tem o avanço pronto (a recarga passou).</summary>
        private static bool AvancoPronto(Luta l) =>
            Estilos.IdDoEstilo(Masmorra(l).Hero) == "espadachim" && !((Contadores(l).RecargaDoEstilo ?? 0) > 0);

        /// <summary>TS: passarOsEstilos — a espera do avanço e a imunidade do Espadachim correm; a Concentração junta cargas sem golpear.</summary>
        private static void PassarOsEstilos(Luta l)
        {
            // A escuridão do Mago dura o tempo dela (rodada 5c).
            if (l.Arena.Escuridao != null)
            {
                if (l.Arena.Escuridao.Tempo > 1)
                {
                    var e = l.Arena.Escuridao.Clone();
                    e.Tempo -= 1;
                    l.Arena.Escuridao = e;
                }
                else l.Arena.Escuridao = null;
            }
            if ((Contadores(l).Ventania ?? 0) > 0)
            {
                var v = Contadores(l).Clone();
                v.Ventania = v.Ventania.Value > 1 ? v.Ventania.Value - 1 : (double?)null;
                l.Arena.Classe = v;
            }
            string estilo = Estilos.IdDoEstilo(Masmorra(l).Hero);
            if (estilo != "espadachim" && estilo != "concentracao") return;
            var c = Contadores(l).Clone();
            if (estilo == "espadachim")
            {
                if (c.RecargaDoEstilo == null && c.Imune == null) return;
                if (c.RecargaDoEstilo != null) c.RecargaDoEstilo = c.RecargaDoEstilo.Value > 1 ? c.RecargaDoEstilo.Value - 1 : (double?)null;
                if (c.Imune != null) c.Imune = c.Imune.Value > 1 ? c.Imune.Value - 1 : (double?)null;
            }
            else
            {
                var r = Estilos.Concentracao;
                double semGolpe = (c.SemGolpe ?? 0) + 1;
                if (semGolpe >= ClassesDeLuta.PassosPorCargaDaConcentracao(Masmorra(l).Hero))
                {
                    c.SemGolpe = 0;
                    c.Cargas = Js.Min(r.TetoDeCargas, (c.Cargas ?? 0) + 1);
                }
                else c.SemGolpe = semGolpe;
            }
            l.Arena.Classe = c;
        }

        /// <summary>TS: empurraoEmVolta — quem está a 1 bloco do alvo leva o mesmo dano; e cada um (o alvo também) pode ser empurrado e atordoado.</summary>
        private static void EmpurraoEmVolta(Luta l, double alvo, double dano)
        {
            var r = Estilos.Empurrao;
            var centro = LugarDe(l, alvo);
            double raio = r.Raio * RoomWalk.TileUnits + RoomWalk.TileUnits / 2;
            var pegos = new List<MonstroNaArena> { l.Arena.Monstros[(int)alvo] };
            // Por índice, como o for...of do JS (o lacaio que entra no meio também é visto).
            for (int i = 0; i < l.Arena.Monstros.Count; i++)
            {
                var m = l.Arena.Monstros[i];
                if (l.Fim != null) return;
                if (m.Indice == alvo || m.Fase == "caido") continue;
                double dx = m.CorpoX - centro.X;
                double dy = m.CorpoY - centro.Y;
                if (dx * dx + dy * dy > raio * raio) continue;
                pegos.Add(m);
                FerirComDano(l, m.Indice, dano, "-" + Js.NumberToString(dano));
            }
            double hx = l.Arena.Heroi.X, hy = l.Arena.Heroi.Y;
            foreach (var m in pegos)
            {
                if (l.Fim != null) return;
                if (m.Fase == "caido" || l.Rng() * 100 >= r.Chance) continue;
                Empurrar(l, m, hx, hy, ClassesDeLuta.EmpurraoDoEmpurrao(Masmorra(l).Hero));
                Atordoar(l, m);
            }
        }

        /// <summary>
        /// TS: corteInvernal — o Corte Invernal do Espadachim: com 300 de ki, uma faixa de 3 casas de largura que anda 6
        /// blocos rumo ao alvo (ou pra onde ele olha) e acerta todo mundo nela; o mais perto leva o golpe a 80%, os
        /// outros o mesmo dano.
        /// </summary>
        private static void CorteInvernal(Luta l)
        {
            var r = Estilos.Espadachim;
            var hero = Masmorra(l).Hero;
            if (Estilos.IdDoEstilo(hero) != "espadachim" || (l.Arena.Ki ?? 0) < r.Corte) return;
            double sobra = (l.Arena.Ki ?? 0) - r.Corte;
            l.Arena.Ki = sobra > 0 ? sobra : (double?)null;
            l.Arena.Recarga = D.RecargaDoAtaque;
            Contar(l, Aviso("❄️ Corte Invernal"));
            double hx = l.Arena.Heroi.X, hy = l.Arena.Heroi.Y;
            double? alvo = AlvoAtual(l);
            double rx, ry;
            if (alvo != null)
            {
                var lugar = LugarDe(l, alvo.Value);
                rx = lugar.X - hx;
                ry = lugar.Y - hy;
            }
            else
            {
                switch (l.Arena.Heroi.Facing ?? "S")
                {
                    case "N": rx = 0; ry = -1; break;
                    case "E": rx = 1; ry = 0; break;
                    case "W": rx = -1; ry = 0; break;
                    default: rx = 0; ry = 1; break;
                }
            }
            double comprimento = Math.Sqrt(rx * rx + ry * ry);
            if (comprimento == 0) return;
            double alcance = r.AlcanceDoCorte * RoomWalk.TileUnits + RoomWalk.TileUnits / 2;
            double meiaLargura = r.LarguraDoCorte * RoomWalk.TileUnits / 2;
            var pegos = new List<(MonstroNaArena M, double Ao)>();
            foreach (var m in l.Arena.Monstros)
            {
                if (m.Fase == "caido") continue;
                var lugar = LugarDe(l, m.Indice);
                double px = lugar.X - hx;
                double py = lugar.Y - hy;
                double ao = (px * rx + py * ry) / comprimento;
                double fora = Math.Abs(px * ry - py * rx) / comprimento;
                if (ao >= 0 && ao <= alcance && fora <= meiaLargura) pegos.Add((m, ao));
            }
            if (pegos.Count == 0) return;
            pegos.Sort((a, b) => a.Ao != b.Ao ? a.Ao.CompareTo(b.Ao) : a.M.Indice.CompareTo(b.M.Indice));
            double dado = 1 + Rng.RandomInt(Attack.LadosDoDano, l.Rng);
            var leitura = new LeituraDaMira { Acerto = true, Forca = r.ForcaDoCorte / 100, Critico = false };
            var acerto = AcertarMonstro(l, pegos[0].M, dado, leitura, EstiloDoBotao(hero));
            if (acerto == null || l.Fim != null) return;
            for (int k = 1; k < pegos.Count; k++)
            {
                if (l.Fim != null) return;
                var m = pegos[k].M;
                if (m.Fase != "caido") FerirComDano(l, m.Indice, acerto.Value, "❄️-" + Js.NumberToString(acerto.Value));
            }
        }

        // ---------- os estilos do Druida (rodada 5b: Metamorfose, Florescimento, Raízes Ocultas) ----------

        /// <summary>TS: contarGolpeDoDruida — o Druida com estilo deu mais um ataque nesta luta. O número deste.</summary>
        private static double ContarGolpeDoEstilo(Luta l, string estilo)
        {
            double golpes = (Contadores(l).Golpes ?? 0) + 1;
            var c = Contadores(l).Clone();
            c.Golpes = golpes;
            l.Arena.Classe = c;
            if (estilo == "metamorfose" && golpes == Estilos.Metamorfose.GolpesDaAura) Contar(l, Aviso("🐾 Aura de fera!"));
            if (estilo == "raizes" && golpes == Estilos.Raizes.GolpesDoVeneno) Contar(l, Aviso("🌱 Raízes fundas!"));
            if (estilo == "terra" && golpes == Estilos.Terra.GolpesDaPedra) Contar(l, Aviso("🪨 Revestimento de pedra!"));
            if (estilo == "arcano" && golpes == Estilos.Arcano.GolpesDoArcano) Contar(l, Aviso("✨ O arcano desperta!"));
            if (estilo == "escuridao" && golpes == Estilos.Escuridao.GolpesDaFome) Contar(l, Aviso("🌑 A escuridão tem fome!"));
            return golpes;
        }

        /// <summary>TS: prender — as Raízes prendem o monstro de pé (o chefe não). No espelho, não.</summary>
        private static void Prender(Luta l, MonstroNaArena m, double? passos = null, string texto = "🌱 Preso")
        {
            if (NoEspelho(l) || m.Fase == "caido" || MonstroNo(l, m.Indice).IsBoss) return;
            m.Preso = passos ?? Estilos.Raizes.Preso;
            Contar(l, Numero("monstro", m.Indice, texto, "erro"));
        }

        // ---------- domar (rodada 7b): o Caçador oferece a comida preferida do bicho ----------

        /// <summary>
        /// TS: alimentar — o Caçador oferece a comida ao monstro: o bicho se doma, não recusou 6 vezes, cabe mais um
        /// animal, está a até 3 blocos, abaixo de 25% da vida, e a comida dele está na mochila (cada oferta gasta uma).
        /// Metade das vezes aceita (2 vezes doma); recusou, ataca na hora. No espelho, não.
        /// </summary>
        private static void Alimentar(Luta l, double indice)
        {
            var r = Animais.Regras;
            var estado = Masmorra(l);
            var m = MonstroDaArena(l, indice);
            if (Catalog.IdDaClasse(estado.Hero.ClassId, estado.Hero.ClassName) != "cacador" || m == null || m.Fase == "caido" || NoEspelho(l) || l.Arena.Recarga > 0) return;
            var monstro = MonstroNo(l, indice);
            string nome = Js.Str(monstro.Name);
            string comida = Animais.ComidaPreferida(monstro.SpeciesId);
            if (comida == null || monstro.IsBoss) { Contar(l, Aviso(nome + " não se deixa domar")); return; }
            if ((m.Recusou ?? 0) >= r.Recusas) { Contar(l, Aviso(nome + " não aceita mais comida")); return; }
            if (Animais.Quantos(estado.Hero, estado.Party) >= r.Maximo) { Contar(l, Aviso("Você já tem " + Js.NumberToString(r.Maximo) + " animais")); return; }
            var lugar = LugarDe(l, indice);
            double dx = l.Arena.Heroi.X - lugar.X;
            double dy = l.Arena.Heroi.Y - lugar.Y;
            double limite = r.Distancia * RoomWalk.TileUnits + RoomWalk.TileUnits / 2;
            if (dx * dx + dy * dy > limite * limite) { Contar(l, Aviso("Chegue mais perto")); return; }
            if (monstro.Hp * 100 >= monstro.MaxHp * r.Vida) { Contar(l, Aviso(nome + " ainda está forte demais")); return; }
            var pedaco = estado.Inventory.Find(item => item.TemplateId == comida);
            if (pedaco == null) { Contar(l, Aviso("Falta " + (ItemTemplates.ById(comida)?.Name ?? comida).ToLowerInvariant())); return; }
            var semPedaco = estado.Clone();
            semPedaco.Inventory = Inventory.RemoveByUid(estado.Inventory, pedaco.Uid).Inventory;
            l.Estado = semPedaco;
            l.Arena.Recarga = D.RecargaDoAtaque;
            if (l.Rng() * 100 < r.Chance)
            {
                m.Aceitou = (m.Aceitou ?? 0) + 1;
                Contar(l, Numero("monstro", indice, "🍖", "cura"));
                if (m.Aceitou.Value >= r.Aceites) Domar(l, indice);
                else Contar(l, Aviso("🍖 " + nome + " aceitou (" + Js.NumberToString(m.Aceitou.Value) + "/" + Js.NumberToString(r.Aceites) + ")"));
                return;
            }
            m.Recusou = (m.Recusou ?? 0) + 1;
            Contar(l, Aviso(m.Recusou.Value >= r.Recusas ? "🚫 " + nome + " recusou de vez" : nome + " recusou (" + Js.NumberToString(m.Recusou.Value) + "/" + Js.NumberToString(r.Recusas) + ")"));
            // Recusou: ataca na hora (o que já está no golpe, atordoado ou preso segue como está).
            if (m.Fase == "esperando" || m.Fase == "descansando" || m.Fase == "hesitando") ComecarGolpe(l, m);
        }

        /// <summary>TS: domar — aceitou 2 vezes: o bicho vira o animal do Caçador e sai da luta (sem o XP e o ouro dele); era o último, a sala está vencida.</summary>
        private static void Domar(Luta l, double indice)
        {
            var estado = Masmorra(l);
            var visto = MonstroNo(l, indice);
            var saiu = MonstroNo(l, indice);
            saiu.Hp = 0;
            var bruto = CombatMonster.From(Sala(l).Monsters[(int)indice]);
            double agora = (l.Now ?? Js.DateNow)();
            string id = "animal_" + Js.NumberToString(Math.Truncate(agora)) + "_" + Js.NumberToString(Rng.RandomInt(100000, l.Rng));
            var m = l.Arena.Monstros[(int)indice];
            m.Fase = "caido";
            m.Domado = true;
            m.Poder = null;
            bruto.Hp = 0;
            bruto.Domado = true;
            l.Estado = FimDaLuta.GravarMonstro(estado, indice, bruto);
            l.Domou = id;
            Contar(l, Aviso("🐾 Você domou " + Js.Str(visto.Name) + "!"));
            if (indice == l.Arena.Alvo) l.Arena.Escolhido = null;
            SeguirOuVencer(l, saiu);
            // Entra na equipe depois: a vitória desta luta (se foi a última) não conta pra ele, que não lutou nela.
            l.Estado = Animais.Juntar(Masmorra(l), Animais.Domado(visto.SpeciesId, visto.MaxHp, visto.Dmg, id));
        }

        // ---------- as armas novas (rodada 6c: a kusarigama, a lança e o chapéu) ----------

        /// <summary>TS: areaDaKusarigama — quem está na área de 3 casas de largura e 2 de fundo no alvo leva o mesmo dano.</summary>
        private static void AreaDaKusarigama(Luta l, double alvo, double dano)
        {
            var r = PecasSecretas.RegrasDasArmasNovas;
            double hx = l.Arena.Heroi.X, hy = l.Arena.Heroi.Y;
            var centro = LugarDe(l, alvo);
            double dx = centro.X - hx;
            double dy = centro.Y - hy;
            double comprimento = Math.Sqrt(dx * dx + dy * dy);
            if (comprimento == 0) return;
            double meiaLargura = r.LarguraDaKusarigama * RoomWalk.TileUnits / 2;
            double fundo = r.FundoDaKusarigama * RoomWalk.TileUnits - RoomWalk.TileUnits / 2;
            var pegos = new List<MonstroNaArena>();
            foreach (var m in l.Arena.Monstros)
            {
                if (m.Indice == alvo || m.Fase == "caido") continue;
                var lugar = LugarDe(l, m.Indice);
                double px = lugar.X - centro.X;
                double py = lugar.Y - centro.Y;
                double ao = (px * dx + py * dy) / comprimento;
                double fora = Math.Abs(px * dy - py * dx) / comprimento;
                if (ao >= -RoomWalk.TileUnits / 2 && ao <= fundo && fora <= meiaLargura) pegos.Add(m);
            }
            foreach (var m in pegos)
            {
                if (l.Fim != null) return;
                if (m.Fase != "caido") FerirComDano(l, m.Indice, dano, "⛓️-" + Js.NumberToString(dano));
            }
        }

        /// <summary>TS: sortearLanca — o próximo golpe tem 10% de sair com a faixa do crítico maior (a deste já valeu).</summary>
        private static void SortearLanca(Luta l)
        {
            if (!ClassesDeLuta.LancaNaMao(Masmorra(l).Hero)) return;
            var c = Contadores(l).Clone();
            c.CriticoMaior = null;
            bool proximo = l.Rng() * 100 < PecasSecretas.RegrasDasArmasNovas.ChanceDaLanca;
            if (proximo) c.CriticoMaior = true;
            l.Arena.Classe = c;
            if (proximo) Contar(l, Aviso("🔱 Crítico maior no próximo golpe"));
        }

        /// <summary>
        /// TS: lancarChapeu — o chapéu sai da mão: gasta o ki, começa a espera e voa rumo ao cursor (no PC); sem cursor,
        /// ao alvo de agora; sem alvo, pra onde o herói olha.
        /// </summary>
        private static void LancarChapeu(Luta l, EntradaDaLuta entrada)
        {
            var r = PecasSecretas.RegrasDasArmasNovas;
            var hero = Masmorra(l).Hero;
            if (!ClassesDeLuta.PodeLancarChapeu(hero) || l.Arena.Chapeu != null || (l.Arena.RecargaDoChapeu ?? 0) > 0 || (l.Arena.Ki ?? 0) < r.KiDoChapeu) return;
            var heroi = l.Arena.Heroi;
            double? alvo = AlvoAtual(l);
            double parX, parY;
            if (entrada.Cursor != null)
            {
                parX = entrada.Cursor.X - heroi.X;
                parY = entrada.Cursor.Y - heroi.Y;
            }
            else if (alvo != null)
            {
                var lugar = LugarDe(l, alvo.Value);
                parX = lugar.X - heroi.X;
                parY = lugar.Y - heroi.Y;
            }
            else
            {
                switch (heroi.Facing ?? "S")
                {
                    case "N": parX = 0; parY = -1; break;
                    case "E": parX = 1; parY = 0; break;
                    case "W": parX = -1; parY = 0; break;
                    default: parX = 0; parY = 1; break;
                }
            }
            var v = Rumo(parX, parY, r.VelocidadeDoChapeu);
            double sobra = (l.Arena.Ki ?? 0) - r.KiDoChapeu;
            l.Arena.Ki = sobra > 0 ? sobra : (double?)null;
            l.Arena.RecargaDoChapeu = r.RecargaDoChapeu;
            l.Arena.Chapeu = new ChapeuNaSala { X = heroi.X, Y = heroi.Y, Vx = v.X, Vy = v.Y, Vida = r.VidaDoChapeu };
            Contar(l, Aviso("🎩 Chapéu!"));
        }

        /// <summary>
        /// TS: moverChapeu — um passo do chapéu: na ida, em linha reta até bater na parede (ou no fim do voo), e aí volta
        /// rumo ao herói até a mão dele. Quem ele encosta (uma vez na ida e outra na volta) leva o golpe a 40%.
        /// </summary>
        private static void MoverChapeu(Luta l)
        {
            var c = l.Arena.Chapeu;
            if (c == null) return;
            var r = PecasSecretas.RegrasDasArmasNovas;
            var heroi = l.Arena.Heroi;
            double vx = c.Vx, vy = c.Vy;
            if (c.Voltando == true)
            {
                double dx = heroi.X - c.X;
                double dy = heroi.Y - c.Y;
                if (dx * dx + dy * dy <= r.VelocidadeDoChapeu * r.VelocidadeDoChapeu || c.Vida <= 1)
                {
                    l.Arena.Chapeu = null;
                    return;
                }
                var v = Rumo(dx, dy, r.VelocidadeDoChapeu);
                vx = v.X;
                vy = v.Y;
            }
            double x = c.X + vx;
            double y = c.Y + vy;
            if (c.Voltando != true && (c.Vida <= 1 || ForaDoChao(l, x, y) || NaParede(l, x, y)))
            {
                var volta = c.Clone();
                volta.Voltando = true;
                volta.Pegos = new List<double>();
                volta.Vida = c.Vida - 1;
                l.Arena.Chapeu = volta;
                return;
            }
            var chapeu = c.Clone();
            chapeu.X = x;
            chapeu.Y = y;
            chapeu.Vx = vx;
            chapeu.Vy = vy;
            chapeu.Vida = c.Vida - 1;
            l.Arena.Chapeu = chapeu;
            var hero = Masmorra(l).Hero;
            for (int i = 0; i < l.Arena.Monstros.Count; i++)
            {
                if (l.Fim != null) return;
                var m = l.Arena.Monstros[i];
                if (m.Fase == "caido" || chapeu.Pegos.Contains(m.Indice)) continue;
                double mx = m.CorpoX - x;
                double my = m.CorpoY - y;
                if (mx * mx + my * my > r.RaioDoChapeu * r.RaioDoChapeu) continue;
                chapeu.Pegos.Add(m.Indice);
                if (chapeu.Dano != null)
                {
                    FerirComDano(l, m.Indice, chapeu.Dano.Value, "🎩-" + Js.NumberToString(chapeu.Dano.Value));
                    continue;
                }
                double dado = 1 + Rng.RandomInt(Attack.LadosDoDano, l.Rng);
                var acerto = AcertarMonstro(l, m, dado, new LeituraDaMira { Acerto = true, Forca = r.ForcaDoChapeu / 100, Critico = false }, EstiloDoBotao(hero));
                if (acerto != null) chapeu.Dano = acerto.Value;
            }
        }

        // ---------- as aljavas do Arqueiro (rodada 6b: paralisante, flamejante, explosiva) ----------

        /// <summary>
        /// TS: flechaComAljava — a flecha com a aljava ao lado do arco acertou: conta a flechada e faz o efeito da
        /// aljava. O que mexe no monstro é do anfitrião, como sempre; o dano da explosão, não.
        /// </summary>
        private static void FlechaComAljava(Luta l, double indice, double dano)
        {
            var aljava = PecasSecretas.AljavaNoArco(Masmorra(l).Hero);
            if (aljava == null) return;
            var r = PecasSecretas.RegrasDasAljavas;
            double flechada = (Contadores(l).Flechadas ?? 0) + 1;
            var c = Contadores(l).Clone();
            c.Flechadas = flechada;
            l.Arena.Classe = c;
            var alvo = l.Arena.Monstros[(int)indice];
            switch (aljava)
            {
                case "aljava_paralisante":
                    if (alvo.Fase == "caido" || NoEspelho(l)) return;
                    if (alvo.Encurtado != true)
                    {
                        alvo.Encurtado = true;
                        Contar(l, Numero("monstro", indice, "🕸️", "erro"));
                    }
                    if (ClassesDeLuta.ACadaGolpe(flechada, r.ParalisiaACada) && !MonstroNo(l, indice).IsBoss)
                    {
                        Contar(l, Aviso("🕸️ Paralisia"));
                        Atordoar(l, alvo, r.Paralisia);
                    }
                    return;
                case "aljava_flamejante":
                    if (alvo.Fase == "caido" || NoEspelho(l)) return;
                    if ((alvo.Fraco ?? 0) == 0) Contar(l, Numero("monstro", indice, "Fraco", "erro"));
                    alvo.Fraco = r.GolpesFracos;
                    if (ClassesDeLuta.ACadaGolpe(flechada, r.IncendioACada)) Incendiar(l, alvo, dano);
                    return;
                case "aljava_explosiva":
                    ExplodirFlecha(l, indice, dano, ClassesDeLuta.ACadaGolpe(flechada, r.CadeiaACada));
                    return;
            }
        }

        /// <summary>TS: incendiar — o monstro fica incendiado 10 s, levando metade do dano da flechada a cada segundo (o novo fica com o dano maior).</summary>
        private static void Incendiar(Luta l, MonstroNaArena m, double dano)
        {
            var r = PecasSecretas.RegrasDasAljavas;
            double porSegundo = Js.Max(1, Math.Truncate(dano * r.IncendioPorSegundo / 100));
            m.Incendio = new IncendioNaArena { Tempo = r.Incendio, Dano = Js.Max(porSegundo, m.Incendio?.Dano ?? 0) };
            Contar(l, Aviso("🔥 Incêndio"));
        }

        /// <summary>
        /// TS: explodirFlecha — o monstro explode, e quem está de pé a até 2 blocos leva o mesmo dano (direto na vida)
        /// e é empurrado 1 bloco. Em cadeia, quem a explosão pega também explode, mesmo caindo: cada um explode uma vez
        /// só e leva no máximo 2 estouros (o alvo da flecha já conta um).
        /// </summary>
        private static void ExplodirFlecha(Luta l, double origem, double dano, bool emCadeia)
        {
            var r = PecasSecretas.RegrasDasAljavas;
            double raio = r.RaioDaExplosao * RoomWalk.TileUnits + RoomWalk.TileUnits / 2;
            var estouros = new Dictionary<double, double> { [origem] = 1 };
            var naFila = new HashSet<double> { origem };
            var fila = new List<double> { origem };
            if (emCadeia) Contar(l, Aviso("💥 Explosão em cadeia"));
            for (int k = 0; k < fila.Count; k++)
            {
                if (l.Fim != null) return;
                double quem = fila[k];
                var centro = LugarDe(l, quem);
                Contar(l, Numero("monstro", quem, "💥", "erro"));
                var pegos = new List<MonstroNaArena>();
                foreach (var m in l.Arena.Monstros)
                {
                    if (m.Indice == quem || m.Fase == "caido" || (estouros.TryGetValue(m.Indice, out var ja) ? ja : 0) >= r.EstourosPorInimigo) continue;
                    double dx = m.CorpoX - centro.X;
                    double dy = m.CorpoY - centro.Y;
                    if (dx * dx + dy * dy <= raio * raio) pegos.Add(m);
                }
                foreach (var m in pegos)
                {
                    if (l.Fim != null) return;
                    if (m.Fase == "caido") continue;
                    estouros[m.Indice] = (estouros.TryGetValue(m.Indice, out var antes) ? antes : 0) + 1;
                    if (!FerirComDano(l, m.Indice, dano, "💥-" + Js.NumberToString(dano))) Empurrar(l, m, centro.X, centro.Y, r.EmpurraoDaExplosao);
                    if (emCadeia && !naFila.Contains(m.Indice))
                    {
                        naFila.Add(m.Indice);
                        fila.Add(m.Indice);
                    }
                }
            }
        }

        // ---------- os elementos do Mago (rodada 5c: Fogo, Terra, Vento, Água, Arcano, Escuridão) ----------

        /// <summary>TS: elementoNoGolpe — o disparo do Mago com elemento acertou: o que o elemento faz depois do dano.</summary>
        private static void ElementoNoGolpe(Luta l, double indice, double dano, double golpe, string estilo)
        {
            var alvo = l.Arena.Monstros[(int)indice];
            switch (estilo)
            {
                case "fogo":
                {
                    var r = Estilos.Fogo;
                    if (ClassesDeLuta.ACadaGolpe(golpe, r.BolaACada)) BolaDeFogo(l, indice);
                    else Queimar(l, alvo, r.Turnos);
                    return;
                }
                case "vento":
                {
                    var r = Estilos.Vento;
                    var c = Contadores(l).Clone();
                    c.Ventania = r.Ventania;
                    l.Arena.Classe = c;
                    if (alvo.Fase == "caido") return;
                    if (!NoEspelho(l)) alvo.Encurtado = true;
                    Contar(l, Numero("monstro", indice, "🌀", "erro"));
                    if (ClassesDeLuta.ACadaGolpe(golpe, r.EmpurraACada) && EmpurrarComBatida(l, alvo, l.Arena.Heroi.X, l.Arena.Heroi.Y, r.Empurrao) && !MonstroNo(l, indice).IsBoss)
                        Atordoar(l, alvo, r.Atordoa);
                    return;
                }
                case "agua":
                    JatoDagua(l, indice, dano);
                    if (l.Fim == null && ClassesDeLuta.ACadaGolpe(golpe, Estilos.Agua.RedemoinhoACada)) Redemoinho(l, indice);
                    return;
                case "arcano":
                {
                    var r = Estilos.Arcano;
                    if (alvo.Fase == "caido") return;
                    LentoNoMonstro(l, indice, r.Lento);
                    if (ClassesDeLuta.ACadaGolpe(golpe, r.GrilhoesACada)) Prender(l, alvo, r.Preso, "⛓️ Preso");
                    return;
                }
                case "escuridao":
                {
                    var r = Estilos.Escuridao;
                    if (ClassesDeLuta.ACadaGolpe(golpe, r.AreaACada))
                    {
                        var lugar = LugarDe(l, indice);
                        l.Arena.Escuridao = new EscuridaoNaSala { X = Math.Truncate(lugar.X), Y = Math.Truncate(lugar.Y), Tempo = r.Duracao };
                        Contar(l, Aviso("🌑 Escuridão"));
                    }
                    if (golpe >= r.GolpesDaFome && alvo.Fase != "caido") Engolir(l, indice);
                    return;
                }
            }
        }

        /// <summary>TS: queimar — o monstro de pé queima tantos turnos (5% da vida máxima dele), sem encurtar a queimadura que já tinha.</summary>
        private static void Queimar(Luta l, MonstroNaArena m, double turnos)
        {
            if (NoEspelho(l) || m.Fase == "caido") return;
            var monstro = CombatMonster.From(Sala(l).Monsters[(int)m.Indice]);
            double dmg = Js.Max(1, Math.Truncate(monstro.MaxHp * Estilos.Fogo.Queimadura / 100));
            var antes = monstro.Status?.Queimadura;
            var status = monstro.Status?.Clone() ?? new MonsterStatus();
            status.Queimadura = new DotStatus { Turns = Js.Max(turnos, antes?.Turns ?? 0), Dmg = Js.Max(dmg, antes?.Dmg ?? 0) };
            monstro.Status = status;
            l.Estado = FimDaLuta.GravarMonstro(Masmorra(l), m.Indice, monstro);
            Contar(l, Numero("monstro", m.Indice, "🔥", "erro"));
        }

        /// <summary>TS: bolaDeFogo — queima todos de pé no 3 × 3 em volta do alvo (ele também) por 2 turnos.</summary>
        private static void BolaDeFogo(Luta l, double alvo)
        {
            var r = Estilos.Fogo;
            var centro = LugarDe(l, alvo);
            double meio = r.LadoDaBola * RoomWalk.TileUnits / 2;
            Contar(l, Aviso("🔥 Bola de fogo"));
            for (int i = 0; i < l.Arena.Monstros.Count; i++)
            {
                var m = l.Arena.Monstros[i];
                if (m.Fase == "caido") continue;
                var lugar = LugarDe(l, m.Indice);
                if (Math.Abs(lugar.X - centro.X) <= meio && Math.Abs(lugar.Y - centro.Y) <= meio) Queimar(l, m, r.TurnosDaBola);
            }
        }

        /// <summary>TS: lentoNoMonstro — o monstro fica tanto (%) mais lento por 2 turnos (o Arcano). No espelho, não.</summary>
        private static void LentoNoMonstro(Luta l, double indice, double pct)
        {
            if (NoEspelho(l)) return;
            var monstro = CombatMonster.From(Sala(l).Monsters[(int)indice]);
            var status = monstro.Status?.Clone() ?? new MonsterStatus();
            status.Lento = new AmountStatus { Turns = CD.Druida.Turnos, Amount = pct / 100 };
            monstro.Status = status;
            l.Estado = FimDaLuta.GravarMonstro(Masmorra(l), indice, monstro);
        }

        /// <summary>TS: empurrarComBatida — o empurrão do Vento, que diz se bateu em algo (a parede de volta, uma de dentro, outro monstro).</summary>
        private static bool EmpurrarComBatida(Luta l, MonstroNaArena m, double deX, double deY, double blocos)
        {
            if (NoEspelho(l) || m.Fase == "caido" || m.Fase == "avisando" || m.Fase == "investindo") return false;
            var r = Rumo(m.CorpoX - deX, m.CorpoY - deY, blocos * RoomWalk.TileUnits);
            var formato = Geometria(l);
            double meia = RoomWalk.TileUnits / 2;
            double alvoX = m.CorpoX + r.X;
            double alvoY = m.CorpoY + r.Y;
            double x = Math.Min(Math.Max(alvoX, RoomWalk.TileUnits + meia), (formato.Cols - 1) * RoomWalk.TileUnits - meia);
            double y = Math.Min(Math.Max(alvoY, RoomWalk.TileUnits + meia), (formato.Rows - 1) * RoomWalk.TileUnits - meia);
            bool noOutro = false;
            foreach (var o in l.Arena.Monstros)
                if (o.Indice != m.Indice && o.Fase != "caido" && (o.CorpoX - x) * (o.CorpoX - x) + (o.CorpoY - y) * (o.CorpoY - y) < D.EspacoEntreMonstros * D.EspacoEntreMonstros)
                    noOutro = true;
            if (NaParede(l, x, y) || noOutro) return true;
            m.CorpoX = x;
            m.CorpoY = y;
            return x != alvoX || y != alvoY;
        }

        /// <summary>TS: jatoDagua — quem está na linha do Mago ao alvo (1 casa de largura, até o alvo) leva o mesmo dano.</summary>
        private static void JatoDagua(Luta l, double alvo, double dano)
        {
            double hx = l.Arena.Heroi.X, hy = l.Arena.Heroi.Y;
            var fim = LugarDe(l, alvo);
            double dx = fim.X - hx;
            double dy = fim.Y - hy;
            double comprimento = Math.Sqrt(dx * dx + dy * dy);
            if (comprimento == 0) return;
            double meiaLargura = Estilos.Agua.Largura * RoomWalk.TileUnits / 2;
            var pegos = new List<MonstroNaArena>();
            foreach (var m in l.Arena.Monstros)
            {
                if (m.Indice == alvo || m.Fase == "caido") continue;
                var lugar = LugarDe(l, m.Indice);
                double px = lugar.X - hx;
                double py = lugar.Y - hy;
                double ao = (px * dx + py * dy) / comprimento;
                double fora = Math.Abs(px * dy - py * dx) / comprimento;
                if (ao >= 0 && ao <= comprimento && fora <= meiaLargura) pegos.Add(m);
            }
            foreach (var m in pegos)
            {
                if (l.Fim != null) return;
                if (m.Fase != "caido") FerirComDano(l, m.Indice, dano, "💧-" + Js.NumberToString(dano));
            }
        }

        /// <summary>TS: redemoinho — puxa quem está a até 5 blocos do alvo (até 3 blocos), prende e deixa mais lento (o chefe não).</summary>
        private static void Redemoinho(Luta l, double alvo)
        {
            var r = Estilos.Agua;
            if (NoEspelho(l)) return;
            var centro = LugarDe(l, alvo);
            double raio = r.Raio * RoomWalk.TileUnits + RoomWalk.TileUnits / 2;
            Contar(l, Aviso("💧 Redemoinho"));
            foreach (var m in l.Arena.Monstros)
            {
                if (m.Fase == "caido" || MonstroNo(l, m.Indice).IsBoss) continue;
                double dx = centro.X - m.CorpoX;
                double dy = centro.Y - m.CorpoY;
                double distancia = Math.Sqrt(dx * dx + dy * dy);
                if (distancia > raio) continue;
                if (m.Indice != alvo && m.Fase != "avisando" && m.Fase != "investindo")
                {
                    double anda = Math.Min(r.Puxa * RoomWalk.TileUnits, Js.Max(0, distancia - D.EspacoEntreMonstros));
                    if (anda > 0 && distancia > 0)
                    {
                        double x = m.CorpoX + Math.Truncate(dx * anda / distancia);
                        double y = m.CorpoY + Math.Truncate(dy * anda / distancia);
                        if (!NaParede(l, x, y))
                        {
                            m.CorpoX = x;
                            m.CorpoY = y;
                        }
                    }
                }
                Prender(l, m, r.Preso, "💧 Preso");
                m.Lerdo = r.Preso + r.Lerdo;
            }
        }

        /// <summary>TS: manaDoArcano — o Arcano desperto: cada disparo dá mana (até o máximo).</summary>
        private static void ManaDoArcano(Luta l)
        {
            var estado = Masmorra(l);
            double mp = Js.Min(estado.Hero.MaxMp, estado.Hero.Mp + Estilos.Arcano.Mana);
            if (mp == estado.Hero.Mp) return;
            var comMana = estado.Clone();
            comMana.Hero = estado.Hero.Clone();
            comMana.Hero.Mp = mp;
            l.Estado = comMana;
        }

        /// <summary>TS: engolir — a fome da escuridão: o disparo engole 15% da vida que resta do alvo (no chefe, no máximo 300).</summary>
        private static void Engolir(Luta l, double indice)
        {
            var r = Estilos.Escuridao;
            var monstro = CombatMonster.From(Sala(l).Monsters[(int)indice]);
            double engole = Math.Truncate(monstro.Hp * r.Engole / 100);
            if (monstro.IsBoss) engole = Js.Min(r.TetoNoChefe, engole);
            if (engole >= 1) FerirComDano(l, indice, engole, "🌑-" + Js.NumberToString(engole));
        }

        /// <summary>TS: naEscuridao — o monstro está dentro da área de escuridão do Mago?</summary>
        private static bool NaEscuridao(Luta l, MonstroNaArena m)
        {
            var e = l.Arena.Escuridao;
            if (e == null || m == null) return false;
            double meio = Estilos.Escuridao.Lado * RoomWalk.TileUnits / 2;
            return Math.Abs(m.CorpoX - e.X) <= meio && Math.Abs(m.CorpoY - e.Y) <= meio;
        }

        /// <summary>TS: plantar — o Florescimento planta uma flor em (x, y), a até 4 blocos do herói; no máximo 2, e a nova tira a mais antiga.</summary>
        private static void Plantar(Luta l, double x, double y)
        {
            var r = Estilos.Florescimento;
            if (Estilos.IdDoEstilo(Masmorra(l).Hero) != "florescimento") return;
            double dx = x - l.Arena.Heroi.X;
            double dy = y - l.Arena.Heroi.Y;
            double alcance = r.Plantio * RoomWalk.TileUnits + RoomWalk.TileUnits / 2;
            if (dx * dx + dy * dy > alcance * alcance)
            {
                Contar(l, Aviso("Chegue mais perto"));
                return;
            }
            var flor = new FlorNaSala { X = Math.Truncate(x), Y = Math.Truncate(y) };
            var flores = l.Arena.Flores != null ? new List<FlorNaSala>(l.Arena.Flores) : new List<FlorNaSala>();
            flores.Add(flor);
            while (flores.Count > r.Maximo) flores.RemoveAt(0);
            l.Arena.Flores = flores;
            l.Arena.Recarga = D.RecargaDoAtaque;
            Contar(l, new Acontecimento { Tipo = "numero", Onde = "chao", X = flor.X, Y = flor.Y, Texto = "🌸", Tom = "cura" });
        }

        /// <summary>TS: naFlor — o herói daqui está dentro de uma flor (a dele ou a do parceiro)?</summary>
        private static bool NaFlor(Luta l)
        {
            double meio = Estilos.Florescimento.Lado * RoomWalk.TileUnits / 2;
            double x = l.Arena.Heroi.X, y = l.Arena.Heroi.Y;
            foreach (var lista in new[] { l.Arena.Flores, l.Arena.Dupla?.FloresDoParceiro })
            {
                if (lista == null) continue;
                foreach (var f in lista)
                    if (Math.Abs(x - f.X) <= meio && Math.Abs(y - f.Y) <= meio) return true;
            }
            return false;
        }

        /// <summary>
        /// TS: passarAsFlores — quem está dentro de uma flor fica sem o veneno e o sangramento (o osso quebrado não), e a
        /// cada segundo dentro cura 3% da vida máxima. O fantasma não.
        /// </summary>
        private static void PassarAsFlores(Luta l)
        {
            if (l.Arena.Dupla?.Fantasma == true || !NaFlor(l))
            {
                l.Arena.RelogioDaFlor = null;
                return;
            }
            var estado = Masmorra(l);
            var hero = estado.Hero;
            bool envenenado = (hero.Buffs?.PoisonTurns ?? 0) > 0;
            bool ferido = (hero.Ferimentos?.Veneno ?? 0) != 0 || (hero.Ferimentos?.Sangramento ?? 0) != 0;
            if (envenenado || ferido)
            {
                var limpo = estado.Clone();
                limpo.Hero = hero.Clone();
                if (hero.Ferimentos != null)
                {
                    var ferimentos = hero.Ferimentos.Clone();
                    ferimentos.Veneno = null;
                    ferimentos.Sangramento = null;
                    limpo.Hero.Ferimentos = ferimentos.Braco == null && ferimentos.Perna == null ? null : ferimentos;
                }
                if (envenenado)
                {
                    var buffs = hero.Buffs.Clone();
                    buffs.PoisonTurns = null;
                    buffs.PoisonDmg = null;
                    limpo.Hero.Buffs = buffs;
                }
                l.Estado = limpo;
                Contar(l, Numero("heroi", 0, "🌸 Imune", "cura"));
            }
            double relogio = (l.Arena.RelogioDaFlor ?? 0) + 1;
            if (relogio < 60)
            {
                l.Arena.RelogioDaFlor = relogio;
                return;
            }
            l.Arena.RelogioDaFlor = 0;
            var agora = Masmorra(l);
            double falta = agora.Hero.MaxHp - agora.Hero.Hp;
            if (falta <= 0) return;
            double cura = Js.Min(falta, Js.Max(1, Math.Truncate(agora.Hero.MaxHp * Estilos.Florescimento.Cura / 100)));
            var curado = agora.Clone();
            curado.Hero = agora.Hero.Clone();
            curado.Hero.Hp = agora.Hero.Hp + cura;
            l.Estado = curado;
            Contar(l, Numero("heroi", 0, "🌸+" + Js.NumberToString(cura), "cura"));
        }

        /// <summary>TS: revestir — o Monge com o ki cheio se reveste: bate mais forte até o próximo golpe levado.</summary>
        private static void Revestir(Luta l)
        {
            var r = CD.Monge;
            var h = Masmorra(l).Hero;
            if (Catalog.IdDaClasse(h.ClassId, h.ClassName) != "monge" || l.Arena.Revestido == true || (l.Arena.Ki ?? 0) < r.Revestir) return;
            double sobra = (l.Arena.Ki ?? 0) - r.Revestir;
            l.Arena.Ki = sobra > 0 ? sobra : (double?)null;
            l.Arena.Revestido = true;
            Contar(l, Aviso("☯️ Revestido de ki"));
        }

        /// <summary>TS: explodir — a explosão de ki: gasta todo o ki, bate em quem está perto (o mesmo dano em todos) e empurra.</summary>
        private static void Explodir(Luta l)
        {
            var r = CD.Monge;
            double ki = l.Arena.Ki ?? 0;
            var hero = Masmorra(l).Hero;
            if (Catalog.IdDaClasse(hero.ClassId, hero.ClassName) != "monge" || ki <= 0) return;
            l.Arena.Ki = null;
            l.Arena.Recarga = D.RecargaDoAtaque;
            Contar(l, Aviso("💥 Explosão de ki"));
            double hx = l.Arena.Heroi.X, hy = l.Arena.Heroi.Y;
            double raio = r.RaioDaExplosao * RoomWalk.TileUnits + RoomWalk.TileUnits / 2;
            var naArea = new List<(MonstroNaArena M, double Distancia)>();
            foreach (var m in l.Arena.Monstros)
            {
                if (m.Fase == "caido") continue;
                var lugar = LugarDe(l, m.Indice);
                double distancia = (hx - lugar.X) * (hx - lugar.X) + (hy - lugar.Y) * (hy - lugar.Y);
                if (distancia <= raio * raio) naArea.Add((m, distancia));
            }
            if (naArea.Count == 0) return;
            // O mais perto primeiro; no empate, a ordem da sala.
            naArea.Sort((a, b) => a.Distancia != b.Distancia ? a.Distancia.CompareTo(b.Distancia) : a.M.Indice.CompareTo(b.M.Indice));
            // Com dois leques (rodada 6c), a explosão empurra mais longe e bate mais forte.
            var daArma = ClassesDeLuta.ExplosaoDaArma(hero);
            double dado = 1 + Rng.RandomInt(Attack.LadosDoDano, l.Rng);
            var leitura = new LeituraDaMira { Acerto = true, Forca = ClassesDeLuta.ForcaDaExplosao(ki), Critico = false };
            var acerto = AcertarMonstro(l, naArea[0].M, dado, leitura, EstiloDoBotao(hero), daArma.Dano);
            if (acerto == null || l.Fim != null) return;
            for (int k = 1; k < naArea.Count; k++)
            {
                if (l.Fim != null) return;
                var m = naArea[k].M;
                if (m.Fase != "caido") FerirComDano(l, m.Indice, acerto.Value, "💥-" + Js.NumberToString(acerto.Value));
            }
            foreach (var item in naArea)
            {
                if (l.Fim != null) return;
                if (item.M.Fase != "caido") Empurrar(l, item.M, hx, hy, daArma.Empurra);
            }
        }

        // ---------- pra tela ----------

        /// <summary>TS: eventoDoBotao — o evento que o botão de ataque abriria agora, sem sortear nada.</summary>
        // ---------- a luta em dupla ----------

        private static bool NoEspelho(Luta l) => l.Arena.Dupla?.Papel == "convidado";

        /// <summary>O parceiro está de pé na sala, e eu sei onde.</summary>
        private static PontoNaSala ParceiroDePe(Luta l)
        {
            var dupla = l.Arena.Dupla;
            if (dupla == null || dupla.Parceiro == null || dupla.ParceiroCaido == true) return null;
            return dupla.Parceiro;
        }

        /// <summary>Atrás de quem o monstro vai: o parceiro, se foi quem ele escolheu e ainda está de pé; senão o herói daqui.</summary>
        private static (double X, double Y) PresaDe(Luta l, MonstroNaArena m)
        {
            if (m.NoLacaio != null)
            {
                var lacaio = LacaioDePe(l, m.NoLacaio.Value);
                if (lacaio != null) return (lacaio.X.Value, lacaio.Y.Value);
            }
            var parceiro = m.NoParceiro == true ? ParceiroDePe(l) : null;
            return parceiro != null ? (parceiro.X, parceiro.Y) : (l.Arena.Heroi.X, l.Arena.Heroi.Y);
        }

        /// <summary>TS: escolherPresa — em dupla, o monstro que espera escolhe o herói de pé mais perto do corpo dele. Sem sorteio.</summary>
        private static void EscolherPresa(Luta l, MonstroNaArena m)
        {
            var parceiro = ParceiroDePe(l);
            var lacaios = LacaiosComCorpo(l);
            if (lacaios.Count > 0)
            {
                EscolherComLacaios(l, m, parceiro, lacaios);
                return;
            }
            m.NoLacaio = null;
            if (parceiro == null)
            {
                m.NoParceiro = null;
                return;
            }
            if (l.Arena.Dupla?.Fantasma == true)
            {
                m.NoParceiro = true;
                return;
            }
            var heroi = l.Arena.Heroi;
            double daqui = (heroi.X - m.CorpoX) * (heroi.X - m.CorpoX) + (heroi.Y - m.CorpoY) * (heroi.Y - m.CorpoY);
            double dele = (parceiro.X - m.CorpoX) * (parceiro.X - m.CorpoX) + (parceiro.Y - m.CorpoY) * (parceiro.Y - m.CorpoY);
            // O Paladino conta como se estivesse "foco" % mais perto; as distâncias vêm ao quadrado, e o peso também.
            double perto = (100 - CD.Paladino.Foco) * (100 - CD.Paladino.Foco);
            double pesoDaqui = ClassesDeLuta.PuxaOsMonstros(Masmorra(l).Hero) ? perto : 10000;
            double pesoDele = l.Arena.Dupla?.ParceiroPuxa == true ? perto : 10000;
            if (dele * pesoDele < daqui * pesoDaqui) m.NoParceiro = true;
            else m.NoParceiro = null;
        }

        /// <summary>O golpe pega o herói daqui (o fantasma não apanha).</summary>
        private static bool Pega(Luta l, double x, double y, double raio) =>
            l.Arena.Dupla?.Fantasma != true && Encosta(l.Arena.Heroi, x, y, raio);

        private static bool PegaOParceiro(Luta l, double x, double y, double raio)
        {
            var parceiro = ParceiroDePe(l);
            if (parceiro == null) return false;
            double dx = parceiro.X - x;
            double dy = parceiro.Y - y;
            double limite = raio + D.RaioDoHeroi;
            return dx * dx + dy * dy <= limite * limite;
        }

        /// <summary>TS: receberDoParceiro — onde ele está, o dano que causou (no anfitrião) e o espelho (no convidado).</summary>
        private static void ReceberDoParceiro(Luta l, EntradaDaLuta entrada)
        {
            var dupla = l.Arena.Dupla;
            if (entrada.SemParceiro == true)
            {
                // Sozinho de novo: quem estava caído não tem mais quem o levante.
                l.Arena.Dupla = null;
                foreach (var m in l.Arena.Monstros) m.NoParceiro = null;
                if (dupla.Fantasma == true) Perder(l);
                return;
            }
            if (entrada.Parceiro != null)
            {
                dupla.Parceiro = new PontoNaSala { X = Math.Truncate(entrada.Parceiro.X), Y = Math.Truncate(entrada.Parceiro.Y) };
                dupla.ParceiroCaido = entrada.Parceiro.Caido == true ? true : (bool?)null;
                dupla.ParceiroPuxa = entrada.Parceiro.Puxa == true ? true : (bool?)null;
                dupla.ParceiroDano = (entrada.Parceiro.Dano ?? 0) > 0 ? Math.Truncate(entrada.Parceiro.Dano.Value) : (double?)null;
                var flores = new List<FlorNaSala>();
                if (entrada.Parceiro.Flores != null)
                    for (int i = 0; i < entrada.Parceiro.Flores.Count && i < Estilos.Florescimento.Maximo; i++)
                        flores.Add(new FlorNaSala { X = Math.Truncate(entrada.Parceiro.Flores[i].X), Y = Math.Truncate(entrada.Parceiro.Flores[i].Y) });
                dupla.FloresDoParceiro = flores.Count > 0 ? flores : null;
            }
            // A moral do grupo que o Bardo do parceiro subiu (fica a maior).
            if (entrada.Moral != null && Math.Truncate(entrada.Moral.Value) > (l.Arena.Moral?.Nivel ?? 0))
            {
                var nova = l.Arena.Moral?.Clone() ?? new Moral();
                nova.Nivel = Math.Truncate(entrada.Moral.Value);
                l.Arena.Moral = nova;
            }
            // O apoio do parceiro em mim (o fantasma não recebe nada).
            if (dupla.Fantasma != true && entrada.Apoios != null)
            {
                foreach (var apoio in entrada.Apoios)
                {
                    if (apoio == null || Array.IndexOf(TiposDeApoio, apoio.Tipo) < 0) continue;
                    ReceberApoio(l, new ApoioDoParceiro { Tipo = apoio.Tipo, Passos = apoio.Passos != null ? Js.Max(0, Math.Truncate(apoio.Passos.Value)) : (double?)null });
                }
            }
            if (dupla.Fantasma == true && Js.Truthy(entrada.Reviver))
            {
                var levantado = Masmorra(l).Clone();
                levantado.Hero = Duplas.Reviver(levantado.Hero, entrada.Reviver.Value);
                l.Estado = levantado;
                dupla.Fantasma = null;
                const string texto = "✨ Seu parceiro reviveu você!";
                Contar(l, Aviso(texto));
                Diario(l, new[] { texto });
                Contar(l, Som("heal"));
            }
            if (dupla.Fantasma == true && dupla.ParceiroCaido == true)
            {
                Perder(l);
                return;
            }
            if (dupla.Papel == "anfitriao")
            {
                if (entrada.DanoDeFora == null) return;
                foreach (var golpe in entrada.DanoDeFora)
                {
                    if (l.Fim != null) return;
                    DanoDoParceiro(l, Math.Truncate(golpe.Indice), Math.Truncate(golpe.Dano));
                }
            }
            else if (entrada.Espelho != null)
            {
                AplicarEspelho(l, entrada.Espelho);
            }
        }

        /// <summary>TS: danoDoParceiro — no anfitrião, o parceiro feriu um monstro. Passa por ferirMonstro, como todo dano.</summary>
        private static void DanoDoParceiro(Luta l, double indice, double dano)
        {
            int i = (int)indice;
            if (i < 0 || i >= l.Arena.Monstros.Count) return;
            var m = l.Arena.Monstros[i];
            if (m.Fase == "caido" || !(dano > 0)) return;
            FerirComDano(l, indice, dano, "-" + Js.NumberToString(dano));
        }

        /// <summary>
        /// TS: ferirNoEspelho — no espelho o golpe do herói daqui não derruba ninguém: a vida do monstro desce na tela
        /// (até 1), o dano vai pro anfitrião e a queda volta dele.
        /// </summary>
        private static Ferida FerirNoEspelho(Luta l, EstadoNaMasmorra estado, double indice, CombatMonster depois)
        {
            var antes = ((DungeonCell)Estados.CelulaAtual(estado)).Monsters[(int)indice];
            double dano = Math.Max(0, antes.Hp - depois.Hp);
            if (dano > 0) l.Danos.Add(new DanoNoMonstro { Indice = indice, Dano = dano });
            var monstro = CombatMonster.From(depois);
            monstro.Hp = Math.Max(1, Math.Min(antes.Hp, depois.Hp));
            var gravado = FimDaLuta.GravarMonstro(estado, indice, monstro);
            l.Estado = gravado;
            return new Ferida { Estado = gravado, Monstro = monstro, Caiu = false, Protegido = false };
        }

        /// <summary>TS: aplicarEspelho — o estado dos monstros do anfitrião por cima do daqui; quem caiu lá cai aqui, e paga o abate.</summary>
        private static void AplicarEspelho(Luta l, Espelho espelho)
        {
            var arena = l.Arena;
            foreach (var de in espelho.Monstros)
            {
                if (l.Fim != null) return;
                double indice = Math.Truncate(de.Indice);
                var lista = Sala(l).Monsters ?? new List<MonsterInstance>();
                if (indice < 0 || indice > lista.Count) continue;
                // Um lacaio que o espelho ainda não tinha: entra com o monstro inteiro.
                if (indice == lista.Count)
                {
                    if (de.Monstro == null) continue;
                    var estado = Masmorra(l);
                    var celula = ((DungeonCell)Estados.CelulaAtual(estado)).Clone();
                    celula.Monsters = new List<MonsterInstance>(lista) { de.Monstro };
                    l.Estado = Estados.SubstituirCelulaAtual(estado, celula);
                    arena.Monstros.Add(new MonstroNaArena { Indice = indice, Fase = "esperando", Tempo = 0, Forca = 1, Alvo = -1, X = 0, Y = 0, RumoX = 0, RumoY = 0, CorpoX = de.CorpoX, CorpoY = de.CorpoY });
                }
                int i = (int)indice;
                if (i >= arena.Monstros.Count) continue;
                var m = arena.Monstros[i];
                bool jaCaido = m.Fase == "caido";
                var agora = CombatMonster.From(de.Monstro ?? Sala(l).Monsters[i]);
                agora.Hp = Math.Max(0, Math.Truncate(de.Hp));
                l.Estado = FimDaLuta.GravarMonstro(Masmorra(l), indice, agora);
                if (jaCaido) continue;
                if (agora.Hp <= 0 || de.Fase == "caido")
                {
                    Abater(l, indice, Monsters.View(agora));
                    continue;
                }
                // O golpe é o mesmo de antes (mesma fase, ainda correndo): o que já me acertou continua contado.
                bool mesmoGolpe = m.Acertou == true && (de.Fase == "investindo" || de.Fase == "avisando") && (m.Fase == "investindo" || m.Fase == "avisando");
                bool caiuOCirculo = m.Fase == "avisando" && de.Fase != "avisando" && de.Fase != "investindo";
                if (caiuOCirculo) GolpeQueCaiu(l, m);
                m.Fase = de.Fase;
                m.Tempo = de.Tempo;
                m.Forca = de.Forca;
                m.Alvo = de.Alvo;
                m.X = de.X;
                m.Y = de.Y;
                m.RumoX = de.RumoX;
                m.RumoY = de.RumoY;
                m.CorpoX = de.CorpoX;
                m.CorpoY = de.CorpoY;
                m.Poder = Js.Truthy(de.Poder) ? de.Poder : null;
                // Lá ele mira o parceiro do anfitrião, que sou eu: aqui é o herói daqui. E o contrário.
                m.NoParceiro = de.NoParceiro == true ? (bool?)null : true;
                m.Acertou = mesmoGolpe ? true : (bool?)null;
            }
            if (l.Fim != null) return;
            // As bolas: as do anfitrião no lugar das daqui (a que já me acertou não volta).
            var tiros = new List<Tiro>(espelho.Tiros.Count);
            foreach (var t in espelho.Tiros) tiros.Add(t.Clone());
            arena.Tiros = tiros;
        }

        /// <summary>TS: golpeQueCaiu — no espelho, o aviso de um golpe de perto acabou no anfitrião: se o herói daqui está dentro, apanha.</summary>
        private static void GolpeQueCaiu(Luta l, MonstroNaArena m)
        {
            if (m.Alvo >= 0 || m.Acertou == true) return;
            var jeito = JeitoDoGolpe(MonstroNo(l, m.Indice), m.Poder);
            if (jeito.Golpe != "perto") return;
            if (Pega(l, m.X, m.Y, jeito.Tamanho)) GolpeNoHeroi(l, m.Indice, m.Forca);
        }

        /// <summary>
        /// TS: passoDoEspelho — os monstros não pensam: entre um estado e outro do anfitrião, a investida e as bolas
        /// seguem o rumo que tinham, e o que encostar no herói daqui acerta (uma vez por golpe).
        /// </summary>
        private static void PassoDoEspelho(Luta l)
        {
            foreach (var m in l.Arena.Monstros)
            {
                if (l.Fim != null) return;
                if (m.Fase == "avisando")
                {
                    if (m.Tempo > 0) m.Tempo -= 1;
                    continue;
                }
                if (m.Fase != "investindo" || m.Acertou == true) continue;
                m.X += m.RumoX;
                m.Y += m.RumoY;
                if (Pega(l, m.X, m.Y, JeitoDoGolpe(MonstroNo(l, m.Indice), m.Poder).Tamanho))
                {
                    m.Acertou = true;
                    GolpeNoHeroi(l, m.Indice, m.Forca);
                }
            }
            if (l.Fim != null) return;
            var ficam = new List<Tiro>();
            foreach (var t in l.Arena.Tiros)
            {
                if (l.Fim != null) break;
                t.X += t.Vx;
                t.Y += t.Vy;
                if (Pega(l, t.X, t.Y, t.Raio))
                {
                    GolpeNoHeroi(l, t.Indice, t.Forca);
                    continue;
                }
                ficam.Add(t);
            }
            l.Arena.Tiros = ficam;
        }

        /// <summary>
        /// TS: espelhoDaLuta — o que o anfitrião manda pro espelho: os monstros como estão, com a vida.
        /// <paramref name="inteiros"/>: os índices que vão com o monstro inteiro.
        /// </summary>
        public static Espelho EspelhoDaLuta(LutaEmTempoReal luta, IReadOnlyList<double> inteiros = null)
        {
            var espelho = new Espelho();
            if (!(luta.Estado is EstadoNaMasmorra masmorra)) return espelho;
            var lista = ((DungeonCell)Estados.CelulaAtual(masmorra)).Monsters ?? new List<MonsterInstance>();
            foreach (var m in luta.Arena.Monstros)
            {
                var monstro = lista[(int)m.Indice];
                bool inteiro = false;
                if (inteiros != null)
                    foreach (var i in inteiros)
                        if (i == m.Indice) inteiro = true;
                espelho.Monstros.Add(new MonstroNoEspelho
                {
                    Indice = m.Indice, Fase = m.Fase, Tempo = m.Tempo, Forca = m.Forca, Alvo = m.Alvo, X = m.X, Y = m.Y, RumoX = m.RumoX, RumoY = m.RumoY,
                    CorpoX = m.CorpoX, CorpoY = m.CorpoY, Poder = m.Poder, NoParceiro = m.NoParceiro, Hp = monstro.Hp,
                    Monstro = inteiro ? CombatMonster.From(monstro) : null,
                });
            }
            foreach (var t in luta.Arena.Tiros) espelho.Tiros.Add(t.Clone());
            return espelho;
        }

        /// <summary>
        /// TS: cair — o herói daqui ficou sem vida. Na luta de um só (ou sem parceiro de pé), é a derrota de sempre. Em
        /// dupla ele vira fantasma e a luta segue com o outro.
        /// </summary>
        private static void Cair(Luta l)
        {
            // O Necromante com a Magia Proibida liberada se levanta, e ela fica selada até zerar a masmorra (rodada 4b).
            var quem = Masmorra(l).Hero;
            if (Catalog.IdDaClasse(quem.ClassId, quem.ClassName) == "necromante" && quem.BloqueioDaMagia == null)
            {
                double vida = Math.Max(1, Math.Truncate(quem.MaxHp * Invocacao.Necromante.LevantaCom / 100));
                var levantado = Masmorra(l).Clone();
                levantado.Hero = quem.Clone();
                levantado.Hero.Hp = vida;
                levantado.Hero.BloqueioDaMagia = levantado.Masmorra.Dungeon;
                l.Estado = levantado;
                const string levantou = "☠️ A Magia Proibida levanta o Necromante! Ela fica selada até zerar a masmorra.";
                Contar(l, Aviso(levantou));
                Diario(l, new[] { levantou });
                Contar(l, Numero("heroi", 0, "☠️+" + Js.NumberToString(vida), "cura"));
                return;
            }
            var dupla = l.Arena.Dupla;
            if (dupla == null || ParceiroDePe(l) == null)
            {
                Perder(l);
                return;
            }
            if (dupla.Fantasma == true) return;
            dupla.Fantasma = true;
            l.Arena.Evento = null;
            const string texto = "👻 Você caiu! Seu parceiro pode reviver você.";
            Contar(l, Aviso(texto));
            Diario(l, new[] { texto });
            Contar(l, Som("defeat"));
        }

        public static string EventoDoBotao(Hero hero, bool teclado = false) => EventosDeArma.EventoDaArma(hero.Equip.Get("arma")?.TemplateId, teclado);
    }
}
