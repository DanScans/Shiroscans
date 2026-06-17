import { useEffect, useState } from "react";
import { Link } from "wouter";
import { BookOpen, ChevronDown, ChevronRight, Flame, Sparkles, TrendingUp } from "lucide-react";
import { useGetHomeFeed } from "@workspace/api-client-react";
import MangaCard, { MangaCardSkeleton } from "@/components/MangaCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function proxyImage(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

type FeaturedItem = {
  id: string;
  title: string;
  coverImage: string;
  provider: string;
  type?: string | null;
  status?: string | null;
  rating?: number | null;
  description?: string | null;
  genres?: string[];
};

function FeaturedBanner({ items }: { items: FeaturedItem[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % items.length), 5500);
    return () => clearInterval(timer);
  }, [items.length]);

  if (!items.length) return null;

  return (
    <div className="relative h-[440px] md:h-[520px] overflow-hidden rounded-2xl mb-10 shadow-2xl" data-testid="featured-banner">
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
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.src = item.coverImage;
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#07070d] via-[#07070d]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07070d] via-transparent to-transparent" />

            <div className="relative z-10 flex flex-col justify-end h-full p-6 md:p-12 max-w-2xl">
              <div className="flex items-center gap-2 mb-3">
                {item.type && (
                  <Badge className="bg-primary/25 text-primary border-primary/40 text-xs font-semibold tracking-wide">
                    {item.type}
                  </Badge>
                )}
                {item.status && (
                  <Badge variant="secondary" className="text-xs bg-white/10 text-white/70 border-white/10">
                    {item.status}
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-white mb-3 leading-tight line-clamp-2 drop-shadow-lg" data-testid="text-featured-title">
                {item.title}
              </h1>
              {item.genres && item.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {item.genres.slice(0, 4).map((g) => (
                    <span key={g} className="text-xs text-white/60 bg-white/8 rounded-full px-2.5 py-0.5 border border-white/10">
                      {g}
                    </span>
                  ))}
                </div>
              )}
              <Button asChild className="bg-primary hover:bg-primary/90 w-fit gap-2 rounded-xl px-5 py-2.5 shadow-lg shadow-primary/30 font-semibold">
                <Link href={`/series/${item.provider}/${encodeURIComponent(item.id)}`} data-testid="link-featured-read">
                  <BookOpen className="w-4 h-4" /> Read Now
                </Link>
              </Button>
            </div>
          </div>
        );
      })}

      <div className="absolute bottom-5 right-6 flex items-center gap-1.5 z-20">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`rounded-full transition-all duration-300 ${
              i === current ? "w-7 h-2 bg-primary" : "w-2 h-2 bg-white/30 hover:bg-white/50"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

interface CategorySectionProps {
  title: string;
  icon: React.ReactNode;
  viewAllHref: string;
  isLoading: boolean;
  items: Array<{ id: string; title: string; coverImage: string; provider: string; type?: string | null; status?: string | null; rating?: number | null; latestChapter?: string | null; genres?: string[]; isNew?: boolean }>;
  defaultOpen?: boolean;
}

function CategorySection({ title, icon, viewAllHref, isLoading, items, defaultOpen = true }: CategorySectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mb-6">
      <div
        className="flex items-center justify-between mb-0 cursor-pointer select-none group"
        onClick={() => setOpen((o) => !o)}
        role="button"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-primary">{icon}</span>
          <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
          <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full border border-white/8">
            {isLoading ? "..." : items.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {open && viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-xs text-primary/80 hover:text-primary flex items-center gap-1 font-medium transition-colors"
              onClick={(e) => e.stopPropagation()}
              data-testid={`link-view-all-${title.toLowerCase().replace(/\s/g, "-")}`}
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
          <div className={`p-1 rounded-lg bg-white/5 border border-white/8 transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
            <ChevronDown className="w-4 h-4 text-white/50 group-hover:text-white/80 transition-colors" />
          </div>
        </div>
      </div>

      <div
        className={`overflow-hidden transition-all duration-500 ease-in-out ${open ? "max-h-[2000px] opacity-100 mt-4" : "max-h-0 opacity-0 mt-0"}`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {isLoading
            ? Array.from({ length: 12 }).map((_, i) => <MangaCardSkeleton key={i} />)
            : items.map((item) => (
                <MangaCard key={`${item.provider}-${item.id}`} {...item} />
              ))}
        </div>
      </div>

      {!open && (
        <div className="mt-3 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      )}
    </section>
  );
}

export default function HomePage() {
  const { data, isLoading } = useGetHomeFeed();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {isLoading ? (
        <div className="h-[440px] md:h-[520px] rounded-2xl bg-[#111118] animate-pulse mb-10" />
      ) : (
        data?.featured && (
          <FeaturedBanner items={data.featured as FeaturedItem[]} />
        )
      )}

      <div className="space-y-3">
        <CategorySection
          title="Latest Updates"
          icon={<TrendingUp className="w-4 h-4" />}
          viewAllHref="/latest"
          isLoading={isLoading}
          items={(data?.latestUpdates?.slice(0, 12) ?? []) as CategorySectionProps["items"]}
          defaultOpen={true}
        />

        <CategorySection
          title="Popular Now"
          icon={<Flame className="w-4 h-4" />}
          viewAllHref="/popular"
          isLoading={isLoading}
          items={(data?.popularNow?.slice(0, 12) ?? []) as CategorySectionProps["items"]}
          defaultOpen={true}
        />

        {!isLoading && data?.newSeries && data.newSeries.length > 0 && (
          <CategorySection
            title="New Series"
            icon={<Sparkles className="w-4 h-4" />}
            viewAllHref=""
            isLoading={false}
            items={(data.newSeries.slice(0, 12)) as CategorySectionProps["items"]}
            defaultOpen={false}
          />
        )}
      </div>
    </div>
  );
}
