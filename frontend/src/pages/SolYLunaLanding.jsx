import React, { useState, useEffect } from 'react';
import { ArrowRight, Speaker, Tv, ChefHat, ShoppingBag, ShieldCheck, MapPin, Moon, Sun } from 'lucide-react';

export default function SolYLunaLanding() {
  // Estado para el modo oscuro
  const [isDark, setIsDark] = useState(false);

  // Efecto para detectar la preferencia del usuario al cargar la página
  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Función para alternar el modo
  const toggleDarkMode = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setIsDark(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 selection:bg-blue-500 selection:text-white transition-colors duration-300">
      
      {/* NAVEGACIÓN */}
      <nav className="fixed w-full z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-white font-bold text-xl leading-none">S</span>
            </div>
            <span className="font-extrabold text-xl tracking-tight">SOL Y LUNA</span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* BOTÓN MODO OSCURO */}
            <button 
              onClick={toggleDarkMode} 
              className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              aria-label="Alternar modo oscuro"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <a 
              href="https://www.aegisflowbpm.com/c/10" 
              className="flex items-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-full text-sm font-bold hover:scale-105 transition-transform shadow-md"
            >
              <ShoppingBag size={16} />
              <span className="hidden sm:inline">Ver Catálogo</span>
            </a>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-transparent to-transparent dark:from-blue-900/20 dark:via-transparent dark:to-transparent transition-colors duration-300"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 transition-colors duration-300">
            Tecnología y confort <br className="hidden md:block"/> para tu día a día.
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-10 leading-relaxed transition-colors duration-300">
            Desde sistemas de audio profesional hasta electrodomésticos de última generación. Encuentra la mejor calidad y garantía en nuestra tienda.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="https://www.aegisflowbpm.com/c/10" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full text-lg font-bold shadow-xl shadow-blue-500/20 transition-all hover:-translate-y-1"
            >
              Explorar Catálogo <ArrowRight size={20} />
            </a>
            <a 
              href="#galeria" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 px-8 py-4 rounded-full text-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300"
            >
              Conocer el local
            </a>
          </div>
        </div>
      </section>

      {/* CATEGORÍAS */}
      <section className="py-20 bg-white dark:bg-gray-900 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Todo lo que necesitas en un solo lugar</h2>
            <p className="text-gray-600 dark:text-gray-400">Equipamos tu hogar y tus eventos con las mejores marcas.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Categoría 1 */}
            <div className="p-8 rounded-3xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-900 transition-colors group">
              <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Speaker size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Audio Profesional</h3>
              <p className="text-gray-600 dark:text-gray-400">Barras de sonido, parlantes portátiles Bluetooth, radios clásicas y auriculares de alta fidelidad.</p>
            </div>
            
            {/* Categoría 2 */}
            <div className="p-8 rounded-3xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-900 transition-colors group">
              <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ChefHat size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Electrodomésticos</h3>
              <p className="text-gray-600 dark:text-gray-400">Licuadoras, placas de inducción, sandwicheras, tostadoras y todo para modernizar tu cocina.</p>
            </div>

            {/* Categoría 3 */}
            <div className="p-8 rounded-3xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-900 transition-colors group">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Tv size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">Entretenimiento</h3>
              <p className="text-gray-600 dark:text-gray-400">Smart TVs 4K, accesorios de video y periféricos para transformar tu sala en un cine.</p>
            </div>
          </div>
        </div>
      </section>

      {/* GALERÍA BENTO */}
      <section id="galeria" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <h2 className="text-3xl font-bold mb-2">Visítanos en nuestro local</h2>
              <p className="text-gray-600 dark:text-gray-400">Stock disponible y entrega inmediata.</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-full">
              <ShieldCheck size={16} /> Garantía en todos los productos
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-[300px]">
            {/* Foto Amplia del Local */}
            <div className="md:col-span-8 rounded-3xl overflow-hidden relative group bg-gray-200 dark:bg-gray-800">
              <img 
                src="/images/tienda-panoramica.jpg" 
                alt="Interior de la tienda Sol y Luna" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
              <div className="absolute bottom-6 left-6 text-white">
                <p className="font-bold text-xl">Amplio Showroom</p>
              </div>
            </div>

            {/* Foto Electrodomésticos */}
            <div className="md:col-span-4 rounded-3xl overflow-hidden relative group bg-gray-200 dark:bg-gray-800">
              <img 
                src="/images/electrodomesticos.jpg" 
                alt="Exhibición de electrodomésticos" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
              <div className="absolute bottom-6 left-6 text-white">
                <p className="font-bold text-xl">Línea Hogar</p>
              </div>
            </div>

            {/* Foto Parlantes */}
            <div className="md:col-span-12 rounded-3xl overflow-hidden relative group h-[400px] bg-gray-200 dark:bg-gray-800">
              <img 
                src="/images/parlantes.jpg" 
                alt="Estante de radios y parlantes" 
                className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
              <div className="absolute bottom-6 left-6 text-white">
                <p className="font-bold text-xl">Audio Portátil</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 py-12 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
             <div className="w-6 h-6 bg-gray-900 dark:bg-white rounded flex items-center justify-center transition-colors">
              <span className="text-white dark:text-gray-900 font-bold text-xs">S</span>
            </div>
            <span className="font-bold tracking-tight text-gray-900 dark:text-white">Sol y Luna Electrónica</span>
          </div>
          
          <div className="flex items-center gap-6 text-gray-500 dark:text-gray-400 text-sm">
            <span className="flex items-center gap-1"><MapPin size={14}/> Luque, Paraguay</span>
            <a href="https://www.aegisflowbpm.com/c/10" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Ir al Catálogo</a>
          </div>
        </div>
      </footer>

      {/* BOTÓN FLOTANTE DE WHATSAPP */}
      <a 
        href="https://wa.me/595983464526?text=Hola,%20vengo%20de%20la%20página%20web%20y%20quiero%20hacer%20una%20consulta" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#20bd5a] text-white p-4 rounded-full shadow-xl hover:scale-110 transition-all duration-300 group flex items-center justify-center"
        aria-label="Contactar por WhatsApp"
      >
        <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
        <span className="absolute right-16 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">
          ¿Necesitas ayuda?
        </span>
      </a>
    </div>
  );
}