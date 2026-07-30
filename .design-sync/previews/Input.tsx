import { Input, Label } from "chipae";

export function Default() {
  return (
    <div className="w-72">
      <Input placeholder="Search players" />
    </div>
  );
}

export function WithLabel() {
  return (
    <div className="flex w-72 flex-col gap-2">
      <Label htmlFor="username">Username</Label>
      <Input id="username" defaultValue="chicken" />
      <p className="text-xs text-muted-foreground">
        3–20 characters: lowercase letters, numbers, underscores
      </p>
    </div>
  );
}

export function JoinCode() {
  return (
    <div className="flex w-72 flex-col gap-2">
      <Label htmlFor="code">Join code</Label>
      <Input
        id="code"
        defaultValue="K4Q7NX"
        className="font-mono tracking-[0.3em] uppercase"
      />
    </div>
  );
}

export function Invalid() {
  return (
    <div className="flex w-72 flex-col gap-2">
      <Label htmlFor="taken">Username</Label>
      <Input id="taken" defaultValue="chicken" aria-invalid />
      <p className="text-xs text-destructive">That name is already at a table</p>
    </div>
  );
}

export function Disabled() {
  return (
    <div className="w-72">
      <Input disabled placeholder="Waiting for the host" />
    </div>
  );
}
