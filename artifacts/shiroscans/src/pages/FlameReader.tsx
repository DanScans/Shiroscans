import { useState, useEffect, useRef } from "react";
import { Link, useParams, useSearch, useLocation } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyImage(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http")) return url;
  return `${BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
}

interface ChapterData {
  id: string;
  seriesId: string;
  pages: string[];
}

export default function FlameReaderPage() {
  const { seriesId, chapterId } = useParams<{ seriesId: string; chapterId: string }>();
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const token = params.get("token") ?? "";

  const [chapterData, setChapterData] = useState<ChapterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUI, setShowUI] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const { toast } = useToast();

  const safeSeriesId = seriesId ? decodeURIComponent(seriesId) : "";
  const safeChapterId = chapterId ?? "";

  useEffect(() => {
    if (!safeSeriesId || !safeChapterId) return;
    setLoading(true);
    setLoadedImages(new Set());
    const t = token ? `?token=${encodeURIComponent(token)}` : "";
    fetch(`${BASE}/api/flamecomics/chapters/${encodeURIComponent(safeSeriesId)}/${safeChapterId}${t}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: ChapterData) => setChapterData(d))
      .catch(() => toast({ description: "Failed to load chapter pages", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [safeSeriesId, safeChapterId, token]);

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

  return (
    <div className="bg-black min-h-screen relative">
      {/* Top bar */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/[0.06] flex items-center h-12 px-4 gap-3 transition-all duration-300 ${showUI ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"}`}
      >
        <Link
          href={`/flame/series/${encodeURIComponent(safeSeriesId)}`}
          className="text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/40 truncate">FlameComics</p>
          <p className="text-sm font-bold text-white truncate">Chapter {safeChapterId}</p>
        </div>
      </div>

      {/* Pages */}
      <div className="pt-12">
        {loading ? (
          <div className="flex flex-col items-center gap-1 pt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="w-full bg-[#1a1a2e]" style={{ height: "60vh" }} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {(chapterData?.pages ?? []).map((url, i) => (
              <div key={i} className="w-full relative">
                {!loadedImages.has(i) && (
                  <Skeleton className="w-full bg-[#111] absolute inset-0" style={{ minHeight: "50vh" }} />
                )}
                <img
                  src={proxyImage(url)}
                  alt={`Page ${i + 1}`}
                  className="w-full h-auto block"
                  loading="lazy"
                  onLoad={() => markLoaded(i)}
                  onError={(e) => { markLoaded(i); (e.target as HTMLImageElement).src = url; }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-t border-white/[0.06] flex items-center h-14 px-4 gap-3 transition-all duration-300 ${showUI ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full pointer-events-none"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Link
          href={`/flame/series/${encodeURIComponent(safeSeriesId)}`}
          className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold text-white/60 hover:text-white py-2 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" /> Chapters
        </Link>
        <div className="h-6 w-px bg-white/[0.08]" />
        <div className="flex-1 text-center">
          <p className="text-xs text-white/30">Chapter</p>
          <p className="text-sm font-bold text-white">{safeChapterId}</p>
        </div>
        <div className="h-6 w-px bg-white/[0.08]" />
        <Link
          href={`/flame/series/${encodeURIComponent(safeSeriesId)}`}
          className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold text-white/60 hover:text-white py-2 transition-colors"
        >
          More <ChevronRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
