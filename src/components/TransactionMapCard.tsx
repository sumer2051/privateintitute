import { useEffect, useState } from "react";
import { GoogleMapView } from "@/components/GoogleMapView";
import { mapsApi, type MapsPlace } from "@/lib/maps";
import { MapPin, Navigation } from "lucide-react";

type Props = {
  /** Free-text merchant / recipient / description used to look the place up. */
  query: string;
  className?: string;
};

/** Shows the merchant / recipient location for a transaction, when one can be resolved. */
export const TransactionMapCard = ({ query, className }: Props) => {
  const [place, setPlace] = useState<MapsPlace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const q = (query || "").trim();
    if (!q) {
      setLoading(false);
      return;
    }
    setLoading(true);
    mapsApi
      .findPlace(q)
      .then(({ place }) => !cancelled && setPlace(place ?? null))
      .catch(() => !cancelled && setPlace(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (loading) {
    return <div className={`h-28 animate-pulse rounded-2xl bg-muted/50 ${className ?? ""}`} />;
  }
  if (!place?.location) return null;

  const { latitude: lat, longitude: lng } = place.location;

  return (
    <div className={`overflow-hidden rounded-2xl border border-border/60 bg-card/70 ${className ?? ""}`}>
      <GoogleMapView
        center={{ lat, lng }}
        zoom={15}
        markers={[{ id: place.id, lat, lng, title: place.displayName?.text }]}
        className="h-36 w-full rounded-none border-0"
      />
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-secondary">{place.displayName?.text}</p>
          <p className="flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="line-clamp-2">{place.formattedAddress}</span>
          </p>
        </div>
        <a
          href={place.googleMapsUri ?? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Navigation className="h-3 w-3" /> Directions
        </a>
      </div>
    </div>
  );
};

export default TransactionMapCard;
