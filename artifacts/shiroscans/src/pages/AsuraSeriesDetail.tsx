import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, Bookmark, BookOpen, ChevronDown, ChevronUp, Calendar, User, Hash, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  useGetMe, getGetMeQueryKey,
  useGetBookmarks, getGetBookmarksQueryKey,
  useAddBookmark, useRemoveBookmark,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyImage(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http")) return url;
  return `${BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
}

interface AsuraChapter {
  id: string;
  slug: string;
  number: number;
  title: string;
  releaseDate: string | null;
}

interface AsuraSeries {
  id: string;
  title: string;
  coverUrl: string;
  description: string;
  author: string;
  artist: string;
  status: string;
  genres: string[];
  altTitles: string[];
  totalChapters: number;
  chapters: AsuraChapter[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch { return ""; }
}

export default function AsuraSeriesDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const [series, setSeries] = useState<AsuraSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [chapterSearch, setChapterSearch] = useState("");
  const [sortNewest, setSortNewest] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const safeSlug = slug ? decodeURIComponent(slug) : "";

  useEffect(() => {
    if (!safeSlug) return;
    setLoading(true);
    fetch(`${BASE}/api/asurascans/series/${encodeURIComponent(safeSlug)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: AsuraSeries) => setSeries(d))
      .catch(() => toast({ description: "Failed to load series", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [safeSlug]);

  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const { data: bookmarks } = useGetBookmarks({ query: { enabled: !!user, queryKey: getGetBookmarksQueryKey() } });
  const isBookmarked = bookmarks?.some((b) => b.provider === "asurascans" && b.seriesId === safeSlug);

  const addBookmark = useAddBookmark({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBookmarksQueryKey() }); toast({ description: "Bookmarked!" }); } } });
  const removeBookmark = useRemoveBookmark({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBookmarksQueryKey() }); toast({ description: "Removed" }); } } });

  function toggleBookmark() {
    if (!user) { toast({ description: "Login to bookmark", variant: "destructive" }); return; }
    if (!series) return;
    if (isBookmarked) {
      removeBookmark.mutate({ provider: "asurascans", seriesId: safeSlug });
    } else {
      addBookmark.mutate({ data: { provider: "asurascans", seriesId: safeSlug, title: series.title, coverImage: series.coverUrl, type: "Manhwa", status: series.status } });
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-32 bg-[#1a1a2e]" />
        <Skeleton className="h-72 w-full rounded-xl bg-[#1a1a2e]" />
        <Skeleton className="h-6 w-2/3 bg-[#1a1a2e]" />
        <Skeleton className="h-20 w-full bg-[#1a1a2e]" />
      </div>
    );
  }

  if (!series) {
    return (
      <div className="text-center py-20 text-white/40">
        <p>Series not found.</p>
        <Button variant="ghost" onClick={() => navigate("/manhwa")} className="mt-4">Back to Manhwa</Button>
      </div>
    );
  }

  const statusColor =
    series.status === "Ongoing" ? "bg-violet-500/20 text-violet-300 border-violet-500/30" :
    series.status === "Completed" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
    "bg-orange-500/20 text-orange-300 border-orange-500/30";

  const sortedChapters = [...series.chapters].sort((a, b) => sortNewest ? b.number - a.number : a.number - b.number);
  const filteredChapters = chapterSearch
    ? sortedChapters.filter((c) =>
        String(c.number).includes(chapterSearch) ||
        c.title.toLowerCase().includes(chapterSearch.toLowerCase())
      )
    : sortedChapters;
  const visibleChapters = showAllChapters ? filteredChapters : filteredChapters.slice(0, 30);

  const sortedAsc = [...series.chapters].sort((a, b) => a.number - b.number);
  const firstChapter = sortedAsc[0];
  const latestChapter = sortedAsc[sortedAsc.length - 1];

  return (
    <div className="bg-[#07070d] min-h-screen">
      <div className="px-4 pt-4 pb-2">
        <button onClick={() => navigate("/manhwa")} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Manhwa
        </button>
      </div>

      <div className="px-4 pb-6">
        <div className="flex gap-4">
          <div className="w-28 shrink-0 rounded-xl overflow-hidden shadow-2xl" style={{ aspectRatio: "2/3" }}>
            {series.coverUrl ? (
              <img src={proxyImage(series.coverUrl)} alt={series.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#1a1a2e] flex items-center justify-center">
                <Zap className="w-8 h-8 text-primary/30" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-white leading-tight mb-1">{series.title}</h1>
            {series.author && (
              <p className="text-xs text-white/40 flex items-center gap-1 mb-1"><User className="w-3 h-3" />{series.author}</p>
            )}
            {series.altTitles.length > 0 && (
              <p className="text-xs text-white/25 truncate mb-2">{series.altTitles[0]}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${statusColor}`}>{series.status}</span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] text-white/40 border border-white/[0.08]">
                <Hash className="w-3 h-3 inline mr-0.5" />{series.totalChapters} Chs
              </span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={toggleBookmark} className={`h-8 flex-1 text-xs font-bold gap-1.5 ${isBookmarked ? "bg-violet-600 hover:bg-violet-700" : "bg-primary hover:bg-primary/90"}`}>
                <Bookmark className="w-3.5 h-3.5" />
                {isBookmarked ? "Bookmarked" : "Bookmark"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {firstChapter && (
            <Link href={`/asura/read/${encodeURIComponent(safeSlug)}/${encodeURIComponent(firstChapter.id)}`} className="flex-1">
              <Button className="w-full h-10 text-sm font-bold bg-primary hover:bg-primary/90 gap-2">
                <BookOpen className="w-4 h-4" /> First Chapter
              </Button>
            </Link>
          )}
          {latestChapter && latestChapter.id !== firstChapter?.id && (
            <Link href={`/asura/read/${encodeURIComponent(safeSlug)}/${encodeURIComponent(latestChapter.id)}`} className="flex-1">
              <Button variant="outline" className="w-full h-10 text-sm font-bold border-white/10 text-white/70 bg-transparent gap-2">
                <BookOpen className="w-4 h-4" /> Latest
              </Button>
            </Link>
          )}
        </div>

        {series.genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {series.genres.map((g) => (
              <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-white/[0.05] text-white/50 border border-white/[0.07]">{g}</span>
            ))}
          </div>
        )}

        {series.description && (
          <div className="mt-4">
            <p className={`text-sm text-white/60 leading-relaxed ${descExpanded ? "" : "line-clamp-4"}`}>
              {series.description}
            </p>
            {series.description.length > 200 && (
              <button onClick={() => setDescExpanded(!descExpanded)} className="mt-1.5 text-xs text-primary flex items-center gap-1 font-semibold">
                {descExpanded ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />Show more</>}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="px-4 border-t border-white/[0.06] pt-5 pb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-extrabold text-white">{series.totalChapters} Chapters</h2>
          <div className="flex gap-1.5">
            <button onClick={() => setSortNewest(true)} className={`text-xs px-2.5 py-1 rounded border transition-all ${sortNewest ? "bg-primary border-primary text-white" : "border-white/10 text-white/40 bg-transparent"}`}>Newest</button>
            <button onClick={() => setSortNewest(false)} className={`text-xs px-2.5 py-1 rounded border transition-all ${!sortNewest ? "bg-primary border-primary text-white" : "border-white/10 text-white/40 bg-transparent"}`}>Oldest</button>
          </div>
        </div>

        <div className="relative mb-3">
          <input
            type="text"
            value={chapterSearch}
            onChange={(e) => setChapterSearch(e.target.value)}
            placeholder="Search chapters..."
            className="w-full bg-[#1a1a2e] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/40"
          />
        </div>

        <div className="space-y-px">
          {visibleChapters.map((ch) => (
            <Link
              key={ch.id}
              href={`/asura/read/${encodeURIComponent(safeSlug)}/${encodeURIComponent(ch.id)}`}
              className="group flex items-center justify-between py-3 px-3 -mx-1 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white/80 group-hover:text-primary transition-colors">Chapter {ch.number}</p>
                {ch.title && <p className="text-xs text-white/35 truncate">{ch.title}</p>}
              </div>
              {ch.releaseDate && (
                <span className="text-xs text-white/30 shrink-0 ml-3 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />{formatDate(ch.releaseDate)}
                </span>
              )}
            </Link>
          ))}
        </div>

        {filteredChapters.length > 30 && (
          <button onClick={() => setShowAllChapters(!showAllChapters)} className="mt-4 w-full py-2.5 text-sm text-white/40 hover:text-white border border-white/[0.06] rounded-lg hover:border-white/20 transition-all">
            {showAllChapters ? "Show less" : `Show all ${filteredChapters.length} chapters`}
          </button>
        )}
      </div>
    </div>
  );
}
