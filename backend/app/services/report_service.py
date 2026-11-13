"""Monthly facility report: data aggregation plus CSV / Excel rendering.

All figures are scoped to one facility and one calendar month in Manila time
(UTC+8, matching app/routers/analytics.py).
"""
from __future__ import annotations

import calendar
import csv
import io
import logging
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any, Iterable

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from supabase import Client

log = logging.getLogger(__name__)

MANILA = timezone(timedelta(hours=8), name="Asia/Manila")
PAGE_SIZE = 1000          # Supabase/PostgREST caps a single response at 1000 rows by default
IN_CHUNK = 100            # max ids per .in_() filter, keeps request URLs short
TOP_DIAGNOSES = 10

# Age groups (age in completed years on the visit date). Change here if the
# submitting office uses different cut-offs.
AGE_GROUPS = ("Infant", "Child", "Adult")
AGE_GROUP_LABELS = {
    "Infant": "Infant (under 1 year)",
    "Child": "Child (1-17 years)",
    "Adult": "Adult (18+ years)",
}
GENDERS = ("female", "male", "other", "unknown")


# --------------------------------------------------------------------------- helpers
@dataclass(frozen=True)
class Period:
    year: int
    month: int

    @property
    def start(self) -> datetime:
        return datetime(self.year, self.month, 1, tzinfo=MANILA)

    @property
    def end(self) -> datetime:  # exclusive
        return datetime(self.year + (self.month == 12), self.month % 12 + 1, 1, tzinfo=MANILA)

    @property
    def first_day(self) -> date:
        return date(self.year, self.month, 1)

    @property
    def last_day(self) -> date:
        return date(self.year, self.month, calendar.monthrange(self.year, self.month)[1])

    @property
    def label(self) -> str:
        return self.first_day.strftime("%B %Y")

    @property
    def key(self) -> str:
        return f"{self.year:04d}-{self.month:02d}"


def parse_period(value: str | None) -> Period:
    """'YYYY-MM' -> Period; None -> the current month in Manila."""
    if not value:
        now = datetime.now(MANILA)
        return Period(now.year, now.month)
    try:
        parsed = datetime.strptime(value, "%Y-%m")
    except ValueError as exc:
        raise ValueError("month must be in YYYY-MM format, e.g. 2026-11") from exc
    return Period(parsed.year, parsed.month)


def age_group(dob: date | None, on: date) -> str | None:
    if dob is None:
        return None
    years = on.year - dob.year - ((on.month, on.day) < (dob.month, dob.day))
    if years < 0:
        return None
    return "Infant" if years < 1 else "Child" if years < 18 else "Adult"


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _parse_date(value: str | None) -> date | None:
    return date.fromisoformat(value[:10]) if value else None


def _first(obj: Any) -> dict:
    if isinstance(obj, list):
        obj = obj[0] if obj else None
    return obj if isinstance(obj, dict) else {}


def _pct(numerator: int, denominator: int) -> float | None:
    """Fraction in [0,1], or None when the denominator is zero (renders as 'n/a')."""
    return numerator / denominator if denominator else None


def _paginate(build_query) -> list[dict]:
    """Fetch every row of a query. build_query() must return a fresh, ordered query."""
    rows: list[dict] = []
    offset = 0
    while True:
        batch = build_query().range(offset, offset + PAGE_SIZE - 1).execute().data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            return rows
        offset += PAGE_SIZE


def _chunks(items: list[str], size: int) -> Iterable[list[str]]:
    for i in range(0, len(items), size):
        yield items[i:i + size]


# --------------------------------------------------------------------------- aggregation
def build_report(client: Client, facility_id: str, period: Period) -> dict[str, Any]:
    notes: list[str] = []
    consultations = _consultations(client, facility_id, period, notes)
    return {
        "facility_id": facility_id,
        "period": {"month": period.key, "label": period.label,
                   "start": period.first_day.isoformat(), "end": period.last_day.isoformat()},
        "generated_at": datetime.now(MANILA).strftime("%Y-%m-%d %H:%M (Manila)"),
        "consultations": consultations["summary"],
        "diagnoses": consultations["diagnoses"],
        "vaccination": _vaccination(client, facility_id, period, notes),
        "medicine": _medicine(client, facility_id, period, notes),
        "notes": notes,
    }


