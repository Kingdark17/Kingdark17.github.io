/**
 * Reduz a foto escolhida a um quadrado de 256 px e devolve um `data:` URL —
 * porta de `compressPhoto()` em `js/account.js`, com os mesmos limites.
 *
 * A API recusa `data:` acima de 400 KB, então a compressão acontece no
 * navegador: WebP a 82% e, se ainda não couber, JPEG a 68%. Só roda no
 * cliente (usa `createImageBitmap` e `<canvas>`).
 */

const LADO_MAXIMO = 256;
const TAMANHO_MAXIMO_DO_ARQUIVO = 5_000_000;
const TAMANHO_MAXIMO_DO_DATA_URL = 400_000;
const TIPOS_ACEITOS = /^image\/(png|jpeg|webp)$/;

export class FotoInvalidaError extends Error {}

export async function comprimirFoto(arquivo: File): Promise<string> {
  if (!TIPOS_ACEITOS.test(arquivo.type) || arquivo.size > TAMANHO_MAXIMO_DO_ARQUIVO) {
    throw new FotoInvalidaError('Escolha uma foto PNG, JPG ou WebP de até 5 MB.');
  }

  const bitmap = await createImageBitmap(arquivo);
  const lado = Math.min(LADO_MAXIMO, Math.max(bitmap.width, bitmap.height));
  const escala = Math.min(lado / bitmap.width, lado / bitmap.height);

  const tela = document.createElement('canvas');
  tela.width = lado;
  tela.height = lado;

  const pincel = tela.getContext('2d');
  if (!pincel) throw new FotoInvalidaError('Seu navegador não conseguiu processar a imagem.');

  pincel.fillStyle = '#111';
  pincel.fillRect(0, 0, lado, lado);
  pincel.drawImage(
    bitmap,
    (lado - bitmap.width * escala) / 2,
    (lado - bitmap.height * escala) / 2,
    bitmap.width * escala,
    bitmap.height * escala,
  );
  bitmap.close();

  let resultado = tela.toDataURL('image/webp', 0.82);
  if (resultado.length > TAMANHO_MAXIMO_DO_DATA_URL) resultado = tela.toDataURL('image/jpeg', 0.68);
  if (resultado.length > TAMANHO_MAXIMO_DO_DATA_URL) {
    throw new FotoInvalidaError('Não foi possível reduzir essa foto. Escolha uma imagem menor.');
  }
  return resultado;
}
