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

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
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
        <p className="text-[#9CA3AF] mb-6">Track your reading progress</p>
        <Button asChild className="bg-primary hover:bg-primary/90"><Link href="/login">Sign In</Link></Button>
      </div>
    );
  }

  const sortedHistory = [...(history ?? [])].sort((a, b) => new Date(b.readAt).getTime() - new Date(a.readAt).getTime());

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <SectionHeader title="Reading History" accent />
        {sortedHistory.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-2 -mt-5">
                <RotateCcw className="w-4 h-4" /> Clear All
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
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3 bg-secondary" /><Skeleton className="h-3 w-1/3 bg-secondary" /></div>
            </div>
          ))}
        </div>
      ) : !sortedHistory.length ? (
        <div className="text-center py-20">
          <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-[#9CA3AF] text-lg">No reading history yet</p>
          <p className="text-[#9CA3AF]/60 text-sm mt-1">Start reading and your history will appear here</p>
          <Button asChild className="mt-4 bg-primary hover:bg-primary/90"><Link href="/">Browse Manga</Link></Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedHistory.map((h) => (
            <div key={h.id} className="group flex items-center gap-3 bg-card rounded-xl p-3 border border-white/[0.06] hover:border-white/10 transition-colors" data-testid={`card-history-${h.id}`}>
              <Link href={`/series/${h.provider}/${encodeURIComponent(h.seriesId)}`} className="shrink-0">
                {h.coverImage ? (
                  <img src={h.coverImage} alt={h.title} className="w-12 h-16 object-cover rounded-lg" />
                ) : (
                  <div className="w-12 h-16 bg-secondary rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-muted-foreground/30" />
                  </div>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/series/${h.provider}/${encodeURIComponent(h.seriesId)}`}>
                  <h3 className="text-sm font-medium text-white hover:text-primary transition-colors truncate" data-testid={`text-history-title-${h.id}`}>{h.title}</h3>
                </Link>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-primary">Chapter {h.chapterNumber}</span>
                  <span className="text-xs text-[#9CA3AF]">{formatDate(h.readAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary/80 hidden group-hover:flex">
                  <Link href={`/read/${h.provider}/${encodeURIComponent(h.seriesId)}/${encodeURIComponent(h.chapterId)}`}>
                    Continue
                  </Link>
                </Button>
                <button
                  onClick={() => deleteEntry.mutate({ provider: h.provider, seriesId: h.seriesId })}
                  className="p-1.5 rounded-md text-[#9CA3AF] hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                  data-testid={`button-remove-history-${h.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
