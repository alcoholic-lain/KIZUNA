// Smart Plug P1 - ESP32 firmware (Wokwi + PlatformIO)
// Protection loop runs on core 1 (20 ms). Network runs in its own task on core 0,
// so a slow or dead server can never delay the overcurrent cutoff.
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ---------- config ----------
#define DEV_ID      "kizuna-0042"
#define SERVER_URL  "https://CHANGE-ME.trycloudflare.com/api/telemetry"  // <- your tunnel URL
#define WIFI_SSID   "Wokwi-GUEST"
#define WIFI_PASS   ""
#define WIFI_CH     6

#define PIN_RELAY 26
#define PIN_ADC   34
#define PIN_BTN   27

const float TRIP_A = 16.0f, TRIP_W = 3680.0f, TRIP_TEMP = 75.0f, AMBIENT = 24.0f;
const int   TRIP_SAMPLES = 3;
const uint32_t SAMPLE_MS = 20, NET_MS = 1000, NVS_DEBOUNCE_MS = 2000, LONG_PRESS_MS = 3000;

// ---------- shared state (guarded by mtx) ----------
enum State { ST_OFF, ST_ON, ST_TRIP_OC, ST_TRIP_TH };
const char* STATE_NAME[] = { "OFF", "ON", "TRIP_OVERCURRENT", "TRIP_THERMAL" };

SemaphoreHandle_t mtx;
State  state = ST_OFF;
bool   relay = false;
float  volt = 230, amp = 0, watt = 0, wh = 0, tempC = AMBIENT;
float  injW = 0, injTemp = 0;          // injected appliance (0 = use ADC slider)
char   injName[24] = "Aucun";
int    overCount = 0;
uint32_t nvsDirtyAt = 0;
bool   nvsDirty = false;
Preferences prefs;

inline bool tripped() { return state == ST_TRIP_OC || state == ST_TRIP_TH; }
inline void lock()   { xSemaphoreTake(mtx, portMAX_DELAY); }
inline void unlock() { xSemaphoreGive(mtx); }

void markNvs() { nvsDirty = true; nvsDirtyAt = millis(); }

void flushNvs(bool force) {
  if (!nvsDirty) return;
  if (force || millis() - nvsDirtyAt > NVS_DEBOUNCE_MS) {
    prefs.putBool("relay", relay);
    prefs.putFloat("wh", wh);
    nvsDirty = false;
  }
}

// call with mutex held
void applyRelay(bool on, const char* why) {
  if (on && tripped()) { Serial.printf("ON refused (%s): clear trip first\n", why); return; }
  if (on == relay) return;
  relay = on;
  state = on ? ST_ON : ST_OFF;
  digitalWrite(PIN_RELAY, on ? HIGH : LOW);
  markNvs(); flushNvs(true);
  Serial.printf("relay %s (%s)  [BEEP]\n", on ? "ON" : "OFF", why);
}

// call with mutex held
void command(const String& a, const char* why) {
  if (a == "ON") applyRelay(true, why);
  else if (a == "OFF") applyRelay(false, why);
  else if (a == "TOGGLE") { if (tripped()) command("RESET_TRIP", why); else applyRelay(!relay, why); }
  else if (a == "RESET_TRIP") { if (tripped()) { state = ST_OFF; overCount = 0; Serial.println("trip cleared"); } }
  else if (a == "RESET_ENERGY") { wh = 0; markNvs(); Serial.println("energy reset"); }
  else Serial.printf("unknown action %s\n", a.c_str());
}

// call with mutex held
void trip(State kind) {
  relay = false;
  digitalWrite(PIN_RELAY, LOW);               // hardware cutoff first, everything else after
  state = kind; overCount = 0;
  Serial.printf("!!! %s  %.1f A / %.0f W / %.0f C  [BEEP BEEP BEEP]\n", STATE_NAME[kind], amp, watt, tempC);
  amp = watt = 0;
  markNvs(); flushNvs(true);
}

// ---------- network task (core 0) ----------
void wifiEnsure() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASS, WIFI_CH);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 8000) { vTaskDelay(200 / portTICK_PERIOD_MS); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " failed, will retry");
}

