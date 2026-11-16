import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { cores, espaco, raio } from '../theme';

export function Chip({
  label,
  ativo,
  onPress,
  onLongPress,
  cor,
  pequeno,
}: {
  label: string;
  ativo?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  cor?: string;
  pequeno?: boolean;
}) {
  const c = cor ?? cores.primaria;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        s.chip,
        pequeno && s.chipPequeno,
        ativo ? { backgroundColor: c, borderColor: c } : { borderColor: cores.borda },
      ]}
    >
      <Text style={[s.chipTxt, pequeno && { fontSize: 12 }, ativo && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Botao({
  titulo,
  onPress,
  variante = 'primario',
  carregando,
  desabilitado,
  style,
}: {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'perigo' | 'texto';
  carregando?: boolean;
  desabilitado?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variante === 'primario'
      ? cores.primaria
      : variante === 'perigo'
        ? cores.perigo
        : variante === 'secundario'
          ? cores.primariaSuave
          : 'transparent';
  const fg = variante === 'primario' || variante === 'perigo' ? '#fff' : cores.primaria;
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado || carregando}
      style={({ pressed }) => [
        s.botao,
        { backgroundColor: bg, opacity: desabilitado ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[s.botaoTxt, { color: fg }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

export function Campo({
  rotulo,
  dica,
  ...props
}: TextInputProps & { rotulo: string; dica?: string }) {
  return (
    <View style={{ marginBottom: espaco.md }}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <TextInput
        placeholderTextColor={cores.textoSuave}
        {...props}
        style={[s.input, props.multiline && { minHeight: 80, textAlignVertical: 'top' }, props.style]}
      />
      {dica ? <Text style={s.dica}>{dica}</Text> : null}
    </View>
  );
}

export function Rotulo({ children }: { children: React.ReactNode }) {
  return <Text style={s.rotulo}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Vazio({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: espaco.xl, marginTop: 40 }}>
      <Text style={{ fontSize: 17, fontWeight: '600', color: cores.texto }}>{titulo}</Text>
      {texto ? (
        <Text style={{ color: cores.textoSuave, marginTop: 6, textAlign: 'center' }}>{texto}</Text>
      ) : null}
    </View>
  );
}

export const s = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: raio.pill,
    borderWidth: 1,
    backgroundColor: cores.card,
    marginRight: 6,
    marginBottom: 6,
  },
  chipPequeno: { paddingHorizontal: 8, paddingVertical: 3 },
  chipTxt: { fontSize: 13, color: cores.texto, fontWeight: '500' },
  botao: {
    paddingVertical: 13,
    paddingHorizontal: espaco.lg,
    borderRadius: raio.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoTxt: { fontSize: 15, fontWeight: '600' },
  rotulo: {
    fontSize: 12,
    fontWeight: '600',
    color: cores.textoSuave,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: cores.card,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.sm,
    paddingHorizontal: espaco.md,
    paddingVertical: 10,
    fontSize: 15,
    color: cores.texto,
  },
  dica: { fontSize: 12, color: cores.textoSuave, marginTop: 4 },
  card: {
    backgroundColor: cores.card,
    borderRadius: raio.lg,
    padding: espaco.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: cores.borda,
  },
});
