import { useState } from "react";
import { Link, useParams } from "wouter";
import { BookmarkCheck, Bookmark, Heart, HeartOff, Star, ChevronDown, ChevronUp, BookOpen, Calendar, User } from "lucide-react";
import {
  useGetMangaSeries, getGetMangaSeriesQueryKey,
  useGetMe, getGetMeQueryKey,
  useGetBookmarks, getGetBookmarksQueryKey,
  useGetFavourites, getGetFavouritesQueryKey,
  useAddBookmark, useRemoveBookmark,
  useAddFavourite, useRemoveFavourite,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function SeriesPage() {
  const { provider, id } = useParams<{ provider: string; id: string }>();
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const safeProvider = provider ?? "";
  const safeId = id ? decodeURIComponent(id) : "";

  const { data: series, isLoading } = useGetMangaSeries(safeProvider, safeId, {
    query: { enabled: !!safeProvider && !!safeId, queryKey: getGetMangaSeriesQueryKey(safeProvider, safeId) },
  });

  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: bookmarks } = useGetBookmarks({ query: { enabled: !!user, queryKey: getGetBookmarksQueryKey() } });
  const { data: favourites } = useGetFavourites({ query: { enabled: !!user, queryKey: getGetFavouritesQueryKey() } });

  const isBookmarked = bookmarks?.some((b) => b.provider === safeProvider && b.seriesId === safeId);
  const isFavourited = favourites?.some((f) => f.provider === safeProvider && f.seriesId === safeId);

  const addBookmark = useAddBookmark({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBookmarksQueryKey() }); toast({ description: "Bookmarked!" }); } } });
  const removeBookmark = useRemoveBookmark({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBookmarksQueryKey() }); toast({ description: "Bookmark removed" }); } } });
  const addFavourite = useAddFavourite({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetFavouritesQueryKey() }); toast({ description: "Added to favourites!" }); } } });
  const removeFavourite = useRemoveFavourite({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetFavouritesQueryKey() }); toast({ description: "Removed from favourites" }); } } });

  function toggleBookmark() {
    if (!user) { toast({ description: "Please login to bookmark", variant: "destructive" }); return; }
    if (!series) return;
    if (isBookmarked) {
      removeBookmark.mutate({ provider: safeProvider, seriesId: safeId });
    } else {
      addBookmark.mutate({ data: { provider: safeProvider, seriesId: safeId, title: series.title, coverImage: series.coverImage, type: series.type ?? undefined, status: series.status ?? undefined } });
    }
  }

  function toggleFavourite() {
    if (!user) { toast({ description: "Please login to favourite", variant: "destructive" }); return; }
    if (!series) return;
    if (isFavourited) {
      removeFavourite.mutate({ provider: safeProvider, seriesId: safeId });
    } else {
      addFavourite.mutate({ data: { provider: safeProvider, seriesId: safeId, title: series.title, coverImage: series.coverImage, type: series.type ?? undefined, status: series.status ?? undefined } });
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Skeleton className="h-64 w-full rounded-xl bg-card mb-8" />
        <div className="flex gap-6">
          <Skeleton className="w-48 h-72 rounded-lg bg-card shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-2/3 bg-card" />
            <Skeleton className="h-4 w-1/3 bg-card" />
            <Skeleton className="h-20 w-full bg-card" />
          </div>
        </div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <p className="text-[#9CA3AF]">Series not found.</p>
      </div>
    );
  }

  const visibleChapters = showAllChapters ? series.chapters : series.chapters.slice(0, 20);
  const firstChapter = series.chapters[series.chapters.length - 1];
  const latestChapter = series.chapters[0];

  return (
    <div className="max-w-7xl mx-auto" data-testid="series-page">
      {series.bannerImage && (
        <div className="relative h-48 md:h-72 overflow-hidden">
          <img src={series.bannerImage} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>
      )}

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <div className="shrink-0">
            <div className="w-40 md:w-48 rounded-xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10">
              {series.coverImage ? (
                <img src={series.coverImage} alt={series.title} className="w-full aspect-[2/3] object-cover" />
              ) : (
                <div className="w-full aspect-[2/3] bg-card flex items-center justify-center">
                  <BookOpen className="w-10 h-10 text-muted-foreground/30" />
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {series.type && <Badge className="bg-primary/20 text-primary border-primary/30">{series.type}</Badge>}
              {series.status && (
                <Badge variant="secondary" className={
                  series.status.toLowerCase().includes("ongoing") ? "bg-green-500/20 text-green-400 border-green-500/30" :
                  series.status.toLowerCase().includes("completed") ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                  ""
                }>
                  {series.status}
                </Badge>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1" data-testid="text-series-title">{series.title}</h1>

            {series.alternativeTitles.length > 0 && (
              <p className="text-sm text-[#9CA3AF] mb-3">{series.alternativeTitles[0]}</p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-[#9CA3AF] mb-4">
              {series.author && (
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {String(series.author)}</span>
              )}
              {series.rating && (
                <span className="flex items-center gap-1 text-yellow-400"><Star className="w-3.5 h-3.5 fill-yellow-400" /> {typeof series.rating === "number" ? series.rating.toFixed(1) : series.rating}</span>
              )}
              <span>{series.totalChapters} chapters</span>
            </div>

            {series.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {series.genres.map((g) => (
                  <span key={g} className="text-xs bg-white/5 border border-white/10 rounded-full px-2.5 py-1 text-[#9CA3AF] hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
                    {g}
                  </span>
                ))}
              </div>
            )}

            {series.description && (
              <div className="mb-5">
                <p className={`text-sm text-[#9CA3AF] leading-relaxed ${!descExpanded ? "line-clamp-3" : ""}`}>
                  {series.description}
                </p>
                {series.description.length > 200 && (
                  <button onClick={() => setDescExpanded(!descExpanded)} className="text-xs text-primary hover:text-primary/80 mt-1">
                    {descExpanded ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {firstChapter && (
                <Button asChild className="bg-primary hover:bg-primary/90 gap-2" data-testid="button-read-first">
                  <Link href={`/read/${safeProvider}/${encodeURIComponent(safeId)}/${encodeURIComponent(firstChapter.id)}`}>
                    <BookOpen className="w-4 h-4" /> Start Reading
                  </Link>
                </Button>
              )}
              {latestChapter && latestChapter.id !== firstChapter?.id && (
                <Button asChild variant="secondary" className="gap-2" data-testid="button-read-latest">
                  <Link href={`/read/${safeProvider}/${encodeURIComponent(safeId)}/${encodeURIComponent(latestChapter.id)}`}>
                    Latest Chapter
                  </Link>
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                className={`border-white/10 ${isBookmarked ? "bg-primary/20 border-primary/30" : "bg-card"}`}
                onClick={toggleBookmark}
                data-testid="button-bookmark"
              >
                {isBookmarked ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={`border-white/10 ${isFavourited ? "bg-red-500/20 border-red-500/30" : "bg-card"}`}
                onClick={toggleFavourite}
                data-testid="button-favourite"
              >
                {isFavourited ? <Heart className="w-4 h-4 fill-red-400 text-red-400" /> : <Heart className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <div className="w-1 h-6 bg-primary rounded-full" />
            Chapters <span className="text-sm font-normal text-[#9CA3AF]">({series.totalChapters})</span>
          </h2>
          <div className="space-y-1">
            {visibleChapters.map((chapter) => (
              <Link
                key={chapter.id}
                href={`/read/${safeProvider}/${encodeURIComponent(safeId)}/${encodeURIComponent(chapter.id)}`}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-card hover:bg-secondary border border-white/[0.06] hover:border-white/10 transition-colors group"
                data-testid={`link-chapter-${chapter.id}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white group-hover:text-primary transition-colors">
                    Chapter {chapter.number}
                  </span>
                  {chapter.title && (
                    <span className="text-sm text-[#9CA3AF] truncate max-w-xs">{chapter.title}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-[#9CA3AF] shrink-0">
                  {chapter.releasedAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {String(chapter.releasedAt).split("T")[0]}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
          {series.chapters.length > 20 && (
            <button
              onClick={() => setShowAllChapters(!showAllChapters)}
              className="w-full mt-3 py-3 text-sm text-primary hover:text-primary/80 flex items-center justify-center gap-2 bg-card rounded-lg border border-white/[0.06] hover:border-white/10 transition-colors"
              data-testid="button-toggle-chapters"
            >
              {showAllChapters ? <><ChevronUp className="w-4 h-4" /> Show Less</> : <><ChevronDown className="w-4 h-4" /> Show All {series.totalChapters} Chapters</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
