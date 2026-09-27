/**
 * Optional adapter. Not on the live path.
 *
 * Live raw prices come from tcgapi.dev (`TCGAPI_API_KEY`).
 * Live sold comps come from eBay (`EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET`).
 * Scrydex is left unwired so a paid Scrydex plan is not required.
 */
export function scrydexConfigured(): boolean {
  return Boolean(process.env.SCRYDEX_API_KEY?.trim() && process.env.SCRYDEX_TEAM_ID?.trim());
}
