import type { FunctionDeclaration } from "@google/genai";
import { config } from "../config";
import { sendText } from "../lark/messaging";
import { createRecord, updateRecord, deleteRecord, searchRecords, SearchCondition } from "../lark/bitable";
import { createTask } from "../lark/task";
import { createCalendarEvent } from "../lark/calendar";
import { createReportDoc } from "../lark/docx";
import { sendEmail } from "../email/mailer";
import { searchEmails } from "../email/searcher";
import { callInternalApi } from "../internal/webhookCall";
import { logger } from "../logger";

export const toolDefinitions: FunctionDeclaration[] = [
  {
    name: "send_lark_message",
    description:
      "Gui mot tin nhan van ban chu dong toi mot nguoi dung hoac mot nhom chat khac tren Lark (khong phai cuoc hoi thoai hien tai). Dung khi nguoi dung yeu cau bao cho ai do, thong bao cho mot nhom, hoac chuyen tiep thong tin.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        receive_id: { type: "string", description: "open_id, user_id, union_id, email, hoac chat_id cua nguoi/nhom nhan" },
        receive_id_type: {
          type: "string",
          enum: ["open_id", "user_id", "union_id", "email", "chat_id"],
        },
        text: { type: "string" },
      },
      required: ["receive_id", "receive_id_type", "text"],
    },
  },
  {
    name: "bitable_create_record",
    description:
      "Tao mot ban ghi (record) moi trong bang du lieu Lark Base (Bitable). Neu nguoi dung khong noi ro app_token/table_id, dung bang mac dinh da cau hinh.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        app_token: { type: "string", description: "Bo qua neu dung bang Bitable mac dinh" },
        table_id: { type: "string", description: "Bo qua neu dung bang Bitable mac dinh" },
        fields: {
          type: "object",
          description: "Cap ten_cot -> gia tri can ghi, vi du {\"Ho ten\": \"Nguyen Van A\", \"Trang thai\": \"Moi\"}",
        },
      },
      required: ["fields"],
    },
  },
  {
    name: "bitable_update_record",
    description: "Cap nhat mot ban ghi da co trong Lark Base (Bitable) theo record_id.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        app_token: { type: "string" },
        table_id: { type: "string" },
        record_id: { type: "string" },
        fields: { type: "object" },
      },
      required: ["record_id", "fields"],
    },
  },
  {
    name: "bitable_delete_record",
    description: "Xoa mot ban ghi trong Lark Base (Bitable) theo record_id.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        app_token: { type: "string" },
        table_id: { type: "string" },
        record_id: { type: "string" },
      },
      required: ["record_id"],
    },
  },
  {
    name: "bitable_search_records",
    description: "Tim kiem cac ban ghi trong Lark Base (Bitable) theo dieu kien loc.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        app_token: { type: "string" },
        table_id: { type: "string" },
        conditions: {
          type: "array",
          description: "Danh sach dieu kien loc (AND voi nhau). De trong de lay tat ca.",
          items: {
            type: "object",
            properties: {
              field_name: { type: "string" },
              operator: {
                type: "string",
                enum: ["is", "isNot", "contains", "doesNotContain", "isEmpty", "isNotEmpty", "isGreater", "isGreaterEqual", "isLess", "isLessEqual", "like", "in"],
              },
              value: { type: "array", items: { type: "string" } },
            },
            required: ["field_name", "operator"],
          },
        },
        limit: { type: "number", description: "So ban ghi toi da, mac dinh 20" },
      },
      required: [],
    },
  },
  {
    name: "create_lark_task",
    description: "Tao mot cong viec (task) moi trong Lark Task cho ban than bot hoac de nguoi dung theo doi.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        description: { type: "string" },
        due_timestamp: { type: "string", description: "Unix timestamp (giay) dang chuoi, thoi han hoan thanh" },
        is_all_day: { type: "boolean" },
      },
      required: ["summary"],
    },
  },
  {
    name: "create_lark_calendar_event",
    description: "Tao mot su kien / lich hop moi trong Lark Calendar.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        calendar_id: { type: "string", description: "Bo qua de dung lich mac dinh cua bot" },
        summary: { type: "string" },
        description: { type: "string" },
        start_timestamp: { type: "string", description: "Unix timestamp (giay) dang chuoi, thoi gian bat dau" },
        end_timestamp: { type: "string", description: "Unix timestamp (giay) dang chuoi, thoi gian ket thuc" },
        timezone: { type: "string", description: "Mac dinh Asia/Ho_Chi_Minh" },
      },
      required: ["summary", "start_timestamp", "end_timestamp"],
    },
  },
  {
    name: "create_report_doc",
    description:
      "Tao mot bao cao dang tai lieu Lark Docs (docx) tu tieu de va danh sach cac dong noi dung, tra ve duong dan de nguoi dung mo xem.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body_lines: {
          type: "array",
          items: { type: "string" },
          description: "Cac dong/doan van ban se duoc chen vao tai lieu theo thu tu",
        },
      },
      required: ["title", "body_lines"],
    },
  },
  {
    name: "send_email",
    description: "Gui mot email that su qua SMTP toi mot dia chi nguoi nhan.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        cc: { type: "string" },
        subject: { type: "string" },
        text: { type: "string" },
      },
      required: ["to", "subject", "text"],
    },
  },
  {
    name: "search_email",
    description: "Tim kiem email trong hop thu (IMAP) theo nguoi gui, tieu de hoac noi dung.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        from: { type: "string" },
        subject: { type: "string" },
        text: { type: "string" },
        limit: { type: "number", description: "Mac dinh 10" },
      },
      required: [],
    },
  },
  {
    name: "call_internal_api",
    description:
      "Goi mot API/he thong noi bo cua EIV (chi cac domain da duoc allowlist trong INTERNAL_API_ALLOWED_BASE_URLS) de thuc hien nghiep vu tuy chinh.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
        body: { type: "object" },
      },
      required: ["url"],
    },
  },
];

