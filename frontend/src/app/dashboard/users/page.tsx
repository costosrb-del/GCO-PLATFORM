"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, UserPlus, Shield, User, Trash2 } from "lucide-react";
import { API_URL } from "@/lib/config";

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form State
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("viewer");
    const [isCreating, setIsCreating] = useState(false);

    const baseUrl = API_URL;

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem("gco_token");
            const res = await axios.get(`${baseUrl}/auth/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(res.data);
        } catch (error) {
            console.error(error);
            // alert("Error cargando usuarios: " + error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const token = localStorage.getItem("gco_token");
            await axios.post(`${baseUrl}/auth/users`,
                { email, password, role },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert("Usuario creado correctamente en Firebase y asignado Rol.");
            setEmail("");
            setPassword("");
            fetchUsers();
        } catch (error: any) {
            console.error(error);
            alert("Error: " + (error.response?.data?.detail || error.message));
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (userEmail: string) => {
        if (!confirm(`¿Estás seguro de eliminar el usuario ${userEmail}?`)) return;

        try {
            const token = localStorage.getItem("gco_token");
            await axios.delete(`${baseUrl}/auth/users/${userEmail}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert("Usuario eliminado correctamente.");
            fetchUsers();
        } catch (error: any) {
            console.error(error);
            alert("Error eliminando usuario: " + (error.response?.data?.detail || error.message));
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-[#183C30]">Gestión de Usuarios</h1>
                    <p className="text-gray-500">Crea y asigna roles de acceso a la plataforma.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* CREATE FORM */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit">
                    <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                        <UserPlus className="h-5 w-5 text-[#183C30]" />
                        <span>Nuevo Usuario</span>
                    </h2>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-[#183C30] focus:border-[#183C30]"
                                placeholder="usuario@empresa.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-[#183C30] focus:border-[#183C30]"
                                placeholder="********"
                                minLength={6}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Rol Asignado</label>
                            <select
                                value={role}
                                onChange={e => setRole(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-[#183C30] focus:border-[#183C30]"
                            >
                                <option value="viewer">Visualizador (Restringido)</option>
                                <option value="admin">Administrador (Total)</option>
                                <option value="asesora">Asesora (Solo Registro Clientes)</option>
                            </select>
                        </div>
                        <button
                            disabled={isCreating}
                            type="submit"
                            className="w-full bg-[#183C30] text-white py-2.5 rounded-lg font-medium hover:bg-[#122e24] disabled:opacity-50 transition-colors"
                        >
                            {isCreating ? "Procesando..." : "Crear Usuario"}
                        </button>
                    </form>
                </div>

                {/* LIST */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                        <Shield className="h-5 w-5 text-[#183C30]" />
                        <span>Usuarios Activos</span>
                    </h2>
                    {isLoading ? <Loader2 className="animate-spin h-8 w-8 text-gray-400" /> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
                                    <tr>
                                        <th className="p-3 rounded-tl-lg">Email</th>
                                        <th className="p-3">Rol</th>
                                        <th className="p-3 rounded-tr-lg">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {users.map((u, i) => (
                                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-3 font-medium text-gray-800">{u.email}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                        u.role === 'asesora' ? 'bg-green-100 text-green-700' :
                                                            'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {u.role === 'admin' ? 'Administrador' :
                                                        u.role === 'asesora' ? 'Asesora' : 'Visualizador'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-sm text-green-600 flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                                                    Activo
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(u.email)}
                                                    className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 bg-red-50 rounded"
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="p-8 text-center text-gray-400">No se encontraron usuarios.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
