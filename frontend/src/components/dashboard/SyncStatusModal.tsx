"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";

interface SyncStatus {
    company: string;
    min_date: string;
    max_date: string;
    count: number;
}

export function SyncStatusModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState<SyncStatus[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchStatus = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem("gco_token");
            const res = await axios.get(`${API_URL}/movements/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setData(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchStatus();
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs text-gray-500 h-8 ml-1">
                    Ver Estado
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Auditoría de Datos por Empresa</DialogTitle>
                </DialogHeader>

                <div className="max-h-[60vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Empresa</TableHead>
                                    <TableHead>Desde</TableHead>
                                    <TableHead>Hasta</TableHead>
                                    <TableHead>Registros</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((row) => {
                                    const minYear = parseInt(row.min_date.split("-")[0]);
                                    const isComplete = minYear <= 2020 && row.count > 1000; // Heuristic

                                    return (
                                        <TableRow key={row.company}>
                                            <TableCell className="font-medium text-xs">{row.company}</TableCell>
                                            <TableCell className="text-xs">{row.min_date}</TableCell>
                                            <TableCell className="text-xs">{row.max_date}</TableCell>
                                            <TableCell className="text-xs">{row.count.toLocaleString()}</TableCell>
                                            <TableCell>
                                                {isComplete ? (
                                                    <span className="flex items-center text-green-600 text-xs gap-1">
                                                        <CheckCircle className="h-3 w-3" /> OK
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center text-amber-600 text-xs gap-1">
                                                        <AlertTriangle className="h-3 w-3" /> Incompleto
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
