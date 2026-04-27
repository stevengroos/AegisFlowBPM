import os
from cryptography.fernet import Fernet

# 🔥 IMPORTANTE: En producción, esta llave DEBE venir de tus variables de entorno (.env)
# Nunca la cambies una vez que tengas tokens guardados, o no podrás desencriptarlos.
# Para generar una llave nueva en tu terminal usa: from cryptography.fernet import Fernet; Fernet.generate_key()
SECRET_KEY = os.environ.get("INTEGRATION_ENCRYPTION_KEY", "uO1P1A8fM4zB_J5S-1hK8o9V2vM-U4aC9xQ_R7A_F8I=")

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