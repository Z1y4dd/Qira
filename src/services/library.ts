/**
 * Service Layer module — leveled-text library.
 *
 * RULES (see profiles.ts for full rules):
 *   - NO `next/*` imports. Framework-agnostic.
 *   - All Arabic strings written through `nfc()` before persistence.
 *
 * Functions throw until Phase 4 lands the reader vertical.
 */
import { nfc } from '@/db/normalize';

export type TextId = string & { readonly __brand: 'TextId' };

export interface LeveledText {
  id: TextId;
  level: number;
  titleAr: string;
  bodyAr: string;
  /** Tashkeel default for this text. Levels 1-10 default ON, 11-20 default OFF. */
  tashkeelDefault: 'on' | 'off';
  illustrationUrl: string | null;
}

export function listTextsForLevel(_levelId: number): Promise<LeveledText[]> {
  throw new Error('library.listTextsForLevel: not implemented until Phase 4');
}

export function getText(_textId: TextId): Promise<LeveledText | null> {
  throw new Error('library.getText: not implemented until Phase 4');
}

export interface InsertTextInput {
  level: number;
  titleAr: string;
  bodyAr: string;
  tashkeelDefault: 'on' | 'off';
  illustrationUrl: string | null;
}

export function insertText(input: InsertTextInput): Promise<LeveledText> {
  // NFC-normalize Arabic fields at the boundary, before any DB write.
  // The Zod ArabicText schema will then validate the result downstream.
  const normalized = nfc(input, ['titleAr', 'bodyAr']);
  void normalized;
  throw new Error('library.insertText: not implemented until Phase 4');
}
