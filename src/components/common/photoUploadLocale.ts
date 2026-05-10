/**
 * Didascalie upload foto da `locales/photoEditor.json`, allineate alla lingua progetto (come date picker).
 */

import photoEditorRaw from '../../locales/photoEditor.json';
import type { DatePickerLang } from '../FlowMappingPanel/datePickerLocale';
import { getDatePickerUiLang } from '../FlowMappingPanel/datePickerLocale';

type Triplet = { it: string; en: string; es: string };

function pick(tri: Triplet, lang: DatePickerLang): string {
  return tri[lang] ?? tri.it ?? tri.en;
}

/** Didascalia drop / incolla / clic (chiave `uploadCaption` nel JSON). */
export function getPhotoUploadCaption(lang?: DatePickerLang): string {
  const l = lang ?? getDatePickerUiLang();
  return pick(photoEditorRaw.uploadCaption as Triplet, l);
}
