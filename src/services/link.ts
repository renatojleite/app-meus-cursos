export function extrairUrl(texto: string): string | null {
  const m = texto.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[),.;!?]+$/, '') : null;
}

export function detectarPlataforma(url: string): string {
  let h = '';
  try {
    h = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'Site';
  }
  if (h.includes('instagram.com')) return 'Instagram';
  if (h.includes('youtube.com') || h === 'youtu.be') return 'YouTube';
  if (h.includes('sympla')) return 'Sympla';
  if (h.includes('hotmart')) return 'Hotmart';
  if (h.includes('even3')) return 'Even3';
  if (h.includes('eventbrite')) return 'Eventbrite';
  if (h.includes('udemy')) return 'Udemy';
  if (h.includes('linkedin')) return 'LinkedIn';
  if (h.includes('kiwify')) return 'Kiwify';
  if (h.includes('meetup')) return 'Meetup';
  return h || 'Site';
}
