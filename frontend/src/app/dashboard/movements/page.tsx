"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, Search, Filter, RefreshCcw, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { useRouter } from "next/navigation";

export default function MovementsPage() {
  const router = useRouter();
  
  // Filters
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  
  // Data
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchMovements = async () => {
    const token = localStorage.getItem("gco_token");
    if (!token) {
        router.push("/");
        return;
    }

    setIsLoading(true);
    setSearched(true);
    try {
      let url = `http://localhost:8000/movements/?start_date=${startDate}&end_date=${endDate}`;
      selectedCompanies.forEach(c => url += `&companies=${encodeURIComponent(c)}`);

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.data) {
        setData(response.data.data);
      } else {
        setData([]);
      }
    } catch (error: any) {
      console.error("Error fetching movements:", error);
      if (error.response && error.response.status === 401) {
          router.push("/"); // Log out if token invalid
      }
    } finally {
      setIsLoading(false);
    }
  };

  // derived data for display
  const filteredData = data.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
        item.description?.toLowerCase().includes(term) ||
        item.doc_name?.toLowerCase().includes(term) ||
        item.product_code?.toLowerCase().includes(term)
    );
  });
  
  const totalIn = filteredData.reduce((acc, item) => item.type === "Entrada" ? acc + item.quantity : acc, 0);
  const totalOut = filteredData.reduce((acc, item) => item.type === "Salida" ? acc + item.quantity : acc, 0);

  return (
    <div className="space-y-6 pb-20 p-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
           <h1 className="text-2xl font-bold text-[#183C30]">Auditoria de Movimientos</h1>
           <p className="text-gray-500 text-sm">Consulta detallada de entradas y salidas por fecha</p>
        </div>
        
        <div className="flex items-center space-x-3 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
             <div className="flex items-center px-3 space-x-2 border-r border-gray-200">
                <Calendar className="h-4 w-4 text-gray-500" />
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-sm font-medium outline-none text-gray-700 w-32"
                />
             </div>
             <div className="flex items-center px-3 space-x-2">
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-sm font-medium outline-none text-gray-700 w-32"
                />
             </div>
             <button 
               onClick={fetchMovements}
               disabled={isLoading}
               className="bg-[#183C30] hover:bg-[#122e24] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
             >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span>Consultar</span>
             </button>
        </div>
      </div>

       {/* KPI BANNERS */}
       {data.length > 0 && (
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs text-gray-400 uppercase font-bold">Total Registros</p>
                    <p className="text-2xl font-bold text-gray-800">{filteredData.length}</p>
                </div>
                <div className="bg-gray-100 p-2 rounded-lg"><Filter className="h-5 w-5 text-gray-500" /></div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs text-gray-400 uppercase font-bold">Total Entradas</p>
                    <p className="text-2xl font-bold text-green-600">+{totalIn.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 p-2 rounded-lg"><TrendingUp className="h-5 w-5 text-green-600" /></div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs text-gray-400 uppercase font-bold">Total Salidas</p>
                    <p className="text-2xl font-bold text-red-600">-{totalOut.toLocaleString()}</p>
                </div>
                <div className="bg-red-50 p-2 rounded-lg"><TrendingDown className="h-5 w-5 text-red-600" /></div>
            </div>
            
            {/* Search within results */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Filtrar resultados..." 
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-900/10 outline-none"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
         </div>
       )}

      {/* DATA TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
        {data.length > 0 ? (
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-sm text-left relative">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50/80 backdrop-blur sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-medium">Fecha</th>
                    <th className="px-6 py-4 font-medium">Documento</th>
                    <th className="px-6 py-4 font-medium">Empresa</th>
                    <th className="px-6 py-4 font-medium">Producto</th>
                    <th className="px-6 py-4 font-medium text-right">Cant.</th>
                    <th className="px-6 py-4 font-medium text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                   {filteredData.map((item, idx) => ( 
                       <tr key={idx} className="hover:bg-gray-50 transition-colors">
                         <td className="px-6 py-3 font-mono text-xs text-gray-500">{item.date}</td>
                         <td className="px-6 py-3 text-gray-800 font-medium">
                            <div className="flex flex-col">
                                <span>{item.doc_name}</span>
                                <span className="text-[10px] text-gray-400">{item.doc_number}</span>
                            </div>
                         </td>
                         <td className="px-6 py-3 text-gray-600 text-xs">{item.company}</td>
                         <td className="px-6 py-3">
                            <div className="flex flex-col">
                                <span className="text-gray-800 font-medium truncate max-w-[200px]" title={item.description}>{item.description}</span>
                                <span className="text-xs text-gray-400 font-mono">{item.product_code}</span>
                            </div>
                         </td>
                         <td className={`px-6 py-3 text-right font-bold ${item.type === "Entrada" ? "text-green-600" : "text-red-600"}`}>
                            {item.quantity}
                         </td>
                         <td className="px-6 py-3 text-right text-gray-500 font-mono text-xs">
                            {item.balance ? item.balance.toLocaleString() : "-"}
                         </td>
                       </tr>
                   ))}
                </tbody>
              </table>
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                {isLoading ? (
                    <>
                        <Loader2 className="h-10 w-10 animate-spin mb-4 text-[#183C30]" />
                        <p>Consultando API Siigo...</p>
                        <p className="text-xs mt-2 text-gray-300">Esto conecta con las empresas activas</p>
                    </>
                ) : (
                    <>
                        <Calendar className="h-12 w-12 mb-4 opacity-20" />
                        <p>{searched ? "No se encontraron movimientos." : "Selecciona fechas y consulta."}</p>
                    </>
                )}
            </div>
        )}
      </div>
    </div>
  );
}

