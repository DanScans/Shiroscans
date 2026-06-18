import { useState, useEffect, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, User, Zap, Send, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// MangaDex covers load directly from CDN (browser CORS is fine)
function mdxImage(url: string): string {
  return url ?? "";
}

interface MDXChapter {
  id: string;
  chapter: string | null;
  title: string | null;
  volume: string | null;
  publishAt: string;
  pages: number;
}

interface MDXSeries {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  author: string;
  status: string;
  year: number | null;
  genres: string[];
  lastChapter: string | null;
  chapters: MDXChapter[];
}

interface Comment {
  id: number;
  content: string;
  createdAt: string;
  userId: number;
  username: string;
  avatarUrl: string | null;
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
    return `${d}d ago`;
  } catch { return ""; }
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_COLOR: Record<string, string> = {
  ongoing: "text-green-400 bg-green-500/10",
  completed: "text-blue-400 bg-blue-500/10",
  hiatus: "text-orange-400 bg-orange-500/10",
  cancelled: "text-red-400 bg-red-500/10",
};

export default function MangaSeriesDetailPage() {
  const { titleId } = useParams<{ titleId: string }>();
  const [, navigate] = useLocation();
  const [series, setSeries] = useState<MDXSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showAllChapters, setShowAllChapters] = useState(false);
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, throwOnError: false } });

  useEffect(() => {
    if (!titleId) return;
    setLoading(true);
    fetch(`${BASE}/api/mangadex/series/${titleId}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: MDXSeries) => setSeries(d))
      .catch(() => toast({ description: "Failed to load series", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [titleId]);

  useEffect(() => {
    if (!titleId) return;
    setLoadingComments(true);
    fetch(`${BASE}/api/comments/mangadex/${titleId}/_series_?limit=10&sortBy=newest`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setComments(d.comments ?? []); setCommentTotal(d.total ?? 0); } })
      .catch(() => {})
      .finally(() => setLoadingComments(false));
  }, [titleId]);

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || !user) return;
    setPostingComment(true);
    try {
      const r = await fetch(`${BASE}/api/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "mangadex", seriesId: titleId, chapterId: "_series_", content: text }),
      });
      if (r.ok) {
        const nc = await r.json();
        setComments((prev) => [nc, ...prev]);
        setCommentTotal((t) => t + 1);
        setCommentText("");
      }
    } catch { } finally { setPostingComment(false); }
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
        <Button variant="ghost" onClick={() => navigate("/manga")} className="mt-4">Back to Manga</Button>
      </div>
    );
  }

  const displayedChapters = showAllChapters ? series.chapters : series.chapters.slice(0, 20);
  const statusCls = STATUS_COLOR[series.status?.toLowerCase()] ?? "text-gray-400 bg-gray-500/10";
  const firstChapter = series.chapters[series.chapters.length - 1];
  const latestChapter = series.chapters[0];

  return (
    <div className="bg-[#07070d] min-h-screen">
      <div className="px-4 pt-4 pb-2">
        <button onClick={() => navigate("/manga")} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Manga
        </button>
      </div>

      <div className="px-4 pb-6 relative">
        <div className="flex gap-4">
          <div className="w-28 shrink-0 rounded-xl overflow-hidden shadow-2xl ring-2 ring-white/[0.06]" style={{ aspectRatio: "2/3" }}>
            {series.coverUrl ? (
              <img src={mdxImage(series.coverUrl)} alt={series.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#1a1a2e] flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-primary/30" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-lg font-black text-white leading-tight mb-1">{series.title}</h1>
            {series.author && (
              <p className="text-xs text-white/40 flex items-center gap-1 mb-2">
                <User className="w-3 h-3" />{series.author}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className={`text-[11px] px-2 py-0.5 rounded border font-medium capitalize ${statusCls}`}>{series.status}</span>
              {series.year && <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] text-white/40 border border-white/[0.08]">{series.year}</span>}
              <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] text-white/40 border border-white/[0.08]">
                {series.chapters.length} Ch.
              </span>
            </div>
            {series.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {series.genres.slice(0, 4).map((g) => (
                  <span key={g} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/80">{g}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {firstChapter && (
            <Link href={`/manga/read/${series.id}/${firstChapter.id}`} className="flex-1">
              <Button className="w-full h-10 text-sm font-bold bg-primary hover:bg-primary/90 gap-2">
                <BookOpen className="w-4 h-4" /> First Ch.
              </Button>
            </Link>
          )}
          {latestChapter && latestChapter.id !== firstChapter?.id && (
            <Link href={`/manga/read/${series.id}/${latestChapter.id}`} className="flex-1">
              <Button variant="outline" className="w-full h-10 text-sm font-bold border-white/10 text-white/70 bg-transparent gap-2">
                <Zap className="w-4 h-4" /> Latest
              </Button>
            </Link>
          )}
        </div>

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
        <h2 className="text-base font-extrabold text-white mb-3">{series.chapters.length} Chapters</h2>
        <div className="space-y-px">
          {displayedChapters.map((ch) => (
            <Link
              key={ch.id}
              href={`/manga/read/${series.id}/${ch.id}`}
              className="group flex items-center justify-between py-3 px-3 -mx-1 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white/80 group-hover:text-primary transition-colors">
                  {ch.chapter ? `Chapter ${ch.chapter}` : "Oneshot"}
                  {ch.title ? ` — ${ch.title}` : ""}
                </p>
                {ch.volume && <p className="text-[10px] text-white/30">Vol. {ch.volume}</p>}
              </div>
              {ch.publishAt && (
                <span className="text-xs text-white/30 shrink-0 ml-3">{formatDate(ch.publishAt)}</span>
              )}
            </Link>
          ))}
        </div>

        {series.chapters.length > 20 && (
          <button
            onClick={() => setShowAllChapters(!showAllChapters)}
            className="mt-4 w-full py-2.5 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white hover:border-white/20 hover:bg-white/[0.03] transition-all flex items-center justify-center gap-2"
          >
            {showAllChapters
              ? <><ChevronUp className="w-4 h-4" /> Show fewer</>
              : <><ChevronDown className="w-4 h-4" /> Show all {series.chapters.length} chapters</>
            }
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
                        className="ml-auto opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
