import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Star, ChevronRight } from "lucide-react";
import { useGetHomeFeed, useGetPopularManga } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

function proxyImage(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

type FeedItem = {
  id: string;
  title: string;
  coverImage: string;
  provider: string;
  type?: string | null;
  status?: string | null;
  rating?: number | null;
  latestChapter?: string | null;
  genres?: string[];
  isNew?: boolean;
  updatedAt?: string | null;
};

function FeaturedCarousel({ items }: { items: FeedItem[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % items.length), 4500);
    return () => clearInterval(timer);
  }, [items.length]);

  if (!items.length) return null;
  const len = items.length;
  const active = items[current];

  return (
    <div className="relative bg-[#07070d]" data-testid="featured-banner">
      <div className="relative overflow-hidden" style={{ height: "340px" }}>
        {items.slice(0, 7).map((item, i) => {
          let offset = i - current;
          if (offset > len / 2) offset -= len;
          if (offset < -len / 2) offset += len;
          if (Math.abs(offset) > 2) return null;

          const scale = offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.82 : 0.68;
          const opacity = offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.72 : 0.35;
          const zIndex = offset === 0 ? 30 : Math.abs(offset) === 1 ? 20 : 10;

          return (
            <div
              key={`${item.id}-${i}`}
              className="absolute top-0 bottom-0 flex items-center transition-all duration-500 ease-out"
              style={{
                left: "50%",
                transform: `translateX(calc(-50% + ${offset * 62}vw)) scale(${scale})`,
                zIndex,
                opacity,
                width: "min(55vw, 230px)",
                filter: offset === 0 ? "none" : "brightness(0.5)",
                cursor: offset !== 0 ? "pointer" : "default",
              }}
              onClick={() => offset !== 0 && setCurrent(i)}
            >
              <Link
                href={offset === 0 ? `/series/${item.provider}/${encodeURIComponent(item.id)}` : "#"}
                onClick={(e) => { if (offset !== 0) e.preventDefault(); }}
                className="block w-full"
              >
                <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: "2/3" }}>
                  {item.coverImage ? (
                    <img
                      src={proxyImage(item.coverImage)}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).src = item.coverImage; }}
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1a1a2e]" />
                  )}
                  {offset === 0 && item.rating != null && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/75 backdrop-blur-sm rounded-md px-1.5 py-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-amber-400 text-xs font-bold">
                        {typeof item.rating === "number" ? item.rating.toFixed(1) : item.rating}
                      </span>
                    </div>
                  )}
                  {offset === 0 && item.type && (
                    <div className="absolute top-2 right-2 text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-primary text-white">
                      {item.type}
                    </div>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      <div className="text-center pt-3 pb-5 px-6">
        <Link
          href={`/series/${active?.provider}/${encodeURIComponent(active?.id ?? "")}`}
          data-testid="text-featured-title"
        >
          <h2 className="text-white font-black text-base leading-tight line-clamp-1 hover:text-primary transition-colors">
            {active?.title}
          </h2>
        </Link>
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {items.slice(0, 7).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all duration-300 ${i === current ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-white/25 hover:bg-white/40"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TrendingToday({ items, isLoading }: { items: FeedItem[]; isLoading: boolean }) {
  const display = items.slice(0, 8);
  return (
    <div className="px-4 py-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold text-white tracking-tight">Trending Today</h2>
        <Link href="/popular" className="flex items-center gap-0.5 text-xs text-primary font-semibold hover:text-primary/80 transition-colors">
          View all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="rounded-xl bg-[#1a1a2e] w-full" style={{ aspectRatio: "2/3" }} />
                <Skeleton className="h-3.5 w-3/4 mt-2 bg-[#1a1a2e] rounded" />
                <Skeleton className="h-3 w-1/2 mt-1 bg-[#1a1a2e] rounded" />
              </div>
            ))
          : display.map((item) => (
              <Link
                key={`${item.provider}-${item.id}`}
                href={`/series/${item.provider}/${encodeURIComponent(item.id)}`}
                className="group"
              >
                <div className="relative rounded-xl overflow-hidden shadow-lg" style={{ aspectRatio: "2/3" }}>
                  {item.coverImage ? (
                    <img
                      src={proxyImage(item.coverImage)}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).src = item.coverImage; }}
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1a1a2e]" />
                  )}
                  {item.type && (
                    <div className="absolute bottom-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-black/70 text-white/80">
                      {item.type}
                    </div>
                  )}
                </div>
                <div className="mt-1.5 px-0.5">
                  <h3 className="text-sm font-bold text-white/90 group-hover:text-primary transition-colors line-clamp-1 leading-snug">
                    {item.title}
                  </h3>
                  {item.latestChapter && (
                    <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{item.latestChapter}</p>
                  )}
                  <div className="flex items-center gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    ))}
                    {item.rating != null && (
                      <span className="text-xs text-white/60 ml-1 font-medium">
                        {typeof item.rating === "number" ? item.rating.toFixed(1) : item.rating}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
      </div>
    </div>
  );
}

function LatestUpdatesFeed({ items, isLoading }: { items: FeedItem[]; isLoading: boolean }) {
  return (
    <div className="px-4 py-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold text-white tracking-tight">Latest Updates</h2>
        <Link href="/latest" className="flex items-center gap-0.5 text-xs text-primary font-semibold hover:text-primary/80 transition-colors">
          View all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div>
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-3 py-3 border-b border-white/[0.05]">
                <Skeleton className="w-16 h-16 rounded-lg shrink-0 bg-[#1a1a2e]" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-3.5 w-3/4 bg-[#1a1a2e] rounded" />
                  <Skeleton className="h-3 w-full bg-[#1a1a2e] rounded" />
                  <Skeleton className="h-3 w-2/3 bg-[#1a1a2e] rounded" />
                </div>
              </div>
            ))
          : items.slice(0, 20).map((item) => (
              <Link
                key={`${item.provider}-${item.id}`}
                href={`/series/${item.provider}/${encodeURIComponent(item.id)}`}
                className="group flex gap-3 py-3 border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02] -mx-1 px-1 rounded-lg transition-colors"
                data-testid={`feed-item-${item.id}`}
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[#1a1a2e]">
                  {item.coverImage ? (
                    <img
                      src={proxyImage(item.coverImage)}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).src = item.coverImage; }}
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white/90 group-hover:text-primary transition-colors line-clamp-1 mb-1.5">
                    {item.isNew && (
                      <span className="text-[9px] font-extrabold uppercase bg-primary text-white px-1.5 py-0.5 rounded mr-1.5 align-middle">
                        NEW
                      </span>
                    )}
                    {item.title}
                  </h3>
                  <div className="space-y-1">
                    {item.latestChapter && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-primary/90 font-semibold truncate">{item.latestChapter}</span>
                        {item.updatedAt && (
                          <span className="text-[10px] text-amber-400/80 shrink-0">{relativeTime(item.updatedAt)}</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      {item.type && (
                        <span className="text-[10px] text-white/30 bg-white/[0.06] px-1.5 py-px rounded">{item.type}</span>
                      )}
                      {item.status && (
                        <span className={`text-[10px] px-1.5 py-px rounded font-medium ${
                          item.status.toLowerCase().includes("ongoing")
                            ? "text-emerald-400/70 bg-emerald-500/10"
                            : item.status.toLowerCase().includes("completed")
                            ? "text-blue-400/70 bg-blue-500/10"
                            : "text-white/30 bg-white/[0.06]"
                        }`}>
                          {item.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
      </div>
    </div>
  );
}

const POPULAR_PROVIDERS = {
  weekly: "weebcentral",
  monthly: "comix",
  alltime: "mangadex",
} as const;

type PopularTab = keyof typeof POPULAR_PROVIDERS;

function PopularSection() {
  const [tab, setTab] = useState<PopularTab>("weekly");

  const { data, isLoading } = useGetPopularManga(
    { provider: POPULAR_PROVIDERS[tab], page: 1 },
    { query: { queryKey: ["popular-home", tab] as const, staleTime: 120_000 } },
  );

  const items = (data?.items ?? []) as FeedItem[];

  return (
    <div className="px-4 py-5 pb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-extrabold text-white tracking-tight">Popular</h2>
        <Link href="/popular" className="flex items-center gap-0.5 text-xs text-primary font-semibold hover:text-primary/80 transition-colors">
          View all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex gap-1.5 mb-5">
        {(["weekly", "monthly", "alltime"] as PopularTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
              tab === t
                ? "bg-primary text-white shadow-lg shadow-primary/25"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {t === "weekly" ? "Weekly" : t === "monthly" ? "Monthly" : "All Time"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0 bg-[#1a1a2e]" />
                <Skeleton className="w-10 h-14 rounded-lg shrink-0 bg-[#1a1a2e]" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4 bg-[#1a1a2e] rounded" />
                  <Skeleton className="h-3 w-1/2 bg-[#1a1a2e] rounded" />
                </div>
              </div>
            ))
          : items.slice(0, 10).map((item, idx) => {
              const rank = idx + 1;
              const rankBg =
                idx === 0
                  ? "bg-amber-400/20 text-amber-400"
                  : idx === 1
                  ? "bg-slate-400/15 text-slate-300"
                  : idx === 2
                  ? "bg-orange-500/20 text-orange-400"
                  : "bg-white/[0.05] text-white/25";
              return (
                <Link
                  key={`${item.provider}-${item.id}`}
                  href={`/series/${item.provider}/${encodeURIComponent(item.id)}`}
                  className="group flex items-center gap-3"
                  data-testid={`popular-item-${item.id}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${rankBg}`}
                  >
                    {rank}
                  </div>
                  <div className="w-10 h-14 rounded-lg overflow-hidden shrink-0 bg-[#1a1a2e]">
                    {item.coverImage ? (
                      <img
                        src={proxyImage(item.coverImage)}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).src = item.coverImage; }}
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white/90 group-hover:text-primary transition-colors line-clamp-1">
                      {item.title}
                    </h3>
                    {item.genres && item.genres.length > 0 && (
                      <p className="text-[11px] text-white/30 mt-0.5 line-clamp-1">
                        {item.genres.slice(0, 3).join(", ")}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-[11px] text-amber-400 font-medium">
                        {item.rating != null
                          ? typeof item.rating === "number"
                            ? item.rating.toFixed(1)
                            : item.rating
                          : "—"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { data, isLoading } = useGetHomeFeed();

  const featured = (data?.featured ?? []) as FeedItem[];
  const latestUpdates = (data?.latestUpdates ?? []) as FeedItem[];
  const popularNow = (data?.popularNow ?? []) as FeedItem[];

  return (
    <div className="bg-[#07070d] min-h-screen">
      {isLoading ? (
        <div className="bg-[#07070d]" style={{ paddingTop: "0" }}>
          <div className="relative overflow-hidden" style={{ height: "340px" }}>
            <div className="absolute inset-0 flex items-center justify-center gap-3">
              <Skeleton
                className="rounded-2xl bg-[#1a1a2e] opacity-40"
                style={{ width: "min(45vw, 188px)", aspectRatio: "2/3" }}
              />
              <Skeleton
                className="rounded-2xl bg-[#1a1a2e]"
                style={{ width: "min(55vw, 230px)", aspectRatio: "2/3" }}
              />
              <Skeleton
                className="rounded-2xl bg-[#1a1a2e] opacity-40"
                style={{ width: "min(45vw, 188px)", aspectRatio: "2/3" }}
              />
            </div>
          </div>
          <div className="flex justify-center gap-1.5 pt-3 pb-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                className="rounded-full bg-[#1a1a2e]"
                style={{ width: i === 0 ? "20px" : "6px", height: "6px" }}
              />
            ))}
          </div>
        </div>
      ) : (
        featured.length > 0 && <FeaturedCarousel items={featured} />
      )}

      <div className="max-w-2xl mx-auto">
        <TrendingToday items={popularNow} isLoading={isLoading} />
        <LatestUpdatesFeed items={latestUpdates} isLoading={isLoading} />
        <PopularSection />
      </div>
    </div>
  );
}
