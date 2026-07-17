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

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

async function getAllOpenDepartmentIds(maxDepartments = 60): Promise<string[]> {
  const ids: string[] = ["0"];
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
      if (item.open_department_id) ids.push(item.open_department_id);
    }
    pageToken = res.data?.has_more ? res.data.page_token : undefined;
  } while (pageToken && ids.length < maxDepartments);
  return ids.slice(0, maxDepartments);
}

// Lark's Contact API has no "search user by display name" endpoint, so we
// crawl the department tree (bounded) and filter client-side. Best-effort
// for small/medium orgs; large orgs may need a narrower department hint.
export async function searchUsersByName(
  query: string,
  limit = 10
): Promise<DepartmentMember[]> {
  const normalizedQuery = normalize(query);
  const departmentIds = await getAllOpenDepartmentIds();

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
