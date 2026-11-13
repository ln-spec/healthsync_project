from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from supabase import Client

from app.database import get_authenticated_client
from app.dependencies import require_facility_id
from app.services import report_service as svc

router = APIRouter(prefix="/reports", tags=["reports"])

XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CSV_TYPE = "text/csv; charset=utf-8"


@router.get("/monthly")
def monthly_report(
    month: str | None = Query(default=None, description="Reporting month, YYYY-MM. Defaults to the current month (Manila)."),
    format: str = Query(default="xlsx", pattern="^(xlsx|csv|json)$"),
    client: Client = Depends(get_authenticated_client),
    facility_id: str = Depends(require_facility_id),
):
    """Monthly facility report: consultations by age group, top diagnoses,
    vaccination compliance and medicine consumption.

    Always scoped to the caller's verified facility; no facility ID is accepted from the client.
    """
    try:
        period = svc.parse_period(month)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if period.start > svc.datetime.now(svc.MANILA):
        raise HTTPException(status_code=422, detail="Reporting month is in the future")

    try:
        report = svc.build_report(client, facility_id, period)
    except HTTPException:
        raise
    except Exception as exc:
        svc.log.exception("Monthly report failed")
        raise HTTPException(status_code=502, detail="Report data could not be loaded. Please try again.") from exc

    if format == "json":
        return report
    body, media = (svc.render_xlsx(report), XLSX_TYPE) if format == "xlsx" else (svc.render_csv(report), CSV_TYPE)
    filename = f"healthsync-monthly-report-{period.key}.{format}"
    return Response(content=body, media_type=media, headers={
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Cache-Control": "no-store",  # contains patient-derived health data
    })
