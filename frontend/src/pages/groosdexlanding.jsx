import React from 'react';
import { Terminal, Smartphone, Globe, Workflow, MessageCircle, Mail, MapPin } from 'lucide-react';

const App = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300 font-sans selection:bg-[#00e599] selection:text-black flex flex-col">
      
      {/* Header */}
      <header className="w-full py-6 px-6 md:px-12 flex justify-between items-center border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="font-mono text-2xl font-bold flex items-center gap-1 cursor-default">
          <span className="text-[#00e599]">{'>_'}</span>
          <span className="text-white">GroosDex</span>
        </div>
        <div className="hidden md:flex items-center gap-4 text-sm font-mono text-gray-500">
          <span>Software & Tech</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        
        {/* Hero Section */}
        <section className="pt-24 pb-16 px-6 max-w-4xl mx-auto w-full flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400 mb-8 font-mono">
            <span className="w-2 h-2 rounded-full bg-[#00e599] animate-pulse"></span>
            Consultoría de Software
          </div>
          
          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight leading-tight">
            Consultoría y <br className="hidden md:block" /> Desarrollo de Software
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl leading-relaxed">
            Construimos aplicaciones móviles, web apps, páginas web y automatizaciones escalables. Soluciones y plataformas listas para usar.
          </p>
          
          {/* Terminal Mockup */}
          <div className="w-full max-w-lg bg-[#111111] rounded-lg border border-white/10 overflow-hidden shadow-2xl">
            <div className="bg-[#1a1a1a] px-4 py-2 flex items-center gap-2 border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              <span className="ml-2 text-xs font-mono text-gray-500">bash - groosdex</span>
            </div>
            <div className="p-5 font-mono text-sm text-left">
              <p className="text-gray-400 flex items-center gap-2">
                <span className="text-blue-400">~/groosdex</span> $ ./status
              </p>
              <p className="text-white mt-2 flex items-center gap-2">
                <span className="text-[#00e599]">{'>_'}</span> building software that scales
              </p>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="py-20 px-6 max-w-6xl mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Service 1 */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-8 hover:bg-white/10 transition-colors group">
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 text-gray-400 group-hover:text-[#00e599] transition-colors">
                <Smartphone size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Desarrollo Móvil</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Aplicaciones nativas y multiplataforma diseñadas para ofrecer la mejor experiencia en cualquier dispositivo.
              </p>
            </div>

            {/* Service 2 */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-8 hover:bg-white/10 transition-colors group">
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 text-gray-400 group-hover:text-[#00e599] transition-colors">
                <Globe size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Web Apps & Cloud</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Plataformas web robustas, escalables y seguras, construidas con las últimas tecnologías en la nube y APIs.
              </p>
            </div>

            {/* Service 3 */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-8 hover:bg-white/10 transition-colors group">
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 text-gray-400 group-hover:text-[#00e599] transition-colors">
                <Workflow size={24} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Automatizaciones</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Optimizamos procesos de negocio mediante integraciones inteligentes y flujos de trabajo automatizados.
              </p>
            </div>

          </div>
        </section>

        {/* CTA / Contact Section */}
        <section className="py-20 px-6 max-w-3xl mx-auto w-full text-center">
          <h2 className="text-3xl font-bold text-white mb-8">¿Listo para escalar tu idea?</h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="https://wa.me/595986201213" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-8 py-4 rounded-xl font-bold transition-all active:scale-95"
            >
              <MessageCircle size={20} />
              Contactar por WhatsApp
            </a>
            
            <a 
              href="mailto:stevengroos00@gmail.com"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/10 text-white px-8 py-4 rounded-xl font-bold transition-all active:scale-95"
            >
              <Mail size={20} />
              Enviar Correo
            </a>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full py-8 px-6 border-t border-white/5 mt-auto bg-[#050505]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-mono text-xl font-bold flex items-center gap-1 opacity-50">
            <span className="text-[#00e599]">{'>_'}</span>
            <span className="text-white">GroosDex</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-500 font-mono">
            <MapPin size={14} />
            <span>Ubicación: Paraguay</span>
          </div>
          
          <div className="text-xs text-gray-600 font-mono">
            © {new Date().getFullYear()} GroosDex. Software & Tech.
          </div>
        </div>
      </footer>

    </div>
  );
};

export default App;