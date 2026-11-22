"""Small cached client for the Open-Meteo forecast API."""
import json
import logging
import threading
import time
from http.client import HTTPException
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

LOGGER = logging.getLogger("mieruka")
CACHE_SECONDS = 30 * 60
REQUEST_TIMEOUT = 4
_CACHE = {}
_CACHE_LOCK = threading.Lock()


def _condition(code):
    if code == 0:
        return "Ciel dégagé"
    if code in (1, 2):
        return "Partiellement nuageux"
    if code == 3:
        return "Couvert"
    if code in (45, 48):
        return "Brouillard"
    if code in (51, 53, 55, 56, 57):
        return "Bruine"
    if code in (61, 63, 65, 66, 67, 80, 81, 82):
        return "Pluie"
    if code in (71, 73, 75, 77, 85, 86):
        return "Neige"
    if code in (95, 96, 99):
        return "Orage"
    return "Conditions variables"


def _unavailable(detail):
    return {
        "available": False,
        "label": "Prévisions météo indisponibles",
        "detail": detail,
        "source": "Open-Meteo",
    }


def forecast(latitude, longitude):
    """Return a short forecast for a broad regional coordinate, or an explicit unavailable state."""
    key = (round(float(latitude), 2), round(float(longitude), 2))
    now = time.monotonic()
    with _CACHE_LOCK:
        cached = _CACHE.get(key)
        if cached and cached[0] > now:
            return dict(cached[1])

    params = urlencode({
        "latitude": key[0],
        "longitude": key[1],
        "timezone": "auto",
        "forecast_days": 3,
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        "hourly": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code",
    })
    url = f"https://api.open-meteo.com/v1/forecast?{params}"
    try:
        with urlopen(url, timeout=REQUEST_TIMEOUT) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (HTTPException, OSError, URLError, TimeoutError, ValueError, UnicodeDecodeError) as exc:
        LOGGER.warning("Open-Meteo forecast unavailable: %s", exc)
        result = _unavailable("Impossible de récupérer les prévisions pour le moment.")
        with _CACHE_LOCK:
            _CACHE[key] = (time.monotonic() + 5 * 60, result)
        return result

    try:
        daily = data["daily"]
        dates = daily["time"]
        max_temps = daily["temperature_2m_max"]
        min_temps = daily["temperature_2m_min"]
        codes = daily["weather_code"]
        rain = daily["precipitation_probability_max"]
        if not dates or not all(len(values) == len(dates) for values in (max_temps, min_temps, codes, rain)):
            raise ValueError("Incomplete daily forecast")
        hourly = data["hourly"]
        hours = hourly["time"]
        temps = hourly["temperature_2m"]
        apparent = hourly["apparent_temperature"]
        humidity = hourly["relative_humidity_2m"]
        if not all(len(values) == len(hours) for values in (temps, apparent, humidity)):
            raise ValueError("Incomplete hourly forecast")
        days = []
        for index, date in enumerate(dates):
            daily_temps = [float(t) for stamp, t in zip(hours, temps) if stamp.startswith(date) and t is not None]
            feels = [float(t) for stamp, t in zip(hours, apparent) if stamp.startswith(date) and t is not None]
            humidities = [int(h) for stamp, h in zip(hours, humidity) if stamp.startswith(date) and h is not None]
            hottest_hour = None
            if daily_temps:
                hottest_index = max(
                    (i for i, stamp in enumerate(hours) if stamp.startswith(date) and temps[i] is not None),
                    key=lambda i: float(temps[i]),
                )
                hottest_hour = int(hours[hottest_index][11:13])
            days.append({
                "date": date,
                "max_c": float(max_temps[index]),
                "min_c": float(min_temps[index]),
                "apparent_max_c": round(max(feels), 1) if feels else None,
                "humidity_max": max(humidities) if humidities else None,
                "precipitation_probability": int(rain[index]) if rain[index] is not None else None,
                "weather_code": int(codes[index]) if codes[index] is not None else None,
                "condition": _condition(int(codes[index])) if codes[index] is not None else "Conditions variables",
                "hottest_hour": hottest_hour,
            })
    except (KeyError, TypeError, ValueError, IndexError) as exc:
        LOGGER.warning("Invalid Open-Meteo forecast response: %s", exc)
        result = _unavailable("La réponse météo reçue est incomplète.")
        with _CACHE_LOCK:
            _CACHE[key] = (time.monotonic() + 5 * 60, result)
        return result

    result = {"available": True, "label": days[0]["condition"], "source": "Open-Meteo", "days": days}
    with _CACHE_LOCK:
        _CACHE[key] = (time.monotonic() + CACHE_SECONDS, result)
    return result
