"""Request and response models for the API."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import DocumentType, OutputFormat


Purpose = Literal["login", "signup"]


class OtpRequestIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=254, description="Indian mobile number or email")
    purpose: Purpose = Field(default="login", description="signup needs a new account; login needs an existing one")
    consent: bool = Field(default=False, description="Must be true to sign up. No code is sent without it.")


class OtpVerifyIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)
    code: str = Field(pattern=r"^\d{6}$")
    purpose: Purpose = "login"
    consent: bool = Field(default=False, description="Required for signup")


class AuthOptionsOut(BaseModel):
    mobile_login_enabled: bool
    google_enabled: bool


class GoogleLoginIn(BaseModel):
    credential: str = Field(min_length=20, max_length=4096, description="ID token from Google Sign-In")
    purpose: Purpose = "login"
    consent: bool = False


class MessageOut(BaseModel):
    message: str


class CsrfOut(BaseModel):
    csrf_token: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    mobile: str | None
    email: str | None
    is_admin: bool
    created_at: datetime


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_type: str
    original_filename: str
    mime_type: str
    size_bytes: int
    sha256: str
    width_px: int | None
    height_px: int | None
    page_count: int | None
    created_at: datetime


class DocumentUpdate(BaseModel):
    document_type: DocumentType


class ProfileIn(BaseModel):
    exam_name: str = Field(min_length=1, max_length=100)
    post: str | None = Field(default=None, max_length=150)
    document_type: DocumentType
    max_kb: int = Field(ge=5, le=2000)
    min_kb: int | None = Field(default=None, ge=1, le=2000)
    output_format: OutputFormat
    width_px: int | None = Field(default=None, ge=1, le=10000)
    height_px: int | None = Field(default=None, ge=1, le=10000)
    dpi: int | None = Field(default=None, ge=72, le=600)
    background: Literal["white"] = "white"
    notes: str = Field(default="", max_length=2000)
    source_url: str | None = Field(default=None, max_length=500)
    last_verified_on: date | None = None
    is_placeholder: bool = True

    @model_validator(mode="after")
    def _check_range(self) -> "ProfileIn":
        if self.min_kb is not None and self.min_kb > self.max_kb:
            raise ValueError("min_kb cannot be larger than max_kb.")
        return self


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exam_name: str
    post: str | None
    document_type: str
    max_kb: int
    min_kb: int | None
    output_format: str
    width_px: int | None
    height_px: int | None
    dpi: int | None
    background: str
    notes: str
    source_url: str | None
    last_verified_on: date | None
    is_placeholder: bool


class ProcessIn(BaseModel):
    """Exam mode: give profile_id and optionally override any value. Custom mode: give target_kb."""

    profile_id: int | None = None
    target_kb: int | None = Field(default=None, ge=5, le=2000)
    min_kb: int | None = Field(default=None, ge=1, le=2000)
    output_format: Literal["jpeg", "png", "pdf"] | None = None
    width: float | None = Field(default=None, gt=0, le=10000)
    height: float | None = Field(default=None, gt=0, le=10000)
    unit: Literal["px", "cm"] = "px"
    dpi: int | None = Field(default=None, ge=72, le=600)
    background: Literal["white"] | None = None

    @model_validator(mode="after")
    def _check_request(self) -> "ProcessIn":
        if self.profile_id is None and self.target_kb is None:
            raise ValueError("Choose an exam profile or enter a target size in KB.")
        if self.unit == "cm" and (self.width is not None or self.height is not None) and self.dpi is None:
            raise ValueError("DPI is required when the size is given in cm.")
        if self.min_kb is not None and self.target_kb is not None and self.min_kb > self.target_kb:
            raise ValueError("min_kb cannot be larger than target_kb.")
        return self


class DerivedOut(BaseModel):
    id: str
    original_id: str
    document_type: str
    output_format: str
    mime_type: str
    size_bytes: int
    sha256: str
    target_met: bool
    report: dict
    parameters: dict
    created_at: datetime
    expires_at: datetime
    download_name: str
    download_path: str
