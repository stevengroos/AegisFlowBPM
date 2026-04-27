import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 📚 DICCIONARIOS DE TRADUCCIÓN
const resources = {
  es: {
    translation: {
      profile: {
        title: "Datos Personales",
        subtitle: "Actualiza cómo te ven tus compañeros.",
        name: "Nombre",
        lastname: "Apellido",
        save_btn: "Guardar Cambios",
        language: "Idioma del Sistema"
      }
      // Aquí irás agregando más secciones: dashboard, settings, etc.
    }
  },
  en: {
    translation: {
      profile: {
        title: "Personal Information",
        subtitle: "Update how your teammates see you.",
        name: "First Name",
        lastname: "Last Name",
        save_btn: "Save Changes",
        language: "System Language"
      }
    }
  },
  pt: {
    translation: {
      profile: {
        title: "Dados Pessoais",
        subtitle: "Atualize como seus colegas veem você.",
        name: "Nome",
        lastname: "Sobrenome",
        save_btn: "Salvar Alterações",
        language: "Idioma do Sistema"
      }
    }
  }
};

i18n
  .use(LanguageDetector) // Detecta el idioma del navegador por defecto si el usuario es nuevo
  .use(initReactI18next) // Conecta i18n con React
  .init({
    resources,
    fallbackLng: 'es', // Si falla algo, usamos español
    interpolation: {
      escapeValue: false // React ya nos protege de ataques XSS
    }
  });

export default i18n;