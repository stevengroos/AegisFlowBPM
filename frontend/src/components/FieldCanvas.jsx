import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import { LayoutGrid, Trash2, Edit2, X, RotateCcw, Eye, EyeOff, FileText, ArrowLeft, Database, CopyPlus, Link as LinkIcon, Star, Plus, GripVertical, Save, Loader2, Link2, Type, AlignLeft, Hash, Calendar, CheckSquare, List, Image, FileBox, TableProperties, AlertTriangle, UploadCloud, DownloadCloud, ArchiveRestore, CheckCircle } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, useDraggable } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useNotification } from '../context/NotificationContext';

const PALETTE_ITEMS = [
  { type: 'text', icon: <Type size={16}/>, label: 'Texto Corto' },
  { type: 'textarea', icon: <AlignLeft size={16}/>, label: 'Texto Largo' },
  { type: 'number', icon: <Hash size={16}/>, label: 'Número' },
  { type: 'date', icon: <Calendar size={16}/>, label: 'Fecha' },
  { type: 'select', icon: <List size={16}/>, label: 'Desplegable' },
  { type: 'checkbox', icon: <CheckSquare size={16}/>, label: 'Casilla (Sí/No)' },
  { type: 'url', icon: <Link2 size={16}/>, label: 'Enlace Web' },
  { type: 'relation', icon: <LinkIcon size={16}/>, label: 'Relacional (Lookup)' },
  { type: 'file', icon: <FileBox size={16}/>, label: 'Archivo Adjunto' },
  { type: 'image', icon: <Image size={16}/>, label: 'Imagen' },
  { type: 'subform', icon: <TableProperties size={16}/>, label: 'Subformulario (Tabla)' }
];

const PaletteItem = ({ item, onClick }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { type: item.type, label: item.label, icon: item.icon }
  });
  return (
    <button ref={setNodeRef} {...listeners} {...attributes} onClick={onClick} className={`w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-400 transition-all text-left group ${isDragging ? 'opacity-50' : ''}`}>
      <span className="text-gray-400 group-hover:text-blue-500 transition-colors">{item.icon}</span>{item.label}
    </button>
  );
};

