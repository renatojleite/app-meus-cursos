/**
 * Extração local de metadados da página do link.
 * Tudo aqui é "best effort": falhas viram campos vazios, nunca exceção.
 */

export interface Extracao {
  url: string;
  urlFinal: string | null;
  plataforma: string;
  titulo: string | null;
  descricao: string | null;
  siteName: string | null;
  instagramHandles: string[];
  jsonLd: string | null;
  texto: string | null;
  youtube?: { titulo: string; canal: string; canalUrl: string } | null;
  erro?: string;
}

const UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

const IG_RESERVADOS = new Set([
  'p', 'reel', 'reels', 'tv', 'explore', 'stories', 'accounts', 'about', 'developer',
  'legal', 'direct', 'web', 'static', 'emails', 'privacy', 'terms', 'share',
]);

export function extrairUrl(texto: string): string | null {
  const m = texto.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[),.;!?]+$/, '') : null;
}

export function detectarPlataforma(url: string): string {
  const h = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  })();
  if (h.includes('instagram.com')) return 'Instagram';
  if (h.includes('youtube.com') || h === 'youtu.be') return 'YouTube';
  if (h.includes('sympla')) return 'Sympla';
  if (h.includes('hotmart')) return 'Hotmart';
  if (h.includes('even3')) return 'Even3';
  if (h.includes('eventbrite')) return 'Eventbrite';
  if (h.includes('udemy')) return 'Udemy';
  if (h.includes('linkedin')) return 'LinkedIn';
  if (h.includes('kiwify')) return 'Kiwify';
  if (h.includes('meetup')) return 'Meetup';
  return h || 'Site';
}

async function fetchTimeout(url: string, ms: number, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function meta(html: string, nomes: string[]): string | null {
  for (const nome of nomes) {
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${nome}["'][^>]*content=["']([^"']*)["']`,
      'i',
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${nome}["']`,
      'i',
    );
    const m = html.match(re1) || html.match(re2);
    if (m && m[1].trim()) return decodeEntities(m[1].trim());
  }
  return null;
}

function instagramHandles(html: string): string[] {
  const set = new Set<string>();
  const re = /instagram\.com\/([A-Za-z0-9._]{2,30})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const h = m[1].replace(/\.$/, '').toLowerCase();
    if (!IG_RESERVADOS.has(h)) set.add(h);
  }
  return Array.from(set).slice(0, 8);
}

function textoVisivel(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000);
}

function jsonLd(html: string): string | null {
  const blocos: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) blocos.push(m[1].trim());
  if (!blocos.length) return null;
  return blocos.join('\n').slice(0, 4000);
}

async function youtubeOembed(url: string) {
  try {
    const r = await fetchTimeout(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
      8000,
    );
    if (!r.ok) return null;
    const j = await r.json();
    return { titulo: j.title as string, canal: j.author_name as string, canalUrl: j.author_url as string };
  } catch {
    return null;
  }
}

export async function extrairPagina(url: string): Promise<Extracao> {
  const plataforma = detectarPlataforma(url);
  const base: Extracao = {
    url,
    urlFinal: null,
    plataforma,
    titulo: null,
    descricao: null,
    siteName: null,
    instagramHandles: [],
    jsonLd: null,
    texto: null,
  };

  if (plataforma === 'YouTube') base.youtube = await youtubeOembed(url);

  try {
    const r = await fetchTimeout(url, 12000, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' },
    });
    const html = (await r.text()).slice(0, 600_000);
    base.urlFinal = r.url || null;
    base.titulo =
      meta(html, ['og:title', 'twitter:title']) ||
      (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
        ? decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)![1].trim())
        : null);
    base.descricao = meta(html, ['og:description', 'description', 'twitter:description']);
    base.siteName = meta(html, ['og:site_name']);
    base.instagramHandles = instagramHandles(html);
    base.jsonLd = jsonLd(html);
    // Para o Instagram o texto visível é só a casca do app — não ajuda.
    base.texto = plataforma === 'Instagram' ? null : textoVisivel(html);
  } catch (e) {
    base.erro = e instanceof Error ? e.message : String(e);
  }

  // Link do próprio Instagram para um perfil: o handle já é a resposta.
  if (plataforma === 'Instagram') {
    const m = url.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
    if (m && !IG_RESERVADOS.has(m[1].toLowerCase())) {
      base.instagramHandles = [m[1].toLowerCase(), ...base.instagramHandles.filter((h) => h !== m[1].toLowerCase())];
    }
  }
  return base;
}
