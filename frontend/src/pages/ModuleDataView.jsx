import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { createPortal } from 'react-dom'; 
import { Plus, Loader2, Filter, MoreHorizontal, Search, ArrowUpDown, ChevronLeft, ChevronRight, Download, Trash2, Box, Columns, CheckSquare, Square, UploadCloud, History, Clock, AlertTriangle, Globe, Copy, X, BookOpen, Terminal, ArrowLeft, Info, LayoutGrid, List, Image as ImageIcon, Edit2, Minus, Check, Folder, ChevronDown, ChevronUp, Link as LinkIcon, Tag } from 'lucide-react'; 
import Select, { components } from 'react-select'; 

import CaseModal from '../components/CaseModal';
import ImportDataModal from '../features/modules/ImportDataModal';
import ImportHistoryModal from '../features/modules/ImportHistoryModal';
import { useNotification } from '../context/NotificationContext';
import BulkActionsBar from '../components/BulkActionsBar';
import BulkUpdateModal from '../components/BulkUpdateModal';

// 🔥 OPTIMIZADOR DE RENDIMIENTO PARA LISTAS LARGAS (Evita que el navegador se congele)
const OptimizedMenuList = (props) => {
  const childrenArray = React.Children.toArray(props.children);
  const MAX_ITEMS_TO_RENDER = 50; 
  return (
    <components.MenuList {...props}>
      {childrenArray.slice(0, MAX_ITEMS_TO_RENDER)}
      {childrenArray.length > MAX_ITEMS_TO_RENDER && (
        <div className="p-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          Mostrando 50 de {childrenArray.length} resultados...
        </div>
      )}
    </components.MenuList>
  );
};

