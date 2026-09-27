import { ScoutApp } from "@/components/scout-app";
import { getNewsResponse } from "@/lib/news";
import { getDealResponse, getValueResponse } from "@/lib/prices";
import { firstParam, parseSort, parseTab, type ScoutQuery } from "@/lib/query";

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
  };

  const [deals, values, news] = await Promise.all([
    query.tab === "deals" ? getDealResponse({ name: query.name, set: query.set }, query.sort) : Promise.resolve(null),
    query.tab === "values" ? getValueResponse({ name: query.name, set: query.set }) : Promise.resolve(null),
    query.tab === "news" ? getNewsResponse() : Promise.resolve(null),
  ]);

  return <ScoutApp query={query} deals={deals} values={values} news={news} />;
}
