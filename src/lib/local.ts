/** Preferências deste aparelho (não sincronizam): agenda nativa e vínculos evento→agenda. */
import AsyncStorage from '@react-native-async-storage/async-storage';

const K_CAL = 'agenda_calendar_id';
const K_SYNC = 'agenda_sync';
const K_MAPA = 'agenda_mapa_v1';

export interface VinculoAgenda {
  calEventId: string;
  hash: string;
}
export type MapaAgenda = Record<string, VinculoAgenda>;

export async function getCalendarId() {
  return AsyncStorage.getItem(K_CAL);
}
export async function setCalendarId(id: string | null) {
  if (id) await AsyncStorage.setItem(K_CAL, id);
  else await AsyncStorage.removeItem(K_CAL);
}

export async function getSyncAgenda() {
  return (await AsyncStorage.getItem(K_SYNC)) !== '0';
}
export async function setSyncAgenda(v: boolean) {
  await AsyncStorage.setItem(K_SYNC, v ? '1' : '0');
}

export async function getMapa(): Promise<MapaAgenda> {
  try {
    return JSON.parse((await AsyncStorage.getItem(K_MAPA)) ?? '{}');
  } catch {
    return {};
  }
}
export async function setMapa(m: MapaAgenda) {
  await AsyncStorage.setItem(K_MAPA, JSON.stringify(m));
}

export async function getFlag(k: string) {
  return (await AsyncStorage.getItem(k)) === '1';
}
export async function setFlag(k: string) {
  await AsyncStorage.setItem(k, '1');
}
