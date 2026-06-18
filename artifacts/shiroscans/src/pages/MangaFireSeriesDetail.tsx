import { useState, useEffect, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, Bookmark, BookOpen, ChevronDown, ChevronUp, Star, Send, Loader2, Trash2, SortAsc, SortDesc, Search, Download } from "lucide-react";
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
const SERIES_CHAPTER = "_series_";

function proxyImg(url: string): string {
  if (!url) return "";
  if (!url.startsWith("http")) return url;
  return `${BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return "today";
    if (days === 1) return "1 day ago";
    if (days < 7) return `${days} days ago`;
    if (days < 14) return "last week";
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 60) return "last month";
    return `${Math.floor(days / 30)} months ago`;
  } catch { return dateStr; }
}

function commentTimeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

interface Chapter {
  id: string;
  number: number;
  title: string;
  releaseDate: string | null;
}

interface SeriesData {
  slug: string;
  mangaId: string;
  title: string;
  coverUrl: string;
  description: string;
  type: string;
  status: string;
  rating: number | null;
  genres: string[];
  altTitles: string[];
  author: string;
  artist: string;
  totalChapters: number;
}

interface ReactionData {
  love: number; fire: number; wow: number; sad: number; angry: number;
  upvote?: number; funny?: number; surprised?: number;
  userReaction: string | null;
}

interface RatingData {
  average: number | null; total: number; userRating: number | null;
}

interface Comment {
  id: number; content: string; createdAt: string;
  userId: number; username: string; avatarUrl: string | null;
}

const REACTIONS: { key: string; emoji: string; label: string }[] = [
  { key: "upvote", emoji: "👍", label: "Upvote" },
  { key: "funny", emoji: "😂", label: "Funny" },
  { key: "love", emoji: "❤️", label: "Love" },
  { key: "surprised", emoji: "😯", label: "Surprised" },
  { key: "angry", emoji: "😠", label: "Angry" },
  { key: "sad", emoji: "😢", label: "Sad" },
];

function StarRatingWidget({ value, total, userRating, onRate }: {
  value: number | null; total: number; userRating: number | null; onRate: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const stars = [2, 4, 6, 8, 10];
  const display = hover || userRating || value || 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {stars.map((v) => (
          <button key={v} onMouseEnter={() => setHover(v)} onMouseLeave={() => setHover(0)} onClick={() => onRate(v)} className="p-0.5 transition-transform hover:scale-110" aria-label={`Rate ${v / 2}`}>
            <Star className={`w-5 h-5 transition-colors ${display >= v ? "fill-yellow-400 text-yellow-400" : "fill-transparent text-white/20"}`} />
          </button>
        ))}
      </div>
      {value !== null && (
        <span className="text-xs text-white/40">{value.toFixed(1)} <span className="text-white/20">({total})</span></span>
      )}
    </div>
  );
}

export default function MangaFireSeriesDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [series, setSeries] = useState<SeriesData | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(true);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [chaptersLoaded, setChaptersLoaded] = useState(false);

  const [descExpanded, setDescExpanded] = useState(false);
  const [altExpanded, setAltExpanded] = useState(false);
  const [sortNewest, setSortNewest] = useState(true);
  const [chapterSearch, setChapterSearch] = useState("");

  const [reactions, setReactions] = useState<ReactionData | null>(null);
  const [reacting, setReacting] = useState(false);
  const [rating, setRating] = useState<RatingData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const safeSlug = slug ? decodeURIComponent(slug) : "";

  useEffect(() => {
    if (!safeSlug) return;
    setSeriesLoading(true);
    fetch(`${BASE}/api/mangafire/series/${encodeURIComponent(safeSlug)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: SeriesData) => setSeries(d))
      .catch(() => toast({ description: "Failed to load series", variant: "destructive" }))
      .finally(() => setSeriesLoading(false));
  }, [safeSlug]);

  useEffect(() => {
    if (!safeSlug) return;
    fetch(`${BASE}/api/reactions/mangafire/${encodeURIComponent(safeSlug)}/${SERIES_CHAPTER}`)
      .then((r) => r.ok ? r.json() : null).then((d) => d && setReactions(d)).catch(() => {});
    fetch(`${BASE}/api/ratings/mangafire/${encodeURIComponent(safeSlug)}`)
      .then((r) => r.ok ? r.json() : null).then((d) => d && setRating(d)).catch(() => {});
    setLoadingComments(true);
    fetch(`${BASE}/api/comments/mangafire/${encodeURIComponent(safeSlug)}/${SERIES_CHAPTER}?limit=10&sortBy=newest`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setComments(d.comments ?? []); setCommentTotal(d.total ?? 0); } })
      .catch(() => {}).finally(() => setLoadingComments(false));
  }, [safeSlug]);

  function loadChapters() {
    if (chaptersLoaded || chaptersLoading) return;
    setChaptersLoading(true);
    fetch(`${BASE}/api/mangafire/chapters-by-slug/${encodeURIComponent(safeSlug)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: { chapters: Chapter[] }) => {
        setChapters(d.chapters ?? []);
        setChaptersLoaded(true);
      })
      .catch(() => toast({ description: "Failed to load chapters", variant: "destructive" }))
      .finally(() => setChaptersLoading(false));
  }

  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const { data: bookmarks } = useGetBookmarks({ query: { enabled: !!user, queryKey: getGetBookmarksQueryKey() } });
  const isBookmarked = bookmarks?.some((b) => b.provider === "mangafire" && b.seriesId === safeSlug);

  const addBookmark = useAddBookmark({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBookmarksQueryKey() }); toast({ description: "Bookmarked!" }); } } });
  const removeBookmark = useRemoveBookmark({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBookmarksQueryKey() }); toast({ description: "Removed" }); } } });

  function toggleBookmark() {
    if (!user) { toast({ description: "Login to bookmark", variant: "destructive" }); return; }
    if (!series) return;
    if (isBookmarked) {
      removeBookmark.mutate({ provider: "mangafire", seriesId: safeSlug });
    } else {
      addBookmark.mutate({ data: { provider: "mangafire", seriesId: safeSlug, title: series.title, coverImage: series.coverUrl, type: series.type, status: series.status } });
    }
  }

  async function handleReact(reaction: string) {
    if (!user) { toast({ description: "Login to react", variant: "destructive" }); return; }
    if (reacting) return;
    setReacting(true);
    try {
      const r = await fetch(`${BASE}/api/reactions/mangafire/${encodeURIComponent(safeSlug)}/${SERIES_CHAPTER}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reaction }),
      });
      if (r.ok) setReactions(await r.json());
    } catch { } finally { setReacting(false); }
  }

  async function handleRate(value: number) {
    if (!user) { toast({ description: "Login to rate", variant: "destructive" }); return; }
    try {
      const r = await fetch(`${BASE}/api/ratings`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "mangafire", seriesId: safeSlug, ratingValue: value }),
      });
      if (r.ok) { setRating(await r.json()); toast({ description: "Rating saved!" }); }
    } catch { }
  }

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || !user) { if (!user) toast({ description: "Login to comment", variant: "destructive" }); return; }
    setPostingComment(true);
    try {
      const r = await fetch(`${BASE}/api/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "mangafire", seriesId: safeSlug, chapterId: SERIES_CHAPTER, content: text }),
      });
      if (r.ok) { const nc = await r.json(); setComments((prev) => [nc, ...prev]); setCommentTotal((t) => t + 1); setCommentText(""); }
      else toast({ description: "Failed to post", variant: "destructive" });
    } catch { toast({ description: "Failed to post", variant: "destructive" }); }
    finally { setPostingComment(false); }
  }

  async function handleDeleteComment(id: number) {
    try {
      const r = await fetch(`${BASE}/api/comments/${id}`, { method: "DELETE" });
      if (r.ok) { setComments((prev) => prev.filter((c) => c.id !== id)); setCommentTotal((t) => Math.max(0, t - 1)); }
    } catch { }
  }

  if (seriesLoading) {
    return (
      <div className="bg-[#07070d] min-h-screen">
        <Skeleton className="h-48 w-full bg-[#13131f]" />
        <div className="max-w-2xl mx-auto px-4 -mt-20 space-y-4">
          <div className="flex justify-center">
            <Skeleton className="w-28 rounded-xl bg-[#1a1a2e]" style={{ aspectRatio: "2/3" }} />
          </div>
          <Skeleton className="h-6 w-2/3 mx-auto bg-[#1a1a2e] rounded" />
          <Skeleton className="h-12 w-full bg-[#1a1a2e] rounded-xl" />
          <Skeleton className="h-10 w-full bg-[#1a1a2e] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="text-center py-20 text-white/40">
        <p>Series not found.</p>
        <Button variant="ghost" onClick={() => navigate("/")} className="mt-4">Back to Home</Button>
      </div>
    );
  }

  const statusColor =
    series.status === "Ongoing" ? "bg-violet-500/20 text-violet-300 border-violet-500/30" :
    series.status === "Completed" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
    "bg-orange-500/20 text-orange-300 border-orange-500/30";

  const sortedChapters = [...chapters].sort((a, b) => sortNewest ? b.number - a.number : a.number - b.number);
  const filteredChapters = chapterSearch
    ? sortedChapters.filter((c) => String(c.number).includes(chapterSearch) || c.title.toLowerCase().includes(chapterSearch.toLowerCase()))
    : sortedChapters;

  const firstCh = [...chapters].sort((a, b) => a.number - b.number)[0];
  const latestCh = [...chapters].sort((a, b) => b.number - a.number)[0];

  const totalChs = chapters.length || series.totalChapters;

  const allAltTitles = series.altTitles.join(", ");

  return (
    <div className="bg-[#07070d] min-h-screen">
      {/* Blurred Background */}
      <div className="relative h-52 overflow-hidden">
        {series.coverUrl && (
          <img
            src={proxyImg(series.coverUrl)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-110"
            style={{ filter: "blur(18px) brightness(0.35)" }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#07070d]/30 to-[#07070d]" />
        <button
          onClick={() => navigate("/")}
          className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/40 backdrop-blur-sm text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Center Poster */}
      <div className="flex justify-center -mt-24 relative z-10 px-4">
        <div className="w-32 rounded-2xl overflow-hidden shadow-2xl border border-white/10" style={{ aspectRatio: "2/3" }}>
          {series.coverUrl ? (
            <img src={proxyImg(series.coverUrl)} alt={series.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#1a1a2e]" />
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* Title & Alt Titles */}
        <div className="mt-3 text-center">
          <h1 className="text-lg font-black text-white leading-tight">{series.title}</h1>
          {series.altTitles.length > 0 && (
            <div className="mt-1">
              <p className={`text-[11px] text-white/35 leading-relaxed ${altExpanded ? "" : "line-clamp-2"}`}>
                {allAltTitles}
              </p>
              {allAltTitles.length > 60 && (
                <button onClick={() => setAltExpanded(!altExpanded)} className="text-[10px] text-primary font-semibold mt-0.5">
                  {altExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Stats Row: Rating + Chapters */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="text-center">
            <p className="text-xl font-black text-yellow-400">
              {series.rating !== null ? `⭐ ${series.rating.toFixed(1)}` : "—"}
            </p>
            <p className="text-[10px] text-white/35 mt-0.5 font-semibold">Rating</p>
          </div>
          <div className="w-px h-8 bg-white/[0.08]" />
          <div className="text-center">
            <p className="text-xl font-black text-white">{totalChs || "—"}</p>
            <p className="text-[10px] text-white/35 mt-0.5 font-semibold">Chapters</p>
          </div>
          <div className="w-px h-8 bg-white/[0.08]" />
          <div className="text-center">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>{series.status}</span>
          </div>
        </div>

        {/* Genres */}
        {series.genres.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center mt-4">
            {series.genres.slice(0, 6).map((g) => (
              <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/45 border border-white/[0.07]">{g}</span>
            ))}
          </div>
        )}

        {/* Bookmark (full width) */}
        <div className="mt-4">
          <Button
            onClick={toggleBookmark}
            className={`w-full h-11 font-bold text-sm gap-2 ${isBookmarked ? "bg-violet-600 hover:bg-violet-700" : "bg-primary hover:bg-primary/90"}`}
          >
            <Bookmark className="w-4 h-4" />
            {isBookmarked ? "Bookmarked" : "Add to Bookmarks"}
          </Button>
        </div>

        {/* First Chapter | Download */}
        <div className="flex gap-2 mt-2" onClick={loadChapters}>
          <Button
            variant="outline"
            className="flex-1 h-10 text-sm font-bold border-white/10 text-white/70 bg-transparent gap-2"
            onClick={() => {
              loadChapters();
              if (firstCh) navigate(`/read/${encodeURIComponent(firstCh.id)}?slug=${encodeURIComponent(safeSlug)}`);
            }}
          >
            <BookOpen className="w-4 h-4" /> First Chapter
          </Button>
          <Button variant="outline" className="flex-1 h-10 text-sm font-bold border-white/10 text-white/70 bg-transparent gap-2">
            <Download className="w-4 h-4" /> Download
          </Button>
        </div>

        {/* Description */}
        {series.description && (
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <p className={`text-sm text-white/55 leading-relaxed ${descExpanded ? "" : "line-clamp-4"}`}>
              {series.description}
            </p>
            {series.description.length > 200 && (
              <button onClick={() => setDescExpanded(!descExpanded)} className="mt-1.5 text-xs text-primary flex items-center gap-1 font-semibold">
                {descExpanded ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />Show more</>}
              </button>
            )}
          </div>
        )}

        {/* Chapters Section */}
        <div className="mt-6 border-t border-white/[0.06] pt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold text-white">
              {totalChs > 0 ? `${totalChs} Chapters` : "Chapters"}
            </h2>
            <button
              onClick={() => setSortNewest(!sortNewest)}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white px-2.5 py-1 rounded-lg border border-white/[0.08] hover:border-white/20 transition-all"
            >
              {sortNewest ? <SortDesc className="w-3 h-3" /> : <SortAsc className="w-3 h-3" />}
              {sortNewest ? "Newest" : "Oldest"}
            </button>
          </div>

          {/* Search chapters */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="text"
              value={chapterSearch}
              onChange={(e) => setChapterSearch(e.target.value)}
              placeholder="Search chapters..."
              className="w-full bg-[#13131f] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/40"
            />
          </div>

          {/* Load chapters trigger */}
          {!chaptersLoaded && !chaptersLoading && (
            <button
              onClick={loadChapters}
              className="w-full py-3 text-sm text-primary font-semibold border border-primary/30 rounded-lg hover:bg-primary/10 transition-all"
            >
              Load Chapters
            </button>
          )}

          {chaptersLoading && (
            <div className="space-y-px">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 px-3">
                  <Skeleton className="h-4 w-28 bg-[#13131f] rounded" />
                  <Skeleton className="h-3 w-20 bg-[#13131f] rounded" />
                </div>
              ))}
            </div>
          )}

          {chaptersLoaded && (
            <div className="overflow-y-auto rounded-xl border border-white/[0.06]" style={{ maxHeight: "400px" }}>
              {filteredChapters.length === 0 ? (
                <p className="text-center py-8 text-sm text-white/30">No chapters found</p>
              ) : (
                <div className="space-y-px">
                  {filteredChapters.map((ch) => (
                    <Link
                      key={ch.id}
                      href={`/read/${encodeURIComponent(ch.id)}?slug=${encodeURIComponent(safeSlug)}`}
                      className="group flex items-center justify-between py-3 px-4 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0"
                    >
                      <p className="text-sm font-bold text-white/80 group-hover:text-primary transition-colors">
                        Chapter {ch.number}
                      </p>
                      {ch.releaseDate && (
                        <span className="text-xs text-white/30 shrink-0 ml-3">{timeAgo(ch.releaseDate)}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reactions */}
        <div className="mt-6 border-t border-white/[0.06] pt-5 pb-4">
          <p className="text-sm font-extrabold text-white mb-1">What did you think of this series?</p>
          {reactions && (
            <p className="text-xs text-white/30 mb-4">
              {Object.values({ ...reactions, userReaction: undefined }).reduce((a, b) => typeof b === "number" ? (a as number) + b : (a as number), 0)} reactions
            </p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {REACTIONS.map(({ key, emoji, label }) => {
              const count = (reactions as Record<string, unknown>)?.[key] as number ?? 0;
              const isActive = reactions?.userReaction === key;
              return (
                <button
                  key={key}
                  onClick={() => handleReact(key)}
                  disabled={reacting}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs transition-all select-none ${
                    isActive
                      ? "bg-primary/20 border-primary/50 text-white scale-105"
                      : "bg-white/[0.03] border-white/[0.08] text-white/50 hover:bg-white/[0.07]"
                  }`}
                >
                  <span className="text-xl leading-none">{emoji}</span>
                  {count > 0 && <span className="text-xs font-bold text-white/70">{count}</span>}
                  <span className="text-[10px] text-white/35">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rating */}
        <div className="border-t border-white/[0.06] pt-5 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white/70">Rate</span>
            <StarRatingWidget
              value={rating?.average ?? null}
              total={rating?.total ?? 0}
              userRating={rating?.userRating ?? null}
              onRate={handleRate}
            />
          </div>
        </div>

        {/* Comments */}
        <div className="border-t border-white/[0.06] pt-5 pb-20">
          <h2 className="text-base font-extrabold text-white mb-4">
            Comments {commentTotal > 0 && <span className="text-white/30 font-normal text-sm ml-1">({commentTotal})</span>}
          </h2>

          {user ? (
            <form onSubmit={handlePostComment} className="mb-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{(user as Record<string, unknown>)?.["username"]?.toString()?.[0]?.toUpperCase() ?? "U"}</span>
                </div>
                <div className="flex-1 relative">
                  <textarea
                    ref={commentInputRef}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Share your thoughts..."
                    maxLength={2000}
                    rows={2}
                    className="w-full bg-[#13131f] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/40 resize-none pr-12"
                  />
                  <button
                    type="submit"
                    disabled={postingComment || !commentText.trim()}
                    className="absolute right-2.5 bottom-2.5 p-1.5 rounded-lg bg-primary disabled:bg-white/10 disabled:text-white/20 text-white transition-all"
                  >
                    {postingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="mb-5 py-3 px-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/40 text-center">
              <Link href="/login" className="text-primary hover:underline">Log in</Link> to join the discussion
            </div>
          )}

          {loadingComments ? (
            <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="flex gap-3"><Skeleton className="w-8 h-8 rounded-full bg-[#13131f]" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-24 bg-[#13131f]" /><Skeleton className="h-4 bg-[#13131f]" /></div></div>)}</div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-white/25 text-center py-8">No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-4">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3 group">
                  <div className="w-8 h-8 rounded-full bg-[#13131f] border border-white/[0.06] flex items-center justify-center shrink-0">
                    {c.avatarUrl ? <img src={c.avatarUrl} alt={c.username} className="w-full h-full rounded-full object-cover" /> : <span className="text-xs font-bold text-white/50">{c.username?.[0]?.toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-bold text-white/80">{c.username}</span>
                      <span className="text-[10px] text-white/25">{commentTimeAgo(c.createdAt)}</span>
                      {user && (user as Record<string, unknown>)?.["id"] === c.userId && (
                        <button onClick={() => handleDeleteComment(c.id)} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-destructive/60 hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-white/65 leading-relaxed">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
