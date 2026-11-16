import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { CompartilharHandler, CompartilharProvider } from '../components/Compartilhar';
import { garantirCategorias } from '../db/repo';
import { DialogoHost, avisar } from '../lib/dialogo';
import { SessaoProvider, useSessao } from '../lib/sessao';
import { sincronizarAgenda } from '../services/calendar';
import { migrarDadosLocais } from '../services/migracao';
import { cores } from '../theme';

/** Redireciona para /login sem sessão; ao entrar, prepara dados e agenda. */
function Portao() {
  const { session, carregando } = useSessao();
  const segmentos = useSegments();
  const preparado = useRef<string | null>(null);

  useEffect(() => {
    if (carregando) return;
    const naLogin = segmentos[0] === 'login';
    if (!session && !naLogin) router.replace('/login');
    else if (session && naLogin) router.replace('/');
  }, [session, carregando, segmentos]);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid || preparado.current === uid) return;
    preparado.current = uid;
    (async () => {
      try {
        await garantirCategorias();
        const n = await migrarDadosLocais();
        if (n > 0) avisar('Dados migrados', `${n} curso(s) deste celular agora estão na nuvem.`);
        await sincronizarAgenda();
      } catch (e) {
        avisar('Erro ao preparar dados', e instanceof Error ? e.message : String(e));
      }
    })();
  }, [session]);

  // Ao voltar para o app, aplica na agenda o que mudou (ex.: editado no PC).
  useEffect(() => {
    if (!session) return;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') sincronizarAgenda().catch(() => {});
    });
    return () => sub.remove();
  }, [session]);

  if (carregando) {
    return (
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundo }}>
        <ActivityIndicator color={cores.primaria} />
      </View>
    );
  }
  return session ? <CompartilharHandler /> : null;
}

export default function RootLayout() {
  return (
    <CompartilharProvider>
      <SessaoProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: cores.fundo },
            headerShadowVisible: false,
            headerTintColor: cores.texto,
            contentStyle: { backgroundColor: cores.fundo },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="novo" options={{ title: 'Novo', presentation: 'modal' }} />
          <Stack.Screen name="evento/[id]" options={{ title: 'Detalhe' }} />
        </Stack>
        <Portao />
        <DialogoHost />
      </SessaoProvider>
    </CompartilharProvider>
  );
}
