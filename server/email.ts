/**
 * Envoi d'emails transactionnels, *pluggable* :
 * - self-hosted sans config → provider « console » (log seulement, l'app reste
 *   fonctionnelle grâce au lien d'invitation copiable dans l'UI) ;
 * - SaaS → Resend si `RESEND_API_KEY` est défini (API HTTP, aucune dépendance npm).
 *
 * Variables d'env : RESEND_API_KEY, EMAIL_FROM, APP_URL.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Bon Voyage <onboarding@resend.dev>';

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/** Fallback : log dans la console du serveur (aucun envoi réel). */
const consoleProvider: EmailProvider = {
  name: 'console',
  async send(message) {
    console.log(
      `📧 [email:console] to=${message.to} · ${message.subject}\n${message.text}\n` +
        '   (Configurez RESEND_API_KEY pour envoyer réellement.)',
    );
  },
};

/** Resend (https://resend.com) — 3000 emails/mois gratuits, API HTTP simple. */
function makeResendProvider(apiKey: string): EmailProvider {
  return {
    name: 'resend',
    async send(message) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Resend a échoué (${res.status}): ${detail}`);
      }
    },
  };
}

const provider: EmailProvider = RESEND_API_KEY
  ? makeResendProvider(RESEND_API_KEY)
  : consoleProvider;

/** true si un vrai fournisseur est configuré (sinon : afficher le lien dans l'UI). */
export const emailEnabled = provider.name !== 'console';

/**
 * Base URL publique pour construire les liens des emails.
 * `APP_URL` (recommandé en SaaS/prod) sinon on retombe sur l'origine de la requête.
 */
export function appUrl(requestOrigin?: string): string {
  return (process.env.APP_URL ?? requestOrigin ?? 'http://localhost:5173').replace(/\/$/, '');
}

/** Email d'invitation à un voyage. Ne jette pas : un échec n'annule pas l'invitation. */
export async function sendInvitationEmail(params: {
  to: string;
  tripTitle: string;
  inviterName: string;
  acceptUrl: string;
}): Promise<void> {
  const { to, tripTitle, inviterName, acceptUrl } = params;
  const subject = `${inviterName} vous invite à planifier « ${tripTitle} » sur Bon Voyage`;
  const text =
    `${inviterName} vous invite à rejoindre le voyage « ${tripTitle} » sur Bon Voyage.\n\n` +
    `Pour accepter, ouvrez ce lien :\n${acceptUrl}\n\n` +
    `Si vous n'avez pas encore de compte, vous pourrez en créer un avec cette adresse email.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#0f172a">
      <h2 style="margin:0 0 8px">🧭 Bon Voyage</h2>
      <p><strong>${escapeHtml(inviterName)}</strong> vous invite à rejoindre le voyage
      « <strong>${escapeHtml(tripTitle)}</strong> ».</p>
      <p style="margin:24px 0">
        <a href="${acceptUrl}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">
          Voir l'invitation
        </a>
      </p>
      <p style="font-size:13px;color:#64748b">
        Si vous n'avez pas encore de compte, vous pourrez en créer un avec cette adresse email.<br/>
        Ou copiez ce lien : <br/><a href="${acceptUrl}">${acceptUrl}</a>
      </p>
    </div>`;
  try {
    await provider.send({ to, subject, html, text });
  } catch (err) {
    console.error('[email] envoi de l’invitation impossible :', err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
