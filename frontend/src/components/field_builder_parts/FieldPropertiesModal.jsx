import React from 'react';
import { createPortal } from 'react-dom';
import { Edit2, X, Plus, Trash2, Star, Calculator, LinkIcon, MapPin, Users } from 'lucide-react';
import { PALETTE_ITEMS } from './Palette';

const FieldPropertiesModal = ({ 
  isOpen, 
  onClose, 
  editingField, 
  setEditingField, 
  onSave, 
  modulesList = [], // 🔥 AÑADIR FALLBACK = []
  rolesList = [],   // 🔥 AÑADIR FALLBACK = []
  profilesList = [],// 🔥 AÑADIR FALLBACK = []
  localFields // Necesitamos conocer los otros campos para armar las Fórmulas
}) => {
  if (!isOpen || !editingField) return null;

  // Lógica de Subformularios
  const handleAddSubformColumn = () => setEditingField({ ...editingField, subform_config: [...(editingField.subform_config || []), { id: `col-${Date.now()}`, label: '', type: 'text', required: false, options: '', target_module_id: '' }] });
  const updateSubformCol = (index, key, value) => {
    const updated = [...(editingField.subform_config || [])];
    updated[index][key] = value;
    setEditingField({ ...editingField, subform_config: updated });
  };
  const removeSubformCol = (index) => {
    const updated = [...(editingField.subform_config || [])];
    updated.splice(index, 1);
    setEditingField({ ...editingField, subform_config: updated });
  };

  // Filtramos los campos numéricos para ayudar al usuario a armar fórmulas
  const numericFields = localFields.filter(f => f.field_type === 'number' && f.id !== editingField.id);

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-lg max-h-[90vh] shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
           <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Edit2 size={18} className="text-blue-500"/> Propiedades del Campo</h3>
           <button type="button" onClick={onClose} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
        </div>
        
        <form id="field-edit-form" onSubmit={onSave} className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
           
           {/* NOMBRE DEL CAMPO */}
           <div>
             <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Etiqueta (Label)</label>
             <input type="text" required value={editingField.label} onChange={(e) => setEditingField({...editingField, label: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-900 dark:text-white transition-all" />
           </div>
           
           {/* CONFIGURACIÓN DE LISTAS DESPLEGABLES */}
           {editingField.field_type === 'select' && (
             <div>
               <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Opciones (separadas por coma)</label>
               <textarea rows={3} value={editingField.options} onChange={(e) => setEditingField({...editingField, options: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-900 dark:text-white transition-all" placeholder="Ej: Opción A, Opción B" />
             </div>
           )}

           {/* 🔥 NUEVO: CONFIGURACIÓN RELACIONAL (LOOKUP) 🔥 */}
           {editingField.field_type === 'relation' && (
             <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 p-4 rounded-xl">
               <label className="block text-xs font-bold text-blue-700 dark:text-blue-400 uppercase mb-1.5 flex items-center gap-1"><LinkIcon size={14}/> Módulo Destino (Lookup)</label>
               <select required value={editingField.target_module_id || ''} onChange={(e) => setEditingField({...editingField, target_module_id: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-900 dark:text-white transition-all">
                 <option value="">Seleccione Módulo a vincular...</option>
                 {modulesList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
               </select>
               <p className="text-[10px] text-gray-500 mt-2">El usuario verá una lista desplegable con todos los registros del módulo seleccionado. Ideal para vincular "Clientes" o "Productores".</p>
             </div>
           )}

           {/* 🔥 NUEVO: CONFIGURACIÓN DE RELACIÓN CON USUARIOS 🔥 */}
           {editingField.field_type === 'user_relation' && (
             <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800/50 p-4 rounded-xl space-y-4">
               <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase mb-1.5 flex items-center gap-1">
                 <Users size={14}/> Configuración de Búsqueda de Usuarios
               </label>
               <p className="text-xs text-gray-600 dark:text-gray-400">Restringe los usuarios que aparecerán en el buscador de este campo.</p>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Filtrar por Perfil</label>
                   <select 
                     value={editingField.options?.profile_id || ''} 
                     onChange={(e) => setEditingField({...editingField, options: { ...editingField.options, profile_id: e.target.value }})} 
                     className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                   >
                     <option value="">Cualquier Perfil</option>
                     {/* Nos aseguramos de que sea un array y tenga datos antes de mapear */}
                     {Array.isArray(profilesList) && profilesList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Filtrar por Rol</label>
                   <select 
                     value={editingField.options?.role_id || ''} 
                     onChange={(e) => setEditingField({...editingField, options: { ...editingField.options, role_id: e.target.value }})} 
                     className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                   >
                     <option value="">Cualquier Rol</option>
                     {/* Nos aseguramos de que sea un array y tenga datos antes de mapear */}
                     {Array.isArray(rolesList) && rolesList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                   </select>
                 </div>
               </div>
               <p className="text-[10px] text-gray-500 dark:text-gray-500 italic mt-1 text-center">Si no seleccionas nada, el campo buscará entre todos los usuarios activos.</p>
             </div>
           )}

           {/* 🔥 NUEVO: CONFIGURACIÓN DE FÓRMULAS MATEMÁTICAS 🔥 */}
           {editingField.field_type === 'formula' && (
             <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 p-4 rounded-xl space-y-4">
               <div>
                  <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-1.5 flex items-center gap-1"><Calculator size={14}/> Editor de Fórmula Matemática</label>
                  <textarea required rows={2} value={editingField.options} onChange={(e) => setEditingField({...editingField, options: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-emerald-300 dark:border-emerald-700 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm text-gray-900 dark:text-white transition-all font-mono" placeholder="Ej: ([Precio] * [Volumen]) * 0.05" />
               </div>
               
               <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Campos Numéricos Disponibles (Haz clic para insertar):</p>
                  <div className="flex flex-wrap gap-2">
                     {numericFields.length === 0 ? <span className="text-xs text-gray-400">No hay otros campos numéricos en este formulario.</span> : null}
                     {numericFields.map(f => (
                        <button type="button" key={f.id} onClick={() => setEditingField({...editingField, options: `${editingField.options || ''} [${f.api_name || f.label}] `})} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-mono rounded text-gray-700 dark:text-gray-300 transition-colors">
                           [{f.api_name || f.label}]
                        </button>
                     ))}
                  </div>
               </div>
             </div>
           )}

           {/* 🔥 NUEVO: CONFIGURACIÓN DE GEOLOCALIZACIÓN 🔥 */}
           {editingField.field_type === 'map' && (
             <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 p-4 rounded-xl">
               <label className="block text-xs font-bold text-red-700 dark:text-red-400 uppercase mb-1.5 flex items-center gap-1"><MapPin size={14}/> Campo Geográfico</label>
               <p className="text-xs text-gray-600 dark:text-gray-400">Este campo renderizará un mapa interactivo en el formulario. Al guardar, almacenará las coordenadas exactas de Latitud y Longitud.</p>
             </div>
           )}

           {/* CONFIGURACIÓN DE TABLAS (SUBFORMULARIOS) */}
           {editingField.field_type === 'subform' && (
             <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                   <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Columnas de la Tabla</label>
                   <button type="button" onClick={handleAddSubformColumn} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1 transition-colors"><Plus size={14}/> Agregar Columna</button>
                </div>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                   {(editingField.subform_config || []).map((col, idx) => (
                      <div key={col.id} className="flex flex-col gap-2 bg-white dark:bg-gray-950 p-3 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                         <div className="flex gap-2 items-center">
                           <input type="text" placeholder="Nombre Columna" value={col.label} onChange={e => updateSubformCol(idx, 'label', e.target.value)} className="flex-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-blue-500" required/>
                           <select value={col.type} onChange={e => updateSubformCol(idx, 'type', e.target.value)} className="w-36 px-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-blue-500">
                              {PALETTE_ITEMS.filter(p => p.type !== 'subform').map(p => <option key={p.type} value={p.type}>{p.label}</option>)}
                           </select>
                           <button type="button" onClick={() => removeSubformCol(idx)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                         </div>
                         {col.type === 'select' && <input type="text" placeholder="Opciones (Ej: Opción 1, Opción 2)" value={col.options || ''} onChange={e => updateSubformCol(idx, 'options', e.target.value)} className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-blue-500" required />}
                         {col.type === 'relation' && (
                           <select required value={col.target_module_id || ''} onChange={e => updateSubformCol(idx, 'target_module_id', e.target.value)} className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-blue-500">
                              <option value="">Seleccionar Módulo Destino...</option>
                              {modulesList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                           </select>
                         )}
                      </div>
                   ))}
                </div>
             </div>
           )}

           {/* CONTROLES GENERALES (OBLIGATORIO, PRINCIPAL, ETC) */}
           <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors" onClick={() => setEditingField({...editingField, is_primary: !editingField.is_primary})}>
                <input type="checkbox" checked={editingField.is_primary || false} readOnly className="w-4 h-4 rounded text-amber-500 cursor-pointer" />
                <div className="flex flex-col"><label className="text-sm font-bold text-amber-800 dark:text-amber-500 flex items-center gap-1.5 cursor-pointer"><Star size={16}/> Título Principal del Registro</label><span className="text-xs text-amber-600 dark:text-amber-600/70">Representará a todo el registro en el tablero Kanban.</span></div>
              </div>
              <div className="flex items-center gap-3 px-2 cursor-pointer group" onClick={() => setEditingField({...editingField, required: !editingField.required})}>
                <input type="checkbox" checked={editingField.required || false} readOnly className="w-4 h-4 rounded text-blue-600 cursor-pointer group-hover:ring-2 ring-blue-500/50" />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">Marcar este campo como Obligatorio</label>
              </div>
           </div>

        </form>
        
        <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 shrink-0 flex justify-end gap-3">
           <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors">Cancelar</button>
           <button type="submit" form="field-edit-form" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors active:scale-95">Aplicar Cambios</button>
        </div>
      </div>
    </div>, document.body
  );
};

export default FieldPropertiesModal;