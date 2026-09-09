import { parseSpendingMarkdownDocument } from "@/lib/spending-markdown";
import { MAX_SPENDING_UPLOAD_BYTES } from "@/lib/spending-upload";

async function readMarkdownWithinLimit(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_SPENDING_UPLOAD_BYTES) {
      await reader.cancel();
      throw new Error("UPLOAD_TOO_LARGE");
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join("");
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_SPENDING_UPLOAD_BYTES) {
    return Response.json({ error: "The uploaded file must be 5 MB or smaller." }, { status: 413 });
  }

  let content: string;
  try {
    content = await readMarkdownWithinLimit(request);
  } catch (error) {
    if (error instanceof Error && error.message === "UPLOAD_TOO_LARGE") {
      return Response.json({ error: "The uploaded file must be 5 MB or smaller." }, { status: 413 });
    }
    return Response.json({ error: "Unable to read the Markdown Spending document. Please try again." }, { status: 400 });
  }

  try {
    return Response.json(await parseSpendingMarkdownDocument(content));
  } catch (error) {
    return Response.json({
      error: error instanceof Error
        ? error.message
        : "Family Hub could not prepare the Markdown Spending document. Please try again.",
    }, { status: 400 });
  }
}
