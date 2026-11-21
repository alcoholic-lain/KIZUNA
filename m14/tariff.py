"""STEG residential low-voltage tariff (barème en vigueur depuis le 01/05/2022).

Source: https://www.steg.com.tn/fr/page/les-tarifs-d%C3%A9lectricit%C3%A9
Prices in TND/kWh, excluding taxes:
* consumption ≤ 100 kWh/month: 0.062 (1–50) then 0.096 (51–100);
* consumption > 100 kWh/month: the price of the band reached applies:
  0.176 (≤ 200), 0.218 (≤ 300), 0.341 (≤ 500), 0.414 (> 500).
Plus a power charge of 0.700 TND/kVA/month, a municipal surtax of 0.005 TND/kWh,
the FTE contribution of 0.005 TND/kWh (not for consumption ≤ 100 kWh), and VAT
(7 % up to 300 kWh/month, 13 % above).

STEG publishes the band prices; how bands combine on a bill is our reading of
the schedule, so the result is labelled as an estimate.
"""

SOURCE = "Barème STEG basse tension résidentiel, en vigueur depuis le 01/05/2022"
SOURCE_URL = "https://www.steg.com.tn/fr/page/les-tarifs-d%C3%A9lectricit%C3%A9"
BANDS = [(50, 0.062), (100, 0.096), (200, 0.176), (300, 0.218), (500, 0.341), (float("inf"), 0.414)]


def band_price(kwh_month):
    for limit, price in BANDS:
        if kwh_month <= limit:
            return price
    return BANDS[-1][1]


def monthly_bill(kwh_month, kva=4):
    kwh = max(0.0, kwh_month)
    if kwh <= 100:
        energy = min(kwh, 50) * 0.062 + max(0.0, kwh - 50) * 0.096
        fte = 0.0
    else:
        energy = kwh * band_price(kwh)
        fte = kwh * 0.005
    power_charge = 0.700 * kva
    surtax = kwh * 0.005
    vat_rate = 0.07 if kwh <= 300 else 0.13
    vat = (energy + power_charge) * vat_rate
    total = energy + power_charge + surtax + fte + vat
    return {
        "kwh": round(kwh, 1), "band_price": band_price(kwh), "energy": round(energy, 3), "power_charge": round(power_charge, 3),
        "taxes": round(surtax + fte + vat, 3), "vat_rate": vat_rate, "total": round(total, 2),
        "avg_price": round(total / kwh, 3) if kwh else band_price(0),
        "source": SOURCE, "source_url": SOURCE_URL,
    }
