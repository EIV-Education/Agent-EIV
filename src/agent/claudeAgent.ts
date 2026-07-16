import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import { toolDefinitions, executeTool } from "./tools";

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

const SYSTEM_PROMPT = `Ban la AI Agent noi bo cua EIV Education, hoat dong ben trong Lark.
Nhiem vu cua ban KHONG PHAI chi tra loi/tu van bang chu - khi nguoi dung yeu cau mot viec can lam (tao ban ghi, tao task, dat lich, gui tin nhan/email, tra cuu email, goi he thong noi bo, tao bao cao...), ban PHAI goi tool tuong ung de thuc hien that su, roi bao cao lai ket qua cu the (thanh cong/that bai, du lieu gi).

Nguyen tac:
- Uu tien hanh dong hon la hoi lai nhieu lan; chi hoi lai khi thieu thong tin bat buoc va khong the doan hop ly (vi du: dia chi email nguoi nhan, noi dung can ghi).
- Sau khi goi tool xong, luon tom tat ro rang bang tieng Viet: da lam gi, ket qua the nao, neu loi thi noi ro nguyen nhan.
- Khong bia dat du lieu (record_id, message_id, duong dan tai lieu...) - chi lay tu ket qua tool tra ve.
- Neu mot yeu cau can nhieu buoc (vi du: tim kiem roi cap nhat), hay goi tuan tu nhieu tool trong cung mot luot xu ly.
- Tra loi ngan gon, di thang vao ket qua, dung dinh dang danh sach/markdown don gian khi can liet ke.`;

interface ChatTurn {
  role: "user" | "assistant";
  content: Anthropic.MessageParam["content"];
}

const conversationMemory = new Map<string, ChatTurn[]>();
const MAX_TURNS = 12;

function getHistory(chatId: string): ChatTurn[] {
  return conversationMemory.get(chatId) ?? [];
}

function saveHistory(chatId: string, turns: ChatTurn[]): void {
  const trimmed = turns.slice(-MAX_TURNS);
  conversationMemory.set(chatId, trimmed);
}

export interface RunAgentInput {
  chatId: string;
  text: string;
}

export async function runAgent(input: RunAgentInput): Promise<string> {
  const history = getHistory(input.chatId);
  const messages: Anthropic.MessageParam[] = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: input.text },
  ];

  let finalText = "";
  const MAX_ITERATIONS = 8;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      finalText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      break;
    }

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const result = await executeTool(block.name, (block.input as Record<string, unknown>) ?? {});
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  if (!finalText) {
    finalText = "Xin loi, minh chua the hoan tat yeu cau nay trong so buoc cho phep. Ban co the thu chia nho yeu cau khong?";
  }

  saveHistory(input.chatId, [
    ...history,
    { role: "user", content: input.text },
    { role: "assistant", content: finalText },
  ]);

  return finalText;
}

export function resetConversation(chatId: string): void {
  conversationMemory.delete(chatId);
}
