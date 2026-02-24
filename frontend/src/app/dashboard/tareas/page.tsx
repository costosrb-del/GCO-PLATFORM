"use client";

import { useState, useMemo } from "react";
import { useTasks, Task, TaskHistoryEntry, TaskSubtask } from "@/hooks/useTasks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
    Plus, Trash2, Edit2, Calendar as CalendarIcon, User, Flag, CheckCircle,
    Search, Clock, AlertCircle, PlayCircle, Columns, CalendarDays, LineChart,
    XCircle, MessageSquare, History, AlignLeft, ArrowDownAZ, ListTodo, Paperclip,
    Tags, Video, Repeat
} from "lucide-react";
import {
    format, isPast, isToday, formatDistanceToNow, addDays,
    differenceInHours, differenceInDays, differenceInMinutes,
    startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay
} from "date-fns";
import { es } from "date-fns/locale";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { GCOProgress } from "@/components/ui/GCOProgress";

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
        status: "Pendiente",
        meeting_link: "",
        recurrence: "none",
        tags: [],
        subtasks: []
    });

    // Estados internos del modal para checks y  tags
    const [newComment, setNewComment] = useState("");
    const [newSubtask, setNewSubtask] = useState("");
    const [newTag, setNewTag] = useState("");

    // Pestañas Activas
    const [activeTab, setActiveTab] = useState<"tablero" | "calendario" | "metricas">("tablero");

    // Filtros & Ordenamiento
    const [searchQuery, setSearchQuery] = useState("");
    const [filterPriority, setFilterPriority] = useState<string>("Todas");
    const [filterAssignee, setFilterAssignee] = useState<string>("Todos");
    const [sortBy, setSortBy] = useState<"fecha_creacion" | "vencimiento" | "prioridad">("fecha_creacion");

    // Estado del Drag & Drop
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

    // Ocultar completadas
    const [showCompletedColumn, setShowCompletedColumn] = useState(true);

    // Filtros Histórico
    const [historyDate, setHistoryDate] = useState<string>("");

    const handleOpenDialog = (task?: Task) => {
        if (task) {
            setEditingTask(task);
            setFormData({
                title: task.title,
                description: task.description,
                assigned_to: task.assigned_to,
                priority: task.priority,
                due_date: task.due_date,
                status: task.status,
                history: task.history || [],
                tags: task.tags || [],
                subtasks: task.subtasks || [],
                meeting_link: task.meeting_link || "",
                recurrence: task.recurrence || "none",
            });
        } else {
            setEditingTask(null);
            setFormData({
                title: "",
                description: "",
                assigned_to: "",
                priority: "Media",
                due_date: format(new Date(), 'yyyy-MM-dd'),
                status: "Pendiente",
                history: [],
                tags: [],
                subtasks: [],
                meeting_link: "",
                recurrence: "none",
            });
        }
        setNewComment("");
        setNewSubtask("");
        setNewTag("");
        setIsDialogOpen(true);
    };

    const handleAddComment = () => {
        if (!newComment.trim() || !editingTask) return;

        const newEntry: TaskHistoryEntry = {
            date: new Date().toISOString(),
            action: "Comentario/Justificación agregada",
            user: "Usuario",
            comment: newComment.trim()
        };

        const updatedHistory = [...(formData.history || []), newEntry];
        setFormData({ ...formData, history: updatedHistory });
        setNewComment("");
    };

    const handleAddSubtask = () => {
        if (!newSubtask.trim()) return;
        const newEntry: TaskSubtask = {
            id: Math.random().toString(36).substr(2, 9),
            title: newSubtask.trim(),
            completed: false
        };
        setFormData({ ...formData, subtasks: [...(formData.subtasks || []), newEntry] });
        setNewSubtask("");
    };

    const toggleSubtask = (id: string) => {
        const updated = (formData.subtasks || []).map(st =>
            st.id === id ? { ...st, completed: !st.completed } : st
        );
        setFormData({ ...formData, subtasks: updated });
    };

    const deleteSubtask = (id: string) => {
        const updated = (formData.subtasks || []).filter(st => st.id !== id);
        setFormData({ ...formData, subtasks: updated });
    };

    const handleAddTag = (e?: React.KeyboardEvent | React.FocusEvent) => {
        if (e && 'key' in e && e.key !== 'Enter' && e.key !== ',') return;
        if (e && 'key' in e && e.key === ',') e.preventDefault();

        if (!newTag.trim()) return;
        const tag = newTag.trim().toUpperCase();
        if (!(formData.tags || []).includes(tag)) {
            setFormData({ ...formData, tags: [...(formData.tags || []), tag] });
        }
        setNewTag("");
    };

    const removeTag = (tag: string) => {
        setFormData({ ...formData, tags: (formData.tags || []).filter(t => t !== tag) });
    };

    const handleSave = async () => {
        if (!formData.title) return;

        const payload = { ...formData };
        const currentHistory = formData.history || [];

        if (editingTask && editingTask.status !== formData.status) {
            currentHistory.push({
                date: new Date().toISOString(),
                action: `Estado cambiado a: ${formData.status}`,
                user: "Usuario",
            });
            payload.history = currentHistory;
        }

        if (payload.status === "Completada" && (!editingTask || editingTask.status !== "Completada")) {
            payload.completed_at = new Date().toISOString();
        }

        if (editingTask) {
            await updateTask(editingTask.id, payload);
        } else {
            payload.history = [{
                date: new Date().toISOString(),
                action: "Tarea creada",
                user: "Usuario"
            }];
            await createTask(payload);
        }
        setIsDialogOpen(false);
    };

    // Funciones Drag & Drop
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedTaskId(id);
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => {
            const el = document.getElementById(`task-${id}`);
            if (el) el.style.opacity = '0.5';
        }, 0);
    };

    const handleDragEnd = (e: React.DragEvent, id: string) => {
        setDraggedTaskId(null);
        const el = document.getElementById(`task-${id}`);
        if (el) el.style.opacity = '1';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        if (!draggedTaskId) return;

        const task = tasks.find(t => t.id === draggedTaskId);
        if (task && task.status !== newStatus) {
            const logEntry: TaskHistoryEntry = {
                date: new Date().toISOString(),
                action: `Movida a: ${newStatus}`,
                user: "Usuario"
            };

            const updates: Partial<Task> = {
                status: newStatus,
                history: [...(task.history || []), logEntry]
            };

            if (newStatus === "Completada") {
                updates.completed_at = new Date().toISOString();
            }
            await updateTask(draggedTaskId, updates);
        }
        setDraggedTaskId(null);
    };

    // Filtrar y Ordenar
    const filteredTasks = useMemo(() => {
        let result = tasks.filter(task => {
            const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (task.tags && task.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
            const matchesPriority = filterPriority === "Todas" || task.priority === filterPriority;
            const matchesAssignee = filterAssignee === "Todos" || task.assigned_to === filterAssignee;

            return matchesSearch && matchesPriority && matchesAssignee;
        });

        result.sort((a, b) => {
            if (sortBy === "vencimiento") {
                if (!a.due_date && b.due_date) return 1;
                if (a.due_date && !b.due_date) return -1;
                return (new Date(a.due_date || 0).getTime()) - (new Date(b.due_date || 0).getTime());
            } else if (sortBy === "prioridad") {
                const pValue = { "Alta": 3, "Media": 2, "Baja": 1 };
                const valA = pValue[a.priority as keyof typeof pValue] || 0;
                const valB = pValue[b.priority as keyof typeof pValue] || 0;
                return valB - valA;
            } else {
                return (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime());
            }
        });

        return result;
    }, [tasks, searchQuery, filterPriority, filterAssignee, sortBy]);

    // Helpers Calendario/Recurrencia
    const isRecurringOn = (task: Task, targetDate: Date) => {
        if (!task.due_date) return false;
        try {
            const taskDate = new Date(task.due_date + 'T00:00:00');
            if (isSameDay(taskDate, targetDate)) return true;
            if (targetDate < taskDate) return false; // Evento no comienza aún

            const recur = task.recurrence || "none";
            if (recur === "daily") return true;
            if (recur === "weekly") return getDay(taskDate) === getDay(targetDate);
            if (recur === "monthly") return taskDate.getDate() === targetDate.getDate();
        } catch { return false; }
        return false;
    };

    const getDaysInMonth = () => {
        const today = new Date();
        return eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) });
    };

    const calendarDays = useMemo(() => getDaysInMonth(), [tasks]); // Recalcular seguro
    const firstDayOfMonth = getDay(calendarDays[0]);

    // UI Helpers
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "Alta": return "text-red-700 bg-red-100 border-red-200";
            case "Baja": return "text-green-700 bg-green-100 border-green-200";
            default: return "text-yellow-700 bg-yellow-100 border-yellow-200";
        }
    };

    const getTimeStatus = (dateString?: string, status?: string) => {
        if (!dateString || status === "Completada" || status === "Cancelada") return null;
        try {
            const date = new Date(dateString + 'T00:00:00');
            if (isToday(date)) return { text: "Vence hoy", color: "text-amber-700 bg-amber-100 border border-amber-200", icon: <Clock className="w-3 h-3" /> };
            if (isPast(addDays(date, 1))) return { text: "Vencida", color: "text-red-700 bg-red-100 border border-red-200", icon: <AlertCircle className="w-3 h-3" /> };
            return {
                text: `Vence en ${formatDistanceToNow(date, { locale: es })}`,
                color: "text-blue-700 bg-blue-50 border border-blue-100",
                icon: <Clock className="w-3 h-3" />
            };
        } catch { return null; }
    };

    const getSubtaskProgress = (subtasks?: TaskSubtask[]) => {
        if (!subtasks || subtasks.length === 0) return null;
        const total = subtasks.length;
        const completed = subtasks.filter(s => s.completed).length;
        return { total, completed, percentage: Math.round((completed / total) * 100) };
    };

    const calculateTaskDuration = (start?: string, end?: string) => {
        if (!start || !end) return "N/A";
        const startDate = new Date(start);
        const endDate = new Date(end);
        const hours = differenceInHours(endDate, startDate);
        if (hours < 24) {
            const mins = differenceInMinutes(endDate, startDate);
            return hours === 0 ? `${mins} min` : `${hours}h ${mins % 60}m`;
        }
        return `${differenceInDays(endDate, startDate)} días`;
    };

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto bg-gray-50/50 min-h-screen">
            {/* Header Principal */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Workspace de Operaciones</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Controla procesos, etiquetas, agendas recurrentes y mide demoras en un solo lugar.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => handleOpenDialog()} className="bg-[#183C30] hover:bg-[#122e24] shadow-md shadow-[#183C30]/20 transition-all active:scale-95 px-6">
                                <Plus className="mr-2 h-4 w-4" /> Crear Nuevo
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[800px] bg-gray-50 max-h-[90vh] overflow-y-auto w-[90vw]">
                            <DialogHeader>
                                <DialogTitle className="text-xl flex items-center justify-between">
                                    <span>{editingTask ? "Detalles de Operación" : "Nuevo Proceso / Cita"}</span>
                                    {editingTask && (
                                        <span className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-widest font-bold ${editingTask.status === 'Completada' ? 'bg-green-100 text-green-700' : editingTask.status === 'Cancelada' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {editingTask.status}
                                        </span>
                                    )}
                                </DialogTitle>
                            </DialogHeader>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                {/* Columna Izquierda: Detalles de Tarea */}
                                <div className="space-y-4">
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
                                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                                            <AlignLeft className="w-4 h-4 text-gray-400" /> Información Principal
                                        </h3>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Título del Proceso / Evento</label>
                                            <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Ej. Preparar facturación semanal..." className="bg-gray-50 text-sm font-medium" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Contexto o Detalles Rápidos</label>
                                            <textarea
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                placeholder="Observaciones de qué se debe tener en cuenta..."
                                                className="w-full flex min-h-[60px] rounded-md border border-input bg-gray-50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#183C30] resize-none"
                                            />
                                        </div>

                                        {/* Etiquetas */}
                                        <div>
                                            <label className="text-[11px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
                                                <Tags className="w-3 h-3" /> Etiquetas (Presione Enter)
                                            </label>
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                                {(formData.tags || []).map(tag => (
                                                    <span key={tag} className="bg-[#183C30]/10 text-[#183C30] text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#183C30]/20">
                                                        {tag}
                                                        <span onClick={() => removeTag(tag)} className="cursor-pointer hover:text-red-500 hover:bg-red-50 rounded-full w-3 h-3 flex items-center justify-center">×</span>
                                                    </span>
                                                ))}
                                            </div>
                                            <Input
                                                value={newTag}
                                                onChange={e => setNewTag(e.target.value)}
                                                onKeyDown={handleAddTag}
                                                onBlur={handleAddTag}
                                                placeholder="Ej. FACTURACIÓN, URGENTE..."
                                                className="bg-gray-50 h-8 text-xs"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Nivel Prioridad</label>
                                                <Select value={formData.priority} onValueChange={v => setFormData({ ...formData, priority: v })}>
                                                    <SelectTrigger className="bg-gray-50 h-9"><SelectValue placeholder="Prioridad" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Baja">Baja (Normal)</SelectItem>
                                                        <SelectItem value="Media">Media (Aviso)</SelectItem>
                                                        <SelectItem value="Alta">Alta (Peligro)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Asignado a</label>
                                                <Select value={formData.assigned_to} onValueChange={v => setFormData({ ...formData, assigned_to: v })}>
                                                    <SelectTrigger className="bg-gray-50 h-9"><SelectValue placeholder="Usuario" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Mismo">Para mí mismo</SelectItem>
                                                        <SelectItem value="Asesora">Equipo Comercial</SelectItem>
                                                        <SelectItem value="Logistica">Logística/Inventario</SelectItem>
                                                        <SelectItem value="Administracion">Administración</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Checklist y Subtareas */}
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                                            <ListTodo className="w-4 h-4 text-gray-400" /> Checklist de Pasos (Sub-tareas)
                                        </h3>
                                        <div className="flex gap-2">
                                            <Input
                                                value={newSubtask}
                                                onChange={e => setNewSubtask(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                                                placeholder="Agregar paso a realizar..."
                                                className="bg-gray-50 h-8 text-xs"
                                            />
                                            <Button size="icon" onClick={handleAddSubtask} className="h-8 w-8 shrink-0 bg-[#183C30] hover:bg-[#122e24]">
                                                <Plus className="w-4 h-4" />
                                            </Button>
                                        </div>
                                        <div className="space-y-1 max-h-[120px] overflow-y-auto">
                                            {(formData.subtasks || []).map((sub) => (
                                                <div key={sub.id} className="flex items-center justify-between group py-1 px-2 hover:bg-gray-50 rounded transition-colors">
                                                    <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => toggleSubtask(sub.id)}>
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sub.completed ? 'bg-green-500 border-green-600' : 'border-gray-300'}`}>
                                                            {sub.completed && <CheckCircle className="w-3 h-3 text-white" />}
                                                        </div>
                                                        <span className={`text-[11px] font-medium leading-tight ${sub.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{sub.title}</span>
                                                    </div>
                                                    <Trash2 onClick={() => deleteSubtask(sub.id)} className="w-3.5 h-3.5 text-gray-300 hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                                                </div>
                                            ))}
                                            {(formData.subtasks || []).length === 0 && (
                                                <div className="text-xs text-center text-gray-400 py-3 italic">No hay pasos creados.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Columna Derecha: Configuración Agenda e Historial */}
                                <div className="space-y-4 flex flex-col">
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
                                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                                            <CalendarIcon className="w-4 h-4 text-gray-400" /> Agenda y Reuniones
                                        </h3>

                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[11px] font-semibold text-gray-700 mb-1.5 block">Fecha Límite</label>
                                                <Input type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} className="bg-gray-50 h-9" />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-semibold text-gray-700 mb-1.5 block flex items-center gap-1"><Repeat className="w-3 h-3 text-blue-500" /> Repetición</label>
                                                <Select value={formData.recurrence || 'none'} onValueChange={v => setFormData({ ...formData, recurrence: v })}>
                                                    <SelectTrigger className="bg-gray-50 h-9"><SelectValue placeholder="No se repite" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">No se repite (Única vez)</SelectItem>
                                                        <SelectItem value="daily">Diariamente</SelectItem>
                                                        <SelectItem value="weekly">Semanal (Mismo día)</SelectItem>
                                                        <SelectItem value="monthly">Mensual (Misma fecha)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                                                <Video className="w-3 h-3 text-purple-500" /> Enlace de Reunión (Teams, Meet, Zoom)
                                            </label>
                                            <Input value={formData.meeting_link || ""} onChange={e => setFormData({ ...formData, meeting_link: e.target.value })} placeholder="https://meet.google.com/..." className="bg-gray-50 h-8 text-xs font-mono text-blue-600" />
                                        </div>

                                        {editingTask && (
                                            <div>
                                                <label className="text-[11px] font-semibold text-gray-700 mb-1.5 block flex items-center gap-1"><Flag className="w-3 h-3" /> Cambio de Estado Manual</label>
                                                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                                                    <SelectTrigger className="bg-gray-50 h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Pendiente">Pendiente</SelectItem>
                                                        <SelectItem value="En Progreso">En Progreso</SelectItem>
                                                        <SelectItem value="Completada">Completada</SelectItem>
                                                        <SelectItem value="Cancelada">Cancelada / Rechazada</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>

                                    {/* Trazabilidad Historial Abajo a la Derecha */}
                                    {editingTask && (
                                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-[150px]">
                                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 border-b pb-2 mb-3">
                                                <History className="w-4 h-4 text-gray-400" /> Historial de Justificaciones
                                            </h3>

                                            <div className="flex-1 overflow-y-auto pr-2 mb-3 max-h-[140px]">
                                                {(!formData.history || formData.history.length === 0) ? (
                                                    <p className="text-[10px] text-center text-gray-400 py-4 italic">No hay notas de trazabilidad.</p>
                                                ) : (
                                                    <div className="relative border-l-2 border-gray-100 ml-2 space-y-3">
                                                        {formData.history.map((log, idx) => (
                                                            <div key={idx} className="relative pl-3">
                                                                <div className="absolute w-2 h-2 bg-gray-300 rounded-full -left-[5px] top-1.5 ring-2 ring-white" />
                                                                <div className="text-[9px] text-gray-400 mb-0.5">{format(new Date(log.date), "dd MMM HH:mm", { locale: es })} • {log.user}</div>
                                                                <div className="text-[10px] font-semibold text-gray-600">{log.action}</div>
                                                                {log.comment && (
                                                                    <div className="mt-0.5 text-[10px] text-gray-600 bg-orange-50/50 p-1.5 rounded border border-orange-100 italic">
                                                                        "{log.comment}"
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-auto bg-gray-50/50 p-2 rounded-lg border">
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={newComment}
                                                        onChange={(e) => setNewComment(e.target.value)}
                                                        placeholder="Razón de retraso, justificación, u otra nota..."
                                                        className="bg-white text-[10px] h-7 px-2"
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                                    />
                                                    <Button size="sm" onClick={handleAddComment} className="h-7 bg-gray-800 hover:bg-gray-700 text-[10px] px-2 h-7 py-0">
                                                        Enviar
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <Button className="w-full bg-[#183C30] hover:bg-[#122e24] shadow-md py-6 text-md font-bold mt-auto" onClick={handleSave} disabled={!formData.title}>
                                        {editingTask ? "Guardar Operación" : "Crear Operación y Lanzar"}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Navegación por Pestañas */}
            <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 p-1">
                <button
                    onClick={() => setActiveTab("tablero")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'tablero' ? 'bg-[#183C30] text-white shadow' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                    <Columns className="w-4 h-4" /> Flujo Operativo (Kanban)
                </button>
                <button
                    onClick={() => setActiveTab("calendario")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'calendario' ? 'bg-[#183C30] text-white shadow' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                    <CalendarDays className="w-4 h-4" /> Agenda & Reuniones
                </button>
                <button
                    onClick={() => setActiveTab("metricas")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'metricas' ? 'bg-[#183C30] text-white shadow' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                >
                    <LineChart className="w-4 h-4" /> Tiempos Reales
                </button>
            </div>

            {/* Toolbar Herramientas de Filtro + ORDENAMIENTO */}
            {(activeTab === "tablero" || activeTab === "calendario") && (
                <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-top-2">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar en todos los procesos, etiquetas (Ej: FACTURACION)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-gray-50/50 border-gray-200 focus-visible:ring-[#183C30] h-9"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                            <SelectTrigger className="w-[160px] h-9 bg-amber-50/50 border-amber-200 text-sm font-medium text-amber-900">
                                <ArrowDownAZ className="w-4 h-4 mr-1 text-amber-600" />
                                <SelectValue placeholder="Ordenar Por..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fecha_creacion">Más Recientes</SelectItem>
                                <SelectItem value="vencimiento">Urgentes (Vencimiento)</SelectItem>
                                <SelectItem value="prioridad">Peligro (Prioridad Alta)</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="w-px h-9 bg-gray-200 mx-1 hidden md:block"></div>

                        <Select value={filterPriority} onValueChange={setFilterPriority}>
                            <SelectTrigger className="w-[130px] h-9 bg-gray-50/50 text-sm"><SelectValue placeholder="Prioridad" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Todas">Toda Prioridad</SelectItem>
                                <SelectItem value="Alta">Solo Alta</SelectItem>
                                <SelectItem value="Media">Solo Media</SelectItem>
                                <SelectItem value="Baja">Solo Baja</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                            <SelectTrigger className="w-[130px] h-9 bg-gray-50/50 text-sm"><SelectValue placeholder="Asignado" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Todos">Todo Asignado</SelectItem>
                                <SelectItem value="Mismo">Mismo</SelectItem>
                                <SelectItem value="Asesora">Comercial</SelectItem>
                                <SelectItem value="Logistica">Logística</SelectItem>
                                <SelectItem value="Administracion">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {/* CONTENIDO: TABLERO INTERACTIVO (KANBAN) */}
            {activeTab === "tablero" && (
                <>
                    {/* Productivity Widget */}
                    <div className="mb-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between text-sm animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-4">
                            <span className="font-bold text-gray-800 flex items-center gap-1.5"><ListTodo className="w-4 h-4 text-gray-400" /> Resumen del Día</span>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
                                    Pendientes: {tasks.filter(t => t.status === "Pendiente").length}
                                </span>
                                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold">
                                    En Progreso: {tasks.filter(t => t.status === "En Progreso").length}
                                </span>
                                <span className="bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-semibold">
                                    Completas: {tasks.filter(t => t.status === "Completada" && (t.completed_at ? isToday(new Date(t.completed_at)) : (t.history && t.history.length > 0 && isToday(new Date(t.history[t.history.length - 1].date))))).length}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-600 font-semibold cursor-pointer select-none" onClick={() => setShowCompletedColumn(!showCompletedColumn)}>
                                Ocultar Columna "Completadas"
                            </label>
                            <button
                                onClick={() => setShowCompletedColumn(!showCompletedColumn)}
                                className={`w-8 h-4 rounded-full transition-colors relative ${!showCompletedColumn ? 'bg-blue-500' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${!showCompletedColumn ? 'translate-x-4' : 'translate-x-0'}`}></div>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-4 animate-in fade-in slide-in-from-bottom-4">
                        {[
                            { id: "Pendiente", color: "bg-slate-100/50", dot: "bg-slate-400", border: 'border-slate-200', show: true },
                            { id: "En Progreso", color: "bg-blue-50/30", dot: "bg-blue-500", border: 'border-blue-200', show: true },
                            { id: "Completada", color: "bg-green-50/40", dot: "bg-green-500", border: 'border-green-200', show: showCompletedColumn },
                            { id: "Cancelada", color: "bg-red-50/30", dot: "bg-red-500", border: 'border-red-200', show: true }
                        ].filter(g => g.show).map(statusGroup => (
                            <div
                                key={statusGroup.id}
                                className={`${statusGroup.color} rounded-2xl p-3 min-h-[60vh] border border-gray-200/60 shadow-inner flex flex-col transition-all duration-300 ${draggedTaskId ? `ring-2 ring-dashed ${statusGroup.border} ring-opacity-50` : ''}`}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, statusGroup.id)}
                            >
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm tracking-tight">
                                        <span className={`w-2 h-2 rounded-full ${statusGroup.dot}`} />
                                        {statusGroup.id}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className="bg-white border border-gray-200 text-gray-600 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                            {filteredTasks.filter(t => {
                                                if (t.status !== statusGroup.id) return false;
                                                if (statusGroup.id === "Completada" || statusGroup.id === "Cancelada") {
                                                    if (t.completed_at && isToday(new Date(t.completed_at))) return true;
                                                    if (t.history && t.history.length > 0 && isToday(new Date(t.history[t.history.length - 1].date))) return true;
                                                    return false;
                                                }
                                                return true;
                                            }).length}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3 flex-1 overflow-y-auto pr-1 pb-4">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-10">
                                            <div className="w-5 h-5 border-2 border-[#183C30]/20 border-t-[#183C30] rounded-full animate-spin" />
                                        </div>
                                    ) : filteredTasks.filter(t => {
                                        if (t.status !== statusGroup.id) return false;
                                        if (statusGroup.id === "Completada" || statusGroup.id === "Cancelada") {
                                            if (t.completed_at && isToday(new Date(t.completed_at))) return true;
                                            if (t.history && t.history.length > 0 && isToday(new Date(t.history[t.history.length - 1].date))) return true;
                                            return false;
                                        }
                                        return true;
                                    }).map(task => {
                                        const timeStatus = getTimeStatus(task.due_date, task.status);
                                        const hasComments = task.history && task.history.some(h => h.comment);
                                        const progress = getSubtaskProgress(task.subtasks);
                                        const isDone = task.status === "Completada" || task.status === "Cancelada";

                                        if (isDone) {
                                            return (
                                                <div key={task.id} className="bg-gradient-to-r from-gray-50 to-white px-2.5 py-2 rounded-md border border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col gap-1 opacity-75 hover:opacity-100 transition-opacity relative" title="Operación cerrada el día de hoy. Mañana desaparecerá del tablero principal.">
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className={`text-[10.5px] font-bold line-clamp-1 flex-1 line-through decoration-black/20 ${task.status === "Cancelada" ? 'text-red-600' : 'text-green-600'}`}>
                                                            {task.title}
                                                        </span>
                                                        <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded" onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} title="Eliminar para siempre">
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                    <div className="flex justify-between items-center text-[9px] text-gray-400 font-medium tracking-tight">
                                                        <span className="flex items-center gap-1"><User className="w-2 h-2" />{task.assigned_to || 'N/A'}</span>
                                                        <span>{task.status === "Completada" ? (task.completed_at ? `Tomó ${calculateTaskDuration(task.created_at, task.completed_at)}` : "Completada Hoy") : "Se Descartó"}</span>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <Card
                                                key={task.id}
                                                id={`task-${task.id}`}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, task.id)}
                                                onDragEnd={(e) => handleDragEnd(e, task.id)}
                                                className="group bg-white hover:shadow-lg transition-all duration-200 border-gray-200/60 overflow-hidden relative cursor-grab active:cursor-grabbing hover:-translate-y-0.5"
                                            >

                                                {/* Checklist Top Progress Bar (subtle) */}
                                                {progress && (
                                                    <div className="w-full absolute top-0 left-0 h-1 bg-gray-100">
                                                        <div
                                                            className={`h-full ${progress.percentage === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${progress.percentage}%` }}
                                                        ></div>
                                                    </div>
                                                )}

                                                <CardContent className="p-3 pt-4">
                                                    {/* Header de la tarjeta */}
                                                    <div className="flex justify-between items-start gap-2 mb-2">
                                                        <h4 className="font-bold text-[13px] leading-tight break-words text-gray-800">
                                                            {task.title}
                                                        </h4>

                                                        {/* Eliminar Rápidamente */}
                                                        <div className="opacity-0 md:group-hover:opacity-100 transition-opacity bg-white pl-2">
                                                            <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full" onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} title="Eliminar para siempre">
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* Etiquetas Visuales (Tags) */}
                                                    {task.tags && task.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                            {task.tags.map(t => (
                                                                <span key={t} className="bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold px-1.5 py-0.5 rounded leading-none">
                                                                    #{t}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {task.description && (
                                                        <p className="text-[11px] text-gray-500 mb-2.5 line-clamp-2 leading-snug">
                                                            {task.description}
                                                        </p>
                                                    )}

                                                    {/* Checklists Indicators / Interactive */}
                                                    {task.subtasks && task.subtasks.length > 0 && (
                                                        <div className="mb-3 space-y-1.5 bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                                                            <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 mb-1">
                                                                <span className="flex items-center gap-1"><ListTodo className="w-3 h-3 text-blue-500" /> Pasos a realizar</span>
                                                                {progress && <span>{progress.completed}/{progress.total}</span>}
                                                            </div>
                                                            <div className="space-y-1 max-h-[80px] overflow-y-auto pr-1">
                                                                {task.subtasks.map(sub => (
                                                                    <div key={sub.id} className="flex items-center gap-2 group cursor-pointer" onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        // Update this specific subtask
                                                                        const updatedSubtasks = task.subtasks!.map(s =>
                                                                            s.id === sub.id ? { ...s, completed: !s.completed } : s
                                                                        );
                                                                        updateTask(task.id, { subtasks: updatedSubtasks });
                                                                    }}>
                                                                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${sub.completed ? 'bg-green-500 border-green-600' : 'border-gray-300 bg-white group-hover:border-[#183C30]'}`}>
                                                                            {sub.completed && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                                                                        </div>
                                                                        <span className={`text-[10.5px] font-medium leading-tight truncate flex-1 ${sub.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                                                            {sub.title}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Badges Inferiores */}
                                                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-50">
                                                        {task.meeting_link && (
                                                            <a href={task.meeting_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100" title="Entrar a Reunión">
                                                                <Video className="w-3 h-3" /> Conectar
                                                            </a>
                                                        )}

                                                        {hasComments && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold bg-orange-50 text-orange-600 border border-orange-200" title="Contiene justificaciones/notas">
                                                                <MessageSquare className="w-2.5 h-2.5" /> Nota
                                                            </span>
                                                        )}

                                                        {task.priority && (
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-medium border ${getPriorityColor(task.priority)}`}>
                                                                <Flag className="w-2.5 h-2.5" /> {task.priority}
                                                            </span>
                                                        )}

                                                        {task.assigned_to && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-medium bg-purple-50 text-purple-700 border border-purple-100">
                                                                <User className="w-2.5 h-2.5" /> {task.assigned_to}
                                                            </span>
                                                        )}

                                                        {task.recurrence && task.recurrence !== 'none' && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                                                <Repeat className="w-2.5 h-2.5" /> Fijo
                                                            </span>
                                                        )}

                                                        {timeStatus && (
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-medium ${timeStatus.color}`}>
                                                                {timeStatus.icon} {timeStatus.text}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={() => handleOpenDialog(task)}
                                                        className="absolute bottom-2 right-2 p-1.5 text-[#183C30] hover:text-white bg-[#183C30]/10 hover:bg-[#183C30] rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 transition-all border border-[#183C30]/20 shadow-sm"
                                                        title="Expandir Panel / Editar"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}

                                    {filteredTasks.filter(t => {
                                        if (t.status !== statusGroup.id) return false;
                                        if (statusGroup.id === "Completada" || statusGroup.id === "Cancelada") {
                                            if (t.completed_at && isToday(new Date(t.completed_at))) return true;
                                            if (t.history && t.history.length > 0 && isToday(new Date(t.history[t.history.length - 1].date))) return true;
                                            return false;
                                        }
                                        return true;
                                    }).length === 0 && !isLoading && (
                                            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center bg-gray-50/30 flex flex-col items-center justify-center text-gray-400 mt-2">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                                                    <span className={`w-3 h-3 rounded-full ${statusGroup.dot}`} />
                                                </div>
                                                <span className="text-xs font-medium">Bandeja Vacía</span>
                                            </div>
                                        )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* CONTENIDO: CALENDARIO DE EVENTOS */}
            {activeTab === "calendario" && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-800 capitalize">
                            Agenda de Operaciones - {format(new Date(), 'MMMM yyyy', { locale: es })}
                        </h2>
                    </div>
                    {/* Grid Semanal */}
                    <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden shadow-inner border border-gray-200">
                        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                            <div key={d} className="bg-gray-50 text-center py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                {d}
                            </div>
                        ))}

                        {/* Celdas del calendario vacías */}
                        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                            <div key={`empty-${i}`} className="bg-gray-50/50 min-h-[120px]" />
                        ))}

                        {calendarDays.map(day => {
                            // Encontramos tareas únicas y cíclicas que tocan este día
                            const dayTasks = tasks.filter(t => isRecurringOn(t, day));
                            const isCurrentDay = isToday(day);

                            return (
                                <div key={format(day, 'yyyy-MM-dd')} className={`bg-white min-h-[120px] p-2 transition-colors hover:bg-gray-50 flex flex-col ${isCurrentDay ? 'bg-blue-50/30 ring-inset ring-2 ring-blue-400' : ''}`}>
                                    <span className={`text-xs font-bold mb-1.5 w-7 h-7 flex items-center justify-center rounded-full ${isCurrentDay ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600'}`}>
                                        {format(day, 'd')}
                                    </span>
                                    <div className="space-y-1.5 flex-1 overflow-y-auto">
                                        {dayTasks.map((task, i) => (
                                            <div
                                                key={`cal-${task.id}-${i}`}
                                                className={`group relative text-[10px] px-2 py-1.5 rounded border flex flex-col hover:shadow-md transition-shadow cursor-default ${task.status === 'Completada' ? 'bg-green-50 text-green-700 border-green-200 line-through' : task.status === 'Cancelada' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white border-gray-200 hover:border-blue-300 text-gray-800 font-medium'}`}
                                            >
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="line-clamp-1 flex-1 pr-1 font-bold">{task.title}</span>
                                                    {task.recurrence && task.recurrence !== 'none' && (
                                                        <span title="Evento Cíclico" className="shrink-0 flex"><Repeat className="w-3 h-3 text-gray-400" /></span>
                                                    )}
                                                </div>

                                                {/* Mini botones de Calendario */}
                                                <div className="mt-1 flex items-center justify-between pt-1 border-t border-black/5">
                                                    {task.meeting_link ? (
                                                        <a href={task.meeting_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-bold text-[9px] bg-blue-50 px-1 rounded">
                                                            <Video className="w-2.5 h-2.5" /> Reunirse
                                                        </a>
                                                    ) : <span></span>}

                                                    <Button variant="ghost" className="h-4 w-4 p-0 text-gray-400 hover:text-blue-600 opacity-60 hover:opacity-100" onClick={() => handleOpenDialog(task)}>
                                                        <Edit2 className="w-2.5 h-2.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* CONTENIDO: METRICAS Y ANALISIS DE TIEMPOS */}
            {activeTab === "metricas" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="shadow-sm border-gray-100">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Impacto Global</p>
                                    <p className="text-2xl font-bold text-gray-900">{tasks.length} Op.</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                                    <LineChart className="w-5 h-5" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-gray-100">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Éxitos</p>
                                    <p className="text-2xl font-bold text-green-600">{tasks.filter(t => t.status === "Completada").length}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-500">
                                    <CheckCircle className="w-5 h-5" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-gray-100">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">En Curso</p>
                                    <p className="text-2xl font-bold text-blue-600">{tasks.filter(t => t.status === "En Progreso").length}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                                    <PlayCircle className="w-5 h-5" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm border-gray-100">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Detenidas</p>
                                    <p className="text-2xl font-bold text-red-600">{tasks.filter(t => t.status === "Cancelada").length}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                                    <XCircle className="w-5 h-5" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-wrap gap-4">
                            <div>
                                <h3 className="font-bold text-gray-800">Cierre de Demoras Históricas</h3>
                                <span className="text-xs text-gray-500 font-medium">Ver toda la trazabilidad y tiempos de respuesta</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border shadow-sm">
                                <CalendarIcon className="w-4 h-4 text-gray-400" />
                                <Input
                                    type="date"
                                    value={historyDate}
                                    onChange={e => setHistoryDate(e.target.value)}
                                    className="border-0 h-6 p-0 text-sm focus-visible:ring-0 shadow-none w-[120px]"
                                />
                                {historyDate && (
                                    <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full" onClick={() => setHistoryDate("")}>
                                        <XCircle className="w-3 h-3 text-red-400" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 bg-white border-b border-gray-200 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 font-bold">Proceso Operativo</th>
                                        <th className="px-4 py-3 font-bold">Encargado</th>
                                        <th className="px-4 py-3 font-bold">Recepción</th>
                                        <th className="px-4 py-3 font-bold text-right">Duración de Resolución</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tasks.filter(t => t.status === "Completada" && (!historyDate || (t.completed_at && t.completed_at.startsWith(historyDate)))).length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                                                No hay procesos completados para la fecha seleccionada.
                                            </td>
                                        </tr>
                                    ) : tasks.filter(t => t.status === "Completada" && (!historyDate || (t.completed_at && t.completed_at.startsWith(historyDate)))).sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()).map(task => (
                                        <tr key={`history-${task.id}`} className="bg-white border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                                            <td className="px-4 py-3 font-semibold text-gray-900">{task.title}</td>
                                            <td className="px-4 py-3">
                                                <span className="bg-purple-50 text-purple-700 font-bold px-2 py-1 rounded text-[10px] border border-purple-100 uppercase tracking-wide">{task.assigned_to || 'Sin asignar'}</span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 text-xs font-medium">
                                                {format(new Date(task.created_at), "dd/MMM yyyy", { locale: es })}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="inline-flex items-center gap-1 font-bold text-[#183C30] bg-[#183C30]/10 px-2 py-1.5 rounded text-[10px] border border-[#183C30]/20 shadow-sm">
                                                    <Clock className="w-3 h-3" />
                                                    {calculateTaskDuration(task.created_at, task.completed_at)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
