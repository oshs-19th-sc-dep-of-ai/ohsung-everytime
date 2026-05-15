import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))
from utils.config_util import ConfigManager as Config
import requests
from datetime import datetime, timedelta

Config().read_file("config.json")
cfg = Config().get()["NICEAPI"]

today = datetime.now()
monday = today - timedelta(days=today.weekday())
friday = monday + timedelta(days=4)

params = {
    "KEY": cfg["KEY"],
    "Type": "json",
    "pIndex": 1,
    "pSize": 1000,
    "ATPT_OFCDC_SC_CODE": cfg["SCHULSC"],
    "SD_SCHUL_CODE": cfg["SCHULC"],
    "AY": monday.strftime("%Y"),
    "SEM": "1",
    "TI_FROM_YMD": monday.strftime("%Y%m%d"),
    "TI_TO_YMD": friday.strftime("%Y%m%d"),
    "GRADE": "1",
    "CLASS_NM": "1"
}

resp = requests.get(cfg["TIMETABLE"], params=params)
if resp.status_code == 200:
    data = resp.json()
    if "hisTimetable" in data:
        rows = data["hisTimetable"][1]["row"]
        print(f"Found {len(rows)} rows for grade 1 class 1")
        for r in rows[:5]:
            print(r["ALL_TI_YMD"], r["PERIO"], r["ITRT_CNTNT"])
    else:
        print("No hisTimetable in response", data)
else:
    print("Failed", resp.status_code)
