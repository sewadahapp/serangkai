import { DEFAULT_THEME, isThemeId, type ThemeId } from '#shared/themes'

/**
 * Browser-scoped color theme preference.
 *
 * A cookie keeps the choice readable during SSR so the root `data-*` attribute
 * is present in the first HTML response; there is no flash of the default
 * theme. The public share reader and signed-out pages use the same cookie,
 * which is why this is not stored on the owner row.
 */
export function useAppTheme() {
  const stored = useCookie<ThemeId>('serangkai-theme', {
    default: () => DEFAULT_THEME,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  })

  return computed<ThemeId>({
    get: () => (isThemeId(stored.value) ? stored.value : DEFAULT_THEME),
    set: (value) => {
      stored.value = isThemeId(value) ? value : DEFAULT_THEME
    },
  })
}
