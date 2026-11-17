// Edge Function "enriquecer": lê a página do link e pede ao Claude (com web search)
// para estruturar o evento. A chave da Anthropic fica só aqui (secret ANTHROPIC_API_KEY).
// Acesso: usuários em public.ia_permitidos (ou e-mails no secret opcional ALLOWED_EMAILS).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { extrairPagina, type Extracao } from './extract.ts';
import { SISTEMA } from './prompt.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

interface Entrada {
  link?: string;
  legenda?: string;
  imagemBase64?: string | null;
  imagemMime?: string;
  categorias?: string[];
  tagsExistentes?: string[];
  hoje?: string;
}

type Bloco = { type: string; text?: string; [k: string]: unknown };

function payloadDoToken(req: Request): Record<string, unknown> | null {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const parte = token.split('.')[1];
  if (!parte) return null;
  try {
    const b64 = parte.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
  } catch {
    return null;
  }
}

/** Permissão: e-mail no secret opcional ALLOWED_EMAILS ou usuário em public.ia_permitidos (consulta com o token do próprio usuário, via RLS). */
async function podeUsarIA(req: Request): Promise<boolean> {
  const payload = payloadDoToken(req);
  const sub = typeof payload?.sub === 'string' ? payload.sub : null;
  const email = typeof payload?.email === 'string' ? payload.email.toLowerCase() : null;
  if (!sub) return false;

  const permitidos = (Deno.env.get('ALLOWED_EMAILS') ?? '')
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, '').toLowerCase())
    .filter(Boolean);
  if (email && permitidos.includes(email)) return true;

  const url = Deno.env.get('SUPABASE_URL');
  const apikey = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!url || !apikey) return false;
  try {
    const r = await fetch(`${url}/rest/v1/ia_permitidos?select=user_id&user_id=eq.${sub}`, {
      headers: { apikey, authorization: req.headers.get('authorization') ?? '' },
    });
    if (!r.ok) return false;
    const linhas = await r.json();
    return Array.isArray(linhas) && linhas.length > 0;
  } catch {
    return false;
  }
}

function montarContexto(e: Entrada, x: Extracao | null): string {
  const partes = [
    `Hoje é ${e.hoje ?? new Date().toISOString().slice(0, 10)}.`,
    `Link: ${e.link ?? ''}`,
    x?.urlFinal && x.urlFinal !== e.link ? `URL final após redirecionamento: ${x.urlFinal}` : '',
    x ? `Plataforma detectada: ${x.plataforma}` : '',
    x?.youtube ? `YouTube — vídeo: "${x.youtube.titulo}" | canal: ${x.youtube.canal} (${x.youtube.canalUrl})` : '',
    x?.titulo ? `Título da página: ${x.titulo}` : '',
    x?.siteName ? `Site: ${x.siteName}` : '',
    x?.descricao ? `Descrição da página: ${x.descricao}` : '',
    x?.instagramHandles.length ? `Perfis do Instagram citados na página: ${x.instagramHandles.map((h) => '@' + h).join(', ')}` : '',
    x?.jsonLd ? `Dados estruturados (JSON-LD):\n${x.jsonLd}` : '',
    x?.texto ? `Trecho do texto da página:\n${x.texto}` : '',
    x?.erro ? `(Não foi possível ler a página: ${x.erro})` : '',
    e.legenda?.trim() ? `Legenda/texto colado pelo usuário:\n${e.legenda.trim()}` : '',
    e.imagemBase64 ? 'Há um print anexado (post ou perfil). Leia todas as informações dele.' : '',
    `Categorias disponíveis: ${(e.categorias ?? []).join(' | ')}`,
    e.tagsExistentes?.length ? `Tags já usadas pelo usuário: ${e.tagsExistentes.join(', ')}` : '',
  ];
  return partes.filter(Boolean).join('\n\n');
}

async function chamarClaude(apiKey: string, body: object) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(130_000),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = j?.error?.message || `HTTP ${r.status}`;
    if (r.status === 401) throw new Error('Chave da Anthropic inválida (secret ANTHROPIC_API_KEY).');
    if (r.status === 429) throw new Error('Limite da API atingido. Tente de novo em instantes.');
    if (/credit|billing/i.test(msg)) throw new Error('Sem créditos na conta da Anthropic.');
    throw new Error(`Erro da API: ${msg}`);
  }
  return j as { content: Bloco[]; stop_reason: string };
}

function extrairJson(texto: string): unknown {
  const limpo = texto.replace(/```json|```/g, '');
  const ini = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (ini < 0 || fim <= ini) throw new Error('A IA não retornou dados estruturados.');
  return JSON.parse(limpo.slice(ini, fim + 1));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  if (!(await podeUsarIA(req))) {
    return json({ error: 'Usuário sem permissão para usar a IA.' }, 403);
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Chave da Anthropic não configurada no servidor.' }, 500);
  const modelo = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-5-5';

  try {
    const e = (await req.json()) as Entrada;
    const link = (e.link ?? '').trim();
    const extracao = link ? await extrairPagina(link) : null;

    const conteudo: object[] = [];
    if (e.imagemBase64) {
      conteudo.push({
        type: 'image',
        source: { type: 'base64', media_type: e.imagemMime || 'image/jpeg', data: e.imagemBase64 },
      });
    }
    conteudo.push({ type: 'text', text: montarContexto(e, extracao) });

    const messages: { role: 'user' | 'assistant'; content: unknown }[] = [{ role: 'user', content: conteudo }];
    let resp: { content: Bloco[]; stop_reason: string } | null = null;
    for (let i = 0; i < 4; i++) {
      resp = await chamarClaude(apiKey, {
        model: modelo,
        max_tokens: 4096,
        system: SISTEMA,
        messages,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      });
      if (resp.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: resp.content });
    }
    const texto = (resp?.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n');

    return json({ resultado: extrairJson(texto), plataforma: extracao?.plataforma ?? '' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg.includes('aborted') || msg.includes('timed out') ? 'A IA demorou demais. Tente novamente.' : msg }, 502);
  }
});
