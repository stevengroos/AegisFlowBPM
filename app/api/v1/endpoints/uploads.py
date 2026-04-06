import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.models import models
from app.api import deps

router = APIRouter()

# Asegurarnos de que la carpeta "uploads" exista
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# 🔥 PENTEST FIX: Lista Blanca de extensiones permitidas 🔥
ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "xls", "xlsx", "txt", "csv", "png", "jpg", "jpeg", "webp"}
# 🔥 PENTEST FIX: Límite de tamaño (5 MB) para evitar colapso de disco (DoS) 🔥
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
        file_path = os.path.join(UPLOAD_DIR, unique_filename)

        with open(file_path, "wb") as buffer:
            buffer.write(content)

        file_url = f"/uploads/{unique_filename}"
        
        return {
            "filename": file.filename,
            "url": file_url,
            "message": "Archivo subido con éxito"
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

        file_path = os.path.join(UPLOAD_DIR, safe_filename)
        
        # Doble validación: Garantizar que la ruta absoluta final esté dentro de UPLOAD_DIR
        absolute_upload_dir = os.path.abspath(UPLOAD_DIR)
        absolute_file_path = os.path.abspath(file_path)
        if not absolute_file_path.startswith(absolute_upload_dir):
            raise HTTPException(status_code=400, detail="Ruta de archivo bloqueada por seguridad.")

        if os.path.exists(file_path):
            os.remove(file_path)
            return {"message": "Archivo eliminado exitosamente"}
            
        raise HTTPException(status_code=404, detail="El archivo no existe")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno al eliminar: {str(e)}")