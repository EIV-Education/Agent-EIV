import { GoogleGenAI, Content, Part } from "@google/genai";
import { config } from "../config";
import { toolDefinitions, executeTool } from "./tools";

const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

const BASE_SYSTEM_PROMPT = `Ban la AI Agent noi bo cua EIV Education, hoat dong ben trong Lark.
Nhiem vu cua ban KHONG PHAI chi tra loi/tu van bang chu - khi nguoi dung yeu cau mot viec can lam (tao ban ghi, tao task, dat lich, gui tin nhan/email, tra cuu email, goi he thong noi bo, tao bao cao...), ban PHAI goi tool tuong ung de thuc hien that su, roi bao cao lai ket qua cu the (thanh cong/that bai, du lieu gi).

Nguyen tac:
- Uu tien hanh dong hon la hoi lai nhieu lan; chi hoi lai khi thieu thong tin bat buoc va khong the doan hop ly (vi du: dia chi email nguoi nhan, noi dung can ghi).
- Luon dung "Boi canh hien tai" o duoi day (ngay gio that, danh tinh nguoi gui) de tu tinh toan - khong hoi lai nguoi dung nhung thu ban da co san (vi du: hoi lai hom nay/ngay mai la ngay may).
- Sau khi goi tool xong, luon tom tat ro rang bang tieng Viet: da lam gi, ket qua the nao, neu loi thi noi ro nguyen nhan.
- Khong bia dat du lieu (record_id, message_id, duong dan tai lieu...) - chi lay tu ket qua tool tra ve.
- Neu mot yeu cau can nhieu buoc (vi du: tim kiem roi cap nhat), hay goi tuan tu nhieu tool trong cung mot luot xu ly.
- Khi nguoi dung nhac ten mot phong ban/team/nhom (vi du "Team MKT", "phong Sale") can moi vao lich hop hoac gui tin nhan, KHONG duoc chi tra ve link moi thu cong - PHAI tu goi search_lark_department de tim phong ban, roi list_department_members de lay open_id that cua tung thanh vien, roi dua toan bo open_id do vao attendee_open_ids / gui tin nhan cho tung nguoi. Neu tim khong ra phong ban nao khop, moi bao lai va hoi ten chinh xac hon.
- Khi nguoi dung nhac TEN RIENG cua mot ca nhan can moi (khong phai ten phong ban), PHAI goi search_lark_user voi ten do de lay open_id, KHONG duoc chi dua link moi thu cong hay noi "khong the tim thay" ma chua thu goi tool nay truoc. Chi bao khong tim duoc sau khi da goi search_lark_user va ket qua rong.
- Khi can nam ngu canh cuoc tro chuyen (ai dang trong nhom, truoc do da noi gi) de tra loi cho dung, chu dong goi list_chat_members / list_recent_messages thay vi hoi lai nguoi dung.
- Khi nguoi dung hoi thong tin co the da co san trong tai lieu/wiki noi bo cua cong ty (chinh sach, quy trinh, du lieu...), chu dong goi search_lark_docs truoc khi tra loi hoac noi khong biet.
- Tra loi ngan gon, di thang vao ket qua, dung dinh dang danh sach/markdown don gian khi can liet ke.`;

const TIMEZONE = "Asia/Ho_Chi_Minh";

function buildSystemPrompt(senderOpenId?: string): string {
  const now = new Date();
  const formatted = new Intl.DateTimeFormat("vi-VN", {
    timeZone: TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  const context = [
    `Boi canh hien tai:`,
    `- Thoi diem: ${formatted} (mui gio GMT+7, Viet Nam). Unix timestamp giay hien tai: ${Math.floor(now.getTime() / 1000)}.`,
    senderOpenId
      ? `- Nguoi gui tin nhan nay co Lark open_id: "${senderOpenId}".`
      : `- Khong xac dinh duoc open_id nguoi gui (co the la su kien he thong).`,
  ].join("\n");

  return `${BASE_SYSTEM_PROMPT}\n\n${context}`;
}

const conversationMemory = new Map<string, Content[]>();
const MAX_TURNS = 12;

function getHistory(chatId: string): Content[] {
  return conversationMemory.get(chatId) ?? [];
}

function saveHistory(chatId: string, contents: Content[]): void {
  conversationMemory.set(chatId, contents.slice(-MAX_TURNS));
}

export interface RunAgentInput {
  chatId: string;
  text: string;
  senderOpenId?: string;
}

export async function runAgent(input: RunAgentInput): Promise<string> {
  const contents: Content[] = [
    ...getHistory(input.chatId),
    { role: "user", parts: [{ text: input.text }] },
  ];

  let finalText = "";
  const MAX_ITERATIONS = 8;
  const systemInstruction = buildSystemPrompt(input.senderOpenId);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await ai.models.generateContent({
      model: config.gemini.model,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: toolDefinitions }],
        maxOutputTokens: 2048,
      },
    });

    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) {
      contents.push({ role: "model", parts: modelContent.parts ?? [] });
    }

    const functionCalls = response.functionCalls;
    if (!functionCalls || functionCalls.length === 0) {
      finalText = (response.text ?? "").trim();
      break;
    }

    const responseParts: Part[] = [];
    for (const call of functionCalls) {
      const result = await executeTool(call.name ?? "", call.args ?? {}, {
        senderOpenId: input.senderOpenId,
        chatId: input.chatId,
      });
      responseParts.push({
        functionResponse: {
          name: call.name,
          response: { result: JSON.parse(result) },
        },
      });
    }

    contents.push({ role: "user", parts: responseParts });
  }

  if (!finalText) {
    finalText = "Xin loi, minh chua the hoan tat yeu cau nay trong so buoc cho phep. Ban co the thu chia nho yeu cau khong?";
  }

  saveHistory(input.chatId, contents);

  return finalText;
}

export function resetConversation(chatId: string): void {
  conversationMemory.delete(chatId);
}
