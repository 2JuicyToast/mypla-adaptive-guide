import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordStrengthMeter } from "@/components/mpla/PasswordStrengthMeter";
import { MyPlaAuthContext, useMyPlaAuth } from "@/hooks/use-mypla-auth";
import { getSupabaseClient } from "@/lib/supabase-client";

export function MyPlaAuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    setLoading(true);
    setConfigurationError(null);

    void getSupabaseClient()
      .then(async (supabase) => {
        if (!active) return;
        setClient(supabase);
        setEnabled(supabase !== null);

        if (!supabase) {
          setUser(null);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;
        setUser(data.session?.user ?? null);

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
          if (active) setUser(session?.user ?? null);
        });
        unsubscribe = () => authListener.subscription.unsubscribe();
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setConfigurationError("Authentication is temporarily unavailable. Please try again.");
        setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [retryCount]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!client) throw new Error("Authentication is not available.");
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error("Sign in failed. Check your email and password, then try again.");
    },
    [client],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!client) throw new Error("Authentication is not available.");
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) {
        throw new Error("Your account could not be created. Check your details and try again.");
      }
      return data.session !== null;
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw new Error("Sign out failed. Please try again.");
  }, [client]);

  const retryConfiguration = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  const value = useMemo(
    () => ({
      enabled,
      loading,
      configurationError,
      user,
      signIn,
      signUp,
      signOut,
      retryConfiguration,
    }),
    [enabled, loading, configurationError, user, signIn, signUp, signOut, retryConfiguration],
  );

  return <MyPlaAuthContext.Provider value={value}>{children}</MyPlaAuthContext.Provider>;
}

export function MyPlaAuthGate({ children }: { children: ReactNode }) {
  const { enabled, loading, configurationError, user, retryConfiguration } = useMyPlaAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p role="status" className="surface-panel px-6 py-4 text-sm text-muted-foreground">
          Preparing your MyPLA workspace…
        </p>
      </main>
    );
  }

  if (configurationError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <section className="surface-panel w-full max-w-md p-6">
          <h1 className="text-xl font-semibold">Sign-in is temporarily unavailable</h1>
          <p role="alert" className="mt-2 text-sm text-muted-foreground">
            {configurationError}
          </p>
          <Button className="mt-5" onClick={retryConfiguration}>
            Try again
          </Button>
        </section>
      </main>
    );
  }

  if (enabled && !user) return <MyPlaAuthScreen />;
  return children;
}

function MyPlaAuthScreen() {
  const { signIn, signUp } = useMyPlaAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "sign-up") {
        const signedIn = await signUp(email.trim(), password);
        if (!signedIn) {
          setNotice("Check your inbox to confirm your email, then sign in.");
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : mode === "sign-in"
            ? "Sign in failed. Please try again."
            : "Your account could not be created. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode: "sign-in" | "sign-up") {
    setMode(nextMode);
    setPassword("");
    setError(null);
    setNotice(null);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="surface-panel w-full max-w-md p-6 sm:p-8">
        <p className="font-display text-lg font-semibold tracking-tight">
          My<span className="text-primary">PLA</span>
        </p>
        <h1 className="mt-4 text-2xl font-semibold">
          {mode === "sign-in" ? "Welcome back" : "Create your MyPLA account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "sign-in"
            ? "Sign in to continue planning with your saved tasks."
            : "Create an account to keep your plan private and persistent."}
        </p>

        <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="space-y-1.5">
            <label htmlFor="mypla-email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="mypla-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="mypla-password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="mypla-password"
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              minLength={6}
              required
              value={password}
              aria-describedby={mode === "sign-up" ? "mypla-password-strength" : undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {mode === "sign-up" ? <PasswordStrengthMeter password={password} /> : null}
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"
            >
              {error}
            </p>
          ) : null}
          {notice ? (
            <p
              role="status"
              className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm"
            >
              {notice}
            </p>
          ) : null}
          <Button className="w-full" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "sign-in" ? "New to MyPLA?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => changeMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          >
            {mode === "sign-in" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </section>
    </main>
  );
}
