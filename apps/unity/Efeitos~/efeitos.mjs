// A lista dos efeitos que vão pro app: o nome da folha (o que o jogo pede), o arquivo de fx/ (ou um efeito da
// própria pixelfx, "categoria/nome") e as opções dele. O contorno é o escuro dos sprites do Breno; false tira.

/** O contorno dos sprites do jogo (CLAUDE.md: contorno escuro ~rgb(26,11,9)). */
export const CONTORNO = "#1a0b09";

/** O fogo do Breno (a tocha da Caverna): vermelho, laranja e amarelo puros, do escuro pro claro. */
const FOGO = ["#5c1208", "#ed1c24", "#ff9404", "#ffc20e", "#fff200", "#ffffff"];
/** O golpe no herói: vermelho de sangue. */
const SANGUE = ["#3a0608", "#8a0f14", "#c41a1e", "#ed1c24", "#ff6a4a", "#ffffff"];

/** O roxo do arcano (a bola do mágico, a fumaça do crítico). */
const ARCANO = ["#14061f", "#3a1257", "#6b2a9c", "#a45be0", "#e0b8ff", "#ffffff"];
/** O dourado (a precisão, a canção). */
const OURO = ["#5a3a00", "#b07a00", "#ffc20e", "#fff200", "#fffbd0", "#ffffff"];
/** O branco do vento. */
const VENTO = ["#1f2529", "#7f878c", "#b3b9bc", "#dfe3e4", "#ffffff", "#ffffff"];
/** O azul do gelo e do escudo. */
const GELO = ["#0a2a4a", "#1f5fa8", "#3fa9f5", "#9bdcff", "#e6f7ff", "#ffffff"];
/** Pedra e poeira, puxadas pro cinza-azulado das paredes da Caverna. */
const PEDRA = ["#1f2529", "#4a5258", "#7f878c", "#b3b9bc", "#dfe3e4", "#ffffff"];

export const EFEITOS = [
  // o golpe que acerta o monstro (do herói ou de um companheiro)
  { nome: "golpe", fonte: "golpe", opcoes: { palette: FOGO } },
  // o crítico: maior, mais pedaços
  { nome: "golpe-critico", fonte: "golpe", opcoes: { palette: FOGO, escala: 1.5, pedacos: 9 } },
  // o golpe que acerta o herói
  { nome: "golpe-no-heroi", fonte: "golpe", opcoes: { palette: SANGUE, escala: 0.9, pedacos: 5 } },
  // o monstro que cai: um poof de bolas sólidas em tons de pedra, com as estrelinhas no amarelo do Breno
  // a cura no herói (a poção, os poderes de cura, o roubo de vida)
  { nome: "cura", fonte: "cura" },
  // o esqueleto do necromante surgindo do chão (as cores ficam as do arquivo: terra da Caverna, alma verde)
  { nome: "esqueleto", fonte: "esqueleto" },
  // os poderes e as runas de dano, um por elemento (o ícone no número diz qual)
  { nome: "fogo", fonte: "fogo" },
  { nome: "fogo-pequeno", fonte: "fogo", opcoes: { escala: 0.6 } },
  { nome: "gelo", fonte: "gelo" },
  { nome: "gelo-pequeno", fonte: "gelo", opcoes: { escala: 0.6 } },
  { nome: "luz", fonte: "luz" },
  { nome: "sombra", fonte: "sombra" },
  { nome: "veneno", fonte: "veneno" },
  { nome: "raio", fonte: "raio" },
  { nome: "som", fonte: "som" },
  { nome: "sangue", fonte: "sangue" },
  // os poderes físicos: o golpe poderoso é o golpe grande (o atordoante soma o atordoado; a flecha, o sangue)
  { nome: "poder-fisico", fonte: "golpe", opcoes: { palette: FOGO, escala: 1.9, pedacos: 12, seed: 5 } },
  // a bola do mágico que estoura (no herói ou na parede)
  { nome: "estouro", fonte: "golpe", opcoes: { palette: ARCANO, escala: 0.8, pedacos: 5, seed: 8 } },
  // os reforços no herói, pela forma
  { nome: "reforco-forca", fonte: "reforco", opcoes: { palette: FOGO, forma: "setas" } },
  { nome: "reforco-precisao", fonte: "reforco", opcoes: { palette: OURO, forma: "mira" } },
  { nome: "reforco-esquiva", fonte: "reforco", opcoes: { palette: VENTO, forma: "vento" } },
  { nome: "reforco-escudo", fonte: "reforco", opcoes: { palette: GELO, forma: "bolha" } },
  { nome: "reforco-critico", fonte: "reforco", opcoes: { palette: ARCANO, forma: "fumaca" } },
  // a canção de batalha: as notas, douradas
  { nome: "reforco-grupo", fonte: "som", opcoes: { palette: OURO } },
  // os estados no monstro
  { nome: "atordoado", fonte: "atordoado" },
  { nome: "lento", fonte: "lento" },
  // o herói: o desvio, o escudo do vigor apanhando, o roubo de vida
  { nome: "desvio", fonte: "desvio" },
  { nome: "escudo", fonte: "escudo" },
  { nome: "vampiro", fonte: "cura", opcoes: { palette: ["#3a0608", "#8a0f14", "#ed1c24", "#ff6a4a", "#ffffff"] } },
  // os ataques dos monstros: a poeira do golpe que cai, a do Golpe Devastador e a onda do Rugido
  { nome: "poeira", fonte: "poeira", opcoes: { palette: PEDRA } },
  { nome: "poeira-grande", fonte: "poeira", opcoes: { palette: PEDRA, escala: 1.6 } },
  { nome: "onda", fonte: "poeira", opcoes: { palette: PEDRA, onda: true, escala: 1.3 } },
  { nome: "queda", fonte: "queda", opcoes: { palette: PEDRA, stars: ["#ff9404", "#fff200", "#ffffff"] } },
];
