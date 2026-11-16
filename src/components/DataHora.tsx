import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { formatarData } from '../format';
import { cores } from '../theme';
import { s } from './ui';

/** Campo de data+hora. No Android abre o seletor nativo (data, depois hora). */
export default function DataHora({
  valor,
  placeholder,
  sugestao,
  onChange,
}: {
  valor: string | null;
  placeholder: string;
  sugestao?: string | null;
  onChange: (iso: string) => void;
}) {
  const abrir = () => {
    const ref = valor ?? sugestao;
    const base = ref
      ? new Date(ref)
      : (() => {
          const d = new Date();
          d.setHours(19, 0, 0, 0);
          return d;
        })();
    DateTimePickerAndroid.open({
      value: base,
      mode: 'date',
      onChange: (ev, data) => {
        if (ev.type !== 'set' || !data) return;
        DateTimePickerAndroid.open({
          value: base,
          mode: 'time',
          is24Hour: true,
          onChange: (ev2, hora) => {
            const final = new Date(data);
            if (ev2.type === 'set' && hora) final.setHours(hora.getHours(), hora.getMinutes(), 0, 0);
            else final.setHours(base.getHours(), base.getMinutes(), 0, 0);
            onChange(final.toISOString());
          },
        });
      },
    });
  };

  return (
    <Pressable style={[s.input, { flex: 1 }]} onPress={abrir}>
      <Text style={{ color: valor ? cores.texto : cores.textoSuave }}>{valor ? formatarData(valor) : placeholder}</Text>
    </Pressable>
  );
}
