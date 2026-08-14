import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function LegalPage({ title, lastUpdated }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-300 font-sans">
      {/* NAVBAR SIMPLE */}
      <nav className="fixed top-0 w-full z-50 bg-[#0B0F19]/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver al inicio
          </button>
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-500" />
            <span className="font-bold text-white tracking-wide">AegisFlow Legal</span>
          </div>
        </div>
      </nav>

      {/* CONTENIDO TEXTUAL */}
      <main className="pt-32 pb-20 px-6 max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{title}</h1>
        <p className="text-blue-400 mb-12">Última actualización: {lastUpdated}</p>

        <div className="space-y-8 text-lg leading-relaxed text-gray-400">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Recopilación de Información</h2>
            <p>
              En AegisFlow BPM, recopilamos información personal y corporativa únicamente para proveer, 
              mejorar y proteger nuestros servicios. Esto incluye datos de registro (nombre, correo electrónico) 
              y datos operativos generados dentro de los flujos de trabajo (Blueprints) y formularios dinámicos 
              creados por el Cliente.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Uso de la Información</h2>
            <p>
              Utilizamos la información recopilada para:
            </p>
            <ul className="list-disc pl-6 mt-4 space-y-2">
              <li>Autenticar usuarios mediante SSO y MFA.</li>
              <li>Ejecutar automatizaciones y reglas de negocio configuradas por su empresa.</li>
              <li>Generar registros inmutables de auditoría (ISO 27001).</li>
              <li>Proveer soporte técnico en tiempo real a través de nuestro Centro de Comando.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Seguridad de Datos (Zero Trust)</h2>
            <p>
              La seguridad es el núcleo de nuestra arquitectura. Implementamos Seguridad a Nivel de Campo (FLS) y 
              Control de Acceso Basado en Roles (RBAC). Su información está encriptada en tránsito y en reposo. 
              No compartimos ni vendemos datos corporativos de su ecosistema a terceros bajo ninguna circunstancia.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Cookies y Tecnologías de Rastreo</h2>
            <p>
              Utilizamos cookies estrictamente necesarias para mantener las sesiones de usuario activas y prevenir 
              ataques de fuerza bruta. Las cookies analíticas son opcionales y el usuario puede rechazarlas en 
              cualquier momento desde nuestro banner de privacidad.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Contacto</h2>
            <p>
              Si tiene preguntas sobre nuestra Política de Privacidad o las prácticas de seguridad de AegisFlow, 
              comuníquese con nuestro equipo de SecOps en: <strong>legal@aegisflowbpm.com</strong>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}