from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class PatientCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    dob: date
    gender: str = Field(pattern="^(female|male|other|unknown)$")
    contact_number: str | None = Field(default=None, max_length=40)


class PatientUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    dob: date | None = None
    gender: str | None = Field(default=None, pattern="^(female|male|other|unknown)$")
    contact_number: str | None = Field(default=None, max_length=40)


class PatientRead(BaseModel):
    id: str
    full_name: str
    dob: date
    gender: str
    contact_number: str | None = None
    barangay_id: str
    created_at: datetime
    model_config = ConfigDict(extra="ignore")


class InventoryAdjustment(BaseModel):
    delta: int = Field(description="Signed stock adjustment; negative values represent dispensing")


class InventoryRead(BaseModel):
    id: str
    medicine_name: str
    stock_quantity: int
    reorder_threshold: int
    facility_id: str
    updated_at: datetime | None = None
