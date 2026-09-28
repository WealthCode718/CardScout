import { NextResponse } from "next/server";
import { getDealResponse } from "@/lib/prices";
import { parseSort } from "@/lib/query";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const body = await getDealResponse(
    {
      name: url.searchParams.get("name") ?? "",
      set: url.searchParams.get("set") ?? "",
    },
    parseSort(url.searchParams.get("sort") ?? ""),
  );
  return NextResponse.json(body);
}
