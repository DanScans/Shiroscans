import { useState, useEffect, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, Bookmark, BookOpen, ChevronDown, ChevronUp, Calendar, User, Hash, Zap, Star, Send, Loader2, Trash2 } from "lucide-react";
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

interface ReactionData {
  love: number;
  fire: number;
  wow: number;
  sad: number;
  angry: number;
  userReaction: string | null;
}

interface RatingData {
  average: number | null;
  total: number;
  userRating: number | null;
}

interface Comment {
  id: number;
  content: string;
  createdAt: string;
  userId: number;
  username: string;
  avatarUrl: string | null;
}

const REACTION_EMOJIS: { key: keyof Omit<ReactionData, "userReaction">; emoji: string; label: string }[] = [
  { key: "love", emoji: "❤️", label: "Love" },
  { key: "fire", emoji: "🔥", label: "Fire" },
  { key: "wow", emoji: "😮", label: "Wow" },
  { key: "sad", emoji: "😢", label: "Sad" },
  { key: "angry", emoji: "😠", label: "Angry" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch { return ""; }
}

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return formatDate(iso);
  } catch { return ""; }
}

function StarRating({ value, total, userRating, onRate }: {
  value: number | null;
  total: number;
  userRating: number | null;
  onRate: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const stars = [2, 4, 6, 8, 10];
  const displayVal = hover || userRating || value || 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {stars.map((v) => (
          <button
            key={v}
            onMouseEnter={() => setHover(v)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onRate(v)}
            className="p-0.5 transition-transform hover:scale-110"
            aria-label={`Rate ${v / 2} stars`}
          >
            <Star
              className={`w-5 h-5 transition-colors ${
                displayVal >= v
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-transparent text-white/20"
              }`}
            />
          </button>
        ))}
      </div>
      {value !== null && (
        <span className="text-xs text-white/40">
          {value.toFixed(1)} <span className="text-white/20">({total})</span>
        </span>
      )}
      {userRating && (
        <span className="text-[10px] text-primary/70 font-semibold">Your rating: {userRating / 2}★</span>
      )}
    </div>
  );
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
    setLoading(true);
    fetch(`${BASE}/api/asurascans/series/${encodeURIComponent(safeSlug)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: AsuraSeries) => setSeries(d))
      .catch(() => toast({ description: "Failed to load series", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [safeSlug]);

  useEffect(() => {
    if (!safeSlug) return;
    fetch(`${BASE}/api/reactions/asurascans/${encodeURIComponent(safeSlug)}/${SERIES_CHAPTER}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setReactions(d))
      .catch(() => {});
    fetch(`${BASE}/api/ratings/asurascans/${encodeURIComponent(safeSlug)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setRating(d))
      .catch(() => {});
    setLoadingComments(true);
    fetch(`${BASE}/api/comments/asurascans/${encodeURIComponent(safeSlug)}/${SERIES_CHAPTER}?limit=10&sortBy=newest`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setComments(d.comments ?? []); setCommentTotal(d.total ?? 0); } })
      .catch(() => {})
      .finally(() => setLoadingComments(false));
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

  async function handleReact(reaction: string) {
    if (!user) { toast({ description: "Login to react", variant: "destructive" }); return; }
    if (reacting) return;
    setReacting(true);
    try {
      const r = await fetch(`${BASE}/api/reactions/asurascans/${encodeURIComponent(safeSlug)}/${SERIES_CHAPTER}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
      });
      if (r.ok) {
        const d = await r.json();
        setReactions(d);
      }
    } catch { } finally { setReacting(false); }
  }

  async function handleRate(value: number) {
    if (!user) { toast({ description: "Login to rate", variant: "destructive" }); return; }
    try {
      const r = await fetch(`${BASE}/api/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "asurascans", seriesId: safeSlug, ratingValue: value }),
      });
      if (r.ok) {
        const d = await r.json();
        setRating(d);
        toast({ description: "Rating saved!" });
      }
    } catch { }
  }

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    if (!user) { toast({ description: "Login to comment", variant: "destructive" }); return; }
    setPostingComment(true);
    try {
      const r = await fetch(`${BASE}/api/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "asurascans", seriesId: safeSlug, chapterId: SERIES_CHAPTER, content: text }),
      });
      if (r.ok) {
        const newComment = await r.json();
        setComments((prev) => [newComment, ...prev]);
        setCommentTotal((t) => t + 1);
        setCommentText("");
      } else {
        toast({ description: "Failed to post comment", variant: "destructive" });
      }
    } catch { toast({ description: "Failed to post comment", variant: "destructive" }); }
    finally { setPostingComment(false); }
  }

  async function handleDeleteComment(id: number) {
    try {
      const r = await fetch(`${BASE}/api/comments/${id}`, { method: "DELETE" });
      if (r.ok) {
        setComments((prev) => prev.filter((c) => c.id !== id));
        setCommentTotal((t) => Math.max(0, t - 1));
      }
    } catch { }
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

      <div className="px-4 border-t border-white/[0.06] pt-5 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-bold text-white/70">Rate</span>
          <StarRating
            value={rating?.average ?? null}
            total={rating?.total ?? 0}
            userRating={rating?.userRating ?? null}
            onRate={handleRate}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {REACTION_EMOJIS.map(({ key, emoji, label }) => {
            const count = reactions?.[key] ?? 0;
            const isActive = reactions?.userReaction === key;
            return (
              <button
                key={key}
                onClick={() => handleReact(key)}
                disabled={reacting}
                aria-label={label}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all select-none ${
                  isActive
                    ? "bg-primary/20 border-primary/50 text-white scale-105 shadow-sm shadow-primary/20"
                    : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:border-white/20"
                }`}
              >
                <span className="text-base leading-none">{emoji}</span>
                {count > 0 && <span className="text-xs font-bold">{count}</span>}
              </button>
            );
          })}
        </div>
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

      <div className="px-4 border-t border-white/[0.06] pt-5 pb-12">
        <h2 className="text-base font-extrabold text-white mb-4">
          Comments {commentTotal > 0 && <span className="text-white/30 font-normal text-sm ml-1">({commentTotal})</span>}
        </h2>

        {user ? (
          <form onSubmit={handlePostComment} className="mb-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">{(user as any).username?.[0]?.toUpperCase() ?? "U"}</span>
              </div>
              <div className="flex-1 relative">
                <textarea
                  ref={commentInputRef}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share your thoughts..."
                  maxLength={2000}
                  rows={2}
                  className="w-full bg-[#1a1a2e] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-primary/40 resize-none pr-12"
                />
                <button
                  type="submit"
                  disabled={postingComment || !commentText.trim()}
                  className="absolute right-2.5 bottom-2.5 p-1.5 rounded-lg bg-primary disabled:bg-white/10 disabled:text-white/20 text-white transition-all hover:bg-primary/90"
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
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full bg-[#1a1a2e] shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24 bg-[#1a1a2e]" />
                  <Skeleton className="h-4 w-full bg-[#1a1a2e]" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-white/25 text-center py-8">No comments yet. Be the first!</p>
        ) : (
          <div className="space-y-4">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3 group">
                <div className="w-8 h-8 rounded-full bg-[#1a1a2e] border border-white/[0.06] flex items-center justify-center shrink-0">
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt={c.username} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-white/50">{c.username?.[0]?.toUpperCase() ?? "?"}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-bold text-white/80">{c.username}</span>
                    <span className="text-[10px] text-white/25">{timeAgo(c.createdAt)}</span>
                    {user && (user as any).id === c.userId && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="ml-auto opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all p-0.5"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-white/65 leading-relaxed break-words">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
