import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyImg(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http")) return url;
  if (url.includes("uploads.mangadex.org")) return url;
  return `${BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
}

function starsDisplay(r: number | null): string {
  if (r === null || r === undefined) return "";
  if (r >= 9.5) return "⭐⭐⭐⭐⭐";
  if (r >= 9.0) return "⭐⭐⭐⭐✨";
  if (r >= 8.5) return "⭐⭐⭐⭐";
  if (r >= 8.0) return "⭐⭐⭐✨";
  if (r >= 7.5) return "⭐⭐⭐";
  if (r >= 7.0) return "⭐⭐✨";
  return "⭐⭐";
}

interface MangaItem {
  id: string;
  title: string;
  coverImage: string;
  provider: string;
  type?: string | null;
  status?: string | null;
  rating?: number | null;
  latestChapter?: string | null;
  genres?: string[];
}

function seriesHref(item: MangaItem): string {
  return `/series/${encodeURIComponent(item.provider)}/${encodeURIComponent(item.id)}`;
}

function HeroCarousel({ items }: { items: MangaItem[] }) {
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const count = Math.min(20, items.length);
  if (!count) return null;
  const active = items[idx % count]!;

  function next() { setIdx((i) => (i + 1) % count); }
  function prev() { setIdx((i) => (i - 1 + count) % count); }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]!.clientX;
    touchStartY.current = e.touches[0]!.clientY;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0]!.clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0]!.clientY - touchStartY.current);
    if (Math.abs(dx) > 40 && dy < 60) { if (dx > 0) prev(); else next(); }
  }

  const visible = [-2, -1, 0, 1, 2];

  return (
    <div className="relative bg-[#07070d]">
      <div className="relative overflow-hidden select-none" style={{ height: "300px" }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {visible.map((offset) => {
          const i = ((idx + offset) % count + count) % count;
          const item = items[i]!;
          const scale = offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.82 : 0.66;
          const opacity = offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.65 : 0.3;
          const zIndex = offset === 0 ? 30 : Math.abs(offset) === 1 ? 20 : 10;
          return (
            <div key={`${i}-${offset}`}
              className="absolute top-0 bottom-0 flex items-center transition-all duration-500 ease-out cursor-pointer"
              style={{ left: "50%", transform: `translateX(calc(-50% + ${offset * 58}vw)) scale(${scale})`, zIndex, opacity, width: "min(52vw, 210px)", filter: offset === 0 ? "none" : "brightness(0.35)" }}
              onClick={() => { if (offset !== 0) setIdx(i); }}>
              <Link href={offset === 0 ? seriesHref(item) : "#"}
                onClick={(e) => { if (offset !== 0) e.preventDefault(); }} className="block w-full">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: "2/3" }}>
                  {item.coverImage ? (
                    <img src={proxyImg(item.coverImage)} alt={item.title} className="w-full h-full object-cover" loading="eager" />
                  ) : (
                    <div className="w-full h-full bg-[#1a1a2e]" />
                  )}
                  {item.rating !== null && item.rating !== undefined && offset === 0 && (
                    <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm text-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                      ⭐ {item.rating.toFixed(1)}
                    </div>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </div>
      <div className="text-center pt-2 pb-1 px-6">
        <Link href={seriesHref(active)}>
          <h2 className="text-white font-black text-base leading-tight line-clamp-1 hover:text-primary transition-colors">{active.title}</h2>
        </Link>
      </div>
      <div className="flex items-center justify-center gap-1 pb-4">
        {Array.from({ length: Math.min(7, count) }).map((_, i) => {
          const dotIdx = idx <= 3 ? i : idx >= count - 4 ? count - 7 + i : idx - 3 + i;
          const isActive = dotIdx === idx;
          return (
            <button key={i} onClick={() => setIdx(dotIdx)}
              className={`rounded-full transition-all duration-300 ${isActive ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-white/25"}`} />
          );
        })}
      </div>
    </div>
  );
}

