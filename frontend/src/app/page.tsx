"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // 1. Authenticate against Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Get ID Token
      const token = await user.getIdToken();

      // 3. Save session
      localStorage.setItem("gco_token", token);
      localStorage.setItem("gco_user", user.email || "");

      // 3b. Fetch Role from Backend
      // In Production, ensure NEXT_PUBLIC_API_URL is set!
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://gco-siigo-api-245366645678.us-central1.run.app";

      try {
        // 15 Seconds timeout to allow Cloud Run Cold Start
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        console.log(`Fetching role from ${baseUrl}/auth/me...`);
        const roleRes = await fetch(`${baseUrl}/auth/me`, {
          headers: { "Authorization": `Bearer ${token}` },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (roleRes.ok) {
          const roleData = await roleRes.json();
          console.log("Role assigned:", roleData.role);
          localStorage.setItem("gco_role", roleData.role);
        } else {
          console.warn("Role fetch failed status:", roleRes.status);
          // Fallback for Costos
          if (user.email === "costos@origenbotanico.com") {
            localStorage.setItem("gco_role", "admin");
          } else {
            localStorage.setItem("gco_role", "viewer");
          }
        }
      } catch (err) {
        console.error("Backend unreachable or timeout", err);
        // Fallback for Costos (Offline Mode / Network Error)
        if (user.email === "costos@origenbotanico.com") {
          localStorage.setItem("gco_role", "admin");
        } else {
          localStorage.setItem("gco_role", "viewer");
        }
      }

      // 4. Redirect
      window.location.href = "/dashboard";
    } catch (err: any) {
      console.error("Login failed", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Usuario o contrasena incorrectos.");
      } else {
        setError("Error al iniciar sesion: " + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex w-1/2 bg-[#183C30] relative overflow-hidden items-center justify-center">
        <div className="relative z-10 text-white text-center p-12">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl font-bold mb-6"
          >
            GCO Platform
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-gray-300 font-light"
          >
            Gestion inteligente de inventarios y auditoria en tiempo real.
          </motion.p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900">Bienvenido</h2>
            <p className="text-gray-500 mt-2">Inicia sesion con tu cuenta GCO</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Usuario (Email)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#183C30] focus:border-transparent transition-all"
                  placeholder="ejemplo@correo.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contrasena</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#183C30] focus:border-transparent transition-all"
                  placeholder="Password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#183C30] hover:bg-[#122e24] text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-400">
            Powered by GCO Technology
          </p>
        </div>
      </div>
    </div>
  );
}
