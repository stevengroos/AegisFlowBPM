import React, { useState, useEffect } from 'react';
import { ArrowRight, ShoppingBag, ShieldCheck, MapPin, Moon, Sun, CarFront, Wrench, Trophy, CheckCircle2 } from 'lucide-react';

export default function EwCarsLanding() {
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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 selection:bg-cyan-500 selection:text-white transition-colors duration-300">
      
      {/* NAVEGACIÓN */}
      <nav className="fixed w-full z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* LOGO TIPOGRÁFICO ADAPTADO A LA NUEVA IMAGEN */}
          <div className="flex flex-col justify-center leading-none select-none">
            <div className="font-black text-3xl tracking-tighter italic">
              <span className="text-zinc-900 dark:text-white">E</span>
              <span className="text-cyan-400">W</span>
            </div>
            <span className="font-light text-[11px] tracking-[0.3em] text-zinc-900 dark:text-white mt-0.5 ml-0.5">
              CARS
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleDarkMode} 
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              aria-label="Alternar modo oscuro"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <a 
              href="https://www.aegisflowbpm.com/c/37" 
              className="flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2.5 rounded-full text-sm font-bold hover:scale-105 transition-transform shadow-md"
            >
              <ShoppingBag size={16} />
              <span className="hidden sm:inline">Tienda Online</span>
            </a>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-200 via-zinc-50 to-zinc-50 dark:from-zinc-800 dark:via-zinc-950 dark:to-zinc-950 transition-colors duration-300"></div>
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] dark:opacity-[0.05] mix-blend-overlay"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 font-bold text-xs uppercase tracking-widest mb-6">
            <Trophy size={14} /> Accesorios & Equipamiento
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 uppercase italic text-zinc-900 dark:text-white">
            Eleva el nivel <br className="hidden md:block"/> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-600">de tu vehículo.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-600 dark:text-zinc-400 mb-10 leading-relaxed">
            Especialistas en polarizados nano-cerámicos, alfombras de alto tráfico, volantes deportivos y estética automotriz con instalación profesional.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="https://www.aegisflowbpm.com/c/37" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-4 rounded-full text-lg font-bold shadow-xl shadow-cyan-500/20 transition-all hover:-translate-y-1"
            >
              Ver Catálogo y Precios <ArrowRight size={20} />
            </a>
            <a 
              href="#showroom" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 px-8 py-4 rounded-full text-lg font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all duration-300"
            >
              Conocer el Showroom
            </a>
          </div>
        </div>
      </section>

      {/* SERVICIOS Y CARACTERÍSTICAS */}
      <section className="py-24 bg-zinc-900 dark:bg-zinc-900 text-white transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 border-y border-zinc-800 py-16">
            
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 bg-zinc-800 text-cyan-400 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300 transform group-hover:-translate-y-2">
                <ShieldCheck size={32} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold mb-3 uppercase tracking-wide">Calidad Garantizada</h3>
              <p className="text-zinc-400 leading-relaxed">Trabajamos con las mejores marcas en láminas de seguridad, polarizados nano-cerámicos y alfombras Heavy Duty.</p>
            </div>
            
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 bg-zinc-800 text-cyan-400 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300 transform group-hover:-translate-y-2">
                <Wrench size={32} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold mb-3 uppercase tracking-wide">Instalación Experta</h3>
              <p className="text-zinc-400 leading-relaxed">No solo vendemos el producto, nuestro equipo técnico asegura un montaje impecable con acabados de fábrica.</p>
            </div>

            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 bg-zinc-800 text-cyan-400 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300 transform group-hover:-translate-y-2">
                <CarFront size={32} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold mb-3 uppercase tracking-wide">Estética Interior</h3>
              <p className="text-zinc-400 leading-relaxed">Volantes deportivos, cobertores, iluminación LED y todo lo necesario para personalizar el habitáculo de tu auto.</p>
            </div>

          </div>
        </div>
      </section>

      {/* SHOWROOM */}
      <section id="showroom" className="py-24 bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-12">
            
            <div className="flex-1 space-y-6">
              <h2 className="text-4xl font-black uppercase italic tracking-tight">Visita nuestra<br/><span className="text-cyan-500">Boutique Automotriz</span></h2>
              <p className="text-lg text-zinc-600 dark:text-zinc-400">
                Diseñamos nuestro local para que tu experiencia de compra sea tan premium como los accesorios que instalas en tu vehículo. Contamos con un amplio stock de exhibición para que compruebes la calidad de los materiales antes de comprar.
              </p>
              <ul className="space-y-3 pt-4">
                <li className="flex items-center gap-3 font-bold text-zinc-800 dark:text-zinc-200">
                  <CheckCircle2 className="text-cyan-500" size={20}/> Alfombras Ultra Mats & Heavy Duty
                </li>
                <li className="flex items-center gap-3 font-bold text-zinc-800 dark:text-zinc-200">
                  <CheckCircle2 className="text-cyan-500" size={20}/> Exhibición de volantes deportivos
                </li>
                <li className="flex items-center gap-3 font-bold text-zinc-800 dark:text-zinc-200">
                  <CheckCircle2 className="text-cyan-500" size={20}/> Taller de instalación integrado
                </li>
              </ul>
            </div>

            <div className="flex-1 w-full">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl dark:shadow-cyan-900/10 border-4 border-white dark:border-zinc-800 group">
                <img 
                  src="/images/showroom-ewcars.jpg" 
                  alt="Interior del Showroom EW Cars" 
                  className="w-full object-cover aspect-[4/5] sm:aspect-square md:aspect-[4/5] transform transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>
                <div className="absolute bottom-8 left-8 text-white">
                  <p className="font-black text-2xl uppercase tracking-widest">Showroom</p>
                  <p className="text-zinc-300 font-medium flex items-center gap-1.5 mt-1"><MapPin size={16}/> Te esperamos en el local</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 py-12 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          
          <div className="flex flex-col justify-center leading-none select-none">
            <div className="font-black text-xl tracking-tighter italic">
              <span className="text-zinc-900 dark:text-white">E</span>
              <span className="text-cyan-400">W</span>
            </div>
            <span className="font-light text-[8px] tracking-[0.3em] text-zinc-900 dark:text-white mt-0.5 ml-0.5">
              CARS
            </span>
          </div>
          
          <div className="flex items-center gap-6 text-zinc-500 dark:text-zinc-400 text-sm font-medium">
            <span className="flex items-center gap-1"><MapPin size={16}/> Asuncion, Paraguay</span>
            <a href="https://www.aegisflowbpm.com/c/37" className="hover:text-cyan-500 transition-colors uppercase tracking-wider text-xs font-bold">Ir al Catálogo</a>
          </div>
        </div>
      </footer>

      {/* BOTÓN FLOTANTE DE WHATSAPP */}
      <a 
        href="https://wa.me/595983464526?text=Hola,%20vengo%20de%20la%20página%20web%20y%20quiero%20cotizar%20un%20accesorio%20para%20mi%20vehículo" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#20bd5a] text-white p-4 rounded-full shadow-xl hover:scale-110 transition-all duration-300 group flex items-center justify-center"
        aria-label="Contactar por WhatsApp"
      >
        <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
        <span className="absolute right-16 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">
          Agendar Instalación
        </span>
      </a>
    </div>
  );
}