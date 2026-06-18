import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight, List } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyImage(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http")) return url;
  return `${BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
}

interface ChapterData {
  id: string;
  seriesId: string;
  seriesTitle: string;
  pages: string[];
  currentChapter: string;
  prevChapterId: string | null;
  nextChapterId: string | null;
}

interface AsuraChapter {
  id: string;
  slug: string;
  number: number;
  title: string;
}

interface AsuraSeries {
  id: string;
  title: string;
  chapters: AsuraChapter[];
}

export default function AsuraReaderPage() {
  const { slug, chapterId } = useParams<{ slug: string; chapterId: string }>();

  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [seriesData, setSeriesData] = useState<AsuraSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUI, setShowUI] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { toast } = useToast();

  const safeSlug = slug ? decodeURIComponent(slug) : "";
  const safeChapterId = chapterId ? decodeURIComponent(chapterId) : "";

  useEffect(() => {
    if (!safeSlug || !safeChapterId) return;
    setLoading(true);
    setLoadedImages(new Set());
    fetch(`${BASE}/api/asurascans/chapters/${encodeURIComponent(safeSlug)}/${encodeURIComponent(safeChapterId)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: ChapterData) => setChapterData(d))
      .catch(() => toast({ description: "Failed to load chapter pages", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [safeSlug, safeChapterId]);

  useEffect(() => {
    if (!safeSlug) return;
    fetch(`${BASE}/api/asurascans/series/${encodeURIComponent(safeSlug)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(d => setSeriesData(d))
      .catch(() => {});
  }, [safeSlug]);

  useEffect(() => {
    const handleClick = () => {
      setShowUI(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowUI(false), 3500);
    };
    window.addEventListener("click", handleClick);
    hideTimer.current = setTimeout(() => setShowUI(false), 3500);
    return () => { window.removeEventListener("click", handleClick); clearTimeout(hideTimer.current); };
  }, []);

  function markLoaded(i: number) {
    setLoadedImages((prev) => new Set([...prev, i]));
  }

  const barCls = `transition-all duration-300 ${showUI ? "opacity-100" : "opacity-0 pointer-events-none"}`;

  return (
    <div className="bg-[#07070d] min-h-[100dvh] relative">
      <div className={`fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/97 backdrop-blur-md border-b border-white/[0.06] flex items-center h-12 px-3 gap-2 ${barCls}`}>
        <Link
          href={`/asura/series/${encodeURIComponent(safeSlug)}`}
          className="p-1.5 rounded-md hover:bg-white/8 text-white/50 hover:text-white transition-colors shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-xs text-white/80 font-semibold truncate leading-tight">
            {chapterData?.seriesTitle ?? "Loading..."}
          </p>
          <p className="text-[11px] text-primary leading-tight">
            Chapter {chapterData?.currentChapter ?? safeChapterId}
          </p>
        </div>
        <div className="w-8 shrink-0" />
      </div>

      <div className="pt-12 pb-20" onClick={() => { setShowUI((v) => !v); clearTimeout(hideTimer.current); }}>
        {loading ? (
          <div className="flex flex-col items-center gap-0.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="w-full bg-[#111118]" style={{ height: "70vh" }} />
            ))}
          </div>
        ) : !chapterData?.pages?.length ? (
          <div className="text-center py-24 px-4">
            <p className="text-white/40 mb-4">No pages found for this chapter.</p>
            <Link
              href={`/asura/series/${encodeURIComponent(safeSlug)}`}
              className="text-primary text-sm inline-block"
              onClick={(e) => e.stopPropagation()}
            >
              ← Back to series
            </Link>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-0.5">
            {chapterData.pages.map((url, i) => (
              <div key={i} className="w-full relative">
                {!loadedImages.has(i) && (
                  <Skeleton className="w-full bg-[#111118] absolute inset-0" style={{ minHeight: "50vh" }} />
                )}
                <img
                  src={proxyImage(url)}
                  alt={`Page ${i + 1}`}
                  className="w-full h-auto block"
                  loading="lazy"
                  onLoad={() => markLoaded(i)}
                  onError={(e) => { markLoaded(i); (e.target as HTMLImageElement).style.display = "none"; }}
                  data-testid={`img-page-${i + 1}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0F]/97 backdrop-blur-md border-t border-white/[0.06] ${barCls}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-3xl mx-auto flex items-center h-14 px-3 gap-2">
          <div className="flex-1">
            {chapterData?.prevChapterId ? (
              <Link
                href={`/asura/read/${encodeURIComponent(safeSlug)}/${encodeURIComponent(chapterData.prevChapterId)}`}
                className="flex items-center justify-center gap-1 w-full py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-bold hover:bg-primary hover:text-white transition-all"
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/60 text-sm font-medium hover:bg-white/10 transition-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  <List className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate text-sm">Ch. {chapterData?.currentChapter ?? "—"}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56 max-h-64 overflow-y-auto bg-card border-white/10" onClick={(e) => e.stopPropagation()}>
                {seriesData?.chapters?.slice().sort((a, b) => b.number - a.number).map((ch) => (
                  <DropdownMenuItem key={ch.id} asChild>
                    <Link href={`/asura/read/${encodeURIComponent(safeSlug)}/${encodeURIComponent(ch.id)}`} className="w-full cursor-pointer">
                      Chapter {ch.number}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex-1">
            {chapterData?.nextChapterId ? (
              <Link
                href={`/asura/read/${encodeURIComponent(safeSlug)}/${encodeURIComponent(chapterData.nextChapterId)}`}
                className="flex items-center justify-center gap-1 w-full py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
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
