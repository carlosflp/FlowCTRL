from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy.inspection import inspect


def model_to_dict(instance: Any) -> dict[str, Any]:
    mapper = inspect(instance).mapper
    payload = {column.key: getattr(instance, column.key) for column in mapper.column_attrs}
    return jsonable_encoder(payload)

