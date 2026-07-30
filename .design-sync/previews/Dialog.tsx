import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "chipae";

/**
 * Rendered open (`defaultOpen`) so the card shows the real thing. The content
 * portals to document.body and is fixed-positioned, so this component is
 * pinned to `cardMode: "single"` with its own viewport in config.json —
 * otherwise it escapes its grid cell.
 */
export function ConfirmLeave() {
  return (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave the lobby?</DialogTitle>
          <DialogDescription>
            You&apos;re mid-hand. Leaving folds your cards and gives up your
            seat — the table plays on without you.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Stay</Button>} />
          <Button variant="destructive">Leave lobby</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
