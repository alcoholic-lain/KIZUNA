"""Learning activities: which ones exist, what they pay and the bill simulator.

The questions themselves live in the frontend. The server only knows the list
of activities, so that tokens can only be earned once per activity, only for
real activities, and only when the activity was actually passed.
"""
from m14.tariff import BANDS, SOURCE, SOURCE_URL, monthly_bill

# id -> title, tokens for the first pass, minimum score (0-100) to pass.
# "jeu-vampires" and "quiz-energie" keep their historical ids so earlier progress still counts.
ACTIVITIES = {
    "jeu-vampires": {"title": "Vampire hunt", "tokens": 15, "pass": 50},
    "quiz-energie": {"title": "Energy basics", "tokens": 15, "pass": 60},
    "quiz-facture": {"title": "Reading your STEG bill", "tokens": 15, "pass": 60},
    "quiz-habitudes": {"title": "Smart habits", "tokens": 15, "pass": 60},
    "quiz-maison": {"title": "Know your home", "tokens": 20, "pass": 60},
}


def bill_with_bands(kwh, kva):
    out = monthly_bill(kwh, kva)
    out["bands"] = [{"upto": None if limit == float("inf") else limit, "price": price} for limit, price in BANDS]
    out["source"], out["source_url"] = SOURCE, SOURCE_URL
    # Above 100 kWh every kWh is priced at the band reached, so crossing a limit has a visible cost.
    limits = [limit for limit, _ in BANDS]
    at = next((limit for limit in limits[:-1] if limit >= max(kwh, 100)), None)
    out["next"] = None
    if at is not None:
        out["next"] = {"at": at, "price": BANDS[limits.index(at) + 1][1],
                       "jump": round(monthly_bill(at + 1, kva)["total"] - monthly_bill(at, kva)["total"], 2)}
    return out
