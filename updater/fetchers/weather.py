"""LA weather + AQI via Open-Meteo (free, no key)."""
from __future__ import annotations

import logging

import requests

from lib.io import write_json

log = logging.getLogger("weather")

LAT, LON = 34.0522, -118.2437  # Los Angeles
HEADERS = {"User-Agent": "FrankDashboard/1.0"}

# WMO weather code → 中文（按码段归并）
WMO_CN = [
    ((0,), "晴"),
    ((1, 2), "多云"),
    ((3,), "阴"),
    ((45, 48), "雾"),
    ((51, 53, 55, 56, 57), "毛毛雨"),
    ((61, 63, 65, 66, 67, 80, 81, 82), "雨"),
    ((71, 73, 75, 77, 85, 86), "雪"),
    ((95, 96, 99), "雷雨"),
]


def code_to_cn(code: int) -> str:
    for codes, name in WMO_CN:
        if code in codes:
            return name
    return "—"


def main():
    fc = requests.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": LAT,
            "longitude": LON,
            "current": "temperature_2m,weather_code",
            "daily": "temperature_2m_max,temperature_2m_min",
            "temperature_unit": "fahrenheit",
            "timezone": "America/Los_Angeles",
            "forecast_days": 1,
        },
        headers=HEADERS,
        timeout=15,
    )
    fc.raise_for_status()
    j = fc.json()
    cur = j["current"]
    daily = j["daily"]

    aqi = None
    try:
        aq = requests.get(
            "https://air-quality-api.open-meteo.com/v1/air-quality",
            params={"latitude": LAT, "longitude": LON, "current": "us_aqi"},
            headers=HEADERS,
            timeout=15,
        )
        aq.raise_for_status()
        aqi = round(aq.json()["current"]["us_aqi"])
    except Exception as e:
        log.warning("aqi failed: %s", e)

    payload = {
        "city": "LA",
        "temp": round(cur["temperature_2m"]),
        "desc": code_to_cn(int(cur["weather_code"])),
        "high": round(daily["temperature_2m_max"][0]),
        "low": round(daily["temperature_2m_min"][0]),
        "aqi": aqi,
        "unit": "F",
    }
    write_json("weather", payload)
    log.info("weather: %s %s°F H%s L%s AQI %s", payload["desc"], payload["temp"], payload["high"], payload["low"], aqi)


if __name__ == "__main__":
    main()
