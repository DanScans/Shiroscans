/* eslint-disable @typescript-eslint/no-explicit-any */
import { FrontpageManga, FrontpageSection } from "@/types";
import {
  BaseFrontpage,
  FrontpageSectionConfig,
  FrontpageFetchOptions,
} from "./base";

export class ComixFrontpage extends BaseFrontpage {
  private readonly baseUrl = "https://comix.to";
  private readonly apiBase = "https://comix.to/api/v2";

  // Excluded genre IDs (NSFW categories)
  private readonly excludedGenres = [87264, 87266, 87268, 87265];

  getSourceId(): string {
    return "comix";
  }

  getSourceName(): string {
    return "Comix";
  }

  getAvailableSections(): FrontpageSectionConfig[] {
    return [
      {
        id: "trending",
        title: "Most Recent Popular",
        type: "trending",
        supportsPagination: false,
        supportsTimeFilter: true,
        availableTimeFilters: [1, 7, 30, 90, 180, 365],
      },
      {
        id: "most_followed",
        title: "Most Followed New Comics",
        type: "most_followed",
        supportsPagination: false,
        supportsTimeFilter: true,
        availableTimeFilters: [1, 7, 30, 90, 180, 365],
      },
      {
        id: "latest_hot",
        title: "Latest Updates (Hot)",
        type: "latest_hot",
        supportsPagination: true,
        supportsTimeFilter: false,
      },
      {
        id: "latest_new",
        title: "Latest Updates (New)",
        type: "latest_new",
        supportsPagination: true,
        supportsTimeFilter: false,
      },
      {
        id: "recently_added",
        title: "Recently Added",
        type: "recently_added",
        supportsPagination: true,
        supportsTimeFilter: false,
      },
      {
        id: "completed",
        title: "Complete Series",
        type: "completed",
        supportsPagination: true,
        supportsTimeFilter: false,
      },
    ];
  }

  async fetchSection(
    sectionId: string,
    options: FrontpageFetchOptions = {}
  ): Promise<FrontpageSection> {
    const sectionConfig = this.getAvailableSections().find(
      (s) => s.id === sectionId
    );
    if (!sectionConfig) {
      throw new Error(`Unknown section: ${sectionId}`);
    }

    const { page = 1, limit = 30, days = 7 } = options;

    let url: string;
    let items: FrontpageManga[] = [];

    switch (sectionId) {
      case "trending":
        url = this.buildTopUrl("trending", days, limit);
        items = await this.fetchTopItems(url);
        break;

      case "most_followed":
        url = this.buildTopUrl("follows", days, limit);
        items = await this.fetchTopItems(url);
        break;

      case "latest_hot":
        url = this.buildMangaListUrl("hot", page, limit);
        items = await this.fetchMangaList(url);
        break;

      case "latest_new":
        url = this.buildMangaListUrl("new", page, limit);
        items = await this.fetchMangaList(url);
        break;

      case "recently_added":
        url = this.buildRecentlyAddedUrl(page, limit);
        items = await this.fetchMangaList(url);
        break;

      case "completed":
        url = this.buildCompletedUrl(page, limit);
        items = await this.fetchMangaList(url);
        break;

      default:
        throw new Error(`Unknown section: ${sectionId}`);
    }

    return {
      id: sectionConfig.id,
      title: sectionConfig.title,
      type: sectionConfig.type,
      items,
      supportsPagination: sectionConfig.supportsPagination,
      supportsTimeFilter: sectionConfig.supportsTimeFilter,
      availableTimeFilters: sectionConfig.availableTimeFilters,
    };
  }

  private buildExcludeGenresParam(): string {
    return this.excludedGenres
      .map((id) => `exclude_genres[]=${id}`)
      .join("&");
  }

  private buildTopUrl(type: string, days: number, limit: number): string {
    return `${this.apiBase}/top?${this.buildExcludeGenresParam()}&type=${type}&days=${days}&limit=${limit}`;
  }

  private buildMangaListUrl(scope: string, page: number, limit: number): string {
    return `${this.apiBase}/manga?${this.buildExcludeGenresParam()}&scope=${scope}&limit=${limit}&order[chapter_updated_at]=desc&page=${page}`;
  }

  private buildRecentlyAddedUrl(page: number, limit: number): string {
    return `${this.apiBase}/manga?${this.buildExcludeGenresParam()}&order[created_at]=desc&limit=${limit}&page=${page}`;
  }

  private buildCompletedUrl(page: number, limit: number): string {
    return `${this.apiBase}/manga?${this.buildExcludeGenresParam()}&statuses[]=finished&order[chapter_updated_at]=desc&limit=${limit}&page=${page}`;
  }

  private async fetchTopItems(url: string): Promise<FrontpageManga[]> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.result?.items || !Array.isArray(data.result.items)) {
        return [];
      }

      return data.result.items.map((item: any) => this.mapComixManga(item));
    } catch (error) {
      console.error("[ComixFrontpage] Error fetching top items:", error);
      throw error;
    }
  }

  private async fetchMangaList(url: string): Promise<FrontpageManga[]> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.result?.items || !Array.isArray(data.result.items)) {
        return [];
      }

      return data.result.items.map((item: any) => this.mapComixManga(item));
    } catch (error) {
      console.error("[ComixFrontpage] Error fetching manga list:", error);
      throw error;
    }
  }

  private mapComixManga(item: any): FrontpageManga {
    let coverImage: string | undefined;
    if (item.poster?.large) {
      coverImage = item.poster.large;
    } else if (item.poster?.medium) {
      coverImage = item.poster.medium;
    } else if (item.poster?.small) {
      coverImage = item.poster.small;
    }

    let lastUpdated: string | undefined;
    let lastUpdatedTimestamp: number | undefined;
    if (item.chapter_updated_at) {
      lastUpdatedTimestamp = item.chapter_updated_at * 1000;
      lastUpdated = new Date(lastUpdatedTimestamp).toLocaleDateString();
    }

    return {
      id: item.hash_id,
      title: item.title,
      url: `${this.baseUrl}/title/${item.hash_id}-${item.slug}`,
      coverImage,
      latestChapter: item.latest_chapter || undefined,
      lastUpdated,
      lastUpdatedTimestamp,
      rating: item.rated_avg || undefined,
      followers: item.follows_total?.toString(),
      type: item.type,
      status: item.status,
      synopsis: item.synopsis,
    };
  }
}
