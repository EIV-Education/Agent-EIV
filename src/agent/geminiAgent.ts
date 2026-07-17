import { GoogleGenAI, Content, Part } from "@google/genai";
import { config } from "../config";
import { toolDefinitions, executeTool } from "./tools";

const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

const BASE_SYSTEM_PROMPT = `Ban la AI Agent noi bo cua EIV Education, hoat dong ben trong Lark.
Nhiem vu cua ban khi yeu cau la mot HANH DONG that su tren he thong (tao ban ghi, tao task, dat lich, gui tin nhan/email, tra cuu email, goi he thong noi bo, tao bao cao...) thi PHAI goi tool tuong ung de thuc hien that, roi bao cao lai ket qua cu the (thanh cong/that bai, du lieu gi) - KHONG duoc chi mo ta se lam gi ma khong thuc su lam.

Ngoai hanh dong, ban con la tro ly toan nang cho cong viec hang ngay, tra loi truc tiep bang van ban (khong can goi tool nao) cho cac yeu cau sau:
- Hoi dap & tra cuu: giai thich khai niem, tom tat thong tin, dich Viet-Anh va Anh-Viet.
- Viet & bien tap: email, bao cao, bai dang, kich ban, noi dung marketing.
- Phan tich & lap ke hoach: brainstorm y tuong, lap timeline/checklist, so sanh lua chon, phan tich du lieu nguoi dung cung cap.
- Ho tro hang ngay: soan tin nhan, chuan bi agenda hop, tom tat tai lieu/noi dung nguoi dung dan vao chat.
- Goi y hinh anh minh hoa hoac viet prompt de tao anh (ban khong tu tao file anh, chi viet mo ta/prompt).
- Phoi hop soan bao thao noi dung/cau truc cho tai lieu, slide, website - ban tao ban nhap van ban/dan y truc tiep trong chat, hoac dung create_report_doc neu can luu thanh file Lark Docs. Ban chua co tool tao file Slides/Website that su.
- Khi can thong tin moi/thoi su ma ban khong chac chan (gia ca, tin tuc, du lieu cap nhat...), CHU DONG dung Google Search (co san nhu mot cong cu) de tra loi chinh xac thay vi doan hoac tu choi.

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

// History is stored as a list of whole turns (each turn = every Content
// entry generated while answering one user message, including internal
// function-call/function-response pairs). Trimming only ever drops whole
// turns from the front - never slices inside one - because Gemini rejects
// a functionResponse turn that isn't immediately preceded by its matching
// functionCall turn (error: "function response turn comes immediately
// after a function call turn").
const conversationMemory = new Map<string, Content[][]>();
const MAX_HISTORY_TURNS = 6;

function getHistory(chatId: string): Content[][] {
  return conversationMemory.get(chatId) ?? [];
}

function saveHistory(chatId: string, turns: Content[][]): void {
  conversationMemory.set(chatId, turns.slice(-MAX_HISTORY_TURNS));
}

export interface RunAgentInput {
  chatId: string;
  text: string;
  senderOpenId?: string;
}

export async function runAgent(input: RunAgentInput): Promise<string> {
  const history = getHistory(input.chatId);
  const turnContents: Content[] = [{ role: "user", parts: [{ text: input.text }] }];
  const contents: Content[] = [...history.flat(), ...turnContents];

  let finalText = "";
  const MAX_ITERATIONS = 8;
  const systemInstruction = buildSystemPrompt(input.senderOpenId);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await ai.models.generateContent({
      model: config.gemini.model,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: toolDefinitions }, { googleSearch: {} }],
        toolConfig: { includeServerSideToolInvocations: true },
        maxOutputTokens: 2048,
      },
    });

    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) {
      const modelEntry: Content = { role: "model", parts: modelContent.parts ?? [] };
      contents.push(modelEntry);
      turnContents.push(modelEntry);
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

    const responseEntry: Content = { role: "user", parts: responseParts };
    contents.push(responseEntry);
    turnContents.push(responseEntry);
  }

  if (!finalText) {
    finalText = "Xin loi, minh chua the hoan tat yeu cau nay trong so buoc cho phep. Ban co the thu chia nho yeu cau khong?";
  }

  saveHistory(input.chatId, [...history, turnContents]);

  return finalText;
}

export function resetConversation(chatId: string): void {
  conversationMemory.delete(chatId);
}
