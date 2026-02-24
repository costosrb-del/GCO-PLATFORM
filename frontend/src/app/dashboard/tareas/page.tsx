"use client";

import { useState } from "react";
import { useTasks, Task } from "@/hooks/useTasks";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Plus, Trash2, Edit2, Calendar, User, Flag, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";

export default function TareasPage() {
    const { tasks, isLoading, createTask, updateTask, deleteTask } = useTasks();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [formData, setFormData] = useState<Partial<Task>>({
        title: "",
        description: "",
        assigned_to: "",
        priority: "Media",
        due_date: "",
        status: "Pendiente"
    });

    const handleOpenDialog = (task?: Task) => {
        if (task) {
            setEditingTask(task);
            setFormData(task);
        } else {
            setEditingTask(null);
            setFormData({
                title: "",
                description: "",
                assigned_to: "",
                priority: "Media",
                due_date: "",
                status: "Pendiente"
            });
        }
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.title) return;

        if (editingTask) {
            await updateTask(editingTask.id, formData);
        } else {
            await createTask(formData);
        }
        setIsDialogOpen(false);
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "Alta": return "text-red-600 bg-red-100";
            case "Baja": return "text-green-600 bg-green-100";
            default: return "text-yellow-600 bg-yellow-100";
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Completada": return "text-green-600";
            case "En Progreso": return "text-blue-600";
            default: return "text-gray-500";
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Gestor de Tareas</h1>
                    <p className="text-gray-500">
                        Administra proyectos, recordatorios y delega responsabilidades.
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => handleOpenDialog()} className="bg-[#183C30] hover:bg-[#122e24]">
                            <Plus className="mr-2 h-4 w-4" /> Nueva Tarea
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingTask ? "Editar Tarea" : "Nueva Tarea / Recordatorio"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500">Título</label>
                                <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Ej. Revisar inventario físico" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500">Descripción / Detalles</label>
                                <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Detalles de la tarea..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Asignada / Delegada a</label>
                                    <Select value={formData.assigned_to} onValueChange={v => setFormData({ ...formData, assigned_to: v })}>
                                        <SelectTrigger><SelectValue placeholder="Usuario" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Mismo">Mismo</SelectItem>
                                            <SelectItem value="Asesora">Asesora</SelectItem>
                                            <SelectItem value="Logistica">Logística</SelectItem>
                                            <SelectItem value="Administracion">Administración</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Prioridad</label>
                                    <Select value={formData.priority} onValueChange={v => setFormData({ ...formData, priority: v })}>
                                        <SelectTrigger><SelectValue placeholder="Prioridad" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Baja">Baja</SelectItem>
                                            <SelectItem value="Media">Media</SelectItem>
                                            <SelectItem value="Alta">Alta</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Fecha Límite</label>
                                    <Input type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500">Estado</label>
                                    <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                                        <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Pendiente">Pendiente</SelectItem>
                                            <SelectItem value="En Progreso">En Progreso</SelectItem>
                                            <SelectItem value="Completada">Completada</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button className="w-full mt-4 bg-[#183C30] hover:bg-[#122e24]" onClick={handleSave} disabled={!formData.title}>
                                {editingTask ? "Guardar Cambios" : "Crear Tarea"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Kanban style columns */}
                {["Pendiente", "En Progreso", "Completada"].map(statusGroup => (
                    <div key={statusGroup} className="bg-gray-50 rounded-xl p-4 min-h-[500px]">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center justify-between">
                            {statusGroup}
                            <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">
                                {tasks.filter(t => t.status === statusGroup).length}
                            </span>
                        </h3>

                        <div className="space-y-4">
                            {isLoading ? (
                                <p className="text-sm text-center text-gray-400 py-10">Cargando...</p>
                            ) : tasks.filter(t => t.status === statusGroup).map(task => (
                                <Card key={task.id} className="hover:shadow-md transition-shadow">
                                    <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between">
                                        <div>
                                            <h4 className={`font-semibold text-sm ${task.status === "Completada" ? "line-through text-gray-400" : "text-gray-900"}`}>
                                                {task.title}
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-0">
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {task.priority && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${getPriorityColor(task.priority)}`}>
                                                    <Flag className="w-3 h-3" /> {task.priority}
                                                </span>
                                            )}
                                            {task.due_date && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" /> {format(new Date(task.due_date), "MMM d")}
                                                </span>
                                            )}
                                            {task.assigned_to && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-700 flex items-center gap-1">
                                                    <User className="w-3 h-3" /> {task.assigned_to}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-blue-600" onClick={() => handleOpenDialog(task)}>
                                                <Edit2 className="w-3 h-3" />
                                            </Button>
                                            {task.status !== "Completada" && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-green-600" onClick={() => updateTask(task.id, { status: "Completada" })}>
                                                    <CheckCircle className="w-3 h-3" />
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-600" onClick={() => deleteTask(task.id)}>
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {tasks.filter(t => t.status === statusGroup).length === 0 && !isLoading && (
                                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center text-sm text-gray-400">
                                    Sin tareas
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
