import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowRight, Activity, Database, Layers, 
  Workflow, Smartphone, LineChart, ShieldCheck, 
  Mail, FileSpreadsheet, MessageSquare, CheckCircle2,
  Code2, LayoutTemplate, Terminal, Lock, UserCog, Zap
} from 'lucide-react';

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

      {/* HERO SECTION */}
      <main className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-600/20 rounded-full blur-[100px] -z-10 pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl"
        >
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
            No adaptes tu empresa al software. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Adapta el software a tu empresa.
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            AegisFlow es el motor BPM definitivo. Diseña flujos de trabajo, crea formularios dinámicos y construye cualquier ecosistema digital sin escribir una sola línea de código.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-2 transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:shadow-[0_0_40px_rgba(37,99,235,0.6)] hover:-translate-y-1">
              Agendar una Demo
              <ArrowRight className="w-5 h-5" />
            </button>
            <button className="px-8 py-4 rounded-full bg-transparent hover:bg-white/5 border border-gray-600 text-white font-semibold transition-all">
              Explorar Plataforma
            </button>
          </div>
        </motion.div>
      </main>

      {/* SECCIÓN 2: DE CAOS A ORDEN (BPM) */}
      <section id="soluciones" className="py-24 relative border-t border-white/5 bg-gradient-to-b from-[#0B0F19] to-[#0d1323]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-6">El fin del caos operativo</h2>
            <p className="text-gray-400 text-lg">
              Un BPM (Business Process Management) es el cerebro de tu empresa. Transforma correos perdidos, hojas de cálculo rotas y tareas manuales en un flujo de trabajo predecible, automatizado y auditable.
            </p>
          </motion.div>

          {/* Animación Visual de Caos a Orden */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="flex flex-col gap-4 items-center">
              <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex gap-4">
                <Mail className="w-8 h-8" />
                <FileSpreadsheet className="w-8 h-8" />
                <MessageSquare className="w-8 h-8" />
              </div>
              <span className="text-gray-500 font-medium">Trabajo Manual</span>
            </motion.div>

            <ArrowRight className="hidden md:block w-12 h-12 text-blue-500/50" />

            <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="flex flex-col gap-4 items-center">
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex gap-4">
                <CheckCircle2 className="w-8 h-8" />
                <Workflow className="w-8 h-8" />
                <Database className="w-8 h-8" />
              </div>
              <span className="text-gray-500 font-medium">Flujos Automatizados</span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SECCIÓN 3: CONSTRUYE TU PROPIO ERP */}
      <section id="plataforma" className="py-24 relative">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Construye tu propio ecosistema</h2>
            <p className="text-gray-400 text-lg max-w-2xl">
              Con AegisFlow no compras un sistema cerrado. Compras un motor para construir cualquier herramienta que tu negocio necesite en cuestión de horas.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Activity, title: "CRM & Ventas", desc: "Gestiona prospectos y embudos de venta con reglas de negocio precisas.", color: "blue" },
              { icon: Layers, title: "Gestor de Inventarios", desc: "Controla stock, automatiza fórmulas de descuento y crea alertas de reabastecimiento.", color: "emerald" },
              { icon: Smartphone, title: "Catálogo Móvil B2C", desc: "Expón tus módulos hacia una App externa. Vende productos ocultando datos estratégicos.", color: "purple" },
              { icon: LineChart, title: "Dashboards & BI", desc: "Mide el rendimiento. Tableros analíticos en tiempo real con visibilidad por rol.", color: "orange" }
            ].map((item, i) => (
              <motion.div key={i} whileHover={{ y: -10 }} className={`p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-${item.color}-500/50 backdrop-blur-xl transition-colors group`}>
                <div className={`w-12 h-12 rounded-lg bg-${item.color}-500/20 flex items-center justify-center mb-6 text-${item.color}-400 group-hover:scale-110 transition-transform`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECCIÓN 4: EL MOTOR (BENTO BOX LAYOUT) */}
      <section id="motor" className="py-24 relative bg-[#06090F]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Potencia pura bajo el capó</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Diseñado para usuarios de negocio, construido para desarrolladores.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[300px]">
            
            {/* Bento Card 1: Blueprints (Ocupa 2 columnas en desktop) */}
            <motion.div whileHover={{ scale: 0.98 }} className="md:col-span-2 rounded-3xl bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-white/10 p-8 flex flex-col justify-between overflow-hidden relative group">
              <div className="relative z-10">
                <Workflow className="w-10 h-10 text-blue-400 mb-4" />
                <h3 className="text-2xl font-bold mb-2">Diseño Visual BPMN</h3>
                <p className="text-gray-400 max-w-md">Arrastra nodos, traza transiciones y define reglas de bloqueo. Visualiza el recorrido de tus datos en un lienzo interactivo.</p>
              </div>
              {/* Decoración gráfica */}
              <div className="absolute right-0 bottom-0 opacity-20 group-hover:opacity-40 transition-opacity translate-x-1/4 translate-y-1/4">
                <img src="/aegisflow-logo.svg" alt="BPMN" className="w-64 h-64 blur-sm" />
              </div>
            </motion.div>

            {/* Bento Card 2: Server Driven UI */}
            <motion.div whileHover={{ scale: 0.98 }} className="rounded-3xl bg-white/5 border border-white/10 p-8 flex flex-col justify-between">
              <div>
                <LayoutTemplate className="w-10 h-10 text-emerald-400 mb-4" />
                <h3 className="text-xl font-bold mb-2">Server-Driven UI</h3>
                <p className="text-gray-400 text-sm">Cambia un campo dinámico en el servidor y la interfaz gráfica de todos tus usuarios y apps móviles se actualizará en tiempo real.</p>
              </div>
            </motion.div>

            {/* Bento Card 3: Low Code Sandbox */}
            <motion.div whileHover={{ scale: 0.98 }} className="md:col-span-3 rounded-3xl bg-[#0D1117] border border-gray-800 p-0 flex flex-col md:flex-row overflow-hidden">
              <div className="p-8 md:w-1/3 flex flex-col justify-center border-r border-gray-800">
                <Terminal className="w-10 h-10 text-orange-400 mb-4" />
                <h3 className="text-2xl font-bold mb-2">Sandbox Low-Code</h3>
                <p className="text-gray-400">¿Lógicas complejas? Escribe scripts dinámicos en Python. El simulador de entorno seguro te permite probar matemáticas e integraciones antes de publicar.</p>
              </div>
              {/* Falsa Terminal */}
              <div className="md:w-2/3 bg-[#0A0D12] p-6 font-mono text-sm text-green-400 relative">
                <div className="absolute top-4 right-4 flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="mt-4 opacity-80">
                  <p><span className="text-purple-400">def</span> <span className="text-blue-400">process_global_rules</span>(case_data):</p>
                  <p className="ml-4 text-gray-500"># Calculando precios dinámicos desde webhook</p>
                  <p className="ml-4">cantidad = <span className="text-orange-300">float</span>(case_data.get(<span className="text-yellow-300">"cantidad"</span>, <span className="text-orange-300">1</span>))</p>
                  <p className="ml-4">costo_total = costo_unitario * cantidad</p>
                  <p className="ml-4 text-blue-300">return <span className="text-white">{"{ 'status': 200, 'updated': True }"}</span></p>
                  <p className="mt-4 text-gray-500"> Ejecución simulada completada en 0.42ms...</p>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* SECCIÓN 5: SEGURIDAD ENTERPRISE */}
      <section id="seguridad" className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center text-center">
          
          <ShieldCheck className="w-20 h-20 text-blue-500 mb-6 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
          
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Seguridad y Auditoría Nivel Enterprise</h2>
          <p className="text-gray-400 text-lg max-w-2xl mb-16">
            AegisFlow está construido bajo los estándares más estrictos de ciberseguridad, diseñado para proteger operaciones B2B y datos corporativos sensibles.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-left">
              <Lock className="w-8 h-8 text-blue-400 mb-4" />
              <h4 className="text-lg font-bold mb-2">Auditoría Inmutable (ISO 27001)</h4>
              <p className="text-gray-400 text-sm">Registro forense de "Rayos X" con visores JSON. Compara el estado anterior y el nuevo de cada variable en el sistema.</p>
            </div>
            
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-left">
              <UserCog className="w-8 h-8 text-purple-400 mb-4" />
              <h4 className="text-lg font-bold mb-2">Control de Acceso (RBAC & FLS)</h4>
              <p className="text-gray-400 text-sm">Jerarquía de roles estricta y Field-Level Security. Oculta, bloquea o permite la edición campo por campo según el perfil.</p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-left">
              <Zap className="w-8 h-8 text-emerald-400 mb-4" />
              <h4 className="text-lg font-bold mb-2">SSO & MFA Nativo</h4>
              <p className="text-gray-400 text-sm">Inicio de sesión único y políticas de Doble Factor de Autenticación forzadas por la empresa para mitigar ataques.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER & CTA FINAL */}
      <footer className="border-t border-white/10 bg-[#06090F] pt-20 pb-10 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-8">¿Listo para transformar tu empresa?</h2>
        <button className="px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] mb-20">
          Comienza tu prueba gratuita
        </button>
        <div className="text-gray-600 text-sm">
          © 2026 AegisFlow BPM. Todos los derechos reservados.
        </div>
      </footer>

    </div>
  );
}