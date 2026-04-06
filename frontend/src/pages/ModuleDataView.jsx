import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Plus, Loader2, Filter, MoreHorizontal, Search, ArrowUpDown, ChevronLeft, ChevronRight, Download, Trash2, Box, Columns, CheckSquare, Square, UploadCloud, History } from 'lucide-react';
import Select from 'react-select'; // 🔥 IMPORTAMOS REACT-SELECT 🔥

import CaseModal from '../components/CaseModal';
import ImportDataModal from '../features/modules/ImportDataModal';
import ImportHistoryModal from '../features/modules/ImportHistoryModal';
import { useNotification } from '../context/NotificationContext';

const ModuleDataView = () => {
  const { moduleId } = useParams(); 
  const navigate = useNavigate(); 
  const { notify } = useNotification();
  
  const [module, setModule] = useState(null);
  const [records, setRecords] = useState([]);
  const [fields, setFields] = useState([]);
  const [forms, setForms] = useState([]); 
  
  // ESTADOS PARA CATÁLOGOS
  const [allStatuses, setAllStatuses] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Grid, Filtros y Columnas
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

  // 🔥 DETECCIÓN DE MODO OSCURO PARA REACT-SELECT 🔥
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDarkMode(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // 🔥 ESTILOS CUSTOM PARA REACT-SELECT 🔥
  const customSingleSelectStyles = {
    control: (provided) => ({ ...provided, borderColor: isDarkMode ? '#374151' : '#e5e7eb', backgroundColor: isDarkMode ? '#111827' : 'white', borderRadius: '0.5rem', minHeight: '38px', fontSize: '0.875rem', boxShadow: 'none', color: isDarkMode ? 'white' : 'black', '&:hover': { borderColor: isDarkMode ? '#4b5563' : '#9ca3af' } }),
    singleValue: (provided) => ({ ...provided, color: isDarkMode ? '#f9fafb' : '#111827' }),
    menu: (provided) => ({ ...provided, backgroundColor: isDarkMode ? '#1f2937' : 'white', border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden', zIndex: 99999 }),
    menuPortal: base => ({ ...base, zIndex: 99999 }),
    option: (provided, state) => ({ ...provided, fontSize: '0.875rem', backgroundColor: state.isSelected ? (isDarkMode ? '#374151' : '#eff6ff') : state.isFocused ? (isDarkMode ? '#111827' : '#f9fafb') : 'transparent', color: state.isSelected ? (isDarkMode ? '#60a5fa' : '#1d4ed8') : (isDarkMode ? '#d1d5db' : '#1f2937'), cursor: 'pointer' }),
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target)) setShowColumnSelector(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showColumnSelector) { setColumnSearchTerm(''); setColumnPage(1); }
  }, [showColumnSelector]);

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
      
      setUserData(userRes.data);
      setModule(modRes.data);
      setForms(formsRes.data);
      setAllStatuses(statusRes.data || []);
      setAllUsers(allUsersRes.data || []);
      
      let fetchedFields = [];
      if (formsRes.data.length > 0) {
        const firstFormId = formsRes.data[0].id;
        const fieldsRes = await api.get(`/api/v1/fields/?form_id=${firstFormId}`, { signal });
        fetchedFields = fieldsRes.data;
        setFields(fetchedFields); 
      }

      const savedColumns = localStorage.getItem(`module_${moduleId}_columns`);
      if (savedColumns) {
        setSelectedColumns(JSON.parse(savedColumns).slice(0, 5)); 
      } else if (fetchedFields.length > 0) {
        setSelectedColumns(fetchedFields.slice(0, 4).map(f => f.api_name || f.label));
      }

      const recordsRes = await api.get(`/api/v1/cases/?module_id=${moduleId}`, { signal });
      setRecords(recordsRes.data);
    } catch (error) {
      if (error.name !== 'CanceledError') {
        if (error.response && (error.response.status === 403 || error.response.status === 404)) {
          notify.error("Acceso denegado: No tienes permisos para ver este módulo.");
          navigate('/dashboard');
        } else {
          notify.error("Error al cargar los datos del módulo.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    clearFilters(); 
    return () => controller.abort();
  }, [moduleId]);

  const toggleColumn = (fieldKey) => {
    let newCols;
    if (selectedColumns.includes(fieldKey)) {
      newCols = selectedColumns.filter(c => c !== fieldKey); 
    } else {
      if (selectedColumns.length >= 5) return notify.warning("Máximo 5 columnas permitidas para mantener el diseño.");
      newCols = [...selectedColumns, fieldKey]; 
    }
    setSelectedColumns(newCols);
    localStorage.setItem(`module_${moduleId}_columns`, JSON.stringify(newCols));
  };

  const getStatusName = (statusId) => {
     if (!statusId) return 'Sin Estado';
     const s = allStatuses.find(s => s.id === statusId);
     return s ? s.name : `Estado ID: ${statusId}`;
  };

  const getUserName = (userId) => {
     if (!userId) return 'Sin Asignar';
     const u = allUsers.find(u => u.id === userId);
     return u ? (u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.email) : `Usuario ID: ${userId}`;
  };

  const filteredColumnFields = fields.filter(f => f.label.toLowerCase().includes(columnSearchTerm.toLowerCase()));
  const totalColumnPages = Math.ceil(filteredColumnFields.length / columnsPerPage) || 1;
  const currentColumnFields = filteredColumnFields.slice((columnPage - 1) * columnsPerPage, columnPage * columnsPerPage);
  const visibleFields = fields.filter(f => selectedColumns.includes(f.api_name || f.label));

  let filteredAndSortedRecords = records.filter(rec => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchId = rec.id.toString().includes(term);
      const matchData = Object.values(rec.data).some(v => String(v).toLowerCase().includes(term));
      const matchStatus = getStatusName(rec.status_id).toLowerCase().includes(term);
      const matchUser = getUserName(rec.assigned_to || rec.created_by).toLowerCase().includes(term);
      
      if (!matchId && !matchData && !matchStatus && !matchUser) return false;
    }
    if (startDate && new Date(rec.created_at) < new Date(startDate)) return false;
    if (endDate) {
      const end = new Date(endDate); end.setHours(23, 59, 59, 999);
      if (new Date(rec.created_at) > end) return false;
    }
    
    for (const [key, filterValue] of Object.entries(fieldFilters)) {
      if (filterValue) {
        let recValue = '';
        if (key === 'SYSTEM_STATUS') {
           recValue = getStatusName(rec.status_id).toLowerCase();
        } else if (key === 'SYSTEM_OWNER') {
           recValue = getUserName(rec.assigned_to || rec.created_by).toLowerCase();
        } else {
           recValue = String(rec.data[key] || '').toLowerCase();
        }
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

  // 🔥 NUEVA FUNCIÓN PARA AGREGAR FILTROS DESDE REACT-SELECT 🔥
  const handleAddFieldFilter = (selectedOption) => {
    if (!selectedOption) return;
    const key = selectedOption.value;
    if (!visibleFilterKeys.includes(key)) setVisibleFilterKeys([...visibleFilterKeys, key]);
  };

  const handleRemoveFieldFilter = (key) => {
    setVisibleFilterKeys(visibleFilterKeys.filter(k => k !== key));
    const newFilters = { ...fieldFilters };
    delete newFilters[key]; 
    setFieldFilters(newFilters);
    setCurrentPage(1);
  };

  const handleFilterValueChange = (key, value) => {
    setFieldFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setStartDate(''); setEndDate(''); setFieldFilters({});
    setVisibleFilterKeys([]); setSearchTerm(''); setCurrentPage(1);
  };

  const exportToCSV = () => {
    if (filteredAndSortedRecords.length === 0) return notify.warning("No hay registros para exportar con los filtros actuales.");
    
    const sanitizeCSV = (str) => {
      let text = String(str).replace(/"/g, '""').replace(/\n/g, ' ');
      if (/^[=\-+@]/.test(text)) text = "'" + text; 
      return `"${text}"`;
    };

    const baseHeaders = ['ID', 'Fecha de Creacion', 'Propietario', 'Estado'];
    const exportFields = fields; 
    const allHeaders = [...baseHeaders, ...exportFields.map(f => f.label)];

    const csvRows = filteredAndSortedRecords.map(rec => {
      const date = new Date(rec.created_at).toLocaleDateString();
      const owner = getUserName(rec.assigned_to || rec.created_by);
      const status = getStatusName(rec.status_id);
      
      const baseRow = [rec.id, date, sanitizeCSV(owner), sanitizeCSV(status)];
      const dynamicRow = exportFields.map(f => sanitizeCSV(rec.data[f.api_name] || rec.data[f.label] || ''));
      return [...baseRow, ...dynamicRow].join(',');
    });

    const csvContent = [allHeaders.join(','), ...csvRows].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${module?.name.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify.success("Exportación completada.");
  };

  const modPerms = userData?.permissions?.modules?.[moduleId] || {};
  const canCreate = userData?.is_superadmin || modPerms.create === true;

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{module?.name}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">Gestiona los registros y el progreso de este módulo.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          
          <div className="flex items-center bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800/80 rounded-lg shadow-sm mr-1 overflow-hidden">
            <button onClick={exportToCSV} className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 text-xs font-semibold border-r border-gray-200 dark:border-gray-800/80" title="Exportar a CSV">
              <Download size={14} /> <span className="hidden sm:inline">Exportar</span>
            </button>
            
            {canCreate && (
               <>
                 <button onClick={() => setIsImportModalOpen(true)} className="px-3 py-2 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center gap-1.5 text-xs font-semibold border-r border-gray-200 dark:border-gray-800/80" title="Importar desde Excel/CSV">
                   <UploadCloud size={14} /> <span className="hidden sm:inline">Importar</span>
                 </button>
                 <button onClick={() => setIsHistoryModalOpen(true)} className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 text-xs font-semibold" title="Historial de Importaciones">
                   <History size={14} />
                 </button>
               </>
            )}
          </div>

          <div className="relative" ref={columnSelectorRef}>
            <button onClick={() => setShowColumnSelector(!showColumnSelector)} className={`px-3 py-2 rounded-lg transition-colors shadow-sm border flex items-center gap-1.5 text-xs font-semibold ${showColumnSelector ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400' : 'bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800/80 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              <Columns size={14} /> <span className="hidden sm:inline">Columnas</span>
            </button>
            
            {showColumnSelector && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                  <div className="flex justify-between items-center mb-3 px-1">
                     <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Personalizar Vista</span>
                     <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedColumns.length >= 5 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                        {selectedColumns.length} / 5
                     </span>
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

          <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2 rounded-lg transition-colors shadow-sm border flex items-center gap-1.5 text-xs font-semibold ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400' : 'bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800/80 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            <Filter size={14} /> <span className="hidden sm:inline">Filtros</span>
          </button>
          
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
                      
                      {/* 🔥 REACT-SELECT PARA FILTROS ACTIVOS 🔥 */}
                      {isSystemStatus ? (
                         <Select
                            options={allStatuses.map(s => ({ value: s.name, label: s.name }))}
                            value={fieldFilters[key] ? { value: fieldFilters[key], label: fieldFilters[key] } : null}
                            onChange={opt => handleFilterValueChange(key, opt ? opt.value : '')}
                            placeholder="Cualquier estado..."
                            isClearable
                            styles={customSingleSelectStyles}
                            menuPortalTarget={document.body}
                            menuPosition={'fixed'}
                         />
                      ) : isSystemOwner ? (
                         <Select
                            options={allUsers.map(u => {
                               const name = u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.email;
                               return { value: name, label: name };
                            })}
                            value={fieldFilters[key] ? { value: fieldFilters[key], label: fieldFilters[key] } : null}
                            onChange={opt => handleFilterValueChange(key, opt ? opt.value : '')}
                            placeholder="Cualquier propietario..."
                            isClearable
                            styles={customSingleSelectStyles}
                            menuPortalTarget={document.body}
                            menuPosition={'fixed'}
                         />
                      ) : fieldDef?.field_type === 'select' ? (
                         <Select
                            options={fieldDef.options?.map(opt => ({ value: opt, label: opt })) || []}
                            value={fieldFilters[key] ? { value: fieldFilters[key], label: fieldFilters[key] } : null}
                            onChange={opt => handleFilterValueChange(key, opt ? opt.value : '')}
                            placeholder="Cualquier valor..."
                            isClearable
                            styles={customSingleSelectStyles}
                            menuPortalTarget={document.body}
                            menuPosition={'fixed'}
                         />
                      ) : (
                        <input type="text" placeholder="Contiene..." value={fieldFilters[key] || ''} onChange={e => handleFilterValueChange(key, e.target.value)} className="w-full px-3 py-2 min-h-[38px] text-sm border border-gray-200 dark:border-gray-700 rounded-lg outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm focus:border-blue-500" />
                      )}
                    </div>
                    <button onClick={() => handleRemoveFieldFilter(key)} className="mb-0.5 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors shrink-0" title="Quitar filtro">
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="pt-2">
            {/* 🔥 REACT-SELECT PARA AÑADIR NUEVOS FILTROS 🔥 */}
            <Select
               options={[
                  {
                     label: 'Datos del Sistema',
                     options: [
                        !visibleFilterKeys.includes('SYSTEM_STATUS') ? { value: 'SYSTEM_STATUS', label: 'Estado del Registro' } : null,
                        !visibleFilterKeys.includes('SYSTEM_OWNER') ? { value: 'SYSTEM_OWNER', label: 'Propietario / Asignado a' } : null
                     ].filter(Boolean)
                  },
                  {
                     label: 'Campos del Formulario',
                     options: fields.filter(f => !visibleFilterKeys.includes(f.api_name || f.label)).map(f => ({ value: f.api_name || f.label, label: f.label }))
                  }
               ]}
               value={null}
               onChange={(opt) => { if (opt) handleAddFieldFilter(opt); }}
               placeholder="+ Añadir regla de filtro..."
               styles={{
                  ...customSingleSelectStyles,
                  control: (provided) => ({ ...customSingleSelectStyles.control(provided), borderColor: isDarkMode ? '#1e3a8a' : '#bfdbfe', backgroundColor: 'transparent', color: isDarkMode ? '#60a5fa' : '#2563eb' }),
                  placeholder: (provided) => ({ ...provided, color: isDarkMode ? '#60a5fa' : '#2563eb', fontWeight: '600' })
               }}
               menuPortalTarget={document.body}
               menuPosition={'fixed'}
               isSearchable
            />
          </div>
        </div>
      )}

      {/* DATA GRID */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col z-0 relative">
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800/60 gap-4 bg-gray-50/30 dark:bg-gray-900/50">
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

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800/80">
              <tr>
                <th className="px-6 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">ID</th>
                <th className="px-6 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Creado</th>
                {visibleFields.map(field => (
                  <th key={field.id} className="px-6 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">{field.label}</th>
                ))}
                <th className="px-6 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Propietario</th>
                <th className="px-6 py-3.5 text-[11px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Estado</th>
                <th className="px-6 py-3.5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {currentListRecords.length === 0 ? (
                <tr>
                  <td colSpan={visibleFields.length + 5} className="px-6 py-16 text-center">
                    <Box className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-700 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                      {(searchTerm || startDate || endDate || Object.keys(fieldFilters).length > 0) ? 'No hay resultados para esta búsqueda.' : 'No hay registros en este módulo todavía.'}
                    </p>
                  </td>
                </tr>
              ) : (
                currentListRecords.map((rec) => (
                  <tr key={rec.id} onClick={() => navigate(`/cases/${rec.id}`)} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors group cursor-pointer">
                    <td className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300">#{rec.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(rec.created_at).toLocaleDateString()}</td>
                    {visibleFields.map(field => (
                      <td key={field.id} className="px-6 py-4 text-sm text-gray-900 dark:text-gray-200 truncate max-w-[200px]">
                        {typeof rec.data[field.api_name] === 'object' ? 'Datos...' : (rec.data[field.api_name] || rec.data[field.label] || <span className="text-gray-300 dark:text-gray-700">—</span>)}
                      </td>
                    ))}
                    
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                       {getUserName(rec.assigned_to || rec.created_by)}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                         {getStatusName(rec.status_id)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"><MoreHorizontal size={18} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-gray-100 dark:border-gray-800/80 p-4 flex justify-between items-center bg-gray-50/30 dark:bg-gray-900/50 mt-auto">
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

      {isModalOpen && (
        <CaseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={() => fetchData()} moduleId={moduleId} />
      )}

      <ImportDataModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        moduleId={moduleId} 
        fields={fields} 
        forms={forms} 
        onSuccess={() => fetchData()} 
      />
      <ImportHistoryModal 
        isOpen={isHistoryModalOpen} 
        onClose={() => setIsHistoryModalOpen(false)} 
        moduleId={moduleId} 
        onSuccess={() => fetchData()} 
      />
    </>
  );
};

export default ModuleDataView;