import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface SupabaseClientConfig {
  enabled: boolean;
  url?: string;
  publishableKey?: string;
}

let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!clientPromise) {
    clientPromise = fetch("/api/client-config", {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Authentication is temporarily unavailable. Please try again.");
        }
        const config = (await response.json()) as SupabaseClientConfig;
        if (!config.enabled) return null;
        if (!config.url || !config.publishableKey) {
          throw new Error("Authentication is temporarily unavailable. Please try again.");
        }
        return createClient(config.url, config.publishableKey);
      })
      .catch((error: unknown) => {
        clientPromise = null;
        if (error instanceof Error && error.message.startsWith("Authentication is")) {
          throw error;
        }
        throw new Error("Authentication is temporarily unavailable. Please try again.");
      });
  }
  return clientPromise;
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  const client = await getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.auth.getSession();
  if (error) {
    throw new Error("Your session could not be verified. Please sign in again.");
  }
  return data.session?.access_token ?? null;
}
