import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { ChevronRight, TrendingUp, Clock, Zap, ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyImage(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) return url;
  return `${BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
}

interface AsuraItem {
  id: string;
  title: string;
  coverUrl: string;
  status: string;
  latestChapter?: number;
  genres: string[];
}

function AsuraCard({ item, size = "sm" }: { item: AsuraItem; size?: "sm" | "lg" }) {
  const [imgError, setImgError] = useState(false);
  return (
    <Link href={`/asura/series/${encodeURIComponent(item.id)}`} className="group block">
      <div
        className="relative rounded-xl overflow-hidden bg-[#13131f] shadow-lg group-hover:shadow-primary/10 transition-all duration-300 group-hover:scale-[1.02]"
        style={{ aspectRatio: "2/3" }}
      >
        {item.coverUrl && !imgError ? (
          <img
            src={proxyImage(item.coverUrl)}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#2a1a2e] to-[#1a1a2e] flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {item.latestChapter && (
          <div className="absolute bottom-1.5 left-1.5 text-[9px] font-bold bg-black/70 text-white/80 px-1.5 py-0.5 rounded">
            Ch.{item.latestChapter}
          </div>
        )}
      </div>
      <div className="mt-1.5 px-0.5">
        <h3 className={`font-bold text-white/90 group-hover:text-primary transition-colors line-clamp-2 leading-snug ${size === "lg" ? "text-sm" : "text-xs"}`}>
          {item.title}
        </h3>
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

function HeroCarousel({ items }: { items: AsuraItem[] }) {
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  if (!items.length) return null;
  const count = Math.min(50, items.length);
  const active = items[idx % count]!;

  function prev() {
    setIdx((i) => (i - 1 + count) % count);
  }
  function next() {
    setIdx((i) => (i + 1) % count);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]!.clientX;
    touchStartY.current = e.touches[0]!.clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0]!.clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0]!.clientY - touchStartY.current);
    if (Math.abs(dx) > 40 && dy < 60) {
      if (dx > 0) prev();
      else next();
    }
  }

  const visible = [-2, -1, 0, 1, 2];

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
              className="absolute top-0 bottom-0 flex items-center transition-all duration-500 ease-out cursor-pointer"
              style={{
                left: "50%",
                transform: `translateX(calc(-50% + ${offset * 58}vw)) scale(${scale})`,
                zIndex,
                opacity,
                width: "min(52vw, 210px)",
                filter: offset === 0 ? "none" : "brightness(0.4)",
              }}
              onClick={() => {
                if (offset !== 0) setIdx(i);
              }}
            >
              <Link
                href={offset === 0 ? `/asura/series/${encodeURIComponent(item.id)}` : "#"}
                onClick={(e) => { if (offset !== 0) e.preventDefault(); }}
                className="block w-full"
              >
                <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: "2/3" }}>
                  {item.coverUrl ? (
                    <img src={proxyImage(item.coverUrl)} alt={item.title} className="w-full h-full object-cover" loading="eager" />
                  ) : (
                    <div className="w-full h-full bg-[#1a1a2e] flex items-center justify-center"><Zap className="w-8 h-8 text-primary/20" /></div>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      <div className="text-center pt-2 pb-1 px-6">
        <Link href={`/asura/series/${encodeURIComponent(active.id)}`}>
          <h2 className="text-white font-black text-base leading-tight line-clamp-1 hover:text-primary transition-colors">{active.title}</h2>
        </Link>
      </div>

      {/* Arrow + dot controls */}
      <div className="flex items-center justify-center gap-3 pb-4 px-4">
        <button onClick={prev} className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white transition-all">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(7, count) }).map((_, i) => {
            const dotIdx = idx <= 3 ? i : idx >= count - 4 ? count - 7 + i : idx - 3 + i;
            const active = dotIdx === idx;
            return (
              <button
                key={i}
                onClick={() => setIdx(dotIdx)}
                className={`rounded-full transition-all duration-300 ${active ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-white/25"}`}
              />
            );
          })}
        </div>
        <button onClick={next} className="p-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white transition-all">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [asuraData, setAsuraData] = useState<{ featured: AsuraItem[]; popular: AsuraItem[]; latest: AsuraItem[] } | null>(null);
  const [asuraLoading, setAsuraLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/asurascans/home`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => setAsuraData(d))
      .catch(() => {})
      .finally(() => setAsuraLoading(false));
  }, []);

  const featured = asuraData?.featured ?? [];
  const popular = asuraData?.popular ?? [];
  const latest = asuraData?.latest ?? [];

  return (
    <div className="bg-[#07070d] min-h-screen">
      {asuraLoading ? (
        <div className="relative overflow-hidden bg-[#07070d]" style={{ height: "300px" }}>
          <div className="absolute inset-0 flex items-center justify-center gap-3">
            <Skeleton className="rounded-2xl bg-[#13131f] opacity-40" style={{ width: "min(42vw, 180px)", aspectRatio: "2/3" }} />
            <Skeleton className="rounded-2xl bg-[#13131f]" style={{ width: "min(52vw, 210px)", aspectRatio: "2/3" }} />
            <Skeleton className="rounded-2xl bg-[#13131f] opacity-40" style={{ width: "min(42vw, 180px)", aspectRatio: "2/3" }} />
          </div>
        </div>
      ) : (
        featured.length > 0 && <HeroCarousel items={featured.length >= 10 ? popular.slice(0, 50) : featured} />
      )}

      <div className="max-w-2xl mx-auto">
        <section className="px-4 pt-6 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-400" /> Popular Manhwa
            </h2>
            <Link href="/manhwa" className="flex items-center gap-0.5 text-xs text-primary font-semibold hover:text-primary/80">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {asuraLoading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : popular.slice(0, 8).map((item) => <AsuraCard key={item.id} item={item} size="lg" />)
            }
          </div>
        </section>

        <section className="px-4 pt-5 pb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" /> Latest Manhwa
            </h2>
            <Link href="/manhwa" className="flex items-center gap-0.5 text-xs text-primary font-semibold hover:text-primary/80">
              More <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {asuraLoading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : latest.slice(0, 8).map((item) => <AsuraCard key={item.id} item={item} />)
            }
          </div>
        </section>
      </div>
    </div>
  );
}
