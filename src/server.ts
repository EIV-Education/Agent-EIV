import express from "express";
import { larkEventDispatcher, larkWSClient } from "./lark/client";
import { registerMessageHandler } from "./lark/events";
import { replyText } from "./lark/messaging";
import { runAgent } from "./agent/geminiAgent";
import { logger } from "./logger";

export function createServer() {
  const app = express();
  app.use(express.json());

  registerMessageHandler(async (message) => {
    const reply = await runAgent({ chatId: message.chatId, text: message.text });
    await replyText(message.messageId, reply);
  });

  // No /webhook/event route: events arrive over the persistent WebSocket
  // connection (see startLarkConnection) instead of an inbound HTTP call,
  // so no public domain or Lark webhook verification is needed.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error("Unhandled server error", err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}

export function startLarkConnection(): void {
  larkWSClient
    .start({ eventDispatcher: larkEventDispatcher })
    .then(() => logger.info("Da ket noi Lark qua persistent connection (WebSocket)"))
    .catch((err) => logger.error("Khong the ket noi Lark persistent connection:", err));
}