def _consultations(client: Client, facility_id: str, period: Period, notes: list[str]) -> dict:
    rows = _paginate(lambda: (
        client.table("medical_records")
        .select("id,patient_id,visit_date,diagnosis,patients(dob,gender)")
        .eq("originating_facility_id", facility_id)
        .gte("visit_date", period.start.isoformat())
        .lt("visit_date", period.end.isoformat())
        .order("visit_date").order("id")
    ))

    by_group: Counter[str] = Counter()
    by_group_gender: dict[str, Counter[str]] = {g: Counter() for g in AGE_GROUPS}
    patients_by_group: dict[str, set[str]] = {g: set() for g in AGE_GROUPS}
    all_patients: set[str] = set()
    diag_total: Counter[str] = Counter()
    diag_display: dict[str, Counter[str]] = defaultdict(Counter)
    diag_groups: dict[str, Counter[str]] = defaultdict(Counter)
    unknown_age = 0
    daily: Counter[str] = Counter()

    for row in rows:
        visit_at = _parse_dt(row["visit_date"]).astimezone(MANILA)
        patient = _first(row.get("patients"))
        group = age_group(_parse_date(patient.get("dob")), visit_at.date())
        gender = patient.get("gender") if patient.get("gender") in GENDERS else "unknown"
        all_patients.add(str(row["patient_id"]))
        daily[visit_at.date().isoformat()] += 1

        raw = (row.get("diagnosis") or "").strip()
        key = " ".join(raw.casefold().split()) or "unspecified"
        diag_total[key] += 1
        diag_display[key][" ".join(raw.split()) or "Unspecified"] += 1

        if group is None:
            unknown_age += 1
            continue
        by_group[group] += 1
        by_group_gender[group][gender] += 1
        patients_by_group[group].add(str(row["patient_id"]))
        diag_groups[key][group] += 1

    if unknown_age:
        notes.append(f"{unknown_age} consultation(s) were excluded from the age-group breakdown because the "
                     "patient's date of birth is missing or later than the visit date. They are still included in totals.")

    total = len(rows)
    breakdown = [{
        "group": g, "label": AGE_GROUP_LABELS[g], "consultations": by_group[g],
        "unique_patients": len(patients_by_group[g]), "share": _pct(by_group[g], total),
        **{gender: by_group_gender[g][gender] for gender in GENDERS},
    } for g in AGE_GROUPS]

    diagnoses = [{
        "rank": i, "diagnosis": diag_display[key].most_common(1)[0][0], "count": count,
        "share": _pct(count, total),
        **{g: diag_groups[key][g] for g in AGE_GROUPS},
    } for i, (key, count) in enumerate(diag_total.most_common(TOP_DIAGNOSES), start=1)]

    busiest = max(daily.items(), key=lambda kv: kv[1]) if daily else None
    summary = {
        "total": total, "unique_patients": len(all_patients),
        "age_unknown": unknown_age, "breakdown": breakdown,
        "days_with_visits": len(daily),
        "busiest_day": {"date": busiest[0], "count": busiest[1]} if busiest else None,
    }
    return {"summary": summary, "diagnoses": diagnoses}


