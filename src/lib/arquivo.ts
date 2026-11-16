import { File } from 'expo-file-system';

/** Lê um arquivo local (ex.: imagem recebida pelo "Compartilhar") em base64. */
export async function lerBase64(caminho: string): Promise<{ uri: string; base64: string }> {
  const f = new File(caminho.startsWith('file://') ? caminho : `file://${caminho}`);
  return { uri: f.uri, base64: await f.base64() };
}

/** Remove o prefixo "data:...;base64," se vier (web). */
export function limparBase64(b64: string | null | undefined): string | null {
  if (!b64) return null;
  const i = b64.indexOf('base64,');
  return i >= 0 ? b64.slice(i + 7) : b64;
}
