import { larkClient } from "./client";
import { extractTextFromMessageContent } from "./messaging";

export interface ChatMember {
  openId?: string;
  name?: string;
}

export async function listChatMembers(chatId: string): Promise<ChatMember[]> {
  const res = await larkClient.im.chatMembers.get({
    path: { chat_id: chatId },
    params: { member_id_type: "open_id", page_size: 100 },
  });
  return (res.data?.items ?? []).map((item) => ({
    openId: item.member_id,
    name: item.name,
  }));
}

export interface RecentMessage {
  senderId?: string;
  text: string;
  createTime?: string;
}

export async function listRecentMessages(chatId: string, limit = 20): Promise<RecentMessage[]> {
  const res = await larkClient.im.message.list({
    params: {
      container_id_type: "chat",
      container_id: chatId,
      page_size: Math.min(limit, 50),
      sort_type: "ByCreateTimeDesc",
    },
  });
  return (res.data?.items ?? []).map((item) => ({
    senderId: item.sender?.id,
    text: extractTextFromMessageContent(item.msg_type ?? "text", item.body?.content ?? ""),
    createTime: item.create_time,
  }));
}
