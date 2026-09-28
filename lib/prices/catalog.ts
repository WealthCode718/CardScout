export interface CatalogCard {
  id: string;
  name: string;
  setName: string;
  setId: string;
  numberLabel: string;
  rarity: string;
  imageUrl: string;
  marketPrice: number | null;
  lowPrice: number | null;
  highPrice: number | null;
  finish: string | null;
  finishLabel: string | null;
  tcgplayerUrl: string | null;
  updatedAt: string | null;
  ask: number | null;
}
