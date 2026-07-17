import { larkClient } from "./client";

export interface SubmitApprovalInput {
  approvalCode: string;
  openId: string;
  form: string; // JSON string matching the approval definition's field schema
}

export async function submitApproval(input: SubmitApprovalInput) {
  const res = await larkClient.approval.instance.create({
    data: {
      approval_code: input.approvalCode,
      open_id: input.openId,
      form: input.form,
    },
  });
  return res.data;
}

export async function getApprovalInstance(instanceId: string) {
  const res = await larkClient.approval.instance.get({
    path: { instance_id: instanceId },
    params: { user_id_type: "open_id" },
  });
  return res.data;
}
