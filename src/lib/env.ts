function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/** Accept PEM directly or base64-encoded PEM (easier in .env files). */
const pem = (v: string) => (v.includes('BEGIN') ? v : Buffer.from(v, 'base64').toString('utf8'));

export const env = {
  baseUrl: () => (process.env.VIMBA_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  issuerId: () => process.env.VIMBA_ISSUER_ID ?? 'vimba-demo-issuer',
  issuerBasis: () =>
    process.env.VIMBA_ISSUER_BASIS ??
    'Demo issuer operated by the Vimba hackathon team. Not ZMC accreditation or an external trust-list listing.',
  signingKeyId: () => required('VIMBA_SIGNING_KEY_ID'),
  signingPrivateKey: () => pem(required('VIMBA_SIGNING_PRIVATE_KEY')),
  signingPublicKey: () => pem(required('VIMBA_SIGNING_PUBLIC_KEY')),
  appSecret: () => required('VIMBA_APP_SECRET'),
  workerSecret: () => process.env.VIMBA_WORKER_SECRET ?? '',
  kapsoApiKey: () => process.env.KAPSO_API_KEY ?? '',
  kapsoPhoneNumberId: () => process.env.KAPSO_PHONE_NUMBER_ID ?? '',
  kapsoWebhookSecret: () => process.env.KAPSO_WEBHOOK_SECRET ?? '',
  whatsappPublicNumber: () => (process.env.WHATSAPP_PUBLIC_NUMBER ?? '').replace(/\D/g, ''),
  senderPepper: () => required('CHANNEL_SENDER_PEPPER'),
  monthlyMessageSoftCap: () => Number(process.env.WHATSAPP_SOFT_CAP ?? 1600),
  /**
   * Shona and Ndebele packs ship as drafts until a fluent reviewer signs them
   * off. While this is true, draft packs are offered with a visible notice;
   * set it to false in a pilot so only reviewed packs reach the public.
   */
  allowDraftLocales: () => (process.env.VIMBA_ALLOW_DRAFT_LOCALES ?? 'true') === 'true',
};
