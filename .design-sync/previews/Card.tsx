import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "chipae";

export function LobbyCard() {
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>chicken&apos;s table</CardTitle>
        <CardDescription>Nuno · 3 of 4 seats taken</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline">
            K4Q7NX
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        Waiting on jenga to ready up. The host starts the game.
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">Take a seat</Button>
        <Button size="sm" variant="ghost">
          Watch
        </Button>
      </CardFooter>
    </Card>
  );
}

export function Compact() {
  return (
    <Card size="sm" className="max-w-xs">
      <CardHeader>
        <CardTitle>Table talk</CardTitle>
        <CardDescription>Messages vanish when the lobby closes</CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        Deal you in?
      </CardContent>
    </Card>
  );
}

export function Bare() {
  return (
    <Card className="max-w-xs">
      <CardContent>
        <p className="font-heading text-2xl">12</p>
        <p className="text-muted-foreground">hands won</p>
      </CardContent>
    </Card>
  );
}
