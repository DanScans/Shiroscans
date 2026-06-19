import { useState, useEffect, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight, List } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyImg(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http")) return url;
  return `${BASE}/api/weebcentral/proxy-image?url=${encodeURIComponent(url)}`;
}

interface WCChapter {
  id: string;
  number: number;
  title: string;
  releaseDate: string | null;
}

interface WCSeries {
  id: string;
  title: string;
  chapters: WCChapter[];
}

export default function MangaReaderPage() {
  const { id, chapterId } = useParams<{ id: string; chapterId: string }>();
  const [, navigate] = useLocation();

  const [pages, setPages] = useState<string[]>([]);
  const [embedUrl, setEmbedUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [seriesData, setSeriesData] = useState<WCSeries | null>(null);
  const [showUI, setShowUI] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    if (!chapterId) return;
    setLoading(true);
    setLoadedImages(new Set());
    setEmbedUrl("");
    setPages([]);
    fetch(`${BASE}/api/weebcentral/read/${chapterId}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: { pages: string[]; embedUrl: string }) => {
        setPages(d.pages ?? []);
        setEmbedUrl(d.embedUrl ?? "");
      })
      .catch(() => toast({ description: "Failed to load chapter", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [chapterId]);

  useEffect(() => {
    if (!id) return;
    fetch(`${BASE}/api/weebcentral/series/${id}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: WCSeries) => setSeriesData(d))
      .catch(() => {});
  }, [id]);

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

  const allChapters = seriesData?.chapters ?? [];
  const currentIdx = allChapters.findIndex((c) => c.id === chapterId);
  const prevChapter = currentIdx > 0 ? allChapters[currentIdx - 1] : null;
  const nextChapter = currentIdx >= 0 && currentIdx < allChapters.length - 1 ? allChapters[currentIdx + 1] : null;
  const currentChapter = allChapters[currentIdx];
  const seriesName = seriesData?.title ?? "";

  const chapterLabel = (ch: WCChapter) =>
    ch.number ? `Chapter ${ch.number}${ch.title && ch.title !== `Chapter ${ch.number}` ? ` — ${ch.title}` : ""}` : "Oneshot";

  const barCls = `transition-all duration-200 ${showUI ? "opacity-100" : "opacity-0 pointer-events-none"}`;

  const useEmbed = !loading && pages.length === 0 && embedUrl;

  return (
    <div className="bg-[#07070d] min-h-[100dvh] relative">
      <div className={`fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/97 backdrop-blur-md border-b border-white/[0.06] flex items-center h-12 px-3 gap-2 ${barCls}`}>
        <Link
          href={`/manga/series/${id}`}
          className="p-1.5 rounded-md hover:bg-white/8 text-white/50 hover:text-white transition-colors duration-150 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-xs text-white/80 font-semibold truncate leading-tight">{seriesName}</p>
          <p className="text-[11px] text-primary leading-tight">
            {currentChapter ? chapterLabel(currentChapter) : `Chapter ${chapterId}`}
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
        ) : useEmbed ? (
          <div className="w-full" style={{ height: "calc(100dvh - 8rem)" }} onClick={(e) => e.stopPropagation()}>
            <iframe
              src={embedUrl}
              className="w-full h-full border-0"
              title="Chapter Reader"
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        ) : pages.length === 0 ? (
          <div className="text-center py-24 px-4">
            <p className="text-white/40 mb-4">No pages found for this chapter.</p>
            <Link
              href={`/manga/series/${id}`}
              className="text-primary text-sm inline-block"
              onClick={(e) => e.stopPropagation()}
            >
              ← Back to series
            </Link>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-0.5">
            {pages.map((url, i) => (
              <div key={i} className="w-full relative">
                {!loadedImages.has(i) && (
                  <Skeleton className="w-full bg-[#111118] absolute inset-0" style={{ minHeight: "50vh" }} />
                )}
                <img
                  src={proxyImg(url)}
                  alt={`Page ${i + 1}`}
                  className="w-full h-auto block"
                  loading={i < 3 ? "eager" : "lazy"}
                  decoding="async"
                  onLoad={() => markLoaded(i)}
                  onError={(e) => { markLoaded(i); (e.target as HTMLImageElement).style.display = "none"; }}
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
            {prevChapter ? (
              <Link
                href={`/manga/read/${id}/${prevChapter.id}`}
                className="flex items-center justify-center gap-1 w-full py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-bold hover:bg-primary hover:text-white transition-all duration-150"
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
                  className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/60 text-sm font-medium hover:bg-white/10 transition-all duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <List className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate text-sm">
                    {currentChapter ? `Ch. ${currentChapter.number ?? "?"}` : "Chapter"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-64 max-h-64 overflow-y-auto bg-card border-white/10" onClick={(e) => e.stopPropagation()}>
                {allChapters.map((ch) => (
                  <DropdownMenuItem key={ch.id} asChild>
                    <Link href={`/manga/read/${id}/${ch.id}`} className="w-full cursor-pointer">
                      {chapterLabel(ch)}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex-1">
            {nextChapter ? (
              <Link
                href={`/manga/read/${id}/${nextChapter.id}`}
                className="flex items-center justify-center gap-1 w-full py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all duration-150 shadow-md shadow-primary/20"
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
