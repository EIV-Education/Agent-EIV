import { larkClient } from "./client";

export interface DocSearchResult {
  title: string;
  summary?: string;
  url?: string;
  docType?: string;
  ownerName?: string;
}

export async function searchDocsAndWiki(query: string, limit = 10): Promise<DocSearchResult[]> {
  // page_size is omitted here: Lark's search/v2/doc_wiki rejected it with a
  // "field validation failed" (99992402) error in production even though
  // the SDK types accept it - clamp to `limit` client-side instead.
  const res = await larkClient.search.docWiki.search({
    data: { query },
  });
  return (res.data?.res_units ?? [])
    .slice(0, limit)
    .map((item) => ({
      title: item.title_highlighted?.replace(/<[^>]+>/g, "") ?? "",
      summary: item.summary_highlighted?.replace(/<[^>]+>/g, ""),
      url: item.result_meta?.url,
      docType: item.result_meta?.doc_types,
      ownerName: item.result_meta?.owner_name,
    }));
}
