import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";

const _BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function proxyImage(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http")) return url;
  if (url.includes("uploads.mangadex.org")) return url;
  return `${_BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
}
import { ChevronLeft, ChevronRight, Home, MessageSquare, Heart, Flame, Star, ThumbsUp, Frown, List } from "lucide-react";
import CommentsSection from "@/components/CommentsSection";
import {
  useGetChapterPages, getGetChapterPagesQueryKey,
  useGetReactions, getGetReactionsQueryKey,
  useGetMe, getGetMeQueryKey,
  useAddHistory,
  useAddReaction,
} from "@workspace/api-client-react";
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
  const { toast } = useToast();
  const [barsVisible, setBarsVisible] = useState(true);
  const lastScrollY = useRef(0);

  const safeProvider = provider ?? "";
  const safeSeriesId = seriesId ? decodeURIComponent(seriesId) : "";
  const safeChapterId = chapterId ? decodeURIComponent(chapterId) : "";

  const { data: pages, isLoading } = useGetChapterPages(safeProvider, safeSeriesId, safeChapterId, {
    query: {
      enabled: !!safeProvider && !!safeSeriesId && !!safeChapterId,
      queryKey: getGetChapterPagesQueryKey(safeProvider, safeSeriesId, safeChapterId),
    },
  });

  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  const { data: reactions, refetch: refetchReactions } = useGetReactions(safeProvider, safeSeriesId, safeChapterId, {
    query: {
      enabled: !!safeProvider && !!safeSeriesId && !!safeChapterId,
      queryKey: getGetReactionsQueryKey(safeProvider, safeSeriesId, safeChapterId),
    },
  });

  const addHistory = useAddHistory();
  const addReaction = useAddReaction({
    mutation: { onSuccess: () => { refetchReactions(); } },
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
      const goingDown = current > lastScrollY.current && current > 150;
      setBarsVisible(!goingDown);
      lastScrollY.current = current;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function handleTap() {
    setBarsVisible((v) => !v);
  }

  function handleReaction(reaction: string) {
    if (!user) {
      toast({ description: "Please login to react", variant: "destructive" });
      return;
    }
    addReaction.mutate({
      provider: safeProvider,
      seriesId: safeSeriesId,
      chapterId: safeChapterId,
      data: { reaction: reaction as "love" | "fire" | "wow" | "sad" | "angry" },
    });
  }

  const totalReactions = reactions
    ? Object.entries(reactions)
        .filter(([k]) => k !== "userReaction")
        .reduce((sum, [, v]) => sum + (typeof v === "number" ? v : 0), 0)
    : 0;

  const barCls = "transition-transform duration-300 ease-in-out";

  return (
    <div className="bg-[#07070d] min-h-screen" data-testid="reader-page">
      {/* Top bar */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/97 backdrop-blur-md border-b border-white/[0.06] ${barCls} ${barsVisible ? "translate-y-0" : "-translate-y-full"}`}
      >
        <div className="max-w-3xl mx-auto px-3 py-2.5 flex items-center gap-2">
          <Link
            href="/"
            className="p-1.5 rounded-md hover:bg-white/8 text-white/50 hover:text-white transition-colors shrink-0"
            onClick={(e) => e.stopPropagation()}
            data-testid="link-home"
          >
            <Home className="w-5 h-5" />
          </Link>

          <Link
            href={`/series/${safeProvider}/${encodeURIComponent(safeSeriesId)}`}
            className="flex-1 min-w-0 text-center hover:opacity-80 transition-opacity"
            onClick={(e) => e.stopPropagation()}
            data-testid="link-back-series"
          >
            <p className="text-xs text-white/80 font-semibold truncate leading-tight">
              {pages?.seriesTitle ?? "Loading..."}
            </p>
            <p className="text-[11px] text-primary leading-tight">
              Chapter {pages?.currentChapter}
            </p>
          </Link>

          <div className="shrink-0 flex items-center gap-1 text-white/30">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs">{totalReactions > 0 ? totalReactions : ""}</span>
          </div>
        </div>
      </div>

      {/* Pages content */}
      <div
        className="max-w-3xl mx-auto pt-11 pb-20 select-none"
        onClick={handleTap}
        data-testid="reader-content"
      >
        {isLoading ? (
          <div className="space-y-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="w-full bg-[#111118]" style={{ height: "70vh" }} />
            ))}
          </div>
        ) : !pages?.pages?.length ? (
          <div className="text-center py-24 px-4">
            <p className="text-white/40 mb-4">No pages found for this chapter.</p>
            <Link
              href={`/series/${safeProvider}/${encodeURIComponent(safeSeriesId)}`}
              className="text-primary text-sm inline-block"
              onClick={(e) => e.stopPropagation()}
            >
              ← Back to series
            </Link>
          </div>
        ) : (
          <div className="space-y-0.5" data-testid="chapter-pages">
            {(pages.pages as string[]).map((src: string, i: number) => (
              <img
                key={i}
                src={proxyImage(src)}
                alt={`Page ${i + 1}`}
                className="w-full block"
                loading="lazy"
                data-testid={`img-page-${i + 1}`}
              />
            ))}
          </div>
        )}

        {pages && (
          <div className="px-4 py-8" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#111118] rounded-xl border border-white/[0.06] p-5">
              <h3 className="text-sm font-medium text-white/50 mb-4">How did you like this chapter?</h3>
              <div className="flex items-center gap-3 flex-wrap">
                {REACTIONS.map(({ id, icon: Icon, label }) => {
                  const count = reactions?.[id as keyof typeof reactions] as number | undefined;
                  const isSelected = reactions?.userReaction === id;
                  return (
                    <button
                      key={id}
                      onClick={() => handleReaction(id)}
                      className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-primary/20 border-primary/40 text-primary"
                          : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/20"
                      }`}
                      data-testid={`button-reaction-${id}`}
                    >
                      <Icon className={`w-5 h-5 ${isSelected ? "fill-primary" : ""}`} />
                      <span className="text-xs">{label}</span>
                      {count !== undefined && count > 0 && (
                        <span className="text-[10px] text-white/30">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Comments */}
        {safeProvider && safeSeriesId && safeChapterId && (
          <div onClick={(e) => e.stopPropagation()}>
            <CommentsSection provider={safeProvider} seriesId={safeSeriesId} chapterId={safeChapterId} />
          </div>
        )}
      </div>

      {/* Bottom nav bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0F]/97 backdrop-blur-md border-t border-white/[0.06] ${barCls} ${barsVisible ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="max-w-3xl mx-auto flex items-center h-14 px-3 gap-2">
          <div className="flex-1">
            {pages?.prevChapterId ? (
              <Link
                href={`/read/${safeProvider}/${encodeURIComponent(safeSeriesId)}/${encodeURIComponent(String(pages.prevChapterId))}`}
                className="flex items-center justify-center gap-1 w-full py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-bold hover:bg-primary hover:text-white transition-all"
                onClick={(e) => e.stopPropagation()}
                data-testid="link-prev-chapter"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </Link>
            ) : (
              <div className="flex items-center justify-center gap-1 w-full py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/20 text-sm font-bold cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" /> Prev
              </div>
            )}
          </div>

          <div className="flex-[1.8]">
            <Link
              href={`/series/${safeProvider}/${encodeURIComponent(safeSeriesId)}`}
              className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/60 text-sm font-medium hover:bg-white/10 transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              <List className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate text-sm">Ch. {pages?.currentChapter ?? "—"}</span>
            </Link>
          </div>

          <div className="flex-1">
            {pages?.nextChapterId ? (
              <Link
                href={`/read/${safeProvider}/${encodeURIComponent(safeSeriesId)}/${encodeURIComponent(String(pages.nextChapterId))}`}
                className="flex items-center justify-center gap-1 w-full py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
                onClick={(e) => e.stopPropagation()}
                data-testid="link-next-chapter"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <div className="flex items-center justify-center gap-1 w-full py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/20 text-sm font-bold cursor-not-allowed">
                Next <ChevronRight className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
