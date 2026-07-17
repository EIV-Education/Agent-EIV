import { larkClient } from "./client";

export type DriveResourceType = "doc" | "sheet" | "file" | "wiki" | "bitable" | "docx" | "folder" | "mindnote" | "minutes" | "slides";

// Any resource the bot creates (Base, Docs...) is owned by the app itself
// (it authenticates as the app), so without this the requester only gets
// read access to something they asked the bot to make for them.
export async function grantFullAccess(token: string, type: DriveResourceType, openId: string): Promise<void> {
  await larkClient.drive.permissionMember.create({
    path: { token },
    params: { type, need_notification: false },
    data: {
      member_type: "openid",
      member_id: openId,
      perm: "full_access",
      type: "user",
    },
  });
}
