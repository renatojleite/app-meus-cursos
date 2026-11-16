import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatarData, formatarValor } from '../format';
import { cores, espaco, raio } from '../theme';
import { STATUS_INFO, type Evento } from '../types';

export default function EventoCard({
  evento,
  onPress,
  onLongPress,
}: {
  evento: Evento;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const st = STATUS_INFO[evento.status];
  const passado =
    evento.data_inicio && new Date(evento.data_fim ?? evento.data_inicio).getTime() < Date.now();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        backgroundColor: cores.card,
        borderRadius: raio.lg,
        padding: espaco.lg,
        marginBottom: espaco.sm,
        borderLeftWidth: 4,
        borderLeftColor: st.cor,
        opacity: pressed ? 0.85 : passado ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 12, color: st.cor, fontWeight: '700' }}>
          {st.emoji} {st.label.toUpperCase()}
        </Text>
        <Text style={{ fontSize: 12, color: cores.textoSuave }}>{formatarData(evento.data_inicio)}</Text>
      </View>
      <Text style={{ fontSize: 16, fontWeight: '600', color: cores.texto }} numberOfLines={2}>
        {evento.titulo}
      </Text>
      {(evento.organizador || evento.instagram) && (
        <Text style={{ fontSize: 13, color: cores.textoSuave, marginTop: 2 }} numberOfLines={1}>
          {[evento.organizador, evento.instagram ? `@${evento.instagram}` : null].filter(Boolean).join(' · ')}
        </Text>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 }}>
        {evento.categoria_nome ? <Etiqueta texto={evento.categoria_nome} forte /> : null}
        <Etiqueta texto={formatarValor(evento.gratuito, evento.valor)} />
        {evento.tags?.slice(0, 4).map((t) => <Etiqueta key={t} texto={`#${t}`} />)}
      </View>
    </Pressable>
  );
}

function Etiqueta({ texto, forte }: { texto: string; forte?: boolean }) {
  return (
    <Text
      style={{
        fontSize: 11,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: raio.pill,
        overflow: 'hidden',
        backgroundColor: forte ? cores.primariaSuave : '#F0EFEA',
        color: forte ? cores.primaria : cores.textoSuave,
        fontWeight: forte ? '600' : '400',
      }}
    >
      {texto}
    </Text>
  );
}
