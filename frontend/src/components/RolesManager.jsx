import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import { Shield, Plus, Trash2, Loader2, Settings2, Edit2, Save, X, ArrowDown } from 'lucide-react';
import ReactFlow, { Background, Controls, MarkerType, useNodesState, useEdgesState } from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

// 🔥 IMPORTAMOS NUESTRAS NOTIFICACIONES 🔥
import { useNotification } from '../context/NotificationContext';

const RolesManager = () => {
  const { notify, confirm } = useNotification();

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // 🔥 Protección anti doble-clic
  
  const [newRole, setNewRole] = useState({ name: '', parent_id: '' });
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedRole, setSelectedRole] = useState(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [editRoleData, setEditRoleData] = useState({ name: '', parent_id: '' });

  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // 🔥 Llamada a la API asegurada con AbortController 🔥
  const fetchRoles = useCallback(async (signal) => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/security/roles', { signal });
      setRoles(res.data || []);
    } catch (error) {
      if (error.name !== 'CanceledError') {
        notify.error("Error al cargar la jerarquía de roles.");
      }
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { 
    const controller = new AbortController();
    fetchRoles(controller.signal); 
    return () => controller.abort();
  }, [fetchRoles]);

  const getLayoutedElements = (nodes, edges, direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 100 });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: 180, height: 70 });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      node.targetPosition = 'top';
      node.sourcePosition = 'bottom';
      node.position = {
        x: nodeWithPosition.x - 180 / 2,
        y: nodeWithPosition.y - 70 / 2,
      };
      return node;
    });

    return { nodes, edges };
  };

  const generateGraph = useCallback((rolesList, dark) => {
    if (!rolesList || rolesList.length === 0) {
      setNodes([]); setEdges([]); return;
    }

    const initialNodes = [];
    const initialEdges = [];

    rolesList.forEach((role) => {
      initialNodes.push({
        id: role.id.toString(),
        data: {
           label: (
             <div className="text-center cursor-pointer px-2 py-1">
                <div className="font-bold text-gray-900 dark:text-white text-sm">{role.name}</div>
             </div>
           ),
           raw_data: role
        },
        type: 'default',
        position: { x: 0, y: 0 }, 
        style: {
           border: dark ? '2px solid #4b5563' : '2px solid #e5e7eb',
           borderRadius: '12px', padding: '10px',
           backgroundColor: dark ? '#1f2937' : 'white',
           minWidth: '180px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }
      });

      if (role.parent_id) {
        initialEdges.push({
          id: `e-${role.parent_id}-${role.id}`,
          source: role.parent_id.toString(), 
          target: role.id.toString(),
          type: 'smoothstep', 
          animated: true,
          style: { stroke: dark ? '#60a5fa' : '#2563eb', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: dark ? '#60a5fa' : '#2563eb' }
        });
      }
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (roles.length > 0) {
      generateGraph(roles, isDarkMode);
    } else {
      setNodes([]); setEdges([]);
    }
  }, [roles, isDarkMode, generateGraph]);


  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRole.name.trim()) return notify.warning("El nombre del rol es obligatorio.");
    
    setIsSaving(true);
    try {
      const payload = { 
          name: newRole.name, 
          parent_id: newRole.parent_id ? parseInt(newRole.parent_id) : null 
      };
      await api.post('/api/v1/security/roles', payload);
      notify.success("Nuevo rol creado exitosamente en el organigrama.");
      setNewRole({ name: '', parent_id: '' });
      setIsCreateOpen(false);
      fetchRoles(new AbortController().signal);
    } catch (error) { 
      notify.error(error.response?.data?.detail || "Error al crear el rol."); 
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!editRoleData.name.trim()) return notify.warning("El nombre del rol es obligatorio.");

    setIsSaving(true);
    try {
      const payload = { 
          name: editRoleData.name, 
          parent_id: editRoleData.parent_id ? parseInt(editRoleData.parent_id) : null 
      };
      await api.put(`/api/v1/security/roles/${selectedRole.id}`, payload);
      
      notify.success("Rol actualizado correctamente.");
      setIsEditingRole(false);
      setSelectedRole(prev => ({...prev, name: payload.name, parent_id: payload.parent_id}));
      fetchRoles(new AbortController().signal); 
    } catch (error) { 
      notify.error(error.response?.data?.detail || "Error al actualizar la jerarquía del rol."); 
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;
    
    const isConfirmed = await confirm({
      title: 'Eliminar Rol',
      message: `¿Estás seguro de que deseas eliminar el rol de "${selectedRole.name}"? Los roles y usuarios que dependían de este quedarán temporalmente aislados en el organigrama hasta que se les asigne un nuevo supervisor.`,
      confirmText: 'Sí, eliminar',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await api.delete(`/api/v1/security/roles/${selectedRole.id}`);
      notify.success("El rol ha sido eliminado del sistema.");
      setSelectedRole(null);
      fetchRoles(new AbortController().signal);
    } catch (error) { 
      notify.error(error.response?.data?.detail || "Error al intentar eliminar el rol."); 
    }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={32}/></div>;

  return (
    <div className="flex flex-col gap-6 p-6 h-full animate-in fade-in duration-300">
      
      {/* HEADER CON BOTONES GLOBALES DE ACCIÓN */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="text-blue-500" /> Organigrama de Roles
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Los roles superiores tienen visibilidad sobre los registros de quienes les reportan hacia abajo.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setIsEditingRole(true)} 
            disabled={!selectedRole}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm flex-1 md:flex-none justify-center ${selectedRole ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/30' : 'bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-transparent shadow-none'}`}
          >
            <Edit2 size={16} /> Editar
          </button>
          <button 
            onClick={handleDeleteRole} 
            disabled={!selectedRole}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm flex-1 md:flex-none justify-center ${selectedRole ? 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/30' : 'bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-transparent shadow-none'}`}
          >
            <Trash2 size={16} /> Eliminar
          </button>
          
          <div className="hidden md:block w-px h-8 bg-gray-200 dark:bg-gray-700 mx-1"></div>
          
          <button 
            onClick={() => setIsCreateOpen(true)} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm active:scale-95 flex-1 md:flex-none"
          >
            <Plus size={18} /> Nuevo Rol
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start flex-1 min-h-[600px] relative z-0">
        
        {/* PANEL IZQUIERDO: DETALLES DEL ROL */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm sticky top-6 h-[calc(100vh-12rem)] flex flex-col z-10 overflow-hidden">
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
            
            <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-2">
              <Settings2 size={14} /> Panel de Propiedades
            </h3>

            {!selectedRole ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-gray-900/50">
                 <Shield size={32} className="text-gray-300 dark:text-gray-700 mb-4" />
                 <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Ningún rol seleccionado</p>
                 <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Haz clic en una caja del organigrama de la derecha para ver sus detalles y opciones de edición.</p>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 animate-in fade-in">
                
                {/* INFO DEL ROL */}
                <div className="mb-5 border-b border-gray-200 dark:border-gray-700 pb-5">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider font-bold">Rol Actual</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white break-words">{selectedRole.name}</p>
                </div>
                
                {/* INFO JERÁRQUICA */}
                <div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider font-bold">Jefe Directo (Reporta a)</p>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 break-words flex items-center gap-2">
                    {selectedRole.parent_id ? (
                      <><Shield size={14} className="text-blue-500 opacity-70"/> {roles.find(r => r.id === selectedRole.parent_id)?.name}</>
                    ) : (
                      <span className="italic text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md text-xs">Nivel Más Alto (A Nadie)</span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PANEL DERECHO: LIENZO REACT FLOW */}
        <div 
          className="lg:col-span-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 overflow-hidden relative shadow-inner z-0" 
          style={{ height: 'calc(100vh - 12rem)', minHeight: '600px', width: '100%' }}
        >
          {roles.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
               <Shield size={48} className="mb-4 opacity-30 text-blue-500" />
               <p className="font-bold text-lg text-gray-900 dark:text-white">Organigrama Vacío</p>
               <p className="text-sm mt-1 max-w-md text-center">Comienza a definir la jerarquía de tu empresa creando tu primer rol directivo.</p>
            </div>
          ) : (
            <ReactFlow 
              nodes={nodes} 
              edges={edges} 
              onNodesChange={onNodesChange} 
              onEdgesChange={onEdgesChange} 
              onNodeClick={(e, n) => {
                const roleData = n.data.raw_data;
                setSelectedRole(roleData);
                setEditRoleData({ name: roleData.name, parent_id: roleData.parent_id || '' });
                setIsEditingRole(false);
              }}
              onPaneClick={() => {
                setSelectedRole(null);
                setIsEditingRole(false);
              }}
              fitView 
              attributionPosition="top"
              nodesDraggable={true} 
              nodesConnectable={false} 
            >
              <Background color={isDarkMode ? '#4b5563' : '#ccc'} gap={16} size={1} />
              <Controls className="dark:bg-gray-800 dark:text-white dark:border-gray-700 shadow-md" />
            </ReactFlow>
          )}
        </div>

      </div>

      {/* 🔥 MODAL FLOTANTE: CREAR ROL 🔥 */}
      {isCreateOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
               <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                 <Plus size={18} className="text-blue-500" /> Nuevo Rol
               </h3>
               <button onClick={() => setIsCreateOpen(false)} disabled={isSaving} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors disabled:opacity-50"><X size={18}/></button>
            </div>
            
            <form onSubmit={handleCreateRole} className="p-6 space-y-6">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Nombre del Rol <span className="text-red-500">*</span></label>
                <input type="text" required placeholder="Ej: Gerente de Ventas" value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})} className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all shadow-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><ArrowDown size={12}/> Reporta a (Jefe Directo)</label>
                <select value={newRole.parent_id} onChange={e => setNewRole({...newRole, parent_id: e.target.value})} className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all shadow-sm cursor-pointer">
                   <option value="">A nadie (Nivel Más Alto)</option>
                   {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsCreateOpen(false)} disabled={isSaving} className="flex-1 flex justify-center items-center gap-1.5 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 border border-gray-200 dark:border-gray-700">
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} className="flex-1 flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 disabled:opacity-70">
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Crear
                </button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

      {/* 🔥 MODAL FLOTANTE: EDITAR ROL 🔥 */}
      {isEditingRole && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200 overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
               <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                 <Edit2 size={18} className="text-blue-500" /> Editar Rol
               </h3>
               <button onClick={() => setIsEditingRole(false)} disabled={isSaving} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors disabled:opacity-50"><X size={18}/></button>
            </div>
            
            <form onSubmit={handleUpdateRole} className="p-6 space-y-6">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">Nombre del Rol <span className="text-red-500">*</span></label>
                <input type="text" required value={editRoleData.name} onChange={e => setEditRoleData({...editRoleData, name: e.target.value})} className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all shadow-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><ArrowDown size={12}/> Reporta a (Jefe Directo)</label>
                <select value={editRoleData.parent_id} onChange={e => setEditRoleData({...editRoleData, parent_id: e.target.value})} className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all shadow-sm cursor-pointer">
                   <option value="">A nadie (Nivel Más Alto)</option>
                   {roles.filter(r => r.id !== selectedRole.id).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsEditingRole(false)} disabled={isSaving} className="flex-1 flex justify-center items-center gap-1.5 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 border border-gray-200 dark:border-gray-700">
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} className="flex-1 flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 disabled:opacity-70">
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
                </button>
              </div>
            </form>
          </div>
        </div>, document.body
      )}

    </div>
  );
};

export default RolesManager;