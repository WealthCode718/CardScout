# CardScout

CardScout is a phone-friendly helper for a parent and a kid who trade Pokémon cards. It has three jobs:

1. **Deals** — show cards whose lowest known price is below the Scrydex market price.
2. **Values** — look up a card. Live boxes are the TCGPlayer market and eBay sold. The graded PriceCharting slot stays on screen and says coming soon until a token is added.
3. **News** — list recent Pokémon TCG stories, with a link to the original article.

There is no account and no checkout. CardScout only scouts.

## Run it on your computer

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On a phone, use the same Wi-Fi and your computer’s address, for example `http://192.168.1.20:3000`.

Stop the app with Ctrl+C.

## What each tab does

### Deals

Each row is one printing (name, set, and collector number) with:

- the **asking price**
- the **TCGPlayer market** it is being compared with (the crossed-out number)
- the **discount** (percent and dollars saved)
- the condition and who is asking

The market baseline is the Scrydex Near Mint market for a raw English copy. That figure is a USD average from US sources, so a spike can lag. The price next to it is Scrydex's lowest known price for that finish. eBay Buy It Now asking prices are not used.

The list starts with the **biggest percent off**. Switch to **Most saved** if you care more about dollars than percent. A 35% discount on a $11 Pikachu is a different decision from 25% off a $980 Umbreon.

Filter with the name box or the set chips (151, Prismatic Evolutions, Base, and so on).

Those made-up shops, such as “Lakeside Cards,” appear only if the live price call fails. The screen then says **Practice fallback**. They are not places you can buy from.

If Scrydex has no Near Mint market price for a printing, that printing is left off Deals. CardScout does not fill the gap with an asking price.

### Values

Search a card name. Add a set if you know it.

You will often see several rows for one name. A common Pikachu and a special illustration rare Pikachu are not the same card. Read the set and the number (`238/191`, for example) before you trade.

The corner badge says **Live prices on** when the live call worked. The big number is the Scrydex Near Mint market for a raw English copy. Under it, every card has the same three boxes:

| Box | Best for | Keep in mind |
| --- | --- | --- |
| **Scrydex market** | Raw (ungraded) English singles | Near Mint USD average from US sources, plus other conditions when Scrydex sends them. The link is the TCGPlayer purchase URL on that variant. A spike can lag. |
| **Scrydex graded** | PSA, BGS, and CGC slabs | Market, low, mid, and high from `include=prices`, plus a 30-day trend when present. If the plan omits grades, the box stays blank. `PRICECHARTING_TOKEN` is only a backup. |
| **Sold listings (via Scrydex)** | What buyers paid | Scrydex card listings (`source=ebay`, last 90 days). Direct eBay Marketplace Insights is added when eBay keys are set. Browse asking prices are not used. |

Each box has a chip: **Live**, **Coming soon**, **Not configured**, or **Didn't load**. A missing key does not get a made-up price. **Practice** appears only on the emergency fallback screen, after a live call fails.

### News

