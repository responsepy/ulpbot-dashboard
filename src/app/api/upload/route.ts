import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const backendBase = (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).trim().replace(/\/+$/, "");

  if (!backendBase) {
    return NextResponse.json(
      {
        detail:
          "Backend URL not configured. Set API_BASE_URL (e.g. http://161.97.64.119:8000) " +
          "in your Vercel project → Settings → Environment Variables, then redeploy.",
      },
      { status: 502 },
    );
  }

  const targetUrl = `${backendBase}/upload-data`;

  try {
    const contentType = req.headers.get("content-type") ?? "";
    const body = await req.blob();

    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: { "content-type": contentType },
      body,
      // @ts-expect-error -- Node.js fetch supports this flag
      duplex: "half",
    });

    const data = await resp.json().catch(() => ({}));
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        detail: `Upload proxy failed (${targetUrl}): ${msg}. ` +
          "Check that the VPS is running and port 8000 is open to the internet.",
      },
      { status: 502 },
    );
  }
}
