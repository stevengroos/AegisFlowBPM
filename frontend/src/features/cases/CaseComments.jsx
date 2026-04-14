import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { Send, Loader2, MessageSquare, User, Bot } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { MentionsInput, Mention } from 'react-mentions';

const CaseComments = ({ caseId, currentUser }) => {
  const { notify } = useNotification();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [companyUsers, setCompanyUsers] = useState([]); 
  
  const messagesEndRef = useRef(null);

  const fetchInitialData = async (signal) => {
    try {
      const [commentsRes, usersRes] = await Promise.all([
        api.get(`/api/v1/cases/${caseId}/comments`, { signal }),
        api.get('/api/v1/auth/users', { signal })
      ]);
      setComments(commentsRes.data);
      
      const formattedUsers = usersRes.data.map(u => {
          const fullName = u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : '';
          const displayStr = fullName !== '' ? fullName : String(u.email);
          return {
            id: String(u.id), 
            display: displayStr 
          };
      });
        
      setCompanyUsers(formattedUsers);
    } catch (error) {
      if (error.name !== 'CanceledError') notify.error("Error al cargar los datos del chat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchInitialData(controller.signal);
    return () => controller.abort();
  }, [caseId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!newComment || !newComment.trim()) return;

    setSending(true);
    try {
      // 🔥 FIX SENIOR: Ya no limpiamos el comentario aquí. 
      // Mandamos el texto "sucio" (ej. "Hola @[Steven](5)") para que el backend 
      // extraiga el ID exacto y luego lo limpie.
      const res = await api.post(`/api/v1/cases/${caseId}/comments`, {
        content: newComment.trim()
      });
      setComments(prev => [...prev, res.data]);
      setNewComment('');
    } catch (error) {
      notify.error("No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  };

  const defaultMentionStyle = {
    control: { 
      backgroundColor: 'transparent', 
      fontSize: 14, 
      fontWeight: 'normal', 
      minHeight: 48 
    },
    highlighter: { 
      padding: '12px 48px 12px 16px', // 🔥 FIX: Exactamente igual al input
      boxSizing: 'border-box',
      overflow: 'hidden' 
    },
    input: { 
      margin: 0, 
      padding: '12px 48px 12px 16px', // 🔥 FIX: Exactamente igual al highlighter
      boxSizing: 'border-box',
      outline: 'none', 
      border: 'none' 
    },
    suggestions: {
      list: {
        backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.1)', fontSize: 14, borderRadius: 8,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', bottom: '100%', position: 'absolute', width: 200, zIndex: 50,
      },
      item: { padding: '8px 12px', borderBottom: '1px solid rgba(0,0,0,0.05)' },
    },
  };

  if (loading) return <div className="flex justify-center p-10 text-gray-400"><Loader2 className="animate-spin" size={32} /></div>;

  return (
    <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800/60 overflow-hidden flex flex-col h-[600px] shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/30 flex items-center gap-3">
        <MessageSquare size={20} className="text-blue-500" />
        <h3 className="font-bold text-gray-900 dark:text-white">Chat Contextual</h3>
        <span className="text-xs text-gray-500 font-medium ml-auto">Tip: Usa @ para mencionar</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-gray-50/30 dark:bg-gray-900/20">
        {comments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-70">
            <MessageSquare size={48} className="mb-4" />
            <p>No hay comentarios aún. ¡Sé el primero en escribir!</p>
          </div>
        ) : (
          comments.map((comment) => {
            const isMine = comment.user_id === currentUser?.id;
            if (comment.is_system_message) {
              return (
                <div key={comment.id} className="flex justify-center my-4">
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-1.5 rounded-full text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <Bot size={14} /> {comment.content}
                  </div>
                </div>
              );
            }
            return (
              <div key={comment.id} className={`flex gap-3 max-w-[85%] ${isMine ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isMine ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                  {isMine ? <User size={16} /> : (comment.user_name?.charAt(0)?.toUpperCase() || 'U')}
                </div>
                <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] font-bold text-gray-500 mb-1 px-1">{isMine ? 'Tú' : comment.user_name} • {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed shadow-sm ${isMine ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm'}`}>
                    {comment.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800/60 relative">
        <div className="relative border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-950 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
            {companyUsers.length > 0 ? (
              <MentionsInput
                  value={newComment}
                  onChange={(e, newValue) => setNewComment(newValue)}
                  style={defaultMentionStyle}
                  placeholder="Escribe un comentario... (Para enviar, presiona el botón 👉)"
                  className="w-full"
                  a11ySuggestionsListLabel={"Usuarios sugeridos"}
              >
                  <Mention
                      trigger="@"
                      data={companyUsers}
                      markup="@[__display__](__id__)" 
                      displayTransform={(id, display) => `@${display}`} 
                      renderSuggestion={(suggestion, search, highlightedDisplay) => (
                          <div className="text-gray-900 font-medium z-50">{highlightedDisplay}</div>
                      )}
                      // 🔥 FIX DE ESTILOS: Etiqueta azul translúcida perfecta
                      style={{ 
                          backgroundColor: 'rgba(59, 130, 246, 0.2)', // Fondo azul clarito (Tailwind blue-500 al 20%)
                          borderRadius: '4px',
                          padding: '0px 2px',
                          marginLeft: '-2px',
                          marginRight: '2px',
                          zIndex: 1 
                      }} 
                  />
              </MentionsInput>
            ) : (
              <textarea disabled className="w-full bg-transparent outline-none border-none resize-none px-4 py-3 text-sm text-gray-400" rows={1} style={{ minHeight: '48px' }} placeholder="Cargando chat..." />
            )}

            <button onClick={handleSend} disabled={!newComment || !newComment.trim() || sending} className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:bg-gray-400 z-10">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="ml-0.5" />}
            </button>
        </div>
      </div>
    </div>
  );
};

export default CaseComments;