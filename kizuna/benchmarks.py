"""Tunisia–Japan reference figures. Every value carries its source."""

SOURCES = {
    "steg2019": {
        "label": "STEG, enquête consommation d'énergie des ménages (2019)",
        "url": "https://www.leconomistemaghrebin.com/?p=485141",
    },
    "moe2023": {
        "label": "Ministère de l'Environnement du Japon, enquête CO₂ des ménages (exercice 2023)",
        "url": "https://www.env.go.jp/earth/ondanka/kateico2tokei/energy/detail/01/",
    },
    "steg_tarif": {
        "label": "STEG, tarifs basse tension résidentiels (depuis le 01/05/2022)",
        "url": "https://www.steg.com.tn/fr/page/les-tarifs-d%C3%A9lectricit%C3%A9",
    },
    "iea": {"label": "IEA, facteur d'émission moyen du réseau tunisien", "url": "https://www.iea.org/countries/tunisia/emissions"},
}

COUNTRIES = {
    "tunisie": {
        "name": "Tunisie",
        "household_kwh_year": 1635.9,
        "previous": {"year": 2014, "kwh": 1508.4},
        "year": 2019,
        "source": "steg2019",
        # Share of household electricity by end use (same survey).
        "uses": [["Cuisson", 28], ["Chauffage et eau chaude", 21], ["Réfrigération", 11], ["Télévision", 6],
                 ["Climatisation", 5], ["Éclairage", 4], ["Autres", 25]],
        "focus": ["Visibilité appareil par appareil", "Pointe estivale (climatisation)", "Foyers vulnérables et zones rurales"],
    },
    "japon": {
        "name": "Japon",
        "household_kwh_year": 3911,
        "range": {"min": ["Okinawa", 3578], "max": ["Hokuriku", 5300]},
        "year": 2023,
        "source": "moe2023",
        "focus": ["Bâtiments intelligents", "Gestion de la pointe", "Résilience après catastrophe"],
    },
}