Headlines come from [PokéBeach](https://www.pokebeach.com/), a long-running Pokémon TCG news site. CardScout reads their public RSS feed on the server (so the phone does not have to talk to the news site directly) and links out to the article.

If that feed cannot be reached, CardScout shows a **saved snapshot** of real PokéBeach headlines from September 27, 2026, and says so on the screen. It does not invent stories.

## Where the numbers come from

CardScout always asks the live sources first. The header says **Live prices on** when that call works. Practice numbers are an emergency fallback only, and the header then says **Practice fallback**.

Card names and pictures are there so you can tell printings apart. CardScout is not affiliated with Nintendo, The Pokémon Company, TPCi, eBay, TCGPlayer, or PriceCharting.

| Source | What you get | Key |
| --- | --- | --- |
| Scrydex market | Raw English Near Mint price, other conditions, and PSA/BGS/CGC grades when the plan includes them. | Paid plan. `SCRYDEX_API_KEY` and `SCRYDEX_TEAM_ID`. Prices need `include=prices`. |
| Scrydex sold listings | Historical sold rows for a card, documented as sold prices. Graded eBay sales are the ones Scrydex ships today. | Same Scrydex key and team ID. |
| eBay sold (secondary) | Direct completed sales from about the last 90 days, if Scrydex listings are empty or as an extra median. | `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`, plus Marketplace Insights access. |
| PriceCharting (backup) | Used only when Scrydex did not return graded prices and this token is set. | `PRICECHARTING_TOKEN` later. |

eBay Buy It Now asks are not sold prices and are not the Deals baseline. PriceCharting’s API, when a token is added later, returns current grades only. CardScout links to the history chart and does not draw a fake one.

If Scrydex keys are missing, the screen says **Not configured** and does not invent a market price. If a configured Scrydex call fails, the screen switches to practice numbers and says so. A missing eBay key does not replace the Scrydex box. The graded box stays coming soon until its token exists.

## Turn on live prices

On Vercel, live mode is the Scrydex raw market plus eBay sold. Set `SCRYDEX_API_KEY`, `SCRYDEX_TEAM_ID`, `EBAY_CLIENT_ID`, and `EBAY_CLIENT_SECRET`. Leave `PRICECHARTING_TOKEN` blank. Restart or redeploy after any env change.

### On your computer

```bash
cp .env.example .env.local
```

Edit `.env.local`, then run `npm run dev` again.

### On Vercel

1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and import the repo.
3. Vercel should detect **Next.js**. Leave the default build command (`npm run build`).
4. Open **Settings → Environment Variables** and add these for Production (and Preview, if you want the same data there):

| Name | Value |
| --- | --- |
| `SCRYDEX_API_KEY` | API key from a paid [Scrydex](https://scrydex.com/pricing) plan |
| `SCRYDEX_TEAM_ID` | Team ID from the Scrydex account hub |
| `EBAY_CLIENT_ID` | Client ID from [developer.ebay.com](https://developer.ebay.com/) |
| `EBAY_CLIENT_SECRET` | Client Secret from the same keyset |
| `EBAY_ENV` | `PRODUCTION` |

5. Deploy. Open the link on a phone. The corner badge should say **Live prices on**. The raw box should show a market price. The eBay box should show sold comps after Marketplace Insights is approved. The graded box should say **Coming soon**.

Do not add `PRICECHARTING_TOKEN` for this deploy. Graded prices are deferred.

### 1. Scrydex market (raw English)

Scrydex is the successor to the Pokémon TCG API. CardScout calls `https://api.scrydex.com/pokemon/v1/en/cards?include=prices` and does not use pokemontcg.io or dev.pokemontcg.io.

Prices require a paid plan. A request with no key returns 401. [Auth docs](https://scrydex.com/docs/getting-started/authentication) say you need a plan, a team ID, and an API key. [Starter](https://scrydex.com/pricing) is $29/month, includes 5,000 credits, and includes raw prices. Most requests cost 1 credit. CardScout caches a search for several minutes. Scrydex's FAQ says graded prices and history start on higher plans. This app only reads the raw Near Mint `market`, so Starter is the plan that covers the raw box.

The `market` field is a USD average across US sources. It is not labeled as TCGPlayer's own market price. A variant can still include a TCGPlayer purchase URL, and Values uses that link when it is present. The same `include=prices` payload carries raw conditions (NM, LP, MP, HP, DM) and graded PSA, BGS, and CGC market/low/mid/high, plus trends. Docs: [pricing data](https://scrydex.com/docs/getting-started/prices) and [Pokémon API](https://scrydex.com/docs/pokemon/api-reference).

Sold history for a card is `GET /pokemon/v1/cards/{id}/listings` ([listings](https://scrydex.com/docs/pokemon/listings)). CardScout asks for `source=ebay` and the last 90 days. Those rows are the primary sold comps. If `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` are set, Marketplace Insights is the secondary direct eBay search. Browse asking prices are not used.

1. Register at [scrydex.com/register](https://scrydex.com/register) and subscribe at [scrydex.com/pricing](https://scrydex.com/pricing).
2. Create a team and copy the team ID. Generate an API key.
3. Set `SCRYDEX_API_KEY` and `SCRYDEX_TEAM_ID` on Vercel.
4. A deal is the lowest known Near Mint price for that finish at least 8% under the market price.

### 2. eBay sold and completed

1. Open [developer.ebay.com](https://developer.ebay.com/) and create an application.
2. Create a keyset. Copy the **Client ID** and **Client Secret**. These are the client credentials eBay documents for the Browse API.
3. Set `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, and `EBAY_ENV` (`PRODUCTION` or `SANDBOX`).
4. The Browse API `item_summary/search` method returns **active** listings. Its `buyingOptions` filter chooses Buy It Now, auction, or best offer. It has no sold, completed, or soldItems filter. CardScout does not treat those asks as sold prices.
5. Sold comps call Marketplace Insights `item_sales/search` with the same client ID and secret, scope `https://api.ebay.com/oauth/api_scope/buy.marketplace.insights`. That is eBay’s sold-item search and covers about the last 90 days.
6. Marketplace Insights is a limited release. If eBay has not approved the application, the eBay box says the call was refused. CardScout does not scrape eBay.

### 3. PriceCharting grades (deferred)

The graded box stays in Values. `PRICECHARTING_TOKEN` is already wired. Leave it unset until you want slab prices. The chip says **Coming soon** and the box says it is not configured. No grades are invented.

When you turn it on later:

1. Subscribe at [pricecharting.com](https://www.pricecharting.com/). The Prices API is part of a paid subscription. [API docs](https://www.pricecharting.com/api-documentation).
2. On the subscription page, open **API/Download** and copy the token.
3. Set `PRICECHARTING_TOKEN` to that token. CardScout sends it as the `t` parameter.
4. Prices come back in pennies. Card columns map to PSA 10, BGS 10, CGC 10, grade 9.5, grade 9, grade 8, grade 7, and ungraded.
5. Their docs say the API and CSV are current values only. Historic points are not in the payload. Use **Price history on PriceCharting** on the card for the chart.
6. The public documentation token does not return price fields. A paid token is required.

PriceCharting is paced at one request per second, so the Values route asks for up to 30 seconds (`maxDuration` on the page and `/api/values`).

Never commit `.env.local`. Only `.env.example` belongs in git, and it has empty keys.

## Project shape

- Next.js App Router, TypeScript, Tailwind
- Prices go through `LivePriceProvider` (`lib/prices`). `DemoPriceProvider` runs only after a live call throws.
- Live mode uses Scrydex for the raw English market and eBay Marketplace Insights for sold comps. PriceCharting stays wired and loads only when `PRICECHARTING_TOKEN` is set.
- News is fetched on the server from RSS (`lib/news`)
- JSON for other tools: `/api/deals`, `/api/values`, `/api/news`
