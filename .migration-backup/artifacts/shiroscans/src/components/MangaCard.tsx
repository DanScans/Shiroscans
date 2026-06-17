import { Link } from "wouter";
import { Star, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function proxyImage(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

interface MangaCardProps {
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
}

export default function MangaCard({
  id,
  title,
  coverImage,
  provider,
  type,
  status,
  rating,
  latestChapter,
  isNew = false,
}: MangaCardProps) {
  return (
    <Link
      href={`/series/${provider}/${encodeURIComponent(id)}`}
      className="group relative block rounded-lg overflow-hidden bg-[#111118] border border-white/[0.06] hover:border-primary/35 transition-all duration-250 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5"
      data-testid={`card-manga-${id}`}
    >
      <div className="aspect-[2/3] relative overflow-hidden bg-[#0d0d14]">
        {coverImage ? (
          <img
            src={proxyImage(coverImage)}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.src = coverImage;
              img.onerror = () => { img.style.display = "none"; };
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#111118] to-[#0a0a10]">
            <BookOpen className="w-8 h-8 text-muted-foreground/20" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-250" />

        {isNew && (
          <span className="absolute top-1.5 left-1.5 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shadow-md">
            NEW
          </span>
        )}
        {type && !isNew && (
          <span className="absolute top-1.5 left-1.5 bg-black/65 text-white/80 text-[9px] px-1.5 py-0.5 rounded backdrop-blur-sm font-medium">
            {type}
          </span>
        )}

        {rating !== null && rating !== undefined && (
          <span className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-black/70 text-amber-400 text-[9px] font-semibold px-1.5 py-0.5 rounded backdrop-blur-sm">
            <Star className="w-2.5 h-2.5 fill-amber-400" />
            {typeof rating === "number" ? rating.toFixed(1) : rating}
          </span>
        )}

        {latestChapter && (
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-250">
            <p className="text-[10px] text-primary font-semibold truncate">{latestChapter}</p>
          </div>
        )}
      </div>

      <div className="p-2 pb-2.5">
        <h3 className="text-[11px] font-semibold text-white/90 leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200" data-testid={`text-title-${id}`}>
          {title}
        </h3>
        {status && (
          <div className="mt-1">
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
              status.toLowerCase().includes("ongoing") ? "bg-emerald-500/15 text-emerald-400" :
              status.toLowerCase().includes("completed") ? "bg-blue-500/15 text-blue-400" :
              "bg-white/8 text-white/35"
            }`}>
              {status}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function MangaCardSkeleton() {
  return (
    <div className="rounded-lg overflow-hidden bg-[#111118] border border-white/[0.06]">
      <Skeleton className="aspect-[2/3] w-full bg-[#1a1a24]" />
      <div className="p-2 space-y-1">
        <Skeleton className="h-2.5 w-full bg-[#1a1a24]" />
        <Skeleton className="h-2.5 w-2/3 bg-[#1a1a24]" />
      </div>
    </div>
  );
}
