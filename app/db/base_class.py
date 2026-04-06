import re
from typing import Any
from sqlalchemy.ext.declarative import as_declarative, declared_attr

@as_declarative()
class Base:
    id: Any
    __name__: str

    # 🔥 MEJORA ARQUITECTURA: Convertir CamelCase a snake_case automáticamente 🔥
    # Ejemplo: GlobalAuditLog -> global_audit_log
    @declared_attr
    def __tablename__(cls) -> str:
        # 1. Identifica mayúsculas seguidas de minúsculas
        name = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', cls.__name__)
        # 2. Identifica minúsculas seguidas de mayúsculas y convierte todo a minúscula
        return re.sub('([a-z0-9])([A-Z])', r'\1_\2', name).lower()