# CardScout

CardScout is a phone-friendly helper for a parent and a kid who trade Pokémon cards. It has four jobs:

1. **Deals** — show cards whose lowest list price is below the TCGPlayer market price.
2. **Values** — look up a card. Live boxes are the TCGPlayer market and eBay sold. The graded PriceCharting slot stays on screen and says coming soon until a token is added.
3. **News** — list recent Pokémon TCG stories, with a link to the original article.
4. **Drops** — find nearby Target, Walmart, and GameStop stores that may carry sealed Pokémon cards.

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

The market baseline is the TCGPlayer market price for a raw English copy, read through tcgapi.dev. That figure is the median of recent sales, so a spike can lag. The price next to it is the lowest listed price for that printing. eBay Buy It Now asking prices are not used.

The list starts with the **biggest percent off**. Switch to **Most saved** if you care more about dollars than percent. A 35% discount on a $11 Pikachu is a different decision from 25% off a $980 Umbreon.

Filter with the name box or the set chips (151, Prismatic Evolutions, Base, and so on).

Those made-up shops, such as “Lakeside Cards,” appear only if the live price call fails. The screen then says **Practice fallback**. They are not places you can buy from.

If tcgapi.dev has no market price for a printing, that printing is left off Deals. CardScout does not fill the gap with an asking price.

### Values

Search a card name. Add a set if you know it.

You will often see several rows for one name. A common Pikachu and a special illustration rare Pikachu are not the same card. Read the set and the number (`238/191`, for example) before you trade.

The corner badge says **Live prices on** when a tcgapi.dev key or eBay keys are set and the live call worked. The big number is the TCGPlayer market for a raw English copy. Under it, every card has the same three boxes:

| Box | Best for | Keep in mind |
| --- | --- | --- |
| **TCGPlayer market (via tcgapi.dev)** | Raw (ungraded) English singles | TCGPlayer market price, the median of recent sales, so a spike can lag. The low number is the lowest list price, not a sale. |
| **Graded comps (from eBay sold titles)** | PSA, BGS, and CGC | Median of sold titles that name that company and grade. A title can be wrong. This is not a PriceCharting price. |
| **eBay sold comps** | What buyers actually paid | Completed sales, not Buy It Now asks. One auction can spike when people bid against each other. |

Each box has a chip: **Live**, **Coming soon**, **Not configured**, or **Didn't load**. A missing key does not get a made-up price. **Practice** appears only on the emergency fallback screen, after a live call fails.

### News

