import { Button } from "chipae";

/**
 * Copy follows the art direction's voice: game-night host, not esports
 * announcer (design/art-direction.md).
 */

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Take a seat</Button>
      <Button variant="outline">Join by code</Button>
      <Button variant="secondary">Copy code</Button>
      <Button variant="ghost">Not now</Button>
      <Button variant="destructive">Leave lobby</Button>
      <Button variant="link">What is Nuno?</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Ready</Button>
      <Button size="sm">Deal me in</Button>
      <Button size="default">Start Nuno</Button>
      <Button size="lg">Open a lobby</Button>
    </div>
  );
}

export function OneGoldCta() {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost">Cancel</Button>
      <Button variant="outline">Invite friends</Button>
      <Button>Start Nuno</Button>
    </div>
  );
}

export function Disabled() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled>Start Nuno</Button>
      <Button variant="outline" disabled>
        Waiting for the host
      </Button>
      <Button variant="destructive" disabled>
        Leave lobby
      </Button>
    </div>
  );
}
