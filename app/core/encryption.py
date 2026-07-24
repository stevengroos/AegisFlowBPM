import os
from cryptography.fernet import Fernet

# 🔥 Detectamos el entorno automáticamente (igual que en auth.py)
is_production = os.getenv("ENVIRONMENT", "local") == "production"

# Intentamos obtener la llave de las variables de entorno (.env o Render)
env_key = os.environ.get("INTEGRATION_ENCRYPTION_KEY")

if is_production:
    # 🛡️ ESCUDO DE PRODUCCIÓN: Si estamos en la nube y olvidaste poner la llave, el sistema explota a propósito.
    if not env_key:
        raise ValueError("🔥 SEGURIDAD CRÍTICA: Faltó configurar 'INTEGRATION_ENCRYPTION_KEY' en las variables de entorno de Render. El sistema no arrancará para proteger los datos de tus clientes.")
    SECRET_KEY = env_key
else:
    # 💻 MODO LOCAL: En tu computadora, usamos la llave por defecto para que puedas programar sin interrupciones.
    SECRET_KEY = env_key or "uO1P1A8fM4zB_J5S-1hK8o9V2vM-U4aC9xQ_R7A_F8I="

# Inicializamos el motor de encriptación
cipher_suite = Fernet(SECRET_KEY.encode('utf-8') if isinstance(SECRET_KEY, str) else SECRET_KEY)

def encrypt_secret(text: str) -> str:
    """Convierte texto plano en un hash ilegible."""
    if not text: 
        return text
    return cipher_suite.encrypt(text.encode('utf-8')).decode('utf-8')

def decrypt_secret(encrypted_text: str) -> str:
    """Recupera el texto plano a partir del hash."""
    if not encrypted_text: 
        return encrypted_text
    return cipher_suite.decrypt(encrypted_text.encode('utf-8')).decode('utf-8')