import { useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, BookOpen, Flame, Sparkles } from "lucide-react";
import { useGetHomeFeed } from "@workspace/api-client-react";
import MangaCard, { MangaCardSkeleton } from "@/components/MangaCard";
import SectionHeader from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function FeaturedBanner({ items }: { items: Array<{ id: string; title: string; coverImage: string; provider: string; type?: string | null; status?: string | null; rating?: number | null; description?: string | null; genres?: string[] }> }) {
  const [current, setCurrent] = useState(0);
  if (!items.length) return null;

  const item = items[current];

  return (
    <div className="relative h-[420px] md:h-[500px] overflow-hidden rounded-xl mb-10 group" data-testid="featured-banner">
      <div className="absolute inset-0">
        {item.coverImage && (
          <img
            src={item.coverImage}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col justify-end h-full p-6 md:p-10 max-w-xl">
        <div className="flex items-center gap-2 mb-3">
          {item.type && <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">{item.type}</Badge>}
          {item.status && <Badge variant="secondary" className="text-xs">{item.status}</Badge>}
        </div>
        <h1 className="text-2xl md:text-4xl font-bold text-white mb-3 leading-tight line-clamp-2" data-testid="text-featured-title">
          {item.title}
        </h1>
        {item.genres && item.genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {item.genres.slice(0, 4).map((g) => (
              <span key={g} className="text-xs text-[#9CA3AF] bg-white/5 rounded px-2 py-0.5">{g}</span>
            ))}
          </div>
        )}
        <Button asChild className="bg-primary hover:bg-primary/90 w-fit gap-2">
          <Link href={`/series/${item.provider}/${encodeURIComponent(item.id)}`} data-testid="link-featured-read">
            <BookOpen className="w-4 h-4" /> Read Now
          </Link>
        </Button>
      </div>

      <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
        <button
          onClick={() => setCurrent((c) => (c - 1 + items.length) % items.length)}
          className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
          data-testid="button-featured-prev"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex gap-1">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1 rounded-full transition-all ${i === current ? "w-6 bg-primary" : "w-2 bg-white/30"}`}
            />
          ))}
        </div>
        <button
          onClick={() => setCurrent((c) => (c + 1) % items.length)}
          className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur-sm"
          data-testid="button-featured-next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { data, isLoading } = useGetHomeFeed();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {isLoading ? (
        <div className="h-[420px] md:h-[500px] rounded-xl bg-card animate-pulse mb-10" />
      ) : (
        data?.featured && <FeaturedBanner items={data.featured as Parameters<typeof FeaturedBanner>[0]["items"]} />
      )}

      <section className="mb-10">
        <SectionHeader title="Latest Updates" viewAllHref="/latest" accent />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {isLoading
            ? Array.from({ length: 12 }).map((_, i) => <MangaCardSkeleton key={i} />)
            : data?.latestUpdates?.slice(0, 12).map((item) => (
                <MangaCard key={`${item.provider}-${item.id}`} {...item} />
              ))}
        </div>
      </section>

      <section className="mb-10">
        <SectionHeader title="Popular Now" viewAllHref="/popular" accent />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {isLoading
            ? Array.from({ length: 12 }).map((_, i) => <MangaCardSkeleton key={i} />)
            : data?.popularNow?.slice(0, 12).map((item) => (
                <MangaCard key={`${item.provider}-${item.id}`} {...item} />
              ))}
        </div>
      </section>

      {!isLoading && data?.newSeries && data.newSeries.length > 0 && (
        <section className="mb-10">
          <SectionHeader title="New Series" accent />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.newSeries.slice(0, 6).map((item) => (
              <MangaCard key={`${item.provider}-${item.id}`} {...item} isNew />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
