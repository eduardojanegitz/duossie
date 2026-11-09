import "server-only";

/** Resultado padronizado das Server Actions. Mensagens já em PT-BR, seguras para exibir. */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

/** Códigos de erro levantados pelas funções do banco (`raise exception '<code>'`). */
const DOMAIN_MESSAGES: Record<string, string> = {
  not_authenticated: "Sua sessão expirou. Entre novamente.",
  already_in_duo: "Você já faz parte de uma dupla.",
  not_in_duo: "Você ainda não faz parte de uma dupla.",
  duo_full: "Esta dupla já está completa.",
  invalid_duo_name: "O nome da dupla deve ter entre 2 e 40 caracteres.",
  rate_limited: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
};

const GENERIC = "Algo deu errado. Tente novamente em instantes.";

/**
 * Converte um erro do Supabase/Postgres numa mensagem amigável.
 * Detalhes técnicos vão para o log do servidor, nunca para o cliente.
 */
export function toUserMessage(error: unknown, context: string): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";

  const known = DOMAIN_MESSAGES[message.trim()];
  if (known) return known;

  console.error(`[${context}]`, sanitizeForLog(error));
  return GENERIC;
}

function sanitizeForLog(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  if (typeof error === "object" && error !== null) {
    const { code, message } = error as { code?: unknown; message?: unknown };
    return { code, message };
  }
  return { error: String(error) };
}
