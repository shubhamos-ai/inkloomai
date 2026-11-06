"""Onboarding schemas."""
from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, field_validator

CompanyIndustry = str


class OnboardingRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=255)
    company_name: str = Field(min_length=1, max_length=255)
    industry: str | None = Field(default=None, max_length=120)
    website: HttpUrl | None = None
    # Optional, useful for identity continuity in dev mode.
    email: EmailStr | None = None

    @field_validator("website", mode="before")
    @classmethod
    def _empty_site_becomes_none(cls, value):
        if isinstance(value, str) and not value.strip():
            return None
        return value


class OnboardingResponse(BaseModel):
    user_id: uuid.UUID
    company_id: uuid.UUID
    access_token: str = Field(
        description="Company API key. Shown exactly once — store it, it cannot be retrieved again."
    )
    token_type: str = "bearer"
    auth_mode: str = Field(
        description="'dev' — shared development token layer; production will use verified sessions."
    )
    message: str
