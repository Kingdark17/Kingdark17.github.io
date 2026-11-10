// Copia o "mini boneco" do Breno (o herói que anda no mapa, 31 × 32, de frente e de costas) da pasta baixada do
// Drive pros dois clientes, com os nomes do paperdoll grande (os ids do catálogo):
//   node packages/shared/scripts/copia-mini-boneco.mjs "<pasta drive-download-...>"
// Sai em apps/web/public/img/mini/<frente|costas>/<pasta>/<id>.png e em
// apps/unity/Assets/RPGLegend/Art/Jogo/Resources/Mini/... (a Unity cria os .meta ao importar).
// Arquivo novo do Breno com outro nome → acrescentar aqui. O que não está na lista é avisado e fica de fora.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const origem = process.argv[2];
if (!origem) {
  console.error('Passe a pasta baixada do Drive.');
  process.exit(1);
}
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const destinos = [path.join(raiz, 'apps/web/public/img/mini'), path.join(raiz, 'apps/unity/Assets/RPGLegend/Art/Jogo/Resources/Mini')];

/** O arquivo do Breno (sem a pasta) → [lado, pasta/id]. */
const NOMES = {
  // corpos, de frente
  'angel_miniBody.png': ['frente', 'corpo/celestial'],
  'draconian_miniBody.png': ['frente', 'corpo/draconato'],
  'elfo_miniBody.png': ['frente', 'corpo/elfo'],
  'esqueleto_miniBody.png': ['frente', 'corpo/morto_vivo'],
  'felino_miniBody.png': ['frente', 'corpo/felino'],
  'goblin_miniBody.png': ['frente', 'corpo/goblin'],
  'half_elf_minibody.png': ['frente', 'corpo/meio_elfo'],
  'humano_miniBody.png': ['frente', 'corpo/humano'],
  'niggaElf_miniBody.png': ['frente', 'corpo/elfo_negro'],
  'orc_miniBody (2).png': ['frente', 'corpo/orc'],
  'pixie_miniBody.png': ['frente', 'corpo/fada'],
  // o que é da raça e fica por cima (auréola, chifres, orelhas, presas)
  'angel_add_miniBody.png': ['frente', 'extra/celestial'],
  'draconian_add_miniBody.png': ['frente', 'extra/draconato'],
  'felino_add_miniBody.png': ['frente', 'extra/felino'],
  'orc_add_miniBody.png': ['frente', 'extra/orc'],
  'hair_cut_minibody.png': ['frente', 'cabelo/curto'],
  'hair_med_miniBody.png': ['frente', 'cabelo/medio'],
  'hair_lon_miniBody.png': ['frente', 'cabelo/longo'],
  // roupas, de frente
  'calca_padrao_mini.png': ['frente', 'base/calca'],
  'camisa_padrao_mini.png': ['frente', 'base/roupa'],
  'armaduraPlacas_calca_miniBody.png': ['frente', 'calca/placas_calca'],
  'armaduraPlacas_elmo_miniBody.png': ['frente', 'elmo/placas_elmo'],
  'armaduraPlacas_peitoral_miniBody.png': ['frente', 'armadura/placas'],
  'mago_calca_miniBody.png': ['frente', 'calca/robe_calca'],
  'mago_chapéu_miniBody.png': ['frente', 'elmo/robe_chapeu'],
  'mago_manto_miniBody.png': ['frente', 'armadura/robe'],
  'escudo_miniBody.png': ['frente', 'secundaria/escudo'],
  // corpos, de costas
  'angel_back_miniBody.png': ['costas', 'corpo/celestial'],
  'draconian_back_miniBody.png': ['costas', 'corpo/draconato'],
  'elf_back_miniBody.png': ['costas', 'corpo/elfo'],
  'esqueleton_back_miniBody.png': ['costas', 'corpo/morto_vivo'],
  'felino_back_miniBody.png': ['costas', 'corpo/felino'],
  'goblin_back_miniBody.png': ['costas', 'corpo/goblin'],
  'half_elf_back_miniBody.png': ['costas', 'corpo/meio_elfo'],
  'human_back_miniBody.png': ['costas', 'corpo/humano'],
  'niggaElf_back_miniBody.png': ['costas', 'corpo/elfo_negro'],
  'orc_back_miniBody.png': ['costas', 'corpo/orc'],
  'pixie_back_miniBody.png': ['costas', 'corpo/fada'],
  // o que é da raça e fica por cima, de costas (asas, cauda, auréola)
  'angel_add_back_miniBody.png': ['costas', 'extra/celestial'],
  'draconian_add_back_miniBody.png': ['costas', 'extra/draconato'],
  'felino_add_back_miniBody.png': ['costas', 'extra/felino'],
  'pixie_add_back_miniBody.png': ['costas', 'extra/fada'],
  'hair_cut_back_miniBody.png': ['costas', 'cabelo/curto'],
  'hair_med_back_miniBody.png': ['costas', 'cabelo/medio'],
  'hair_lon_back_miniBody.png': ['costas', 'cabelo/longo'],
  // roupas, de costas
  'armaduraPlacas_calca_back_miniBody.png': ['costas', 'calca/placas_calca'],
  'armaduraPlacas_capacete_back_miniBody.png': ['costas', 'elmo/placas_elmo'],
  'armaduraPlacas_peitoral_back_miniBody.png': ['costas', 'armadura/placas'],
  'mago_calca_back_miniBody.png': ['costas', 'calca/robe_calca'],
  'mago_chapeu_back_miniBody.png': ['costas', 'elmo/robe_chapeu'],
  'mago_manto_back_miniBody.png': ['costas', 'armadura/robe'],
  'escudo_back_miniBody.png': ['costas', 'secundaria/escudo'],
};

/** Sem arte de costas ainda: a de frente serve (a roupa de baixo é quase igual dos dois lados). */
const EMPRESTADAS = [
  ['frente', 'base/calca', 'costas'],
  ['frente', 'base/roupa', 'costas'],
];

/** De fora de propósito: o orc cinza não é raça do jogo. */
const IGNORADOS = new Set(['orcGray_miniBody.png', 'orcGray_back_miniBody.png']);

function arquivosDe(pasta) {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivosDe(path.join(pasta, e.name)) : [path.join(pasta, e.name)]));
}

let copiados = 0;
const vistos = new Set();
for (const arquivo of arquivosDe(origem)) {
  const nome = path.basename(arquivo).normalize('NFC');
  if (IGNORADOS.has(nome)) continue;
  const alvo = NOMES[nome];
  if (!alvo) {
    console.warn('sem lugar na lista (ficou de fora):', nome);
    continue;
  }
  vistos.add(nome);
  for (const destino of destinos) {
    const para = path.join(destino, alvo[0], alvo[1] + '.png');
    fs.mkdirSync(path.dirname(para), { recursive: true });
    fs.copyFileSync(arquivo, para);
  }
  copiados++;
}
for (const [de, camada, para] of EMPRESTADAS) {
  for (const destino of destinos) {
    const alvo = path.join(destino, para, camada + '.png');
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.copyFileSync(path.join(destino, de, camada + '.png'), alvo);
  }
}
for (const nome of Object.keys(NOMES)) if (!vistos.has(nome)) console.warn('estava na lista e não veio:', nome);
console.log(`${copiados} arquivos copiados pra ${destinos.length} lugares, mais ${EMPRESTADAS.length} emprestados da frente.`);
