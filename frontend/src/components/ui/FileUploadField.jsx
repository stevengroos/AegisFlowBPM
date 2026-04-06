import React, { useState } from 'react';
import api from '../../api/axios';
import { FileText, Trash2, Loader2, Plus } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain']
};

const FileUploadField = ({ type, value, onChange, disabled }) => {
  const [uploading, setUploading] = useState(false);
  const { notify } = useNotification();
  const baseURL = api.defaults.baseURL || 'http://localhost:8000';

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 🔥 PENTEST FIX: Validación estricta en JS antes de enviar (Defense in Depth)
    const allowedMimeTypes = type === 'image' ? ALLOWED_TYPES.image : ALLOWED_TYPES.document;
    if (!allowedMimeTypes.includes(file.type)) {
      notify.error(`Tipo de archivo no permitido. Sube un ${type === 'image' ? 'formato de imagen válido' : 'documento seguro'}.`);
      e.target.value = ''; // Limpiar input
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // Limite de 5MB
      notify.warning("El archivo es muy pesado. El límite es 5MB.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/api/v1/uploads/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(res.data.url);
      notify.success("Archivo subido con éxito.");
    } catch (error) { 
      notify.error("Error de conexión al subir el archivo."); 
    } finally { 
      setUploading(false); 
      e.target.value = '';
    }
  };

  const handleRemove = async () => {
    if (disabled) return;
    try {
      const filename = value.split('/').pop();
      await api.delete(`/api/v1/uploads/${filename}`);
      onChange(''); 
      notify.info("Archivo eliminado.");
    } catch (error) { 
      notify.error("Error al intentar eliminar el archivo del servidor."); 
    }
  };

  if (value) {
    return (
      <div className="relative border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 flex items-center justify-between group transition-colors w-full">
        <div className="flex items-center gap-3 overflow-hidden">
          {type === 'image' ? (
            <img src={`${baseURL}${value}`} alt="Preview" className="h-10 w-10 object-cover rounded-lg shadow-sm border border-gray-200 dark:border-gray-700" />
          ) : (
            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center shrink-0"><FileText size={18} /></div>
          )}
          <a href={`${baseURL}${value}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline truncate">
            {value.split('/').pop()}
          </a>
        </div>
        {!disabled && (
          <button type="button" onClick={handleRemove} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors shrink-0">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`relative border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors w-full ${disabled ? 'opacity-50 cursor-not-allowed hidden' : ''}`}>
      {uploading ? (
        <div className="flex flex-col items-center justify-center gap-2 text-blue-500">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-xs font-bold">Subiendo de forma segura...</span>
        </div>
      ) : (
        <>
          <input 
            type="file" 
            accept={type === 'image' ? ".jpg,.jpeg,.png,.webp" : ".pdf,.doc,.docx,.xls,.xlsx,.txt"} 
            onChange={handleUpload} 
            disabled={disabled} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
          />
          <div className="text-gray-400 flex flex-col items-center gap-1">
            <Plus size={18} />
            <span className="text-xs font-medium">Subir {type === 'image' ? 'imagen' : 'archivo'}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default FileUploadField;