void postTelemetry() {
  JsonDocument doc;
  lock();
  doc["relay"] = relay;
  doc["state"] = STATE_NAME[state];
  doc["voltage_v"] = roundf(volt * 10) / 10;
  doc["current_a"] = roundf(amp * 100) / 100;
  doc["power_w"] = roundf(watt * 10) / 10;
  doc["energy_wh"] = roundf(wh * 100) / 100;
  doc["temp_c"] = roundf(tempC * 10) / 10;
  doc["uptime_s"] = millis() / 1000;
  doc["appliance"] = injW > 0 ? injName : "Slider ADC";
  doc["load_w"] = injW > 0 ? injW : analogRead(PIN_ADC) * 20.0f / 4095.0f * 230.0f;
  doc["rssi_dbm"] = WiFi.RSSI();
  doc["device"] = DEV_ID;
  unlock();
  String body; serializeJson(doc, body);

  WiFiClientSecure sec; sec.setInsecure();   // demo only: no certificate pinning
  WiFiClient plain;
  HTTPClient http;
  bool https = String(SERVER_URL).startsWith("https");
  if (!(https ? http.begin(sec, SERVER_URL) : http.begin(plain, SERVER_URL))) { Serial.println("http.begin failed"); return; }
  http.setTimeout(4000);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  if (code == 200) {
    JsonDocument resp;
    if (!deserializeJson(resp, http.getString())) {
      lock();
      for (JsonVariant a : resp["actions"].as<JsonArray>()) command(String(a.as<const char*>()), "server");
      if (resp["load"].is<JsonObject>()) {
        injW = resp["load"]["watts"] | 0.0f;
        injTemp = resp["load"]["temp_c"] | 0.0f;
        strlcpy(injName, resp["load"]["appliance"] | "?", sizeof(injName));
        Serial.printf("load injected: %s %.0f W\n", injName, injW);
      }
      unlock();
    }
  } else {
    Serial.printf("POST failed: %d %s\n", code, HTTPClient::errorToString(code).c_str());
  }
  http.end();
}

void netTask(void*) {
  for (;;) {
    wifiEnsure();
    if (WiFi.status() == WL_CONNECTED) postTelemetry();
    vTaskDelay(NET_MS / portTICK_PERIOD_MS);
  }
}

// ---------- setup / loop (core 1) ----------
void setup() {
  Serial.begin(115200);
  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_BTN, INPUT_PULLUP);
  analogReadResolution(12);
  mtx = xSemaphoreCreateMutex();

  prefs.begin("p1", false);
  relay = prefs.getBool("relay", false);
  wh = prefs.getFloat("wh", 0);
  state = relay ? ST_ON : ST_OFF;
  digitalWrite(PIN_RELAY, relay ? HIGH : LOW);
  Serial.printf("boot - NVS restored relay=%s energy=%.1f Wh\n", relay ? "ON" : "OFF", wh);

  xTaskCreatePinnedToCore(netTask, "net", 12288, nullptr, 1, nullptr, 0);
}

void loop() {
  static uint32_t tSample = 0, btnDownAt = 0;
  static bool btnWas = false;
  uint32_t now = millis();

  // button: short press toggles / clears trip, long press resets energy
  bool down = digitalRead(PIN_BTN) == LOW;
  if (down && !btnWas) btnDownAt = now;
  if (!down && btnWas && now - btnDownAt > 30) {
    lock();
    command(now - btnDownAt >= LONG_PRESS_MS ? "RESET_ENERGY" : "TOGGLE", "button");
    unlock();
  }
  btnWas = down;

  if (now - tSample >= SAMPLE_MS) {
    float dt = (now - tSample) / 1000.0f;
    tSample = now;
    float sliderLoadW = analogRead(PIN_ADC) * 20.0f / 4095.0f * 230.0f;

    lock();
    volt = 230.0f + 1.6f * sinf(now / 7000.0f) + (random(-40, 40) / 100.0f);
    float loadW = injW > 0 ? injW : sliderLoadW;
    if (relay) { amp = loadW / volt; watt = volt * amp; } else { amp = watt = 0; }
    wh += watt * dt / 3600.0f;
    if (watt > 0 && !nvsDirty) markNvs();

    float target = AMBIENT + 0.11f * amp * amp;
    if (injW > 0 && injTemp > 0 && relay) target = max(target, injTemp);
    tempC += (target - tempC) * min(1.0f, dt / 6.0f);

    if (!tripped()) {
      if (amp > TRIP_A || watt > TRIP_W) { if (++overCount >= TRIP_SAMPLES) trip(ST_TRIP_OC); }
      else overCount = 0;
      if (tempC > TRIP_TEMP && !tripped()) trip(ST_TRIP_TH);
    }
    flushNvs(false);
    unlock();
  }
}
