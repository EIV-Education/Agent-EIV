import type { FunctionDeclaration } from "@google/genai";
import { config } from "../config";
import { sendText } from "../lark/messaging";
import { createRecord, updateRecord, deleteRecord, searchRecords, createBase, listTables, SearchCondition, CreateBaseFieldInput } from "../lark/bitable";
import { createTask } from "../lark/task";
import { createCalendarEvent } from "../lark/calendar";
import { createReportDoc } from "../lark/docx";
import { searchDepartments, listDepartmentMembers, searchUsersByName } from "../lark/contact";
import { listChatMembers, listRecentMessages } from "../lark/chat";
import { searchDocsAndWiki } from "../lark/docSearch";
import { submitApproval, getApprovalInstance } from "../lark/approval";
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
    name: "create_lark_base",
    description:
      "Tao moi hoan toan mot Lark Base (Bitable) trong voi ten va (tuy chon) mot bang du lieu co san cot ngay tu dau. Tra ve app_token/table_id de dung ngay cho cac tool bitable_* khac.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Ten cua Base moi" },
        table_name: { type: "string", description: "Ten bang du lieu (bo qua se dung ten mac dinh)" },
        fields: {
          type: "array",
          description: "Danh sach cot can tao san trong bang, bo qua neu chi can Base trong",
          items: {
            type: "object",
            properties: {
              field_name: { type: "string" },
              field_type: {
                type: "string",
                enum: ["text", "number", "single_select", "multi_select", "date", "checkbox", "person", "phone", "url"],
              },
              options: {
                type: "array",
                items: { type: "string" },
                description: "Danh sach lua chon, chi dung cho single_select/multi_select",
              },
            },
            required: ["field_name", "field_type"],
          },
        },
      },
      required: ["name"],
    },
  },
  {
    name: "bitable_create_record",
    description:
      "Tao mot ban ghi (record) moi trong bang du lieu Lark Base (Bitable) DA CO SAN. Neu nguoi dung khong noi ro app_token/table_id va khong co bang mac dinh, hay dung create_lark_base de tao Base moi truoc.",
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
    name: "list_bitable_tables",
    description:
      "Liet ke tat ca cac bang (table_id, ten bang) co trong mot Lark Base (Bitable) theo app_token. Dung khi da co app_token (vi du tu duong dan chia se hoac tu search_lark_docs) nhung chua biet table_id can thao tac.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        app_token: { type: "string" },
      },
      required: ["app_token"],
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
    description:
      "Tao mot su kien / lich hop moi trong Lark Calendar. Nguoi gui tin nhan hien tai se TU DONG duoc them lam nguoi tham gia (attendee) de lich xuat hien tren Lark ca nhan cua ho, khong can hoi lai.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        calendar_id: { type: "string", description: "Bo qua de dung lich mac dinh cua bot" },
        summary: { type: "string" },
        description: { type: "string" },
        start_timestamp: { type: "string", description: "Unix timestamp (giay) dang chuoi, thoi gian bat dau" },
        end_timestamp: { type: "string", description: "Unix timestamp (giay) dang chuoi, thoi gian ket thuc" },
        timezone: { type: "string", description: "Mac dinh Asia/Ho_Chi_Minh" },
        attendee_open_ids: {
          type: "array",
          items: { type: "string" },
          description:
            "open_id cua nhung nguoi KHAC (ngoai nguoi gui tin nhan) can moi tham gia. Neu nguoi dung nhac ten mot phong ban/team (vi du 'Team MKT'), PHAI goi search_lark_department roi list_department_members truoc de lay open_id that cua tung thanh vien, KHONG duoc bo qua buoc nay hay chi tra ve link moi thu cong.",
        },
      },
      required: ["summary", "start_timestamp", "end_timestamp"],
    },
  },
  {
    name: "search_lark_department",
    description:
      "Tim phong ban/team trong to chuc theo ten (vi du 'MKT', 'Marketing', 'Sale'...). Dung truoc khi can moi ca mot phong ban vao lich/tin nhan.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Tu khoa ten phong ban can tim" },
      },
      required: ["query"],
    },
  },
  {
    name: "list_department_members",
    description: "Lay danh sach thanh vien (kem open_id) cua mot phong ban, dung open_department_id tra ve tu search_lark_department.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        open_department_id: { type: "string" },
      },
      required: ["open_department_id"],
    },
  },
  {
    name: "search_lark_user",
    description:
      "Tim mot nguoi cu the trong to chuc theo TEN (vi du 'Vo Thi Thuy', 'Chau Anh') de lay open_id, dung khi can moi dich danh mot ca nhan vao lich/tin nhan (khong phai ca mot phong ban). Lark khong co API tim theo ten truc tiep nen tool nay quet qua cac phong ban - co the mat vai giay va co the khong tim thay neu to chuc rat lon, luc do hay hoi nguoi dung phong ban cua nguoi can tim de dung search_lark_department truoc.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Ten (hoac mot phan ten) can tim" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_chat_members",
    description: "Lay danh sach thanh vien (open_id, ten) cua mot nhom chat Lark, de biet ai dang o trong nhom.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        chat_id: { type: "string", description: "Bo qua de dung nhom chat hien tai" },
      },
      required: [],
    },
  },
  {
    name: "list_recent_messages",
    description: "Doc lai cac tin nhan gan day trong mot nhom chat de nam ngu canh cuoc tro chuyen (vi du de tom tat, tra loi dua tren nhung gi da trao doi).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        chat_id: { type: "string", description: "Bo qua de dung nhom chat hien tai" },
        limit: { type: "number", description: "So tin nhan toi da, mac dinh 20" },
      },
      required: [],
    },
  },
  {
    name: "search_lark_docs",
    description: "Tim kiem noi dung trong Lark Docs/Wiki/Sheet/Base cua cong ty theo tu khoa, tra ve tieu de, tom tat va duong dan - dung khi nguoi dung hoi thong tin co the co san trong tai lieu noi bo.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number", description: "Mac dinh 10" },
      },
      required: ["query"],
    },
  },
  {
    name: "submit_lark_approval",
    description:
      "Gui mot yeu cau phe duyet (Lark Approval), vi du don xin nghi phep, de xuat chi phi. Can biet truoc approval_code (ma quy trinh duyet) va cau truc form du lieu tuong ung - neu nguoi dung khong cung cap, hoi ho lay tu quan tri Lark Approval cua cong ty.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        approval_code: { type: "string", description: "Ma dinh nghia quy trinh duyet trong Lark Approval" },
        form: {
          type: "string",
          description: "Chuoi JSON dang mang [{\"id\":\"widget_id\",\"type\":\"...\",\"value\":...}] khop voi form cua quy trinh duyet do",
        },
      },
      required: ["approval_code", "form"],
    },
  },
  {
    name: "get_approval_status",
    description: "Tra cuu trang thai mot yeu cau phe duyet da gui (PENDING/APPROVED/REJECTED/CANCELED).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        instance_id: { type: "string", description: "instance_code tra ve khi submit_lark_approval" },
      },
      required: ["instance_id"],
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

