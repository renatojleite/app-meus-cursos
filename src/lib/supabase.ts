import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Chaves públicas (protegidas por RLS). A chave da Anthropic fica só na Edge Function.
export const SUPABASE_URL = 'https://wwwiuzmpthyhiwoqcafv.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_iiswRVm47J90nK4svWQFEw_QPAdsiwC';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// No celular, renova o token só com o app em primeiro plano.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
