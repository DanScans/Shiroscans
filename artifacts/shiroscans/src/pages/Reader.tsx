import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { ChevronLeft, ChevronRight, ArrowLeft, Heart, Flame, Star, ThumbsUp, Frown } from "lucide-react";
import {
  useGetChapterPages, getGetChapterPagesQueryKey,
  useGetReactions, getGetReactionsQueryKey,
  useGetMe, getGetMeQueryKey,
  useAddHistory,
  useAddReaction,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const REACTIONS = [
  { id: "love", icon: Heart, label: "Love" },
  { id: "fire", icon: Flame, label: "Fire" },
  { id: "wow", icon: Star, label: "Wow" },
  { id: "sad", icon: Frown, label: "Sad" },
  { id: "angry", icon: ThumbsUp, label: "Angry" },
] as const;

export default function ReaderPage() {
  const { provider, seriesId, chapterId } = useParams<{ provider: string; seriesId: string; chapterId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastScroll, setLastScroll] = useState(0);

  const safeProvider = provider ?? "";
  const safeSeriesId = seriesId ? decodeURIComponent(seriesId) : "";
  const safeChapterId = chapterId ? decodeURIComponent(chapterId) : "";

  const { data: pages, isLoading } = useGetChapterPages(safeProvider, safeSeriesId, safeChapterId, {
    query: { enabled: !!safeProvider && !!safeSeriesId && !!safeChapterId, queryKey: getGetChapterPagesQueryKey(safeProvider, safeSeriesId, safeChapterId) },
  });

  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  const { data: reactions, refetch: refetchReactions } = useGetReactions(safeProvider, safeSeriesId, safeChapterId, {
    query: { enabled: !!safeProvider && !!safeSeriesId && !!safeChapterId, queryKey: getGetReactionsQueryKey(safeProvider, safeSeriesId, safeChapterId) },
  });

  const addHistory = useAddHistory();
  const addReaction = useAddReaction({
    mutation: {
      onSuccess: () => { refetchReactions(); },
    },
  });

  useEffect(() => {
    if (pages && user) {
      addHistory.mutate({
        data: {
          provider: safeProvider,
          seriesId: safeSeriesId,
          chapterId: safeChapterId,
          title: pages.seriesTitle,
          coverImage: "",
          chapterNumber: pages.currentChapter,
        },
      });
    }
  }, [pages?.chapterId]);

  useEffect(() => {
    function handleScroll() {
      const current = window.scrollY;
      setHeaderVisible(current < 100 || current < lastScroll);
      setLastScroll(current);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScroll]);

  function handleReaction(reaction: string) {
    if (!user) { toast({ description: "Please login to react", variant: "destructive" }); return; }
    addReaction.mutate({ provider: safeProvider, seriesId: safeSeriesId, chapterId: safeChapterId, data: { reaction: reaction as "love" | "fire" | "wow" | "sad" | "angry" } });
  }

  return (
    <div className="bg-background min-h-screen" data-testid="reader-page">
      <div className={`fixed top-16 left-0 right-0 z-40 bg-[#0A0A0F]/95 backdrop-blur-md border-b border-white/[0.08] transition-transform duration-300 ${headerVisible ? "translate-y-0" : "-translate-y-full"}`}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/series/${safeProvider}/${encodeURIComponent(safeSeriesId)}`}
              className="p-1.5 rounded-md hover:bg-white/5 text-[#9CA3AF] hover:text-white transition-colors shrink-0"
              data-testid="link-back-series"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <p className="text-xs text-[#9CA3AF] truncate">{pages?.seriesTitle}</p>
              <p className="text-sm font-medium text-white">Chapter {pages?.currentChapter}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pages?.prevChapterId && (
              <Link
                href={`/read/${safeProvider}/${encodeURIComponent(safeSeriesId)}/${encodeURIComponent(String(pages.prevChapterId))}`}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-card border border-white/10 text-sm text-[#9CA3AF] hover:text-white hover:border-white/20 transition-colors"
                data-testid="link-prev-chapter"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </Link>
            )}
            {pages?.nextChapterId && (
              <Link
                href={`/read/${safeProvider}/${encodeURIComponent(safeSeriesId)}/${encodeURIComponent(String(pages.nextChapterId))}`}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary text-sm text-white hover:bg-primary/90 transition-colors"
                data-testid="link-next-chapter"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-0 pt-8 pb-0">
        {isLoading ? (
          <div className="space-y-1 px-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="w-full h-96 bg-card" />
            ))}
          </div>
        ) : !pages?.pages?.length ? (
          <div className="text-center py-20">
            <p className="text-[#9CA3AF]">No pages found for this chapter.</p>
          </div>
        ) : (
          <div className="space-y-0.5" data-testid="chapter-pages">
            {pages.pages.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`Page ${i + 1}`}
                className="w-full block"
                loading="lazy"
                data-testid={`img-page-${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {pages && (
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-card rounded-xl border border-white/[0.06] p-6">
            <h3 className="text-sm font-medium text-[#9CA3AF] mb-4">How did you like this chapter?</h3>
            <div className="flex items-center gap-4 flex-wrap">
              {REACTIONS.map(({ id, icon: Icon, label }) => {
                const count = reactions?.[id as keyof typeof reactions] as number | undefined;
                const isSelected = reactions?.userReaction === id;
                return (
                  <button
                    key={id}
                    onClick={() => handleReaction(id)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "bg-white/5 border-white/10 text-[#9CA3AF] hover:text-white hover:border-white/20"
                    }`}
                    data-testid={`button-reaction-${id}`}
                  >
                    <Icon className={`w-5 h-5 ${isSelected ? "fill-primary" : ""}`} />
                    <span className="text-xs font-medium">{label}</span>
                    {count !== undefined && count > 0 && (
                      <span className="text-[10px] text-[#9CA3AF]">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between mt-6">
            <div>
              {pages.prevChapterId && (
                <Link
                  href={`/read/${safeProvider}/${encodeURIComponent(safeSeriesId)}/${encodeURIComponent(String(pages.prevChapterId))}`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card border border-white/10 text-sm text-white hover:border-white/20 transition-colors"
                  data-testid="link-prev-chapter-bottom"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous Chapter
                </Link>
              )}
            </div>
            <div>
              {pages.nextChapterId && (
                <Link
                  href={`/read/${safeProvider}/${encodeURIComponent(safeSeriesId)}/${encodeURIComponent(String(pages.nextChapterId))}`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-sm text-white hover:bg-primary/90 transition-colors"
                  data-testid="link-next-chapter-bottom"
                >
                  Next Chapter <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
