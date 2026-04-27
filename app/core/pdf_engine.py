import hashlib
import os
import re
import html
from datetime import datetime
from jinja2 import Environment, BaseLoader, meta
from weasyprint import HTML, CSS
from typing import Dict, Any, List

class DocumentEngine:
    """
    Motor de generación de documentos 'Gold Standard'.
    Combina Jinja2 (para lógica condicional y variables) con WeasyPrint (para PDFs precisos).
    """
    def __init__(self):
        # Inicializamos Jinja2 para que lea strings de la base de datos directamente
        self.jinja_env = Environment(loader=BaseLoader())

    def extract_variables(self, template_content: str) -> List[str]:
        """
        Lee una plantilla HTML cruda y devuelve una lista con todas las variables 
        que el usuario escribió (ej. si escribió {{ nombre_cliente }}, devuelve ['nombre_cliente']).
        ¡Muy útil para decirle al Frontend qué variables necesita mandar!
        """
        ast = self.jinja_env.parse(template_content)
        return list(meta.find_undeclared_variables(ast))

    def render_html(self, raw_html: str, data: Dict[str, Any]) -> str:
        """
        Inyecta la data real en el HTML crudo usando Jinja2,
        limpiando primero la 'basura' HTML que insertan los editores visuales.
        """
        # 1. Reemplazar los molestos espacios HTML de Quill por espacios reales
        clean_html = raw_html.replace("&nbsp;", " ")
        
        # 2. Arreglar símbolos lógicos (ej. convertir &gt; en >) SOLO dentro de etiquetas Jinja
        def decode_jinja(match):
            return html.unescape(match.group(0))
            
        # Busca todo lo que esté entre {{ }} y lo limpia
        clean_html = re.sub(r'\{\{.*?\}\}', decode_jinja, clean_html)
        # Busca todo lo que esté entre {% %} y lo limpia
        clean_html = re.sub(r'\{%.*?%\}', decode_jinja, clean_html)

        # 3. Ahora sí, pasarlo al motor de Jinja2
        template = self.jinja_env.from_string(clean_html)
        return template.render(**data)

    def generate_pdf(self, rendered_html: str, output_filepath: str) -> str:
        """
        Convierte el HTML final en un PDF con calidad de impresión.
        Retorna el hash SHA-256 del archivo para auditoría y firma electrónica.
        """
        # 🔥 FIX: Inyectamos todo el CSS necesario para tablas y ReactQuill 🔥
        base_css = CSS(string='''
            @page { size: A4; margin: 2cm; }
            
            body { 
                font-family: 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif; 
                font-size: 11pt; 
                color: #333; 
                line-height: 1.5; 
            }
            
            /* 🛠️ EL ARREGLO DE LAS TABLAS 🛠️ */
            table {
                width: 100%;
                border-collapse: collapse; /* Hace que los bordes se unan como en Excel */
                margin-bottom: 20px;
            }
            th, td {
                border: 1px solid #d1d5db; /* Color del borde de la tabla */
                padding: 8px 12px;
                text-align: left;
                vertical-align: top;
            }
            th {
                background-color: #f3f4f6; /* Fondo gris para las cabeceras */
                font-weight: bold;
            }
            
            /* ReactQuill envuelve el texto de las tablas en <p>. Esto evita que se vean gigantes */
            td p {
                margin: 0;
                padding: 0;
            }

            /* 🛠️ EL ARREGLO DE LAS ALINEACIONES DE QUILL 🛠️ */
            .ql-align-center { text-align: center !important; }
            .ql-align-right { text-align: right !important; }
            .ql-align-justify { text-align: justify !important; }
            
            /* Arreglo para imágenes para que no se salgan de la hoja A4 */
            img {
                max-width: 100%;
                height: auto;
            }
        ''')
        
        # WeasyPrint hace la magia aquí, aplicando nuestros estilos al HTML
        HTML(string=rendered_html).write_pdf(output_filepath, stylesheets=[base_css])
        
        # Generar Huella Digital (SHA-256) del PDF final para evitar alteraciones
        sha256_hash = hashlib.sha256()
        with open(output_filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
                
        return sha256_hash.hexdigest()

# Instancia global para importar en otras partes de la app
document_engine = DocumentEngine()