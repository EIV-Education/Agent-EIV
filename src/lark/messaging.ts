import { larkClient } from "./client";

export type ReceiveIdType = "open_id" | "user_id" | "union_id" | "email" | "chat_id";

export async function sendText(
  receiveId: string,
  receiveIdType: ReceiveIdType,
  text: string
): Promise<{ messageId?: string }> {
  const res = await larkClient.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      msg_type: "text",
      content: JSON.stringify({ text }),
    },
  });
  return { messageId: res.data?.message_id };
}

export async function replyText(messageId: string, text: string): Promise<{ messageId?: string }> {
  const res = await larkClient.im.message.reply({
    path: { message_id: messageId },
    data: {
      msg_type: "text",
      content: JSON.stringify({ text }),
    },
  });
  return { messageId: res.data?.message_id };
}

export function extractTextFromMessageContent(messageType: string, content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (messageType === "text") {
      return String(parsed.text ?? "").replace(/@_user_\d+/g, "").trim();
    }
    return JSON.stringify(parsed);
  } catch {
    return content;
  }
}
