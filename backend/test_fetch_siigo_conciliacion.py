from app.services.conciliacion import get_conciliacion_data
import json

res = get_conciliacion_data("https://docs.google.com/spreadsheets/d/1X_6_A2RzCnhbI9_D9u3T2b9v5z_QeH_wS1tG_Wc9B9s/edit#gid=0", "2026-03-01", "2026-03-09")

print("Matched:", len(res.get("matched", [])))
print("Solo Siigo:", len(res.get("solo_siigo", [])))
print("Solo Sheets:", len(res.get("solo_sheets", [])))
print("Diferencias:", len(res.get("diferencias", [])))

with open("test_out.json", "w") as f:
    json.dump(res, f, indent=2)
