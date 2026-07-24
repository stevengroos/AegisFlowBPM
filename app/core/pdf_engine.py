import hashlib
import re
import html
from jinja2 import Environment, BaseLoader, meta
from weasyprint import HTML, CSS
from typing import Dict, Any, List, Tuple

class DocumentEngine:
    """
    Motor de generación de documentos 'Gold Standard'.
    Combina Jinja2 (para lógica condicional y variables) con WeasyPrint (para PDFs precisos).
    """
    def __init__(self):
        # Inicializamos Jinja2 para que lea strings de la base de datos directamente
        self.jinja_env = Environment(loader=BaseLoader())

    def extract_variables(self, template_content: str) -> List[str]:
        ast = self.jinja_env.parse(template_content)
        return list(meta.find_undeclared_variables(ast))

    def render_html(self, raw_html: str, data: Dict[str, Any]) -> str:
        # 1. Reemplazar los molestos espacios HTML de Quill por espacios reales
        clean_html = raw_html.replace("&nbsp;", " ")
        
        # 2. Arreglar símbolos lógicos (ej. convertir &gt; en >) SOLO dentro de etiquetas Jinja
        def decode_jinja(match):
            return html.unescape(match.group(0))
            
        clean_html = re.sub(r'\{\{.*?\}\}', decode_jinja, clean_html)
        clean_html = re.sub(r'\{%.*?%\}', decode_jinja, clean_html)

        # 3. Ahora sí, pasarlo al motor de Jinja2
        template = self.jinja_env.from_string(clean_html)
        return template.render(**data)

    def generate_pdf_bytes(self, rendered_html: str) -> Tuple[bytes, str]:
        """
        🔥 FASE NUBE: Convierte el HTML en un PDF en la memoria RAM (Bytes).
        Retorna una tupla con los Bytes del PDF y su hash SHA-256.
        """
        base_css = CSS(string='''
            @page { size: A4; margin: 2cm; }
            body { font-family: 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif; font-size: 11pt; color: #333; line-height: 1.5; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; vertical-align: top; }
            th { background-color: #f3f4f6; font-weight: bold; }
            td p { margin: 0; padding: 0; }
            .ql-align-center { text-align: center !important; }
            .ql-align-right { text-align: right !important; }
            .ql-align-justify { text-align: justify !important; }
            img { max-width: 100%; height: auto; }
        ''')
        
        # Generar el PDF en memoria (retorna bytes)
        pdf_bytes = HTML(string=rendered_html).write_pdf(stylesheets=[base_css])
        
        # Generar Huella Digital (SHA-256) desde los bytes
        sha256_hash = hashlib.sha256(pdf_bytes).hexdigest()
                
        return pdf_bytes, sha256_hash

# Instancia global para importar en otras partes de la app
document_engine = DocumentEngine()