function TrendingCard({ item }: { item: MangaItem }) {
  return (
    <Link href={seriesHref(item)} className="group block">
      <div className="relative rounded-xl overflow-hidden bg-[#13131f] shadow-lg" style={{ aspectRatio: "2/3" }}>
        {item.coverImage ? (
          <img src={proxyImg(item.coverImage)} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#2a1a2e] to-[#1a1a2e]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>
      <div className="mt-2 px-0.5">
        <h3 className="text-xs font-bold text-white/90 group-hover:text-primary transition-colors line-clamp-2 leading-snug">{item.title}</h3>
        {item.latestChapter && <p className="text-[10px] text-white/45 mt-0.5">{item.latestChapter}</p>}
        {item.rating != null && (
          <p className="text-[10px] text-yellow-400 mt-0.5 font-semibold">{starsDisplay(item.rating)} {item.rating.toFixed(1)}/10</p>
        )}
      </div>
    </Link>
  );
}

function LatestRow({ item }: { item: MangaItem }) {
  return (
    <Link href={seriesHref(item)} className="group flex gap-3 py-3 border-b border-white/[0.05] hover:bg-white/[0.02] rounded-lg px-1 -mx-1 transition-colors">
      <div className="w-14 shrink-0 rounded-lg overflow-hidden bg-[#13131f]" style={{ aspectRatio: "2/3" }}>
        {item.coverImage ? (
          <img src={proxyImg(item.coverImage)} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-[#1a1a2e]" />
        )}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-bold text-white/90 group-hover:text-primary transition-colors line-clamp-1 leading-snug">{item.title}</p>
        <div className="mt-1.5 space-y-1">
          {item.latestChapter && (
            <span className="text-[11px] text-white/50 line-clamp-1">{item.latestChapter}</span>
          )}
          {(item.genres?.length ?? 0) > 0 && (
            <span className="text-[10px] text-white/30">{item.genres!.slice(0, 2).join(" · ")}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function PopularRankedRow({ item, rank }: { item: MangaItem; rank: number }) {
  return (
    <Link href={seriesHref(item)} className="group flex gap-3 py-3 border-b border-white/[0.05] hover:bg-white/[0.02] rounded-lg px-1 -mx-1 transition-colors">
      <div className="relative w-14 shrink-0 rounded-lg overflow-hidden bg-[#13131f]" style={{ aspectRatio: "2/3" }}>
        <span className="absolute top-0 left-0 z-10 bg-black/80 text-white text-[10px] font-black px-1.5 py-0.5 rounded-br-lg leading-tight">#{rank}</span>
        {item.coverImage ? (
          <img src={proxyImg(item.coverImage)} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-[#1a1a2e]" />
        )}
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-sm font-bold text-white/90 group-hover:text-primary transition-colors line-clamp-1">{item.title}</p>
        {(item.genres?.length ?? 0) > 0 && (
          <p className="text-[10px] text-white/35 mt-1 line-clamp-1">{item.genres!.slice(0, 3).join(" · ")}</p>
        )}
        {item.rating != null && (
          <p className="text-[11px] text-yellow-400 mt-1 font-semibold">{starsDisplay(item.rating)} {item.rating.toFixed(1)}</p>
        )}
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div>
      <Skeleton className="rounded-xl bg-[#13131f] w-full" style={{ aspectRatio: "2/3" }} />
      <Skeleton className="h-3 w-3/4 mt-2 bg-[#13131f] rounded" />
      <Skeleton className="h-3 w-1/2 mt-1 bg-[#13131f] rounded" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex gap-3 py-3 border-b border-white/[0.05]">
      <Skeleton className="w-14 rounded-lg bg-[#13131f] shrink-0" style={{ aspectRatio: "2/3" }} />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-3.5 w-3/4 bg-[#13131f] rounded" />
        <Skeleton className="h-3 w-1/2 bg-[#13131f] rounded" />
        <Skeleton className="h-3 w-2/3 bg-[#13131f] rounded" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const [featured, setFeatured] = useState<MangaItem[]>([]);
  const [homeLoading, setHomeLoading] = useState(true);

  const [popularPeriod, setPopularPeriod] = useState<"weekly" | "monthly" | "alltime">("weekly");
  const [popularData, setPopularData] = useState<Record<string, MangaItem[]>>({});
  const [popularLoading, setPopularLoading] = useState(false);

  const [latestPage, setLatestPage] = useState(1);
  const [latestPageData, setLatestPageData] = useState<Record<number, { items: MangaItem[]; hasMore: boolean }>>({});
  const [latestPageLoading, setLatestPageLoading] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/manga/home`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => {
        const items: MangaItem[] = [
          ...(d.featured ?? []),
          ...(d.popularNow ?? []),
        ];
        const seen = new Set<string>();
        const unique = items.filter((x) => { if (seen.has(x.id)) return false; seen.add(x.id); return true; });
        setFeatured(unique.slice(0, 20));
      })
      .catch(() => {})
      .finally(() => setHomeLoading(false));
  }, []);

  useEffect(() => {
    if (popularData[popularPeriod]) return;
    setPopularLoading(true);
    fetch(`${BASE}/api/manga/popular?period=${popularPeriod}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => setPopularData((prev) => ({ ...prev, [popularPeriod]: d.items ?? [] })))
      .catch(() => {})
      .finally(() => setPopularLoading(false));
  }, [popularPeriod]);

  useEffect(() => {
    if (latestPageData[latestPage]) return;
    setLatestPageLoading(true);
    fetch(`${BASE}/api/manga/latest?page=${latestPage}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => setLatestPageData((prev) => ({ ...prev, [latestPage]: { items: d.items ?? [], hasMore: d.hasMore ?? false } })))
      .catch(() => {})
      .finally(() => setLatestPageLoading(false));
  }, [latestPage]);

  const currentLatestEntry = latestPageData[latestPage];
  const currentLatest = currentLatestEntry?.items ?? [];
  const currentPopular = popularData[popularPeriod] ?? [];
  const carouselItems = featured;

  return (
    <div className="bg-[#07070d] min-h-screen">
      {homeLoading ? (
        <div className="relative overflow-hidden bg-[#07070d]" style={{ height: "300px" }}>
          <div className="absolute inset-0 flex items-center justify-center gap-3">
            <Skeleton className="rounded-2xl bg-[#13131f] opacity-40" style={{ width: "min(42vw, 180px)", aspectRatio: "2/3" }} />
            <Skeleton className="rounded-2xl bg-[#13131f]" style={{ width: "min(52vw, 210px)", aspectRatio: "2/3" }} />
            <Skeleton className="rounded-2xl bg-[#13131f] opacity-40" style={{ width: "min(42vw, 180px)", aspectRatio: "2/3" }} />
          </div>
        </div>
      ) : (
        carouselItems.length > 0 && <HeroCarousel items={carouselItems} />
      )}

      <div className="max-w-2xl mx-auto px-4">
        <section className="pt-6 pb-4">
          <h2 className="text-base font-extrabold text-white mb-4">Featured</h2>
          <div className="grid grid-cols-4 gap-2.5">
            {homeLoading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : featured.slice(0, 4).map((item) => <TrendingCard key={item.id} item={item} />)
            }
          </div>
        </section>

        <section className="pt-4 pb-4">
          <h2 className="text-base font-extrabold text-white mb-4">Latest Added</h2>
          <div>
            {latestPageLoading || (homeLoading && latestPage === 1)
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : currentLatest.map((item, i) => <LatestRow key={item.id || i} item={item} />)
            }
          </div>
          <div className="flex items-center justify-center gap-3 pt-5 pb-2">
            <button onClick={() => { setLatestPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              disabled={latestPage <= 1}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all">‹ Prev</button>
            <span className="text-xs text-white/40 font-semibold">Page {latestPage}</span>
            <button onClick={() => { setLatestPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              disabled={currentLatestEntry ? !currentLatestEntry.hasMore : false}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all">Next ›</button>
          </div>
        </section>

        <section className="pt-4 pb-10">
          <h2 className="text-base font-extrabold text-white mb-3">Popular</h2>
          <div className="flex gap-1 mb-4">
            {(["weekly", "monthly", "alltime"] as const).map((period) => (
              <button key={period} onClick={() => setPopularPeriod(period)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${popularPeriod === period ? "bg-primary text-white" : "bg-white/[0.05] text-white/40 hover:text-white hover:bg-white/[0.08]"}`}>
                {period === "weekly" ? "Weekly" : period === "monthly" ? "Monthly" : "All Time"}
              </button>
            ))}
          </div>
          <div>
            {popularLoading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
              : currentPopular.slice(0, 10).map((item, i) => <PopularRankedRow key={item.id || i} item={item} rank={i + 1} />)
            }
          </div>
        </section>
      </div>
    </div>
  );
}
