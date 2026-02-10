"use strict";
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Filter, Search, Download, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useMovements, Movement } from "@/hooks/useMovements";

export default function MovementsPage() {
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [auditMode, setAuditMode] = useState(false);

  // Convert Dates to YYYY-MM-DD
  const sStr = startDate ? format(startDate, "yyyy-MM-dd") : "";
  const eStr = endDate ? format(endDate, "yyyy-MM-dd") : "";

  const { data, isLoading, isError, refetch } = useMovements(
    sStr,
    eStr,
    selectedCompany === "all" ? [] : [selectedCompany]
  );

  const movements = data?.data || [];

  // Filter Logic
  const filteredData = movements.filter((m) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      m.doc_number?.toLowerCase().includes(term) ||
      m.client?.toLowerCase().includes(term) ||
      m.code?.toLowerCase().includes(term) ||
      m.name?.toLowerCase().includes(term) ||
      m.company?.toLowerCase().includes(term);

    if (selectedCompany !== "all" && m.company !== selectedCompany) return false;

    return matchesSearch;
  });

  // Unique Companies
  const companies = Array.from(new Set(movements.map(m => m.company).filter(Boolean)));

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
    link.setAttribute("download", `Movimientos_${sStr}_${eStr}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Auditoría de Movimientos</h1>
          <p className="text-gray-500">
            Consulte y audite todos los movimientos (FC, FV, etc.) con detalle extendido.
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
        <CardHeader className="pb-3">
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
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
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
                  <TableHead>Cant</TableHead>
                  <TableHead>Total</TableHead>
                  {auditMode && (
                    <>
                      <TableHead className="bg-orange-50 text-orange-900">C. Costos</TableHead>
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
                  <TableRow><TableCell colSpan={12} className="h-24 text-center">Cargando movimientos...</TableCell></TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="h-24 text-center">No se encontraron movimientos.</TableCell></TableRow>
                ) : (
                  filteredData.slice(0, 100).map((row, i) => (
                    <TableRow key={i} className="hover:bg-muted/50">
                      <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.company}</TableCell>
                      <TableCell><span className={cn("px-2 py-1 rounded text-xs font-bold", row.doc_type === "FV" ? "bg-green-100 text-green-800" : row.doc_type === "FC" ? "bg-blue-100 text-blue-800" : "bg-gray-100")}>{row.doc_type}</span></TableCell>
                      <TableCell className="font-mono text-xs">{row.doc_number}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate" title={row.client}>{row.client}</TableCell>
                      <TableCell className="font-mono text-xs">{row.code}</TableCell>
                      <TableCell className="text-xs max-w-[250px] truncate" title={row.name}>{row.name}</TableCell>
                      <TableCell className={cn("font-bold text-right", row.type === "ENTRADA" ? "text-green-600" : "text-red-600")}>
                        {row.type === "ENTRADA" ? "+" : "-"}{row.quantity}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        ${row.total.toLocaleString()}
                      </TableCell>
                      {auditMode && (
                        <>
                          <TableCell className="text-xs bg-orange-50/50">{row.cost_center}</TableCell>
                          <TableCell className="text-xs bg-orange-50/50">{row.seller}</TableCell>
                          <TableCell className="text-xs bg-orange-50/50 max-w-[100px] truncate" title={row.payment_forms}>{row.payment_forms}</TableCell>
                          <TableCell className="text-xs bg-orange-50/50 max-w-[100px] truncate" title={row.taxes}>{row.taxes}</TableCell>
                          <TableCell className="text-xs bg-orange-50/50 max-w-[100px] truncate" title={row.created_by}>{row.created_by?.split('@')[0]}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="pt-4 text-xs text-muted-foreground text-center">
            Mostrando {Math.min(100, filteredData.length)} de {filteredData.length} registros. (Use Exportar para ver todo)
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
