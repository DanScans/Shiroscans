import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ApiError } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import HomePage from "@/pages/Home";
import LatestPage from "@/pages/Latest";
import PopularPage from "@/pages/Popular";
import SeriesPage from "@/pages/Series";
import ReaderPage from "@/pages/Reader";
import SearchPage from "@/pages/Search";
import BookmarksPage from "@/pages/Bookmarks";
import HistoryPage from "@/pages/History";
import FavouritesPage from "@/pages/Favourites";
import ProfilePage from "@/pages/Profile";
import SettingsPage from "@/pages/Settings";
import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";
import ManhwaPage from "@/pages/Manhwa";
import FlameSeriesDetailPage from "@/pages/FlameSeriesDetail";
import FlameReaderPage from "@/pages/FlameReader";
import RankingsPage from "@/pages/Rankings";
import NotFound from "@/pages/not-found";

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
        <Route path="/" component={HomePage} />
        <Route path="/latest" component={LatestPage} />
        <Route path="/popular" component={PopularPage} />
        <Route path="/search" component={SearchPage} />
        <Route path="/series/:provider/:id" component={SeriesPage} />
        <Route path="/bookmarks" component={BookmarksPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/favourites" component={FavouritesPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/manhwa" component={ManhwaPage} />
        <Route path="/flame/series/:id" component={FlameSeriesDetailPage} />
        <Route path="/rankings" component={RankingsPage} />
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
            <Route path="/read/:provider/:seriesId/:chapterId" component={ReaderPage} />
            <Route path="/flame/read/:seriesId/:chapterId" component={FlameReaderPage} />
            <Route component={LayoutedRoutes} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
