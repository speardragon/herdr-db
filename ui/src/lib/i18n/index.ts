import { createContext, useContext } from 'react';
import { en, type Messages } from './en';
import { ko } from './ko';

export type Locale = 'en' | 'ko';
export type LocalePreference = 'auto' | Locale;
export type { Messages };

export const MESSAGES: Record<Locale, Messages> = { en, ko };

/** `auto` follows the first system language we have a translation for, else English. */
export function resolveLocale(preference: LocalePreference, languages: readonly string[] = navigator.languages): Locale {
  if (preference !== 'auto') return preference;
  const match = languages.map((language) => language.toLowerCase().split('-')[0]).find((code): code is Locale => code in MESSAGES);
  return match ?? 'en';
}

export const I18nContext = createContext<Messages>(en);

export function useT(): Messages {
  return useContext(I18nContext);
}
