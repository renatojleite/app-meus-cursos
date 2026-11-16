import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getConfig, setConfig } from '../db/repo';

const KEY_API = 'anthropic_api_key';
export const MODELO_PADRAO = 'claude-sonnet-5-5';

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_API);
}

export async function setApiKey(v: string | null) {
  if (v && v.trim()) await SecureStore.setItemAsync(KEY_API, v.trim());
  else await SecureStore.deleteItemAsync(KEY_API);
}

export async function getModelo(db: SQLiteDatabase): Promise<string> {
  return (await getConfig(db, 'modelo')) || MODELO_PADRAO;
}

export async function setModelo(db: SQLiteDatabase, v: string) {
  await setConfig(db, 'modelo', v.trim() || MODELO_PADRAO);
}

export async function getCalendarId(db: SQLiteDatabase): Promise<string | null> {
  return getConfig(db, 'calendar_id');
}

export async function setCalendarId(db: SQLiteDatabase, id: string | null) {
  await setConfig(db, 'calendar_id', id);
}

export async function getSyncAgenda(db: SQLiteDatabase): Promise<boolean> {
  const v = await getConfig(db, 'sync_agenda');
  return v !== '0';
}

export async function setSyncAgenda(db: SQLiteDatabase, ligado: boolean) {
  await setConfig(db, 'sync_agenda', ligado ? '1' : '0');
}
