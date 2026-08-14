import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowRight, Activity, Database, Layers, 
  Workflow, Smartphone, LineChart, ShieldCheck, 
  Mail, FileSpreadsheet, MessageSquare, CheckCircle2,
  Terminal, Lock, UserCog, Zap, Calculator
} from 'lucide-react';
// Al inicio de tu archivo LandingPage.jsx, junto a los otros imports
import MiniSandbox from '../components/MiniSandbox';

// 🔥 1. COMPONENTE DE MICRO-INTERACCIÓN (EFECTO LINTERNA) 🔥
const SpotlightCard = ({ children, className = "" }) => {
  const divRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative overflow-hidden rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl transition-colors group ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 z-0"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(99, 102, 241, 0.15), transparent 40%)`,
        }}
      />
      <div className="relative z-10 h-full flex flex-col">
        {children}
      </div>
    </div>
  );
};

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white selection:bg-blue-500/30 font-sans overflow-x-hidden">
      
      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 bg-[#0B0F19]/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/aegisflow-logo.svg" alt="AegisFlow Logo" className="w-10 h-10" />
            <span className="text-2xl font-bold tracking-wide">
              Aegis<span className="text-blue-500">Flow</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <a href="#soluciones" className="hover:text-white transition-colors">Soluciones</a>
            <a href="#plataforma" className="hover:text-white transition-colors">Plataforma</a>
            <a href="#motor" className="hover:text-white transition-colors">Tecnología</a>
            <a href="#seguridad" className="hover:text-white transition-colors">Seguridad</a>
            <button 
              onClick={() => navigate('/login')}
              className="px-6 py-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-2"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION CON NODOS ANIMADOS */}
      <main className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        
        {/* Luces de Fondo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
        
        {/* 🔥 2. ANIMACIÓN DE NODOS FLOTANTES EN EL FONDO 🔥 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
          <motion.div animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }} className="absolute top-1/4 left-1/4 w-32 h-[1px] bg-gradient-to-r from-blue-500 to-transparent rotate-45" />
          <motion.div animate={{ y: [0, 20, 0], opacity: [0.2, 0.5, 0.2] }} transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }} className="absolute bottom-1/3 right-1/4 w-48 h-[1px] bg-gradient-to-r from-transparent to-purple-500 -rotate-12" />
          <motion.circle animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 3 }} className="absolute top-1/4 left-1/4 w-4 h-4 bg-blue-500 rounded-full blur-sm" />
          <motion.circle animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 4, delay: 1 }} className="absolute bottom-1/3 right-1/4 w-6 h-6 bg-purple-500 rounded-full blur-sm" />
        </div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="max-w-4xl relative z-10">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
            No adaptes tu empresa al software. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Adapta el software a tu empresa.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            El motor BPM que te permite modelar, automatizar y escalar cualquier proceso de negocio en tiempo récord. Crea tu propio ecosistema digital.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-2 transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:shadow-[0_0_40px_rgba(37,99,235,0.6)] hover:-translate-y-1">
              Agendar una Demo <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </main>

      {/* SECCIÓN 2: DE CAOS A ORDEN (ANIMACIÓN INTERACTIVA) */}
      <section id="soluciones" className="py-24 relative border-t border-white/5 bg-gradient-to-b from-[#0B0F19] to-[#0d1323] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">El fin del caos operativo</h2>
            <p className="text-gray-400 text-lg">
              Un BPM no es solo un sistema. Es el cerebro operativo de tu empresa. Transforma tareas caóticas, cuellos de botella y trabajo manual en flujos automatizados, predecibles y medibles.
            </p>
          </div>

          {/* 🔥 3. ANIMACIÓN VISUAL: CAOS ABSORBIDO POR EL ESCUDO 🔥 */}
          <div className="relative flex flex-col md:flex-row items-center justify-center h-64 w-full">
            
            {/* Elementos Caóticos (Izquierda) */}
            <motion.div 
              initial={{ x: -100, opacity: 0, rotate: -20 }}
              whileInView={{ x: 100, opacity: [1, 1, 0], rotate: 180, scale: 0.5 }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute left-1/4 top-1/4 text-red-400/50"
            >
              <FileSpreadsheet className="w-12 h-12" />
            </motion.div>
            <motion.div 
              initial={{ x: -100, opacity: 0, y: 50 }}
              whileInView={{ x: 120, opacity: [1, 1, 0], y: 0, scale: 0.5 }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute left-1/4 bottom-1/4 text-orange-400/50"
            >
              <Mail className="w-10 h-10" />
            </motion.div>

            {/* Escudo Central (AegisFlow) */}
            <div className="z-10 bg-[#0B0F19] p-4 rounded-full shadow-[0_0_50px_rgba(59,130,246,0.3)]">
              <img src="/aegisflow-logo.svg" alt="AegisFlow" className="w-24 h-24" />
            </div>

            {/* Flujo Ordenado (Derecha) */}
            <motion.div 
              initial={{ x: -50, opacity: 0 }}
              whileInView={{ x: 100, opacity: [0, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: 1 }}
              className="absolute right-1/3 text-emerald-400 flex gap-4"
            >
              <CheckCircle2 className="w-8 h-8" />
              <ArrowRight className="w-8 h-8" />
              <Database className="w-8 h-8" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 3: CONSTRUYE TU PROPIO ERP (TARJETAS GLASMORPHISM + SPOTLIGHT) */}
      <section id="plataforma" className="py-24 relative">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Construye tu propio ERP</h2>
            <p className="text-gray-400 text-lg max-w-2xl">
              Demostramos que AegisFlow no es una herramienta de un solo uso, sino un creador de soluciones. Crea un multiverso de módulos.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 🔥 4. USO DEL SPOTLIGHT CARD 🔥 */}
            <SpotlightCard className="p-8 hover:border-blue-500/50">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-6 text-blue-400 group-hover:scale-110 transition-transform">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">CRM & Ventas</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Gestiona prospectos, automatiza el seguimiento y calcula comisiones.
              </p>
            </SpotlightCard>

            <SpotlightCard className="p-8 hover:border-emerald-500/50">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-6 text-emerald-400 group-hover:scale-110 transition-transform">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Gestor de Inventario</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Controla stock en múltiples bodegas y automatiza alertas de reabastecimiento.
              </p>
            </SpotlightCard>

            <SpotlightCard className="p-8 hover:border-purple-500/50">
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-6 text-purple-400 group-hover:scale-110 transition-transform">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Catálogo Web (B2C)</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Expón tus productos al público en una app móvil ocultando información interna estratégica.
              </p>
            </SpotlightCard>

            <SpotlightCard className="p-8 hover:border-orange-500/50">
              <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-6 text-orange-400 group-hover:scale-110 transition-transform">
                <Calculator className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Créditos y Cobranzas</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Calcula saldos, programa fechas de vencimiento y audita pagos.
              </p>
            </SpotlightCard>
          </div>
        </div>
      </section>

      {/* 🔥 NUEVA SECCIÓN: INTERACTIVE SANDBOX 🔥 */}
      <section className="py-24 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 40 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }} 
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Experimenta la magia tú mismo</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              No tienes que ser programador para transformar tu empresa. Arrastra, conecta y automatiza. Haz la prueba aquí mismo:
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {/* AQUÍ INYECTAMOS NUESTRO COMPONENTE INTERACTIVO */}
            <MiniSandbox />
          </motion.div>
        </div>
      </section>

      {/* SECCIÓN 4: EL MOTOR BENTO BOX */}
      <section id="motor" className="py-24 relative bg-[#06090F]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">El Motor (Features Core)</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Explotamos las capacidades de un BPM Enterprise, presentándolas como superpoderes.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
            <SpotlightCard className="md:col-span-2 p-8">
              <Workflow className="w-10 h-10 text-blue-400 mb-4" />
              <h3 className="text-2xl font-bold mb-2">Blueprints (Drag & Drop)</h3>
              <p className="text-gray-400 max-w-md">Diseña procesos sin escribir código. Mapea estados y transiciones en un lienzo interactivo basado en BPMN.</p>
            </SpotlightCard>

            <SpotlightCard className="p-8">
              <Database className="w-10 h-10 text-emerald-400 mb-4" />
              <h3 className="text-xl font-bold mb-2">Formularios Dinámicos</h3>
              <p className="text-gray-400 text-sm">Interfaz controlada por el servidor (Server-Driven UI). Modifica un campo y actualiza todo el sistema en tiempo real.</p>
            </SpotlightCard>

            <SpotlightCard className="md:col-span-3 p-0 flex flex-col md:flex-row">
              <div className="p-8 md:w-1/3 border-r border-white/10">
                <Terminal className="w-10 h-10 text-orange-400 mb-4" />
                <h3 className="text-2xl font-bold mb-2">Automatizaciones (Low-Code)</h3>
                <p className="text-gray-400">Reglas de negocio sin límites. Usa código Python en nuestro Sandbox interactivo para operaciones complejas, o clics para tareas simples.</p>
              </div>
              <div className="md:w-2/3 bg-[#0A0D12] p-6 font-mono text-sm text-green-400 relative">
                <div className="absolute top-4 right-4 flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="mt-4 opacity-80">
                  <p><span className="text-purple-400">def</span> <span className="text-blue-400">process_rules</span>(data):</p>
                  <p className="ml-4 text-gray-500"># Motor Sandbox AegisFlow</p>
                  <p className="ml-4">status = evaluate_sla(data)</p>
                  <p className="ml-4 text-blue-300">return <span className="text-white">{"{ 'status': 200 }"}</span></p>
                </div>
              </div>
            </SpotlightCard>
          </div>
        </div>
      </section>

      {/* SECCIÓN 5: SEGURIDAD ENTERPRISE */}
      <section id="seguridad" className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center text-center">
          <ShieldCheck className="w-20 h-20 text-blue-500 mb-6 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Seguridad Nivel Enterprise</h2>
          <p className="text-gray-400 text-lg max-w-2xl mb-16">
            Un sistema que maneja datos corporativos debe inspirar confianza total.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-left">
              <Lock className="w-8 h-8 text-blue-400 mb-4" />
              <h4 className="text-lg font-bold mb-2">Auditoría Global Inmutable</h4>
              <p className="text-gray-400 text-sm">Cumplimiento de estándares ISO 27001 con visores JSON y trazabilidad absoluta.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-left">
              <UserCog className="w-8 h-8 text-purple-400 mb-4" />
              <h4 className="text-lg font-bold mb-2">Control Jerárquico (RBAC & FLS)</h4>
              <p className="text-gray-400 text-sm">Seguridad estricta a nivel de campo (Field-Level Security) y control de acceso basado en roles.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-left">
              <Zap className="w-8 h-8 text-emerald-400 mb-4" />
              <h4 className="text-lg font-bold mb-2">SSO & MFA Obligatorio</h4>
              <p className="text-gray-400 text-sm">Integraciones de inicio de sesión único con Autenticación Multifactor para blindar identidades.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER & CTA FINAL */}
      <footer className="border-t border-white/10 bg-[#06090F] pt-20 pb-10 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-8">¿Listo para transformar tu empresa?</h2>
        <button 
          onClick={() => navigate('/login')}
          className="px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] mb-20"
        >
          Comenzar Ahora
        </button>
        
        {/* Enlaces Legales */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-gray-500 text-sm mb-6">
          <button onClick={() => navigate('/privacidad')} className="hover:text-gray-300 transition-colors">
            Políticas de Privacidad
          </button>
          <span className="hidden md:block">•</span>
          <button onClick={() => navigate('/terminos')} className="hover:text-gray-300 transition-colors">
            Términos y Condiciones
          </button>
        </div>

        <div className="text-gray-600 text-sm">
          © 2026 AegisFlow BPM. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}