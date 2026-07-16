import { ImapFlow } from "imapflow";
import { config } from "../config";

export interface EmailSearchInput {
  from?: string;
  subject?: string;
  text?: string;
  limit?: number;
}

export interface EmailSearchResult {
  uid: number;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export async function searchEmails(input: EmailSearchInput): Promise<EmailSearchResult[]> {
  const client = new ImapFlow({
    host: config.email.imapHost,
    port: config.email.imapPort,
    secure: true,
    auth: { user: config.email.user, pass: config.email.password },
    logger: false,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const limit = input.limit ?? 10;
      const uids = await client.search(
        {
          from: input.from,
          subject: input.subject,
          text: input.text,
        },
        { uid: true }
      );

      if (!uids || uids.length === 0) return [];

      const recentUids = uids.slice(-limit).reverse();
      const results: EmailSearchResult[] = [];
      for await (const message of client.fetch(recentUids, { envelope: true, bodyStructure: true }, { uid: true })) {
        results.push({
          uid: message.uid,
          subject: message.envelope?.subject ?? "(no subject)",
          from: message.envelope?.from?.map((a) => a.address).join(", ") ?? "",
          date: message.envelope?.date ? new Date(message.envelope.date).toISOString() : "",
          snippet: "",
        });
      }
      return results;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
