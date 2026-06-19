import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ApiError } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import HomePage from "@/pages/Home";
import MangaFireSeriesDetailPage from "@/pages/MangaFireSeriesDetail";
import MangaFireReaderPage from "@/pages/MangaFireReader";
import BrowsePage from "@/pages/Browse";
import SearchPage from "@/pages/Search";
import BookmarksPage from "@/pages/Bookmarks";
import HistoryPage from "@/pages/History";
import FavouritesPage from "@/pages/Favourites";
import ProfilePage from "@/pages/Profile";
import SettingsPage from "@/pages/Settings";
import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";
import NotFound from "@/pages/not-found";
import ManhwaHomePage from "@/pages/ManhwaHome";
import ManhwaSeriesDetailPage from "@/pages/ManhwaSeriesDetail";
import ManhwaReaderPage from "@/pages/ManhwaReader";
import ManhwaBrowsePage from "@/pages/ManhwaBrowse";
import MangaHomePage from "@/pages/MangaHome";
import MangaSeriesDetailPage from "@/pages/MangaSeriesDetail";
import MangaReaderPage from "@/pages/MangaReader";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as ApiError)?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
  },
});

function LayoutedRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={MangaHomePage} />
        <Route path="/series/:provider/:id" component={MangaFireSeriesDetailPage} />
        <Route path="/browse" component={BrowsePage} />
        <Route path="/search" component={SearchPage} />
        <Route path="/manga" component={MangaHomePage} />
        <Route path="/manga/series/:id" component={MangaSeriesDetailPage} />
        <Route path="/manhwa" component={ManhwaHomePage} />
        <Route path="/manhwa/browse" component={ManhwaBrowsePage} />
        <Route path="/manhwa/series/:slug" component={ManhwaSeriesDetailPage} />
        <Route path="/bookmarks" component={BookmarksPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/favourites" component={FavouritesPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Switch>
            <Route path="/read/:provider/:seriesId/:chapterId" component={MangaFireReaderPage} />
            <Route path="/manga/read/:id/:chapterId" component={MangaReaderPage} />
            <Route path="/manhwa/read/:slug/:chapterNum" component={ManhwaReaderPage} />
            <Route component={LayoutedRoutes} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
