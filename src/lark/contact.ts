import { larkClient } from "./client";

export interface DepartmentSearchResult {
  departmentId?: string;
  openDepartmentId?: string;
  name: string;
  memberCount?: number;
  chatId?: string;
}

export async function searchDepartments(query: string): Promise<DepartmentSearchResult[]> {
  const res = await larkClient.contact.department.search({
    data: { query },
    params: { department_id_type: "open_department_id" },
  });
  return (res.data?.items ?? []).map((item) => ({
    departmentId: item.department_id,
    openDepartmentId: item.open_department_id,
    name: item.name,
    memberCount: item.member_count,
    chatId: item.chat_id,
  }));
}

export interface DepartmentMember {
  openId?: string;
  name: string;
  email?: string;
}

export async function listDepartmentMembers(openDepartmentId: string): Promise<DepartmentMember[]> {
  const res = await larkClient.contact.user.findByDepartment({
    params: {
      department_id: openDepartmentId,
      department_id_type: "open_department_id",
      user_id_type: "open_id",
      page_size: 50,
    },
  });
  return (res.data?.items ?? []).map((item) => ({
    openId: item.open_id,
    name: item.name,
    email: item.email,
  }));
}
