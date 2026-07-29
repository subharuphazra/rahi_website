import React from "react";
import { Outlet } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Ticker from "@/components/layout/Ticker";

export default function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col" data-testid="site-layout">
      <Header />
      <Ticker />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
