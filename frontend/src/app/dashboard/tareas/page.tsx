"use client";

import { useState, useMemo, useEffect } from "react";
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
    Tags, Video, Repeat, Activity, Layers, CheckCircle2, Download, Copy, PaperclipIcon, Coffee, X, Save, FileText
} from "lucide-react";
import {
    format, isPast, isToday, formatDistanceToNow, addDays,
    differenceInHours, differenceInDays, differenceInMinutes,
    startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay
} from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { GCOProgress } from "@/components/ui/GCOProgress";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

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
        history: [],
        tags: [],
        subtasks: [],
        blocked_reason: ""
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

    // Archivos y Usuario
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState<string>("Usuario");
    const [isBreakDialogOpen, setIsBreakDialogOpen] = useState(false);
    const [breakReason, setBreakReason] = useState("");
    const [breakNote, setBreakNote] = useState("");
    const [isOnBreak, setIsOnBreak] = useState(false);
    const [isShiftActive, setIsShiftActive] = useState(false);
    const [customAssignee, setCustomAssignee] = useState(false);

    // Export Modal State
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [exportStartDate, setExportStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [exportEndDate, setExportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Templates State
    const [savedTemplates, setSavedTemplates] = useState<Partial<Task>[]>([]);

    useEffect(() => {
        const email = localStorage.getItem("gco_user") || "Usuario";
        setCurrentUserEmail(email);
        const breakStatus = localStorage.getItem(`gco_break_${email}`);
        if (breakStatus === "true") setIsOnBreak(true);
        const shiftStatus = localStorage.getItem(`gco_shift_${email}`);
        if (shiftStatus === "true") setIsShiftActive(true);

        // Load templates
        try {
            const rawTemplates = localStorage.getItem(`gco_task_templates_${email}`);
            if (rawTemplates) {
                setSavedTemplates(JSON.parse(rawTemplates));
            }
        } catch (e) { }
    }, []);

    const saveCurrentAsTemplate = () => {
        if (!formData.title) {
            alert("⚠️ Ponle al menos un título para guardarla como plantilla.");
            return;
        }
        const templateName = prompt("Nombra esta Plantilla (Ej: 'Corte de Caja Diario'):");
        if (!templateName) return;

        const newTemplate: Partial<Task> = {
            ...formData,
            id: `tpl_${Date.now()}`,
            title: `[Plantilla] ${templateName}`,
            description: formData.description,
            subtasks: formData.subtasks?.map(s => ({ ...s, completed: false })), // desmarcar
            status: "Pendiente",
            history: [] // Limpiar historial
        };

        const updatedTemplates = [...savedTemplates, newTemplate];
        setSavedTemplates(updatedTemplates);
        localStorage.setItem(`gco_task_templates_${currentUserEmail}`, JSON.stringify(updatedTemplates));
        alert("✅ Plantilla guardada exitosamente.");
    };

    const loadTemplate = (tpl: Partial<Task>) => {
        const titleClean = tpl.title?.replace("[Plantilla] ", "") || "";
        setFormData({
            ...formData,
            ...tpl,
            title: titleClean,
            status: "Pendiente",
            id: undefined, // ensure it creates new
            due_date: format(new Date(), 'yyyy-MM-dd') + 'T12:00',
        });
    };

    const handleStartBreak = async () => {
        if (!breakReason.trim()) return;
        setIsSaving(true);
        const activeTasks = tasks.filter(t => t.assigned_to === currentUserEmail && t.status === "En Progreso");

        const finalReason = breakNote.trim() ? `${breakReason} - ${breakNote}` : breakReason;
        const shiftTaskTitle = `Registro de Asistencia - ${currentUserEmail}`;
        let shiftTask = tasks.find(t => t.title === shiftTaskTitle);
        const newEntry = { date: new Date().toISOString(), action: `⏸️ Pausó Turno: ${finalReason}`, user: currentUserEmail };
        if (shiftTask) await updateTask(shiftTask.id, { history: [...(shiftTask.history || []), newEntry] });
        else await createTask({ title: shiftTaskTitle, description: "Registro automático de entradas y salidas.", assigned_to: currentUserEmail, status: "Completada", priority: "Baja", history: [newEntry] });

        for (const t of activeTasks) {
            const historyUpdate = [...(t.history || []), {
                date: new Date().toISOString(),
                action: `Operación auto-pausada (${finalReason})`,
                user: currentUserEmail
            }];
            await updateTask(t.id, { status: "Pausada", history: historyUpdate });
        }

        localStorage.setItem(`gco_break_${currentUserEmail}`, "true");
        setIsOnBreak(true);
        setIsSaving(false);
        setIsBreakDialogOpen(false);
        setBreakReason("");
    };

    const handleResumeBreak = async () => {
        setIsSaving(true);

        const shiftTaskTitle = `Registro de Asistencia - ${currentUserEmail}`;
        let shiftTask = tasks.find(t => t.title === shiftTaskTitle);
        const newEntry = { date: new Date().toISOString(), action: "▶️ Reanudó Turno", user: currentUserEmail };
        if (shiftTask) await updateTask(shiftTask.id, { history: [...(shiftTask.history || []), newEntry] });

        const pausedTasks = tasks.filter(t => t.assigned_to === currentUserEmail && t.status === "Pausada" &&
            t.history && t.history.length > 0 && t.history[t.history.length - 1].action.includes('auto-pausada'));

        for (const t of pausedTasks) {
            const historyUpdate = [...(t.history || []), { date: new Date().toISOString(), action: `Se retomó: En Progreso`, user: currentUserEmail }];
            await updateTask(t.id, { status: "En Progreso", history: historyUpdate });
        }

        localStorage.removeItem(`gco_break_${currentUserEmail}`);
        setIsOnBreak(false);
        setIsSaving(false);
    };

    const generateShiftPDF = (currentEmail: string) => {
        const doc = new jsPDF();
        const todayStr = format(new Date(), "dd/MM/yyyy", { locale: es });

        doc.setFillColor(24, 60, 48);
        doc.rect(0, 0, 210, 40, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("Bitácora de Turno Operativo", 14, 25);

        doc.setFontSize(10);
        doc.text(`Fecha: ${todayStr}`, 140, 20);
        doc.text(`Operador: ${currentEmail}`, 140, 26);

        // Get completed tasks today for this user
        const completedToday = tasks.filter(t =>
            t.assigned_to === currentEmail &&
            t.status === "Completada" &&
            (t.completed_at ? isToday(new Date(t.completed_at)) : (t.history?.length && isToday(new Date(t.history[t.history.length - 1].date))))
        );

        // Get all pending/in progress tasks for this user
        const pendingNow = tasks.filter(t => t.assigned_to === currentEmail && (t.status === "En Progreso" || t.status === "Pausada"));

        // Get shift history 
        const shiftTask = tasks.find(t => t.title === `Registro de Asistencia - ${currentEmail}`);
        const shiftHistoryToday = shiftTask?.history?.filter(h => isToday(new Date(h.date))) || [];

        let yPos = 50;

        doc.setTextColor(30, 30, 30);
        doc.setFontSize(14);
        doc.text("1. Resumen de Actividad del Turno", 14, yPos);
        yPos += 8;

        if (shiftHistoryToday.length > 0) {
            const historyTableBody = shiftHistoryToday.map(h => [
                format(new Date(h.date), "HH:mm"),
                h.action.replace(/[▶️⏹️⏸️]/g, "").trim()
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [["Hora", "Evento de Asistencia"]],
                body: historyTableBody,
                theme: 'grid',
                headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
                styles: { fontSize: 9 }
            });
            yPos = (doc as any).lastAutoTable.finalY + 15;
        }

        doc.setFontSize(14);
        doc.text("2. Tareas Completadas Durante el Turno", 14, yPos);
        yPos += 8;

        if (completedToday.length > 0) {
            const completedTableBody = completedToday.map(t => [
                t.title,
                t.priority,
                calculateTaskDuration(t.created_at, t.completed_at)
            ]);
            autoTable(doc, {
                startY: yPos,
                head: [["Operación / Tarea", "Prioridad", "Tiempo Invertido"]],
                body: completedTableBody,
                theme: 'grid',
                headStyles: { fillColor: [24, 60, 48], textColor: [255, 255, 255] },
                styles: { fontSize: 9 }
            });
            yPos = (doc as any).lastAutoTable.finalY + 15;
        } else {
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text("No se completaron operaciones en este turno.", 14, yPos);
            yPos += 15;
        }

        doc.setTextColor(30, 30, 30);
        doc.setFontSize(14);
        doc.text("3. Tareas que quedan en Tránsito / Pendientes", 14, yPos);
        yPos += 8;

        if (pendingNow.length > 0) {
            const pendingTableBody = pendingNow.map(t => [
                t.title,
                t.status,
                t.priority
            ]);
            autoTable(doc, {
                startY: yPos,
                head: [["Operación / Tarea", "Estado Actual", "Prioridad"]],
                body: pendingTableBody,
                theme: 'grid',
                headStyles: { fillColor: [200, 100, 50], textColor: [255, 255, 255] },
                styles: { fontSize: 9 }
            });
        } else {
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text("No quedaron tareas pendientes asignadas al operador.", 14, yPos);
        }

        const fileNameDate = format(new Date(), "yyyy-MM-dd_HH-mm");
        doc.save(`Bitacora_Turno_${fileNameDate}.pdf`);
    };

    const generateProductivityReport = (startStr: string, endStr: string, currentEmail: string) => {
        const doc = new jsPDF();

        doc.setFillColor(24, 60, 48);
        doc.rect(0, 0, 210, 40, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("Informe de Productividad y Bitacora", 14, 25);

        doc.setFontSize(10);
        doc.text(`Desde: ${startStr} Hasta: ${endStr}`, 140, 20);
        doc.text(`Operador: ${currentEmail}`, 140, 26);

        let yPos = 50;

        const startD = new Date(startStr + 'T00:00:00');
        const endD = new Date(endStr + 'T23:59:59');

        const isWithinRange = (dateStr: string) => {
            const d = new Date(dateStr);
            return d >= startD && d <= endD;
        };

        const myTasks = tasks.filter((t: Task) => t.assigned_to === currentEmail || (t.history && t.history.some(h => h.user === currentEmail)));

        const shiftTask = tasks.find(t => t.title === `Registro de Asistencia - ${currentEmail}`);
        const shiftsInRange = shiftTask?.history?.filter(h => isWithinRange(h.date)) || [];

        doc.setTextColor(30, 30, 30);
        doc.setFontSize(14);
        doc.text("1. Resumen de Turnos (Entradas, Pausas y Salidas)", 14, yPos);
        yPos += 8;

        if (shiftsInRange.length > 0) {
            const shiftBody = shiftsInRange.map(h => [
                format(new Date(h.date), "dd/MM/yyyy HH:mm"),
                h.action.replace(/[▶️⏹️⏸️]/g, "").trim()
            ]);
            autoTable(doc, {
                startY: yPos,
                head: [["Fecha y Hora", "Evento de Asistencia"]],
                body: shiftBody,
                theme: 'grid',
                headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255] },
                styles: { fontSize: 8 }
            });
            yPos = (doc as any).lastAutoTable.finalY + 10;
        } else {
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text("No hay registros de turno en este periodo.", 14, yPos);
            yPos += 10;
        }

        const checkNewPage = (needed: number) => {
            if (yPos + needed > 280) {
                doc.addPage();
                yPos = 20;
            }
        };

        const completed = myTasks.filter(t => t.status === "Completada" && ((t.completed_at && isWithinRange(t.completed_at)) || (t.history && t.history.length > 0 && isWithinRange(t.history[t.history.length - 1].date))));
        checkNewPage(20);
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(14);
        doc.text("2. Actividades Completadas", 14, yPos);
        yPos += 8;
        if (completed.length > 0) {
            const compBody = completed.map(t => [
                t.title,
                t.priority,
                calculateTaskDuration(t.created_at, t.completed_at)
            ]);
            autoTable(doc, {
                startY: yPos,
                head: [["Actividad", "Prioridad", "Tiempo Invertido"]],
                body: compBody,
                theme: 'grid',
                headStyles: { fillColor: [24, 60, 48], textColor: [255, 255, 255] },
                styles: { fontSize: 8 }
            });
            yPos = (doc as any).lastAutoTable.finalY + 10;
        } else {
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text("Ninguna actividad completada en este periodo.", 14, yPos);
            yPos += 10;
        }

        const cancelledInRange = myTasks.filter(t => t.status === "Cancelada" && (t.history ? t.history.some(h => isWithinRange(h.date)) : false));
        checkNewPage(20);
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(14);
        doc.text("3. Actividades Canceladas y Motivos", 14, yPos);
        yPos += 8;
        if (cancelledInRange.length > 0) {
            const cancBody = cancelledInRange.map(t => {
                const cancelLog = t.history?.find(h => h.action.includes("Cancelada") || h.action.includes("Rechazada"));
                const comment = cancelLog?.comment || t.history?.[(t.history?.length || 1) - 1]?.comment || "Sin motivo especificado";
                return [t.title, comment];
            });
            autoTable(doc, {
                startY: yPos,
                head: [["Actividad", "Motivo / Comentario"]],
                body: cancBody,
                theme: 'grid',
                headStyles: { fillColor: [180, 50, 50], textColor: [255, 255, 255] },
                styles: { fontSize: 8 }
            });
            yPos = (doc as any).lastAutoTable.finalY + 10;
        } else {
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text("Ninguna actividad cancelada en este periodo.", 14, yPos);
            yPos += 10;
        }

        const pending = myTasks.filter(t => ["Pendiente", "En Progreso", "Pausada"].includes(t.status) && (t.assigned_to === currentEmail));
        checkNewPage(20);
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(14);
        doc.text("4. Estado Actual (Pausadas, Pendientes, En Progreso)", 14, yPos);
        yPos += 8;
        if (pending.length > 0) {
            const pendBody = pending.map(t => [t.title, t.status, t.priority]);
            autoTable(doc, {
                startY: yPos,
                head: [["Actividad", "Estado", "Prioridad"]],
                body: pendBody,
                theme: 'grid',
                headStyles: { fillColor: [200, 100, 50], textColor: [255, 255, 255] },
                styles: { fontSize: 8 }
            });
            yPos = (doc as any).lastAutoTable.finalY + 10;
        } else {
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text("Ninguna tarea pendiente o en proceso.", 14, yPos);
            yPos += 10;
        }

        checkNewPage(30);
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(14);
        doc.text("5. Bitácora Completa (Hora a Hora)", 14, yPos);
        yPos += 8;

        const allEvents: any[] = [];
        myTasks.forEach(task => {
            if (task.history) {
                task.history.forEach(h => {
                    if (isWithinRange(h.date)) {
                        allEvents.push({ ...h, taskTitle: task.title });
                    }
                });
            }
        });
        allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (allEvents.length > 0) {
            const evBody = allEvents.map(e => [
                format(new Date(e.date), "dd/MM/yyyy HH:mm"),
                e.taskTitle,
                e.action,
                e.comment || ""
            ]);
            autoTable(doc, {
                startY: yPos,
                head: [["Fecha y Hora", "Operación", "Acción / Estado", "Detalle / Comentario"]],
                body: evBody,
                theme: 'grid',
                headStyles: { fillColor: [50, 50, 150], textColor: [255, 255, 255] },
                styles: { fontSize: 8 }
            });
        } else {
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text("Sin registros en la bitácora hora a hora para este periodo.", 14, yPos);
        }

        const fileNameDate = format(new Date(), "yyyy-MM-dd_HH-mm");
        doc.save(`Reporte_Productividad_${currentEmail}_${fileNameDate}.pdf`);
    };

    const handleOpenDialog = (task?: Task) => {
        if (!isShiftActive || isOnBreak) {
            alert("🔒 Operación denegada. No puedes hacer modificaciones si tu turno está cerrado o si te encuentras en Break.");
            return;
        }

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
                blocked_by: task.blocked_by || "",
                blocked_reason: task.blocked_reason || "",
            });
        } else {
            setEditingTask(null);
            setFormData({
                title: "",
                description: "",
                assigned_to: "",
                priority: "Media",
                due_date: format(new Date(), 'yyyy-MM-dd') + 'T12:00',
                status: "Pendiente",
                history: [],
                tags: [],
                subtasks: [],
                meeting_link: "",
                recurrence: "none",
                blocked_by: "",
                blocked_reason: "",
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
            user: currentUserEmail,
            comment: newComment.trim()
        };

        const updatedHistory = [...(formData.history || []), newEntry];
        setFormData({ ...formData, history: updatedHistory });
        setNewComment("");
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !editingTask) return;
        const file = e.target.files[0];

        setUploadingFile(true);
        setUploadProgress(0);

        try {
            const fileRef = ref(storage, `tareas_evidencias/${editingTask.id}/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytesResumable(fileRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error("Upload error", error);
                    setUploadingFile(false);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                    const newEntry: TaskHistoryEntry = {
                        date: new Date().toISOString(),
                        action: "Archivo Adjunto de Evidencia",
                        user: currentUserEmail,
                        comment: `Se subió: ${file.name}`,
                        attachment_url: downloadURL,
                        attachment_name: file.name
                    };

                    const updatedHistory = [...(formData.history || []), newEntry];
                    setFormData(prev => ({ ...prev, history: updatedHistory }));
                    await updateTask(editingTask.id, { history: updatedHistory });
                    setUploadingFile(false);
                }
            );
        } catch (error) {
            console.error(error);
            setUploadingFile(false);
        }
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
        setIsSaving(true);

        const payload = { ...formData };
        const currentHistory = formData.history || [];

        if (editingTask && editingTask.status !== formData.status) {
            currentHistory.push({
                date: new Date().toISOString(),
                action: formData.status === "Pausada" ? "Operación Pausada (Break/Reunión)" : `Estado cambiado a: ${formData.status}`,
                user: currentUserEmail,
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
                action: "Operación creada e inicializada",
                user: currentUserEmail
            }];
            await createTask(payload);
        }
        setIsSaving(false);
        setIsDialogOpen(false);
    };

    // Funciones Drag & Drop
    const handleDragStart = (e: React.DragEvent, id: string) => {
        if (!isShiftActive || isOnBreak) {
            e.preventDefault();
            return;
        }
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
        if (!draggedTaskId || !isShiftActive || isOnBreak) return;

        const task = tasks.find(t => t.id === draggedTaskId);
        if (task && task.status !== newStatus) {
            if (task.blocked_by && (newStatus === "En Progreso" || newStatus === "Completada")) {
                const blockingIds = task.blocked_by.split(',').filter(Boolean);
                const unfinishedBlockers = blockingIds.map(id => tasks.find(t => t.id === id)).filter(t => t && t.status !== "Completada" && t.status !== "Cancelada");
                if (unfinishedBlockers.length > 0) {
                    const titles = unfinishedBlockers.map(t => `"${t?.title}"`).join(", ");
                    alert(`⚠️ Tarea Bloqueada: Depende de ${titles} que aún no están completadas.`);
                    setDraggedTaskId(null);
                    return;
                }
            }
            if (newStatus === "Completada" && task.subtasks && task.subtasks.some(st => !st.completed)) {
                alert(`⚠️ Tarea Incompleta: Debes finalizar todas las subtareas para dar como terminada "${task.title}".`);
                setDraggedTaskId(null);
                return;
            }
            if (newStatus === "En Progreso" && task.blocked_reason && !task.blocked_by) {
                alert(`⚠️ Tarea Bloqueada: No puedes iniciarla porque "${task.blocked_reason}".`);
                setDraggedTaskId(null);
                return;
            }

            const logEntry: TaskHistoryEntry = {
                date: new Date().toISOString(),
                action: `Movida a: ${newStatus}`,
                user: currentUserEmail
            };

            const updates: Partial<Task> = {
                status: newStatus
            };

            if (newStatus === "Cancelada") {
                const reason = prompt(`Indica el motivo por el cual estás rechazando/cancelando la tarea "${task.title}":`);
                if (!reason) {
                    setDraggedTaskId(null); // Abortar
                    return;
                }
                logEntry.comment = `Motivo de Rechazo: ${reason}`;
            }

            updates.history = [...(task.history || []), logEntry];

            if (newStatus === "Completada") {
                updates.completed_at = new Date().toISOString();
            }
            await updateTask(draggedTaskId, updates);
        }
        setDraggedTaskId(null);
    };

    const handleTaskDrop = async (e: React.DragEvent, targetTask: Task) => {
        e.preventDefault();
        e.stopPropagation(); // prevent column drop
        if (!draggedTaskId || !isShiftActive || isOnBreak || draggedTaskId === targetTask.id) return;

        const draggedTask = tasks.find(t => t.id === draggedTaskId);
        if (!draggedTask) return;

        const newStatus = targetTask.status;
        const updates: Partial<Task> = { status: newStatus };
        const logEntry: TaskHistoryEntry = {
            date: new Date().toISOString(),
            action: `Movida/Reordenada a: ${newStatus}`,
            user: currentUserEmail
        };

        if (draggedTask.status !== newStatus) {
            if (draggedTask.blocked_by && (newStatus === "En Progreso" || newStatus === "Completada")) {
                const blockingIds = draggedTask.blocked_by.split(',').filter(Boolean);
                const unfinishedBlockers = blockingIds.map(id => tasks.find(t => t.id === id)).filter(t => t && t.status !== "Completada" && t.status !== "Cancelada");
                if (unfinishedBlockers.length > 0) {
                    const titles = unfinishedBlockers.map(t => `"${t?.title}"`).join(", ");
                    alert(`⚠️ Tarea Bloqueada: Depende de ${titles} que aún no están completadas.`);
                    setDraggedTaskId(null);
                    return;
                }
            }
            if (newStatus === "Completada" && draggedTask.subtasks && draggedTask.subtasks.some(st => !st.completed)) {
                alert(`⚠️ Tarea Incompleta: Debes finalizar todas las subtareas para dar como terminada "${draggedTask.title}".`);
                setDraggedTaskId(null);
                return;
            }
            if (newStatus === "En Progreso" && draggedTask.blocked_reason && !draggedTask.blocked_by) {
                alert(`⚠️ Tarea Bloqueada: No puedes iniciarla porque "${draggedTask.blocked_reason}".`);
                setDraggedTaskId(null);
                return;
            }
            if (newStatus === "Cancelada") {
                const reason = prompt(`Indica el motivo por el cual estás rechazando/cancelando la tarea "${draggedTask.title}":`);
                if (!reason) {
                    setDraggedTaskId(null);
                    return;
                }
                logEntry.comment = `Motivo de Rechazo: ${reason}`;
            }
            updates.history = [...(draggedTask.history || []), logEntry];
            if (newStatus === "Completada") {
                updates.completed_at = new Date().toISOString();
            }
        }

        updates.order = (targetTask.order || 0) - 0.5;
        await updateTask(draggedTaskId, updates);
        setDraggedTaskId(null);
    };

    // Filtrar y Ordenar
    const filteredTasks = useMemo(() => {
        let result = tasks.filter(task => {
            const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (task.tags && task.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
            const matchesPriority = filterPriority === "Todas" || task.priority === filterPriority;

            let matchesAssignee = true;
            if (filterAssignee === "Mismo") matchesAssignee = task.assigned_to === currentUserEmail;
            else if (filterAssignee === "Tercero") matchesAssignee = task.assigned_to !== currentUserEmail;
            else if (filterAssignee !== "Todos") matchesAssignee = task.assigned_to === filterAssignee;

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
                if ((a.order || 0) !== (b.order || 0)) {
                    return (a.order || 0) - (b.order || 0);
                }
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
            const date = new Date(dateString.includes('T') ? dateString : dateString + 'T00:00:00');
            const diffHours = differenceInMinutes(date, new Date()) / 60;

            if (diffHours >= 0 && diffHours <= 1) {
                return { text: "¡Vencerá pronto!", color: "text-red-600 bg-red-50 border border-red-200 font-bold", icon: <AlertCircle className="w-3 h-3" />, isUrgent: true };
            }
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

        const normalizeDate = (dateStr: string) => {
            let str = dateStr.replace(' ', 'T');
            if (!str.endsWith('Z') && !str.match(/[+-]\d{2}(:\d{2})?$/)) {
                str += 'Z';
            }
            return new Date(str);
        };

        const startDate = normalizeDate(start);
        const endDate = normalizeDate(end);
        let diffMinutes = differenceInMinutes(endDate, startDate);
        if (diffMinutes < 0) diffMinutes = Math.abs(diffMinutes);

        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;

        if (hours === 0) return `${mins} min`;
        if (hours < 24) return `${hours}h ${mins}m`;

        const days = differenceInDays(endDate, startDate);
        return `${Math.abs(days)} días`;
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
                            <Button onClick={(e) => {
                                if (!isShiftActive || isOnBreak) { e.preventDefault(); handleOpenDialog(); }
                                else { handleOpenDialog(); }
                            }} disabled={!isShiftActive || isOnBreak} className="bg-[#183C30] hover:bg-[#122e24] shadow-md shadow-[#183C30]/20 transition-all active:scale-95 px-6 disabled:opacity-50 disabled:cursor-not-allowed">
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
                                    {!editingTask && (
                                        <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 shadow-inner animate-in fade-in">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-xs font-bold text-blue-800 flex items-center gap-1.5"><Copy className="w-3 h-3" /> Cargar Plantilla (SOP)</h4>
                                                {savedTemplates.length > 0 && (
                                                    <Select onValueChange={(idx) => loadTemplate(savedTemplates[parseInt(idx)])}>
                                                        <SelectTrigger className="h-6 w-[150px] text-[10px] bg-white border-blue-200 text-blue-800">
                                                            <SelectValue placeholder="Mis Plantillas..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {savedTemplates.map((tpl, i) => (
                                                                <SelectItem key={i} value={i.toString()} className="text-[10px] whitespace-normal break-words py-2 px-2 max-w-[200px]">
                                                                    {tpl.title?.replace("[Plantilla] ", "")}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant="outline" className="h-6 text-[10px] bg-white text-gray-700 hover:text-blue-700 border-gray-200 hover:border-blue-300 shadow-sm" onClick={(e) => { e.preventDefault(); setFormData({ ...formData, title: "Aprobar Facturas Diarias", description: "Revisar facturación generada y aplicar aprobaciones correspondientes.", tags: ["FACTURACION", "RUTINA"], priority: "Media", assigned_to: currentUserEmail }); }}>Aprobar Facturas</Button>
                                                <Button size="sm" variant="outline" className="h-6 text-[10px] bg-white text-gray-700 hover:text-blue-700 border-gray-200 hover:border-blue-300 shadow-sm" onClick={(e) => { e.preventDefault(); setFormData({ ...formData, title: "Corte de Inventario / Caja", description: "Realizar arqueo de caja y contrastar con inventario físico.", tags: ["INVENTARIO", "CAJA"], priority: "Alta", assigned_to: currentUserEmail }); }}>Corte de Inventario</Button>
                                                <Button size="sm" variant="outline" className="h-6 text-[10px] bg-white text-gray-700 hover:text-blue-700 border-gray-200 hover:border-blue-300 shadow-sm" onClick={(e) => { e.preventDefault(); setFormData({ ...formData, title: "Revisión de Correos / Soporte", description: "Verificar y responder tickets de soporte y correo electrónico.", tags: ["SOPORTE"], priority: "Baja", assigned_to: currentUserEmail }); }}>Soporte / Correos</Button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4 overflow-hidden relative">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                <AlignLeft className="w-4 h-4 text-gray-400" /> Información Principal
                                            </h3>
                                            <Button variant="ghost" size="sm" className="h-7 px-2.5 rounded-lg text-[10px] font-bold text-blue-700 bg-blue-50/50 hover:bg-blue-100 border border-blue-200 transition-colors shadow-sm" onClick={(e) => { e.preventDefault(); saveCurrentAsTemplate(); }}>
                                                <Save className="w-3.5 h-3.5 mr-1.5" /> Guardar Plantilla
                                            </Button>
                                        </div>
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
                                            <div className="min-w-0">
                                                <label className="text-xs font-semibold text-gray-700 mb-1.5 block truncate">Nivel Prioridad</label>
                                                <Select value={formData.priority} onValueChange={v => setFormData({ ...formData, priority: v })}>
                                                    <SelectTrigger className="bg-gray-50 h-9 w-full [&>span]:truncate"><SelectValue placeholder="Prioridad" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Baja">Baja (Normal)</SelectItem>
                                                        <SelectItem value="Media">Media (Aviso)</SelectItem>
                                                        <SelectItem value="Alta">Alta (Peligro)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="min-w-0">
                                                <label className="text-xs font-semibold text-gray-700 mb-1.5 block truncate">Asignado a</label>
                                                {!customAssignee ? (
                                                    <div className="flex gap-2 w-full">
                                                        <Select value={formData.assigned_to === currentUserEmail ? "Mismo" : (["Asesora", "Logistica", "Administracion"].includes(formData.assigned_to || "") ? formData.assigned_to : "Otro")} onValueChange={v => {
                                                            if (v === "Mismo") { setFormData({ ...formData, assigned_to: currentUserEmail }); setCustomAssignee(false); }
                                                            else if (v === "Otro") { setCustomAssignee(true); setFormData({ ...formData, assigned_to: "" }); }
                                                            else {
                                                                let updatedHistory = formData.history || [];
                                                                if (v === "Logistica") {
                                                                    alert("✅ Notificando automáticamente a Logística sobre esta asignación.");
                                                                    updatedHistory = [...updatedHistory, {
                                                                        date: new Date().toISOString(),
                                                                        action: "Notificación Sistema",
                                                                        user: "Sistema Automático",
                                                                        comment: `Se delegó operación y se notificó a Logística.`
                                                                    }];
                                                                }
                                                                setFormData({ ...formData, assigned_to: v, history: updatedHistory });
                                                                setCustomAssignee(false);
                                                            }
                                                        }}>
                                                            <SelectTrigger className="bg-gray-50 h-9 w-full [&>span]:truncate"><SelectValue placeholder="Usuario" /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Mismo">Para mí mismo</SelectItem>
                                                                <SelectItem value="Asesora">Equipo Comercial</SelectItem>
                                                                <SelectItem value="Logistica">Logística/Inventario</SelectItem>
                                                                <SelectItem value="Administracion">Administración</SelectItem>
                                                                <SelectItem value="Otro">Otro Tercero Específico...</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2 relative w-full">
                                                        <Input
                                                            value={formData.assigned_to}
                                                            onChange={e => setFormData({ ...formData, assigned_to: e.target.value })}
                                                            placeholder="Escribe el nombre o correo..."
                                                            className="bg-gray-50 h-9 text-xs w-full pr-8"
                                                            autoFocus
                                                        />
                                                        <Button variant="ghost" size="sm" onClick={() => { setCustomAssignee(false); setFormData({ ...formData, assigned_to: currentUserEmail }); }} className="absolute right-1 top-1.5 h-6 w-6 p-0 rounded-full hover:bg-gray-200">
                                                            <X className="w-3 h-3 text-gray-500" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t mt-2">
                                            <label className="text-[11px] font-semibold text-gray-700 mb-1.5 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3 text-red-500" /> Dependencias o Bloqueadores
                                            </label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1.5">
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-500 mb-1 block">Razón del Bloqueo</label>
                                                    <Input
                                                        value={formData.blocked_reason || ""}
                                                        onChange={e => setFormData({ ...formData, blocked_reason: e.target.value })}
                                                        placeholder="Ej: Esperando autorización..."
                                                        className={`h-8 text-xs ${formData.blocked_reason ? 'bg-red-50 border-red-200 text-red-800 font-medium placeholder:text-red-300' : 'bg-gray-50'}`}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-500 mb-1 block">Depende de Tareas</label>
                                                    <div className="flex flex-wrap gap-1 mb-1.5">
                                                        {(formData.blocked_by ? formData.blocked_by.split(',').filter(Boolean) : []).map(id => {
                                                            const t = tasks.find(x => x.id === id);
                                                            if (!t) return null;
                                                            return (
                                                                <span key={id} className="bg-red-100 text-red-700 text-[9px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 shadow-sm">
                                                                    {t.title.substring(0, 20)}
                                                                    <X className="w-2.5 h-2.5 cursor-pointer hover:text-red-900 transition-colors" onClick={(e) => {
                                                                        e.preventDefault();
                                                                        const newIds = formData.blocked_by!.split(',').filter(x => x && x !== id).join(',');
                                                                        setFormData({ ...formData, blocked_by: newIds });
                                                                    }} />
                                                                </span>
                                                            )
                                                        })}
                                                    </div>
                                                    <Select value="none" onValueChange={v => {
                                                        if (v === "none") return;
                                                        const currentIds = formData.blocked_by ? formData.blocked_by.split(',').filter(Boolean) : [];
                                                        if (!currentIds.includes(v)) {
                                                            setFormData({ ...formData, blocked_by: [...currentIds, v].join(',') });
                                                        }
                                                    }}>
                                                        <SelectTrigger className="bg-gray-50 h-8 text-xs w-full [&>span]:truncate"><SelectValue placeholder="Añadir Dependencia..." /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Seleccionar...</SelectItem>
                                                            {tasks.filter(t => t.id !== editingTask?.id && t.status !== "Completada" && t.status !== "Cancelada" && !(formData.blocked_by || "").includes(t.id || "")).map(t => (
                                                                <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
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
                                                <Input type="datetime-local" value={formData.due_date ? (formData.due_date.includes('T') ? formData.due_date.substring(0, 16) : formData.due_date + 'T00:00') : ""} onChange={e => setFormData({ ...formData, due_date: e.target.value })} className="bg-gray-50 h-9" />
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
                                                <Select value={formData.status} onValueChange={v => {
                                                    if (formData.blocked_by && (v === "En Progreso" || v === "Completada")) {
                                                        const blockingIds = formData.blocked_by.split(',').filter(Boolean);
                                                        const unfinishedBlockers = blockingIds.map(id => tasks.find(t => t.id === id)).filter(t => t && t.status !== "Completada" && t.status !== "Cancelada");
                                                        if (unfinishedBlockers.length > 0) {
                                                            const titles = unfinishedBlockers.map(t => `"${t?.title}"`).join(", ");
                                                            alert(`⚠️ Tarea Bloqueada: Depende de ${titles} que aún no están completadas.`);
                                                            return;
                                                        }
                                                    }
                                                    if (v === "Completada" && formData.subtasks && formData.subtasks.some(st => !st.completed)) {
                                                        alert(`⚠️ Tarea Incompleta: Faltan pasos (subtareas) por completar revisa el checklist.`);
                                                        return;
                                                    }
                                                    if (v === "En Progreso" && formData.blocked_reason && !formData.blocked_by) {
                                                        alert(`⚠️ Tarea Bloqueada: No puedes iniciarla porque "${formData.blocked_reason}".`);
                                                        return;
                                                    }
                                                    if (v === "Cancelada") {
                                                        const reason = prompt("Indica el motivo por el cual estás cancelando o rechazando esta tarea:");
                                                        if (!reason) return;
                                                        const newEntry: TaskHistoryEntry = {
                                                            date: new Date().toISOString(),
                                                            action: `Estado cambiado a: Cancelada`,
                                                            user: currentUserEmail,
                                                            comment: `Motivo Rechazo: ${reason}`
                                                        };
                                                        setFormData({ ...formData, status: v, history: [...(formData.history || []), newEntry] });
                                                        return;
                                                    }
                                                    setFormData({ ...formData, status: v });
                                                }}>
                                                    <SelectTrigger className="bg-gray-50 h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Pendiente">Pendiente</SelectItem>
                                                        <SelectItem value="En Progreso">En Progreso</SelectItem>
                                                        <SelectItem value="Pausada">Pausada (Almuerzos/Reunión)</SelectItem>
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
                                                                <div className={`text-[10px] font-semibold ${log.action.includes('Turno') ? 'text-indigo-600' : 'text-gray-600'}`}>{log.action}</div>
                                                                {log.comment && (
                                                                    <div className="mt-0.5 text-[10px] text-gray-600 bg-orange-50/50 p-1.5 rounded border border-orange-100 italic">
                                                                        "{log.comment}"
                                                                    </div>
                                                                )}
                                                                {log.attachment_url && (
                                                                    <a href={log.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50/80 p-1.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors">
                                                                        <PaperclipIcon className="w-3 h-3" />
                                                                        {log.attachment_name || "Ver Archivo Adjunto"}
                                                                    </a>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-auto bg-gray-50/50 p-2 rounded-lg border">
                                                <div className="flex gap-2 relative">
                                                    <Input
                                                        value={newComment}
                                                        onChange={(e) => setNewComment(e.target.value)}
                                                        placeholder="Razón de retraso, justificación..."
                                                        className="bg-white text-[10px] h-8 px-2 pr-10"
                                                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                                    />

                                                    {/* Boton Oculto Upload */}
                                                    <input
                                                        type="file"
                                                        id={`file-upload-ev-${editingTask.id}`}
                                                        className="hidden"
                                                        onChange={handleFileUpload}
                                                    />
                                                    <label
                                                        htmlFor={`file-upload-ev-${editingTask.id}`}
                                                        className="absolute right-14 top-1 cursor-pointer bg-white border border-gray-200 text-gray-400 hover:text-blue-600 w-6 h-6 flex items-center justify-center rounded transition-colors"
                                                        title="Adjuntar Archivo (PDF, Imagen, Excel)"
                                                    >
                                                        {uploadingFile ? <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> : <PaperclipIcon className="w-3 h-3" />}
                                                    </label>

                                                    <Button size="sm" onClick={handleAddComment} className="h-8 bg-gray-800 hover:bg-gray-700 text-[10px] px-2 py-0 min-w-[50px]">
                                                        Enviar
                                                    </Button>
                                                </div>
                                                {uploadingFile && (
                                                    <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden w-full">
                                                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <Button className="w-full bg-[#183C30] hover:bg-[#122e24] shadow-md py-6 text-md font-bold mt-auto" onClick={handleSave} disabled={!formData.title || isSaving}>
                                        {isSaving ? <span className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</span> : (editingTask ? "Guardar Operación" : "Crear Operación y Lanzar")}
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
                                <SelectItem value="Mismo" className="font-bold text-[#183C30]">Mi Bandeja de Trabajo</SelectItem>
                                <SelectItem value="Tercero">Terceros / Delegadas</SelectItem>
                                <SelectItem value="Asesora">Comercial</SelectItem>
                                <SelectItem value="Logistica">Logística</SelectItem>
                                <SelectItem value="Administracion">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {activeTab === "tablero" && (
                <>
                    {/* Productivity Widget */}
                    <div className="mb-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-sm animate-in fade-in slide-in-from-top-2">
                        <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
                            <span className="font-bold text-gray-800 flex items-center gap-1.5"><ListTodo className="w-4 h-4 text-gray-400" /> Resumen del Día</span>
                            <div className="flex items-center gap-3 text-xs flex-wrap">
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

                        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                            <div className="flex items-center gap-2 bg-indigo-50/50 px-2 py-1.5 rounded-lg border border-indigo-100">
                                {!isOnBreak ? (
                                    <>
                                        {!isShiftActive ? (
                                            <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-indigo-700 hover:bg-indigo-100 px-2 animate-pulse" onClick={async () => {
                                                const shiftTaskTitle = `Registro de Asistencia - ${currentUserEmail}`;
                                                let shiftTask = tasks.find(t => t.title === shiftTaskTitle);
                                                const newEntry = { date: new Date().toISOString(), action: "▶️ Inició Turno/Jornada", user: currentUserEmail };
                                                if (shiftTask) await updateTask(shiftTask.id, { history: [...(shiftTask.history || []), newEntry] });
                                                else await createTask({ title: shiftTaskTitle, description: "Registro automático de entradas y salidas.", assigned_to: currentUserEmail, status: "Completada", priority: "Baja", history: [newEntry] });
                                                setIsShiftActive(true);
                                                localStorage.setItem(`gco_shift_${currentUserEmail}`, "true");
                                            }}>▶️ Iniciar Turno</Button>
                                        ) : (
                                            <>
                                                <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-amber-700 hover:bg-amber-100 px-2 border border-amber-200 bg-amber-50" onClick={() => setIsBreakDialogOpen(true)}>
                                                    ☕ Tomar un descanso
                                                </Button>
                                                <div className="w-px h-4 bg-indigo-200"></div>
                                                <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-slate-600 hover:bg-slate-200 px-2" onClick={async () => {
                                                    const shiftTaskTitle = `Registro de Asistencia - ${currentUserEmail}`;
                                                    let shiftTask = tasks.find(t => t.title === shiftTaskTitle);
                                                    const newEntry = { date: new Date().toISOString(), action: "⏹️ Terminó Turno/Jornada", user: currentUserEmail };
                                                    if (shiftTask) await updateTask(shiftTask.id, { history: [...(shiftTask.history || []), newEntry] });
                                                    else await createTask({ title: shiftTaskTitle, description: "Registro automático de entradas y salidas.", assigned_to: currentUserEmail, status: "Completada", priority: "Baja", history: [newEntry] });

                                                    // Trigger PDF Generation
                                                    generateShiftPDF(currentUserEmail);

                                                    localStorage.removeItem(`gco_shift_${currentUserEmail}`);
                                                    setIsShiftActive(false);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}>⏹️ Terminar Turno</Button>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <Button size="sm" variant="default" className="h-7 text-xs font-bold bg-amber-600 hover:bg-amber-700 px-6 shadow-sm border border-amber-800 animate-pulse" onClick={handleResumeBreak} disabled={isSaving}>
                                        {isSaving ? "Cargando..." : "▶️ Retomar Turno Activo"}
                                    </Button>
                                )}
                            </div>

                            <div className="hidden md:block w-px h-6 bg-gray-200"></div>

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
                    </div>

                    <div className={`grid grid-cols-1 ${showCompletedColumn ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4 md:gap-4 animate-in fade-in slide-in-from-bottom-4`}>
                        {[
                            { id: "Pendiente", color: "bg-slate-100/50", dot: "bg-slate-400", border: 'border-slate-200', show: true },
                            { id: "En Progreso", color: "bg-blue-50/30", dot: "bg-blue-500", border: 'border-blue-200', show: true },
                            { id: "Pausada", color: "bg-amber-50/30", dot: "bg-amber-500", border: 'border-amber-200', show: true },
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
                                                    if (searchQuery.trim().length > 0) return true;
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
                                            if (searchQuery.trim().length > 0) return true;
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
                                                <div key={task.id} onClick={() => handleOpenDialog(task)} className="bg-gradient-to-r from-gray-50 to-white px-2.5 py-2 rounded-md border border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col gap-1 opacity-75 hover:opacity-100 transition-opacity relative cursor-pointer" title="Haga clic para ver el historial completo de la operación.">
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
                                                        <span>{task.status === "Completada" ? (task.completed_at ? `Tomó ${calculateTaskDuration(task.created_at, task.completed_at)}` : "Completada") : "Se Descartó"}</span>
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
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleTaskDrop(e, task)}
                                                onClick={() => handleOpenDialog(task)}
                                                className={`group bg-white hover:shadow-lg transition-all duration-200 border-gray-200/60 overflow-hidden relative cursor-pointer active:cursor-grabbing hover:-translate-y-0.5 ${timeStatus?.isUrgent ? 'border-l-4 border-l-red-400 shadow-sm shadow-red-100' : ''} ${(task.blocked_reason || task.blocked_by) ? 'border-r-4 border-r-red-400 opacity-90' : ''}`}
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
                                                                <MessageSquare className="w-2.5 h-2.5" /> Bitácora
                                                            </span>
                                                        )}

                                                        {task.history && task.history.some(h => h.attachment_url) && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold bg-blue-50 text-blue-600 border border-blue-200" title="Contiene evidencias o archivos adjuntos">
                                                                <PaperclipIcon className="w-2.5 h-2.5" /> Evidencia
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
                                                        {task.blocked_reason && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold bg-red-50 text-red-600 border border-red-200 max-w-full" title={task.blocked_reason}>
                                                                <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                                                                <span className="truncate">Bloqueada: {task.blocked_reason}</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenDialog(task); }}
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
                                                className={`group relative py-2 px-2 rounded-lg border flex flex-col hover:shadow-lg transition-all cursor-pointer ${task.status === 'Completada' ? 'bg-gradient-to-br from-green-50 to-white text-green-700 border-green-200 opacity-75 line-through decoration-black/30' : task.status === 'Cancelada' ? 'bg-gradient-to-br from-red-50 to-white text-red-700 border-red-200 opacity-75' : 'bg-gradient-to-br from-white to-gray-50 border-gray-200/80 hover:border-blue-400 border-l-[3px] border-l-[#183C30] shadow-[0_2px_8px_-3px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 z-10'}`}
                                                onClick={() => handleOpenDialog(task)}
                                            >
                                                <div className="flex items-start justify-between mb-1.5 gap-1">
                                                    <span className={`line-clamp-2 leading-tight flex-1 font-bold text-[10px] ${task.status === 'Completada' ? '' : 'text-gray-900'}`}>{task.title}</span>
                                                    {task.recurrence && task.recurrence !== 'none' && (
                                                        <span title="Evento Cíclico" className={`shrink-0 flex p-0.5 rounded-full mt-0.5 ${task.status === 'Completada' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}><Repeat className="w-3 h-3" /></span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1.5 mb-2opacity-80">
                                                    <div className={`p-0.5 rounded ${task.status === 'Completada' ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                                        <Clock className="w-2.5 h-2.5" />
                                                    </div>
                                                    <span className="text-[9px] font-bold tracking-tight text-gray-600">{task.due_date ? format(new Date(task.due_date.includes('T') ? task.due_date : task.due_date + 'T00:00:00'), 'HH:mm a') : '00:00'}</span>
                                                </div>

                                                {/* Mini botones de Calendario */}
                                                <div className="mt-1 flex items-center justify-between pt-1 border-t border-black/5">
                                                    {task.meeting_link ? (
                                                        <a href={task.meeting_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center gap-1.5 font-black text-[9px] w-full px-2 py-1.5 rounded-md shadow-sm shadow-blue-500/30 transition-all hover:scale-[1.02]">
                                                            <Video className="w-3 h-3" /> UNIRSE AHORA
                                                        </a>
                                                    ) : (
                                                        <div className="flex w-full items-center justify-between">
                                                            <div className="flex items-center gap-1 opacity-70">
                                                                <User className="w-2.5 h-2.5 text-gray-500" />
                                                                <span className="text-[8px] font-bold uppercase truncate max-w-[50px]">{task.assigned_to?.split('@')[0]}</span>
                                                            </div>
                                                            <Button variant="ghost" className="h-5 w-5 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full">
                                                                <Edit2 className="w-2.5 h-2.5" />
                                                            </Button>
                                                        </div>
                                                    )}
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

            {/* CONTENIDO: PRODUCTIVIDAD Y TRAZABILIDAD */}
            {activeTab === "metricas" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    {(() => {
                        const selectedDateStr = historyDate || format(new Date(), 'yyyy-MM-dd');
                        const timelineEvents: any[] = [];

                        tasks.forEach(task => {
                            if (task.history && task.history.length > 0) {
                                task.history.forEach((h, index) => {
                                    const hDate = new Date(h.date);
                                    if (format(hDate, 'yyyy-MM-dd') === selectedDateStr) {
                                        timelineEvents.push({
                                            id: `${task.id}-${index}`,
                                            time: hDate,
                                            taskTitle: task.title,
                                            user: h.user,
                                            action: h.action,
                                            comment: h.comment,
                                            taskId: task.id,
                                            status: task.status
                                        });
                                    }
                                });
                            }
                        });

                        timelineEvents.sort((a, b) => b.time.getTime() - a.time.getTime()); // Mas recientes arriba

                        const actionsCount = timelineEvents.length;
                        const tasksTouched = new Set(timelineEvents.map(e => e.taskId)).size;
                        const tasksCompletedTodayObj = tasks.filter(t => (t.status === "Completada" || t.status === "Cancelada") && t.completed_at && t.completed_at.startsWith(selectedDateStr));
                        const tasksCompletedToday = tasksCompletedTodayObj.length;

                        return (
                            <>
                                {/* ENCABEZADO Y SELECTOR DE FECHA */}
                                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white p-4 rounded-xl shadow-[0_2px_8px_-3px_rgba(0,0,0,0.1)] border border-gray-100">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                            <LineChart className="text-[#183C30] w-6 h-6" /> Rendimiento y Trazabilidad
                                        </h2>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Demuestra y evalúa tus funciones hora a hora en cualquier día específico.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 md:gap-3 flex-wrap bg-gray-50 px-4 py-2.5 rounded-xl border shadow-inner">
                                        <Button variant="outline" size="sm" className="h-9 px-3 font-bold text-[#183C30] border-[#183C30] hover:bg-[#183C30] hover:text-white" onClick={() => setIsExportDialogOpen(true)}>
                                            <Download className="w-4 h-4 mr-2" /> Exportar Reporte PDF
                                        </Button>
                                        <div className="w-px h-6 bg-gray-300 mx-1 hidden sm:block"></div>
                                        <span className="text-sm font-bold text-gray-600 flex items-center gap-1.5"><CalendarIcon className="w-4 h-4" /> Revisar Día:</span>
                                        <Input
                                            type="date"
                                            value={historyDate || format(new Date(), 'yyyy-MM-dd')}
                                            onChange={e => setHistoryDate(e.target.value)}
                                            className="border-gray-200 h-9 text-sm focus-visible:ring-[#183C30] shadow-sm bg-white font-bold w-[140px] text-gray-700"
                                        />
                                        {historyDate && historyDate !== format(new Date(), 'yyyy-MM-dd') && (
                                            <Button variant="ghost" size="sm" className="h-9 px-3 font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100" onClick={() => setHistoryDate("")}>
                                                Volver a Hoy
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* TARJETAS DE METRICAS DEL DIA */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <Card className="shadow-sm border-gray-100 bg-gradient-to-br from-white to-blue-50/30">
                                        <CardContent className="p-5 flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-inner">
                                                <Activity className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">Acciones (Cliks/Cambios)</p>
                                                <div className="flex items-baseline gap-2">
                                                    <p className="text-3xl font-black text-gray-900">{actionsCount}</p>
                                                    <span className="text-xs text-gray-500 font-medium">movimientos</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="shadow-sm border-gray-100 bg-gradient-to-br from-white to-purple-50/30">
                                        <CardContent className="p-5 flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 shrink-0 shadow-inner">
                                                <Layers className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider mb-1">Operaciones Tocadas</p>
                                                <div className="flex items-baseline gap-2">
                                                    <p className="text-3xl font-black text-gray-900">{tasksTouched}</p>
                                                    <span className="text-xs text-gray-500 font-medium">tareas gestionadas</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="shadow-sm border-gray-100 bg-gradient-to-br from-white to-green-50/30">
                                        <CardContent className="p-5 flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center text-green-600 shrink-0 shadow-inner">
                                                <CheckCircle2 className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-green-600 uppercase tracking-wider mb-1">Cierres Efectivos</p>
                                                <div className="flex items-baseline gap-2">
                                                    <p className="text-3xl font-black text-gray-900">{tasksCompletedToday}</p>
                                                    <span className="text-xs text-gray-500 font-medium">finalizados este día</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* TIMELINE HORA A HORA Y TABLA DE CIERRES */}
                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                    {/* TIMELINE VERTICAL */}
                                    <Card className="shadow-sm border-gray-100 lg:col-span-3 overflow-hidden flex flex-col h-[650px]">
                                        <div className="p-4 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-5 h-5 text-blue-600" />
                                                <h3 className="font-bold text-gray-800">Bitácora Hora a Hora</h3>
                                            </div>
                                            <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded font-bold text-gray-500 shadow-sm">
                                                Más recientes arriba ↑
                                            </span>
                                        </div>
                                        <div className="p-6 overflow-y-auto flex-1 bg-white">
                                            {timelineEvents.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                                    <History className="w-16 h-16 mb-4 text-gray-200" />
                                                    <p className="font-bold text-gray-500 text-lg">Día sin Actividad</p>
                                                    <p className="text-sm">No hay registros guardados en esta fecha.</p>
                                                </div>
                                            ) : (
                                                <div className="relative border-l-2 border-gray-200 ml-4 space-y-8 pb-4">
                                                    {timelineEvents.map((event, idx) => (
                                                        <div key={event.id} className="relative pl-6">
                                                            {/* Circulo del timeline */}
                                                            <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white shadow-sm" />

                                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 mb-1">
                                                                <h4 className="text-[15px] font-bold text-gray-900 line-clamp-1 flex-1 pr-4">{event.taskTitle}</h4>
                                                                <span className="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full shrink-0 border border-blue-100 shadow-sm">
                                                                    {format(event.time, 'hh:mm:ss a')}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-gray-600 leading-snug mt-1">
                                                                <span className="font-bold text-[#183C30]">{event.user}</span> <span className="opacity-80">{event.action.toLowerCase()}</span>
                                                            </p>
                                                            {event.comment && (
                                                                <div className="mt-2.5 bg-yellow-50/50 border border-yellow-100/70 p-3 rounded-xl text-xs italic text-gray-700 flex gap-2 items-start shadow-sm">
                                                                    <MessageSquare className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                                    <span className="leading-relaxed">&quot;{event.comment}&quot;</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </Card>

                                    {/* TABLA DE DEMORAS (DERECHA) */}
                                    <Card className="shadow-sm border-gray-100 lg:col-span-2 overflow-hidden flex flex-col h-[650px]">
                                        <div className="p-4 border-b border-gray-100 bg-gray-50/80">
                                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                                <CheckCircle2 className="w-5 h-5 text-green-600" /> Tiempos de Cierre Este Día
                                            </h3>
                                        </div>
                                        <div className="overflow-y-auto flex-1 bg-gray-50/30">
                                            {tasksCompletedTodayObj.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 h-full">
                                                    <span className="text-sm font-medium">No se cerró ninguna operación en esta fecha.</span>
                                                </div>
                                            ) : (
                                                <div className="p-4 space-y-4">
                                                    {tasksCompletedTodayObj.sort((a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()).map(task => (
                                                        <div key={`history-done-${task.id}`} className="p-4 bg-white border border-gray-100 shadow-sm rounded-xl hover:border-green-300 hover:shadow-md transition-all">
                                                            <div className="flex items-start justify-between gap-2 mb-3">
                                                                <span className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight flex-1">{task.title}</span>
                                                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded shrink-0 ${task.status === 'Cancelada' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                                                                    {task.status.substring(0, 4)}.
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Demora/Velocidad</span>
                                                                    <span className="flex items-center gap-1.5 font-bold text-[#183C30] bg-[#183C30]/5 px-2.5 py-1 rounded-md border border-[#183C30]/10 text-xs">
                                                                        <Clock className="w-3.5 h-3.5" />
                                                                        {calculateTaskDuration(task.created_at, task.completed_at)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Encargado</span>
                                                                    <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{task.assigned_to || 'N/A'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Modal para registrar el Break */}
            <Dialog open={isBreakDialogOpen} onOpenChange={(open) => { setIsBreakDialogOpen(open); if (!open) { setBreakReason(""); setBreakNote(""); } }}>
                <DialogContent className="max-w-md p-6 bg-white rounded-2xl shadow-xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-amber-800 flex items-center gap-2">
                            <Coffee className="w-5 h-5 text-amber-600" /> Pausar Turno
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-sm text-gray-600">Al pausar, todas tus tareas "En Progreso" pasarán automáticamente a "Pausada". ¿Por qué motivo te ausentas?</p>
                        <Select value={breakReason} onValueChange={setBreakReason}>
                            <SelectTrigger className="h-10 border-amber-200 bg-amber-50">
                                <SelectValue placeholder="Selecciona un motivo..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Desayuno / Almuerzo">Desayuno / Almuerzo</SelectItem>
                                <SelectItem value="Break / Pausa Activa">Break / Pausa Activa</SelectItem>
                                <SelectItem value="Reunión Externa">Reunión Externa a mis funciones</SelectItem>
                                <SelectItem value="Otro motivo">Otro motivo...</SelectItem>
                            </SelectContent>
                        </Select>
                        {(breakReason === "Reunión Externa" || breakReason === "Otro motivo") && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Nota / Detalle adicional:</label>
                                <Input
                                    value={breakNote}
                                    onChange={e => setBreakNote(e.target.value)}
                                    placeholder="Ej: Visita al banco, Reunión con cliente X..."
                                    className="bg-gray-50 h-9 text-sm border-gray-200"
                                    autoFocus
                                />
                            </div>
                        )}
                        <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-10 shadow-md transition-all" onClick={handleStartBreak} disabled={!breakReason || isSaving || (['Reunión Externa', 'Otro motivo'].includes(breakReason) && !breakNote.trim())}>
                            {isSaving ? "Aplicando Pausa Global..." : "Confirmar e Ir a Break"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal para Exportar Informes de Productividad */}
            <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                <DialogContent className="max-w-md p-6 bg-white rounded-2xl shadow-xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-[#183C30] flex items-center gap-2">
                            <Download className="w-5 h-5" /> Exportar Informe de Productividad
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-sm text-gray-600">
                            Descarga un informe completo (PDF) de tus actividades. Incluye: Entradas/Salidas, tareas completadas, canceladas (con motivos), estado actual de las pendientes y bitácora completa hora a hora de los días seleccionados.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Fecha Inicio</label>
                                <Input
                                    type="date"
                                    value={exportStartDate}
                                    onChange={e => setExportStartDate(e.target.value)}
                                    className="bg-gray-50 h-10 border-gray-200"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Fecha Fin</label>
                                <Input
                                    type="date"
                                    value={exportEndDate}
                                    onChange={e => setExportEndDate(e.target.value)}
                                    className="bg-gray-50 h-10 border-gray-200"
                                />
                            </div>
                        </div>
                        <Button
                            className="w-full bg-[#183C30] hover:bg-[#122e24] text-white font-bold h-10 shadow-md transition-all mt-4"
                            onClick={() => {
                                generateProductivityReport(exportStartDate, exportEndDate, currentUserEmail);
                                setIsExportDialogOpen(false);
                            }}
                        >
                            Generar PDF
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