const SortableFieldCard = ({ field, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `field-${field.id}` });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const getFieldTypeIcon = (type) => { const found = PALETTE_ITEMS.find(p => p.type === type); return found ? found.icon : <Type size={14} />; };

  return (
    <div ref={setNodeRef} style={style} className={`bg-white dark:bg-gray-800 border rounded-xl shadow-sm group relative overflow-hidden flex flex-col ${field.is_primary ? 'border-amber-300 dark:border-amber-600 ring-1 ring-amber-100 dark:ring-amber-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
      <div className={`px-2 py-1.5 border-b flex justify-between items-center ${field.is_primary ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50' : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800'}`}>
        <div {...attributes} {...listeners} className="p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"><GripVertical size={14} /></div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(field)} className="p-1 text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={12} /></button>
          <button onClick={() => onDelete(field.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
        </div>
      </div>
      <div className="p-3 cursor-pointer" onClick={() => onEdit(field)}>
        <label className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5 truncate cursor-pointer">
          {field.is_primary && <Star size={12} className="text-amber-500 shrink-0" fill="currentColor" />}
          <span className="text-gray-400 shrink-0">{getFieldTypeIcon(field.field_type)}</span>
          <span className="truncate">{field.label || 'Sin Nombre'}</span>
          {field.required && <span className="text-red-500">*</span>}
        </label>
        <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 mt-1 truncate">api: {field.api_name || 'auto'}</p>
        {!field.show_in_create && <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400"><EyeOff size={10} /> Oculto en creación</div>}
      </div>
    </div>
  );
};

const SortableSection = ({ section, fields, onEditField, onDeleteField, onEditSection, onDeleteSection }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `section-${section.id}` });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const sectionFields = fields.filter(f => f.section_id === section.id).sort((a, b) => a.order - b.order);
  const gridColsClass = section.columns === 1 ? 'grid-cols-1' : section.columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div ref={setNodeRef} style={style} className="bg-gray-50/50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden mb-6">
      <div className="bg-white dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center group">
        <div className="flex items-center gap-3">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"><GripVertical size={16} /></div>
          <h3 className="font-bold text-gray-900 dark:text-white">{section.title}</h3>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEditSection(section)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>
          <button onClick={() => onDeleteSection(section.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
        </div>
      </div>
      <div className={`p-4 min-h-[120px] ${sectionFields.length === 0 ? 'flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-800 m-4 rounded-xl bg-white/50 dark:bg-gray-900/50' : ''}`}>
        <SortableContext items={sectionFields.map(f => `field-${f.id}`)} strategy={verticalListSortingStrategy}>
          <div className={`grid gap-4 w-full ${gridColsClass}`}>
            {sectionFields.map(f => <SortableFieldCard key={f.id} field={f} onEdit={onEditField} onDelete={onDeleteField} />)}
            {sectionFields.length === 0 && <span className="text-xs text-gray-400 font-bold uppercase tracking-widest text-center">Arrastra campos aquí</span>}
          </div>
        </SortableContext>
      </div>
    </div>
  );
};

// 🔥 AÑADIDA LA PROP setHasUnsavedChanges 🔥
const FieldCanvas = ({ selectedForm, onCloseCanvas, fetchFields, setHasUnsavedChanges }) => {
  const { notify, confirm } = useNotification(); 

  const [localSections, setLocalSections] = useState([]);
  const [localFields, setLocalFields] = useState([]);
  const [inactiveFields, setInactiveFields] = useState([]); 
  
  const [deletedSectionIds, setDeletedSectionIds] = useState([]);
  const [deletedFieldIds, setDeletedFieldIds] = useState([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false); 
  const [hasChanges, setHasChanges] = useState(false); 
  const [activeDragItem, setActiveDragItem] = useState(null);
  
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showArchivedModal, setShowArchivedModal] = useState(false); 
  const [importSummary, setImportSummary] = useState(null); 
  
  const [modulesList, setModulesList] = useState([]);
  const fileInputRef = useRef(null);

  // Helper para centralizar el cambio de estado de guardado
  const markAsChanged = () => {
    setHasChanges(true);
    if (setHasUnsavedChanges) setHasUnsavedChanges(true); // 🔥 Avisar al padre
  };

  const markAsSaved = () => {
    setHasChanges(false);
    if (setHasUnsavedChanges) setHasUnsavedChanges(false); // 🔥 Avisar al padre
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const loadData = async (signal) => {
    try {
      const [secRes, fldResAll, modRes] = await Promise.all([
        api.get(`/api/v1/fields/sections?form_id=${selectedForm.id}`, { signal }),
        api.get(`/api/v1/fields/?form_id=${selectedForm.id}&include_inactive=true`, { signal }), 
        api.get('/api/v1/modules/', { signal })
      ]);
      
      let loadedSections = secRes.data;
      if (loadedSections.length === 0) {
         loadedSections = [{ id: 'temp-sec-1', title: 'Información General', order: 0, columns: 2 }];
         markAsChanged(); // 🔥
      }
      setLocalSections(loadedSections);
      
      const activeF = fldResAll.data.filter(f => f.is_active);
      const inactiveF = fldResAll.data.filter(f => !f.is_active);
      setLocalFields(activeF);
      setInactiveFields(inactiveF);
      
      setModulesList(modRes.data);
      setDeletedSectionIds([]);
      setDeletedFieldIds([]);
    } catch (error) { 
      if (error.name !== 'CanceledError') notify.error("Error al cargar la estructura del formulario."); 
    }
  };

  useEffect(() => { 
    const controller = new AbortController();
    loadData(controller.signal); 
    return () => controller.abort();
  }, [selectedForm.id]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const handleDragStart = (event) => setActiveDragItem(event.active);

  const handleDragEnd = (event) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id; const overId = over.id;
    if (activeId === overId) return;

    if (String(activeId).startsWith('palette-')) {
      const typeStr = active.data.current?.type;
      if (!typeStr) return;
      let targetSectionId = localSections[0]?.id; 
      if (String(overId).startsWith('section-')) targetSectionId = isNaN(overId.replace('section-', '')) ? overId.replace('section-', '') : parseInt(overId.replace('section-', ''));
      else if (String(overId).startsWith('field-')) {
        const overField = localFields.find(f => String(f.id) === overId.replace('field-', ''));
        if (overField) targetSectionId = overField.section_id;
      }
      addFieldFromPalette(typeStr, targetSectionId);
      return;
    }

    if (String(activeId).startsWith('section-')) {
      const oldIndex = localSections.findIndex(s => `section-${s.id}` === activeId);
      const newIndex = localSections.findIndex(s => `section-${s.id}` === overId);
      setLocalSections(arrayMove(localSections, oldIndex, newIndex).map((s, idx) => ({ ...s, order: idx })));
      markAsChanged(); // 🔥
      return;
    }

    if (String(activeId).startsWith('field-')) {
      const activeIndex = localFields.findIndex(f => String(f.id) === activeId.replace('field-', ''));
      if (activeIndex === -1) return;

      let newFields = [...localFields];
      let modifiedField = { ...newFields[activeIndex] };

      if (String(overId).startsWith('field-')) {
        const overField = localFields.find(f => String(f.id) === overId.replace('field-', ''));
        modifiedField.section_id = overField.section_id;
        newFields[activeIndex] = modifiedField; 
        
        const newIndex = newFields.findIndex(f => String(f.id) === overId.replace('field-', ''));
        newFields = arrayMove(newFields, activeIndex, newIndex);
      } else if (String(overId).startsWith('section-')) {
        const overSectionId = overId.replace('section-', '');
        modifiedField.section_id = isNaN(overSectionId) ? overSectionId : parseInt(overSectionId);
        newFields[activeIndex] = modifiedField; 
      }
      
      setLocalFields(newFields.map((f, idx) => ({ ...f, order: idx })));
      markAsChanged(); // 🔥
    }
  };

  const addFieldFromPalette = (typeStr, specificSectionId = null) => {
    if (localSections.length === 0) return notify.warning("Crea al menos una sección primero para agregar campos.");
    const targetSectionId = specificSectionId || localSections[0].id;
    const foundLabel = PALETTE_ITEMS.find(i => i.type === typeStr)?.label || 'Nuevo Campo';
    const newF = { id: `temp-field-${Date.now()}`, label: foundLabel, field_type: typeStr, section_id: targetSectionId, order: localFields.length, required: false, is_primary: false, show_in_create: true, options: '', subform_config: [] };
    setLocalFields([...localFields, newF]);
    setEditingField({ ...newF, target_module_id: newF.target_module_id || newF.options?.target_module_id || '', options: newF.field_type === 'select' && Array.isArray(newF.options) ? newF.options.join(', ') : (newF.options || '') });
    setIsFieldModalOpen(true);
    markAsChanged(); // 🔥
  };

  const handleExportLayout = () => {
    const layout = {
      sections: localSections.map(s => ({ temp_id: s.id.toString(), title: s.title, order: s.order, columns: s.columns })),
      fields: localFields.map(f => {
         let finalOpts = f.options;
         if (f.field_type === 'relation') {
             if (f.target_module_id) finalOpts = { target_module_id: parseInt(f.target_module_id) };
             else if (f.options?.target_module_id) finalOpts = f.options; 
         } else if (f.field_type === 'select' && typeof f.options === 'string') {
             finalOpts = f.options.split(',').map(opt => opt.trim()).filter(opt => opt !== '');
         }
         return { temp_section_id: f.section_id?.toString(), label: f.label, api_name: f.api_name || `export_${Date.now()}_${f.order}`, field_type: f.field_type, required: f.required, options: finalOpts, show_in_create: f.show_in_create !== false, is_primary: f.is_primary, subform_config: f.subform_config, order: f.order };
      })
    };
    
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla_${selectedForm.name.replace(/\s+/g, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success("Plantilla exportada exitosamente.");
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (hasChanges) {
      const proceed = await confirm({
        title: 'Cambios sin guardar',
        message: 'Tienes cambios sin guardar. Si importas una plantilla ahora, tus cambios actuales se perderán. ¿Deseas continuar?',
        confirmText: 'Sí, importar y descartar',
        variant: 'danger'
      });
      if (!proceed) { e.target.value = null; return; }
    }
    
    setIsImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await api.post(`/api/v1/fields/import_layout/${selectedForm.id}`, payload);
      setImportSummary(res.data.summary);
      await loadData();
      fetchFields();
      markAsSaved(); // 🔥
    } catch (err) { 
      notify.error("Error al importar. Verifica que sea un archivo JSON válido de plantilla."); 
    } finally { 
      setIsImporting(false); 
      e.target.value = null; 
    }
  };

  const handleRestoreField = async (id) => {
    try { 
      await api.post(`/api/v1/fields/${id}/restore`); 
      notify.success("Campo restaurado y activo nuevamente.");
      await loadData(); 
      fetchFields(); 
    } catch (error) { 
      notify.error("Error al intentar restaurar el campo."); 
    }
  };

  const handleSaveAll = async (closeAfter = false) => {
    setIsSaving(true);
    try {
      const payload = {
        form_id: selectedForm.id, sections: localSections,
        fields: localFields.map(f => {
           let finalOpts = f.options;
           if (f.field_type === 'relation') {
               if (f.target_module_id) finalOpts = { target_module_id: parseInt(f.target_module_id) };
               else if (f.options?.target_module_id) finalOpts = f.options; 
           } else if (f.field_type === 'select' && typeof f.options === 'string') {
               finalOpts = f.options.split(',').map(opt => opt.trim()).filter(opt => opt !== '');
           }
           return { ...f, options: finalOpts };
        }),
        deleted_section_ids: deletedSectionIds.filter(id => typeof id === 'number'),
        deleted_field_ids: deletedFieldIds.filter(id => typeof id === 'number')
      };
      await api.post('/api/v1/fields/batch_save', payload);
      notify.success("Diseño del formulario guardado con éxito.");
      await loadData();
      fetchFields();
      markAsSaved(); // 🔥 Resetear escudo
      if (closeAfter) onCloseCanvas();
    } catch (error) { 
      notify.error("Error al guardar el diseño. Inténtalo nuevamente."); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleCloseAttempt = () => {
    if (hasChanges) setShowUnsavedModal(true); else onCloseCanvas();
  };

  const handleSaveFieldEdit = (e) => {
    e.preventDefault();
    setLocalFields(prev => prev.map(f => f.id === editingField.id ? editingField : f));
    setIsFieldModalOpen(false); 
    markAsChanged(); // 🔥
  };

  const handleDeleteFieldLocal = async (id) => {
    const isConfirmed = await confirm({
      title: 'Quitar Campo',
      message: '¿Estás seguro de quitar este campo del lienzo? Se moverá a la sección de "Papelera" (Campos Archivados) al guardar el diseño.',
      confirmText: 'Sí, quitar',
      variant: 'danger'
    });
    if(!isConfirmed) return;
    
    setDeletedFieldIds([...deletedFieldIds, id]);
    setLocalFields(prev => prev.filter(f => f.id !== id));
    setIsFieldModalOpen(false); 
    markAsChanged(); // 🔥
  };

  const handleSaveSectionEdit = (e) => {
    e.preventDefault();
    if (!editingSection.id) setLocalSections([...localSections, { ...editingSection, id: `temp-sec-${Date.now()}`, order: localSections.length }]);
    else setLocalSections(prev => prev.map(s => s.id === editingSection.id ? editingSection : s));
    setIsSectionModalOpen(false); 
    markAsChanged(); // 🔥
  };

  const handleDeleteSectionLocal = async (id) => {
    const isConfirmed = await confirm({
      title: 'Borrar Sección',
      message: '⚠️ ¿Borrar esta sección? Todos los campos que contenga se enviarán a la Papelera.',
      confirmText: 'Sí, borrar sección',
      variant: 'danger'
    });
    if(!isConfirmed) return;
    
    setDeletedSectionIds([...deletedSectionIds, id]);
    setLocalSections(prev => prev.filter(s => s.id !== id));
    const fieldsInside = localFields.filter(f => f.section_id === id);
    setDeletedFieldIds([...deletedFieldIds, ...fieldsInside.map(f => f.id)]);
    setLocalFields(prev => prev.filter(f => f.section_id !== id));
    markAsChanged(); // 🔥
  };

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

  const activePaletteItem = activeDragItem?.id?.toString().startsWith('palette-') ? PALETTE_ITEMS.find(p => `palette-${p.type}` === activeDragItem.id) : null;

  return (
    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-gray-950/50 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
      
      {/* HEADER BUILDER */}
      <div className="bg-white dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center z-10 shadow-sm flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button onClick={handleCloseAttempt} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"><ArrowLeft size={18} /></button>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><LayoutGrid size={18} className="text-blue-500" /> Editor: {selectedForm.name}</h2>
            <p className="text-[11px] text-gray-500 font-medium tracking-wide uppercase mt-0.5">Diseño Visual</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex border-r border-gray-200 dark:border-gray-700 pr-3 mr-1 gap-2">
             <button onClick={handleExportLayout} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Exportar Plantilla JSON">
                <DownloadCloud size={18} />
             </button>
             <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors disabled:opacity-50" title="Importar Plantilla JSON">
                {isImporting ? <Loader2 size={18} className="animate-spin text-emerald-500"/> : <UploadCloud size={18} />}
             </button>
             <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportFile} className="hidden" />
          </div>

          <button onClick={() => { setEditingSection({ title: '', columns: 1 }); setIsSectionModalOpen(true); }} className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl transition-colors flex items-center gap-2">
            <Plus size={16}/> Nueva Sección
          </button>
          
          <button onClick={() => handleSaveAll(false)} disabled={isSaving || !hasChanges} className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 ${hasChanges ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed shadow-none'}`}>
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar Diseño
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 overflow-hidden relative z-0">
          
          {/* PALETA DE CAMPOS (IZQUIERDA) */}
          <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-10">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tipos de Campo</h3>
               <p className="text-[10px] text-gray-500 mt-1">Arrastra hacia el lienzo o haz clic</p>
            </div>
            <div className="p-4 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
              {PALETTE_ITEMS.map(item => <PaletteItem key={item.type} item={item} onClick={() => addFieldFromPalette(item.type)} />)}
            </div>
            
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
               <button onClick={() => setShowArchivedModal(true)} className="w-full flex justify-between items-center px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500 transition-colors shadow-sm">
                  <div className="flex items-center gap-2"><ArchiveRestore size={16} className="text-blue-500"/> Papelera</div>
                  {inactiveFields.length > 0 && <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 text-xs px-2 py-0.5 rounded-full">{inactiveFields.length}</span>}
               </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50 dark:bg-gray-950 custom-scrollbar">
            <div className="max-w-4xl mx-auto pb-32">
                <SortableContext items={localSections.map(s => `section-${s.id}`)} strategy={verticalListSortingStrategy}>
                  {localSections.sort((a,b) => a.order - b.order).map(section => (
                    <SortableSection key={section.id} section={section} fields={localFields} onEditField={(f) => { setEditingField({ ...f, target_module_id: f.target_module_id || f.options?.target_module_id || '', options: f.field_type === 'select' && Array.isArray(f.options) ? f.options.join(', ') : (f.options || '') }); setIsFieldModalOpen(true); }} onDeleteField={handleDeleteFieldLocal} onEditSection={(s) => { setEditingSection(s); setIsSectionModalOpen(true); }} onDeleteSection={handleDeleteSectionLocal} />
                  ))}
                </SortableContext>
            </div>
          </div>
        </div>

        <DragOverlay>
          {activePaletteItem ? <div className="flex items-center gap-3 p-3 bg-blue-500 text-white rounded-xl shadow-2xl font-bold opacity-90 scale-105">{activePaletteItem.icon} {activePaletteItem.label}</div> : activeDragItem ? <div className="bg-blue-100/50 dark:bg-blue-900/30 w-full h-16 rounded-xl border-2 border-dashed border-blue-500"></div> : null}
        </DragOverlay>
      </DndContext>

      {/* ========================================== */}
      {/* MODALES */}
      {/* ========================================== */}
      
      {importSummary && createPortal(
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
               <div className="p-6 text-center border-b border-gray-100 dark:border-gray-800">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32}/></div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">Plantilla Importada</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">El diseño se actualizó correctamente.</p>
               </div>
               <div className="p-6 bg-gray-50 dark:bg-gray-800/50 space-y-3">
                  <div className="flex justify-between items-center text-sm"><span className="text-gray-600 dark:text-gray-400">Secciones creadas:</span><span className="font-bold text-gray-900 dark:text-white">{importSummary.sections_created}</span></div>
                  <div className="flex justify-between items-center text-sm"><span className="text-gray-600 dark:text-gray-400">Campos nuevos:</span><span className="font-bold text-emerald-600 dark:text-emerald-400">+{importSummary.fields_created}</span></div>
                  <div className="flex justify-between items-center text-sm"><span className="text-gray-600 dark:text-gray-400">Campos actualizados:</span><span className="font-bold text-blue-600 dark:text-blue-400">{importSummary.fields_updated}</span></div>
                  <div className="flex justify-between items-center text-sm"><span className="text-gray-600 dark:text-gray-400">Enviados a papelera:</span><span className="font-bold text-amber-600 dark:text-amber-500">{importSummary.fields_archived}</span></div>
                  <button onClick={() => setImportSummary(null)} className="w-full mt-4 px-5 py-3 bg-gray-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95 text-center">Entendido</button>
               </div>
            </div>
         </div>, document.body
      )}

      {showArchivedModal && createPortal(
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-800">
               <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-xl flex items-center justify-center"><ArchiveRestore size={20}/></div>
                     <div><h3 className="font-bold text-gray-900 dark:text-white text-lg">Campos en Papelera</h3><p className="text-xs text-gray-500 dark:text-gray-400">Campos ocultos que conservan sus datos históricos.</p></div>
                  </div>
                  <button onClick={() => setShowArchivedModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 transition-colors"><X size={20}/></button>
               </div>
               <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                  {inactiveFields.length === 0 ? (
                     <div className="text-center py-12"><ArchiveRestore size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-3"/><p className="text-sm text-gray-500 italic">La papelera está vacía.</p></div>
                  ) : (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {inactiveFields.map(f => (
                           <div key={f.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl flex justify-between items-center group">
                              <div className="overflow-hidden">
                                 <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{f.label}</p>
                                 <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">api: {f.api_name}</p>
                              </div>
                              <button onClick={() => handleRestoreField(f.id)} className="shrink-0 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"><RotateCcw size={14}/> Restaurar</button>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>
         </div>, document.body
      )}

      {/* 🔥 MODAL DESDE CANVAS AL DAR CLIC EN "ATRÁS" 🔥 */}
      {showUnsavedModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col border border-gray-200 dark:border-gray-800">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 text-center">
               <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} /></div>
               <h3 className="font-bold text-gray-900 dark:text-white text-lg">¿Salir sin guardar?</h3>
               <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Tienes cambios en el diseño del formulario que no han sido guardados.</p>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 flex flex-col gap-3">
               <button onClick={() => { setShowUnsavedModal(false); handleSaveAll(true); }} className="w-full px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95 text-center flex items-center justify-center gap-2"><Save size={16}/> Guardar todo y salir</button>
               <button onClick={() => { setShowUnsavedModal(false); markAsSaved(); onCloseCanvas(); }} className="w-full px-5 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all active:scale-95 text-center">Salir sin guardar</button>
               <button onClick={() => setShowUnsavedModal(false)} className="w-full px-5 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-xl shadow-sm transition-all hover:bg-gray-50 dark:hover:bg-gray-800 text-center mt-2">Cancelar y seguir editando</button>
            </div>
          </div>
        </div>, document.body
      )}

      {isFieldModalOpen && editingField && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg max-h-[90vh] shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
               <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Edit2 size={18} className="text-blue-500"/> Propiedades del Campo</h3>
               <button onClick={() => setIsFieldModalOpen(false)} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
            </div>
            
            <form id="field-edit-form" onSubmit={handleSaveFieldEdit} className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Etiqueta (Label)</label>
                 <input type="text" required value={editingField.label} onChange={(e) => setEditingField({...editingField, label: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-900 dark:text-white transition-all" />
               </div>
               
               {editingField.field_type === 'select' && (
                 <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Opciones (por coma)</label>
                   <textarea rows={3} value={editingField.options} onChange={(e) => setEditingField({...editingField, options: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-900 dark:text-white transition-all" placeholder="Ej: Opción 1, Opción 2" />
                 </div>
               )}

               {editingField.field_type === 'relation' && (
                 <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Módulo Destino</label>
                   <select required value={editingField.target_module_id || ''} onChange={(e) => setEditingField({...editingField, target_module_id: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-900 dark:text-white transition-all">
                     <option value="">Seleccione...</option>
                     {modulesList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                   </select>
                 </div>
               )}
               
               {editingField.field_type === 'subform' && (
                 <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                       <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Columnas de la Tabla</label>
                       <button type="button" onClick={handleAddSubformColumn} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1 transition-colors"><Plus size={14}/> Agregar</button>
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
                       {(!editingField.subform_config || editingField.subform_config.length === 0) && <div className="text-sm text-gray-400 italic text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900/50">No hay columnas agregadas. Haz clic en "Agregar" para empezar.</div>}
                    </div>
                 </div>
               )}

               <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors" onClick={() => setEditingField({...editingField, is_primary: !editingField.is_primary})}>
                    <input type="checkbox" checked={editingField.is_primary || false} readOnly className="w-4 h-4 rounded text-amber-500 cursor-pointer" />
                    <div className="flex flex-col"><label className="text-sm font-bold text-amber-800 dark:text-amber-500 flex items-center gap-1.5 cursor-pointer"><Star size={16}/> Título Principal del Registro</label><span className="text-xs text-amber-600 dark:text-amber-600/70">Este campo representará al registro en las búsquedas.</span></div>
                  </div>
                  <div className="flex items-center gap-3 px-2 cursor-pointer group" onClick={() => setEditingField({...editingField, required: !editingField.required})}>
                    <input type="checkbox" checked={editingField.required || false} readOnly className="w-4 h-4 rounded text-blue-600 cursor-pointer group-hover:ring-2 ring-blue-500/50" />
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">Marcar este campo como Obligatorio</label>
                  </div>
                  <div className="flex items-center gap-3 px-2 cursor-pointer group" onClick={() => setEditingField({...editingField, show_in_create: !editingField.show_in_create})}>
                    <input type="checkbox" checked={editingField.show_in_create !== false} readOnly className="w-4 h-4 rounded text-blue-600 cursor-pointer group-hover:ring-2 ring-blue-500/50" />
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">Mostrar en el formulario de "Nuevo Registro"</label>
                  </div>
               </div>
            </form>
            
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 shrink-0 flex justify-end gap-3">
               <button type="button" onClick={() => setIsFieldModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors">Cancelar</button>
               <button type="submit" form="field-edit-form" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors active:scale-95">Aplicar Cambios</button>
            </div>
          </div>
        </div>, document.body
      )}

      {isSectionModalOpen && editingSection && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col border border-gray-200 dark:border-gray-800">
             <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
               <h3 className="font-bold text-gray-900 dark:text-white">Configurar Sección</h3>
               <button onClick={() => setIsSectionModalOpen(false)} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
            </div>
            <form id="section-edit-form" onSubmit={handleSaveSectionEdit} className="p-6 space-y-5">
               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Título de la Sección</label>
                 <input type="text" required value={editingSection.title} onChange={(e) => setEditingSection({...editingSection, title: e.target.value})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-900 dark:text-white transition-all" />
               </div>
               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Distribución de Columnas</label>
                 <select required value={editingSection.columns} onChange={(e) => setEditingSection({...editingSection, columns: parseInt(e.target.value)})} className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-gray-900 dark:text-white transition-all">
                   <option value={1}>1 Columna (Ancho completo)</option>
                   <option value={2}>2 Columnas (Estándar)</option>
                   <option value={3}>3 Columnas (Compacto)</option>
                 </select>
               </div>
            </form>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
               <button type="button" onClick={() => setIsSectionModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors">Cancelar</button>
               <button type="submit" form="section-edit-form" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors active:scale-95">Guardar Sección</button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
};

export default FieldCanvas;