"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ArrowLeftRight, LogOut, User, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Sidebar() {
  const pathname = usePathname();
  const [isInventoryOpen, setIsInventoryOpen] = useState(true);
  const [role, setRole] = useState("");

  useEffect(() => {
    setRole(localStorage.getItem("gco_role") || "");
  }, []);

  return (
    <div className="h-screen w-64 bg-[#183C30] text-white flex flex-col shadow-xl fixed left-0 top-0">
      {/* Header / Brand */}
      <div className="p-6 border-b border-[#2A5E4D]">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <span className="font-bold text-xl">G</span>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">GCO Platform</h1>
            <p className="text-xs text-gray-400">Entreprise Edition</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <Link
          href="/dashboard"
          className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${pathname === "/dashboard"
              ? "bg-white/10 text-white font-medium"
              : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Inicio</span>
        </Link>

        {role === "admin" && (
          <Link
            href="/dashboard/users"
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${pathname === "/dashboard/users"
                ? "bg-white/10 text-white font-medium"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
              }`}
          >
            <User className="h-5 w-5" />
            <span>Administrar Usuarios</span>
          </Link>
        )}

        {/* Inventory Group */}
        <div className="space-y-1">
          <button
            onClick={() => setIsInventoryOpen(!isInventoryOpen)}
            className="flex items-center justify-between w-full px-4 py-3 text-gray-300 hover:bg-white/5 hover:text-white rounded-xl transition-all"
          >
            <div className="flex items-center space-x-3">
              <Package className="h-5 w-5" />
              <span>Inventarios</span>
            </div>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${isInventoryOpen ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
            {isInventoryOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="ml-4 pl-4 border-l border-[#2A5E4D] space-y-1 pt-1">
                  <Link
                    href="/dashboard/saldos"
                    className={`block px-4 py-2 rounded-lg text-sm transition-all ${pathname === "/dashboard/saldos"
                        ? "bg-white text-[#183C30] font-medium shadow-md"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                      }`}
                  >
                    Saldos Consolidados
                  </Link>
                  <Link
                    href="/dashboard/movements"
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm transition-all ${pathname === "/dashboard/movements"
                        ? "bg-white text-[#183C30] font-medium shadow-md"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                      }`}
                  >
                    <span>Auditoria Movimientos</span>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Footer / User */}
      <div className="p-4 border-t border-[#2A5E4D] bg-[#122e24]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-green-800 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-green-200" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-white">Admin User</p>
              <p className="text-xs text-gray-400">En línea</p>
            </div>
          </div>
        </div>

        <Link
          href="/"
          onClick={() => {
            localStorage.removeItem("gco_token");
            localStorage.removeItem("gco_user");
          }}
          className="flex items-center justify-center space-x-2 w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2 rounded-lg text-sm transition-all border border-red-500/20"
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar Sesión</span>
        </Link>
      </div>
    </div>
  );
}
