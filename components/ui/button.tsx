import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-4xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Chip pill: a gold chip with thickness. Hover lifts 2px and the
        // bottom edge grows; press sinks the face 4px while the edge
        // collapses to 1px, so it reads as pushed into the table.
        default:
          "bg-[linear-gradient(180deg,var(--primary-hi)_0%,var(--primary)_52%,var(--primary-lo)_100%)] text-primary-foreground font-heading text-base tracking-[0.02em] shadow-[inset_0_1.5px_0_var(--gloss),0_5px_0_var(--primary-edge),0_14px_26px_-10px_color-mix(in_oklch,var(--primary),transparent_45%)] hover:-translate-y-0.5 hover:shadow-[inset_0_1.5px_0_var(--gloss-strong),0_7px_0_var(--primary-edge),0_18px_32px_-10px_color-mix(in_oklch,var(--primary),transparent_30%)] active:not-aria-[haspopup]:translate-y-1 active:shadow-[inset_0_1.5px_0_var(--gloss-weak),0_1px_0_var(--primary-edge),0_6px_14px_-8px_color-mix(in_oklch,var(--primary),transparent_40%)] disabled:shadow-[0_3px_0_color-mix(in_oklch,var(--primary-edge),transparent_65%)] motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0",
        // Candy 3D: the primary action on the felt, where gold is reserved
        // for status (ready, won, NUNO).
        game: "border-2 border-[var(--game-ink)] rounded-xl bg-[linear-gradient(180deg,var(--game-hi)_0%,var(--game)_55%,var(--game-lo)_100%)] text-game-foreground font-heading text-base [text-shadow:0_1px_2px_var(--btn-ink-shadow)] shadow-[inset_0_2px_0_var(--gloss-weak),0_6px_0_var(--game-edge),0_16px_30px_-12px_color-mix(in_oklch,var(--game),transparent_25%)] hover:-translate-y-0.5 hover:shadow-[inset_0_2px_0_var(--gloss),0_8px_0_var(--game-edge),0_22px_36px_-12px_color-mix(in_oklch,var(--game),transparent_10%)] active:not-aria-[haspopup]:translate-y-[5px] active:shadow-[inset_0_2px_0_var(--gloss-weak),0_1px_0_var(--game-edge),0_8px_16px_-10px_color-mix(in_oklch,var(--game),transparent_30%)] motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0",
        outline:
          "border-border bg-input/30 hover:bg-input/50 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xl: "h-12 gap-2 px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
