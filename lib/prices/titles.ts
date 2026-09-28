export function junkTitle(title: string): boolean {
  return /\b(lot|bundle|lots|booster|elite trainer|etb|binder|proxy|digital code|code card|sealed box|display|choose your|pick your)\b/i.test(
    title,
  );
}

export function looksGraded(title: string): boolean {
  return /\b(psa|bgs|cgc|sgc|ace|hga)\s*\d|\bgraded\b|\bgem\s*mint\b/i.test(title);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function titleHasToken(title: string, token: string): boolean {
  const cleaned = token.trim();
  if (!cleaned) return true;
  return new RegExp(`\\b${escapeRegExp(cleaned)}\\b`, "i").test(title);
}

/** Every word in the card name has to show up, so "Charizard ex" does not match a plain Charizard. */
export function titleHasCardName(title: string, name: string): boolean {
  const tokens = name.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((token) => titleHasToken(title, token));
}

export function titleHasSet(title: string, setName: string): boolean {
  const set = setName.trim().toLowerCase();
  if (!set) return false;
  if (set === "base") return /\bbase set\b/i.test(title);
  return title.toLowerCase().includes(set);
}

/** If the title states a collector number, it has to be this printing. */
export function titleNumberAgrees(title: string, numberLabel: string): boolean {
  const cardNumber = numberLabel.split("/")[0]?.trim() ?? "";
  if (!cardNumber) return true;
  const found = [...title.matchAll(/#?\b(\d{1,3}|[A-Z]{1,3}\d{1,3})\s*\/\s*(\d{1,3}|[A-Z]{0,3}\d{1,3})\b/gi)].map(
    (match) => match[1]?.toLowerCase() ?? "",
  );
  if (found.length === 0) return true;
  return found.includes(cardNumber.toLowerCase());
}
