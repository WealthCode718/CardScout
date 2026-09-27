import { NextResponse } from "next/server";
import { getValueResponse } from "@/lib/prices";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const body = await getValueResponse({
    name: url.searchParams.get("name") ?? "",
    set: url.searchParams.get("set") ?? "",
  });
  return NextResponse.json(body);
}