def _vaccination(client: Client, facility_id: str, period: Period, notes: list[str]) -> dict:
    """Compliance = doses scheduled (next_due_date) in the month whose *next* dose
    for the same patient and vaccine was recorded on or before the last day of the month."""
    administered = _paginate(lambda: (
        client.table("vaccination_logs").select("id,vaccine_name")
        .eq("facility_id", facility_id)
        .gte("date_administered", period.first_day.isoformat())
        .lte("date_administered", period.last_day.isoformat())
        .order("id")
    ))
    due = _paginate(lambda: (
        client.table("vaccination_logs")
        .select("id,patient_id,vaccine_name,dose_number,next_due_date")
        .eq("facility_id", facility_id)
        .gte("next_due_date", period.first_day.isoformat())
        .lte("next_due_date", period.last_day.isoformat())
        .order("id")
    ))

    # Follow-up doses: any log for these patients recorded up to month end (any facility RLS allows).
    patient_ids = sorted({str(r["patient_id"]) for r in due})
    followups: dict[tuple[str, str], list[tuple[int, date]]] = defaultdict(list)
    for chunk in _chunks(patient_ids, IN_CHUNK):
        rows = _paginate(lambda: (
            client.table("vaccination_logs")
            .select("id,patient_id,vaccine_name,dose_number,date_administered")
            .in_("patient_id", chunk)
            .lte("date_administered", period.last_day.isoformat())
            .order("id")
        ))
        for r in rows:
            d = _parse_date(r["date_administered"])
            if d:
                followups[(str(r["patient_id"]), r["vaccine_name"].strip().casefold())].append((r["dose_number"], d))

    stats: dict[str, dict] = defaultdict(lambda: {"given": 0, "due": 0, "completed": 0})
    display: dict[str, str] = {}
    for r in administered:
        k = r["vaccine_name"].strip().casefold()
        display.setdefault(k, r["vaccine_name"].strip())
        stats[k]["given"] += 1
    for r in due:
        k = r["vaccine_name"].strip().casefold()
        display.setdefault(k, r["vaccine_name"].strip())
        stats[k]["due"] += 1
        if any(dose > r["dose_number"] for dose, _ in followups.get((str(r["patient_id"]), k), [])):
            stats[k]["completed"] += 1

    by_vaccine = []
    for k in sorted(stats, key=lambda x: display[x].casefold()):
        s = stats[k]
        by_vaccine.append({
            "vaccine": display[k], "doses_given": s["given"], "doses_due": s["due"],
            "completed": s["completed"], "outstanding": s["due"] - s["completed"],
            "compliance": _pct(s["completed"], s["due"]),
        })
    total_due = sum(v["doses_due"] for v in by_vaccine)
    total_done = sum(v["completed"] for v in by_vaccine)
    if not total_due:
        notes.append("No vaccine doses were scheduled to fall due this month, so no compliance rate could be calculated.")
    return {
        "doses_given": len(administered), "doses_due": total_due, "completed": total_done,
        "outstanding": total_due - total_done, "compliance": _pct(total_done, total_due),
        "by_vaccine": by_vaccine,
    }


def _medicine(client: Client, facility_id: str, period: Period, notes: list[str]) -> dict:
    inventory = _paginate(lambda: (
        client.table("medicine_inventory").select("id,medicine_name,stock_quantity,reorder_threshold")
        .eq("facility_id", facility_id).order("medicine_name").order("id")
    ))
    dispensed: Counter[str] = Counter()
    restocked: Counter[str] = Counter()
    tracked = True
    try:
        moves = _paginate(lambda: (
            client.table("inventory_movements").select("id,inventory_id,delta")
            .eq("facility_id", facility_id)
            .gte("created_at", period.start.isoformat())
            .lt("created_at", period.end.isoformat())
            .order("id")
        ))
        for m in moves:
            (dispensed if m["delta"] < 0 else restocked)[str(m["inventory_id"])] += abs(m["delta"])
    except Exception:
        # Table not created yet (see backend/sql/001_inventory_movements.sql).
        log.exception("inventory_movements query failed")
        tracked = False
        notes.append("Medicine consumption could not be calculated: the stock movement log is unavailable. "
                     "Current stock levels are shown only.")

    items = []
    for it in inventory:
        stock, reorder = it["stock_quantity"], it["reorder_threshold"]
        items.append({
            "medicine": it["medicine_name"],
            "dispensed": dispensed[str(it["id"])] if tracked else None,
            "restocked": restocked[str(it["id"])] if tracked else None,
            "current_stock": stock, "reorder_threshold": reorder,
            "status": "Low stock" if stock <= reorder else "OK",
        })
    if tracked:
        items.sort(key=lambda i: (-i["dispensed"], i["medicine"].casefold()))
    return {
        "tracked": tracked, "items": items,
        "total_dispensed": sum(i["dispensed"] for i in items) if tracked else None,
        "low_stock_count": sum(i["status"] == "Low stock" for i in items),
    }


