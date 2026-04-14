import sys
import os

# Añadimos la ruta raíz para que Python encuentre la carpeta 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models import models
# Asegúrate de que esta importación coincide con tu encriptador de contraseñas
from app.core.security import get_password_hash 

def init_system_company():
    db: Session = SessionLocal()
    try:
        print("🚀 Iniciando la creación del entorno System (AegisFlow HQ)...")

        # 1. Verificar o crear la Empresa Sistema
        system_company = db.query(models.Company).filter(models.Company.is_system_company == True).first()
        
        if system_company:
            print(f"⚠️ La empresa Sistema ya existe (ID: {system_company.id} - {system_company.name}).")
        else:
            system_company = models.Company(
                name="AegisFlow HQ",
                is_system_company=True,
                is_active=True
            )
            db.add(system_company)
            db.commit()
            db.refresh(system_company)
            print(f"✅ Empresa 'AegisFlow HQ' creada con éxito (ID: {system_company.id}).")

        # 2. Verificar o crear el Súper Administrador
        admin_email = "admin@aegisflow.com"  # <-- CAMBIA ESTO POR TU CORREO SI QUIERES
        admin_user = db.query(models.User).filter(models.User.email == admin_email).first()
        
        if admin_user:
            print(f"⚠️ El usuario {admin_email} ya existe en la base de datos.")
        else:
            temp_password = "AdminSuperSeguro2026*" # <-- CAMBIA ESTO POR UNA CONTRASEÑA TUYA
            hashed_pwd = get_password_hash(temp_password)
            
            admin_user = models.User(
                email=admin_email,
                hashed_password=hashed_pwd,
                is_superadmin=True,
                is_active=True,
                company_id=system_company.id,
                first_name="Soporte",
                last_name="AegisFlow",
                auth_provider="local"
            )
            db.add(admin_user)
            db.commit()
            print(f"✅ Súper Administrador creado con éxito: {admin_email}")
            print(f"🔑 Contraseña temporal: {temp_password}")
            print("🚨 IMPORTANTE: Inicia sesión y cambia tu contraseña inmediatamente.")

        print("🎉 ¡Inicialización completada! Ya tienes tus poderes de Omnipresencia.")

    except Exception as e:
        print(f"❌ Error crítico durante la inicialización: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_system_company()