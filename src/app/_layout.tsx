import { Stack, router } from 'expo-router';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { DB_NAME, migrar } from '../db/schema';
import { extrairUrl } from '../services/extract';
import { cores } from '../theme';

/** Quando o app recebe algo via "Compartilhar", abre a tela Novo já preenchida. */
function ShareHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent, isReady } = useShareIntentContext();

  useEffect(() => {
    if (!isReady || !hasShareIntent) return;
    const texto = shareIntent.text ?? '';
    const link = shareIntent.webUrl ?? extrairUrl(texto) ?? '';
    const img = shareIntent.files?.find((f) => f.mimeType?.startsWith('image/'));
    const legenda = texto && texto.trim() !== link ? texto : '';

    router.push({
      pathname: '/novo',
      params: {
        link,
        legenda,
        imagem: img?.path ?? '',
        mime: img?.mimeType ?? '',
        t: String(Date.now()),
      },
    });
    resetShareIntent();
  }, [isReady, hasShareIntent, shareIntent, resetShareIntent]);

  return null;
}

export default function RootLayout() {
  return (
    <ShareIntentProvider options={{ resetOnBackground: true }}>
      <SQLiteProvider databaseName={DB_NAME} onInit={migrar}>
        <StatusBar style="dark" />
        <ShareHandler />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: cores.fundo },
            headerShadowVisible: false,
            headerTintColor: cores.texto,
            contentStyle: { backgroundColor: cores.fundo },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="novo" options={{ title: 'Novo', presentation: 'modal' }} />
          <Stack.Screen name="evento/[id]" options={{ title: 'Detalhe' }} />
        </Stack>
      </SQLiteProvider>
    </ShareIntentProvider>
  );
}
