import { type ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import MobileNav from "./MobileNav";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="pt-14 flex-1 pb-14 md:pb-0">{children}</main>
      <Footer />
      <MobileNav />
    </div>
  );
}
