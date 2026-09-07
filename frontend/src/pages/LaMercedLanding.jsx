import React, { useEffect } from 'react';
import { ArrowRight, ShoppingBag, Flame, Leaf, MapPin, Utensils, MessageCircle, Star } from 'lucide-react';

export default function LaMercedLanding() {
  
  // Forzamos el modo oscuro para mantener la elegancia del logo
  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => document.documentElement.classList.remove('dark'); // Limpieza al salir
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-sans text-stone-200 selection:bg-[#d4af37] selection:text-black">
      
      {/* NAVEGACIÓN */}
      <nav className="fixed w-full z-50 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
          
          {/* LOGO */}
          <div className="flex items-center gap-3">
            {/* Si ya guardaste el logo, cambia el src por "/images/logo-lamerced.jpg" */}
            <div className="w-12 h-14 bg-[#141414] border border-[#d4af37]/30 rounded flex items-center justify-center p-1">
              <span className="font-serif text-[#d4af37] font-black text-2xl tracking-tighter">LM</span>
            </div>
            <span className="font-serif text-2xl tracking-[0.2em] text-[#d4af37] uppercase">La Merced</span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Reemplaza el ID '999' por el ID real de tu módulo Menú */}
            <a 
              href="https://www.aegisflowbpm.com/modules/40" 
              className="flex items-center gap-2 bg-[#d4af37] hover:bg-[#c29b2b] text-black px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:shadow-[0_0_25px_rgba(212,175,55,0.5)]"
            >
              <ShoppingBag size={16} />
              <span className="hidden sm:inline uppercase tracking-widest text-xs">Ver Menú</span>
            </a>
          </div>
        </div>
      </nav>

      {/* HERO SECTION (Fotos de Unsplash como Placeholder) */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-40 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1920&q=80" 
            alt="Pizza Artesanal" 
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 text-[#d4af37] font-bold text-xs uppercase tracking-widest mb-8">
            <Star size={14} /> Pizzería Boutique
          </div>
          <h1 className="text-5xl md:text-8xl font-serif mb-6 tracking-tight text-white leading-tight">
            Artesanía en <br className="hidden md:block"/> 
            <span className="text-[#d4af37] italic">cada porción.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-stone-400 mb-12 leading-relaxed font-light">
            Masa de fermentación lenta, ingredientes frescos y nuestra salsa de tomate de la casa. Descubre el verdadero sabor de la pizza artesanal.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="https://www.aegisflowbpm.com/modules/40" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#d4af37] text-black px-8 py-4 rounded-full text-lg font-bold transition-all hover:scale-105"
            >
              Realizar Pedido <ArrowRight size={20} />
            </a>
            <a 
              href="#especialidades" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-transparent border border-stone-700 text-stone-300 px-8 py-4 rounded-full text-lg font-bold hover:bg-stone-900 transition-all duration-300"
            >
              Ver Especialidades
            </a>
          </div>
        </div>
      </section>

      {/* FILOSOFÍA (Iconos y texto, no necesita fotos) */}
      <section className="py-24 bg-[#0f0f0f] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 bg-[#1a1a1a] text-[#d4af37] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 border border-white/5">
                <Utensils size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-serif mb-3 text-white">Masa Artesanal</h3>
              <p className="text-stone-400 leading-relaxed font-light">Preparada diariamente con fermentación controlada para lograr bordes aireados, crujientes y un centro perfecto.</p>
            </div>
            
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 bg-[#1a1a1a] text-[#d4af37] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 border border-white/5">
                <Flame size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-serif mb-3 text-white">Horneado Perfecto</h3>
              <p className="text-stone-400 leading-relaxed font-light">Temperaturas precisas que garantizan un queso derretido en su punto exacto y ese toque rústico inconfundible.</p>
            </div>

            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 bg-[#1a1a1a] text-[#d4af37] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 border border-white/5">
                <Leaf size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-serif mb-3 text-white">Toque Fresco</h3>
              <p className="text-stone-400 leading-relaxed font-light">Desde nuestra salsa de tomate secreta hasta el toque final de albahaca o rúcula fresca al salir del horno.</p>
            </div>

          </div>
        </div>
      </section>

      {/* ESPECIALIDADES DE LA CASA (Inspirado en el menú de Word) */}
      <section id="especialidades" className="py-24 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-serif text-white mb-6">
              Selección <span className="text-[#d4af37] italic">Especial</span>
            </h2>
            <p className="text-stone-400 font-light">
              Nuestras creaciones más solicitadas. Una fusión de sabores clásicos y toques gourmet pensados para paladares exigentes.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Tarjeta 1 - Blue Pear */}
            <div className="p-8 md:p-10 bg-[#121212] rounded-3xl border border-white/5 hover:border-[#d4af37]/30 transition-colors flex flex-col justify-center">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-serif text-white">Blue Pear <span className="text-sm font-sans text-[#d4af37] uppercase tracking-widest ml-2 block sm:inline mt-2 sm:mt-0">Agridulce</span></h3>
                <span className="font-bold text-lg text-white whitespace-nowrap">95.000 Gs</span>
              </div>
              <p className="text-stone-400 font-light leading-relaxed mb-6">
                Queso mozzarella, queso azul, rodajas de pera caramelizada, un toque de miel natural, queso parmesano y orégano sobre nuestra salsa de la casa.
              </p>
              <a href="https://www.aegisflowbpm.com/modules/40" className="text-[#d4af37] font-bold text-sm uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2 w-fit">
                Pedir ahora <ArrowRight size={16}/>
              </a>
            </div>

            {/* Tarjeta 2 - Arrabbiata */}
            <div className="p-8 md:p-10 bg-[#121212] rounded-3xl border border-white/5 hover:border-[#d4af37]/30 transition-colors flex flex-col justify-center">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-serif text-white">Arrabbiata <span className="text-sm font-sans text-red-500 uppercase tracking-widest ml-2 block sm:inline mt-2 sm:mt-0">Semi Picante</span></h3>
                <span className="font-bold text-lg text-white whitespace-nowrap">90.000 Gs</span>
              </div>
              <p className="text-stone-400 font-light leading-relaxed mb-6">
                Ajo picado, tomates cherry, rodajas de ají picante, tiras de locote verde y rojo, chorrito de aceite de oliva y mozzarella.
              </p>
              <a href="https://www.aegisflowbpm.com/modules/40" className="text-[#d4af37] font-bold text-sm uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2 w-fit">
                Pedir ahora <ArrowRight size={16}/>
              </a>
            </div>

             {/* Tarjeta 3 - La Merced */}
             <div className="p-8 md:p-10 bg-[#121212] rounded-3xl border border-white/5 hover:border-[#d4af37]/30 transition-colors flex flex-col justify-center lg:col-span-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#d4af37] opacity-5 blur-[100px] rounded-full pointer-events-none"></div>
              <div className="relative z-10 md:w-2/3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                  <h3 className="text-3xl font-serif text-white">La Merced Mediterránea</h3>
                  <span className="font-bold text-xl text-[#d4af37]">90.000 Gs</span>
                </div>
                <p className="text-stone-400 font-light leading-relaxed mb-8 text-lg">
                  La estrella de la casa. Mozzarella, cebolla caramelizada, tomates cherry, aceitunas negras, rúcula fresca y aceite de oliva extra virgen.
                </p>
                <a href="https://www.aegisflowbpm.com/modules/40" className="bg-white text-black px-8 py-3 rounded-full font-bold text-sm uppercase tracking-widest hover:bg-[#d4af37] transition-colors flex items-center gap-2 w-fit">
                  Ver Menú Completo
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* GALERÍA MOODBOARD (Placeholders elegantes) */}
      <section className="bg-[#0f0f0f] py-12">
         <div className="flex overflow-x-auto gap-4 px-4 sm:px-6 lg:px-8 pb-8 custom-scrollbar snap-x">
            <img src="https://images.unsplash.com/photo-1590947132387-155cc02f3212?auto=format&fit=crop&w=800&q=80" alt="Preparación" className="h-64 md:h-80 w-auto object-cover rounded-2xl snap-center opacity-80 hover:opacity-100 transition-opacity grayscale hover:grayscale-0"/>
            <img src="https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80" alt="Horno" className="h-64 md:h-80 w-auto object-cover rounded-2xl snap-center opacity-80 hover:opacity-100 transition-opacity grayscale hover:grayscale-0"/>
            <img src="https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?auto=format&fit=crop&w=800&q=80" alt="Ingredientes" className="h-64 md:h-80 w-auto object-cover rounded-2xl snap-center opacity-80 hover:opacity-100 transition-opacity grayscale hover:grayscale-0"/>
         </div>
         <p className="text-center text-stone-600 text-xs tracking-widest uppercase mt-2">Nuestra Cocina</p>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0a0a0a] border-t border-white/5 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
          
          <div className="flex flex-col items-center md:items-start leading-none select-none">
            <span className="font-serif text-2xl tracking-[0.2em] text-white uppercase">La Merced</span>
            <span className="font-light text-[9px] tracking-[0.3em] text-[#d4af37] mt-2">PIZZERÍA ARTESANAL</span>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 text-stone-500 text-sm font-medium">
            <span className="flex items-center gap-1.5"><MapPin size={16} className="text-[#d4af37]"/> Luque, Paraguay</span>
            <a href="https://www.aegisflowbpm.com/modules/40" className="hover:text-[#d4af37] transition-colors uppercase tracking-widest text-xs font-bold">Ver Catálogo</a>
          </div>
        </div>
      </footer>

      {/* BOTÓN FLOTANTE DE WHATSAPP (Ajustado para Pizzería) */}
      <a 
        href="https://wa.me/595986251631?text=Hola,%20quisiera%20hacer%20un%20pedido%20para%20delivery." 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#20bd5a] text-white p-4 rounded-full shadow-xl hover:scale-110 transition-all duration-300 group flex items-center justify-center"
        aria-label="Pedir por WhatsApp"
      >
        <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
        </svg>
        <span className="absolute right-16 bg-white text-black text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">
          Hacer un Pedido
        </span>
      </a>
    </div>
  );
}