# --------------------------------------------------------------------------- CSV
def render_csv(report: dict[str, Any]) -> bytes:
    """One sectioned CSV (UTF-8 with BOM so Excel opens it correctly)."""
    buf = io.StringIO()
    w = csv.writer(buf)
    p, c, v, m = report["period"], report["consultations"], report["vaccination"], report["medicine"]
    pct = lambda x: "n/a" if x is None else f"{x * 100:.1f}%"
    na = lambda x: "n/a" if x is None else x

    w.writerow(["HEALTHSYNC MONTHLY FACILITY REPORT"])
    w.writerow(["Reporting period", p["label"], f'{p["start"]} to {p["end"]}'])
    w.writerow(["Facility ID", report["facility_id"]])
    w.writerow(["Generated", report["generated_at"]])
    w.writerow([])
    w.writerow(["1. CONSULTATIONS BY AGE GROUP"])
    w.writerow(["Age group", "Consultations", "Share", "Unique patients", *[g.title() for g in GENDERS]])
    for b in c["breakdown"]:
        w.writerow([b["label"], b["consultations"], pct(b["share"]), b["unique_patients"], *[b[g] for g in GENDERS]])
    w.writerow(["Age unknown", c["age_unknown"]])
    w.writerow(["TOTAL", c["total"], "", c["unique_patients"]])
    w.writerow([])
    w.writerow([f"2. TOP {TOP_DIAGNOSES} DIAGNOSES"])
    w.writerow(["Rank", "Diagnosis", "Cases", "Share of consultations", *AGE_GROUPS])
    for d in report["diagnoses"]:
        w.writerow([d["rank"], d["diagnosis"], d["count"], pct(d["share"]), *[d[g] for g in AGE_GROUPS]])
    w.writerow([])
    w.writerow(["3. VACCINATION COMPLIANCE"])
    w.writerow(["Vaccine", "Doses given this month", "Doses due this month", "Completed", "Outstanding", "Compliance rate"])
    for r in v["by_vaccine"]:
        w.writerow([r["vaccine"], r["doses_given"], r["doses_due"], r["completed"], r["outstanding"], pct(r["compliance"])])
    w.writerow(["OVERALL", v["doses_given"], v["doses_due"], v["completed"], v["outstanding"], pct(v["compliance"])])
    w.writerow([])
    w.writerow(["4. MEDICINE CONSUMPTION"])
    w.writerow(["Medicine", "Dispensed", "Restocked", "Current stock", "Reorder level", "Status"])
    for i in m["items"]:
        w.writerow([i["medicine"], na(i["dispensed"]), na(i["restocked"]), i["current_stock"], i["reorder_threshold"], i["status"]])
    w.writerow(["TOTAL DISPENSED", na(m["total_dispensed"])])
    if report["notes"]:
        w.writerow([])
        w.writerow(["NOTES"])
        for n in report["notes"]:
            w.writerow([n])
    return b"\xef\xbb\xbf" + buf.getvalue().encode("utf-8")


# --------------------------------------------------------------------------- Excel
FONT = "Arial"
NAVY = "0038FF"
HEADER_FILL = PatternFill("solid", fgColor=NAVY)
BAND_FILL = PatternFill("solid", fgColor="F7F8FA")
TOTAL_FILL = PatternFill("solid", fgColor="E6ECFF")
THIN = Side(style="thin", color="D0D5DD")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def _title(ws, text: str, sub: str, width: int) -> int:
    ws["A1"] = text
    ws["A1"].font = Font(name=FONT, size=14, bold=True, color=NAVY)
    ws["A2"] = sub
    ws["A2"].font = Font(name=FONT, size=10, italic=True, color="555555")
    return 4


