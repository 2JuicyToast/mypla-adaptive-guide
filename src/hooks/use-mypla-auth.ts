import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

export interface MyPlaAuthContextValue {
  enabled: boolean;
  loading: boolean;
  configurationError: string | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  retryConfiguration: () => void;
}

export const MyPlaAuthContext = createContext<MyPlaAuthContextValue | null>(null);

export function useMyPlaAuth() {
  const context = useContext(MyPlaAuthContext);
  if (!context) throw new Error("useMyPlaAuth must be used within MyPlaAuthProvider.");
  return context;
}
