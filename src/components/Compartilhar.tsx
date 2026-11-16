/** Recebe links/imagens do "Compartilhar" do Android e abre a tela Novo. */
import { router } from 'expo-router';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import React, { useEffect } from 'react';
import { extrairUrl } from '../services/link';

function Handler() {
  const { hasShareIntent, shareIntent, resetShareIntent, isReady } = useShareIntentContext();

  useEffect(() => {
    if (!isReady || !hasShareIntent) return;
    const texto = shareIntent.text ?? '';
    const link = shareIntent.webUrl ?? extrairUrl(texto) ?? '';
    const img = shareIntent.files?.find((f) => f.mimeType?.startsWith('image/'));
    const legenda = texto && texto.trim() !== link ? texto : '';
    router.push({
      pathname: '/novo',
      params: { link, legenda, imagem: img?.path ?? '', mime: img?.mimeType ?? '', t: String(Date.now()) },
    });
    resetShareIntent();
  }, [isReady, hasShareIntent, shareIntent, resetShareIntent]);

  return null;
}

export function CompartilharProvider({ children }: { children: React.ReactNode }) {
  return <ShareIntentProvider options={{ resetOnBackground: true }}>{children}</ShareIntentProvider>;
}

/** Só deve ser montado com o usuário logado. */
export function CompartilharHandler() {
  return <Handler />;
}
