import { ScoutApp } from "@/components/scout-app";
import { getDropsResponse } from "@/lib/drops";
import { getNewsResponse } from "@/lib/news";
import { getDealResponse, getValueResponse } from "@/lib/prices";
import { firstParam, parseRadius, parseSort, parseTab, type ScoutQuery } from "@/lib/query";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query: ScoutQuery = {
    tab: parseTab(firstParam(params.tab)),
    name: firstParam(params.name).slice(0, 80),
    set: firstParam(params.set).slice(0, 80),
    sort: parseSort(firstParam(params.sort)),
    zip: firstParam(params.zip).slice(0, 10),
    radius: parseRadius(firstParam(params.radius)),
  };

  const [deals, values, news, drops] = await Promise.all([
    query.tab === "deals" ? getDealResponse({ name: query.name, set: query.set }, query.sort) : Promise.resolve(null),
    query.tab === "values" ? getValueResponse({ name: query.name, set: query.set }) : Promise.resolve(null),
    query.tab === "news" ? getNewsResponse() : Promise.resolve(null),
    query.tab === "drops" ? getDropsResponse({ zip: query.zip, radius: String(query.radius) }) : Promise.resolve(null),
  ]);

  return <ScoutApp query={query} deals={deals} values={values} news={news} drops={drops} />;
}