export interface ToolContext {
  senderOpenId?: string;
  chatId?: string;
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  context: ToolContext = {}
): Promise<string> {
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

      case "create_lark_base": {
        const rawFields = (input.fields as Array<Record<string, unknown>>) ?? [];
        const fields: CreateBaseFieldInput[] = rawFields.map((f) => ({
          fieldName: f.field_name as string,
          fieldType: f.field_type as CreateBaseFieldInput["fieldType"],
          options: f.options as string[] | undefined,
        }));
        const base = await createBase({
          name: input.name as string,
          tableName: input.table_name as string | undefined,
          fields: fields.length > 0 ? fields : undefined,
          ownerOpenId: context.senderOpenId,
        });
        return JSON.stringify({ ok: true, ...base });
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

      case "list_bitable_tables": {
        const tables = await listTables(input.app_token as string);
        return JSON.stringify({ ok: true, tables });
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
        const otherAttendees = (input.attendee_open_ids as string[]) ?? [];
        const attendeeOpenIds = context.senderOpenId
          ? [context.senderOpenId, ...otherAttendees]
          : otherAttendees;
        const event = await createCalendarEvent({
          calendarId: (input.calendar_id as string) || config.defaults.calendarId,
          summary: input.summary as string,
          description: input.description as string | undefined,
          startTimestamp: input.start_timestamp as string,
          endTimestamp: input.end_timestamp as string,
          timezone: input.timezone as string | undefined,
          attendeeOpenIds,
        });
        return JSON.stringify({ ok: true, event, attendees_added: attendeeOpenIds });
      }

      case "search_lark_department": {
        const departments = await searchDepartments(input.query as string);
        return JSON.stringify({ ok: true, departments });
      }

      case "list_department_members": {
        const members = await listDepartmentMembers(input.open_department_id as string);
        return JSON.stringify({ ok: true, members });
      }

      case "search_lark_user": {
        const users = await searchUsersByName(input.name as string);
        return JSON.stringify({ ok: true, users });
      }

      case "list_chat_members": {
        const chatId = (input.chat_id as string) || context.chatId;
        if (!chatId) throw new Error("Khong xac dinh duoc chat_id.");
        const members = await listChatMembers(chatId);
        return JSON.stringify({ ok: true, members });
      }

      case "list_recent_messages": {
        const chatId = (input.chat_id as string) || context.chatId;
        if (!chatId) throw new Error("Khong xac dinh duoc chat_id.");
        const messages = await listRecentMessages(chatId, (input.limit as number) ?? 20);
        return JSON.stringify({ ok: true, messages });
      }

      case "search_lark_docs": {
        const results = await searchDocsAndWiki(input.query as string, (input.limit as number) ?? 10);
        return JSON.stringify({ ok: true, results });
      }

      case "submit_lark_approval": {
        if (!context.senderOpenId) throw new Error("Khong xac dinh duoc nguoi gui de nop don duyet.");
        const result = await submitApproval({
          approvalCode: input.approval_code as string,
          openId: context.senderOpenId,
          form: input.form as string,
        });
        return JSON.stringify({ ok: true, ...result });
      }

      case "get_approval_status": {
        const instance = await getApprovalInstance(input.instance_id as string);
        return JSON.stringify({ ok: true, instance });
      }

      case "create_report_doc": {
        const doc = await createReportDoc(
          input.title as string,
          (input.body_lines as string[]) ?? [],
          context.senderOpenId
        );
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
