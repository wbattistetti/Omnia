/**
 * Risolve le stringhe UI del date picker da `locales/datePicker.json` in base a project.lang.
 */

import datePickerRaw from '../../locales/datePicker.json';

export type DatePickerLang = 'it' | 'en' | 'es';

export type DatePickerStrings = {
  today: string;
  tomorrow: string;
  apply: string;
  cancel: string;
  openCalendar: string;
  wheelHint: string;
  wheelMonthColumn: string;
  wheelYearColumn: string;
  monthUp: string;
  monthDown: string;
  yearUp: string;
  yearDown: string;
  weekdaysShort: string[];
  months: string[];
};

type Tri = { it: string; en: string; es: string };

type JsonBundle = typeof datePickerRaw;

function readProjectLang(): DatePickerLang {
  if (typeof localStorage === 'undefined') return 'it';
  const raw = (localStorage.getItem('project.lang') || 'it').toLowerCase();
  if (raw === 'en' || raw === 'es') return raw;
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('es')) return 'es';
  return 'it';
}

function pickTri(map: Tri, lang: DatePickerLang): string {
  return map[lang] ?? map.it ?? map.en;
}

function pickWeekdays(map: JsonBundle['weekdaysShort'], lang: DatePickerLang): string[] {
  const a = map[lang] ?? map.it ?? map.en;
  return Array.isArray(a) ? a : [];
}

function pickMonths(map: JsonBundle['months'], lang: DatePickerLang): string[] {
  const a = map[lang] ?? map.it ?? map.en;
  return Array.isArray(a) ? a : [];
}

export function getDatePickerUiLang(): DatePickerLang {
  return readProjectLang();
}

export function getDatePickerStrings(lang?: DatePickerLang): DatePickerStrings {
  const l = lang ?? readProjectLang();
  return {
    today: pickTri(datePickerRaw.today, l),
    tomorrow: pickTri(datePickerRaw.tomorrow, l),
    apply: pickTri(datePickerRaw.apply, l),
    cancel: pickTri(datePickerRaw.cancel, l),
    openCalendar: pickTri(datePickerRaw.openCalendar, l),
    wheelHint: pickTri(datePickerRaw.wheelHint, l),
    wheelMonthColumn: pickTri(datePickerRaw.wheelMonthColumn, l),
    wheelYearColumn: pickTri(datePickerRaw.wheelYearColumn, l),
    monthUp: pickTri(datePickerRaw.monthUp, l),
    monthDown: pickTri(datePickerRaw.monthDown, l),
    yearUp: pickTri(datePickerRaw.yearUp, l),
    yearDown: pickTri(datePickerRaw.yearDown, l),
    weekdaysShort: pickWeekdays(datePickerRaw.weekdaysShort, l),
    months: pickMonths(datePickerRaw.months, l),
  };
}
