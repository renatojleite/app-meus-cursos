import type { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const Ctx = createContext<{ session: Session | null; carregando: boolean }>({
  session: null,
  carregando: true,
});

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregando(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_ev, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return <Ctx.Provider value={{ session, carregando }}>{children}</Ctx.Provider>;
}

export const useSessao = () => useContext(Ctx);
