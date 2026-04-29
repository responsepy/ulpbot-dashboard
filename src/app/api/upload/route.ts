import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for large uploads

export async function POST(req: NextRequest) {
  // Read at request time (server-side), not baked in at build time.
  const backendBase = (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");

  try {
    const contentType = req.headers.get("content-type") ?? "";
    const body = await req.blob();

    const resp = await fetch(`${backendBase}/upload-data`, {
      method: "POST",
      headers: { "content-type": contentType },
      body,
      // @ts-expect-error -- Node.js fetch supports this
      duplex: "half",
    });

    const data = await resp.json().catch(() => ({}));
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Upload proxy error";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
