import { useEffect, useRef, useState } from "react";

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const CHANNEL = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

declare global {
  interface Window {
    google?: any;
    __boaMapsInit?: () => void;
  }
}

let loaderPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps?.Map) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  if (!BROWSER_KEY) return Promise.reject(new Error("Google Maps browser key is not configured."));

  loaderPromise = new Promise<void>((resolve, reject) => {
    window.__boaMapsInit = () => resolve();
    const s = document.createElement("script");
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__boaMapsInit` +
      (CHANNEL ? `&channel=${CHANNEL}` : "");
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps."));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  active?: boolean;
};

type Props = {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  className?: string;
  onMarkerClick?: (id: string) => void;
};

export const GoogleMapView = ({ center, zoom = 13, markers = [], className, onMarkerClick }: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !ref.current) return;
        mapRef.current = new window.google.maps.Map(ref.current, {
          center,
          zoom,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current) mapRef.current.panTo(center);
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    markerRefs.current.forEach((m) => m.setMap(null));
    markerRefs.current = markers.map((m) => {
      const marker = new window.google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: mapRef.current,
        title: m.title,
        animation: m.active ? window.google.maps.Animation.BOUNCE : undefined,
      });
      if (onMarkerClick) marker.addListener("click", () => onMarkerClick(m.id));
      return marker;
    });
  }, [markers, onMarkerClick]);

  if (error) {
    return (
      <div className={`flex items-center justify-center rounded-2xl border border-border/60 bg-muted/40 p-6 text-center text-sm text-muted-foreground ${className ?? ""}`}>
        {error}
      </div>
    );
  }

  return <div ref={ref} className={`rounded-2xl border border-border/60 bg-muted/40 ${className ?? ""}`} />;
};

export default GoogleMapView;
