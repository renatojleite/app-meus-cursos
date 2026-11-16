/**
 * Diálogos multiplataforma. No celular usa o Alert nativo; na web (onde
 * Alert.alert não faz nada) mostra um modal próprio via <DialogoHost />.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, Text, View } from 'react-native';
import { cores, espaco, raio } from '../theme';

export interface BotaoDialogo {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface Pedido {
  titulo: string;
  mensagem?: string;
  botoes: BotaoDialogo[];
}

let ouvinte: ((p: Pedido | null) => void) | null = null;

export function escolher(titulo: string, mensagem: string | undefined, botoes: BotaoDialogo[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(titulo, mensagem, botoes);
    return;
  }
  ouvinte?.({ titulo, mensagem, botoes });
}

export function avisar(titulo: string, mensagem?: string) {
  escolher(titulo, mensagem, [{ text: 'OK' }]);
}

export function DialogoHost() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  useEffect(() => {
    ouvinte = setPedido;
    return () => {
      ouvinte = null;
    };
  }, []);
  if (Platform.OS !== 'web' || !pedido) return null;

  const fechar = (b?: BotaoDialogo) => {
    setPedido(null);
    b?.onPress?.();
  };
  const cancelar = pedido.botoes.find((b) => b.style === 'cancel');

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => fechar(cancelar)}>
      <Pressable
        style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center', alignItems: 'center', padding: espaco.xl }}
        onPress={() => fechar(cancelar)}
      >
        <Pressable
          style={{ backgroundColor: cores.card, borderRadius: raio.lg, padding: espaco.xl, width: '100%', maxWidth: 420 }}
          onPress={() => {}}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: cores.texto }}>{pedido.titulo}</Text>
          {pedido.mensagem ? (
            <Text style={{ color: cores.textoSuave, marginTop: espaco.sm, lineHeight: 20 }}>{pedido.mensagem}</Text>
          ) : null}
          <View style={{ marginTop: espaco.lg, gap: espaco.sm }}>
            {pedido.botoes.map((b) => (
              <Pressable
                key={b.text}
                onPress={() => fechar(b)}
                style={({ hovered }: any) => ({
                  paddingVertical: 11,
                  paddingHorizontal: espaco.lg,
                  borderRadius: raio.md,
                  alignItems: 'center',
                  backgroundColor:
                    b.style === 'cancel' ? 'transparent' : hovered ? cores.primaria : cores.primariaSuave,
                })}
              >
                {({ hovered }: any) => (
                  <Text
                    style={{
                      fontWeight: '600',
                      color:
                        b.style === 'destructive'
                          ? cores.perigo
                          : b.style === 'cancel'
                            ? cores.textoSuave
                            : hovered
                              ? '#fff'
                              : cores.primaria,
                    }}
                  >
                    {b.text}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
