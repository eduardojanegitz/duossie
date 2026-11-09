const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailpitSearch = { messages: { ID: string; Created: string }[] };

/** Aguarda o e-mail de OTP mais recente para `email` (enviado após `since`) e devolve o código. */
export async function waitForOtp(email: string, since: Date, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=5`);
    if (res.ok) {
      const body = (await res.json()) as MailpitSearch;
      const fresh = body.messages.find((m) => new Date(m.Created).getTime() >= since.getTime() - 1000);
      if (fresh) {
        const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${fresh.ID}`)).json()) as { Text: string; HTML: string };
        const match = /(\d{6})/.exec(msg.Text || msg.HTML);
        if (match?.[1]) return match[1];
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`OTP para ${email} não chegou ao Mailpit em ${timeoutMs}ms`);
}
