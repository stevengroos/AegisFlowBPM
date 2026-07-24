from supabase import create_client, Client
from app.core.config import settings

# Inicializamos el cliente de Supabase
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

def upload_file_to_supabase(bucket_name: str, file_name: str, file_bytes: bytes, content_type: str = "application/octet-stream") -> str:
    """
    Sube un archivo binario a un bucket de Supabase y retorna su URL pública.
    """
    try:
        # Subimos el archivo a Supabase (pisándolo si ya existe con el mismo nombre)
        res = supabase.storage.from_(bucket_name).upload(
            file_name, 
            file_bytes, 
            {"content-type": content_type, "upsert": "true"}
        )
        
        # Obtenemos y retornamos la URL pública para guardarla en la base de datos
        public_url = supabase.storage.from_(bucket_name).get_public_url(file_name)
        return public_url
    except Exception as e:
        print(f"Error subiendo archivo a Supabase: {e}")
        raise e