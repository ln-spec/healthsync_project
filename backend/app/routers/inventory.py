from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client
from app.database import get_authenticated_client
from app.dependencies import require_facility_id
from app.schemas import InventoryAdjustment, InventoryCreate

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.post("", status_code=201)
def create_inventory_item(payload: InventoryCreate, client: Client = Depends(get_authenticated_client), facility_id: str = Depends(require_facility_id)) -> dict:
    try:
        rows = client.table("medicine_inventory").insert({**payload.model_dump(), "facility_id": facility_id}).execute().data
    except Exception as exc:
        raise HTTPException(status_code=409, detail="Medicine already exists or inventory entry is invalid") from exc
    if not rows:
        raise HTTPException(status_code=500, detail="Inventory item could not be created")
    return rows[0]


@router.get("")
def list_inventory(low_stock_only: bool = Query(default=False), client: Client = Depends(get_authenticated_client), facility_id: str = Depends(require_facility_id)) -> list[dict]:
    rows = client.table("medicine_inventory").select("*").eq("facility_id", facility_id).order("medicine_name").execute().data
    return [row for row in rows if not low_stock_only or row["stock_quantity"] <= row["reorder_threshold"]]


@router.post("/{item_id}/adjust")
def adjust_stock(item_id: str, payload: InventoryAdjustment, client: Client = Depends(get_authenticated_client), facility_id: str = Depends(require_facility_id)) -> dict:
    found = client.table("medicine_inventory").select("*").eq("id", item_id).eq("facility_id", facility_id).limit(1).execute().data
    if not found:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    item = found[0]
    quantity = item["stock_quantity"] + payload.delta
    if quantity < 0:
        raise HTTPException(status_code=409, detail="Adjustment would make stock negative")
    rows = client.table("medicine_inventory").update({"stock_quantity": quantity}).eq("id", item_id).eq("facility_id", facility_id).execute().data
    if not rows:
        raise HTTPException(status_code=500, detail="Inventory update failed")
    result = rows[0]
    result["low_stock"] = result["stock_quantity"] <= result["reorder_threshold"]
    return result
