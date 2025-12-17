"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, LogOut, User, ChevronDown, ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from "@/lib/config";

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const [isInventoryOpen, setIsInventoryOpen] = useState(true);
  const [role, setRole] = useState("");
  // Local state removed in favor of props

  useEffect(() => {
    // 1. Initial Load from LocalStorage (Optimistic)
    const storedRole = localStorage.getItem("gco_role");
    if (storedRole) setRole(storedRole);

    // 2. Background Verification (Correctness Check)
    const verifyRole = async () => {
      const token = localStorage.getItem("gco_token");
      if (!token) return;

      if (!token) return;

      const baseUrl = API_URL;

      try {
        const res = await fetch(`${baseUrl}/auth/me`, {
          headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          // Only update if different to avoid flicker
          if (data.role && data.role !== storedRole) {
            console.log("Background Check: Role updated to", data.role);
            localStorage.setItem("gco_role", data.role);
            setRole(data.role);
          }
        }
      } catch (err) {
        console.warn("Background role check failed (likely offline or cold start still pending)", err);
      }
    };

    // Trigger background check
    verifyRole();
  }, []);

  return (
    <div
      className={`${isCollapsed ? "w-20" : "w-64"} h-screen bg-[#183C30] text-white flex flex-col shadow-xl fixed left-0 top-0 transition-all duration-300 z-50`}
    >
      {/* Header / Brand */}
      <div className="p-4 border-b border-[#2A5E4D] flex items-center justify-between">
        <div className={`flex items-center space-x-3 ${isCollapsed ? "justify-center w-full" : ""}`}>
          <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm shrink-0">
            <span className="font-bold text-xl">G</span>
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden whitespace-nowrap">
              <h1 className="font-bold text-lg leading-tight">GCO Platform</h1>
              <p className="text-xs text-gray-400">Entreprise Edition</p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <button onClick={() => setIsCollapsed(true)} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Collapse Toggle (Centered when collapsed) */}
      {isCollapsed && (
        <div className="flex justify-center py-2 border-b border-[#2A5E4D]">
          <button onClick={() => setIsCollapsed(false)} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}


      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-2 overflow-y-auto overflow-x-hidden">
        <Link
          href="/dashboard"
          className={`flex items-center space-x-3 px-3 py-3 rounded-xl transition-all group ${pathname === "/dashboard"
            ? "bg-white/10 text-white font-medium"
            : "text-gray-300 hover:bg-white/5 hover:text-white"
            } ${isCollapsed ? "justify-center" : ""}`}
          title={isCollapsed ? "Inicio" : ""}
        >
          <LayoutDashboard className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>Inicio</span>}
        </Link>

        {role === "admin" && (
          <Link
            href="/dashboard/users"
            className={`flex items-center space-x-3 px-3 py-3 rounded-xl transition-all ${pathname === "/dashboard/users"
              ? "bg-white/10 text-white font-medium"
              : "text-gray-300 hover:bg-white/5 hover:text-white"
              } ${isCollapsed ? "justify-center" : ""}`}
            title={isCollapsed ? "Administrar Usuarios" : ""}
          >
            <User className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>Administrar Usuarios</span>}
          </Link>
        )}

        {/* Inventory Group */}
        <div className="space-y-1">
          <button
            onClick={() => !isCollapsed && setIsInventoryOpen(!isInventoryOpen)}
            className={`flex items-center justify-between w-full px-3 py-3 text-gray-300 hover:bg-white/5 hover:text-white rounded-xl transition-all ${isCollapsed ? "justify-center cursor-default" : ""}`}
            title={isCollapsed ? "Inventarios" : ""}
          >
            <div className="flex items-center space-x-3">
              <Package className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>Inventarios</span>}
            </div>
            {!isCollapsed && (
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${isInventoryOpen ? "rotate-180" : ""}`}
              />
            )}
          </button>

          <AnimatePresence>
            {(isInventoryOpen || isCollapsed) && (
              <motion.div
                initial={!isCollapsed ? { height: 0, opacity: 0 } : {}}
                animate={!isCollapsed ? { height: "auto", opacity: 1 } : {}}
                exit={!isCollapsed ? { height: 0, opacity: 0 } : {}}
                className="overflow-hidden"
              >
                <div className={`${!isCollapsed ? "ml-4 pl-4 border-l border-[#2A5E4D]" : "flex flex-col items-center"} space-y-1 pt-1`}>
                  <Link
                    href="/dashboard/saldos"
                    className={`block px-3 py-2 rounded-lg text-sm transition-all ${pathname === "/dashboard/saldos"
                      ? "bg-white text-[#183C30] font-medium shadow-md"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                      } ${isCollapsed ? "text-center text-[10px]" : ""}`}
                    title={isCollapsed ? "Saldos Consolidados" : ""}
                  >
                    {isCollapsed ? "Saldos" : "Saldos Consolidados"}
                  </Link>

                  {role === "admin" && (
                    <Link
                      href="/dashboard/movements"
                      className={`block px-3 py-2 rounded-lg text-sm transition-all ${pathname === "/dashboard/movements"
                        ? "bg-white text-[#183C30] font-medium shadow-md"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                        } ${isCollapsed ? "text-center text-[10px]" : ""}`}
                      title={isCollapsed ? "Auditoria Movimientos" : ""}
                    >
                      {isCollapsed ? "Audit." : "Auditoria Movimientos"}
                    </Link>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Footer / User */}
      <div className="p-4 border-t border-[#2A5E4D] bg-[#122e24]">
        {!isCollapsed && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-green-800 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-green-200" />
              </div>
              <div className="text-sm overflow-hidden">
                <p className="font-medium text-white truncate">Admin User</p>
                <p className="text-xs text-gray-400">En línea</p>
              </div>
            </div>
          </div>
        )}

        <Link
          href="/"
          onClick={() => {
            localStorage.removeItem("gco_token");
            localStorage.removeItem("gco_user");
          }}
          className={`flex items-center justify-center space-x-2 w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2 rounded-lg text-sm transition-all border border-red-500/20 ${isCollapsed ? "px-0" : ""}`}
          title="Cerrar Sesión"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Cerrar Sesión</span>}
        </Link>
      </div>
    </div>
  );
}
