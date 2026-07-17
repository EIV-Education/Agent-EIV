import { larkClient } from "./client";

export interface DepartmentSearchResult {
  departmentId?: string;
  openDepartmentId?: string;
  name: string;
  memberCount?: number;
  chatId?: string;
}

export interface DepartmentMember {
  openId?: string;
  name: string;
  email?: string;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

// Lark's contact.department.search (通讯录-搜索部门) only accepts a
// user_access_token, not the app's tenant_access_token this bot uses
// (fails with error 99991663 "Invalid access token for authorization").
// contact.department.children works with tenant_access_token, so we crawl
// the whole department tree from root (bounded) and filter client-side
// instead - same trade-off as searchUsersByName below.
async function getAllDepartments(maxDepartments = 60): Promise<DepartmentSearchResult[]> {
  const departments: DepartmentSearchResult[] = [];
  let pageToken: string | undefined;
  do {
    const res = await larkClient.contact.department.children({
      path: { department_id: "0" },
      params: {
        department_id_type: "open_department_id",
        fetch_child: true,
        page_size: 50,
        page_token: pageToken,
      },
    });
    for (const item of res.data?.items ?? []) {
      departments.push({
        departmentId: item.department_id,
        openDepartmentId: item.open_department_id,
        name: item.name,
        memberCount: item.member_count,
        chatId: item.chat_id,
      });
    }
    pageToken = res.data?.has_more ? res.data.page_token : undefined;
  } while (pageToken && departments.length < maxDepartments);
  return departments.slice(0, maxDepartments);
}

export async function searchDepartments(query: string): Promise<DepartmentSearchResult[]> {
  const normalizedQuery = normalize(query);
  const departments = await getAllDepartments();
  return departments.filter((dept) => normalize(dept.name).includes(normalizedQuery));
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

// Lark's Contact API has no "search user by display name" endpoint either,
// so we reuse the same department crawl and filter members client-side.
// Best-effort for small/medium orgs; large orgs may need a narrower
// department hint.
export async function searchUsersByName(
  query: string,
  limit = 10
): Promise<DepartmentMember[]> {
  const normalizedQuery = normalize(query);
  const departments = await getAllDepartments();
  const departmentIds = ["0", ...departments.map((d) => d.openDepartmentId).filter((id): id is string => Boolean(id))];

  const found = new Map<string, DepartmentMember>();
  for (const departmentId of departmentIds) {
    if (found.size >= limit) break;
    let members: DepartmentMember[] = [];
    try {
      members = await listDepartmentMembers(departmentId);
    } catch {
      continue;
    }
    for (const member of members) {
      if (!member.openId || found.has(member.openId)) continue;
      if (normalize(member.name).includes(normalizedQuery)) {
        found.set(member.openId, member);
        if (found.size >= limit) break;
      }
    }
  }
  return [...found.values()];
}