def _table(ws, row: int, headers: list[str], body: list[list], pct_cols: set[int] = frozenset(),
           total_row: list | None = None) -> int:
    """Write header + body (+ optional total row). Returns the next free row. Columns are 0-based."""
    for j, h in enumerate(headers, start=1):
        c = ws.cell(row=row, column=j, value=h)
        c.font = Font(name=FONT, bold=True, color="FFFFFF")
        c.fill, c.border = HEADER_FILL, BORDER
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[row].height = 30
    for i, values in enumerate(body, start=1):
        for j, val in enumerate(values, start=1):
            c = ws.cell(row=row + i, column=j, value=val)
            c.font, c.border = Font(name=FONT), BORDER
            if i % 2 == 0:
                c.fill = BAND_FILL
            _style_cell(c, j - 1 in pct_cols, val)
    end = row + len(body)
    if total_row is not None:
        end += 1
        for j, val in enumerate(total_row, start=1):
            c = ws.cell(row=end, column=j, value=val)
            c.font, c.fill, c.border = Font(name=FONT, bold=True), TOTAL_FILL, BORDER
            _style_cell(c, j - 1 in pct_cols, val)
    return end + 2


def _style_cell(c, is_pct: bool, val) -> None:
    if is_pct:
        c.number_format = "0.0%"
    elif isinstance(val, int):
        c.number_format = "#,##0"
    c.alignment = Alignment(horizontal="left" if isinstance(val, str) and not str(val).startswith("=") else "right",
                            vertical="center", wrap_text=isinstance(val, str) and len(val) > 40)


def _widths(ws, widths: list[int]) -> None:
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


