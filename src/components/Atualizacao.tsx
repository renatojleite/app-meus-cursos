import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  TEXTO_APLICAR,
  aplicarAtualizacao,
  rotuloVersao,
  verificarAtualizacao,
  type Checagem,
} from '../lib/atualizacao';
import { avisar, escolher } from '../lib/dialogo';
import { cores, espaco, raio } from '../theme';
import { Botao, s } from './ui';

function confirmarAplicar(nova?: string) {
  escolher('Atualizar versão', `${nova ? `Nova versão: ${nova}. ` : ''}${TEXTO_APLICAR}`, [
    { text: 'Agora não', style: 'cancel' },
    { text: 'Atualizar', onPress: () => aplicarAtualizacao() },
  ]);
}

/** Aviso discreto no topo da lista quando há versão nova (verifica ao abrir). */
export function BannerAtualizacao() {
  const [info, setInfo] = useState<Checagem | null>(null);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    verificarAtualizacao().then(setInfo).catch(() => {});
  }, []);

  if (!info?.disponivel || fechado) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: cores.primariaSuave,
        borderRadius: raio.md,
        paddingVertical: 8,
        paddingHorizontal: espaco.md,
        marginBottom: espaco.sm,
        gap: 8,
      }}
    >
      <Text style={{ flex: 1, color: cores.texto }}>✨ Nova versão disponível</Text>
      <Pressable onPress={() => confirmarAplicar(info.nova)}>
        <Text style={{ color: cores.primaria, fontWeight: '700' }}>Atualizar</Text>
      </Pressable>
      <Pressable onPress={() => setFechado(true)} hitSlop={8}>
        <Text style={{ color: cores.textoSuave }}>✕</Text>
      </Pressable>
    </View>
  );
}

/** Bloco para a tela de Configurações. */
export function VersaoApp() {
  const [verificando, setVerificando] = useState(false);

  const verificar = useCallback(async () => {
    setVerificando(true);
    try {
      const r = await verificarAtualizacao();
      if (r.disponivel) confirmarAplicar(r.nova);
      else avisar('Tudo certo', 'Você já está na versão mais recente.');
    } catch (e) {
      avisar('Atualizar versão', e instanceof Error ? e.message : String(e));
    } finally {
      setVerificando(false);
    }
  }, []);

  return (
    <View>
      <Text style={[s.dica, { marginBottom: espaco.md }]}>Versão instalada: {rotuloVersao()}</Text>
      <Botao titulo="Atualizar versão" variante="secundario" carregando={verificando} onPress={verificar} />
    </View>
  );
}
