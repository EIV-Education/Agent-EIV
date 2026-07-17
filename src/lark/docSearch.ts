import { larkClient } from "./client";

export interface DocSearchResult {
  title: string;
  summary?: string;
  url?: string;
  docType?: string;
  ownerName?: string;
}

export async function searchDocsAndWiki(query: string, limit = 10): Promise<DocSearchResult[]> {
  const res = await larkClient.search.docWiki.search({
    data: { query, page_size: limit },
  });
  return (res.data?.res_units ?? []).map((item) => ({
    title: item.title_highlighted?.replace(/<[^>]+>/g, "") ?? "",
    summary: item.summary_highlighted?.replace(/<[^>]+>/g, ""),
    url: item.result_meta?.url,
    docType: item.result_meta?.doc_types,
    ownerName: item.result_meta?.owner_name,
  }));
}
