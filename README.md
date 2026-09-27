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

The market baseline is the TCGPlayer market price for a raw English copy. That figure averages recent sales. An eBay Buy It Now price can show up as the asking price when eBay keys are set. It is never stored as the market number.

The list starts with the **biggest percent off**. Switch to **Most saved** if you care more about dollars than percent. A 35% discount on a $11 Pikachu is a different decision from 25% off a $980 Umbreon.

Filter with the name box or the set chips (151, Prismatic Evolutions, Base, and so on).

In the default sample mode, sellers such as “Lakeside Cards” are **made-up practice shops**. They are not places you can buy from. The crossed-out number is labeled **Sample TCGPlayer market**.

If TCGPlayer has no market price for a printing, that printing is left off Deals. CardScout does not fill the gap with an asking price.

### Values

Search a card name. Add a set if you know it.

You will often see several rows for one name. A common Pikachu and a special illustration rare Pikachu are not the same card. Read the set and the number (`238/191`, for example) before you trade.

The big number is the raw market (TCGPlayer when prices are live). Under it, every card has the same three boxes:

| Box | Best for | Keep in mind |
| --- | --- | --- |
| **TCGPlayer Market Price** | Raw (ungraded) English singles | It averages recent sales, so a sudden spike can take a while to show up. |
| **PriceCharting** | Graded slabs (PSA, BGS) and a quick overall look | One odd or phantom sale can pull a grade away from the real number. |
| **eBay Sold & Completed** | What buyers actually paid, raw or graded | A single auction can jump when people bid against each other. |

Each box has a chip: **Practice**, **Live**, **Needs a key**, or **Didn't load**.

In practice mode the dollars are sample estimates, and the chip says Practice. The layout matches live mode so you can learn the screen before any keys are added.

### News

Headlines come from [PokéBeach](https://www.pokebeach.com/), a long-running Pokémon TCG news site. CardScout reads their public RSS feed on the server (so the phone does not have to talk to the news site directly) and links out to the article.

If that feed cannot be reached, CardScout shows a **saved snapshot** of real PokéBeach headlines from September 27, 2026, and says so on the screen. It does not invent stories.

## Where the numbers come from

**Out of the box, prices are sample estimates stored in the app.** They use real card names, set codes, and official-style artwork so the screens look like a real hunt, but the dollars are practice numbers. Do not buy, sell, or trade based on sample mode.

Card names and pictures are there so you can tell printings apart. CardScout is not affiliated with Nintendo, The Pokémon Company, TPCi, eBay, TCGPlayer, or PriceCharting.

### Optional live prices

Copy the example env file:

```bash
cp .env.example .env.local
```

Then set `PRICE_PROVIDER=live` and add the keys you have. Restart `npm run dev` after changing `.env.local`.

| Variable | What it turns on | Where to get it |
| --- | --- | --- |
| `PRICE_PROVIDER` | `demo` (default) or `live`. Older values `pokemontcg` and `ebay` also mean live. | — |
| `POKEMONTCG_API_KEY` | Optional. Card info, pictures, and the **TCGPlayer market price** from the [Pokémon TCG API](https://pokemontcg.io). | Free key at [dev.pokemontcg.io](https://dev.pokemontcg.io/) |
| `PRICECHARTING_TOKEN` | **PriceCharting** grade prices (PSA 10, BGS 10, grade 9, and so on). | Paid subscription. [API docs](https://www.pricecharting.com/api-documentation). Token is on the subscription page under API/Download. |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_ENV` | **eBay sold comps** on Values, and optional Buy It Now asks on Deals. | [developer.ebay.com](https://developer.ebay.com/) |

Notes, so the numbers stay honest:

- **TCGPlayer** does not offer a simple public key for a hobby project. Live mode uses the market price the Pokémon TCG API already publishes for English cards (`tcgplayer.prices`). That market field is an average of recent sales, which is why a spike can lag. A deal means the lowest listed price for that finish (holofoil, for example) is at least 8% under the market price.
- **PriceCharting** has an official Prices API, and it requires a paid token. Prices come back in pennies. For cards, their columns map to grades (PSA 10, BGS 10, CGC 10, 9.5, 9, 8, 7, and ungraded). The API allows about one call per second, so a live search shows a few printings and caches them. With no token, the box says it needs a key. CardScout does not invent slab prices.
- **eBay sold comps** use the official [Marketplace Insights](https://developer.ebay.com/api-docs/buy/marketplace-insights/overview.html) `item_sales/search` method (completed sales, about the last 90 days). The Browse API only returns active listings, so Buy It Now asks are not shown as sold prices and are not the market baseline. Marketplace Insights is a limited release: eBay has to approve the application. If the call is refused, the box says so. CardScout does not scrape eBay.
- **eBay asks on Deals** still use the Browse API when keys are set. The listing price is the ask. The market number next to it is TCGPlayer. A title has to contain the card name and the set, and the price has to sit in a believable range, before the row is kept.
- If the live card list fails entirely, CardScout **falls back to sample prices** and says that on the screen, so the app does not go blank. A single source that is missing a key, or that fails on its own, stays in its box with a clear chip. The other boxes still show.

Never commit `.env.local`. Only `.env.example` belongs in git, and it has empty keys.

## Deploy on Vercel

1. Push this repository to GitHub (it is already there if you cloned it).
2. Go to [vercel.com](https://vercel.com) and import the repo.
3. Vercel should detect **Next.js**. Leave the default build command (`npm run build`) and output settings.
4. Under Environment Variables, add the same names as `.env.example` if you want live prices. Leave `PRICE_PROVIDER` unset, or set it to `demo`, to keep sample mode.
5. Deploy. Open the link on a phone.

PriceCharting is paced at one request per second, so give the Values route a few extra seconds of function time if your host allows it (`maxDuration` is set to 30 on the page and the values API).

## Project shape

- Next.js App Router, TypeScript, Tailwind
- Prices go through a `PriceProvider` (`lib/prices`): `DemoPriceProvider` or `LivePriceProvider`
- Live mode composes the Pokémon TCG API (TCGPlayer market), PriceCharting, and eBay Marketplace Insights
- News is fetched on the server from RSS (`lib/news`)
- JSON for other tools: `/api/deals`, `/api/values`, `/api/news`
