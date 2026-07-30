"use client";

import { useActionState, useState } from "react";
import {
  updateProfile,
  type ProfileUpdateState,
} from "@/lib/actions/profile";
import { AVATARS } from "@/lib/avatars";
import { AvatarChip } from "@/components/avatar-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SettingsForm({
  username,
  email,
  displayName,
  avatarId: initialAvatarId,
}: {
  username: string;
  email: string;
  displayName: string;
  avatarId: string;
}) {
  const [formState, formAction, submitting] = useActionState<
    ProfileUpdateState,
    FormData
  >(updateProfile, {});
  const [avatarId, setAvatarId] = useState(initialAvatarId);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {/* Account (read-only, managed by Kinde) */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4">
        <h2 className="text-sm font-medium text-foreground">Account</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Username</dt>
          <dd className="font-mono">@{username}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{email}</dd>
        </dl>
        <p className="text-xs text-muted-foreground">
          Usernames are permanent for now. Sign-in details are managed by your
          identity provider.
        </p>
      </section>

      {/* Avatar */}
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
          defaultValue={displayName}
          placeholder="How friends see you"
        />
        {formState.fieldErrors?.displayName && (
          <p className="text-xs text-destructive">
            {formState.fieldErrors.displayName}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
        {formState.ok && (
          <span className="text-sm text-success">Saved</span>
        )}
      </div>

      {/* Danger zone stub */}
      <section className="flex flex-col gap-2 rounded-xl border border-destructive/30 p-4">
        <h2 className="text-sm font-medium text-destructive">Leave the table</h2>
        <p className="text-xs text-muted-foreground">
          Account deletion isn&apos;t wired up yet — it will remove your
          profile, friendships, and lobby history.
        </p>
        <Button variant="destructive" size="sm" disabled className="self-start">
          Delete account
        </Button>
      </section>
    </form>
  );
}
