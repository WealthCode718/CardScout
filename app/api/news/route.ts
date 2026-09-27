import { NextResponse } from "next/server";
import { getNewsResponse } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = await getNewsResponse();
  return NextResponse.json(body);
}
