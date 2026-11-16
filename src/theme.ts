export const cores = {
  fundo: '#F6F5F2',
  card: '#FFFFFF',
  texto: '#1B1C1F',
  textoSuave: '#6B6F76',
  borda: '#E4E2DC',
  primaria: '#4338CA',
  primariaSuave: '#E8E7FB',
  perigo: '#C2410C',
  sucesso: '#1E9E5A',
};

export const espaco = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const raio = { sm: 8, md: 12, lg: 16, pill: 999 };

/** Limita a largura do conteúdo em telas grandes (PC) e centraliza. */
export const larguraMax = { width: '100%' as const, maxWidth: 760, alignSelf: 'center' as const };
