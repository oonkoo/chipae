"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiSearchLine } from "@remixicon/react";

/** Top-bar player search — hands the query to the Friends page. */
export function SearchBox() {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      className="relative w-full max-w-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const query = value.trim();
        if (query.length >= 2) {
          router.push(`/friends?q=${encodeURIComponent(query)}`);
        }
      }}
    >
      <RiSearchLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Find players…"
        aria-label="Find players"
        className="h-9 w-full rounded-full border border-input bg-input/30 pr-4 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none transition-[box-shadow,border-color]"
      />
    </form>
  );
}
