# CardScout

CardScout is a phone-friendly helper for a parent and a kid who trade Pokémon cards. It has three jobs:

1. **Deals** — show cards whose asking price is below a market price.
2. **Values** — look up what a card is worth, including which set it is from.
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
- the **market estimate** it is being compared with
- the **discount** (percent and dollars saved)
- the condition and who is asking

The list starts with the **biggest percent off**. Switch to **Most saved** if you care more about dollars than percent. A 35% discount on a $11 Pikachu is a different decision from 25% off a $980 Umbreon.

Filter with the name box or the set chips (151, Prismatic Evolutions, Base, and so on).

In the default sample mode, sellers such as “Lakeside Cards” are **made-up practice shops**. They are not places you can buy from.

### Values

Search a card name. Add a set if you know it.

You will often see several rows for one name. A common Pikachu and a special illustration rare Pikachu are not the same card. Read the set and the number (`238/191`, for example) before you trade.

The big number is the estimated market price. The smaller line is a low-to-high range, not a promise.

### News

Headlines come from [PokéBeach](https://www.pokebeach.com/), a long-running Pokémon TCG news site. CardScout reads their public RSS feed on the server (so the phone does not have to talk to the news site directly) and links out to the article.

If that feed cannot be reached, CardScout shows a **saved snapshot** of real PokéBeach headlines from September 27, 2026, and says so on the screen. It does not invent stories.

## Where the numbers come from

**Out of the box, prices are sample estimates stored in the app.** They use real card names, set codes, and official-style artwork so the screens look like a real hunt, but the dollars are practice numbers. Do not buy, sell, or trade based on sample mode.

Card names and pictures are there so you can tell printings apart. CardScout is not affiliated with Nintendo, The Pokémon Company, TPCi, eBay, or TCGPlayer.

### Optional live prices

Copy the example env file:

```bash
cp .env.example .env.local
```

Then set `PRICE_PROVIDER`:

| Value | What you get | Keys |
| --- | --- | --- |
| `demo` (default) | Built-in sample cards and deals | None |
| `pokemontcg` | Card info, pictures, and TCGPlayer prices from the [Pokémon TCG API](https://pokemontcg.io) | Optional `POKEMONTCG_API_KEY` from [dev.pokemontcg.io](https://dev.pokemontcg.io/) |
| `ebay` | eBay Buy It Now listings, compared with Pokémon TCG API market prices | `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` from [developer.ebay.com](https://developer.ebay.com/) |

Notes, so the numbers stay honest:

- **TCGPlayer** does not offer a simple public key for a hobby project. In `pokemontcg` mode, CardScout uses the TCGPlayer prices that the Pokémon TCG API already publishes. A “deal” there means the lowest listed price for that finish (holofoil, for example) is at least 8% under the market price. It is not a specific kid-friendly store.
- **eBay** mode only keeps a listing when the title contains both the card name and the set, and the price is in a believable range versus the market (not a $2 “Charizard” matched to a $400 card). You still need to read the photos and seller feedback.
- If a live source fails, CardScout **falls back to sample prices** and says that on the screen, so the app does not go blank.
- Restart `npm run dev` after changing `.env.local`.

Never commit `.env.local`. Only `.env.example` belongs in git, and it has empty keys.

## Deploy on Vercel

1. Push this repository to GitHub (it is already there if you cloned it).
2. Go to [vercel.com](https://vercel.com) and import the repo.
3. Vercel should detect **Next.js**. Leave the default build command (`npm run build`) and output settings.
4. Under Environment Variables, add the same names as `.env.example` if you want live prices. Leave `PRICE_PROVIDER` unset, or set it to `demo`, to keep sample mode.
5. Deploy. Open the link on a phone.

## Project shape

- Next.js App Router, TypeScript, Tailwind
- Prices go through a `PriceProvider` (`lib/prices`): `DemoPriceProvider`, `PokemonTcgPriceProvider`, `EbayPriceProvider`
- News is fetched on the server from RSS (`lib/news`)
- JSON for other tools: `/api/deals`, `/api/values`, `/api/news`
