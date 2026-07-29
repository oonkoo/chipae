"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  checkUsernameAvailable,
  completeOnboarding,
  type OnboardingState,
} from "@/lib/actions/profile";
import { AVATARS } from "@/lib/avatars";
import { AvatarChip } from "@/components/avatar-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok" }
  | { state: "bad"; message: string };

export function OnboardingForm({
  defaultDisplayName,
}: {
  defaultDisplayName: string;
}) {
  const [formState, formAction, submitting] = useActionState<
    OnboardingState,
    FormData
  >(completeOnboarding, {});
  const [avatarId, setAvatarId] = useState(AVATARS[0].id);
  const [availability, setAvailability] = useState<Availability>({
    state: "idle",
  });
  const [, startCheck] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  function onUsernameChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value) {
      setAvailability({ state: "idle" });
      return;
    }
    setAvailability({ state: "checking" });
    debounceRef.current = setTimeout(() => {
      startCheck(async () => {
        const result = await checkUsernameAvailable(value);
        if (!result.valid) {
          setAvailability({
            state: "bad",
            message: result.message ?? "That name won't fit on a chip",
          });
        } else if (!result.available) {
          setAvailability({ state: "bad", message: "Already seated — try another" });
        } else {
          setAvailability({ state: "ok" });
        }
      });
    }, 400);
  }

  const usernameError =
    formState.fieldErrors?.username ??
    (availability.state === "bad" ? availability.message : undefined);

  return (
    <form action={formAction} className="flex w-full flex-col gap-8">
      {/* Username */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
            @
          </span>
          <Input
            id="username"
            name="username"
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
            placeholder="lowercase_letters"
            className="pl-8 font-mono lowercase"
            aria-invalid={usernameError ? true : undefined}
            onChange={(e) => onUsernameChange(e.target.value)}
          />
          <span className="absolute inset-y-0 right-3 flex items-center text-xs">
            {availability.state === "checking" && (
              <span className="text-muted-foreground">checking…</span>
            )}
            {availability.state === "ok" && (
              <span className="text-success">free</span>
            )}
          </span>
        </div>
        <p
          className={cn(
            "min-h-4 text-xs",
            usernameError ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {usernameError ??
            "This is your handle at every table. Permanent-ish."}
        </p>
      </div>

      {/* Avatar picker */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium text-foreground">
          Your chip
        </legend>
        <div className="grid grid-cols-5 gap-3">
          {AVATARS.map((avatar) => (
            <label
              key={avatar.id}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-2 transition-colors",
                avatarId === avatar.id
                  ? "border-primary bg-primary/10"
                  : "border-transparent hover:bg-muted"
              )}
            >
              <input
                type="radio"
                name="avatarId"
                value={avatar.id}
                checked={avatarId === avatar.id}
                onChange={() => setAvatarId(avatar.id)}
                className="sr-only"
              />
              <AvatarChip avatarId={avatar.id} className="size-11" />
              <span className="text-center text-[10px] leading-tight text-muted-foreground">
                {avatar.label}
              </span>
            </label>
          ))}
        </div>
        {formState.fieldErrors?.avatarId && (
          <p className="text-xs text-destructive">
            {formState.fieldErrors.avatarId}
          </p>
        )}
      </fieldset>

      {/* Display name */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">
          Display name{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="displayName"
          name="displayName"
          maxLength={40}
          defaultValue={defaultDisplayName}
          placeholder="How friends see you"
        />
        {formState.fieldErrors?.displayName && (
          <p className="text-xs text-destructive">
            {formState.fieldErrors.displayName}
          </p>
        )}
      </div>

      {formState.error && (
        <p className="text-sm text-destructive">{formState.error}</p>
      )}

      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Taking your seat…" : "Take my seat"}
      </Button>
    </form>
  );
}
