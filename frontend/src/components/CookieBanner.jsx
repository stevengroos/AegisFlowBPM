import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X } from 'lucide-react';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Revisamos si el usuario ya tomó una decisión antes
    const consent = localStorage.getItem('aegisflow_cookie_consent');
    if (!consent) {
      // Damos un pequeño retraso para que no aparezca de golpe al entrar a la web
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('aegisflow_cookie_consent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('aegisflow_cookie_consent', 'declined');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-[420px] z-[99999]"
        >
          <div className="bg-[#0B0F19]/95 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                <Cookie className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold mb-2">Valoramos tu privacidad</h3>
                {/* 🔥 FIX: Contraste mejorado (text-gray-300) 🔥 */}
                <p className="text-gray-300 text-sm leading-relaxed mb-6">
                  Utilizamos cookies esenciales para que la plataforma funcione, y analíticas para mejorar tu experiencia. ¿Aceptas su uso?
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={handleAccept}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-full transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                  >
                    Aceptar
                  </button>
                  <button 
                    onClick={handleDecline}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-sm font-semibold rounded-full transition-colors"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
              {/* 🔥 FIX: Etiqueta aria-label para accesibilidad IA/Lectores y contraste mejorado 🔥 */}
              <button 
                onClick={handleDecline}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Cerrar banner de cookies"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}