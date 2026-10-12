import { describe, expect, it } from 'vitest';

import { direcaoAoSoltar, direcaoDaTecla, estaDigitando } from './teclado';

describe('direcaoDaTecla', () => {
  it('mapeia WASD nas quatro direções', () => {
    expect(direcaoDaTecla({ key: 'w' })).toBe('N');
    expect(direcaoDaTecla({ key: 'a' })).toBe('W');
    expect(direcaoDaTecla({ key: 's' })).toBe('S');
    expect(direcaoDaTecla({ key: 'd' })).toBe('E');
  });

  it('aceita as setas no mesmo par que o jogo antigo aceitava', () => {
    expect(direcaoDaTecla({ key: 'ArrowUp' })).toBe('N');
    expect(direcaoDaTecla({ key: 'ArrowLeft' })).toBe('W');
    expect(direcaoDaTecla({ key: 'ArrowDown' })).toBe('S');
    expect(direcaoDaTecla({ key: 'ArrowRight' })).toBe('E');
  });

  /** Com Caps Lock ligado o navegador manda 'W', não 'w'. */
  it('não se importa com maiúscula', () => {
    expect(direcaoDaTecla({ key: 'W' })).toBe('N');
    expect(direcaoDaTecla({ key: 'D' })).toBe('E');
  });

  it('ignora tecla que não é direção', () => {
    expect(direcaoDaTecla({ key: 'q' })).toBeNull();
    expect(direcaoDaTecla({ key: 'Enter' })).toBeNull();
    expect(direcaoDaTecla({ key: ' ' })).toBeNull();
  });

  /** Ctrl+S é salvar a página; andar por engano seria pior que não andar. */
  it('ignora a tecla quando há modificador junto', () => {
    expect(direcaoDaTecla({ key: 's', ctrlKey: true })).toBeNull();
    expect(direcaoDaTecla({ key: 'a', metaKey: true })).toBeNull();
    expect(direcaoDaTecla({ key: 'd', altKey: true })).toBeNull();
  });

  /** Segurar Shift sem querer enquanto anda é comum, e não muda o sentido. */
  it('anda mesmo com Shift, que não é modificador de atalho aqui', () => {
    expect(direcaoDaTecla({ key: 'W' })).toBe('N');
    expect(direcaoDaTecla({ key: 'ArrowUp' })).toBe('N');
  });

  /**
   * A tecla é estado desde o andar solto: a repetição só confirma que ela
   * segue segurada, e quem chama precisa reconhecê-la pra seguir barrando a
   * rolagem da página com as setas.
   */
  it('a auto-repetição da tecla segurada é a mesma direção', () => {
    expect(direcaoDaTecla({ key: 'w', repeat: true })).toBe('N');
    expect(direcaoDaTecla({ key: 'ArrowLeft', repeat: true })).toBe('W');
  });
});

describe('direcaoAoSoltar', () => {
  it('solta a direção mesmo com modificador apertado, senão o herói seguiria andando', () => {
    expect(direcaoAoSoltar({ key: 'w' })).toBe('N');
    expect(direcaoAoSoltar({ key: 'ArrowRight' })).toBe('E');
    expect(direcaoAoSoltar({ key: 'q' })).toBeNull();
  });
});

describe('estaDigitando', () => {
  it('reconhece os campos que recebem texto', () => {
    expect(estaDigitando({ tagName: 'INPUT' })).toBe(true);
    expect(estaDigitando({ tagName: 'TEXTAREA' })).toBe(true);
    expect(estaDigitando({ tagName: 'SELECT' })).toBe(true);
    expect(estaDigitando({ isContentEditable: true, tagName: 'DIV' })).toBe(true);
  });

  it('deixa passar o que não recebe texto', () => {
    expect(estaDigitando({ tagName: 'DIV' })).toBe(false);
    expect(estaDigitando({ tagName: 'BUTTON' })).toBe(false);
    expect(estaDigitando(null)).toBe(false);
    expect(estaDigitando(undefined)).toBe(false);
  });

  /** `tagName` vem maiúsculo em HTML e minúsculo em XML/SVG. */
  it('não depende da caixa do tagName', () => {
    expect(estaDigitando({ tagName: 'input' })).toBe(true);
  });
});
