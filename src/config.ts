import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(optional("PORT", "3000")),

  lark: {
    appId: optional("LARK_APP_ID"),
    appSecret: optional("LARK_APP_SECRET"),
    domain: optional("LARK_DOMAIN", "lark") as "lark" | "feishu",
    encryptKey: optional("LARK_ENCRYPT_KEY"),
    verificationToken: optional("LARK_VERIFICATION_TOKEN"),
    workspaceDomain: optional("LARK_WORKSPACE_DOMAIN"),
  },

  gemini: {
    apiKey: optional("GEMINI_API_KEY"),
    model: optional("GEMINI_MODEL", "gemini-flash-latest"),
  },

  email: {
    smtpHost: optional("EMAIL_SMTP_HOST"),
    smtpPort: Number(optional("EMAIL_SMTP_PORT", "465")),
    smtpSecure: optional("EMAIL_SMTP_SECURE", "true") === "true",
    imapHost: optional("EMAIL_IMAP_HOST"),
    imapPort: Number(optional("EMAIL_IMAP_PORT", "993")),
    user: optional("EMAIL_USER"),
    password: optional("EMAIL_PASSWORD"),
  },

  internalApi: {
    allowedBaseUrls: optional("INTERNAL_API_ALLOWED_BASE_URLS")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    token: optional("INTERNAL_API_TOKEN"),
  },

  defaults: {
    bitableAppToken: optional("DEFAULT_BITABLE_APP_TOKEN"),
    bitableTableId: optional("DEFAULT_BITABLE_TABLE_ID"),
    calendarId: optional("DEFAULT_CALENDAR_ID", "primary"),
  },
};

export function assertCoreConfig(): void {
  required("LARK_APP_ID");
  required("LARK_APP_SECRET");
  required("GEMINI_API_KEY");
}
