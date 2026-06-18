import { type ReactNode } from "react";
import Navbar from "./Navbar";
import MobileNav from "./MobileNav";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col pb-14 md:pb-0">
      <Navbar />
      <main className="pt-14 flex-1">{children}</main>
      <MobileNav />
    </div>
  );
}
