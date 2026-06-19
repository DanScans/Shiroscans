import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { ChevronRight, TrendingUp, ChevronLeft, BookOpen, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyImg(url: string): string {
  if (!url) return "";
  return `${BASE}/api/weebcentral/proxy-image?url=${encodeURIComponent(url)}`;
}

interface WCSeries {
  id: string;
  title: string;
  coverUrl: string;
  type: string;
  status: string;
  genres: string[];
  latestChapter: string | null;
  description?: string;
  authors?: string[];
}

function MangaCard({ item, size = "sm" }: { item: WCSeries; size?: "sm" | "lg" }) {
  const [imgError, setImgError] = useState(false);
  return (
    <Link href={`/manga/series/${item.id}`} className="group block">
      <div
        className="relative rounded-xl overflow-hidden bg-[#13131f] shadow-lg group-hover:shadow-primary/10 will-change-transform transition-transform duration-200 ease-out group-hover:scale-[1.02]"
        style={{ aspectRatio: "2/3" }}
      >
        {item.coverUrl && !imgError ? (
          <img
            src={proxyImg(item.coverUrl)}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#0d2e22] to-[#1a1a2e] flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {item.latestChapter && (
          <div className="absolute bottom-1.5 left-1.5 text-[9px] font-bold bg-black/70 text-white/80 px-1.5 py-0.5 rounded">
            {item.latestChapter}
          </div>
        )}
        {item.type && item.type !== "Manga" && (
          <div className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-primary/80 text-white px-1.5 py-0.5 rounded">
            {item.type}
          </div>
        )}
      </div>
      <div className="mt-1.5 px-0.5">
        <h3 className={`font-bold text-white/90 group-hover:text-primary transition-colors duration-150 line-clamp-2 leading-snug ${size === "lg" ? "text-sm" : "text-xs"}`}>
          {item.title}
        </h3>
        {item.genres && item.genres.length > 0 && (
          <p className="text-[10px] text-white/30 truncate mt-0.5">{item.genres.slice(0, 2).join(", ")}</p>
        )}
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div>
      <Skeleton className="rounded-xl bg-[#13131f] w-full" style={{ aspectRatio: "2/3" }} />
      <Skeleton className="h-3 w-3/4 mt-1.5 bg-[#13131f] rounded" />
      <Skeleton className="h-3 w-1/2 mt-1 bg-[#13131f] rounded" />
    </div>
  );
}

function HeroCarousel({ items }: { items: WCSeries[] }) {
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  if (!items.length) return null;
  const count = Math.min(50, items.length);

  function prev() { setIdx((i) => (i - 1 + count) % count); }
  function next() { setIdx((i) => (i + 1) % count); }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]!.clientX;
    touchStartY.current = e.touches[0]!.clientY;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0]!.clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0]!.clientY - touchStartY.current);
    if (Math.abs(dx) > 40 && dy < 60) { if (dx > 0) prev(); else next(); }
  }

  const visible = [-2, -1, 0, 1, 2];
  const active = items[idx % count]!;

  return (
    <div className="relative bg-[#07070d]">
      <div
        className="relative overflow-hidden select-none"
        style={{ height: "300px" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {visible.map((offset) => {
          const i = ((idx + offset) % count + count) % count;
          const item = items[i]!;
          const scale = offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.82 : 0.66;
          const opacity = offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.65 : 0.3;
          const zIndex = offset === 0 ? 30 : Math.abs(offset) === 1 ? 20 : 10;
          return (
            <div
              key={`${i}-${offset}`}
              className="absolute top-0 bottom-0 flex items-center cursor-pointer"
              style={{
                left: "50%",
                transform: `translateX(calc(-50% + ${offset * 58}vw)) scale(${scale})`,
                zIndex, opacity,
                width: "min(52vw, 210px)",
                filter: offset === 0 ? "none" : "brightness(0.4)",
                transition: "transform 350ms cubic-bezier(0.25,0.46,0.45,0.94), opacity 350ms ease",
                willChange: "transform",
              }}
              onClick={() => { if (offset !== 0) setIdx(i); }}
            >
              <Link
                href={offset === 0 ? `/manga/series/${item.id}` : "#"}
                onClick={(e) => { if (offset !== 0) e.preventDefault(); }}
                className="block w-full"
              >
                <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: "2/3" }}>
                  {item.coverUrl ? (
                    <img src={proxyImg(item.coverUrl)} alt={item.title} className="w-full h-full object-cover" loading="eager" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#0d2e22] to-[#1a1a2e] flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-primary/20" />
                    </div>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      <div className="text-center pt-2 pb-1 px-6">
        <Link href={`/manga/series/${active.id}`}>
          <h2 className="text-white font-black text-base leading-tight line-clamp-1 hover:text-primary transition-colors duration-150">{active.title}</h2>
        </Link>
      </div>

      <div className="flex items-center justify-center gap-3 pb-4 px-4">
        <button onClick={prev} className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white transition-all duration-150">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(7, count) }).map((_, i) => {
            const dotIdx = idx <= 3 ? i : idx >= count - 4 ? count - 7 + i : idx - 3 + i;
            const isActive = dotIdx === idx;
            return (
              <button key={i} onClick={() => setIdx(dotIdx)}
                className={`rounded-full transition-all duration-200 ${isActive ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-white/25"}`}
              />
            );
          })}
        </div>
        <button onClick={next} className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white transition-all duration-150">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

type TabType = "home" | "popular" | "search";

export default function MangaHomePage() {
  const [tab, setTab] = useState<TabType>("home");
  const [homeData, setHomeData] = useState<{ featured: WCSeries[]; popular: WCSeries[]; latest: WCSeries[] } | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [popularData, setPopularData] = useState<{ items: WCSeries[]; page: number; hasMore: boolean } | null>(null);
  const [popularLoading, setPopularLoading] = useState(false);
  const [popularPage, setPopularPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WCSeries[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setHomeLoading(true);
    fetch(`${BASE}/api/weebcentral/home`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => setHomeData(d))
      .catch(() => toast({ description: "Failed to load manga content", variant: "destructive" }))
      .finally(() => setHomeLoading(false));
  }, []);

  const fetchPopular = (page: number) => {
    setPopularLoading(true);
    fetch(`${BASE}/api/weebcentral/popular?page=${page}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => setPopularData(d))
      .catch(() => toast({ description: "Failed to load manga", variant: "destructive" }))
      .finally(() => setPopularLoading(false));
  };

  useEffect(() => {
    if (tab === "popular" && !popularData) fetchPopular(popularPage);
  }, [tab]);

  useEffect(() => {
    if (tab === "popular") fetchPopular(popularPage);
  }, [popularPage]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    fetch(`${BASE}/api/weebcentral/search?q=${encodeURIComponent(searchQuery.trim())}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: { items: WCSeries[] }) => setSearchResults(d.items ?? []))
      .catch(() => toast({ description: "Search failed", variant: "destructive" }))
      .finally(() => setSearchLoading(false));
  }

  const carouselItems = homeData ? homeData.popular.slice(0, 50) : [];

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

      <div className="max-w-2xl mx-auto">
        <div className="px-4 pt-4 pb-2">
          <div className="flex gap-1 bg-white/[0.05] rounded-lg p-1">
            {([
              { id: "home", label: "Featured", icon: <BookOpen className="w-3.5 h-3.5" /> },
              { id: "popular", label: "All Manga", icon: <TrendingUp className="w-3.5 h-3.5" /> },
              { id: "search", label: "Search", icon: <Search className="w-3.5 h-3.5" /> },
            ] as { id: TabType; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 flex-1 justify-center py-1.5 rounded-md text-xs font-bold transition-all duration-150 ${tab === id ? "bg-primary text-white shadow" : "text-white/40 hover:text-white/70"}`}
              >
                {icon}{label}
              </button>
            ))}
          </div>
        </div>

        {tab === "home" && (
          <div className="px-4 pb-8 space-y-8">
            <section className="pt-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-400" /> Trending
                </h2>
                <button onClick={() => setTab("popular")} className="flex items-center gap-0.5 text-xs text-primary font-semibold hover:text-primary/80 transition-colors duration-150">
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {homeLoading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
                  : (homeData?.popular ?? []).slice(0, 8).map((item) => <MangaCard key={item.id} item={item} size="lg" />)
                }
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" /> Latest Updates
                </h2>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {homeLoading
                  ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
                  : (homeData?.latest ?? []).map((item) => <MangaCard key={item.id} item={item} />)
                }
              </div>
            </section>
          </div>
        )}

        {tab === "popular" && (
          <div className="px-4 pb-8 pt-2">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {popularLoading
                ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
                : (popularData?.items ?? []).map((item) => <MangaCard key={item.id} item={item} />)
              }
            </div>

            {popularData && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  disabled={popularPage === 1}
                  onClick={() => { setPopularPage((p) => p - 1); window.scrollTo(0, 0); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold border transition-all duration-150 ${popularPage === 1 ? "border-white/5 text-white/20 cursor-not-allowed" : "border-white/10 text-white/70 hover:text-white hover:border-white/30 hover:bg-white/[0.04]"}`}
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <span className="text-sm text-white/50 font-medium px-2">Page {popularPage}</span>
                <button
                  disabled={!popularData.hasMore}
                  onClick={() => { setPopularPage((p) => p + 1); window.scrollTo(0, 0); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold border transition-all duration-150 ${!popularData.hasMore ? "border-white/5 text-white/20 cursor-not-allowed" : "border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/60"}`}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {!popularData && !popularLoading && (
              <Button onClick={() => fetchPopular(1)} className="mt-6 w-full bg-primary hover:bg-primary/90">
                Load Manga
              </Button>
            )}
          </div>
        )}

        {tab === "search" && (
          <div className="px-4 pb-8 pt-2">
            <form onSubmit={handleSearch} className="flex gap-2 py-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search WeebCentral..."
                  className="pl-9 bg-[#1a1a2e] border-white/10 text-white placeholder:text-white/30 focus:border-primary/50"
                />
              </div>
              <Button type="submit" disabled={searchLoading} className="bg-primary hover:bg-primary/90 text-white px-4">
                {searchLoading ? "..." : "Search"}
              </Button>
            </form>

            {searchResults.length > 0 && (
              <>
                <p className="text-xs text-white/40 mb-3">{searchResults.length} results for "{searchQuery}"</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {searchResults.map((item) => <MangaCard key={item.id} item={item} />)}
                </div>
              </>
            )}
            {!searchLoading && searchResults.length === 0 && searchQuery && (
              <div className="text-center py-12 text-white/30">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No results for "{searchQuery}"</p>
              </div>
            )}
            {!searchQuery && (
              <div className="text-center py-12 text-white/30">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Search WeebCentral manga, manhwa &amp; manhua</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
