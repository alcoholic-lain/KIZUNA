"""Terms and conditions of the Mieruka service.

Bump VERSION when the text changes in a way users should re-accept: everyone
whose stored version differs is asked again on their profile page.

This text describes what the app actually does today. It is a working draft
for the pilot, not reviewed legal advice.
"""

VERSION = "2026-11"
UPDATED = "2026-11-22"

SECTIONS = [
    {
        "title": "1. The service",
        "body": [
            "Mieruka shows how much electricity your appliances use, explains it, and suggests ways to use less. "
            "It reads measurements from adapters plugged on your appliances and turns them into charts, alerts, forecasts and tips.",
            "This is a pilot. Some data in the app is simulated, and it is always labelled as simulated. "
            "Do not rely on Mieruka as a metering or billing instrument.",
        ],
    },
    {
        "title": "2. Your data",
        "body": [
            "We keep the details you give us (name, email, city), your household settings (monthly goal, subscribed power, number of occupants) "
            "and the measurements from your adapters.",
            "STEG operators see your household under a pseudonym code, never your name or email.",
            "We do not sell your data and we do not use it for advertising.",
        ],
    },
    {
        "title": "3. Your energy contract settings",
        "body": [
            "The monthly goal and the subscribed power (kVA) you enter in your profile are declarations used for estimates, forecasts and alerts. "
            "They do not change your contract with STEG.",
            "Bill amounts shown in Mieruka are estimates calculated from the published STEG residential tariff. "
            "Your real STEG invoice is the only binding amount.",
            "Please keep these settings truthful. Estimates, comparisons and alerts are only as good as the numbers you enter.",
        ],
    },
    {
        "title": "4. Tokens and rewards",
        "body": [
            "Tokens are a reward for saving energy, finishing challenges and learning activities. They have no cash value and cannot be exchanged for money.",
            "Tokens can be earned up to a daily limit, and some rewards can be redeemed from the catalogue.",
            "A zero token balance never limits your electricity. Mieruka tokens do not control your power supply.",
        ],
    },
    {
        "title": "5. Fair use",
        "body": [
            "Use Mieruka only for your own household or business. Do not try to read other people's data, tamper with measurements, "
            "or collect tokens by automated means.",
            "We may correct or remove tokens that were earned in a way the service did not intend.",
        ],
    },
    {
        "title": "6. Changes and leaving",
        "body": [
            "When these terms change in a way that matters, we update the version and ask you to accept again.",
            "You can stop using Mieruka at any time. To have your account and measurements deleted, ask the Mieruka team.",
        ],
    },
    {
        "title": "7. Limits of responsibility",
        "body": [
            "Mieruka is provided as is during the pilot. Savings suggestions are estimates, not guarantees, "
            "and we are not responsible for decisions taken only on the basis of the figures shown.",
            "Never ignore a safety problem with an appliance or an electrical installation because of what the app shows or does not show.",
        ],
    },
]
