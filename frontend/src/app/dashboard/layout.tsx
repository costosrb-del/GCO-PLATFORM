"use client";
import { Sidebar } from "@/components/Sidebar";
import { useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[#F5F7F8]">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-64"}`}>
        <div className="max-w-[1920px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
