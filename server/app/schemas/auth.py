"""Auth (email + password) schemas."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    # Optional at register time; the onboarding wizard asks for the name
    # in a later step and PATCHes it via /auth/me.
    name: str | None = Field(default=None, min_length=1, max_length=255)

    @field_validator("email", mode="before")
    @classmethod
    def _lowercase_email(cls, value):
        return str(value).strip().lower() if isinstance(value, str) else value


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def _lowercase_email(cls, value):
        return str(value).strip().lower() if isinstance(value, str) else value


class CompanySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    created_at: datetime
    analysis_count: int = 0
    compliance_score: Optional[int] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
    created_at: datetime


class MeResponse(BaseModel):
    user: UserOut
    companies: list[CompanySummary]


class UpdateMeRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=255)


class AuthSessionResponse(BaseModel):
    user_id: uuid.UUID
    session_token: str = Field(
        description="Opaque session token; send as 'Authorization: Bearer <token>'."
    )
    token_type: str = "bearer"
    name: str = ""
    has_company: bool = False
    message: str = ""
