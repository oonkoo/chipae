import Link from "next/link";
import { ChipaeLogo } from "@/components/chipae-logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <ChipaeLogo size={88} priority className="opacity-70" />
      <h1 className="font-heading text-2xl text-foreground">
        Nothing at this table
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you&apos;re after doesn&apos;t exist — or it folded.
      </p>
      <Button
        nativeButton={false}
        render={<Link href="/dashboard">Back to the lounge</Link>}
      />
    </main>
  );
}
