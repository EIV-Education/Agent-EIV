import { larkClient } from "./client";

type FieldValue = string | number | boolean | Record<string, unknown> | unknown[];
export type BitableFields = Record<string, FieldValue>;

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
