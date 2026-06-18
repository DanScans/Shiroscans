import { useState, useEffect } from "react";
import { MessageCircle, ThumbsUp, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Comment {
  id: number;
  content: string;
  createdAt: string;
  userId: number;
  username: string;
  avatarUrl?: string | null;
}

interface CommentResponse {
  comments: Comment[];
  total: number;
  page: number;
  hasMore: boolean;
}

interface Props {
  provider: string;
  seriesId: string;
  chapterId: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

type SortBy = "newest" | "oldest";

export default function CommentsSection({ provider, seriesId, chapterId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });

  useEffect(() => {
    setLoading(true);
    setComments([]);
    setPage(1);
    fetch(`${BASE}/api/comments/${encodeURIComponent(provider)}/${encodeURIComponent(seriesId)}/${encodeURIComponent(chapterId)}?sortBy=${sortBy}&limit=20`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: CommentResponse) => {
        setComments(d.comments);
        setTotal(d.total);
        setHasMore(d.hasMore);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [provider, seriesId, chapterId, sortBy]);

  function loadMore() {
    const nextPage = page + 1;
    fetch(`${BASE}/api/comments/${encodeURIComponent(provider)}/${encodeURIComponent(seriesId)}/${encodeURIComponent(chapterId)}?sortBy=${sortBy}&page=${nextPage}&limit=20`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: CommentResponse) => {
        setComments((prev) => [...prev, ...d.comments]);
        setPage(nextPage);
        setHasMore(d.hasMore);
      })
      .catch(() => {});
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, seriesId, chapterId, content: content.trim() }),
      });
      if (!res.ok) throw new Error();
      const newComment: Comment = await res.json();
      setComments((prev) => [newComment, ...prev]);
      setTotal((t) => t + 1);
      setContent("");
      toast({ description: "Comment posted!" });
    } catch {
      toast({ description: "Failed to post comment", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteComment(id: number) {
    try {
      const res = await fetch(`${BASE}/api/comments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setComments((prev) => prev.filter((c) => c.id !== id));
      setTotal((t) => t - 1);
    } catch {
      toast({ description: "Failed to delete comment", variant: "destructive" });
    }
  }

  return (
    <div className="px-4 py-6 border-t border-white/[0.06]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-extrabold text-white flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          {total > 0 ? `${total} Comments` : "Comments"}
        </h3>
        <div className="flex gap-1">
          {(["newest", "oldest"] as SortBy[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`text-xs px-2.5 py-1 rounded border transition-all ${sortBy === s ? "bg-primary border-primary text-white" : "border-white/10 text-white/40 bg-transparent"}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Comment input */}
      {user ? (
        <form onSubmit={submitComment} className="mb-5">
          <div className="flex gap-2.5">
            <Avatar className="w-8 h-8 shrink-0 mt-0.5">
              <AvatarImage src={user.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs">{user.username[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 flex gap-2">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share your thoughts..."
                rows={2}
                maxLength={2000}
                className="flex-1 bg-[#1a1a2e] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/40 resize-none"
              />
              <Button
                type="submit"
                disabled={submitting || !content.trim()}
                size="sm"
                className="self-end bg-primary hover:bg-primary/90 px-3 h-9"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="bg-[#1a1a2e] rounded-xl p-4 mb-5 text-center">
          <p className="text-sm text-white/40 mb-2">Log in to join the discussion</p>
          <div className="flex gap-2 justify-center">
            <a href="/login" className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors font-semibold">Log In</a>
            <a href="/register" className="text-xs border border-white/10 text-white/60 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors font-semibold">Register</a>
          </div>
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2.5">
              <Skeleton className="w-8 h-8 rounded-full shrink-0 bg-[#1a1a2e]" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24 bg-[#1a1a2e] rounded" />
                <Skeleton className="h-12 w-full bg-[#1a1a2e] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-white/25">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No comments yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5 group">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarImage src={c.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs">{c.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-white/80">{c.username}</span>
                  <span className="text-[10px] text-white/25">{relativeTime(c.createdAt)}</span>
                </div>
                <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap break-words">{c.content}</p>
              </div>
              {user && Number(user.id) === c.userId && (
                <button
                  onClick={() => deleteComment(c.id)}
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-1 text-white/20 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <button
          onClick={loadMore}
          className="mt-4 w-full py-2.5 text-sm text-white/40 hover:text-white border border-white/[0.06] rounded-lg hover:border-white/20 transition-all"
        >
          Load more comments
        </button>
      )}
    </div>
  );
}
