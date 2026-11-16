import {
  AlarmMethod,
  ExpoCalendar,
  ExpoCalendarEvent,
  getCalendarPermissions,
  getCalendars,
  requestCalendarPermissions,
} from 'expo-calendar';
import type { SQLiteDatabase } from 'expo-sqlite';
import { definirCalendarId, obterEvento, todosEventosComData } from '../db/repo';
import { STATUS_INFO, type Evento } from '../types';
import { getCalendarId, getSyncAgenda } from './settings';

export interface CalendarioInfo {
  id: string;
  titulo: string;
  conta: string;
  cor: string;
  principal: boolean;
}

export async function garantirPermissao(): Promise<boolean> {
  const atual = await getCalendarPermissions();
  if (atual.granted) return true;
  const r = await requestCalendarPermissions();
  return r.granted;
}

export async function listarCalendarios(): Promise<CalendarioInfo[]> {
  if (!(await garantirPermissao())) return [];
  const cals = await getCalendars();
  return cals
    .filter((c) => c.allowsModifications)
    .map((c) => ({
      id: c.id,
      titulo: c.title,
      conta: c.ownerAccount || c.source?.name || '',
      cor: c.color || '#888',
      principal: !!c.isPrimary,
    }))
    .sort((a, b) => Number(b.principal) - Number(a.principal) || a.conta.localeCompare(b.conta));
}

export function tituloAgenda(e: Pick<Evento, 'status' | 'titulo' | 'instagram'>): string {
  const emoji = STATUS_INFO[e.status].emoji;
  return `${emoji} ${e.titulo}${e.instagram ? ` — @${e.instagram}` : ''}`;
}

function notasAgenda(e: Evento): string {
  return [
    e.descricao,
    e.organizador ? `Organizador: ${e.organizador}` : null,
    e.instagram ? `Instagram: https://instagram.com/${e.instagram}` : null,
    e.gratuito ? 'Gratuito' : e.valor != null ? `Valor: R$ ${e.valor.toFixed(2).replace('.', ',')}` : null,
    `Status: ${STATUS_INFO[e.status].label}`,
    `Link: ${e.link}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function detalhes(e: Evento) {
  const inicio = new Date(e.data_inicio!);
  const fim = e.data_fim ? new Date(e.data_fim) : new Date(inicio.getTime() + 60 * 60 * 1000);
  return {
    title: tituloAgenda(e),
    startDate: inicio,
    endDate: fim > inicio ? fim : new Date(inicio.getTime() + 60 * 60 * 1000),
    notes: notasAgenda(e),
    location: e.formato === 'presencial' || e.formato === 'hibrido' ? e.local ?? e.link : e.link,
    alarms: [{ relativeOffset: -60, method: AlarmMethod.ALERT }],
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

async function apagarNativo(calEventId: string) {
  try {
    const ev = await ExpoCalendarEvent.get(calEventId);
    await ev.delete();
  } catch {
    // já não existe — ok
  }
}

export type ResultadoSync =
  | { ok: true; acao: 'criado' | 'atualizado' | 'removido' | 'nada' }
  | { ok: false; motivo: string };

/** Garante que a agenda nativa reflita o evento do banco. Nunca lança. */
export async function syncEvento(db: SQLiteDatabase, eventoId: number): Promise<ResultadoSync> {
  try {
    const e = await obterEvento(db, eventoId);
    if (!e) return { ok: true, acao: 'nada' };

    if (!e.data_inicio) {
      if (e.calendar_event_id) {
        await apagarNativo(e.calendar_event_id);
        await definirCalendarId(db, e.id, null);
        return { ok: true, acao: 'removido' };
      }
      return { ok: true, acao: 'nada' };
    }

    if (!(await getSyncAgenda(db))) return { ok: true, acao: 'nada' };
    const calId = await getCalendarId(db);
    if (!calId) return { ok: false, motivo: 'Escolha um calendário em Configurações.' };
    if (!(await garantirPermissao())) return { ok: false, motivo: 'Sem permissão para a agenda.' };

    const det = detalhes(e);

    if (e.calendar_event_id) {
      try {
        const ev = await ExpoCalendarEvent.get(e.calendar_event_id);
        if (ev.calendarId === calId) {
          await ev.update(det);
          return { ok: true, acao: 'atualizado' };
        }
        // calendário de destino mudou: recria no novo
        await ev.delete();
      } catch {
        // evento sumiu da agenda (apagado manualmente): recria
      }
    }

    const cal = await ExpoCalendar.get(calId);
    const novo = await cal.createEvent(det);
    await definirCalendarId(db, e.id, novo.id);
    return { ok: true, acao: 'criado' };
  } catch (err) {
    return { ok: false, motivo: err instanceof Error ? err.message : String(err) };
  }
}

export async function removerDaAgenda(calEventId: string | null) {
  if (!calEventId) return;
  if (!(await garantirPermissao())) return;
  await apagarNativo(calEventId);
}

export async function ressincronizarTudo(db: SQLiteDatabase) {
  const eventos = await todosEventosComData(db);
  let ok = 0;
  let falhas = 0;
  for (const e of eventos) {
    const r = await syncEvento(db, e.id);
    if (r.ok) ok++;
    else falhas++;
  }
  return { ok, falhas, total: eventos.length };
}
