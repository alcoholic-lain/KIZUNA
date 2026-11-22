"""Private, rule-based energy chat using only the signed-in household's data."""
import re


def _intent(message):
    text = message.lower()
    if re.fullmatch(r"\s*(hello|hi|hey|good morning|good afternoon)[!. ]*", text):
        return "greeting"
    if re.search(r"\b(why|reason|cause|contributing factor)\b", text):
        return "why"
    if re.search(r"\b(weather|temperature|hot|heatwave|rain|humidity|sunny|cloudy)\b", text):
        return "weather"
    if re.search(r"\b(token|budget|goal|target|exceed|over budget|monthly limit)\b", text):
        return "budget"
    if re.search(r"\b(peak|highest|busy period|high consumption|spike)\b", text):
        return "peak"
    if re.search(r"\b(consume|consumption|used|usage|kwh|electricity|energy today)\b", text):
        return "consumption"
    if re.search(r"\b(should|recommend|advice|mission|prepare|save energy|reduce|action|help me)\b", text):
        return "actions"
    if re.search(r"\b(help|what can you do|capabilities)\b", text):
        return "help"
    return "unknown"


def _previous_intent(messages):
    for message in reversed(messages[:-1]):
        if message["role"] == "user":
            intent = _intent(message["content"])
            if intent != "unknown":
                return intent
    return "unknown"


def reply(messages, facts):
    """Answer an English energy question without sending conversation data elsewhere."""
    latest = next((message["content"] for message in reversed(messages) if message["role"] == "user"), "")
    intent = _intent(latest)
    if intent == "unknown" and re.fullmatch(r"\s*(why|how|what should i do|tell me more)\??\s*", latest, re.I):
        intent = _previous_intent(messages)

    mission = facts["mission"]
    forecast = facts["forecast"]
    if intent == "greeting":
        return "Hi! I can help you understand your energy use, upcoming peak, weather-related risk, and practical ways to prepare. What would you like to know?"
    if intent == "help":
        return "I can explain your predicted peak, energy forecast, token budget, available weather forecast, and the mission actions. Ask me about any of those."
    if intent == "peak":
        return (
            f"Your estimated high-use window is {mission['peak_start']}:00–{mission['peak_end']}:00 "
            f"on {mission['date']}. The estimate is based mainly on your household's historical usage pattern; "
            f"it is not certain."
        )
    if intent == "weather":
        weather = mission["weather"]
        if not weather["available"]:
            return f"I can't retrieve a weather forecast right now. {weather['detail']} Your energy estimate still uses your usage history."
        details = (
            f"For {weather.get('date', mission['date'])}, the forecast is {weather['condition']}, "
            f"with a high of {weather['max_c']:.0f} °C and a low of {weather['min_c']:.0f} °C"
        )
        if weather.get("apparent_max_c") is not None:
            details += f", and a feels-like high of {weather['apparent_max_c']:.0f} °C"
        if weather.get("humidity_max") is not None:
            details += f". Maximum humidity is {weather['humidity_max']}%"
        if weather.get("precipitation_probability") is not None:
            details += f"; precipitation probability is {weather['precipitation_probability']}%"
        return f"{details}. This is a forecast, not a measurement. Source: Open-Meteo."
    if intent == "budget":
        comparison = "above" if forecast["ratio"] > 1 else "within"
        return (
            f"Your estimated monthly use is {forecast['month_kwh']:.1f} kWh against a "
            f"{forecast['goal_kwh']:.0f} kWh goal, so the estimate is {comparison} your goal. "
            f"That is a forecast, not a certainty. This app does not currently forecast a separate daily Energy Token "
            f"budget. Tokens are virtual rewards, not electricity credits, and they do not control your power supply."
        )
    if intent == "consumption":
        source = "measured" if facts["source"] == "real" else "simulated"
        return (
            f"Today's recorded consumption is {forecast['today_kwh']:.2f} kWh ({source} data). "
            f"The current estimate for today is {forecast['today_expected']:.2f} kWh. "
            "The estimate may change as more readings arrive."
        )
    if intent == "why":
        reasons = ", ".join(mission["factors"])
        return f"The current assessment is based on {reasons}. The peak time is estimated from your usage history; it is not guaranteed."
    if intent == "actions":
        actions = mission["actions"][:3]
        if not actions:
            return "I don't have a personalized action to recommend right now. Keep monitoring your usage and preserve essential devices."
        steps = " ".join(f"{index + 1}. {action['title']}." for index, action in enumerate(actions))
        return f"For your estimated {mission['peak_start']}:00–{mission['peak_end']}:00 high-use window: {steps} Keep essential devices on and stay comfortable, especially in hot weather."
    return (
        "I can help with household energy use, your predicted peak, weather, your monthly goal, and practical actions. "
        "I don't have general-purpose knowledge or device-control access. What would you like to check?"
    )
