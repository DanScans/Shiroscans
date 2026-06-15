import { Link } from "wouter";
import { Star, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
  genres = [],
  isNew = false,
}: MangaCardProps) {
  return (
    <Link
      href={`/series/${provider}/${encodeURIComponent(id)}`}
      className="group relative block rounded-lg overflow-hidden bg-card border border-white/[0.06] hover:border-primary/30 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
      data-testid={`card-manga-${id}`}
    >
      <div className="aspect-[2/3] relative overflow-hidden bg-secondary">
        {coverImage ? (
          <img
            src={coverImage}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-background">
            <BookOpen className="w-10 h-10 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        {isNew && (
          <span className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            NEW
          </span>
        )}
        {type && (
          <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
            {type}
          </span>
        )}
        {latestChapter && (
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-black/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <p className="text-xs text-primary font-medium truncate">Ch. {latestChapter}</p>
          </div>
        )}
      </div>

      <div className="p-2.5">
        <h3 className="text-sm font-medium text-white leading-tight line-clamp-2 group-hover:text-primary transition-colors" data-testid={`text-title-${id}`}>
          {title}
        </h3>
        <div className="flex items-center justify-between mt-1.5 gap-1">
          {status && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
              status.toLowerCase().includes("ongoing") ? "bg-green-500/20 text-green-400" :
              status.toLowerCase().includes("completed") ? "bg-blue-500/20 text-blue-400" :
              "bg-white/10 text-[#9CA3AF]"
            }`}>
              {status}
            </span>
          )}
          {rating && (
            <span className="flex items-center gap-0.5 text-[10px] text-yellow-400 ml-auto">
              <Star className="w-2.5 h-2.5 fill-yellow-400" />
              {typeof rating === "number" ? rating.toFixed(1) : rating}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function MangaCardSkeleton() {
  return (
    <div className="rounded-lg overflow-hidden bg-card border border-white/[0.06]">
      <Skeleton className="aspect-[2/3] w-full bg-secondary" />
      <div className="p-2.5 space-y-1.5">
        <Skeleton className="h-3 w-full bg-secondary" />
        <Skeleton className="h-3 w-2/3 bg-secondary" />
      </div>
    </div>
  );
}
