import { useState } from "react";
import { Link } from "wouter";
import { BarChart2, Star, TrendingUp } from "lucide-react";
import { useGetPopularManga } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyImage(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http")) return url;
  return `${BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
}

type Period = "weekly" | "monthly" | "alltime";

const TABS: { id: Period; label: string }[] = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "alltime", label: "All Time" },
];

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1 ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/30" :
    rank === 2 ? "bg-slate-400/15 text-slate-300 ring-1 ring-slate-400/20" :
    rank === 3 ? "bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/20" :
    "bg-white/[0.04] text-white/20";
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${cls}`}>
      {rank}
    </div>
  );
}

interface FeedItem {
  id: string;
  title: string;
  coverImage: string;
  provider: string;
  rating?: number | null;
  genres?: string[];
  status?: string | null;
  type?: string | null;
}

const PERIOD_PROVIDERS: Record<Period, string> = {
  weekly: "mangadex",
  monthly: "mangadex",
  alltime: "mangadex",
};

export default function RankingsPage() {
  const [period, setPeriod] = useState<Period>("weekly");

  const { data, isLoading } = useGetPopularManga(
    { provider: PERIOD_PROVIDERS[period], page: 1 },
    { query: { queryKey: ["rankings", period], staleTime: 600_000 } }
  );

  const items = (data?.items ?? []).slice(0, 20) as FeedItem[];

  return (
    <div className="bg-[#07070d] min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-amber-500/10 to-transparent px-4 pt-6 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Rankings</h1>
            <p className="text-xs text-white/35">Top 20 most popular series</p>
          </div>
        </div>

        <div className="flex gap-1.5 bg-white/[0.04] rounded-xl p-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPeriod(id)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === id ? "bg-amber-500/80 text-white shadow" : "text-white/35 hover:text-white/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-8">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="w-9 h-9 rounded-full bg-[#1a1a2e]" />
                <Skeleton className="w-12 h-16 rounded-lg bg-[#1a1a2e]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3 bg-[#1a1a2e]" />
                  <Skeleton className="h-3 w-1/3 bg-[#1a1a2e]" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item, idx) => {
              const rank = idx + 1;
              const rowBg = rank <= 3
                ? "bg-amber-500/[0.04] hover:bg-amber-500/[0.08]"
                : idx % 2 === 0 ? "hover:bg-white/[0.03]" : "bg-white/[0.015] hover:bg-white/[0.04]";
              return (
                <Link
                  key={`${item.provider}-${item.id}`}
                  href={`/series/${item.provider}/${encodeURIComponent(item.id)}`}
                  className={`group flex items-center gap-3 p-3 rounded-xl transition-colors ${rowBg}`}
                >
                  <RankBadge rank={rank} />
                  <div className="w-12 h-16 rounded-lg overflow-hidden shrink-0 bg-[#1a1a2e]">
                    {item.coverImage && (
                      <img
                        src={proxyImage(item.coverImage)}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).src = item.coverImage; }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white/90 group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug">
                      {item.title}
                    </h3>
                    {item.genres && item.genres.length > 0 && (
                      <p className="text-xs text-white/30 mt-0.5 line-clamp-1">{item.genres.slice(0, 3).join(" · ")}</p>
                    )}
                    {item.status && (
                      <span className="text-[10px] text-white/25 mt-1 inline-block">{item.status}</span>
                    )}
                  </div>
                  {item.rating != null && (
                    <div className="shrink-0 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-black text-amber-400">
                        {typeof item.rating === "number" ? item.rating.toFixed(1) : item.rating}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
