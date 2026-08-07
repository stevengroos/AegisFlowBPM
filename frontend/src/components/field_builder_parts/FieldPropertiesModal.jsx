import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, X, Plus, Trash2, Star, Calculator, LinkIcon, MapPin, Users, Phone, CircleDollarSign, Binary } from 'lucide-react'; 
import { PALETTE_ITEMS } from './Palette';

const FieldPropertiesModal = ({ 
  isOpen, 
  onClose, 
  editingField: initialEditingField, 
  setEditingField: parentSetEditingField, 
  onSave, 
  modulesList = [], 
  rolesList = [],   
  profilesList = [],
  localFields 
}) => {
  // 🔥 FIX CRÍTICO: Estado local para manejar el parseo seguro de las opciones
  const [editingField, setLocalEditingField] = useState(null);

  // Cuando el modal se abre, interceptamos los datos y forzamos el parseo de 'options'
  useEffect(() => {
    if (isOpen && initialEditingField) {
      let safeOptions = initialEditingField.options;
      
      // Si options viene como string JSON desde el backend, lo convertimos a Objeto
      if (typeof safeOptions === 'string' && safeOptions.trim().startsWith('{')) {
        try {
          safeOptions = JSON.parse(safeOptions);
        } catch (e) {
          console.warn("No se pudo parsear las opciones del campo:", e);
        }
      }

      setLocalEditingField({
        ...initialEditingField,
        options: safeOptions
      });
    }
  }, [isOpen, initialEditingField]);

  // Sincronizar el estado local con el padre
  const setEditingField = (newVal) => {
    setLocalEditingField(newVal);
    parentSetEditingField(newVal);
  };

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

  const numericFields = localFields.filter(f => f.field_type === 'number' && f.id !== editingField.id);

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-lg max-h-[90vh] shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
           <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Edit2 size={18} className="text-blue-500"/> Propiedades del Campo</h3>
           <button type="button" onClick={onClose} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
        </div>
        
        <form id="field-edit-form" onSubmit={onSave} className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
           
           <div>
             <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Etiqueta (Label)</label>
             <input type="text" required value={editingField.label || ''} onChange={(e) => setEditingField({...editingField, label: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-900 dark:text-white transition-all" />
           </div>
           
           {editingField.field_type === 'select' && (
             <div>
               <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Opciones (separadas por coma)</label>
               <textarea rows={3} value={editingField.options || ''} onChange={(e) => setEditingField({...editingField, options: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-900 dark:text-white transition-all" placeholder="Ej: Opción A, Opción B" />
             </div>
           )}

           {editingField.field_type === 'auto_number' && (
             <div className="bg-orange-50/50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/50 p-4 rounded-xl space-y-4">
               <label className="block text-xs font-bold text-orange-700 dark:text-orange-400 uppercase mb-1.5 flex items-center gap-1">
                 <Binary size={14}/> Secuencia Automática
               </label>
               <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-tight">
                 El sistema generará el número de forma automática al crear el registro. Este campo será de <span className="font-bold text-orange-500">Solo Lectura</span> en los formularios.
               </p>
               
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                 <div>
                   <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Prefijo</label>
                   <input type="text" placeholder="Ej: FAC-" value={editingField.options?.prefix || ''} onChange={(e) => setEditingField({...editingField, options: { ...editingField.options, prefix: e.target.value }})} className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-orange-500" />
                 </div>
                 
                 <div>
                   <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Inicia En</label>
                   <input type="number" min="1" placeholder="1" value={editingField.options?.starting_number || 1} onChange={(e) => setEditingField({...editingField, options: { ...editingField.options, starting_number: parseInt(e.target.value) || 1 }})} className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-orange-500" />
                 </div>

                 <div>
                   <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ceros Fijos</label>
                   <select value={editingField.options?.padding || 4} onChange={(e) => setEditingField({...editingField, options: { ...editingField.options, padding: parseInt(e.target.value) }})} className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-orange-500">
                     <option value={1}>0 (Ej: 1)</option>
                     <option value={2}>00 (Ej: 01)</option>
                     <option value={3}>000 (Ej: 001)</option>
                     <option value={4}>0000 (Ej: 0001)</option>
                     <option value={5}>00000 (Ej: 00001)</option>
                     <option value={6}>000000</option>
                   </select>
                 </div>
               </div>

               <div className="pt-2">
                 <p className="text-[10px] font-mono text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
                   Ejemplo Final: <span className="font-bold text-orange-600 dark:text-orange-400">{editingField.options?.prefix || ''}{(editingField.options?.starting_number || 1).toString().padStart(editingField.options?.padding || 4, '0')}</span>
                 </p>
               </div>
             </div>
           )}

           {editingField.field_type === 'phone' && (
             <div className="bg-teal-50/50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800/50 p-4 rounded-xl space-y-4">
               <label className="block text-xs font-bold text-teal-700 dark:text-teal-400 uppercase mb-1.5 flex items-center gap-1">
                 <Phone size={14}/> Configuración de Teléfono Internacional
               </label>
               <p className="text-xs text-gray-600 dark:text-gray-400">Selecciona el código de país que se mostrará por defecto.</p>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">País Predeterminado</label>
                   <select 
                     value={editingField.options?.default_country || 'PY'} 
                     onChange={(e) => setEditingField({...editingField, options: { ...editingField.options, default_country: e.target.value }})} 
                     className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                   >
                     <option value="PY">🇵🇾 Paraguay (+595)</option>
                     <option value="AR">🇦🇷 Argentina (+54)</option>
                     <option value="BR">🇧🇷 Brasil (+55)</option>
                     <option value="US">🇺🇸 EE.UU. (+1)</option>
                     <option value="MX">🇲🇽 México (+52)</option>
                     <option value="ES">🇪🇸 España (+34)</option>
                     <option value="CO">🇨🇴 Colombia (+57)</option>
                   </select>
                 </div>
                 
                 <div className="flex items-center gap-2 pt-5 cursor-pointer" onClick={() => setEditingField({...editingField, options: { ...editingField.options, restrict_country: !editingField.options?.restrict_country }})}>
                   <input type="checkbox" checked={editingField.options?.restrict_country || false} readOnly className="w-4 h-4 rounded text-teal-600 cursor-pointer" />
                   <label className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">Bloquear cambio de país</label>
                 </div>
               </div>
             </div>
           )}

           {editingField.field_type === 'currency' && (
             <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 p-4 rounded-xl space-y-4">
               <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 uppercase mb-1.5 flex items-center gap-1">
                 <CircleDollarSign size={14}/> Formato de Número y Moneda
               </label>
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Decimales</label>
                   <select value={editingField.options?.decimal_places ?? 2} onChange={(e) => setEditingField({...editingField, options: { ...editingField.options, decimal_places: parseInt(e.target.value) }})} className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-amber-500">
                     <option value={0}>0 (Solo Enteros)</option>
                     <option value={1}>1 Decimal (0.0)</option>
                     <option value={2}>2 Decimales (0.00)</option>
                     <option value={3}>3 Decimales (0.000)</option>
                     <option value={4}>4 Decimales (0.0000)</option>
                   </select>
                 </div>
                 
                 <div>
                   <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Símbolo</label>
                   <input type="text" value={editingField.options?.symbol ?? '$'} onChange={(e) => setEditingField({...editingField, options: { ...editingField.options, symbol: e.target.value }})} className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-amber-500" placeholder="Ej: $, €, Gs." />
                 </div>
                 
                 <div>
                   <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Separador de Miles</label>
                   <select value={editingField.options?.thousand_separator ?? '.'} onChange={(e) => setEditingField({...editingField, options: { ...editingField.options, thousand_separator: e.target.value }})} className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-amber-500">
                     <option value=".">Punto (1.000)</option>
                     <option value=",">Coma (1,000)</option>
                     <option value=" ">Espacio (1 000)</option>
                     <option value="">Sin separador (1000)</option>
                   </select>
                 </div>
                 
                 <div>
                   <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Separador Decimal</label>
                   <select value={editingField.options?.decimal_separator ?? ','} onChange={(e) => setEditingField({...editingField, options: { ...editingField.options, decimal_separator: e.target.value }})} className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-amber-500">
                     <option value=",">Coma (0,00)</option>
                     <option value=".">Punto (0.00)</option>
                   </select>
                 </div>
               </div>
             </div>
           )}

           {/* 🔥 FIX SUPREMO: CONFIGURACIÓN RELACIONAL (LOOKUP) 🔥 */}
           {editingField.field_type === 'relation' && (
             <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 p-4 rounded-xl">
               <label className="block text-xs font-bold text-blue-700 dark:text-blue-400 uppercase mb-1.5 flex items-center gap-1"><LinkIcon size={14}/> Módulo Destino (Lookup)</label>
               <select 
                 required 
                 value={editingField.options?.target_module_id || ''} 
                 onChange={(e) => {
                   const val = e.target.value ? parseInt(e.target.value, 10) : '';
                   setEditingField({
                     ...editingField, 
                     // Si no hay un objeto options previo, lo inicializamos
                     options: { ...(editingField.options || {}), target_module_id: val }
                   });
                 }} 
                 className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-900 dark:text-white transition-all"
               >
                 <option value="">Seleccione Módulo a vincular...</option>
                 {modulesList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
               </select>
               <p className="text-[10px] text-gray-500 mt-2">El usuario verá una lista desplegable con todos los registros del módulo seleccionado. Ideal para vincular "Clientes" o "Productores".</p>
             </div>
           )}

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
                     onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : '';
                        setEditingField({...editingField, options: { ...(editingField.options || {}), profile_id: val }});
                     }} 
                     className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                   >
                     <option value="">Cualquier Perfil</option>
                     {Array.isArray(profilesList) && profilesList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Filtrar por Rol</label>
                   <select 
                     value={editingField.options?.role_id || ''} 
                     onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : '';
                        setEditingField({...editingField, options: { ...(editingField.options || {}), role_id: val }});
                     }} 
                     className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                   >
                     <option value="">Cualquier Rol</option>
                     {Array.isArray(rolesList) && rolesList.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                   </select>
                 </div>
               </div>
               <p className="text-[10px] text-gray-500 dark:text-gray-500 italic mt-1 text-center">Si no seleccionas nada, el campo buscará entre todos los usuarios activos.</p>
             </div>
           )}

           {editingField.field_type === 'formula' && (
             <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 p-4 rounded-xl space-y-4">
               <div>
                  <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-1.5 flex items-center gap-1"><Calculator size={14}/> Editor de Fórmula Matemática</label>
                  <textarea required rows={2} value={typeof editingField.options === 'string' ? editingField.options : ''} onChange={(e) => setEditingField({...editingField, options: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-emerald-300 dark:border-emerald-700 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm text-gray-900 dark:text-white transition-all font-mono" placeholder="Ej: ([Precio] * [Volumen]) * 0.05" />
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

           {editingField.field_type === 'map' && (
             <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 p-4 rounded-xl">
               <label className="block text-xs font-bold text-red-700 dark:text-red-400 uppercase mb-1.5 flex items-center gap-1"><MapPin size={14}/> Campo Geográfico</label>
               <p className="text-xs text-gray-600 dark:text-gray-400">Este campo renderizará un mapa interactivo en el formulario. Al guardar, almacenará las coordenadas exactas de Latitud y Longitud.</p>
             </div>
           )}

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
                              {PALETTE_ITEMS.filter(p => !['subform', 'map', 'formula', 'user_relation', 'auto_number'].includes(p.type)).map(p => <option key={p.type} value={p.type}>{p.label}</option>)}
                           </select>
                           <button type="button" onClick={() => removeSubformCol(idx)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                         </div>
                         {col.type === 'select' && <input type="text" placeholder="Opciones (Ej: Opción 1, Opción 2)" value={col.options || ''} onChange={e => updateSubformCol(idx, 'options', e.target.value)} className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-blue-500" required />}
                         
                         {col.type === 'relation' && (
                           <select 
                             required 
                             value={col.target_module_id || ''} 
                             onChange={e => {
                                const val = e.target.value ? parseInt(e.target.value, 10) : '';
                                updateSubformCol(idx, 'target_module_id', val);
                             }} 
                             className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-blue-500"
                           >
                              <option value="">Seleccionar Módulo Destino...</option>
                              {modulesList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                           </select>
                         )}
                      </div>
                   ))}
                </div>
             </div>
           )}

           <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors" onClick={() => setEditingField({...editingField, is_primary: !editingField.is_primary})}>
                <input type="checkbox" checked={editingField.is_primary || false} readOnly className="w-4 h-4 rounded text-amber-500 cursor-pointer" />
                <div className="flex flex-col"><label className="text-sm font-bold text-amber-800 dark:text-amber-500 flex items-center gap-1.5 cursor-pointer"><Star size={16}/> Título Principal del Registro</label><span className="text-xs text-amber-600 dark:text-amber-600/70">Representará a todo el registro en el tablero Kanban.</span></div>
              </div>
              
              {editingField.field_type !== 'auto_number' && (
                <div className="flex items-center gap-3 px-2 cursor-pointer group" onClick={() => setEditingField({...editingField, required: !editingField.required})}>
                  <input type="checkbox" checked={editingField.required || false} readOnly className="w-4 h-4 rounded text-blue-600 cursor-pointer group-hover:ring-2 ring-blue-500/50" />
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">Marcar este campo como Obligatorio</label>
                </div>
              )}
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