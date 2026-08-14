import wallet from "@/assets/icons/icon-wallet.png";
import pin from "@/assets/icons/icon-pin.png";
import cards from "@/assets/icons/icon-cards.png";
import transfer from "@/assets/icons/icon-transfer.png";
import support from "@/assets/icons/icon-support.png";
import gear from "@/assets/icons/icon-gear.png";
import bell from "@/assets/icons/icon-bell.png";
import moon from "@/assets/icons/icon-moon.png";
import exitDoor from "@/assets/icons/icon-exit.png";
import statement from "@/assets/icons/icon-statement.png";
import emblem from "@/assets/icons/emblem-b.png";
import { cn } from "@/lib/utils";

export const LUXE_ICONS = {
  wallet,
  pin,
  cards,
  transfer,
  support,
  gear,
  bell,
  moon,
  exit: exitDoor,
  statement,
  emblem,
} as const;

export type LuxeIconName = keyof typeof LUXE_ICONS;

interface LuxeIconProps {
  name: LuxeIconName;
  className?: string;
  alt?: string;
}

/**
 * Photoreal 3D material icon (rose-gold / burgundy leather / polished metal).
 * Purely presentational — swaps in for flat lucide glyphs in the luxe theme.
 */
export const LuxeIcon = ({ name, className, alt = "" }: LuxeIconProps) => (
  <img
    src={LUXE_ICONS[name]}
    alt={alt}
    aria-hidden={alt ? undefined : true}
    loading="lazy"
    draggable={false}
    className={cn("luxe-icon select-none object-contain", className)}
  />
);
