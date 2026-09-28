import { NextResponse } from "next/server";
import { getDropsResponse } from "@/lib/drops";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const body = await getDropsResponse({
    zip: url.searchParams.get("zip") ?? "",
    radius: url.searchParams.get("radius") ?? "",
  });
  return NextResponse.json(body);
}
