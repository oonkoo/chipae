import { Input, Label } from "chipae";

/**
 * Label is a leaf — shown with the control it labels, which is the only
 * composition that reflects how it is actually used.
 */

export function WithInput() {
  return (
    <div className="flex w-72 flex-col gap-2">
      <Label htmlFor="display-name">Display name</Label>
      <Input id="display-name" defaultValue="Chicken" />
    </div>
  );
}

export function Standalone() {
  return (
    <div className="flex flex-col gap-3">
      <Label>Table name</Label>
      <Label>Visibility</Label>
      <Label>Seats</Label>
    </div>
  );
}

export function WithDisabledControl() {
  return (
    <div className="group flex w-72 flex-col gap-2" data-disabled="true">
      <Label htmlFor="locked">Seats</Label>
      <Input id="locked" defaultValue="4" disabled className="peer" />
    </div>
  );
}
