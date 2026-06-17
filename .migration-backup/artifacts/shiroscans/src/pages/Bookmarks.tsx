import { Link } from "wouter";
import { BookmarkCheck, Trash2, BookOpen } from "lucide-react";
import { useGetBookmarks, getGetBookmarksQueryKey, useRemoveBookmark, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import SectionHeader from "@/components/SectionHeader";

export default function BookmarksPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: bookmarks, isLoading } = useGetBookmarks({ query: { enabled: !!user, queryKey: getGetBookmarksQueryKey() } });

  const removeBookmark = useRemoveBookmark({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBookmarksQueryKey() });
        toast({ description: "Bookmark removed" });
      },
    },
  });

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <BookmarkCheck className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Sign in to view bookmarks</h2>
        <p className="text-[#9CA3AF] mb-6">Keep track of your favourite series</p>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/login">Sign In</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <SectionHeader title="Bookmarks" accent />
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-lg overflow-hidden bg-card border border-white/[0.06]">
              <Skeleton className="aspect-[2/3] w-full bg-secondary" />
              <div className="p-2.5 space-y-1.5"><Skeleton className="h-3 w-full bg-secondary" /></div>
            </div>
          ))}
        </div>
      ) : !bookmarks?.length ? (
        <div className="text-center py-20">
          <BookmarkCheck className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-[#9CA3AF] text-lg">No bookmarks yet</p>
          <p className="text-[#9CA3AF]/60 text-sm mt-1">Browse manga and bookmark series you want to follow</p>
          <Button asChild className="mt-4 bg-primary hover:bg-primary/90"><Link href="/">Browse Manga</Link></Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {bookmarks.map((b) => (
            <div key={b.id} className="group relative rounded-lg overflow-hidden bg-card border border-white/[0.06] hover:border-primary/30 transition-all duration-200" data-testid={`card-bookmark-${b.id}`}>
              <Link href={`/series/${b.provider}/${encodeURIComponent(b.seriesId)}`} className="block">
                <div className="aspect-[2/3] relative overflow-hidden bg-secondary">
                  {b.coverImage ? (
                    <img src={b.coverImage} alt={b.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-8 h-8 text-muted-foreground/30" /></div>
                  )}
                  {b.status && (
                    <span className={`absolute top-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded backdrop-blur-sm ${b.status.toLowerCase().includes("ongoing") ? "bg-green-500/80 text-white" : "bg-white/20 text-white"}`}>
                      {b.status}
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-primary transition-colors">{b.title}</h3>
                  {b.latestChapter && <p className="text-xs text-primary mt-1">Ch. {b.latestChapter}</p>}
                </div>
              </Link>
              <button
                onClick={() => removeBookmark.mutate({ provider: b.provider, seriesId: b.seriesId })}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-[#9CA3AF] hover:text-destructive hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                data-testid={`button-remove-bookmark-${b.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
