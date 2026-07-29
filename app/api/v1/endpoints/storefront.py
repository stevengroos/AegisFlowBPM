from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import models

router = APIRouter()

@router.get("/catalog/{module_id}")
def get_public_catalog(
    module_id: int,
    db: Session = Depends(get_db)
):
    """
    Endpoint PÚBLICO (Sin JWT). Retorna los registros de un módulo
    transformados en productos web utilizando el mapeo configurado.
    """
    # 1. Buscamos el módulo
    module = db.query(models.Module).filter(models.Module.id == module_id).first()
    if not module or not module.is_active:
        raise HTTPException(status_code=404, detail="Catálogo no encontrado o inactivo.")

    config = module.mobile_config or {}
    
    # 2. Verificamos si el catálogo está publicado
    if not config.get("is_published", False):
        raise HTTPException(status_code=403, detail="Este catálogo web no se encuentra público actualmente.")

    # 3. Extraemos el mapeo configurado por el administrador
    mapping = config.get("mapping", {})
    title_field = mapping.get("title")
    price_field = mapping.get("price")
    stock_field = mapping.get("stock")
    image_field = mapping.get("image")
    desc_field = mapping.get("description")

    # 4. Obtenemos todos los casos activos de este módulo
    cases = db.query(models.Case).filter(
        models.Case.module_id == module_id,
        models.Case.deleted_at == None
    ).all()

    # 5. Transformamos la data cruda del CRM en formato e-commerce
    catalog_items = []
    for case in cases:
        data = case.data or {}
        
        # Filtramos para no mostrar registros que no tengan título (borradores vacíos)
        title = data.get(title_field)
        if not title:
            continue

        try:
            price = float(data.get(price_field, 0)) if price_field else 0.0
        except (ValueError, TypeError):
            price = 0.0

        try:
            stock = int(data.get(stock_field, 0)) if stock_field else 0
        except (ValueError, TypeError):
            stock = 0

        catalog_items.append({
            "id": case.id,
            "title": title,
            "price": price,
            "stock": stock,
            "image_url": data.get(image_field, ""),
            "description": data.get(desc_field, ""),
            "raw_data": data # Enviamos la data cruda por si la tienda necesita mostrar campos extra (ej: Color, Marca)
        })

    return {
        "module_name": module.name,
        "custom_domain": config.get("custom_domain", ""),
        "theme_color": config.get("theme_color", "#3b82f6"),
        "products": catalog_items
    }