import { larkEventDispatcher } from "./client";
import { extractTextFromMessageContent } from "./messaging";
import { logger } from "../logger";

export interface IncomingMessage {
  messageId: string;
  chatId: string;
  chatType: string;
  senderOpenId?: string;
  text: string;
}

type MessageHandler = (message: IncomingMessage) => void | Promise<void>;

// Lark may redeliver the same event on retry; keep a small in-memory
// dedupe window keyed by event_id so we don't process (and act on) it twice.
const seenEventIds = new Set<string>();
const MAX_SEEN = 2000;

function markSeen(eventId?: string): boolean {
  if (!eventId) return false;
  if (seenEventIds.has(eventId)) return true;
  seenEventIds.add(eventId);
  if (seenEventIds.size > MAX_SEEN) {
    const first = seenEventIds.values().next().value;
    if (first) seenEventIds.delete(first);
  }
  return false;
}

export function registerMessageHandler(handler: MessageHandler): void {
  larkEventDispatcher.register({
    "im.message.receive_v1": async (data) => {
      if (markSeen(data.event_id)) {
        logger.debug("Duplicate event skipped", data.event_id);
        return;
      }

      const { message, sender } = data;
      if (message.message_type !== "text") {
        logger.debug("Ignoring non-text message", message.message_type);
        return;
      }

      const isGroup = message.chat_type === "group";
      const wasMentioned = Boolean(message.mentions && message.mentions.length > 0);
      if (isGroup && !wasMentioned) {
        // In group chats only react when the bot is explicitly @-mentioned.
        return;
      }

      const text = extractTextFromMessageContent(message.message_type, message.content);
      if (!text) return;

      try {
        await handler({
          messageId: message.message_id,
          chatId: message.chat_id,
          chatType: message.chat_type,
          senderOpenId: sender.sender_id?.open_id,
          text,
        });
      } catch (err) {
        logger.error("Message handler failed", err);
      }
    },
  });
}
