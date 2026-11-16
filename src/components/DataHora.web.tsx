import React from 'react';
import { View } from 'react-native';
import { cores, raio } from '../theme';

/** Converte ISO → valor do <input type="datetime-local"> (hora local). */
function paraInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function DataHora({
  valor,
  placeholder,
  onChange,
}: {
  valor: string | null;
  placeholder: string;
  sugestao?: string | null;
  onChange: (iso: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      {React.createElement('input', {
        type: 'datetime-local',
        value: paraInput(valor),
        'aria-label': placeholder,
        title: placeholder,
        onChange: (ev: { target: { value: string } }) => {
          const v = ev.target.value;
          if (!v) return;
          const d = new Date(v); // interpretado como hora local
          if (!isNaN(d.getTime())) onChange(d.toISOString());
        },
        style: {
          fontSize: 15,
          padding: '9px 12px',
          borderRadius: raio.sm,
          border: `1px solid ${cores.borda}`,
          background: cores.card,
          color: valor ? cores.texto : cores.textoSuave,
          fontFamily: 'inherit',
        },
      })}
    </View>
  );
}
