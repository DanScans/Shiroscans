import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight, List } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyImg(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http")) return url;
  return `${BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
}

interface ChapterResult {
  pages: string[];
  embedUrl?: string;
  seriesTitle?: string;
  chapterList?: Array<{ id: string; number: number; title: string }>;
  prevChapterId?: string | null;
  nextChapterId?: string | null;
  currentChapter?: string;
}

export default function ManhwaReaderPage() {
  const { slug, chapterNum } = useParams<{ slug: string; chapterNum: string }>();
  const [chapterData, setChapterData] = useState<ChapterResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUI, setShowUI] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { toast } = useToast();

  const safeSlug = slug ? decodeURIComponent(slug) : "";
  const safeChapterNum = chapterNum ?? "1";

  useEffect(() => {
    if (!safeSlug || !safeChapterNum) return;
    setLoading(true);
    setLoadedImages(new Set());
    fetch(`${BASE}/api/asurascans/chapters/${encodeURIComponent(safeSlug)}/${encodeURIComponent(safeChapterNum)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: ChapterResult) => setChapterData(d))
      .catch(() => toast({ description: "Failed to load chapter", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [safeSlug, safeChapterNum]);

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

  function markLoaded(i: number) { setLoadedImages((prev) => new Set([...prev, i])); }

  const barCls = `transition-all duration-300 ${showUI ? "opacity-100" : "opacity-0 pointer-events-none"}`;

  const chapters = chapterData?.chapterList ?? [];
  const sortedChapters = [...chapters].sort((a, b) => b.number - a.number);
  const currentNum = parseFloat(safeChapterNum);
  const prevNum = chapterData?.prevChapterId ?? null;
  const nextNum = chapterData?.nextChapterId ?? null;
  const hasPages = (chapterData?.pages?.length ?? 0) > 0;
  const embedUrl = chapterData?.embedUrl;

  function chapterHref(num: string | number): string {
    return `/manhwa/read/${encodeURIComponent(safeSlug)}/${num}`;
  }

  const seriesTitle = chapterData?.seriesTitle
    ?? safeSlug.replace(/-[0-9a-f]{6,}$/, "").replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="bg-[#07070d] min-h-[100dvh] relative">
      <div className={`fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/97 backdrop-blur-md border-b border-white/[0.06] flex items-center h-12 px-3 gap-2 ${barCls}`}>
        <Link href={`/manhwa/series/${encodeURIComponent(safeSlug)}`}
          className="p-1.5 rounded-md hover:bg-white/8 text-white/50 hover:text-white transition-colors shrink-0"
          onClick={(e) => e.stopPropagation()}>
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-xs text-white/80 font-semibold truncate leading-tight">{seriesTitle}</p>
          <p className="text-[11px] text-primary leading-tight">Chapter {currentNum}</p>
        </div>
      </div>

      <div className="pt-12 pb-20" onClick={() => { setShowUI((v) => !v); clearTimeout(hideTimer.current); }}>
        {loading ? (
          <div className="flex flex-col items-center gap-0.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="w-full bg-[#111118]" style={{ height: "70vh" }} />
            ))}
          </div>
        ) : hasPages ? (
          <div className="max-w-3xl mx-auto space-y-0.5">
            {chapterData!.pages.map((url, i) => (
              <div key={i} className="w-full relative">
                {!loadedImages.has(i) && <Skeleton className="w-full bg-[#111118] absolute inset-0" style={{ minHeight: "50vh" }} />}
                <img src={proxyImg(url)} alt={`Page ${i + 1}`} className="w-full h-auto block" loading="lazy"
                  onLoad={() => markLoaded(i)}
                  onError={(e) => { markLoaded(i); (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            ))}
          </div>
        ) : embedUrl ? (
          <div className="w-full" style={{ height: "calc(100dvh - 112px)" }}
            onClick={(e) => e.stopPropagation()}>
            <iframe
              src={embedUrl}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              title={`Chapter ${currentNum}`}
            />
          </div>
        ) : (
          <div className="text-center py-24 px-4">
            <p className="text-white/40 mb-4">Could not load chapter pages.</p>
            <Link href={`/manhwa/series/${encodeURIComponent(safeSlug)}`} className="text-primary text-sm inline-block" onClick={(e) => e.stopPropagation()}>
              ← Back to series
            </Link>
          </div>
        )}
      </div>

      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0F]/97 backdrop-blur-md border-t border-white/[0.06] ${barCls}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="max-w-3xl mx-auto flex items-center h-14 px-3 gap-2">
          <div className="flex-1">
            {prevNum !== null ? (
              <Link href={chapterHref(prevNum)}
                className="flex items-center justify-center gap-1 w-full py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-bold hover:bg-primary hover:text-white transition-all">
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
                <button className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/60 text-sm font-medium hover:bg-white/10 transition-all" onClick={(e) => e.stopPropagation()}>
                  <List className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate text-sm">Ch. {currentNum}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56 max-h-64 overflow-y-auto bg-card border-white/10" onClick={(e) => e.stopPropagation()}>
                {sortedChapters.map((ch) => (
                  <DropdownMenuItem key={ch.id} asChild>
                    <Link href={chapterHref(ch.number)} className={`w-full cursor-pointer ${ch.number === currentNum ? "text-primary font-bold" : ""}`}>
                      Chapter {ch.number}
                    </Link>
                  </DropdownMenuItem>
                ))}
                {sortedChapters.length === 0 && (
                  <DropdownMenuItem disabled className="text-white/30">No chapter list</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex-1">
            {nextNum !== null ? (
              <Link href={chapterHref(nextNum)}
                className="flex items-center justify-center gap-1 w-full py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20">
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