export async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  logger.info("Executing tool", name, JSON.stringify(input));
  try {
    switch (name) {
      case "send_lark_message": {
        const res = await sendText(
          input.receive_id as string,
          input.receive_id_type as never,
          input.text as string
        );
        return JSON.stringify({ ok: true, message_id: res.messageId });
      }

      case "bitable_create_record": {
        const appToken = (input.app_token as string) || config.defaults.bitableAppToken;
        const tableId = (input.table_id as string) || config.defaults.bitableTableId;
        if (!appToken || !tableId) throw new Error("Thieu app_token/table_id va khong co gia tri mac dinh nao duoc cau hinh.");
        const record = await createRecord(appToken, tableId, input.fields as never);
        return JSON.stringify({ ok: true, record });
      }

      case "bitable_update_record": {
        const appToken = (input.app_token as string) || config.defaults.bitableAppToken;
        const tableId = (input.table_id as string) || config.defaults.bitableTableId;
        if (!appToken || !tableId) throw new Error("Thieu app_token/table_id va khong co gia tri mac dinh nao duoc cau hinh.");
        const record = await updateRecord(appToken, tableId, input.record_id as string, input.fields as never);
        return JSON.stringify({ ok: true, record });
      }

      case "bitable_delete_record": {
        const appToken = (input.app_token as string) || config.defaults.bitableAppToken;
        const tableId = (input.table_id as string) || config.defaults.bitableTableId;
        if (!appToken || !tableId) throw new Error("Thieu app_token/table_id va khong co gia tri mac dinh nao duoc cau hinh.");
        const result = await deleteRecord(appToken, tableId, input.record_id as string);
        return JSON.stringify({ ok: true, result });
      }

      case "bitable_search_records": {
        const appToken = (input.app_token as string) || config.defaults.bitableAppToken;
        const tableId = (input.table_id as string) || config.defaults.bitableTableId;
        if (!appToken || !tableId) throw new Error("Thieu app_token/table_id va khong co gia tri mac dinh nao duoc cau hinh.");
        const items = await searchRecords(
          appToken,
          tableId,
          (input.conditions as SearchCondition[]) ?? [],
          (input.limit as number) ?? 20
        );
        return JSON.stringify({ ok: true, items });
      }

      case "create_lark_task": {
        const task = await createTask({
          summary: input.summary as string,
          description: input.description as string | undefined,
          dueTimestamp: input.due_timestamp as string | undefined,
          isAllDay: input.is_all_day as boolean | undefined,
        });
        return JSON.stringify({ ok: true, task });
      }

      case "create_lark_calendar_event": {
        const event = await createCalendarEvent({
          calendarId: (input.calendar_id as string) || config.defaults.calendarId,
          summary: input.summary as string,
          description: input.description as string | undefined,
          startTimestamp: input.start_timestamp as string,
          endTimestamp: input.end_timestamp as string,
          timezone: input.timezone as string | undefined,
        });
        return JSON.stringify({ ok: true, event });
      }

      case "create_report_doc": {
        const doc = await createReportDoc(input.title as string, (input.body_lines as string[]) ?? []);
        return JSON.stringify({ ok: true, ...doc });
      }

      case "send_email": {
        const result = await sendEmail({
          to: input.to as string,
          cc: input.cc as string | undefined,
          subject: input.subject as string,
          text: input.text as string,
        });
        return JSON.stringify({ ok: true, ...result });
      }

      case "search_email": {
        const results = await searchEmails({
          from: input.from as string | undefined,
          subject: input.subject as string | undefined,
          text: input.text as string | undefined,
          limit: input.limit as number | undefined,
        });
        return JSON.stringify({ ok: true, results });
      }

      case "call_internal_api": {
        const result = await callInternalApi({
          url: input.url as string,
          method: input.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | undefined,
          body: input.body,
        });
        return JSON.stringify({ ok: true, ...result });
      }

      default:
        return JSON.stringify({ ok: false, error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Tool ${name} failed:`, message);
    return JSON.stringify({ ok: false, error: message });
  }
}
