/** Atualização do app no Android: compara o build instalado com a última Release do GitHub. */
import { Linking } from 'react-native';

const REPO = 'renatojleite/app-meus-cursos';
const DOWNLOAD = `https://github.com/${REPO}/releases/latest/download/meus-cursos.apk`;

/** Número do build gravado pelo CI (EXPO_PUBLIC_BUILD = github.run_number). 0 = desenvolvimento. */
export const BUILD_ATUAL = Number(process.env.EXPO_PUBLIC_BUILD ?? 0) || 0;

export function rotuloVersao() {
  return BUILD_ATUAL ? `build ${BUILD_ATUAL}` : 'desenvolvimento';
}

export interface Checagem {
  disponivel: boolean;
  nova?: string;
}

export async function verificarAtualizacao(): Promise<Checagem> {
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!r.ok) throw new Error('Não foi possível verificar agora.');
  const j = await r.json();
  const n = Number(String(j.tag_name ?? '').replace(/\D/g, '')) || 0;
  return { disponivel: BUILD_ATUAL > 0 && n > BUILD_ATUAL, nova: n ? `build ${n}` : undefined };
}

/** Abre o download do APK novo (instalar por cima mantém os dados). */
export async function aplicarAtualizacao() {
  await Linking.openURL(DOWNLOAD);
}

export const TEXTO_APLICAR =
  'O APK novo vai ser baixado pelo navegador. Abra o arquivo e toque em Atualizar; seus dados continuam no app.';
