import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useGetPopularManga } from "@workspace/api-client-react";
import MangaCard, { MangaCardSkeleton } from "@/components/MangaCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BASE = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

const PROVIDERS = [
  { value: "asurascans", label: "AsuraScans" },
  { value: "mangadex", label: "MangaDex" },
];

interface AsuraItem {
  id: string;
  title: string;
  coverUrl: string;
  status: string;
  latestChapter?: number;
  genres: string[];
}

function asuraToCard(item: AsuraItem) {
  return {
    id: item.id,
    title: item.title,
    coverImage: item.coverUrl,
    provider: "asurascans" as const,
    type: "Manhwa",
    status: item.status,
    latestChapter: item.latestChapter != null ? `Ch. ${item.latestChapter}` : null,
  };
}

export default function PopularPage() {
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState("asurascans");

  const [asuraItems, setAsuraItems] = useState<AsuraItem[]>([]);
  const [asuraLoading, setAsuraLoading] = useState(false);
  const [asuraHasMore, setAsuraHasMore] = useState(false);

  const { data: mdxData, isLoading: mdxLoading } = useGetPopularManga(
    { page, provider, type: undefined, status: undefined, genre: undefined },
    {
      query: {
        queryKey: ["popular", page, provider] as const,
        enabled: provider !== "asurascans",
      },
    },
  );

  useEffect(() => {
    if (provider !== "asurascans") return;
    setAsuraLoading(true);
    fetch(`${BASE}/api/asurascans/popular?page=${page}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: { items: AsuraItem[]; hasMore?: boolean }) => {
        setAsuraItems(d.items ?? []);
        setAsuraHasMore(d.hasMore ?? false);
      })
      .catch(() => { setAsuraItems([]); })
      .finally(() => setAsuraLoading(false));
  }, [provider, page]);

  function handleProvider(v: string) {
    setProvider(v);
    setPage(1);
  }

  const isLoading = provider === "asurascans" ? asuraLoading : mdxLoading;
  const hasMore = provider === "asurascans" ? asuraHasMore : mdxData?.hasMore ?? false;
  const items = provider === "asurascans"
    ? asuraItems.map(asuraToCard)
    : (mdxData?.items ?? []) as Parameters<typeof MangaCard>[0][];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Popular</h1>
            <p className="text-sm text-white/40 mt-0.5">Most popular series from AsuraScans</p>
          </div>
          <Select value={provider} onValueChange={handleProvider}>
            <SelectTrigger className="w-36 bg-[#111118] border-white/10 text-sm" data-testid="select-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#111118] border-white/10">
              {PROVIDERS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        {isLoading
          ? Array.from({ length: 24 }).map((_, i) => <MangaCardSkeleton key={i} />)
          : items.map((item) => <MangaCard key={`${item.provider}-${item.id}`} {...item} />)}
      </div>

      {!isLoading && items.length === 0 && (
        <div className="text-center py-20">
          <p className="text-white/30 text-lg font-medium">No results found</p>
          <p className="text-white/20 text-sm mt-1">Try a different source</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isLoading}
          onClick={() => setPage((p) => p - 1)}
          className="border-white/10 bg-[#111118] hover:bg-white/8"
          data-testid="button-prev-page"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-white/40 px-2">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore || isLoading}
          onClick={() => setPage((p) => p + 1)}
          className="border-white/10 bg-[#111118] hover:bg-white/8"
          data-testid="button-next-page"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
