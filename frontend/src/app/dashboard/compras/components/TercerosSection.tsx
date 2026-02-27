import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Building2, Edit2, Trash2 } from "lucide-react";
import { Tercero, Insumo } from "@/hooks/useCompras";

interface TercerosSectionProps {
    terceros: Tercero[];
    insumos: Insumo[];
    createTercero: (t: Partial<Tercero>) => Promise<boolean>;
    updateTercero: (id: string, t: Partial<Tercero>) => Promise<boolean>;
    deleteTercero: (id: string) => Promise<boolean>;
}

export const TercerosSection = ({ terceros, insumos, createTercero, updateTercero, deleteTercero }: TercerosSectionProps) => {
    const [isTerceroDialogOpen, setIsTerceroDialogOpen] = useState(false);
    const [searchTerceros, setSearchTerceros] = useState("");
    const [terceroForm, setTerceroForm] = useState<Partial<Tercero>>({
        nombre: "", nit: "", correo: "", personaContacto: "", numeroContacto: "", insumos: ""
    });

    const handleSaveTercero = async () => {
        if (!terceroForm.nombre || !terceroForm.nit) return;
        if (terceroForm.id) {
            await updateTercero(terceroForm.id, terceroForm);
        } else {
            await createTercero(terceroForm);
        }
        setTerceroForm({ nombre: "", nit: "", correo: "", personaContacto: "", numeroContacto: "", insumos: "" });
        setIsTerceroDialogOpen(false);
    };

    const editTercero = (t: Tercero) => {
        setTerceroForm({ ...t });
        setIsTerceroDialogOpen(true);
    };

    const filteredTerceros = terceros.filter(t =>
        t.nombre.toLowerCase().includes(searchTerceros.toLowerCase()) ||
        t.nit.toLowerCase().includes(searchTerceros.toLowerCase()) ||
        (t.insumos || "").toLowerCase().includes(searchTerceros.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                    Base de Datos de Terceros
                </h2>
                <div className="flex w-full md:w-auto items-center gap-3">
                    <Input
                        className="max-w-xs bg-white rounded-xl shadow-sm border-gray-100 placeholder:text-gray-400"
                        placeholder="Buscar por Nombre, NIT o Insumos..."
                        value={searchTerceros}
                        onChange={(e) => setSearchTerceros(e.target.value)}
                    />
                    <Dialog open={isTerceroDialogOpen} onOpenChange={setIsTerceroDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md">
                                <Plus className="w-4 h-4 mr-2" />
                                Nuevo Proveedor
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[450px]">
                            <DialogHeader>
                                <DialogTitle>Registrar Tercero / Proveedor</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600">Nombre o Razón Social</label>
                                    <Input value={terceroForm.nombre} onChange={e => setTerceroForm({ ...terceroForm, nombre: e.target.value })} placeholder="Ej. Distribuidora S.A" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600">NIT o Documento</label>
                                    <Input value={terceroForm.nit} onChange={e => setTerceroForm({ ...terceroForm, nit: e.target.value })} placeholder="Ej. 900.123.456-7" />
                                </div>
                                <div className="flex gap-4">
                                    <div className="space-y-1 flex-1">
                                        <label className="text-xs font-semibold text-gray-600">Persona de Contacto</label>
                                        <Input value={terceroForm.personaContacto} onChange={e => setTerceroForm({ ...terceroForm, personaContacto: e.target.value })} placeholder="Nombre" />
                                    </div>
                                    <div className="space-y-1 flex-1">
                                        <label className="text-xs font-semibold text-gray-600">Número</label>
                                        <Input value={terceroForm.numeroContacto} onChange={e => setTerceroForm({ ...terceroForm, numeroContacto: e.target.value })} placeholder="Teléfono" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600">Correo Electrónico</label>
                                    <Input type="email" value={terceroForm.correo} onChange={e => setTerceroForm({ ...terceroForm, correo: e.target.value })} placeholder="contacto@empresa.com" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-600">¿Qué insumos vende?</label>
                                    <div className="flex flex-col gap-2">
                                        <div className="max-h-32 overflow-y-auto border border-gray-100 rounded-lg p-2 bg-gray-50 flex flex-wrap gap-2">
                                            {insumos.map(i => {
                                                const isSelected = terceroForm.insumos?.toLowerCase().includes(`[${i.sku}]`);
                                                return (
                                                    <div
                                                        key={i.id}
                                                        onClick={() => {
                                                            const currentVal = terceroForm.insumos || "";
                                                            if (isSelected) {
                                                                setTerceroForm({ ...terceroForm, insumos: currentVal.replace(`[${i.sku}] ${i.nombre}, `, "") });
                                                            } else {
                                                                setTerceroForm({ ...terceroForm, insumos: currentVal + `[${i.sku}] ${i.nombre}, ` });
                                                            }
                                                        }}
                                                        className={`px-3 py-1 cursor-pointer text-[10px] sm:text-xs rounded-full border transition-all ${isSelected ? 'bg-indigo-100 border-indigo-200 text-indigo-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                                                    >
                                                        {i.sku} - {i.nombre}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <Input value={terceroForm.insumos} onChange={e => setTerceroForm({ ...terceroForm, insumos: e.target.value })} placeholder="Seleccione arriba o escriba manualmente..." className="text-sm" />
                                    </div>
                                </div>
                                <Button onClick={handleSaveTercero} className="mt-4 bg-[#183C30] hover:bg-[#122e24]">Guardar Proveedor</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-[2fr_1.5fr_1.5fr_2fr_auto] p-4 bg-gray-50/80 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
                    <div>Proveedor</div>
                    <div>Contacto</div>
                    <div>Teléfono</div>
                    <div>Insumos Autorizados</div>
                    <div className="w-[80px] text-center">Acciones</div>
                </div>
                <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                    {filteredTerceros.map(t => (
                        <div key={t.id} className="grid grid-cols-[2fr_1.5fr_1.5fr_2fr_auto] p-4 items-center hover:bg-slate-50 transition-colors group">
                            <div>
                                <p className="font-semibold text-gray-800 text-sm">{t.nombre}</p>
                                <p className="text-xs text-gray-500 font-medium font-mono">NIT: {t.nit}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-700 truncate">{t.personaContacto}</p>
                                <p className="text-xs text-gray-500 truncate">{t.correo}</p>
                            </div>
                            <div className="text-sm text-gray-700">
                                {t.numeroContacto}
                            </div>
                            <div>
                                <p className="text-xs text-gray-600 max-w-[200px] truncate" title={t.insumos}>{t.insumos}</p>
                            </div>
                            <div className="w-[80px] flex justify-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => editTercero(t)} className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteTercero(t.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {filteredTerceros.length === 0 && (
                        <div className="p-10 text-center text-gray-500">
                            No hay proveedores que coincidan con la búsqueda.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
