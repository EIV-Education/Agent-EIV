import { larkClient } from "./client";
import { config } from "../config";

export async function createReportDoc(title: string, bodyLines: string[]): Promise<{ documentId: string; url?: string }> {
  const created = await larkClient.docx.document.create({ data: { title } });
  const documentId = created.data?.document?.document_id;
  if (!documentId) {
    throw new Error("Lark did not return a document_id when creating the report doc");
  }

  const children = bodyLines
    .filter((line) => line.length > 0)
    .map((line) => ({
      block_type: 2, // text paragraph block
      text: { elements: [{ text_run: { content: line } }] },
    }));

  if (children.length > 0) {
    await larkClient.docx.documentBlockChildren.create({
      path: { document_id: documentId, block_id: documentId },
      data: { children, index: 0 } as never,
    });
  }

  const url = config.lark.workspaceDomain
    ? `https://${config.lark.workspaceDomain}/docx/${documentId}`
    : undefined;

  return { documentId, url };
}
