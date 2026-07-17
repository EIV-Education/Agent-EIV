import { larkClient } from "./client";
import { grantFullAccess } from "./permissions";

type FieldValue = string | number | boolean | Record<string, unknown> | unknown[];
export type BitableFields = Record<string, FieldValue>;

export interface BitableTable {
  tableId?: string;
  name?: string;
}

export async function listTables(appToken: string): Promise<BitableTable[]> {
  const res = await larkClient.bitable.appTable.list({
    path: { app_token: appToken },
    params: { page_size: 100 },
  });
  return (res.data?.items ?? []).map((item) => ({ tableId: item.table_id, name: item.name }));
}

export async function createRecord(appToken: string, tableId: string, fields: BitableFields) {
  const res = await larkClient.bitable.appTableRecord.create({
    path: { app_token: appToken, table_id: tableId },
    data: { fields: fields as never },
  });
  return res.data?.record;
}

export async function updateRecord(
  appToken: string,
  tableId: string,
  recordId: string,
  fields: BitableFields
) {
  const res = await larkClient.bitable.appTableRecord.update({
    path: { app_token: appToken, table_id: tableId, record_id: recordId },
    data: { fields: fields as never },
  });
  return res.data?.record;
}

export async function deleteRecord(appToken: string, tableId: string, recordId: string) {
  const res = await larkClient.bitable.appTableRecord.delete({
    path: { app_token: appToken, table_id: tableId, record_id: recordId },
  });
  return res.data;
}

export interface SearchCondition {
  field_name: string;
  operator:
    | "is"
    | "isNot"
    | "contains"
    | "doesNotContain"
    | "isEmpty"
    | "isNotEmpty"
    | "isGreater"
    | "isGreaterEqual"
    | "isLess"
    | "isLessEqual"
    | "like"
    | "in";
  value?: string[];
}

export async function searchRecords(
  appToken: string,
  tableId: string,
  conditions: SearchCondition[],
  pageSize = 20
) {
  const res = await larkClient.bitable.appTableRecord.search({
    path: { app_token: appToken, table_id: tableId },
    params: { page_size: pageSize },
    data: conditions.length
      ? { filter: { conjunction: "and", conditions } }
      : undefined,
  });
  return res.data?.items ?? [];
}

export type BitableFieldType =
  | "text"
  | "number"
  | "single_select"
  | "multi_select"
  | "date"
  | "checkbox"
  | "person"
  | "phone"
  | "url";

const FIELD_TYPE_MAP: Record<BitableFieldType, { type: number; uiType: string }> = {
  text: { type: 1, uiType: "Text" },
  number: { type: 2, uiType: "Number" },
  single_select: { type: 3, uiType: "SingleSelect" },
  multi_select: { type: 4, uiType: "MultiSelect" },
  date: { type: 5, uiType: "DateTime" },
  checkbox: { type: 7, uiType: "Checkbox" },
  person: { type: 11, uiType: "User" },
  phone: { type: 13, uiType: "Phone" },
  url: { type: 15, uiType: "Url" },
};

export interface CreateBaseFieldInput {
  fieldName: string;
  fieldType: BitableFieldType;
  options?: string[]; // choice labels, for single_select / multi_select
}

export interface CreateBaseInput {
  name: string;
  tableName?: string;
  fields?: CreateBaseFieldInput[];
  folderToken?: string;
  // Given full_access right after creation - otherwise the app (which
  // authenticated the create call) is the sole owner and the person who
  // asked for the Base can only view it, not edit.
  ownerOpenId?: string;
}

export interface CreateBaseResult {
  appToken: string;
  url?: string;
  tableId?: string;
}

export async function createBase(input: CreateBaseInput): Promise<CreateBaseResult> {
  const appRes = await larkClient.bitable.app.create({
    data: { name: input.name, folder_token: input.folderToken },
  });
  const appToken = appRes.data?.app?.app_token;
  if (!appToken) {
    throw new Error("Lark khong tra ve app_token khi tao Base moi.");
  }

  let tableId = appRes.data?.app?.default_table_id;

  if (input.tableName || (input.fields && input.fields.length > 0)) {
    const tableRes = await larkClient.bitable.appTable.create({
      path: { app_token: appToken },
      data: {
        table: {
          name: input.tableName ?? "Table1",
          fields: input.fields?.map((f) => ({
            field_name: f.fieldName,
            type: FIELD_TYPE_MAP[f.fieldType].type,
            ui_type: FIELD_TYPE_MAP[f.fieldType].uiType as never,
            property: f.options ? { options: f.options.map((name) => ({ name })) } : undefined,
          })),
        },
      },
    });
    tableId = tableRes.data?.table_id ?? tableId;
  }

  if (input.ownerOpenId) {
    await grantFullAccess(appToken, "bitable", input.ownerOpenId);
  }

  return { appToken, url: appRes.data?.app?.url, tableId };
}
