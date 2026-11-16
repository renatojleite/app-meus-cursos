import { getShareExtensionKey } from 'expo-share-intent';

/**
 * O share intent pode chegar como deep link (ex.: meuscursos://dataUrl=...).
 * Redirecionamos para a raiz — o ShareHandler do _layout cuida de abrir "Novo".
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) return '/';
    return path;
  } catch {
    return '/';
  }
}
