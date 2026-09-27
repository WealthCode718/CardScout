# CardScout

CardScout is a phone-friendly helper for a parent and a kid who trade Pokémon cards. It has three jobs:

1. **Deals** — show cards whose asking price is below the TCGPlayer market price.
2. **Values** — look up a card with three price boxes: TCGPlayer, PriceCharting, and eBay sold.
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

The market baseline is the TCGPlayer market price for a raw English copy. That figure averages recent sales. The asking price next to it is the lowest TCGPlayer list price for that finish. eBay Buy It Now asking prices are not used.

The list starts with the **biggest percent off**. Switch to **Most saved** if you care more about dollars than percent. A 35% discount on a $11 Pikachu is a different decision from 25% off a $980 Umbreon.

Filter with the name box or the set chips (151, Prismatic Evolutions, Base, and so on).

Those made-up shops, such as “Lakeside Cards,” appear only if the live price call fails. The screen then says **Practice fallback**. They are not places you can buy from.

If TCGPlayer has no market price for a printing, that printing is left off Deals. CardScout does not fill the gap with an asking price.

### Values

Search a card name. Add a set if you know it.

You will often see several rows for one name. A common Pikachu and a special illustration rare Pikachu are not the same card. Read the set and the number (`238/191`, for example) before you trade.

The corner badge says **Live prices on** when the live call worked. The big number is the TCGPlayer market price for a raw English copy. Under it, every card has the same three boxes:

| Box | Best for | Keep in mind |
| --- | --- | --- |
| **TCGPlayer Market Price** | Raw (ungraded) English singles | It averages recent sales, so a sudden spike can take a while to show up. |
| **PriceCharting** | Graded slabs (PSA, BGS) and a quick overall look | One odd or phantom sale can pull a grade away from the real number. |
| **eBay Sold & Completed** | What buyers actually paid, raw or graded | A single auction can jump when people bid against each other. |

Each box has a chip: **Live**, **Needs a key**, or **Didn't load**. A missing key does not get a made-up price. **Practice** appears only on the emergency fallback screen, after a live call fails.

### News

Headlines come from [PokéBeach](https://www.pokebeach.com/), a long-running Pokémon TCG news site. CardScout reads their public RSS feed on the server (so the phone does not have to talk to the news site directly) and links out to the article.

If that feed cannot be reached, CardScout shows a **saved snapshot** of real PokéBeach headlines from September 27, 2026, and says so on the screen. It does not invent stories.

## Where the numbers come from

CardScout always asks the live sources first. The header says **Live prices on** when that call works. Practice numbers are an emergency fallback only, and the header then says **Practice fallback**.

Card names and pictures are there so you can tell printings apart. CardScout is not affiliated with Nintendo, The Pokémon Company, TPCi, eBay, TCGPlayer, or PriceCharting.

| Source | What you get | Key |
| --- | --- | --- |
| TCGPlayer market | Raw English single. The `market` field is an average of recent sales, so a spike can lag. | Optional `POKEMONTCG_API_KEY`. The Pokémon TCG API works without a key, but it may throttle. |
| PriceCharting | Current slab grades (PSA 10, BGS 10, CGC 10, 9.5, 9, 8, 7, ungraded). | Required `PRICECHARTING_TOKEN` (paid). |
| eBay sold | Completed sales from about the last 90 days: median, count, raw vs graded. | `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`, plus Marketplace Insights access. |

PriceCharting’s API does not include the history chart. CardScout links to the chart on their site and does not draw a fake one. eBay Buy It Now asks are not sold prices and are not the Deals baseline.

If the card list itself fails, the screen switches to practice numbers and says so. If only PriceCharting or eBay is missing a key, that box says **Needs a key** and the TCGPlayer box can still be live.

## Turn on live prices

TCGPlayer market works with no key. The other two boxes stay empty until you add their keys. Restart the app after any env change.

### On your computer

```bash
cp .env.example .env.local
```

Edit `.env.local`, then run `npm run dev` again.

### On Vercel

1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and import the repo.
3. Vercel should detect **Next.js**. Leave the default build command (`npm run build`).
4. Open **Settings → Environment Variables** and add the names below for Production (and Preview, if you want the same data there).
5. Deploy. Open the link on a phone. The corner badge should say **Live prices on**.

PriceCharting is paced at one request per second, so the Values route asks for up to 30 seconds (`maxDuration` on the page and `/api/values`).

### 1. TCGPlayer market (Pokémon TCG API)

TCGPlayer does not give hobby projects a public price key. CardScout reads the market price Pokémon TCG API already publishes for English cards (`tcgplayer.prices.*.market`).

1. Open [dev.pokemontcg.io](https://dev.pokemontcg.io/) and create a free API key. Skip this if you are fine with the lower no-key rate limit.
2. Set `POKEMONTCG_API_KEY` to that key.
3. A deal is the lowest listed price for that finish (holofoil, for example) at least 8% under the market price.

### 2. PriceCharting grades

1. Subscribe at [pricecharting.com](https://www.pricecharting.com/). The Prices API is part of a paid subscription. [API docs](https://www.pricecharting.com/api-documentation).
2. On the subscription page, open **API/Download** and copy the token.
3. Set `PRICECHARTING_TOKEN` to that token. CardScout sends it as the `t` parameter.
4. Prices come back in pennies. Card columns map to PSA 10, BGS 10, CGC 10, grade 9.5, grade 9, grade 8, grade 7, and ungraded.
5. Their docs say the API and CSV are current values only. Historic points are not in the payload. Use **Price history on PriceCharting** on the card for the chart.
6. The public documentation token does not return price fields. A paid token is required. CardScout will not invent grades if the token omits them.

### 3. eBay sold and completed

1. Open [developer.ebay.com](https://developer.ebay.com/) and create an application.
2. Create a keyset. Copy the **Client ID** and **Client Secret** (the same client-credentials pair used for the Browse API).
3. Set `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, and `EBAY_ENV` (`PRODUCTION` or `SANDBOX`).
4. Sold comps call Marketplace Insights `item_sales/search` with scope `https://api.ebay.com/oauth/api_scope/buy.marketplace.insights`. That API returns what buyers paid over about the last 90 days.
5. The Browse API search only returns active listings, including Buy It Now asks. CardScout does not use those asks as sold comps or as the market price, and it does not scrape eBay.
6. Marketplace Insights is a limited release. If eBay has not approved the application, the eBay box says the call was refused.

Never commit `.env.local`. Only `.env.example` belongs in git, and it has empty keys.

## Project shape

- Next.js App Router, TypeScript, Tailwind
- Prices go through `LivePriceProvider` (`lib/prices`). `DemoPriceProvider` runs only after a live call throws.
- Live mode composes the Pokémon TCG API (TCGPlayer market), the PriceCharting Prices API, and eBay Marketplace Insights
- News is fetched on the server from RSS (`lib/news`)
- JSON for other tools: `/api/deals`, `/api/values`, `/api/news`