const ModuleDataView = () => {
  const { moduleId } = useParams(); 
  const navigate = useNavigate(); 
  const { notify, confirm } = useNotification();
  
  const [module, setModule] = useState(null);
  const [records, setRecords] = useState([]);
  const [fields, setFields] = useState([]);
  const [forms, setForms] = useState([]); 
  
  const [allStatuses, setAllStatuses] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  
  // 🔥 NUEVO ESTADO: DICCIONARIO DE RELACIONES (Traduce ID a Nombre)
  const [relationMap, setRelationMap] = useState({});
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const [viewMode, setViewMode] = useState(() => localStorage.getItem(`aegisflow_viewMode_${moduleId}`) || 'table');
  const [inventoryTab, setInventoryTab] = useState('all'); 
  const [stockDraft, setStockDraft] = useState({}); 

  useEffect(() => {
    localStorage.setItem(`aegisflow_viewMode_${moduleId}`, viewMode);
  }, [viewMode, moduleId]);

  const stockFieldApiName = module?.mobile_config?.mapping?.stock;
  const outOfStockCount = stockFieldApiName ? records.filter(r => Number(r.data[stockFieldApiName] || 0) <= 0).length : 0;

  // ==========================================
  // 🔥 FORMATO NUMÉRICO Y DE RELACIONES 🔥
  // ==========================================
  const formatCellValue = (val, fieldType, apiName) => {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'object') return 'Datos...';
    
    // 🪄 MAGIA RELACIONAL: Si es relación y tenemos el ID mapeado, mostramos el nombre
    if (fieldType === 'relation' && relationMap[apiName] && relationMap[apiName][val]) {
        return relationMap[apiName][val];
    }
    
    if (['number', 'currency', 'formula'].includes(fieldType)) {
      const num = Number(val);
      return !isNaN(num) ? num.toLocaleString('es-PY') : val;
    }
    return val;
  };

  const categoryFieldApiName = module?.mobile_config?.mapping?.category || 
    fields.find(f => f.field_type === 'select' && f.label.toLowerCase().includes('categor'))?.api_name;
    
  const categoryFieldDef = fields.find(f => f.api_name === categoryFieldApiName || f.label === categoryFieldApiName);
  const categoriesList = categoryFieldDef?.options || [];

  const [expandedCategory, setExpandedCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedToLink, setSelectedToLink] = useState([]);
  const [isCategorySaving, setIsCategorySaving] = useState(false);
  
  const [categoryPage, setCategoryPage] = useState(1);
  const categoryItemsPerPage = 20;

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !categoryFieldDef) return;
    if (categoriesList.includes(newCategoryName.trim())) return notify.warning("Esta categoría ya existe.");

    setIsCategorySaving(true);
    try {
      const newOptions = [...categoriesList, newCategoryName.trim()];
      await api.put(`/api/v1/fields/${categoryFieldDef.id}`, { ...categoryFieldDef, options: newOptions });
      
      setFields(fields.map(f => f.id === categoryFieldDef.id ? { ...f, options: newOptions } : f));
      setNewCategoryName('');
      notify.success("Categoría creada con éxito.");
    } catch (error) { notify.error("Error al crear la categoría."); } finally { setIsCategorySaving(false); }
  };

  const handleDeleteCategory = async (categoryName) => {
    const isConfirmed = await confirm({ title: 'Eliminar Categoría', message: `¿Estás seguro de eliminar la categoría "${categoryName}"?`, confirmText: 'Sí, eliminar', variant: 'danger' });
    if (!isConfirmed) return;
    try {
      const newOptions = categoriesList.filter(opt => opt !== categoryName);
      await api.put(`/api/v1/fields/${categoryFieldDef.id}`, { ...categoryFieldDef, options: newOptions });
      setFields(fields.map(f => f.id === categoryFieldDef.id ? { ...f, options: newOptions } : f));
      const casesToUpdate = records.filter(r => r.data[categoryFieldApiName] === categoryName).map(r => r.id);
      if (casesToUpdate.length > 0) {
        await api.put('/api/v1/cases/bulk/update', { case_ids: casesToUpdate, field_api_name: categoryFieldApiName, new_value: '' });
        fetchData(new AbortController().signal);
      }
      notify.success("Categoría eliminada.");
    } catch (error) { notify.error("Error al eliminar la categoría."); }
  };

  const handleLinkProducts = async (categoryName) => {
    if (selectedToLink.length === 0) return;
    try {
      await api.put('/api/v1/cases/bulk/update', { case_ids: selectedToLink, field_api_name: categoryFieldApiName, new_value: categoryName });
      setSelectedToLink([]); fetchData(new AbortController().signal); notify.success("Productos vinculados.");
    } catch (error) { notify.error("Error al vincular los productos."); }
  };

  const handleUnlinkProduct = async (recordId) => {
    try { await api.put('/api/v1/cases/bulk/update', { case_ids: [recordId], field_api_name: categoryFieldApiName, new_value: '' }); fetchData(new AbortController().signal); notify.success("Producto desvinculado."); } catch (error) { notify.error("Error al desvincular."); }
  };

  const handleStockDraftChange = (recordId, value) => {
    const numericValue = parseInt(value, 10);
    if (isNaN(numericValue) || numericValue < 0) return;
    setStockDraft(prev => ({ ...prev, [recordId]: numericValue }));
  };

  const cancelStock = (recordId) => { const newDraft = { ...stockDraft }; delete newDraft[recordId]; setStockDraft(newDraft); };
  const saveStock = async (recordId) => {
    const newValue = stockDraft[recordId];
    if (newValue === undefined) return;
    try {
      await api.put('/api/v1/cases/bulk/update', { case_ids: [recordId], field_api_name: stockFieldApiName, new_value: newValue });
      setRecords(records.map(r => r.id === recordId ? { ...r, data: { ...r.data, [stockFieldApiName]: newValue } } : r));
      cancelStock(recordId); notify.success("Inventario actualizado.");
    } catch (error) { notify.error("Error al actualizar el inventario."); }
  };

  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [moduleWebhooks, setModuleWebhooks] = useState([]);
  const [newWebhookName, setNewWebhookName] = useState('');
  const [selectedFormId, setSelectedFormId] = useState(''); 
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [docsWebhook, setDocsWebhook] = useState(null);
  const [webhookExample, setWebhookExample] = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);

  const fetchWebhooks = async () => {
      setLoadingWebhooks(true);
      try { const res = await api.get(`/api/v1/webhooks/module/${moduleId}`); setModuleWebhooks(res.data); } catch (error) { notify.error("Error al cargar los webhooks."); } finally { setLoadingWebhooks(false); }
  };

  useEffect(() => { if (isWebhookModalOpen) { fetchWebhooks(); setDocsWebhook(null); } }, [isWebhookModalOpen]);

  const handleCreateWebhook = async (e) => {
      e.preventDefault();
      if (!newWebhookName.trim() || forms.length === 0 || !selectedFormId) return notify.warning("Completa los datos del webhook.");
      try { await api.post('/api/v1/webhooks/', { name: newWebhookName, module_id: parseInt(moduleId), form_id: parseInt(selectedFormId) }); notify.success("Webhook generado exitosamente."); setNewWebhookName(''); setSelectedFormId(''); fetchWebhooks(); } catch (error) { notify.error("Error al generar el webhook."); }
  };

  const handleDeleteWebhook = async (webhookId) => {
      const isConfirmed = await confirm({ title: 'Eliminar Webhook', message: '¿Seguro? Sistemas externos fallarán.', confirmText: 'Sí, eliminar', variant: 'danger' });
      if (!isConfirmed) return;
      try { await api.delete(`/api/v1/webhooks/${webhookId}`); notify.success("Webhook eliminado."); if (docsWebhook?.id === webhookId) setDocsWebhook(null); fetchWebhooks(); } catch (error) { notify.error("Error al eliminar el webhook."); }
  };

  const copyText = (text) => { navigator.clipboard.writeText(text); notify.success("Copiado al portapapeles."); };
  const getBaseUrl = () => import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const handleOpenDocs = async (wh) => {
      setDocsWebhook(wh); setDocsLoading(true);
      try { const res = await api.get(`/api/v1/webhooks/${wh.id}/example`); setWebhookExample(res.data.example); } catch (error) { notify.error("Error al cargar documentación."); setWebhookExample(null); } finally { setDocsLoading(false); }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('newest'); 
  const recordsPerPage = 10;

  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fieldFilters, setFieldFilters] = useState({}); 
  const [visibleFilterKeys, setVisibleFilterKeys] = useState([]); 

  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [columnSearchTerm, setColumnSearchTerm] = useState('');
  const [columnPage, setColumnPage] = useState(1);
  const columnsPerPage = 8;
  const columnSelectorRef = useRef(null);

  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const customSingleSelectStyles = {
    control: (provided) => ({ ...provided, borderColor: isDarkMode ? '#374151' : '#e5e7eb', backgroundColor: isDarkMode ? '#111827' : 'white', borderRadius: '0.5rem', minHeight: '38px', fontSize: '0.875rem', boxShadow: 'none', color: isDarkMode ? 'white' : 'black', '&:hover': { borderColor: isDarkMode ? '#4b5563' : '#9ca3af' } }),
    singleValue: (provided) => ({ ...provided, color: isDarkMode ? '#f9fafb' : '#111827' }),
    menu: (provided) => ({ ...provided, backgroundColor: isDarkMode ? '#1f2937' : 'white', border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden', zIndex: 99999 }),
    menuPortal: base => ({ ...base, zIndex: 99999 }),
    option: (provided, state) => ({ ...provided, fontSize: '0.875rem', backgroundColor: state.isSelected ? (isDarkMode ? '#374151' : '#eff6ff') : state.isFocused ? (isDarkMode ? '#111827' : '#f9fafb') : 'transparent', color: state.isSelected ? (isDarkMode ? '#60a5fa' : '#1d4ed8') : (isDarkMode ? '#d1d5db' : '#1f2937'), cursor: 'pointer' }),
  };

  useEffect(() => {
    function handleClickOutside(event) { if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target)) setShowColumnSelector(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { if (!showColumnSelector) { setColumnSearchTerm(''); setColumnPage(1); } }, [showColumnSelector]);

  const fetchData = async (signal) => {
    try {
      setLoading(true);
      const [userRes, modRes, formsRes, statusRes, allUsersRes] = await Promise.all([
         api.get('/api/v1/users/me', { signal }),
         api.get(`/api/v1/modules/${moduleId}`, { signal }),
         api.get(`/api/v1/forms/?module_id=${moduleId}`, { signal }),
         api.get('/api/v1/statuses/', { signal }),
         api.get('/api/v1/auth/users', { signal })
      ]);
      
      setUserData(userRes.data); setModule(modRes.data); setForms(formsRes.data); setAllStatuses(statusRes.data || []); setAllUsers(allUsersRes.data || []);
      
      let fetchedFields = [];
      if (formsRes.data.length > 0) {
        const firstFormId = formsRes.data[0].id;
        const fieldsRes = await api.get(`/api/v1/fields/?form_id=${firstFormId}`, { signal });
        fetchedFields = fieldsRes.data;
        setFields(fetchedFields); 
      }

      // 🔥 EXTRACCIÓN Y TRADUCCIÓN DE RELACIONES EN BATCH 🔥
      const relFields = fetchedFields.filter(f => f.field_type === 'relation');
      const newRelationMap = {};
      
      await Promise.all(relFields.map(async (f) => {
          try {
              let targetModId = null;
              if (typeof f.options === 'string') targetModId = JSON.parse(f.options).target_module_id;
              else if (f.options?.target_module_id) targetModId = f.options.target_module_id;
              
              if (targetModId) {
                  // Traemos los campos y los registros del modulo destino al mismo tiempo
                  const [tFields, tRecords] = await Promise.all([
                      api.get(`/api/v1/fields/?module_id=${targetModId}`, { signal }),
                      api.get(`/api/v1/cases/?module_id=${targetModId}`, { signal })
                  ]);
                  const primaryField = tFields.data.find(tf => tf.is_primary) || tFields.data[0];
                  
                  const map = {};
                  tRecords.data.forEach(r => {
                      map[r.id] = primaryField ? (r.data[primaryField.api_name] || r.data[primaryField.label]) : `Registro #${r.id}`;
                  });
                  newRelationMap[f.api_name || f.label] = map;
              }
          } catch (e) { console.error("Error resolviendo relación:", e); }
      }));
      setRelationMap(newRelationMap); // Guardamos el mapa en memoria

      const savedColumns = localStorage.getItem(`module_${moduleId}_columns`);
      if (savedColumns) setSelectedColumns(JSON.parse(savedColumns).slice(0, 5)); 
      else if (fetchedFields.length > 0) setSelectedColumns(fetchedFields.slice(0, 4).map(f => f.api_name || f.label));

      const recordsRes = await api.get(`/api/v1/cases/?module_id=${moduleId}`, { signal });
      setRecords(recordsRes.data);
    } catch (error) {
      if (error.name !== 'CanceledError') {
        if (error.response && (error.response.status === 403 || error.response.status === 404)) {
          notify.error("Acceso denegado."); navigate('/dashboard');
        } else notify.error("Error al cargar los datos del módulo.");
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal); clearFilters(); 
    return () => controller.abort();
  }, [moduleId]);

  const toggleColumn = (fieldKey) => {
    let newCols;
    if (selectedColumns.includes(fieldKey)) newCols = selectedColumns.filter(c => c !== fieldKey); 
    else {
      if (selectedColumns.length >= 5) return notify.warning("Máximo 5 columnas permitidas.");
      newCols = [...selectedColumns, fieldKey]; 
    }
    setSelectedColumns(newCols);
    localStorage.setItem(`module_${moduleId}_columns`, JSON.stringify(newCols));
  };

  const getStatusName = (statusId) => {
     if (!statusId) return 'Sin Estado';
     const s = allStatuses.find(s => s.id === statusId); return s ? s.name : `Estado ID: ${statusId}`;
  };

  const getUserName = (userId) => {
     if (!userId) return 'Sin Asignar';
     const u = allUsers.find(u => u.id === userId); return u ? (u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.email) : `Usuario ID: ${userId}`;
  };
  
  const getSlaStatus = (rec) => {
     if (!rec.status_id) return null;
     const status = allStatuses.find(s => s.id === rec.status_id);
     if (!status || !status.sla_hours) return null; 
     const startTime = new Date(rec.entered_status_at || rec.created_at);
     const deadline = new Date(startTime.getTime() + (status.sla_hours * 60 * 60 * 1000));
     const timeRemaining = deadline - new Date();
     const hoursRemaining = timeRemaining / (1000 * 60 * 60);

     if (timeRemaining < 0) return { state: 'breached', label: 'SLA Vencido', hours: Math.abs(hoursRemaining).toFixed(1) };
     if (hoursRemaining <= (status.sla_hours * 0.2)) return { state: 'warning', label: 'Por vencer', hours: hoursRemaining.toFixed(1) };
     return { state: 'good', label: 'A tiempo', hours: hoursRemaining.toFixed(1) };
  };

  const filteredColumnFields = fields.filter(f => f.label.toLowerCase().includes(columnSearchTerm.toLowerCase()));
  const totalColumnPages = Math.ceil(filteredColumnFields.length / columnsPerPage) || 1;
  const currentColumnFields = filteredColumnFields.slice((columnPage - 1) * columnsPerPage, columnPage * columnsPerPage);
  const visibleFields = fields.filter(f => selectedColumns.includes(f.api_name || f.label));
  const primaryField = fields.find(f => f.is_primary); 

  let filteredAndSortedRecords = records.filter(rec => {
    if (inventoryTab === 'out_of_stock' && stockFieldApiName) {
      if (Number(rec.data[stockFieldApiName] || 0) > 0) return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchId = rec.id.toString().includes(term);
      const matchData = Object.values(rec.data).some(v => String(v).toLowerCase().includes(term));
      const matchStatus = getStatusName(rec.status_id).toLowerCase().includes(term);
      const matchUser = getUserName(rec.assigned_to || rec.created_by).toLowerCase().includes(term);
      if (!matchId && !matchData && !matchStatus && !matchUser) return false;
    }
    if (startDate && new Date(rec.created_at) < new Date(startDate)) return false;
    if (endDate) { const end = new Date(endDate); end.setHours(23, 59, 59, 999); if (new Date(rec.created_at) > end) return false; }
    
    for (const [key, filterValue] of Object.entries(fieldFilters)) {
      if (filterValue) {
        let recValue = key === 'SYSTEM_STATUS' ? getStatusName(rec.status_id).toLowerCase() : key === 'SYSTEM_OWNER' ? getUserName(rec.assigned_to || rec.created_by).toLowerCase() : String(rec.data[key] || '').toLowerCase();
        if (!recValue.includes(filterValue.toLowerCase())) return false;
      }
    }
    return true;
  });

  filteredAndSortedRecords.sort((a, b) => sortBy === 'newest' ? b.id - a.id : a.id - b.id);
  const totalPages = Math.ceil(filteredAndSortedRecords.length / recordsPerPage) || 1;
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentListRecords = filteredAndSortedRecords.slice(indexOfFirstRecord, indexOfLastRecord);

  const handleAddFieldFilter = (selectedOption) => { if (selectedOption && !visibleFilterKeys.includes(selectedOption.value)) setVisibleFilterKeys([...visibleFilterKeys, selectedOption.value]); };
  const handleRemoveFieldFilter = (key) => { setVisibleFilterKeys(visibleFilterKeys.filter(k => k !== key)); const newFilters = { ...fieldFilters }; delete newFilters[key]; setFieldFilters(newFilters); setCurrentPage(1); };
  const handleFilterValueChange = (key, value) => { setFieldFilters(prev => ({ ...prev, [key]: value })); setCurrentPage(1); };
  const clearFilters = () => { setStartDate(''); setEndDate(''); setFieldFilters({}); setVisibleFilterKeys([]); setSearchTerm(''); setCurrentPage(1); };

  const exportToCSV = () => {
    if (filteredAndSortedRecords.length === 0) return notify.warning("No hay registros para exportar.");
    const sanitizeCSV = (str) => { let text = String(str).replace(/"/g, '""').replace(/\n/g, ' '); if (/^[=\-+@]/.test(text)) text = "'" + text; return `"${text}"`; };
    const baseHeaders = ['ID', 'Fecha de Creacion', 'Propietario', 'Estado'];
    const allHeaders = [...baseHeaders, ...fields.map(f => f.label)];
    const csvRows = filteredAndSortedRecords.map(rec => {
      const baseRow = [rec.id, new Date(rec.created_at).toLocaleDateString(), sanitizeCSV(getUserName(rec.assigned_to || rec.created_by)), sanitizeCSV(getStatusName(rec.status_id))];
      // 🔥 EXPORTAMOS EL NOMBRE TRADUCIDO EN VEZ DEL ID 🔥
      const dynamicRow = fields.map(f => {
          const apiName = f.api_name || f.label;
          let val = rec.data[apiName];
          if (f.field_type === 'relation' && relationMap[apiName] && relationMap[apiName][val]) val = relationMap[apiName][val];
          return sanitizeCSV(val || '');
      });
      return [...baseRow, ...dynamicRow].join(',');
    });
    const blob = new Blob(["\uFEFF" + [allHeaders.join(','), ...csvRows].join('\n')], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.setAttribute('download', `${module?.name.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link); notify.success("Exportación completada.");
  };

  const [selectedRecords, setSelectedRecords] = useState([]);
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const handleSelectAll = (e) => setSelectedRecords(e.target.checked ? [...new Set([...selectedRecords, ...currentListRecords.map(r => r.id)])] : selectedRecords.filter(id => !currentListRecords.map(r => r.id).includes(id)));
  const toggleRecordSelection = (e, id) => { e.stopPropagation(); setSelectedRecords(selectedRecords.includes(id) ? selectedRecords.filter(r => r !== id) : [...selectedRecords, id]); };

  const handleBulkUpdate = async (fieldApiName, value) => {
    setIsBulkSaving(true);
    try {
      await api.put('/api/v1/cases/bulk/update', { case_ids: selectedRecords, field_api_name: fieldApiName, new_value: value });
      notify.success(`${selectedRecords.length} registros actualizados de forma masiva.`);
      setIsBulkUpdateModalOpen(false); setSelectedRecords([]); fetchData(new AbortController().signal); 
    } catch (error) { notify.error("Error en la actualización masiva."); } finally { setIsBulkSaving(false); }
  };

  const handleBulkDelete = async () => {
    const isConfirmed = await confirm({ title: 'Eliminación Masiva', message: `¿Estás seguro de eliminar los ${selectedRecords.length} registros seleccionados?`, confirmText: 'Sí, eliminar', variant: 'danger' });
    if (!isConfirmed) return;
    try {
      setLoading(true); await Promise.all(selectedRecords.map(id => api.delete(`/api/v1/cases/${id}`)));
      notify.success(`${selectedRecords.length} registros eliminados.`); setSelectedRecords([]); fetchData(new AbortController().signal); 
    } catch (error) { notify.error("Error al eliminar algunos registros."); setLoading(false); }
  };

  const handleDeleteSingle = async (id) => {
    const isConfirmed = await confirm({ title: 'Eliminar Registro', message: '¿Estás seguro de eliminar este registro?', confirmText: 'Sí, eliminar', variant: 'danger' });
    if (!isConfirmed) return;
    try { setLoading(true); await api.delete(`/api/v1/cases/${id}`); notify.success('Registro eliminado.'); fetchData(new AbortController().signal); } 
    catch (error) { notify.error('Error al eliminar el registro.'); setLoading(false); }
  };

  const modPerms = userData?.permissions?.modules?.[moduleId] || {};
  const canCreate = userData?.is_superadmin || modPerms.create === true;

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <>
      {/* 🔥 PESTAÑAS DE INVENTARIO INTELIGENTE 🔥 */}
      {(stockFieldApiName || categoryFieldDef) && (
        <div className="flex flex-wrap items-center gap-3 mb-6 animate-in slide-in-from-top-4">
          <button 
            onClick={() => { setInventoryTab('all'); setCurrentPage(1); }} 
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm flex items-center gap-2 ${inventoryTab === 'all' ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
             <Box size={16} /> Inventario ({records.length})
          </button>
          
          {stockFieldApiName && (
            <button 
              onClick={() => { setInventoryTab('out_of_stock'); setCurrentPage(1); }} 
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm flex items-center gap-2 ${inventoryTab === 'out_of_stock' ? 'bg-red-500 text-white shadow-red-500/30' : 'bg-white dark:bg-gray-900 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
            >
               <AlertTriangle size={16} /> Agotados ({outOfStockCount})
            </button>
          )}

          {categoryFieldDef && (
            <button 
              onClick={() => setInventoryTab('categories')} 
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all shadow-sm flex items-center gap-2 ${inventoryTab === 'categories' ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
               <Folder size={16} /> Categorías ({categoriesList.length})
            </button>
          )}
        </div>
      )}

      {/* RENDERIZADO DUAL DE INTERFAZ */}
      {inventoryTab === 'categories' ? (
        
        // ==========================================
        // 🔥 VISTA EXCLUSIVA DE CATEGORÍAS 🔥
        // ==========================================
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-300">
          
          {/* LADO IZQUIERDO: NUEVA CATEGORÍA */}
          <div className="bg-white dark:bg-[#1e2330] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm h-fit">
            <div className="flex items-center gap-2 mb-2">
              <Folder className="text-blue-500" size={20} />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Categoría</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Organiza tu catálogo creando secciones específicas.</p>
            
            <form onSubmit={handleCreateCategory}>
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Nombre de la categoría</label>
                <input 
                  type="text" required 
                  placeholder="Ej: Electrónica, Accesorios..." 
                  value={newCategoryName} 
                  onChange={(e) => setNewCategoryName(e.target.value)} 
                  className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#151923] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                />
              </div>
              <button 
                type="submit" 
                disabled={isCategorySaving}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition-all shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2"
              >
                {isCategorySaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Crear y Guardar
              </button>
            </form>
          </div>

          {/* LADO DERECHO: ESTRUCTURA DEL CATÁLOGO */}
          <div className="lg:col-span-2 bg-white dark:bg-[#1e2330] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Estructura del Catálogo</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Haz clic en una categoría para administrar los productos que contiene.</p>
            </div>

            {categoriesList.length === 0 ? (
               <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  <Tag className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Aún no has creado ninguna categoría.</p>
               </div>
            ) : (
              <div className="flex flex-col gap-3">
                {categoriesList.map(cat => {
                  const isExpanded = expandedCategory === cat;
                  const productsInCat = records.filter(r => r.data[categoryFieldApiName] === cat);
                  const availableToLink = records.filter(r => r.data[categoryFieldApiName] !== cat).map(r => ({
                    value: r.id, 
                    label: primaryField ? r.data[primaryField.api_name || primaryField.label] : `Registro #${r.id}`
                  }));

                  const totalCategoryPages = Math.ceil(productsInCat.length / categoryItemsPerPage) || 1;
                  const visibleProductsInCat = productsInCat.slice((categoryPage - 1) * categoryItemsPerPage, categoryPage * categoryItemsPerPage);

                  return (
                    <div key={cat} className={`border rounded-xl overflow-hidden transition-all ${isExpanded ? 'border-blue-500 shadow-md shadow-blue-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                      {/* HEADER DEL ACORDEÓN */}
                      <div 
                        onClick={() => { 
                          setExpandedCategory(isExpanded ? null : cat); 
                          setSelectedToLink([]); 
                          setCategoryPage(1); 
                        }} 
                        className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'bg-gray-50/50 dark:bg-[#151923]'}`}
                      >
                        <span className={`font-bold text-sm ${isExpanded ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
                          {cat}
                        </span>
                        
                        <div className="flex items-center gap-3">
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat); }} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Eliminar Categoría">
                            <Trash2 size={16} />
                          </button>
                          <span className="text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full text-gray-600 dark:text-gray-300 shadow-sm">
                            {productsInCat.length} artículos
                          </span>
                          {isExpanded ? <ChevronUp size={18} className="text-blue-500" /> : <ChevronDown size={18} className="text-gray-400" />}
                        </div>
                      </div>

                      {/* CUERPO DEL ACORDEÓN */}
                      {isExpanded && (
                        <div className="p-5 bg-white dark:bg-[#1e2330] border-t border-blue-100 dark:border-gray-800 animate-in slide-in-from-top-2">
                          
                          {/* PRODUCTOS ACTUALES */}
                          <div className="mb-6">
                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Box size={14}/> Contenido Actual</h4>
                            {productsInCat.length === 0 ? (
                              <p className="text-xs text-gray-400 dark:text-gray-500 italic p-4 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">Categoría vacía.</p>
                            ) : (
                              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                                {visibleProductsInCat.map(p => (
                                  <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50/30 dark:bg-gray-900/30 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate pr-4">
                                      {primaryField ? p.data[primaryField.api_name || primaryField.label] : `Registro #${p.id}`}
                                    </span>
                                    <button onClick={() => handleUnlinkProduct(p.id)} className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-1 rounded transition-colors">
                                      Quitar
                                    </button>
                                  </div>
                                ))}
                                
                                {totalCategoryPages > 1 && (
                                  <div className="flex justify-between items-center px-4 py-2 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                      Página {categoryPage} de {totalCategoryPages}
                                    </span>
                                    <div className="flex gap-1">
                                      <button onClick={() => setCategoryPage(p => Math.max(1, p - 1))} disabled={categoryPage === 1} className="p-1 rounded-md text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"><ChevronLeft size={14} /></button>
                                      <button onClick={() => setCategoryPage(p => Math.min(totalCategoryPages, p + 1))} disabled={categoryPage === totalCategoryPages} className="p-1 rounded-md text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"><ChevronRight size={14} /></button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* VINCULAR PRODUCTOS (REUTILIZA SELECT) */}
                          <div>
                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><LinkIcon size={14}/> Vincular Productos</h4>
                            <div className="flex flex-col sm:flex-row gap-3">
                              <div className="flex-1">
                                <Select
                                  isMulti
                                  options={availableToLink}
                                  value={availableToLink.filter(opt => selectedToLink.includes(opt.value))}
                                  onChange={(selected) => setSelectedToLink(selected ? selected.map(s => s.value) : [])}
                                  placeholder="Buscar para añadir..."
                                  styles={customSingleSelectStyles}
                                  menuPortalTarget={document.body}
                                  components={{ MenuList: OptimizedMenuList }} 
                                />
                              </div>
                              <button onClick={() => handleLinkProducts(cat)} disabled={selectedToLink.length === 0} className="px-5 py-2 bg-gray-900 hover:bg-black dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-bold shadow-sm transition-all">
                                Guardar
                              </button>
                            </div>
                          </div>

                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      ) : (

        // ==========================================
        // 🔥 VISTA CLÁSICA DE DATOS (TABLA / TARJETAS) 🔥
        // ==========================================
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{module?.name}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">Gestiona los registros y el progreso de este módulo.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">

              {/* CONMUTADOR DE VISTAS */}
              <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-800 mr-2">
                <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md flex items-center justify-center transition-all ${viewMode === 'table' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`} title="Vista de Tabla"><List size={18} /></button>
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`} title="Vista de Galería / Tarjetas"><LayoutGrid size={18} /></button>
              </div>
              
              {/* BOTONES DE EXPORTACIÓN / WEBHOOKS */}
              <div className="flex items-center bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800/80 rounded-lg shadow-sm mr-1 overflow-hidden">
                <button onClick={exportToCSV} className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 text-xs font-semibold border-r border-gray-200 dark:border-gray-800/80" title="Exportar a CSV"><Download size={14} /> <span className="hidden sm:inline">Exportar</span></button>
                {canCreate && (
                  <>
                    <button onClick={() => setIsImportModalOpen(true)} className="px-3 py-2 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center gap-1.5 text-xs font-semibold border-r border-gray-200 dark:border-gray-800/80" title="Importar desde Excel/CSV"><UploadCloud size={14} /> <span className="hidden sm:inline">Importar</span></button>
                    <button onClick={() => setIsHistoryModalOpen(true)} className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 text-xs font-semibold" title="Historial de Importaciones"><History size={14} /></button>
                  </>
                )}
                {userData?.is_superadmin && (
                  <button onClick={() => setIsWebhookModalOpen(true)} className="px-3 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-1.5 text-xs font-semibold border-l border-gray-200 dark:border-gray-800/80" title="Integraciones Webhook (Entrada)"><Globe size={14} /> <span className="hidden sm:inline">API Webhooks</span></button>
                )}
              </div>

              {/* BOTONES DE COLUMNAS, FILTROS Y NUEVO */}
              <div className="relative" ref={columnSelectorRef}>
                <button onClick={() => setShowColumnSelector(!showColumnSelector)} className={`px-3 py-2 rounded-lg transition-colors shadow-sm border flex items-center gap-1.5 text-xs font-semibold ${showColumnSelector ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400' : 'bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800/80 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}><Columns size={14} /> <span className="hidden sm:inline">Columnas</span></button>
                {showColumnSelector && (
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                    <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                      <div className="flex justify-between items-center mb-3 px-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Personalizar Vista</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedColumns.length >= 5 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{selectedColumns.length} / 5</span>
                      </div>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                        <input type="text" placeholder="Buscar campo..." value={columnSearchTerm} onChange={e => {setColumnSearchTerm(e.target.value); setColumnPage(1);}} autoFocus className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-200 shadow-sm" />
                      </div>
                    </div>
                    <div className="p-2 space-y-0.5">
                      {currentColumnFields.map(f => {
                        const key = f.api_name || f.label;
                        const isSelected = selectedColumns.includes(key);
                        const isDisabled = !isSelected && selectedColumns.length >= 5;
                        return (
                          <div key={f.id} onClick={() => !isDisabled || isSelected ? toggleColumn(key) : null} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${isDisabled && !isSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                            <div className="text-blue-500 shrink-0">{isSelected ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} className={`text-gray-300 dark:text-gray-600 ${!isDisabled && 'group-hover:text-gray-400'}`} />}</div>
                            <span className={`text-sm truncate ${isSelected ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>{f.label}</span>
                          </div>
                        )
                      })}
                      {currentColumnFields.length === 0 && <div className="text-xs text-gray-500 text-center py-6 italic">No se encontraron campos.</div>}
                    </div>
                    {totalColumnPages > 1 && (
                      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-gray-400">Pág {columnPage} de {totalColumnPages}</span>
                        <div className="flex gap-1">
                            <button onClick={() => setColumnPage(p => Math.max(1, p - 1))} disabled={columnPage === 1} className="p-1 rounded-md text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronLeft size={14}/></button>
                            <button onClick={() => setColumnPage(p => Math.min(totalColumnPages, p + 1))} disabled={columnPage === totalColumnPages} className="p-1 rounded-md text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronRight size={14}/></button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2 rounded-lg transition-colors shadow-sm border flex items-center gap-1.5 text-xs font-semibold ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400' : 'bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800/80 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}><Filter size={14} /> <span className="hidden sm:inline">Filtros</span></button>
              
              {canCreate && (
                <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all ml-1">
                  <Plus size={16} /> Nuevo
                </button>
              )}
            </div>
          </div>

          {/* PANEL DE FILTROS */}
          {showFilters && (
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm mb-6 animate-in slide-in-from-top-2 z-10 relative">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Filter size={16} className="text-blue-500"/> Filtros Activos
                </h3>
                <button onClick={clearFilters} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold">Limpiar Todo</button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Creado desde</label>
                  <input type="date" value={startDate} onChange={e => {setStartDate(e.target.value); setCurrentPage(1)}} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 rounded-lg outline-none bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Creado hasta</label>
                  <input type="date" value={endDate} onChange={e => {setEndDate(e.target.value); setCurrentPage(1)}} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 rounded-lg outline-none bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:border-blue-500 transition-colors" />
                </div>
              </div>

              {visibleFilterKeys.length > 0 && (
                <div className="space-y-3 mb-5 border-t border-gray-100 dark:border-gray-800 pt-5">
                  {visibleFilterKeys.map(key => {
                    const isSystemStatus = key === 'SYSTEM_STATUS';
                    const isSystemOwner = key === 'SYSTEM_OWNER';
                    const fieldDef = fields.find(f => (f.api_name || f.label) === key);
                    const fieldLabel = isSystemStatus ? 'Estado del Registro' : isSystemOwner ? 'Propietario / Asignado a' : (fieldDef?.label || key);

                    return (
                      <div key={key} className="flex items-end gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-100 dark:border-gray-700/50">
                        <div className="flex-1 min-w-0">
                          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">{fieldLabel}</label>
                          
                          {isSystemStatus ? (
                            <Select options={allStatuses.map(s => ({ value: s.name, label: s.name }))} value={fieldFilters[key] ? { value: fieldFilters[key], label: fieldFilters[key] } : null} onChange={opt => handleFilterValueChange(key, opt ? opt.value : '')} placeholder="Cualquier estado..." isClearable styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} components={{ MenuList: OptimizedMenuList }} />
                          ) : isSystemOwner ? (
                            <Select options={allUsers.map(u => { const name = u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.email; return { value: name, label: name }; })} value={fieldFilters[key] ? { value: fieldFilters[key], label: fieldFilters[key] } : null} onChange={opt => handleFilterValueChange(key, opt ? opt.value : '')} placeholder="Cualquier propietario..." isClearable styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} components={{ MenuList: OptimizedMenuList }} />
                          ) : fieldDef?.field_type === 'select' ? (
                            <Select options={fieldDef.options?.map(opt => ({ value: opt, label: opt })) || []} value={fieldFilters[key] ? { value: fieldFilters[key], label: fieldFilters[key] } : null} onChange={opt => handleFilterValueChange(key, opt ? opt.value : '')} placeholder="Cualquier valor..." isClearable styles={customSingleSelectStyles} menuPortalTarget={document.body} menuPosition={'fixed'} components={{ MenuList: OptimizedMenuList }} />
                          ) : (
                            <input type="text" placeholder="Contiene..." value={fieldFilters[key] || ''} onChange={e => handleFilterValueChange(key, e.target.value)} className="w-full px-3 py-2 min-h-[38px] text-sm border border-gray-200 dark:border-gray-700 rounded-lg outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm focus:border-blue-500" />
                          )}
                        </div>
                        <button onClick={() => handleRemoveFieldFilter(key)} className="mb-0.5 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors shrink-0" title="Quitar filtro"><Trash2 size={18} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="pt-2">
                <Select
                  options={[
                      { label: 'Datos del Sistema', options: [ !visibleFilterKeys.includes('SYSTEM_STATUS') ? { value: 'SYSTEM_STATUS', label: 'Estado del Registro' } : null, !visibleFilterKeys.includes('SYSTEM_OWNER') ? { value: 'SYSTEM_OWNER', label: 'Propietario / Asignado a' } : null ].filter(Boolean) },
                      { label: 'Campos del Formulario', options: fields.filter(f => !visibleFilterKeys.includes(f.api_name || f.label)).map(f => ({ value: f.api_name || f.label, label: f.label })) }
                  ]}
                  value={null}
                  onChange={(opt) => { if (opt) handleAddFieldFilter(opt); }}
                  placeholder="+ Añadir regla de filtro..."
                  styles={{ ...customSingleSelectStyles, control: (provided) => ({ ...customSingleSelectStyles.control(provided), borderColor: isDarkMode ? '#1e3a8a' : '#bfdbfe', backgroundColor: 'transparent', color: isDarkMode ? '#60a5fa' : '#2563eb' }), placeholder: (provided) => ({ ...provided, color: isDarkMode ? '#60a5fa' : '#2563eb', fontWeight: '600' }) }}
                  menuPortalTarget={document.body} menuPosition={'fixed'} isSearchable components={{ MenuList: OptimizedMenuList }}
                />
              </div>
            </div>
          )}

          {/* RENDERIZADO DUAL DE DATOS (TABLA O GALERÍA) */}
          <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden flex flex-col z-0 relative ${viewMode === 'table' ? 'border border-gray-200 dark:border-gray-800' : 'bg-transparent shadow-none dark:bg-transparent'}`}>
            
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 border border-gray-200 dark:border-gray-800 border-b-gray-100 dark:border-b-gray-800/60 gap-4 bg-gray-50/30 dark:bg-gray-900/50 rounded-t-2xl">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                <input type="text" placeholder="Buscar por ID, datos, estado o dueño..." className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 dark:text-white dark:placeholder-gray-500 shadow-sm" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
              </div>
              <div className="flex items-center gap-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 shadow-sm w-full sm:w-auto transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/50">
                  <ArrowUpDown size={14} className="text-gray-400 dark:text-gray-500" />
                  <select className="text-sm border-none bg-transparent focus:ring-0 outline-none text-gray-700 dark:text-gray-300 font-medium cursor-pointer w-full appearance-none pr-4" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}>
                    <option value="newest">Más recientes</option>
                    <option value="oldest">Más antiguos</option>
                  </select>
              </div>
            </div>

            {viewMode === 'table' ? (
              /* 🔥 VISTA DE TABLA (CLÁSICA) 🔥 */
              <div className="overflow-x-auto border-x border-gray-200 dark:border-gray-800">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800/80">
                    <tr>
                      <th className="px-6 py-3.5 w-10">
                        <input type="checkbox" onChange={handleSelectAll} checked={currentListRecords.length > 0 && currentListRecords.every(r => selectedRecords.includes(r.id))} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer" />
                      </th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">ID</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Creado</th>
                      {visibleFields.map(field => ( <th key={field.id} className="px-6 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">{field.label}</th> ))}
                      <th className="px-6 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Propietario</th>
                      <th className="px-6 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Estado</th>
                      <th className="px-6 py-3.5 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                    {currentListRecords.length === 0 ? (
                      <tr>
                        <td colSpan={visibleFields.length + 6} className="px-6 py-16 text-center border-b border-gray-200 dark:border-gray-800">
                          <Box className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-700 mb-3" />
                          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{(searchTerm || startDate || endDate || Object.keys(fieldFilters).length > 0) ? 'No hay resultados para esta búsqueda.' : 'No hay registros en este módulo todavía.'}</p>
                        </td>
                      </tr>
                    ) : (
                      currentListRecords.map((rec) => (
                        <tr key={rec.id} onClick={() => navigate(`/cases/${rec.id}`)} className={`transition-colors group cursor-pointer ${selectedRecords.includes(rec.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-50/80 dark:hover:bg-gray-800/40'}`}>
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedRecords.includes(rec.id)} onChange={(e) => toggleRecordSelection(e, rec.id)} className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 cursor-pointer" />
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300">#{rec.id}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(rec.created_at).toLocaleDateString()}</td>
                          
                          {visibleFields.map(field => {
                            const isStockField = stockFieldApiName && (field.api_name === stockFieldApiName || field.label === stockFieldApiName);
                            if (isStockField) {
                              const currentStock = stockDraft[rec.id] !== undefined ? stockDraft[rec.id] : Number(rec.data[stockFieldApiName] || 0);
                              const hasChanges = stockDraft[rec.id] !== undefined && stockDraft[rec.id] !== Number(rec.data[stockFieldApiName] || 0);
                              return (
                                <td key={field.id} className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex flex-col gap-1.5 items-start">
                                    <div className="flex items-center gap-1 bg-white dark:bg-gray-900 p-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                      <button onClick={(e) => { e.stopPropagation(); handleStockDraftChange(rec.id, currentStock - 1); }} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"><Minus size={14} /></button>
                                      <input type="number" value={currentStock} onClick={e => e.stopPropagation()} onChange={(e) => handleStockDraftChange(rec.id, e.target.value)} className="w-12 text-center text-sm font-bold bg-transparent outline-none appearance-none text-gray-900 dark:text-white" />
                                      <button onClick={(e) => { e.stopPropagation(); handleStockDraftChange(rec.id, currentStock + 1); }} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"><Plus size={14} /></button>
                                    </div>
                                    {hasChanges && (
                                      <div className="flex items-center gap-1 w-full animate-in fade-in zoom-in-95">
                                        <button onClick={(e) => { e.stopPropagation(); saveStock(rec.id); }} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md p-1 flex justify-center transition-colors shadow-sm"><Check size={14} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); cancelStock(rec.id); }} className="bg-red-500 hover:bg-red-600 text-white rounded-md p-1 flex justify-center transition-colors shadow-sm"><X size={14} /></button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            }
                            
                            // 🔥 FORMATO INTELIGENTE DE CELDA (MUESTRA NOMBRES EN VEZ DE IDs)
                            const apiName = field.api_name || field.label;
                            const rawVal = rec.data[apiName];
                            return (
                              <td key={field.id} className="px-6 py-4 text-sm text-gray-900 dark:text-gray-200 truncate max-w-[200px]">
                                {rawVal !== undefined && rawVal !== '' ? formatCellValue(rawVal, field.field_type, apiName) : <span className="text-gray-300 dark:text-gray-700">—</span>}
                              </td>
                            );
                          })}
                          
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{getUserName(rec.assigned_to || rec.created_by)}</td>
                          
                          <td className="px-6 py-4 whitespace-nowrap flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">{getStatusName(rec.status_id)}</span>
                            {(() => {
                              const sla = getSlaStatus(rec);
                              if (!sla) return null;
                              if (sla.state === 'breached') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest animate-pulse" title={`Vencido por ${sla.hours} horas`}><AlertTriangle size={12} /> SLA Roto</span>;
                              if (sla.state === 'warning') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-900/20 text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest" title={`Quedan ${sla.hours} horas`}><Clock size={12} /> En Riesgo</span>;
                              return null;
                            })()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteSingle(rec.id); }} className="p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* 🔥 VISTA DE GALERÍA (TARJETAS) 🔥 */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 py-6 px-4 animate-in fade-in duration-300">
                {currentListRecords.length === 0 ? (
                  <div className="col-span-full py-16 text-center border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900">
                      <Box className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-700 mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{(searchTerm || startDate || endDate || Object.keys(fieldFilters).length > 0) ? 'No hay resultados para esta búsqueda.' : 'No hay registros en este módulo todavía.'}</p>
                  </div>
                ) : (
                  currentListRecords.map(rec => {
                    const primaryField = fields.find(f => f.is_primary);
                    const cardTitle = primaryField ? (rec.data[primaryField.api_name] || rec.data[primaryField.label]) : `Registro #${rec.id}`;

                    const imageField = fields.find(f => f.field_type === 'image' || f.field_type === 'file');
                    const coverImage = imageField ? (rec.data[imageField.api_name] || rec.data[imageField.label]) : null;

                    const cardFields = visibleFields.filter(f => !f.is_primary && f.field_type !== 'file' && f.field_type !== 'image' && f.api_name !== stockFieldApiName && f.label !== stockFieldApiName).slice(0, 3);
                    const currentStock = stockDraft[rec.id] !== undefined ? stockDraft[rec.id] : Number(rec.data[stockFieldApiName] || 0);
                    const hasChanges = stockDraft[rec.id] !== undefined && stockDraft[rec.id] !== Number(rec.data[stockFieldApiName] || 0);

                    return (
                      <div key={rec.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-lg transition-all overflow-hidden flex flex-col relative group">
                        <div className="absolute top-3 left-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                          <input type="checkbox" checked={selectedRecords.includes(rec.id)} onChange={(e) => toggleRecordSelection(e, rec.id)} className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-sm bg-white" />
                        </div>

                        <div onClick={() => navigate(`/cases/${rec.id}`)} className="h-40 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800 flex items-center justify-center overflow-hidden cursor-pointer relative">
                          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 items-end">
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shadow-sm backdrop-blur-sm">{getStatusName(rec.status_id)}</span>
                            {(() => {
                              const sla = getSlaStatus(rec);
                              if (!sla) return null;
                              if (sla.state === 'breached') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 dark:border-red-800/50 bg-red-50/90 dark:bg-red-900/90 text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest animate-pulse backdrop-blur-sm shadow-sm" title={`Vencido por ${sla.hours} horas`}><AlertTriangle size={10} /> SLA Roto</span>;
                              if (sla.state === 'warning') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-orange-200 dark:border-orange-800/50 bg-orange-50/90 dark:bg-orange-900/90 text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest backdrop-blur-sm shadow-sm" title={`Quedan ${sla.hours} horas`}><Clock size={10} /> En Riesgo</span>;
                              return null;
                            })()}
                          </div>
                          {coverImage && typeof coverImage === 'string' && coverImage.startsWith('http') ? ( <img src={coverImage} alt="Portada" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" /> ) : ( <ImageIcon size={40} className="text-gray-300 dark:text-gray-600" /> )}
                        </div>

                        <div className="p-4 flex-1 flex flex-col">
                          <h3 className="font-bold text-base text-gray-900 dark:text-white mb-3 truncate cursor-pointer" title={cardTitle} onClick={() => navigate(`/cases/${rec.id}`)}>{cardTitle || 'Sin título'}</h3>
                          <div className="space-y-2 flex-1 mb-4 cursor-pointer" onClick={() => navigate(`/cases/${rec.id}`)}>
                            {cardFields.map(field => {
                              const apiName = field.api_name || field.label;
                              const rawVal = rec.data[apiName];
                              return (
                              <div key={field.id} className="flex justify-between items-center text-xs border-b border-gray-50 dark:border-gray-800/50 pb-2 last:border-0 last:pb-0">
                                <span className="text-gray-500 dark:text-gray-400 truncate max-w-[45%] pr-2" title={field.label}>{field.label}</span>
                                <span className="font-medium text-gray-900 dark:text-gray-200 truncate max-w-[50%] text-right" title={rawVal}>
                                  {/* 🔥 MUESTRA EL NOMBRE TRADUCIDO EN LA TARJETA TAMBIÉN 🔥 */}
                                  {rawVal !== undefined && rawVal !== '' ? formatCellValue(rawVal, field.field_type, apiName) : '-'}
                                </span>
                              </div>
                            )})}
                          </div>
                          {stockFieldApiName && (
                            <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800">
                              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2 text-center">Ajustar Inventario</label>
                              <div className="flex flex-col gap-1.5 items-center">
                                <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-950 p-1 rounded-lg border border-gray-200 dark:border-gray-800 shadow-inner w-full justify-center">
                                  <button onClick={(e) => { e.stopPropagation(); handleStockDraftChange(rec.id, currentStock - 1); }} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-800 rounded-md transition-colors"><Minus size={14} /></button>
                                  <input type="number" value={currentStock} onClick={e => e.stopPropagation()} onChange={(e) => handleStockDraftChange(rec.id, e.target.value)} className="w-16 text-center text-sm font-bold bg-transparent outline-none appearance-none text-gray-900 dark:text-white" />
                                  <button onClick={(e) => { e.stopPropagation(); handleStockDraftChange(rec.id, currentStock + 1); }} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-800 rounded-md transition-colors"><Plus size={14} /></button>
                                </div>
                                {hasChanges && (
                                  <div className="flex items-center gap-2 w-full animate-in fade-in zoom-in-95">
                                    <button onClick={(e) => { e.stopPropagation(); saveStock(rec.id); }} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg py-1.5 flex justify-center transition-colors shadow-sm font-bold text-xs">Guardar</button>
                                    <button onClick={(e) => { e.stopPropagation(); cancelStock(rec.id); }} className="bg-red-500 hover:bg-red-600 text-white rounded-lg py-1.5 px-3 flex justify-center transition-colors shadow-sm"><X size={14} /></button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 flex justify-between items-center">
                          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 flex items-center gap-1.5"><Clock size={12} /> {new Date(rec.created_at).toLocaleDateString()}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => navigate(`/cases/${rec.id}`)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors" title="Editar / Ver"><Edit2 size={14} /></button>
                            {modPerms?.delete && <button onClick={(e) => { e.stopPropagation(); handleDeleteSingle(rec.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors" title="Eliminar Registro"><Trash2 size={14} /></button>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {totalPages > 1 && (
              <div className={`border-t border-gray-100 dark:border-gray-800/80 py-4 pl-4 pr-20 md:pr-24 flex justify-between items-center bg-gray-50/30 dark:bg-gray-900/50 mt-auto ${viewMode === 'table' ? '' : 'border border-gray-200 dark:border-gray-800 rounded-b-2xl'}`}>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Mostrando <span className="font-bold text-gray-700 dark:text-gray-300">{indexOfFirstRecord + 1}</span> - <span className="font-bold text-gray-700 dark:text-gray-300">{Math.min(indexOfLastRecord, filteredAndSortedRecords.length)}</span> de <span className="font-bold text-gray-700 dark:text-gray-300">{filteredAndSortedRecords.length}</span>
                </p>
                <div className="flex gap-1.5">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"><ChevronLeft size={16} /></button>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODALES GLOBALES */}
      {isModalOpen && <CaseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={() => fetchData()} moduleId={moduleId} />}
      <ImportDataModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} moduleId={moduleId} fields={fields} forms={forms} onSuccess={() => fetchData()} />
      <ImportHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} moduleId={moduleId} onSuccess={() => fetchData()} />
      <BulkActionsBar selectedCount={selectedRecords.length} onClear={() => setSelectedRecords([])} onUpdate={() => setIsBulkUpdateModalOpen(true)} onDelete={handleBulkDelete} canDelete={canCreate} />
      <BulkUpdateModal isOpen={isBulkUpdateModalOpen} onClose={() => setIsBulkUpdateModalOpen(false)} fields={fields} selectedCount={selectedRecords.length} isSaving={isBulkSaving} onConfirm={handleBulkUpdate} />
      
      {/* ========================================================= */}
      {/* 🔥 MODAL DE GESTIÓN DE WEBHOOKS & API DOCS 🔥 */}
      {/* ========================================================= */}
      {isWebhookModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[555] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl md:max-w-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
            
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {docsWebhook ? (
                  <><Terminal size={18} className="text-emerald-500"/> Docs API: {docsWebhook.name}</>
                ) : (
                  <><Globe size={18} className="text-blue-500" /> Webhooks de Entrada (Inbound API)</>
                )}
              </h3>
              <button onClick={() => setIsWebhookModalOpen(false)} className="text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors"><X size={18}/></button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6">
              
              {/* VISTA DE DOCUMENTACIÓN DEL WEBHOOK */}
              {docsWebhook ? (
                 <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 duration-300">
                    <button onClick={() => setDocsWebhook(null)} className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white w-fit transition-colors">
                       <ArrowLeft size={16}/> Volver a la lista
                    </button>

                    <div className="space-y-4">
                       {/* POST */}
                       <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/50 rounded-xl p-4">
                          <div className="flex justify-between items-center mb-2">
                             <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase">Crear un Nuevo Registro</h4>
                          </div>
                          <div className="flex items-center gap-2">
                             <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-1 rounded">POST</span>
                             <code className="flex-1 bg-white dark:bg-gray-950 border border-emerald-100 dark:border-emerald-800/30 rounded-lg px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 font-mono truncate select-all">
                                {getBaseUrl()}/api/v1/webhooks/in/{docsWebhook.token}
                             </code>
                             <button onClick={() => copyText(`${getBaseUrl()}/api/v1/webhooks/in/${docsWebhook.token}`)} className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shrink-0"><Copy size={16}/></button>
                          </div>
                       </div>
                       
                       {/* GET */}
                       <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 rounded-xl p-4">
                          <div className="flex justify-between items-center mb-2">
                             <h4 className="text-xs font-bold text-blue-800 dark:text-blue-400 uppercase">Consultar un Registro</h4>
                          </div>
                          <div className="flex items-center gap-2">
                             <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 text-[10px] font-bold px-2 py-1 rounded">GET</span>
                             <code className="flex-1 bg-white dark:bg-gray-950 border border-blue-100 dark:border-blue-800/30 rounded-lg px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 font-mono truncate select-all">
                                {getBaseUrl()}/api/v1/webhooks/in/{docsWebhook.token}/<span className="text-blue-500 font-bold">{'{case_id}'}</span>
                             </code>
                             <button onClick={() => copyText(`${getBaseUrl()}/api/v1/webhooks/in/${docsWebhook.token}/{case_id}`)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0"><Copy size={16}/></button>
                          </div>
                       </div>

                       {/* PUT */}
                       <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50 rounded-xl p-4">
                          <div className="flex justify-between items-center mb-2">
                             <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase">Actualizar un Registro (Merge)</h4>
                          </div>
                          <div className="flex items-center gap-2">
                             <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-1 rounded">PUT</span>
                             <code className="flex-1 bg-white dark:bg-gray-950 border border-amber-100 dark:border-amber-800/30 rounded-lg px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 font-mono truncate select-all">
                                {getBaseUrl()}/api/v1/webhooks/in/{docsWebhook.token}/<span className="text-amber-500 font-bold">{'{case_id}'}</span>
                             </code>
                             <button onClick={() => copyText(`${getBaseUrl()}/api/v1/webhooks/in/${docsWebhook.token}/{case_id}`)} className="text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors shrink-0"><Copy size={16}/></button>
                          </div>
                       </div>

                       {/* CONSOLA DE EJEMPLO Y EXPLICACIÓN DE FLUJO */}
                       <div className="mt-8 space-y-5 border-t border-gray-100 dark:border-gray-800 pt-6">
                          
                          <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 p-4 rounded-xl flex gap-3 text-sm text-blue-900 dark:text-blue-200">
                             <Info size={20} className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                             <div>
                                <p className="font-bold mb-1.5">¿Cómo funciona el ciclo de vida de esta API?</p>
                                <ul className="list-disc pl-4 space-y-1.5 text-xs text-blue-800 dark:text-blue-300">
                                   <li><strong>Formulario Dinámico:</strong> Este Webhook ya está enlazado internamente al formulario que seleccionaste. No necesitas declarar IDs de formularios en el JSON.</li>
                                   <li><strong>Captura del case_id (POST):</strong> Al enviar una petición <code>POST</code> exitosa, la API devolverá un <code>case_id</code>. El sistema externo debe guardar ese número.</li>
                                   <li><strong>Consulta y Actualización (GET / PUT):</strong> Para consultar o actualizar el registro en el futuro, se debe inyectar el <code>case_id</code> guardado al final de la URL. En el método <code>PUT</code>, solo es necesario enviar los campos que se desean modificar (Merge).</li>
                                </ul>
                             </div>
                          </div>

                          <div>
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Terminal size={14}/> 1. Formato de Envío (Body para POST o PUT)</h4>
                              <div className="bg-[#1e1e1e] rounded-xl p-4 overflow-x-auto relative group shadow-inner border border-gray-800">
                                 <button onClick={() => copyText(JSON.stringify(webhookExample, null, 2))} className="absolute top-3 right-3 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-1.5 rounded-lg transition-colors" title="Copiar Payload">
                                   <Copy size={14}/>
                                 </button>
                                 {docsLoading ? (
                                    <div className="flex justify-center py-6"><Loader2 className="animate-spin text-emerald-500" size={24}/></div>
                                 ) : (
                                    <pre className="text-emerald-400 text-xs font-mono leading-relaxed">
                                       {webhookExample ? JSON.stringify(webhookExample, null, 2) : '// No se pudo generar el ejemplo.'}
                                    </pre>
                                 )}
                              </div>
                              <p className="text-[10px] text-gray-500 mt-2 italic">Envía los datos usando la cabecera HTTP <code>Content-Type: application/json</code>.</p>
                          </div>

                          <div>
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Terminal size={14}/> 2. Respuesta Esperada al crear (POST)</h4>
                              <div className="bg-[#1e1e1e] rounded-xl p-4 overflow-x-auto shadow-inner border border-gray-800">
                                    <pre className="text-blue-400 text-xs font-mono leading-relaxed">
{`{
  "status": "success",
  "message": "Registro creado.",
  "case_id": 1234
}`}
                                    </pre>
                              </div>
                              <p className="text-[10px] text-gray-500 mt-2 italic">Extrae el valor <code>case_id</code> de esta respuesta para utilizar las rutas GET y PUT posteriores.</p>
                          </div>
                       </div>
                    </div>
                 </div>

              ) : (
                 /* VISTA ORIGINAL DE LISTADO DE WEBHOOKS */
                 <div className="flex flex-col gap-6 animate-in slide-in-from-left-4 duration-300">
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4">
                       <h4 className="text-xs font-bold text-blue-800 dark:text-blue-400 uppercase mb-2">Generar Nueva Integración</h4>
                       <form onSubmit={handleCreateWebhook} className="flex flex-col sm:flex-row gap-2">
                          <input type="text" required placeholder="Ej: Conexión con Zapier, Formulario Web..." value={newWebhookName} onChange={e => setNewWebhookName(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-lg outline-none focus:border-blue-500" />
                          
                          <select required value={selectedFormId} onChange={e => setSelectedFormId(e.target.value)} className="w-full sm:w-1/3 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-lg outline-none focus:border-blue-500">
                             <option value="">Seleccionar Formulario...</option>
                             {forms.map(f => (
                                 <option key={f.id} value={f.id}>{f.name}</option>
                             ))}
                          </select>

                          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap"><Plus size={14}/> Generar</button>
                       </form>
                    </div>

                    <div>
                       <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Webhooks Activos</h4>
                       {loadingWebhooks ? (
                          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-500" size={24}/></div>
                       ) : moduleWebhooks.length === 0 ? (
                          <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                             <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No hay Webhooks activos para este módulo.</p>
                          </div>
                       ) : (
                          <div className="space-y-3">
                             {moduleWebhooks.map(wh => (
                                <div key={wh.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm flex flex-col gap-4">
                                   <div className="flex justify-between items-start">
                                      <div>
                                         <p className="text-sm font-bold text-gray-900 dark:text-white">{wh.name}</p>
                                         <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">Creado: {wh.created_at}</p>
                                      </div>
                                      <button onClick={() => handleDeleteWebhook(wh.id)} className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors bg-gray-50 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={16}/></button>
                                   </div>
                                   
                                   <div className="flex flex-col sm:flex-row gap-2">
                                      <button onClick={() => handleOpenDocs(wh)} className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                                         <BookOpen size={14}/> Ver Documentación API
                                      </button>
                                      <button onClick={() => copyText(`${getBaseUrl()}/api/v1/webhooks/in/${wh.token}`)} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                                         <Copy size={14}/> Copiar URL (POST)
                                      </button>
                                   </div>
                                </div>
                             ))}
                          </div>
                       )}
                    </div>
                 </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ModuleDataView;