export async function lerBase64(_caminho: string): Promise<{ uri: string; base64: string }> {
  throw new Error('Indisponível na web');
}

export function limparBase64(b64: string | null | undefined): string | null {
  if (!b64) return null;
  const i = b64.indexOf('base64,');
  return i >= 0 ? b64.slice(i + 7) : b64;
}
