"""Tunisia–Japan reference figures. Every value carries its source."""

SOURCES = {
    "steg2019": {
        "label": "STEG, household energy consumption survey (2019)",
        "url": "https://www.leconomistemaghrebin.com/?p=485141",
    },
    "moe2023": {
        "label": "Japan Ministry of the Environment, household CO₂ survey (FY2023)",
        "url": "https://www.env.go.jp/earth/ondanka/kateico2tokei/energy/detail/01/",
    },
    "steg_tarif": {
        "label": "STEG, residential low-voltage tariffs (since 01/05/2022)",
        "url": "https://www.steg.com.tn/fr/page/les-tarifs-d%C3%A9lectricit%C3%A9",
    },
    "iea": {"label": "IEA, average emission factor of the Tunisian grid", "url": "https://www.iea.org/countries/tunisia/emissions"},
}

COUNTRIES = {
    "tunisie": {
        "name": "Tunisia",
        "household_kwh_year": 1635.9,
        "previous": {"year": 2014, "kwh": 1508.4},
        "year": 2019,
        "source": "steg2019",
        # Share of household electricity by end use (same survey).
        "uses": [["Cooking", 28], ["Heating and hot water", 21], ["Refrigeration", 11], ["Television", 6],
                 ["Air conditioning", 5], ["Lighting", 4], ["Other", 25]],
        "focus": ["Device-by-device visibility", "Summer peak (air conditioning)", "Vulnerable households and rural areas"],
    },
    "japon": {
        "name": "Japan",
        "household_kwh_year": 3911,
        "range": {"min": ["Okinawa", 3578], "max": ["Hokuriku", 5300]},
        "year": 2023,
        "source": "moe2023",
        "focus": ["Smart buildings", "Peak management", "Post-disaster resilience"],
    },
}
