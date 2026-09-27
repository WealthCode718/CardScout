import { serverPost } from "@/lib/prices/server-fetch";

interface EbayToken {
  token: string;
  expires: number;
}

const tokens = new Map<string, EbayToken>();
const pending = new Map<string, Promise<string>>();

export function ebayConfigured(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID?.trim() && process.env.EBAY_CLIENT_SECRET?.trim());
}

export function ebayHost(): string {
  return process.env.EBAY_ENV?.toUpperCase() === "SANDBOX" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

function keys(): { id: string; secret: string } {
  const id = process.env.EBAY_CLIENT_ID?.trim() ?? "";
  const secret = process.env.EBAY_CLIENT_SECRET?.trim() ?? "";
  if (!id || !secret) {
    throw new Error("eBay keys are missing. Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET from developer.ebay.com.");
  }
  return { id, secret };
}

async function requestToken(scope: string): Promise<string> {
  const { id, secret } = keys();
  const response = await serverPost(
    new URL(`${ebayHost()}/identity/v1/oauth2/token`),
    `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`,
    {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  );
  let body: {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  } = {};
  try {
    body = JSON.parse(response.text || "{}") as typeof body;
  } catch {
    body = {};
  }
  if (response.status < 200 || response.status >= 300 || !body.access_token) {
    const detail = body.error_description || body.error || `status ${response.status}`;
    throw new Error(`eBay login failed (${detail}). Check EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, and EBAY_ENV.`);
  }
  tokens.set(scope, {
    token: body.access_token,
    expires: Date.now() + (body.expires_in ?? 7200) * 1000,
  });
  return body.access_token;
}

export async function ebayAccessToken(scope: string): Promise<string> {
  const cached = tokens.get(scope);
  if (cached && cached.expires > Date.now() + 30_000) return cached.token;
  const existing = pending.get(scope);
  if (existing) return existing;
  const request = requestToken(scope).finally(() => pending.delete(scope));
  pending.set(scope, request);
  return request;
}

export const EBAY_INSIGHTS_SCOPE = "https://api.ebay.com/oauth/api_scope/buy.marketplace.insights";
