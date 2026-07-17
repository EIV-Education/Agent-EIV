import express from "express";
import { Lark, larkEventDispatcher } from "./lark/client";
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

  app.post("/webhook/event", Lark.adaptExpress(larkEventDispatcher, { autoChallenge: true }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error("Unhandled server error", err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
