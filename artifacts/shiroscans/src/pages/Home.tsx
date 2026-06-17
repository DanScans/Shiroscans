import { useEffect, useState } from "react";
import { Link } from "wouter";
import { BookOpen, ChevronRight, Flame, Star, TrendingUp, Sparkles, Clock } from "lucide-react";
import { useGetHomeFeed } from "@workspace/api-client-react";
import MangaCard, { MangaCardSkeleton } from "@/components/MangaCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  description?: string | null;
};

function FeaturedBanner({ items }: { items: FeedItem[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % items.length), 5500);
    return () => clearInterval(timer);
  }, [items.length]);

  if (!items.length) return null;

  return (
    <div className="relative h-[420px] md:h-[500px] overflow-hidden rounded-xl mb-8 shadow-2xl" data-testid="featured-banner">
      {items.map((item, i) => {
        const offset = i - current;
        const style: React.CSSProperties = {
          transform: `translateX(${offset * 100}%)`,
          transition: "transform 0.75s cubic-bezier(0.77, 0, 0.175, 1)",
        };
        return (
          <div key={item.id} className="absolute inset-0" style={style}>
            {item.coverImage && (
              <img
                src={proxyImage(item.coverImage)}
                alt={item.title}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = item.coverImage; }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#07070d] via-[#07070d]/75 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07070d] via-transparent to-transparent" />

            <div className="relative z-10 flex flex-col justify-end h-full p-6 md:p-10 max-w-2xl">
              <div className="flex items-center gap-2 mb-3">
                {item.type && (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                    {item.type}
                  </span>
                )}
                {item.status && (
                  <span className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded bg-white/10 text-white/60 border border-white/10">
                    {item.status}
                  </span>
                )}
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-white mb-2 leading-tight line-clamp-2 drop-shadow-lg" data-testid="text-featured-title">
                {item.title}
              </h1>
              {item.rating && (
                <div className="flex items-center gap-1.5 mb-3">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="text-amber-400 font-semibold text-sm">{typeof item.rating === "number" ? item.rating.toFixed(1) : item.rating}</span>
                </div>
              )}
              {item.genres && item.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {item.genres.slice(0, 4).map((g) => (
                    <span key={g} className="text-xs text-white/60 bg-white/8 rounded-full px-2.5 py-0.5 border border-white/10">{g}</span>
                  ))}
                </div>
              )}
              <Button asChild className="bg-primary hover:bg-primary/90 w-fit gap-2 rounded-lg px-5 py-2.5 shadow-lg shadow-primary/20 font-semibold text-sm">
                <Link href={`/series/${item.provider}/${encodeURIComponent(item.id)}`} data-testid="link-featured-read">
                  <BookOpen className="w-4 h-4" /> Start Reading
                </Link>
              </Button>
            </div>
          </div>
        );
      })}

      <div className="absolute bottom-4 right-5 flex items-center gap-1.5 z-20">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`rounded-full transition-all duration-300 ${i === current ? "w-6 h-2 bg-primary" : "w-2 h-2 bg-white/30 hover:bg-white/50"}`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, href, count }: { icon: React.ReactNode; title: string; href?: string; count?: number }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-1 h-5 bg-primary rounded-full" />
        <span className="text-primary">{icon}</span>
        <h2 className="text-base font-bold text-white tracking-tight">{title}</h2>
        {count !== undefined && (
          <span className="text-[11px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full border border-white/8">{count}</span>
        )}
      </div>
      {href && (
        <Link href={href} className="text-xs text-primary/70 hover:text-primary flex items-center gap-0.5 font-medium transition-colors">
          View all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

function LatestUpdatesFeed({ items, isLoading }: { items: FeedItem[]; isLoading: boolean }) {
  return (
    <div>
      <SectionTitle icon={<TrendingUp className="w-4 h-4" />} title="Latest Updates" href="/latest" count={isLoading ? undefined : items.length} />
      <div className="space-y-1">
        {isLoading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-2.5 rounded-lg bg-[#111118] border border-white/[0.06]">
                <Skeleton className="w-10 h-14 rounded-md shrink-0 bg-[#1a1a24]" />
                <div className="flex-1 space-y-1.5 py-1">
                  <Skeleton className="h-3 w-3/4 bg-[#1a1a24]" />
                  <Skeleton className="h-2.5 w-1/2 bg-[#1a1a24]" />
                  <Skeleton className="h-2.5 w-1/3 bg-[#1a1a24]" />
                </div>
              </div>
            ))
          : items.map((item) => (
              <Link
                key={`${item.provider}-${item.id}`}
                href={`/series/${item.provider}/${encodeURIComponent(item.id)}`}
                className="group flex gap-3 p-2.5 rounded-lg bg-[#111118] border border-white/[0.06] hover:border-primary/30 hover:bg-[#111118]/80 transition-all duration-200"
                data-testid={`feed-item-${item.id}`}
              >
                <div className="w-10 h-14 rounded-md overflow-hidden bg-[#0d0d14] shrink-0 border border-white/5">
                  {item.coverImage ? (
                    <img
                      src={proxyImage(item.coverImage)}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).src = item.coverImage; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-white/20" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-semibold text-white/90 group-hover:text-primary transition-colors leading-snug line-clamp-1">
                      {item.isNew && <span className="inline-block mr-1 text-[9px] font-bold uppercase bg-primary text-white px-1 py-px rounded mr-1">NEW</span>}
                      {item.title}
                    </h3>
                    {item.updatedAt && (
                      <span className="text-[10px] text-white/30 shrink-0 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />{relativeTime(item.updatedAt)}
                      </span>
                    )}
                  </div>
                  {item.latestChapter && (
                    <span className="text-[11px] text-primary/90 font-medium truncate">{item.latestChapter}</span>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.type && (
                      <span className="text-[9px] text-white/40 bg-white/5 px-1.5 py-px rounded">{item.type}</span>
                    )}
                    {item.status && (
                      <span className={`text-[9px] px-1.5 py-px rounded font-medium ${
                        item.status.toLowerCase().includes("ongoing") ? "text-emerald-400/80 bg-emerald-500/10" :
                        item.status.toLowerCase().includes("completed") ? "text-blue-400/80 bg-blue-500/10" :
                        "text-white/30 bg-white/5"
                      }`}>{item.status}</span>
                    )}
                    {item.rating && (
                      <span className="flex items-center gap-0.5 text-[9px] text-amber-400 ml-auto">
                        <Star className="w-2.5 h-2.5 fill-amber-400" />{typeof item.rating === "number" ? item.rating.toFixed(1) : item.rating}
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

function PopularRanked({ items, isLoading }: { items: FeedItem[]; isLoading: boolean }) {
  return (
    <div>
      <SectionTitle icon={<Flame className="w-4 h-4" />} title="Popular Now" href="/popular" count={isLoading ? undefined : items.length} />
      <div className="space-y-1">
        {isLoading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-[#111118] border border-white/[0.06]">
                <Skeleton className="w-6 h-4 bg-[#1a1a24] rounded shrink-0" />
                <Skeleton className="w-9 h-12 rounded bg-[#1a1a24] shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4 bg-[#1a1a24]" />
                  <Skeleton className="h-2.5 w-1/2 bg-[#1a1a24]" />
                </div>
              </div>
            ))
          : items.map((item, idx) => {
              const rank = idx + 1;
              const rankStyle = rank === 1 ? "text-amber-400 font-black" : rank === 2 ? "text-slate-300 font-black" : rank === 3 ? "text-amber-700 font-black" : "text-white/20 font-bold";
              return (
                <Link
                  key={`${item.provider}-${item.id}`}
                  href={`/series/${item.provider}/${encodeURIComponent(item.id)}`}
                  className="group flex items-center gap-2.5 p-2 rounded-lg bg-[#111118] border border-white/[0.06] hover:border-primary/30 hover:bg-[#111118]/80 transition-all duration-200"
                  data-testid={`popular-item-${item.id}`}
                >
                  <span className={`w-6 text-center text-sm shrink-0 ${rankStyle}`}>{rank}</span>
                  <div className="w-9 h-12 rounded-md overflow-hidden bg-[#0d0d14] shrink-0 border border-white/5">
                    {item.coverImage ? (
                      <img
                        src={proxyImage(item.coverImage)}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).src = item.coverImage; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-3 h-3 text-white/20" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-white/90 group-hover:text-primary transition-colors leading-snug line-clamp-2">{item.title}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {item.rating && (
                        <span className="flex items-center gap-0.5 text-[9px] text-amber-400">
                          <Star className="w-2.5 h-2.5 fill-amber-400" />{typeof item.rating === "number" ? item.rating.toFixed(1) : item.rating}
                        </span>
                      )}
                      {item.type && (
                        <span className="text-[9px] text-white/30 bg-white/5 px-1 py-px rounded">{item.type}</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>
    </div>
  );
}

function NewSeriesGrid({ items, isLoading }: { items: FeedItem[]; isLoading: boolean }) {
  if (!isLoading && items.length === 0) return null;
  return (
    <div className="mt-8">
      <SectionTitle icon={<Sparkles className="w-4 h-4" />} title="New Series" count={isLoading ? undefined : items.length} />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <MangaCardSkeleton key={i} />)
          : items.slice(0, 12).map((item) => (
              <MangaCard key={`${item.provider}-${item.id}`} {...item} />
            ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { data, isLoading } = useGetHomeFeed();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {isLoading ? (
        <div className="h-[420px] md:h-[500px] rounded-xl bg-[#111118] animate-pulse mb-8" />
      ) : (
        data?.featured && data.featured.length > 0 && (
          <FeaturedBanner items={data.featured as FeedItem[]} />
        )
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <LatestUpdatesFeed
          isLoading={isLoading}
          items={(data?.latestUpdates ?? []) as FeedItem[]}
        />
        <PopularRanked
          isLoading={isLoading}
          items={(data?.popularNow ?? []) as FeedItem[]}
        />
      </div>

      {!isLoading && (
        <NewSeriesGrid
          isLoading={false}
          items={(data?.newSeries ?? []) as FeedItem[]}
        />
      )}
    </div>
  );
}