Headlines come from [PokéBeach](https://www.pokebeach.com/), a long-running Pokémon TCG news site. CardScout reads their public RSS feed on the server (so the phone does not have to talk to the news site directly) and links out to the article.

If that feed cannot be reached, CardScout shows a **saved snapshot** of real PokéBeach headlines from September 27, 2026, and says so on the screen. It does not invent stories.

### Drops

Search a US ZIP code for nearby **Target**, **Walmart**, and **GameStop** stores. The box starts at **11230** (Brooklyn). Pick a distance of 5, 10, 15, 25, or 40 miles. 15 miles is the default.

Each store shows the name, address, and distance, plus:

- **Directions**
- **Store page**, when the map has that chain’s own page (otherwise a store finder for that address)
- **Check Pokémon stock**, which opens that chain’s Pokémon TCG search

Walmart’s stock link includes the store number when the map has one, so Walmart can open that store’s search. CardScout still does not know what is on the shelf. Stock changes fast. Confirm in the retailer app or at the store.

Store locations come from [OpenStreetMap](https://www.openstreetmap.org/copyright) through the public Overpass API, one chain at a time. The ZIP center comes from [Zippopotam](https://api.zippopotam.us/). If that is unavailable, CardScout uses [Nominatim](https://nominatim.org/). No API key is required. The first lookup for a ZIP can take a little while, then CardScout remembers it. If a chain’s map search does not load, that group still links to the store finder and Pokémon search.

## Where the numbers come from

CardScout always asks the live sources first. The header says **Live prices on** when that call works. Practice numbers are an emergency fallback only, and the header then says **Practice fallback**.

Card names and pictures are there so you can tell printings apart. CardScout is not affiliated with Nintendo, The Pokémon Company, TPCi, eBay, TCGPlayer, PriceCharting, Target, Walmart, or GameStop.

| Source | What you get | Key |
| --- | --- | --- |
| TCGPlayer market | Raw English market and low list price. Market is the median of recent sales. | `TCGAPI_API_KEY`. Free at [tcgapi.dev](https://tcgapi.dev/), 100 requests a day, non-commercial. |
| eBay sold comps | Completed sales from about the last 90 days: median, count, raw vs graded. | `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` from [developer.ebay.com](https://developer.ebay.com/). |
| Graded comps | PSA, BGS, and CGC medians parsed from those sold titles. | Same eBay keys. No separate graded vendor. |
| Scrydex (optional, unused) | Not called. A stub remains in `lib/prices/scrydex-provider.ts`. | `SCRYDEX_API_KEY` and `SCRYDEX_TEAM_ID` if you opt in later. |
| PriceCharting (deferred) | Not shown. No graded prices are invented from it. | `PRICECHARTING_TOKEN` later. |

eBay Buy It Now asks are not sold prices and are not the Deals baseline.

Live mode is on when `TCGAPI_API_KEY` is set, even if the eBay keys are still blank. The eBay and graded boxes then say **eBay sold: not connected yet**. Practice numbers appear only when a configured live call fails.

## Turn on live prices

On Vercel, set `TCGAPI_API_KEY`. That is enough for **Live prices on**. Leave the eBay keys blank until developer approval comes back (about a day). Leave `PRICECHARTING_TOKEN` blank. Restart or redeploy after any env change.

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
| `TCGAPI_API_KEY` | Free key from [tcgapi.dev](https://tcgapi.dev/). Sent as `X-API-Key`. This key alone turns live mode on. |

5. Deploy. Open the link on a phone. The corner badge should say **Live prices on**. The raw box should show a TCGPlayer market price. The eBay sold box and the graded box should say **eBay sold: not connected yet**.

Do not add `PRICECHARTING_TOKEN` for this deploy. Graded prices are not invented.

### Add eBay later

When the eBay developer app is approved, add these in the same Vercel environment and redeploy:

| Name | Value |
| --- | --- |
| `EBAY_CLIENT_ID` | Client ID from [developer.ebay.com](https://developer.ebay.com/) |
| `EBAY_CLIENT_SECRET` | Client Secret from the same keyset |
| `EBAY_ENV` | `PRODUCTION` |

The sold box then fills from Marketplace Insights. Graded numbers appear only when those sold titles name PSA, BGS, or CGC. Until then, those boxes stay on **eBay sold: not connected yet**.

### 1. TCGPlayer market (via tcgapi.dev)

1. Open [tcgapi.dev](https://tcgapi.dev/) and create a free key. No credit card. The free tier is 100 requests a day and is for non-commercial use, which fits this family app.
2. Set `TCGAPI_API_KEY`. CardScout sends it as `X-API-Key`.
3. Search is `GET https://api.tcgapi.dev/v1/search?q=&game=pokemon`. Each row includes `market_price` (TCGPlayer market, median of recent sales) and `low_price` (lowest list price).
4. Results are cached for 12 hours so a phone does not burn the daily cap.
5. A deal is that low list price at least 8% under the market price.

### 2. eBay sold and completed

1. Open [developer.ebay.com](https://developer.ebay.com/) and create an application.
2. Create a keyset. Copy the **Client ID** and **Client Secret**. These are the client credentials eBay documents for the Browse API.
3. Set `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, and `EBAY_ENV` (`PRODUCTION` or `SANDBOX`).
4. The Browse API `item_summary/search` method returns **active** listings. Its `buyingOptions` filter chooses Buy It Now, auction, or best offer. It has no sold, completed, or soldItems filter. CardScout does not treat those asks as sold prices.
5. Sold comps call Marketplace Insights `item_sales/search` with the same client ID and secret, scope `https://api.ebay.com/oauth/api_scope/buy.marketplace.insights`. That is eBay’s sold-item search and covers about the last 90 days.
6. Marketplace Insights is a limited release and approval can take about a day. Until the keys are set, the boxes say **eBay sold: not connected yet**. If the keys are set but eBay refuses the call, the box says the call was refused. CardScout does not scrape eBay. Do not wait on this approval to ship the TCGPlayer market.

### 3. Graded comps, PriceCharting, and Scrydex

Graded numbers are medians of eBay sold titles that include PSA, BGS, or CGC plus a grade. If no title matches, the box stays empty. PriceCharting is deferred: `PRICECHARTING_TOKEN` can stay blank, and CardScout does not invent slab prices. Scrydex is optional and not called. `lib/prices/scrydex-provider.ts` only records that a later opt-in would use `SCRYDEX_API_KEY` and `SCRYDEX_TEAM_ID`.

Never commit `.env.local`. Only `.env.example` belongs in git, and it has empty keys.

## Project shape

- Next.js App Router, TypeScript, Tailwind
- Prices go through `LivePriceProvider` (`lib/prices`). `DemoPriceProvider` runs only after a live call throws.
- Live mode uses tcgapi.dev for the TCGPlayer market as soon as `TCGAPI_API_KEY` is set. eBay Marketplace Insights fills sold comps after `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` are added. Graded medians are parsed from those sold titles. Scrydex and PriceCharting are not required.
- News is fetched on the server from RSS (`lib/news`)
- Drops looks up nearby stores on the server (`lib/drops`) and links out to the retailers
- JSON for other tools: `/api/deals`, `/api/values`, `/api/news`, `/api/drops`
