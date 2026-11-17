/**
 * Atualização na web / app do PC: compara o pacote JS carregado com o do
 * index.html publicado. Se mudou, basta recarregar a página.
 */
const BASE = '/app-meus-cursos/';

function pacoteAtual(): string | null {
  const s = Array.from(document.querySelectorAll('script[src]'))
    .map((el) => (el as HTMLScriptElement).src)
    .find((src) => /\/entry-[a-f0-9]+\.js/.test(src));
  return s?.match(/entry-([a-f0-9]+)\.js/)?.[1] ?? null;
}

export const BUILD_ATUAL = 0;

export function rotuloVersao() {
  const p = pacoteAtual();
  return p ? `web ${p.slice(0, 7)}` : 'web';
}

export interface Checagem {
  disponivel: boolean;
  nova?: string;
}

export async function verificarAtualizacao(): Promise<Checagem> {
  const r = await fetch(`${BASE}index.html?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Não foi possível verificar agora.');
  const html = await r.text();
  const publicado = html.match(/entry-([a-f0-9]+)\.js/)?.[1] ?? null;
  const atual = pacoteAtual();
  return {
    disponivel: !!publicado && !!atual && publicado !== atual,
    nova: publicado ? `web ${publicado.slice(0, 7)}` : undefined,
  };
}

export async function aplicarAtualizacao() {
  // O GitHub Pages guarda o index.html em cache por alguns minutos: muda a URL para buscar o novo.
  window.location.replace(`${BASE}?v=${Date.now()}`);
}

export const TEXTO_APLICAR = 'A página vai recarregar com a versão mais recente.';
