from pydantic import BaseModel


class AuthStatusResponse(BaseModel):
    enabled: bool
    message: str

