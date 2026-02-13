"use strict";
"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Filter, Search, Download, Eye, EyeOff, AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GCOProgress } from "@/components/ui/GCOProgress";
import { GCOError } from "@/components/ui/GCOError";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useMovements } from "@/hooks/useMovements";

const LOADING_STEPS = [
  "Validando credenciales y acceso a Siigo...",
  "Consultando caché local de movimientos...",
  "Identificando vacíos de información (Holes)...",
  "Descargando datos faltantes desde la nube...",
  "Consolidando y auditando miles de registros...",
  "Finalizando reporte..."
];

export default function MovementsPage() {
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [auditMode, setAuditMode] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  // Active Params State (only updated on "Consultar" click)
  const [activeParams, setActiveParams] = useState<{ start: string, end: string, company: string } | null>(null);

  const { data, isLoading, isError } = useMovements(
    activeParams?.start || "",
    activeParams?.end || "",
    activeParams?.company === "all" ? [] : [activeParams?.company || ""],
    refreshCount
  );

  // Loading Step Simulation
  useEffect(() => {
    let interval: any;
    if (isLoading) {
      setCurrentStep(0);
      interval = setInterval(() => {
        setCurrentStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 3500);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleConsultar = () => {
    setActiveParams({
      start: format(startDate, "yyyy-MM-dd"),
      end: format(endDate, "yyyy-MM-dd"),
      company: selectedCompany
    });
    setRefreshCount(prev => prev + 1);
  };

  const movements = data?.data || [];

  // Filter Logic
  const filteredData = movements.filter((m) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      m.doc_number?.toLowerCase().includes(term) ||
      m.client?.toLowerCase().includes(term) ||
      m.nit?.toLowerCase().includes(term) ||
      m.code?.toLowerCase().includes(term) ||
      m.name?.toLowerCase().includes(term) ||
      m.company?.toLowerCase().includes(term);

    if (selectedCompany !== "all" && m.company !== selectedCompany) return false;

    return matchesSearch;
  });

  // Unique Companies
  const companies = Array.from(new Set(movements.map(m => m.company).filter(Boolean))) as string[];

  const handleExport = () => {
    if (!filteredData.length) return;

    const headers = [
      "Fecha", "Empresa", "Tipo", "Documento", "Tercero", "NIT",
      "SKU", "Producto", "Bodega", "Cantidad", "Precio Unit", "Total Linea",
      "Obs",
      // Audit
      "Centro Costos", "Vendedor", "Formas Pago", "Impuestos",
      "Creado Por", "Creado En", "Total Doc"
    ];

    const csvContent = [
      headers.join(","),
      ...filteredData.map(row => [
        row.date,
        `"${row.company || ''}"`,
        row.type,
        row.doc_number,
        `"${row.client || ''}"`,
        row.nit,
        row.code,
        `"${row.name.replace(/"/g, '""')}"`,
        row.warehouse,
        row.quantity,
        row.price,
        row.total,
        `"${(row.observations || '').replace(/"/g, '""')}"`,
        // Audit
        `"${row.cost_center || ''}"`,
        `"${row.seller || ''}"`,
        `"${row.payment_forms || ''}"`,
        `"${(row.taxes || '').replace(/"/g, '""')}"`,
        row.created_by || '',
        row.created_at || '',
        row.doc_total_value || ''
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Movimientos_${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Consulta de Movimientos</h1>
          <p className="text-gray-500">
            Obtenga información consolidada de todas las empresas y documentos (FV, FC) con un solo clic.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={auditMode ? "default" : "outline"}
            onClick={() => setAuditMode(!auditMode)}
            className="gap-2"
          >
            {auditMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {auditMode ? "Modo Auditoría ACTIVO" : "Activar Auditoría"}
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={!filteredData.length}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex flex-wrap gap-4 items-center">
              {/* Date Filters */}
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PP", { locale: es }) : "Desde"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus /></PopoverContent>
                </Popover>
                <span className="text-gray-400">-</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PP", { locale: es }) : "Hasta"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus /></PopoverContent>
                </Popover>

                <Button
                  onClick={handleConsultar}
                  disabled={isLoading}
                  className="bg-[#183C30] hover:bg-[#122e24] text-white min-w-[120px]"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Consolidando...</span>
                    </div>
                  ) : (
                    "Consultar"
                  )}
                </Button>
              </div>

              {/* Company Filter */}
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todas las Empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Empresas</SelectItem>
                  {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="relative w-full md:w-[300px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por documento, SKU, cliente..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Doc</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Tercero</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="min-w-[200px]">Producto</TableHead>
                  <TableHead className="text-right">Cant</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {auditMode && (
                    <>
                      <TableHead className="bg-orange-50 text-orange-900 border-l">C. Costos</TableHead>
                      <TableHead className="bg-orange-50 text-orange-900">Vendedor</TableHead>
                      <TableHead className="bg-orange-50 text-orange-900">Pago</TableHead>
                      <TableHead className="bg-orange-50 text-orange-900">Impuestos</TableHead>
                      <TableHead className="bg-orange-50 text-orange-900">Usuario</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={auditMode ? 14 : 9} className="py-20">
                      <GCOProgress
                        progress={((currentStep + 1) / LOADING_STEPS.length) * 100}
                        message={LOADING_STEPS[currentStep]}
                        submessage="Estamos consolidando la información de todas tus empresas. Si el período es largo, este proceso sincroniza automáticamente los datos faltantes."
                      />
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={auditMode ? 14 : 9} className="py-12 px-6">
                      <GCOError
                        message="Error al consultar movimientos"
                        details="No se pudo establecer conexión con el servidor o las credenciales han expirado."
                        onRetry={handleConsultar}
                      />
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={auditMode ? 14 : 9} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400 gap-4 p-8">
                        <div className="bg-gray-50 p-4 rounded-full">
                          <Search className="h-12 w-12 opacity-40 text-gray-300" />
                        </div>
                        <div>
                          <p className="font-bold text-xl text-gray-600">No se encontraron movimientos</p>
                          <p className="text-sm text-gray-400 max-w-md mx-auto mt-1">
                            {data?.errors?.length
                              ? "El proceso terminó con errores que impidieron obtener los datos. Verifique la conexión con Siigo."
                              : "No hay registros que coincidan con los filtros seleccionados en este rango de fechas."}
                          </p>
                        </div>
                        {data?.errors && data.errors.length > 0 && (
                          <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-left max-w-lg mt-2">
                            <p className="text-xs font-bold text-red-600 uppercase mb-2">Errores detectados:</p>
                            <ul className="list-disc list-inside text-[10px] text-red-500 space-y-1">
                              {data.errors.map((e: string, idx: number) => <li key={idx}>{e}</li>)}
                            </ul>
                          </div>
                        )}
                        <Button variant="outline" size="sm" onClick={handleConsultar} className="mt-2">
                          <RefreshCcw className="h-3 w-3 mr-2" /> Reintentar Consulta
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.slice(0, 100).map((row, i) => (
                    <TableRow key={i} className="hover:bg-muted/50 border-b">
                      <TableCell className="whitespace-nowrap text-xs">{row.date}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground uppercase">{row.company}</TableCell>
                      <TableCell><span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", row.doc_type === "FV" ? "bg-green-100 text-green-800" : row.doc_type === "FC" ? "bg-blue-100 text-blue-800" : "bg-gray-100")}>{row.doc_type}</span></TableCell>
                      <TableCell className="font-mono text-[10px]">{row.doc_number}</TableCell>
                      <TableCell className="text-[10px] max-w-[150px] truncate" title={row.client}>
                        <div className="font-medium text-gray-900">{row.client}</div>
                        {row.nit && row.nit !== "N/A" && <div className="text-[9px] text-gray-400 font-mono">{row.nit}</div>}
                      </TableCell>
                      <TableCell className="font-mono text-[10px]">{row.code}</TableCell>
                      <TableCell className="text-[10px] max-w-[250px] truncate" title={row.name}>{row.name}</TableCell>
                      <TableCell className={cn("font-bold text-right text-xs", row.type === "ENTRADA" ? "text-green-600" : "text-red-600")}>
                        {row.type === "ENTRADA" ? "+" : "-"}{row.quantity}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        ${row.total.toLocaleString()}
                      </TableCell>
                      {auditMode && (
                        <>
                          <TableCell className="text-[10px] bg-orange-50/50 border-l">{row.cost_center}</TableCell>
                          <TableCell className="text-[10px] bg-orange-50/50">{row.seller}</TableCell>
                          <TableCell className="text-[10px] bg-orange-50/50 max-w-[100px] truncate" title={row.payment_forms}>{row.payment_forms}</TableCell>
                          <TableCell className="text-[10px] bg-orange-50/50 max-w-[100px] truncate" title={row.taxes}>{row.taxes}</TableCell>
                          <TableCell className="text-[10px] bg-orange-50/50 max-w-[100px] truncate" title={row.created_by}>{row.created_by?.split('@')[0]}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 text-xs text-muted-foreground text-center border-t">
            {filteredData.length > 0 && `Mostrando ${Math.min(100, filteredData.length)} de ${filteredData.length} registros.`}
            {filteredData.length > 100 && ' Use "Exportar CSV" para ver el detalle completo.'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