def render_xlsx(report: dict[str, Any]) -> bytes:
    p, c, v, m = report["period"], report["consultations"], report["vaccination"], report["medicine"]
    sub = f'{p["label"]} · Facility {report["facility_id"]} · Generated {report["generated_at"]}'
    wb = Workbook()

    # ---- Summary
    ws = wb.active
    ws.title = "Summary"
    r = _title(ws, "HealthSync Monthly Facility Report", sub, 3)
    comp = v["compliance"]
    rows = [
        ["Reporting period", p["label"]],
        ["Total consultations", c["total"]],
        ["Unique patients seen", c["unique_patients"]],
        ["Most common diagnosis", report["diagnoses"][0]["diagnosis"] if report["diagnoses"] else "n/a"],
        ["Vaccine doses given", v["doses_given"]],
        ["Vaccination compliance", comp if comp is not None else "n/a"],
        ["Total medicine dispensed (units)", m["total_dispensed"] if m["tracked"] else "n/a"],
        ["Medicines at or below reorder level", m["low_stock_count"]],
    ]
    r = _table(ws, r, ["Indicator", "Value"], rows)
    ws["B10"].number_format = "0.0%"  # compliance row (header at row 4, body from row 5)
    for cell in ws["B5:B12"]:
        cell[0].alignment = Alignment(horizontal="right")
    if report["notes"]:
        ws.cell(row=r, column=1, value="Notes").font = Font(name=FONT, bold=True)
        for n in report["notes"]:
            r += 1
            ws.cell(row=r, column=1, value=f"• {n}").font = Font(name=FONT, size=10)
            ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
            ws.cell(row=r, column=1).alignment = Alignment(wrap_text=True, vertical="top")
            ws.row_dimensions[r].height = 48
    _widths(ws, [38, 28, 14, 14, 14, 14])

    # ---- Consultations
    ws = wb.create_sheet("Consultations")
    r = _title(ws, "Consultations by age group", sub, 7)
    head = r
    headers = ["Age group", "Consultations", "Share", "Unique patients", *[g.title() for g in GENDERS]]
    total_n = c["total"]
    body = [[b["label"], b["consultations"], b["share"], b["unique_patients"], *[b[g] for g in GENDERS]] for b in c["breakdown"]]
    body.append(["Age unknown (no valid date of birth)", c["age_unknown"], _pct(c["age_unknown"], total_n), None, *[None] * len(GENDERS)])
    total = ["TOTAL", total_n, 1.0 if total_n else None, c["unique_patients"],
             *[sum(b[g] for b in c["breakdown"]) for g in GENDERS]]
    r = _table(ws, head, headers, body, pct_cols={2}, total_row=total)
    ws.cell(row=r, column=1, value="Age group = age in completed years on the visit date. "
            "Total unique patients counts each person once, so it can be lower than the sum of the rows.").font = Font(name=FONT, size=9, italic=True)
    if c["age_unknown"]:
        ws.cell(row=r + 1, column=1, value="Consultations with no valid date of birth are not split by gender, so gender columns "
                "can total less than the consultations column.").font = Font(name=FONT, size=9, italic=True)
    _widths(ws, [38, 16, 12, 16, 12, 12, 12, 12])
    ws.freeze_panes = ws.cell(row=head + 1, column=1)

    # ---- Diagnoses
    ws = wb.create_sheet("Top Diagnoses")
    r = _title(ws, f"Top {TOP_DIAGNOSES} diagnoses", sub, 7)
    body = [[d["rank"], d["diagnosis"], d["count"], d["share"], *[d[g] for g in AGE_GROUPS]] for d in report["diagnoses"]]
    if not body:
        body = [["", "No consultations recorded", 0, None, 0, 0, 0]]
    end = _table(ws, r, ["Rank", "Diagnosis", "Cases", "Share of consultations", *AGE_GROUPS], body, pct_cols={3})
    for n in range(r + 1, end - 1):
        ws.cell(row=n, column=1).alignment = Alignment(horizontal="center")
    _widths(ws, [8, 44, 12, 16, 12, 12, 12])
    ws.freeze_panes = ws.cell(row=r + 1, column=1)

    # ---- Vaccination
    ws = wb.create_sheet("Vaccination")
    r = _title(ws, "Vaccination compliance", sub, 6)
    head = r
    rate = lambda x: x if x is not None else "n/a"
    body = [[x["vaccine"], x["doses_given"], x["doses_due"], x["completed"], x["outstanding"], rate(x["compliance"])] for x in v["by_vaccine"]]
    total = ["OVERALL", v["doses_given"], v["doses_due"], v["completed"], v["outstanding"], rate(v["compliance"])]
    r = _table(ws, head, ["Vaccine", "Doses given this month", "Doses due this month", "Completed", "Outstanding", "Compliance rate"],
               body, pct_cols={5}, total_row=total)
    ws.cell(row=r, column=1, value="Doses due = doses whose next_due_date falls in this month. Completed = the next dose of the same "
            "vaccine was recorded on or before the last day of the month.").font = Font(name=FONT, size=9, italic=True)
    _widths(ws, [30, 18, 18, 14, 14, 16])
    ws.freeze_panes = ws.cell(row=head + 1, column=1)

    # ---- Medicine
    ws = wb.create_sheet("Medicine Consumption")
    r = _title(ws, "Medicine consumption", sub, 6)
    head = r
    na = lambda x: "n/a" if x is None else x
    body = [[i["medicine"], na(i["dispensed"]), na(i["restocked"]), i["current_stock"], i["reorder_threshold"], i["status"]] for i in m["items"]]
    first, last = head + 1, head + len(body)
    total = ["TOTAL DISPENSED", na(m["total_dispensed"]), na(sum(i["restocked"] for i in m["items"]) if m["tracked"] else None), None, None, None]
    r = _table(ws, head, ["Medicine", "Dispensed", "Restocked", "Current stock", "Reorder level", "Status"], body, total_row=total)
    _widths(ws, [34, 14, 14, 16, 16, 14])
    ws.freeze_panes = ws.cell(row=head + 1, column=1)
    for n in range(first, last + 1):
        if ws.cell(row=n, column=6).value == "Low stock":
            ws.cell(row=n, column=6).font = Font(name=FONT, bold=True, color="C00000")

    for sheet in wb.worksheets:
        sheet.sheet_view.showGridLines = False
        sheet.page_setup.orientation = "landscape"
        sheet.page_setup.fitToWidth = 1
        sheet.page_setup.fitToHeight = 0
        sheet.sheet_properties.pageSetUpPr.fitToPage = True

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
