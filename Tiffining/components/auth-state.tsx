"use client";

import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { ClientError, getOperation } from "@/lib/client/api";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { provisionWorkspaceAction } from "@/app/actions/workspace";

export function useSellerAuth() {
  return useQuery({
    queryKey: ["tiffining", "me"],
    queryFn: () => getOperation("me", {}),
    retry: false,
    staleTime: 30_000,
  });
}

export function SignInCard() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function devSignIn() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/dev/login", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Dev sign-in failed.");
      window.location.assign("/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dev sign-in failed.");
      setPending(false);
    }
  }

  async function signIn() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/sign-in/social", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google", callbackURL: "/dashboard" }),
      });
      if (!response.ok) throw new Error("Sign-in was not accepted.");
      const body = await response.json() as { url?: string; redirect?: boolean };
      if (body.url) window.location.assign(body.url);
      else window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in was not accepted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full min-w-0 max-w-md wrap-anywhere shadow-lg border-primary/20">
      <CardHeader>
        <CardTitle className="text-xl">Sign in to Tiffining</CardTitle>
        <CardDescription>Access your kitchen dashboard, live board, and packing sheets.</CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        {/* Instant 1-Click Dev Sign-In */}
        <Button
          type="button"
          size="lg"
          className="w-full font-medium"
          onClick={() => void devSignIn()}
          disabled={pending}
        >
          {pending ? "Logging in…" : "⚡ 1-Click Demo Owner Sign-In"}
        </Button>

        <div className="relative my-2 flex items-center justify-center text-xs uppercase">
          <span className="w-full border-t border-border" />
          <span className="bg-card px-2 text-muted-foreground whitespace-nowrap">or google oauth</span>
          <span className="w-full border-t border-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void signIn()}
          disabled={pending}
        >
          {pending ? "Opening Google…" : "Continue with Google"}
        </Button>

        {message ? <p className="text-sm text-destructive" role="alert">{message}</p> : null}
        <p className="text-xs leading-5 text-muted-foreground">
          <strong>Tip:</strong> Use <em>1-Click Demo Owner Sign-In</em> for instant development testing. Google OAuth requires your real Google Cloud OAuth Client ID configured in <code>.env</code>.
        </p>
      </CardContent>
    </Card>
  );
}

export function OnboardingCard({ onCreated }: { onCreated: () => void }) {
  const planningTimeId = useId();
  const cutoffTimeId = useId();
  const [planningTime, setPlanningTime] = useState("09:00");
  const [cutoffTime, setCutoffTime] = useState("10:00");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrorMsg("");
    try {
      const res = await provisionWorkspaceAction({ planningTime, cutoffTime });
      if (!res.ok) {
        setErrorMsg(res.error || "Failed to set up workspace.");
      } else {
        onCreated();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full min-w-0 max-w-lg wrap-anywhere">
      <CardHeader>
        <CardTitle>Welcome! Set up your kitchen</CardTitle>
        <CardDescription>Your account is signed in. Set your daily schedule to initialize your workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreate} className="flex min-w-0 flex-col gap-4">
          <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <Field className="min-w-0 gap-1.5">
              <FieldLabel htmlFor={planningTimeId}>Morning Prep Time</FieldLabel>
              <Input
                id={planningTimeId}
                type="time"
                className="min-w-0"
                aria-describedby={`${planningTimeId}-description`}
                value={planningTime}
                onChange={(e) => setPlanningTime(e.target.value)}
                required
              />
              <FieldDescription id={`${planningTimeId}-description`}>When you start checking today&apos;s board</FieldDescription>
            </Field>
            <Field className="min-w-0 gap-1.5">
              <FieldLabel htmlFor={cutoffTimeId}>Order Cutoff Time</FieldLabel>
              <Input
                id={cutoffTimeId}
                type="time"
                className="min-w-0"
                aria-describedby={`${cutoffTimeId}-description`}
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
                required
              />
              <FieldDescription id={`${cutoffTimeId}-description`}>Final cutoff before packing</FieldDescription>
            </Field>
          </FieldGroup>
          {errorMsg ? <p className="text-sm text-destructive" role="alert">{errorMsg}</p> : null}
          <div className="flex flex-col items-stretch gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating workspace…" : "Create Kitchen Workspace"}
            </Button>
            <Button type="button" variant="outline" onClick={onCreated}>
              Check again
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function AuthState({ children }: { children: (seller: NonNullable<ReturnType<typeof useSellerAuth>["data"]>) => React.ReactNode }) {
  const auth = useSellerAuth();

  if (auth.isPending) return <DashboardSkeleton />;
  if (auth.data) return <>{children(auth.data)}</>;

  const error = auth.error;
  const status = error instanceof ClientError ? error.status : undefined;
  const isPrivateLock = status === 409 || (error instanceof ClientError && error.code === "PRIVACY_DELETING");

  return (
    <main className="flex min-h-dvh min-w-0 items-center justify-center bg-muted/30 px-4 py-10">
      {status === 401 ? <SignInCard /> : status === 403 ? (
        <OnboardingCard onCreated={() => void auth.refetch()} />
      ) : isPrivateLock ? (
        <Card className="w-full min-w-0 max-w-lg wrap-anywhere"><CardHeader><CardTitle>Privacy lock is active</CardTitle><CardDescription>This workspace is temporarily locked while a privacy operation completes.</CardDescription></CardHeader><CardContent><Alert variant="destructive"><AlertTitle>Read access paused</AlertTitle><AlertDescription>Business data will become available again when the operation finishes.</AlertDescription></Alert><Button className="mt-4" variant="outline" onClick={() => void auth.refetch()}>Check again</Button></CardContent></Card>
      ) : (
        <Card className="w-full min-w-0 max-w-lg wrap-anywhere"><CardHeader><CardTitle>We couldn’t load your workspace</CardTitle><CardDescription>{error instanceof Error ? error.message : "A temporary connection problem interrupted the request."}</CardDescription></CardHeader><CardContent><Button onClick={() => void auth.refetch()}>Try again</Button></CardContent></Card>
      )}
    </main>
  );
}
