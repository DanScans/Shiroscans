import { Link } from "wouter";
import { Heart, Trash2, BookOpen } from "lucide-react";
import { useGetFavourites, getGetFavouritesQueryKey, useRemoveFavourite, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import SectionHeader from "@/components/SectionHeader";

export default function FavouritesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: user } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: favourites, isLoading } = useGetFavourites({ query: { enabled: !!user, queryKey: getGetFavouritesQueryKey() } });

  const removeFavourite = useRemoveFavourite({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetFavouritesQueryKey() });
        toast({ description: "Removed from favourites" });
      },
    },
  });

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <Heart className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Sign in to view favourites</h2>
        <p className="text-[#9CA3AF] mb-6">Save your all-time favourite series</p>
        <Button asChild className="bg-primary hover:bg-primary/90"><Link href="/login">Sign In</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <SectionHeader title="Favourites" accent />
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-lg overflow-hidden bg-card border border-white/[0.06]">
              <Skeleton className="aspect-[2/3] w-full bg-secondary" />
              <div className="p-2.5"><Skeleton className="h-3 w-full bg-secondary" /></div>
            </div>
          ))}
        </div>
      ) : !favourites?.length ? (
        <div className="text-center py-20">
          <Heart className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-[#9CA3AF] text-lg">No favourites yet</p>
          <p className="text-[#9CA3AF]/60 text-sm mt-1">Heart series you absolutely love</p>
          <Button asChild className="mt-4 bg-primary hover:bg-primary/90"><Link href="/">Browse Manga</Link></Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {favourites.map((f) => (
            <div key={f.id} className="group relative rounded-lg overflow-hidden bg-card border border-white/[0.06] hover:border-primary/30 transition-all duration-200" data-testid={`card-favourite-${f.id}`}>
              <Link href={`/series/${f.provider}/${encodeURIComponent(f.seriesId)}`} className="block">
                <div className="aspect-[2/3] relative overflow-hidden bg-secondary">
                  {f.coverImage ? (
                    <img src={f.coverImage} alt={f.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-8 h-8 text-muted-foreground/30" /></div>
                  )}
                </div>
                <div className="p-2.5">
                  <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-primary transition-colors">{f.title}</h3>
                  {f.status && <p className="text-xs text-[#9CA3AF] mt-1">{f.status}</p>}
                </div>
              </Link>
              <button
                onClick={() => removeFavourite.mutate({ provider: f.provider, seriesId: f.seriesId })}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-[#9CA3AF] hover:text-destructive hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                data-testid={`button-remove-favourite-${f.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
