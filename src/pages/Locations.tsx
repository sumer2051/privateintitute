import { useEffect, useMemo, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Landmark, LocateFixed, MapPin, Navigation, Phone, Search, Star, Loader2 } from "lucide-react";
import { GoogleMapView, type MapMarker } from "@/components/GoogleMapView";
import { mapsApi, type MapsPlace } from "@/lib/maps";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";

const DEFAULT_CENTER = { lat: 40.7128, lng: -74.006 };

type Mode = "branch" | "atm";

const Locations = () => {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [mode, setMode] = useState<Mode>("branch");
  const [places, setPlaces] = useState<MapsPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [where, setWhere] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [areaLabel, setAreaLabel] = useState<string>("");

  const search = async (lat: number, lng: number, m: Mode) => {
    setLoading(true);
    try {
      const query = m === "atm" ? "ATM cash machine" : "bank branch";
      const { places } = await mapsApi.nearby(lat, lng, query);
      setPlaces(places ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load nearby locations");
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    search(center.lat, center.lng, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Location is not available on this device");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(next);
        setLocating(false);
        try {
          const { formatted_address } = await mapsApi.reverse(next.lat, next.lng);
          setAreaLabel(formatted_address ?? "");
        } catch (_) { /* non-fatal */ }
        search(next.lat, next.lng, mode);
      },
      () => {
        setLocating(false);
        toast.error("We couldn't get your location. Search by city or ZIP instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const searchArea = async () => {
    if (!where.trim()) return;
    setLoading(true);
    try {
      const { location, formatted_address } = await mapsApi.geocode(where.trim());
      if (!location) {
        toast.error("We couldn't find that place");
        return;
      }
      setCenter(location);
      setAreaLabel(formatted_address ?? where.trim());
      await search(location.lat, location.lng, mode);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const markers: MapMarker[] = useMemo(
    () =>
      places
        .filter((p) => p.location)
        .map((p) => ({
          id: p.id,
          lat: p.location!.latitude,
          lng: p.location!.longitude,
          title: p.displayName?.text,
          active: p.id === activeId,
        })),
    [places, activeId],
  );

  return (
    <>
      <Seo title="Locations | BoA private institute" description="Find nearby branches and ATMs, get directions and check services available at each location." path="/locations" noindex />
      <AuthLayout>
      <div className="space-y-5">
        <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-secondary via-secondary/95 to-primary p-5 text-primary-foreground shadow-[0_18px_50px_-30px_hsl(var(--secondary)/0.7)] md:p-7">
          <p className="text-[10px] uppercase tracking-[0.32em] opacity-75">BoA private institute</p>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Branch &amp; ATM locator</h1>
          <p className="mt-1 text-sm opacity-80">
            {areaLabel ? `Showing results near ${areaLabel}` : "Find banking locations and cash machines near you."}
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary/60" />
              <Input
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchArea()}
                placeholder="City, address or ZIP"
                className="h-11 bg-background pl-9 text-foreground"
              />
            </div>
            <Button onClick={searchArea} disabled={loading} className="h-11">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search
            </Button>
            <Button onClick={useMyLocation} variant="secondary" className="h-11" disabled={locating}>
              {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
              Near me
            </Button>
          </div>

          <div className="mt-3 flex gap-2">
            {(["branch", "atm"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  mode === m ? "bg-background text-secondary shadow" : "bg-white/10 text-primary-foreground/80 hover:bg-white/20"
                }`}
              >
                {m === "branch" ? <Building2 className="h-3.5 w-3.5" /> : <Landmark className="h-3.5 w-3.5" />}
                {m === "branch" ? "Branches" : "ATMs"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <GoogleMapView center={center} markers={markers} onMarkerClick={setActiveId} className="h-[320px] w-full lg:h-[560px]" />

          <div className="space-y-3">
            {loading && (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/30 p-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Finding locations…
              </div>
            )}
            {!loading && places.length === 0 && (
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                No locations found here. Try another city or ZIP.
              </div>
            )}
            {places.map((p) => (
              <Card
                key={p.id}
                onClick={() => {
                  setActiveId(p.id);
                  if (p.location) setCenter({ lat: p.location.latitude, lng: p.location.longitude });
                }}
                className={`cursor-pointer rounded-2xl border-border/60 bg-card/70 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                  activeId === p.id ? "ring-2 ring-primary/60" : ""
                }`}
              >
                <CardContent className="flex gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {mode === "branch" ? <Building2 className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold text-secondary">{p.displayName?.text ?? "Location"}</p>
                      {p.currentOpeningHours?.openNow !== undefined && (
                        <Badge variant={p.currentOpeningHours.openNow ? "default" : "secondary"} className="shrink-0 text-[10px]">
                          {p.currentOpeningHours.openNow ? "Open" : "Closed"}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="line-clamp-2">{p.formattedAddress}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      {p.rating && (
                        <span className="flex items-center gap-1 font-medium text-secondary">
                          <Star className="h-3 w-3 fill-accent text-accent" />
                          {p.rating.toFixed(1)} {p.userRatingCount ? `(${p.userRatingCount})` : ""}
                        </span>
                      )}
                      {p.nationalPhoneNumber && (
                        <a href={`tel:${p.nationalPhoneNumber}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-primary hover:underline">
                          <Phone className="h-3 w-3" /> {p.nationalPhoneNumber}
                        </a>
                      )}
                      {p.location && (
                        <a
                          href={p.googleMapsUri ?? `https://www.google.com/maps/dir/?api=1&destination=${p.location.latitude},${p.location.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Navigation className="h-3 w-3" /> Directions
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Locations;
