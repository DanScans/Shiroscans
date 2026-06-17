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
      className="group relative block rounded-xl overflow-hidden bg-[#111118] border border-white/[0.07] hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1"
      data-testid={`card-manga-${id}`}
    >
      <div className="aspect-[2/3] relative overflow-hidden bg-[#0d0d14]">
        {coverImage ? (
          <img
            src={proxyImage(coverImage)}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.src = coverImage;
              img.onerror = () => { img.style.display = "none"; };
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#111118] to-[#0a0a10]">
            <BookOpen className="w-10 h-10 text-muted-foreground/20" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {isNew && (
          <span className="absolute top-2 left-2 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md tracking-wide uppercase shadow-lg">
            NEW
          </span>
        )}
        {type && (
          <span className="absolute top-2 right-2 bg-black/70 text-white/90 text-[9px] px-1.5 py-0.5 rounded-md backdrop-blur-sm font-medium">
            {type}
          </span>
        )}
        {latestChapter && (
          <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <p className="text-xs text-primary font-semibold truncate">{latestChapter}</p>
          </div>
        )}
      </div>

      <div className="p-2.5 pb-3">
        <h3 className="text-xs font-semibold text-white/90 leading-tight line-clamp-2 group-hover:text-primary transition-colors duration-200" data-testid={`text-title-${id}`}>
          {title}
        </h3>
        <div className="flex items-center justify-between mt-1.5 gap-1">
          {status && (
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md ${
              status.toLowerCase().includes("ongoing") ? "bg-emerald-500/15 text-emerald-400" :
              status.toLowerCase().includes("completed") ? "bg-blue-500/15 text-blue-400" :
              "bg-white/8 text-white/40"
            }`}>
              {status}
            </span>
          )}
          {rating && (
            <span className="flex items-center gap-0.5 text-[9px] text-amber-400 ml-auto">
              <Star className="w-2.5 h-2.5 fill-amber-400" />
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
    <div className="rounded-xl overflow-hidden bg-[#111118] border border-white/[0.07]">
      <Skeleton className="aspect-[2/3] w-full bg-[#1a1a24]" />
      <div className="p-2.5 space-y-1.5">
        <Skeleton className="h-2.5 w-full bg-[#1a1a24]" />
        <Skeleton className="h-2.5 w-2/3 bg-[#1a1a24]" />
      </div>
    </div>
  );
}
