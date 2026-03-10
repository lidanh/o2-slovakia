export const SUPPORTED_LOCALES = ['en', 'sk', 'hu'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'EN', sk: 'SK', hu: 'HU'
};
export const LOCALE_DISPLAY_NAMES: Record<SupportedLocale, string> = {
  en: 'English', sk: 'Slovenčina', hu: 'Magyar'
};
export const LOCALE_FLAGS: Record<SupportedLocale, string> = {
  en: '🇺🇸', sk: '🇸🇰', hu: '🇭🇺'
};
