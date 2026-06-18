import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface RatingData {
  average: number | null;
  total: number;
  userRating: number | null;
}

interface Props {
  provider: string;
  seriesId: string;
}

export default function StarRating({ provider, seriesId }: Props) {
  const [data, setData] = useState<RatingData | null>(null);
  const [hovered, setHovered] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });

  useEffect(() => {
    fetch(`${BASE}/api/ratings/${encodeURIComponent(provider)}/${encodeURIComponent(seriesId)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: RatingData) => setData(d))
      .catch(() => {});
  }, [provider, seriesId]);

  async function rate(value: number) {
    if (!user) {
      toast({ description: "Log in to rate series", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, seriesId, ratingValue: value }),
      });
      if (!res.ok) throw new Error();
      const updated: RatingData = await res.json();
      setData(updated);
      toast({ description: `Rated ${value}/10!` });
    } catch {
      toast({ description: "Failed to submit rating", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const display = hovered || data?.userRating || 0;
  const maxStars = 5;

  function starFill(starIndex: number): "full" | "half" | "empty" {
    const val = (data?.average ?? 0) / 2;
    if (starIndex <= Math.floor(val)) return "full";
    if (starIndex === Math.ceil(val) && val % 1 >= 0.25) return "half";
    return "empty";
  }

  return (
    <div className="flex flex-col items-center gap-1.5 py-3 px-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
      {data?.average != null ? (
        <div className="flex items-center gap-1 mb-1">
          {Array.from({ length: maxStars }, (_, i) => i + 1).map((i) => {
            const fill = starFill(i);
            return (
              <div key={i} className="relative w-5 h-5">
                <Star className="w-5 h-5 text-white/[0.08] absolute inset-0" />
                {fill === "full" && <Star className="w-5 h-5 fill-amber-400 text-amber-400 absolute inset-0" />}
                {fill === "half" && (
                  <div className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  </div>
                )}
              </div>
            );
          })}
          <span className="text-sm font-black text-amber-400 ml-1">{data.average.toFixed(1)}</span>
          <span className="text-xs text-white/30">/ 10 · {data.total} ratings</span>
        </div>
      ) : (
        <p className="text-xs text-white/30 mb-1">No ratings yet</p>
      )}

      {/* Interactive rating row */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-[11px] text-white/35 font-medium">
          {data?.userRating ? `Your rating: ${data.userRating}/10` : "Rate this series"}
        </p>
        <div
          className="flex gap-0.5"
          onMouseLeave={() => setHovered(0)}
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
            <button
              key={v}
              disabled={submitting}
              onMouseEnter={() => setHovered(v)}
              onClick={() => rate(v)}
              aria-label={`Rate ${v}`}
              className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
            >
              <Star
                className={`w-4 h-4 transition-colors ${
                  v <= display
                    ? "fill-amber-400 text-amber-400"
                    : "text-white/15"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
