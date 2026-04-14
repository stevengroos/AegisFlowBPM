import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { X, Loader2, ArrowLeft, FileText, ChevronRight, Link as LinkIcon, Search, ChevronDown, Trash2, Plus, Users, Link2, LayoutGrid } from 'lucide-react';

// 🔥 1. IMPORTAMOS NUESTRAS NOTIFICACIONES 🔥
import { useNotification } from '../context/NotificationContext';
import FileUploadField from '../components/ui/FileUploadField'; // 🔥 Importamos el componente con IA

// ==========================================
// COMPONENTES AUXILIARES (Archivos y Selects)
// ==========================================


const SearchableSelect = ({ options, value, onChange, disabled, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Validación segura para evitar crasheos si options no es array
  const safeOptions = Array.isArray(options) ? options : [];
  const selectedOption = safeOptions.find(opt => opt.value == value);
  const displayValue = selectedOption ? selectedOption.label : '';
  const filteredOptions = safeOptions.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div onClick={() => !disabled && setIsOpen(!isOpen)} className={`w-full px-4 py-2.5 bg-blue-50/30 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/50 rounded-xl text-sm text-gray-700 dark:text-gray-200 transition-colors flex justify-between items-center ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-500'}`}>
        <span className={`truncate ${selectedOption ? '' : 'text-gray-400 dark:text-gray-500'}`}>{selectedOption ? displayValue : placeholder}</span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in duration-100">
          <div className="sticky top-0 bg-white dark:bg-gray-800 p-2 border-b border-gray-100 dark:border-gray-700 z-10"><div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-gray-400" /><input type="text" autoFocus className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-200" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()}/></div></div>
          <div className="p-1">{filteredOptions.length === 0 ? <div className="px-3 py-4 text-sm text-gray-500 text-center italic">No hay resultados</div> : filteredOptions.map(opt => (<div key={opt.value} className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors truncate ${value == opt.value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`} onClick={() => {onChange(opt.value); setIsOpen(false); setSearchTerm('');}}>{opt.label}</div>))}</div>
        </div>
      )}
    </div>
  );
};


// ==========================================
// COMPONENTE SUBFORMULARIO (TABLA)
// ==========================================
const SubformTable = ({ field, value, onChange, relationData }) => {
  const rows = Array.isArray(value) ? value : [];
  
  // Validación segura
  let columns = [];
  if (Array.isArray(field.subform_config)) {
    columns = field.subform_config;
  } else if (typeof field.subform_config === 'string') {
    try { columns = JSON.parse(field.subform_config); } catch (e) {}
  }
  
  if (columns.length === 0) return <div className="p-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-center text-sm text-gray-400">Subformulario sin columnas configuradas.</div>;

  const handleAddRow = () => {
    const newRow = {};
    columns.forEach(col => newRow[col.label] = '');
    onChange([...rows, newRow]);
  };

  const handleRemoveRow = (index) => {
    const updated = [...rows];
    updated.splice(index, 1);
    onChange(updated);
  };

  const handleChangeCell = (index, colLabel, newValue) => {
    const updated = [...rows];
    updated[index][colLabel] = newValue;
    onChange(updated);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-900 shadow-sm col-span-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">
            <tr>
              {columns.map((col, i) => <th key={i} className="px-4 py-3 font-bold">{col.label}</th>)}
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                {columns.map((col, cIdx) => {
                  const cellValue = row[col.label] || '';
                  const inputClass = "w-full px-3 py-1.5 bg-transparent border-0 border-b border-transparent focus:border-blue-500 hover:border-gray-300 dark:hover:border-gray-600 focus:ring-0 outline-none text-sm text-gray-900 dark:text-white transition-colors";
                  
                  return (
                    <td key={cIdx} className="px-4 py-2 align-top">
                       {col.type === 'select' ? (
                          <select value={cellValue} onChange={e => handleChangeCell(rIdx, col.label, e.target.value)} className={inputClass}>
                             <option value="">...</option>
                             {/* Safe mapping */}
                             {(typeof col.options === 'string' ? col.options.split(',') : (Array.isArray(col.options) ? col.options : [])).map((o, i) => <option key={i} value={o.trim()}>{o.trim()}</option>)}
                          </select>
                       ) : col.type === 'relation' ? (
                          <select value={cellValue} onChange={e => handleChangeCell(rIdx, col.label, e.target.value)} className={inputClass}>
                             <option value="">Seleccionar...</option>
                             {(relationData[col.target_module_id] || []).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                       ) : col.type === 'file' || col.type === 'image' ? (
                          <div className="min-w-[200px]">
                            <FileUploadField type={col.type} value={cellValue} onChange={val => handleChangeCell(rIdx, col.label, val)} disabled={false} />
                          </div>
                       ) : (
                          <input type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'} value={cellValue} onChange={e => handleChangeCell(rIdx, col.label, e.target.value)} className={inputClass} placeholder={`Escribir ${col.label.toLowerCase()}`} />
                       )}
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-right align-top pt-4">
                  <button type="button" onClick={() => handleRemoveRow(rIdx)} className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
        <button type="button" onClick={handleAddRow} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1.5 transition-colors"><Plus size={14}/> Agregar Fila</button>
      </div>
    </div>
  );
};


// ==========================================
// COMPONENTE PRINCIPAL: MODAL DE CASO
// ==========================================
const CaseModal = ({ isOpen, onClose, onSuccess, moduleId }) => {
  const { notify } = useNotification();
  const [step, setStep] = useState(1);
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  
  const [templateSearch, setTemplateSearch] = useState('');
  
  const [fields, setFields] = useState([]);
  const [sections, setSections] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [relationData, setRelationData] = useState({});
  
  const [companyUsers, setCompanyUsers] = useState([]);
  const [assignedTo, setAssignedTo] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep(1); setSelectedForm(null); setFormData({});
      setRelationData({}); setAssignedTo(''); setTemplateSearch('');
      fetchForms();
      fetchUsers(); 
    }
  }, [isOpen, moduleId]); 

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/v1/auth/users');
      setCompanyUsers(res.data);
    } catch (error) { console.warn(error); }
  };

  const fetchForms = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/v1/forms/?module_id=${moduleId}`);
      setForms(res.data);
    } catch (error) { 
      notify.error("Error al cargar los formularios."); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSelectForm = async (form) => {
    setSelectedForm(form); setLoading(true); setStep(2);
    try {
      const [fldRes, secRes] = await Promise.all([
         api.get(`/api/v1/fields/?form_id=${form.id}&include_inactive=false`),
         api.get(`/api/v1/fields/sections?form_id=${form.id}`)
      ]);
      
      const formFields = fldRes.data || [];
      setFields(formFields);
      setSections(secRes.data || []);
      
      const initialData = {};
      const relData = {}; 
      
      for (const f of formFields) {
        const fieldKey = f.api_name || f.label;
        if (!fieldKey) continue;
        
        if (f.field_type === 'checkbox') initialData[fieldKey] = false;
        else if (f.field_type === 'subform') initialData[fieldKey] = [];
        else initialData[fieldKey] = '';

        if (f.field_type === 'relation' && f.options?.target_module_id) {
          const targetModuleId = f.options.target_module_id;
          if (!relData[targetModuleId]) await loadTargetModuleData(targetModuleId, relData);
        }
        
        let safeSubform = f.subform_config;
        if (typeof safeSubform === 'string') { try { safeSubform = JSON.parse(safeSubform); } catch(e){} }
        
        if (f.field_type === 'subform' && Array.isArray(safeSubform)) {
           for (const subCol of safeSubform) {
              if (subCol.type === 'relation' && subCol.target_module_id) {
                 const targetModuleId = subCol.target_module_id;
                 if (!relData[targetModuleId]) await loadTargetModuleData(targetModuleId, relData);
              }
           }
        }
      }
      setRelationData(relData); setFormData(initialData);
    } catch (error) { 
      notify.error("No se pudo cargar la estructura de la plantilla.");
      setStep(1); 
    } finally { setLoading(false); }
  };

  const loadTargetModuleData = async (targetModuleId, relDataMap) => {
      try {
        const [recRes, fieldsRes] = await Promise.all([
          api.get(`/api/v1/cases/?module_id=${targetModuleId}`),
          api.get(`/api/v1/fields/?module_id=${targetModuleId}`)
        ]);
        const targetFields = fieldsRes.data || [];
        const primaryField = targetFields.find(tf => tf.is_primary);
        const primaryKey = primaryField ? (primaryField.api_name || primaryField.label) : null;

        relDataMap[targetModuleId] = (recRes.data || []).map(rec => {
           let displayLabel = `Registro #${rec.id}`; 
           if (primaryKey && rec.data && rec.data[primaryKey]) displayLabel = `ID: ${rec.id} - ${rec.data[primaryKey]}`;
           return { value: rec.id, label: `${displayLabel} ${rec.status?.name ? `(${rec.status.name})` : ''}` };
        });
      } catch (err) { relDataMap[targetModuleId] = []; }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setLoading(true);
    try {
      await api.post('/api/v1/cases/', { 
        form_id: selectedForm.id, 
        module_id: moduleId, 
        data: formData,
        assigned_to: assignedTo ? parseInt(assignedTo) : null 
      });
      notify.success("Registro creado con éxito.");
      onSuccess(); 
      onClose();
    } catch (error) { 
      const errorMsg = error.response?.data?.detail || "Error desconocido al crear el registro.";
      notify.error(`Fallo en la creación: ${errorMsg}`); 
    } finally { 
      setLoading(false); 
    }
  };

  if (!isOpen) return null;

  const filteredForms = forms.filter(f => f.name.toLowerCase().includes(templateSearch.toLowerCase()) || (f.description && f.description.toLowerCase().includes(templateSearch.toLowerCase())));
  const fieldsToShow = fields.filter(f => f.show_in_create !== false).sort((a,b) => a.order - b.order);
  const inputClasses = "w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-700 dark:text-gray-200";

  const renderField = (field) => {
      const fieldKey = field.api_name || field.label;
      if (!fieldKey) return null;
      const isFullWidth = field.field_type === 'textarea' || field.field_type === 'subform';
      
      // Sanitizamos opciones para evitar el map de strings
      let renderOptions = [];
      if (Array.isArray(field.options)) renderOptions = field.options;
      else if (typeof field.options === 'string') renderOptions = field.options.split(',');

      return (
        <div key={field.id} className={`${isFullWidth ? 'col-span-full' : ''} space-y-1.5`}>
          <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight">
            {field.field_type === 'relation' && <LinkIcon size={12} className="text-blue-500" />}
            {field.label} {field.required && <span className="text-red-500 dark:text-red-400">*</span>}
          </label>
          
          {field.field_type === 'select' ? (
            <select required={field.required} value={formData[fieldKey] || ''} onChange={(e) => setFormData({...formData, [fieldKey]: e.target.value})} className={inputClasses}>
              <option value="">Selecciona una opción...</option>
              {renderOptions.map((opt, i) => <option key={i} value={typeof opt === 'string' ? opt.trim() : opt}>{typeof opt === 'string' ? opt.trim() : opt}</option>)}
            </select>
          ) : field.field_type === 'relation' ? (
            <SearchableSelect placeholder="Enlazar con un registro..." value={formData[fieldKey] || ''} onChange={(val) => setFormData({...formData, [fieldKey]: val})} disabled={false} options={relationData[field.options?.target_module_id] || []} />
          ) : field.field_type === 'textarea' ? (
            <textarea required={field.required} value={formData[fieldKey] || ''} onChange={(e) => setFormData({...formData, [fieldKey]: e.target.value})} rows={3} className={inputClasses} />
          ) : field.field_type === 'checkbox' ? (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
              <input type="checkbox" checked={formData[fieldKey] || false} onChange={(e) => setFormData({...formData, [fieldKey]: e.target.checked})} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-blue-600 focus:ring-blue-500 cursor-pointer" />
              <span className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer" onClick={() => setFormData({...formData, [fieldKey]: !formData[fieldKey]})}>Marcar como verdadero</span>
            </div>
          ) : field.field_type === 'file' || field.field_type === 'image' ? (
            <FileUploadField 
               type={field.field_type} 
               value={formData[fieldKey] || ''} 
               onChange={(url) => setFormData({...formData, [fieldKey]: url})} 
               disabled={false} 
               // 🔥 FASE 3.3: Le pasamos los campos que se muestran en el modal de creación
               expectedFields={fieldsToShow.filter(f => !['file', 'image', 'subform', 'url'].includes(f.field_type)).map(f => f.api_name || f.label)}
               // 🔥 FASE 3.3: Autocompletamos el formulario
               onDataExtracted={(aiData) => setFormData(prev => ({ ...prev, ...aiData }))}
            />
          ) : field.field_type === 'url' ? (
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="url" required={field.required} value={formData[fieldKey] || ''} onChange={(e) => setFormData({...formData, [fieldKey]: e.target.value})} className={`${inputClasses} pl-9`} placeholder="https://" />
            </div>
          ) : field.field_type === 'subform' ? (
            <SubformTable field={field} value={formData[fieldKey] || []} onChange={(val) => setFormData({...formData, [fieldKey]: val})} relationData={relationData} />
          ) : (
            <input type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : field.field_type === 'email' ? 'email' : 'text'} required={field.required} value={formData[fieldKey] || ''} onChange={(e) => setFormData({...formData, [fieldKey]: e.target.value})} className={inputClasses} />
          )}
        </div>
      );
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-[90] p-4 transition-colors duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl dark:shadow-black/50 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-transparent dark:border-gray-800 transition-colors duration-300">
        
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
          <div className="flex items-center gap-3">
            {step === 2 && <button type="button" onClick={() => setStep(1)} className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600 shadow-sm"><ArrowLeft size={18} /></button>}
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {step === 1 ? 'Selecciona una plantilla' : `Nuevo Registro: ${selectedForm?.name}`}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {step === 1 ? 'Elige el tipo de entrada para este módulo' : 'Completa la información requerida'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-full transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"><X size={20} className="text-gray-400 dark:text-gray-500" /></button>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-gray-900/50 flex flex-col custom-scrollbar">
            {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400 dark:text-gray-500" /></div> : forms.length === 0 ? (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400 text-sm italic">No hay plantillas configuradas para este módulo.</div>
            ) : (
              <>
                <div className="mb-5 relative shrink-0">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="text" placeholder="Buscar plantilla..." value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} autoFocus className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 dark:text-white shadow-sm" />
                </div>
                <div className="space-y-3">
                  {filteredForms.length === 0 ? <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400 italic">No se encontraron plantillas.</div> : filteredForms.map(form => (
                    <button type="button" key={form.id} onClick={() => handleSelectForm(form)} className="w-full text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800/80 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md p-4 rounded-xl transition-all group flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors"><FileText size={22} /></div>
                      <div className="flex-1 min-w-0"><h3 className="font-bold text-gray-900 dark:text-white text-base truncate">{form.name}</h3><p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{form.description || "Crear registro usando esta plantilla"}</p></div>
                      <div className="w-8 flex justify-end"><ChevronRight size={20} className="text-gray-300 dark:text-gray-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" /></div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <form id="case-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 bg-gray-50/50 dark:bg-gray-950 custom-scrollbar space-y-6">
            {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400 dark:text-gray-500" /></div> : (
              <>
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                   <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><LayoutGrid size={16} className="text-blue-500"/> Información del Sistema</h3>
                   <div className="space-y-1.5 max-w-sm">
                     <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight"><Users size={12} className="text-blue-500" /> Propietario / Asignado A</label>
                     <SearchableSelect placeholder="Buscar usuario..." value={assignedTo} onChange={(val) => setAssignedTo(val)} disabled={false} options={companyUsers.map(u => ({ value: u.id, label: u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.email }))} />
                   </div>
                </div>

                {(sections.length > 0 ? sections : [{ id: null, title: 'Información General', columns: 2 }]).map((section, sIdx) => {
                   const sFields = fieldsToShow.filter(f => f.section_id === section.id || (!f.section_id && section.id === null));
                   if (sFields.length === 0) return null;
                   
                   const gridClass = section.columns === 1 ? 'grid-cols-1' : section.columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

                   return (
                     <div key={section.id || sIdx} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">{section.title}</h3>
                        <div className={`grid gap-x-6 gap-y-5 ${gridClass}`}>
                           {sFields.map(renderField)}
                        </div>
                     </div>
                   );
                })}
              </>
            )}
          </form>
        )}

        {/* FOOTER */}
        {step === 2 && (
          <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={() => { setStep(1); setFormData({}); }} className="px-5 py-2.5 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Atrás</button>
            <button form="case-form" type="submit" disabled={loading || fieldsToShow.length === 0} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50">{loading ? 'Creando...' : 'Crear Registro'}</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseModal;