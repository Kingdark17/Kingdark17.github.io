/**
 * Saneamento de `ui-action` — porta do bloco correspondente no server.js
 * original. O convidado consegue abrir loja/NPC/diálogo na tela do outro
 * jogador, então tudo que vem junto é texto não-confiável: `<` e `>` saem
 * fora e todo campo tem tamanho máximo.
 */

import { clampInt } from './numeric';

export const UI_ACTIONS = ['shop', 'npc', 'simple', 'event', 'questboard', 'encounter'] as const;
export type UiAction = (typeof UI_ACTIONS)[number];

const MIN_CELL = -1;
const MAX_CELL = 11;
const MAX_ICON = 8;
const MAX_TITLE = 60;
const MAX_TEXT = 500;
const MAX_NPC_NAME = 50;
const MAX_NPC_ROLE = 50;
const MAX_NPC_SERVICE = 20;
const MAX_NPC_LINES = 10;
const MAX_NPC_LINE = 300;

export interface UiActionNpc {
  name: string;
  role: string;
  service: string;
  icon: string;
  lines: string[];
  serviceUsed: boolean;
}

export interface UiActionPayload {
  x: number;
  y: number;
  kind: 'blacksmith' | 'shop';
  icon?: string;
  title?: string;
  text?: string;
  npc?: UiActionNpc;
}

export function isUiAction(value: unknown): value is UiAction {
  return typeof value === 'string' && (UI_ACTIONS as readonly string[]).includes(value);
}

function plainText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/[<>]/g, '')
    .slice(0, maxLength);
}

export function sanitizeUiActionPayload(action: UiAction, raw: unknown): UiActionPayload {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const payload: UiActionPayload = {
    x: clampInt(source.x, MIN_CELL, MAX_CELL),
    y: clampInt(source.y, MIN_CELL, MAX_CELL),
    kind: source.kind === 'blacksmith' ? 'blacksmith' : 'shop',
  };

  if (action === 'simple') {
    payload.icon = String(source.icon ?? '').slice(0, MAX_ICON);
    payload.title = plainText(source.title, MAX_TITLE);
    payload.text = plainText(source.text, MAX_TEXT);
  }

  if (action === 'npc' && source.npc && typeof source.npc === 'object') {
    const npc = source.npc as Record<string, unknown>;
    payload.npc = {
      name: plainText(npc.name || 'NPC', MAX_NPC_NAME),
      role: plainText(npc.role, MAX_NPC_ROLE),
      service: String(npc.service ?? '').slice(0, MAX_NPC_SERVICE),
      icon: String(npc.icon ?? '').slice(0, MAX_ICON),
      lines: (Array.isArray(npc.lines) ? npc.lines : []).slice(0, MAX_NPC_LINES).map((line) => plainText(line, MAX_NPC_LINE)),
      serviceUsed: !!npc.serviceUsed,
    };
  }

  return payload;
}
