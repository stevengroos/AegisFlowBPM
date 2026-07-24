import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.models import models
from app.api import deps

# 🔥 IMPORTAMOS EL CLIENTE Y LA FUNCIÓN DE ALMACENAMIENTO EN LA NUBE 🔥
from app.core.storage import upload_file_to_supabase, supabase

router = APIRouter()

# 🔥 PENTEST FIX: Lista Blanca de extensiones permitidas 🔥
ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "xls", "xlsx", "txt", "csv", "png", "jpg", "jpeg", "webp"}
# 🔥 PENTEST FIX: Límite de tamaño (5 MB) para evitar colapso de memoria (DoS) 🔥
MAX_FILE_SIZE = 5 * 1024 * 1024 

@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    current_user: models.User = Depends(deps.get_current_user)
):
    try:
        # 🔥 PENTEST FIX: Validar extensión segura 🔥
        if "." not in file.filename:
            raise HTTPException(status_code=400, detail="El archivo no tiene una extensión válida.")
            
        file_extension = file.filename.split(".")[-1].lower()
        if file_extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400, 
                detail=f"Tipo de archivo no permitido. Solo se aceptan: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        content = await file.read()
        
        # 🔥 PENTEST FIX: Validar tamaño máximo 🔥
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="El archivo es demasiado grande (Máximo 5MB).")

        # Generar nombre único seguro
        unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
        content_type = file.content_type or "application/octet-stream"

        # 🔥 FASE NUBE: Subimos directamente a Supabase (RAM -> Cloud) 🔥
        file_url = upload_file_to_supabase(
            bucket_name="uploads",
            file_name=unique_filename,
            file_bytes=content,
            content_type=content_type
        )
        
        return {
            "filename": file.filename,
            "url": file_url,
            "message": "Archivo subido con éxito a la nube"
        }
    except HTTPException:
        raise  # Re-lanzar errores controlados de HTTP
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno al subir el archivo: {str(e)}")
    
@router.delete("/{filename}")
async def delete_file(
    filename: str,
    current_user: models.User = Depends(deps.get_current_user)
):
    try:
        # 🔥 PENTEST FIX: Bloquear Path Traversal (Salto de Directorio) 🔥
        safe_filename = os.path.basename(filename)
        if safe_filename != filename or ".." in filename or "/" in filename:
            raise HTTPException(status_code=400, detail="Nombre de archivo con caracteres inválidos o peligrosos.")

        # 🔥 FASE NUBE: Eliminamos de Supabase en lugar del disco duro local 🔥
        # Supabase recibe una lista de archivos a eliminar
        res = supabase.storage.from_("uploads").remove([safe_filename])
        
        # Si la API de Supabase devuelve un array vacío, el archivo no se encontró
        if not res:
            raise HTTPException(status_code=404, detail="El archivo no existe en la nube")
            
        return {"message": "Archivo eliminado exitosamente de la nube"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno al eliminar: {str(e)}")