import { Link } from "wouter";
import { Clock, Trash2, BookOpen, RotateCcw } from "lucide-react";
import { useGetHistory, getGetHistoryQueryKey, useDeleteHistoryEntry, useClearHistory, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import SectionHeader from "@/components/SectionHeader";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getDateGroup(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const itemStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysDiff = Math.floor((todayStart - itemStart) / 86_400_000);
  if (daysDiff === 0) return "Today";
  if (daysDiff === 1) return "Yesterday";
  if (daysDiff < 7) return "This Week";
  if (daysDiff < 30) return "This Month";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function proxyImage(url: string | null | undefined): string {
  if (!url) return "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) return url;
  if (url.includes("uploads.mangadex.org")) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

export default function HistoryPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: history, isLoading } = useGetHistory({ query: { enabled: !!user, queryKey: getGetHistoryQueryKey() } });

  const deleteEntry = useDeleteHistoryEntry({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() }); },
    },
  });

  const clearAll = useClearHistory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
        toast({ description: "History cleared" });
      },
    },
  });

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Sign in to view history</h2>
        <p className="text-[#9CA3AF] mb-6">Track your reading progress across all series</p>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/login">Sign In</Link>
        </Button>
      </div>
    );
  }

  const sortedHistory = [...(history ?? [])].sort((a, b) => new Date(b.readAt).getTime() - new Date(a.readAt).getTime());

  const grouped = sortedHistory.reduce<Record<string, typeof sortedHistory>>((acc, entry) => {
    const group = getDateGroup(entry.readAt);
    if (!acc[group]) acc[group] = [];
    acc[group].push(entry);
    return acc;
  }, {});

  const groupOrder = ["Today", "Yesterday", "This Week", "This Month"];
  const sortedGroups = [
    ...groupOrder.filter((g) => grouped[g]),
    ...Object.keys(grouped).filter((g) => !groupOrder.includes(g)).sort((a, b) => b.localeCompare(a)),
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <SectionHeader title="Reading History" accent />
        {sortedHistory.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-2 -mt-5 text-xs">
                <RotateCcw className="w-3.5 h-3.5" /> Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle>Clear reading history?</AlertDialogTitle>
                <AlertDialogDescription className="text-[#9CA3AF]">
                  This will permanently delete all your reading history. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-secondary border-white/10">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => clearAll.mutate(undefined)} className="bg-destructive hover:bg-destructive/90">
                  Clear History
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-3 bg-card rounded-xl p-3 border border-white/[0.06]">
              <Skeleton className="w-12 h-16 rounded-lg bg-secondary shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-2/3 bg-secondary" />
                <Skeleton className="h-3 w-1/3 bg-secondary" />
              </div>
            </div>
          ))}
        </div>
      ) : !sortedHistory.length ? (
        <div className="text-center py-20">
          <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-[#9CA3AF] text-lg">No reading history yet</p>
          <p className="text-[#9CA3AF]/60 text-sm mt-1">Start reading and your history will appear here</p>
          <Button asChild className="mt-4 bg-primary hover:bg-primary/90">
            <Link href="/">Browse Manga</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedGroups.map((group) => (
            <div key={group}>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-1 h-4 bg-primary rounded-full" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">{group}</h3>
                <span className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded-full border border-white/8">
                  {grouped[group].length}
                </span>
              </div>
              <div className="space-y-1.5 pl-3.5">
                {grouped[group].map((h) => (
                  <div
                    key={h.id}
                    className="group flex items-center gap-3 bg-card rounded-xl p-3 border border-white/[0.06] hover:border-white/10 transition-colors"
                    data-testid={`card-history-${h.id}`}
                  >
                    <Link href={`/series/${h.provider}/${encodeURIComponent(h.seriesId)}`} className="shrink-0">
                      <div className="w-11 h-15 rounded-lg overflow-hidden bg-secondary border border-white/5">
                        {h.coverImage ? (
                          <img
                            src={proxyImage(h.coverImage)}
                            alt={h.title}
                            className="w-11 h-[60px] object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = h.coverImage ?? ""; }}
                          />
                        ) : (
                          <div className="w-11 h-[60px] flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/series/${h.provider}/${encodeURIComponent(h.seriesId)}`}>
                        <h3 className="text-sm font-medium text-white hover:text-primary transition-colors truncate" data-testid={`text-history-title-${h.id}`}>
                          {h.title}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-primary font-medium">Chapter {h.chapterNumber}</span>
                        <span className="text-[10px] text-[#9CA3AF]">{formatRelativeTime(h.readAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary/80 h-7 px-2 text-xs hidden group-hover:flex">
                        <Link href={`/read/${h.provider}/${encodeURIComponent(h.seriesId)}/${encodeURIComponent(h.chapterId)}`}>
                          Continue
                        </Link>
                      </Button>
                      <button
                        onClick={() => deleteEntry.mutate({ provider: h.provider, seriesId: h.seriesId })}
                        className="p-1.5 rounded-md text-[#9CA3AF] hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                        data-testid={`button-remove-history-${h.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
