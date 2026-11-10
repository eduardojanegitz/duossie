/**
 * Formatação de datas com fuso fixo: servidor e navegador produzem o mesmo texto
 * (evita erro de hidratação quando os fusos diferem). Público-alvo no Brasil.
 */
export const TIME_ZONE = "America/Sao_Paulo";

export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(new Date(iso));

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: TIME_ZONE }).format(new Date(iso));

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE }).format(new Date(iso));
