import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { ChevronRight, BookOpen, TrendingUp, Clock, Flame } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyImage(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) return url;
  return `${BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
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

interface FlameItem {
  id: string;
  title: string;
  coverUrl: string;
  status: string;
  latestChapter?: number;
  genres: string[];
  sourceId?: string;
}

interface MangaItem {
  id: string;
  title: string;
  coverImage: string;
  provider: string;
  type?: string | null;
  status?: string | null;
  latestChapter?: string | null;
  updatedAt?: string | null;
  isNew?: boolean;
}

function FlameCard({ item, size = "sm" }: { item: FlameItem; size?: "sm" | "lg" }) {
  const [imgError, setImgError] = useState(false);
  return (
    <Link href={`/flame/series/${encodeURIComponent(item.id)}`} className="group block">
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
            <Flame className="w-6 h-6 text-orange-400/20" />
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

function MangaRow({ item }: { item: MangaItem }) {
  const [imgError, setImgError] = useState(false);
  return (
    <Link
      href={`/series/${item.provider}/${encodeURIComponent(item.id)}`}
      className="group flex gap-3 py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] -mx-1 px-1 rounded-lg transition-colors"
    >
      <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-[#13131f]">
        {item.coverImage && !imgError ? (
          <img
            src={proxyImage(item.coverImage)}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h3 className="text-sm font-bold text-white/90 group-hover:text-primary transition-colors line-clamp-1 mb-1">
          {item.isNew && (
            <span className="text-[9px] font-extrabold uppercase bg-primary text-white px-1.5 py-0.5 rounded mr-1.5 align-middle">NEW</span>
          )}
          {item.title}
        </h3>
        <div className="flex items-center gap-2">
          {item.latestChapter && (
            <span className="text-xs text-primary/80 font-medium truncate">{item.latestChapter}</span>
          )}
          {item.updatedAt && (
            <span className="text-[10px] text-white/25 shrink-0 ml-auto">{relativeTime(item.updatedAt)}</span>
          )}
        </div>
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

function HeroCarousel({ items }: { items: FlameItem[] }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(() => setIdx((i) => (i + 1) % items.length), 4000);
    return () => clearInterval(timerRef.current);
  }, [items.length]);

  if (!items.length) return null;
  const active = items[idx];

  return (
    <div className="relative bg-[#07070d]">
      <div className="relative overflow-hidden" style={{ height: "300px" }}>
        {items.slice(0, 7).map((item, i) => {
          let offset = i - idx;
          const len = Math.min(7, items.length);
          if (offset > len / 2) offset -= len;
          if (offset < -len / 2) offset += len;
          if (Math.abs(offset) > 2) return null;
          const scale = offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.82 : 0.66;
          const opacity = offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.65 : 0.3;
          const zIndex = offset === 0 ? 30 : Math.abs(offset) === 1 ? 20 : 10;
          return (
            <div
              key={`${item.id}-${i}`}
              className="absolute top-0 bottom-0 flex items-center transition-all duration-500 ease-out cursor-pointer"
              style={{ left: "50%", transform: `translateX(calc(-50% + ${offset * 58}vw)) scale(${scale})`, zIndex, opacity, width: "min(52vw, 210px)", filter: offset === 0 ? "none" : "brightness(0.4)" }}
              onClick={() => offset !== 0 && setIdx(i)}
            >
              <Link
                href={offset === 0 ? `/flame/series/${encodeURIComponent(item.id)}` : "#"}
                onClick={(e) => { if (offset !== 0) e.preventDefault(); }}
                className="block w-full"
              >
                <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: "2/3" }}>
                  {item.coverUrl ? (
                    <img src={proxyImage(item.coverUrl)} alt={item.title} className="w-full h-full object-cover" loading="eager" />
                  ) : (
                    <div className="w-full h-full bg-[#1a1a2e] flex items-center justify-center"><Flame className="w-8 h-8 text-orange-400/20" /></div>
                  )}
                </div>
              </Link>
            </div>
          );
        })}
      </div>
      <div className="text-center pt-2 pb-4 px-6">
        <Link href={`/flame/series/${encodeURIComponent(active.id)}`}>
          <h2 className="text-white font-black text-base leading-tight line-clamp-1 hover:text-primary transition-colors">{active.title}</h2>
        </Link>
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {items.slice(0, 7).map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} className={`rounded-full transition-all duration-300 ${i === idx ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-white/25"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [flameData, setFlameData] = useState<{ featured: FlameItem[]; popular: FlameItem[]; latest: FlameItem[] } | null>(null);
  const [flameLoading, setFlameLoading] = useState(true);
  const [mangaLatest, setMangaLatest] = useState<MangaItem[]>([]);
  const [mangaLoading, setMangaLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/flamecomics/home`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => setFlameData(d))
      .catch(() => {})
      .finally(() => setFlameLoading(false));

    fetch(`${BASE}/api/manga/home`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: { latestUpdates?: MangaItem[] }) => setMangaLatest(d.latestUpdates ?? []))
      .catch(() => {})
      .finally(() => setMangaLoading(false));
  }, []);

  const featured = flameData?.featured ?? [];
  const popular = flameData?.popular ?? [];
  const latest = flameData?.latest ?? [];

  return (
    <div className="bg-[#07070d] min-h-screen">
      {flameLoading ? (
        <div className="relative overflow-hidden bg-[#07070d]" style={{ height: "300px" }}>
          <div className="absolute inset-0 flex items-center justify-center gap-3">
            <Skeleton className="rounded-2xl bg-[#13131f] opacity-40" style={{ width: "min(42vw, 180px)", aspectRatio: "2/3" }} />
            <Skeleton className="rounded-2xl bg-[#13131f]" style={{ width: "min(52vw, 210px)", aspectRatio: "2/3" }} />
            <Skeleton className="rounded-2xl bg-[#13131f] opacity-40" style={{ width: "min(42vw, 180px)", aspectRatio: "2/3" }} />
          </div>
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="rounded-full bg-[#13131f]" style={{ width: i === 0 ? 20 : 6, height: 6 }} />)}
          </div>
        </div>
      ) : (
        featured.length > 0 && <HeroCarousel items={featured} />
      )}

      <div className="max-w-2xl mx-auto">
        {/* Popular Manhwa */}
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
            {flameLoading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : popular.slice(0, 8).map((item) => <FlameCard key={item.id} item={item} size="lg" />)
            }
          </div>
        </section>

        {/* Latest Manhwa */}
        <section className="px-4 pt-5 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" /> Latest Manhwa
            </h2>
            <Link href="/manhwa" className="flex items-center gap-0.5 text-xs text-primary font-semibold hover:text-primary/80">
              More <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {flameLoading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : latest.slice(0, 8).map((item) => <FlameCard key={item.id} item={item} />)
            }
          </div>
        </section>

        {/* Latest Manga Updates */}
        <section className="px-4 pt-5 pb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" /> Latest Manga
            </h2>
            <Link href="/latest" className="flex items-center gap-0.5 text-xs text-primary font-semibold hover:text-primary/80">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div>
            {mangaLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex gap-3 py-2.5 border-b border-white/[0.04]">
                    <Skeleton className="w-14 h-14 rounded-lg shrink-0 bg-[#13131f]" />
                    <div className="flex-1 space-y-2 pt-1">
                      <Skeleton className="h-3.5 w-3/4 bg-[#13131f] rounded" />
                      <Skeleton className="h-3 w-1/2 bg-[#13131f] rounded" />
                    </div>
                  </div>
                ))
              : mangaLatest.slice(0, 20).map((item) => <MangaRow key={`${item.provider}-${item.id}`} item={item} />)
            }
          </div>
        </section>
      </div>
    </div>
  );
}
