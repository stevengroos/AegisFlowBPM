// src/context/NotificationContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, AlertCircle } from 'lucide-react';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // ==========================================
  // LÓGICA DE TOASTS (Notificaciones efímeras)
  // ==========================================
  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const notify = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  // ==========================================
  // LÓGICA DEL MODAL DE CONFIRMACIÓN
  // ==========================================
  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmDialog({
        title: options.title || '¿Estás seguro?',
        message: options.message || 'Esta acción no se puede deshacer.',
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar',
        variant: options.variant || 'danger', // 'danger' (rojo) o 'primary' (azul)
        onConfirm: () => {
          setConfirmDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmDialog(null);
          resolve(false);
        }
      });
    });
  }, []);

  return (
    <NotificationContext.Provider value={{ notify, confirm }}>
      {children}

      {/* RENDER DE TOASTS (Flotando arriba a la derecha) */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => {
          const icons = {
            success: <CheckCircle2 className="text-emerald-500" size={20} />,
            error: <AlertCircle className="text-red-500" size={20} />,
            warning: <AlertTriangle className="text-amber-500" size={20} />,
            info: <Info className="text-blue-500" size={20} />
          };
          const bgColors = {
            success: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300',
            error: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-800 dark:text-red-300',
            warning: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300',
            info: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-800 dark:text-blue-300'
          };

          return (
            <div key={toast.id} className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md animate-in slide-in-from-right-8 fade-in duration-300 w-80 ${bgColors[toast.type]}`}>
              <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
              <p className="text-sm font-medium flex-1">{toast.message}</p>
              <button onClick={() => removeToast(toast.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {/* RENDER DEL MODAL DE CONFIRMACIÓN (Reemplazo de window.confirm) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{confirmDialog.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={confirmDialog.onCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200">
                {confirmDialog.cancelText}
              </button>
              <button onClick={confirmDialog.onConfirm} className={`px-4 py-2 rounded-lg text-sm font-bold text-white shadow-md transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 ${confirmDialog.variant === 'danger' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 shadow-red-900/20' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 shadow-blue-900/20'}`}>
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);