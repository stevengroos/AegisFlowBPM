import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useNotification } from '../context/NotificationContext';
import { Building2, Plus, Edit, ShieldCheck, ShieldAlert, Search } from 'lucide-react';

export default function CompaniesManager() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({ name: '', is_active: true });
  
  // 🔥 Extraemos el objeto notify directamente de tu contexto
  const { notify } = useNotification();

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/companies/', { params: search ? { search } : {} });
      setCompanies(res.data);
    } catch (err) {
      console.error(err);
      notify.error('Error al cargar las empresas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [search]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingCompany) {
        await api.put(`/api/v1/companies/${editingCompany.id}`, formData);
        // 🔥 Usamos .success() para la notificación bonita
        notify.success('Empresa actualizada con éxito');
      } else {
        await api.post('/api/v1/companies/', formData);
        notify.success('Empresa creada con éxito');
      }
      setIsModalOpen(false);
      setEditingCompany(null);
      setFormData({ name: '', is_active: true });
      fetchCompanies();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Error al guardar la empresa';
      // 🔥 Usamos .error() para fallos
      notify.error(errorMsg);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <Building2 className="text-blue-600" /> Gestión de Empresas (Tenants)
          </h1>
          <p className="text-sm text-gray-500">Panel exclusivo de Súper Administración para control multi-empresa.</p>
        </div>
        <button
          onClick={() => {
            setEditingCompany(null);
            setFormData({ name: '', is_active: true });
            setIsModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition"
        >
          <Plus size={18} /> Nueva Empresa
        </button>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Buscar empresa por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 text-xs uppercase tracking-wider">
              <th className="p-4">ID</th>
              <th className="p-4">Nombre de la Empresa</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            {companies.map((comp) => (
              <tr key={comp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="p-4 font-mono text-gray-500">#{comp.id}</td>
                <td className="p-4 font-medium text-gray-900 dark:text-white">{comp.name}</td>
                <td className="p-4">
                  {comp.is_system_company ? (
                    <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2.5 py-1 rounded-full text-xs font-semibold">HQ Principal</span>
                  ) : (
                    <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2.5 py-1 rounded-full text-xs font-semibold">Cliente B2B</span>
                  )}
                </td>
                <td className="p-4">
                  {comp.is_active ? (
                    <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><ShieldCheck size={14} /> Activa</span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-500 text-xs font-medium"><ShieldAlert size={14} /> Inactiva</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => {
                      setEditingCompany(comp);
                      setFormData({ name: comp.name, is_active: comp.is_active });
                      setIsModalOpen(true);
                    }}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition"
                  >
                    <Edit size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-md shadow-xl border dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              {editingCompany ? 'Editar Empresa' : 'Registrar Nueva Empresa'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Nombre de la Empresa</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  placeholder="Ej. Logística Global S.A."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">Empresa Activa</label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}