import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "chipae";

/**
 * Rendered open (`defaultOpen`) so the card shows the popup, not just its
 * trigger. Content portals and is positioned against the trigger, so this is
 * pinned to `cardMode: "single"` with its own viewport in config.json.
 */
export function LobbySettings() {
  return (
    <div className="flex justify-center pt-2">
      <Popover defaultOpen>
        <PopoverTrigger render={<Button variant="outline">Lobby</Button>} />
        <PopoverContent>
          <PopoverHeader>
            <PopoverTitle className="font-heading text-base">
              Lobby settings
            </PopoverTitle>
            <PopoverDescription className="text-muted-foreground">
              Only the host can change these.
            </PopoverDescription>
          </PopoverHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="table-name">Name</Label>
            <Input id="table-name" defaultValue="chicken's table" />
          </div>
          <Button size="sm">Save</Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
