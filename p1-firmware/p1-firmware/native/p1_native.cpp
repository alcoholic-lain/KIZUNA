// Smart Plug P1 - native build of the firmware logic (runs on the PC).
// "MCU" side of a UART link: talks to gateway.py over stdin/stdout, one line per message.
//   out (JSON lines): {"t":"oled","hex":..} 4 Hz, {"t":"telem",..} 1 Hz + on change,
//                     {"t":"log","msg":..}, {"t":"beep","p":"chirp|alarm"}, {"t":"gpio",..}
//   in  (text lines): CMD <ACTION> | BTN short|long | SLIDER <amps> | LOAD <w> <tempC> <name> | UNLOAD
// Build: g++ -std=c++17 -O2 -pthread -o p1_native p1_native.cpp
#include <atomic>
#include <cstdarg>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <deque>
#include <fstream>
#include <iostream>
#include <mutex>
#include <random>
#include <sstream>
#include <string>
#include <thread>
using namespace std;

static uint32_t millis() {
  static auto t0 = chrono::steady_clock::now();
  return (uint32_t)chrono::duration_cast<chrono::milliseconds>(chrono::steady_clock::now() - t0).count();
}

// ---------------- limits (same as the ESP32 firmware) ----------------
static const float TRIP_A = 16.0f, TRIP_W = 3680.0f, TRIP_TEMP = 75.0f, AMBIENT = 24.0f;
static const int TRIP_SAMPLES = 3;
static const uint32_t SAMPLE_MS = 20, OLED_MS = 250, TELEM_MS = 1000, NVS_DEBOUNCE_MS = 2000;

// ---------------- 128x64 SSD1306-style framebuffer ----------------
static uint8_t fb[128 * 64 / 8];  // page layout: byte = x + (y/8)*128, bit = y%8
static void px(int x, int y, bool on) {
  if (x < 0 || x > 127 || y < 0 || y > 63) return;
  if (on) fb[x + (y / 8) * 128] |= (1 << (y & 7)); else fb[x + (y / 8) * 128] &= ~(1 << (y & 7));
}
static const uint8_t FONT[59][5] = {  // 5x7, ASCII 32..90 (uppercase only)
 {0,0,0,0,0},{0,0,0x5F,0,0},{0,7,0,7,0},{0x14,0x7F,0x14,0x7F,0x14},{0x24,0x2A,0x7F,0x2A,0x12},
 {0x23,0x13,0x08,0x64,0x62},{0x36,0x49,0x56,0x20,0x50},{0,0x08,7,3,0},{0,0x1C,0x22,0x41,0},
 {0,0x41,0x22,0x1C,0},{0x2A,0x1C,0x7F,0x1C,0x2A},{8,8,0x3E,8,8},{0,0x80,0x70,0x30,0},
 {8,8,8,8,8},{0,0,0x60,0x60,0},{0x20,0x10,8,4,2},{0x3E,0x51,0x49,0x45,0x3E},{0,0x42,0x7F,0x40,0},
 {0x72,0x49,0x49,0x49,0x46},{0x21,0x41,0x49,0x4D,0x33},{0x18,0x14,0x12,0x7F,0x10},
 {0x27,0x45,0x45,0x45,0x39},{0x3C,0x4A,0x49,0x49,0x31},{0x41,0x21,0x11,9,7},{0x36,0x49,0x49,0x49,0x36},
 {0x46,0x49,0x49,0x29,0x1E},{0,0,0x14,0,0},{0,0x40,0x34,0,0},{0,8,0x14,0x22,0x41},{0x14,0x14,0x14,0x14,0x14},
 {0,0x41,0x22,0x14,8},{2,1,0x59,9,6},{0x3E,0x41,0x5D,0x59,0x4E},{0x7C,0x12,0x11,0x12,0x7C},
 {0x7F,0x49,0x49,0x49,0x36},{0x3E,0x41,0x41,0x41,0x22},{0x7F,0x41,0x41,0x41,0x3E},{0x7F,0x49,0x49,0x49,0x41},
 {0x7F,9,9,9,1},{0x3E,0x41,0x41,0x51,0x73},{0x7F,8,8,8,0x7F},{0,0x41,0x7F,0x41,0},{0x20,0x40,0x41,0x3F,1},
 {0x7F,8,0x14,0x22,0x41},{0x7F,0x40,0x40,0x40,0x40},{0x7F,2,0x1C,2,0x7F},{0x7F,4,8,0x10,0x7F},
 {0x3E,0x41,0x41,0x41,0x3E},{0x7F,9,9,9,6},{0x3E,0x41,0x51,0x21,0x5E},{0x7F,9,0x19,0x29,0x46},
 {0x26,0x49,0x49,0x49,0x32},{3,1,0x7F,1,3},{0x3F,0x40,0x40,0x40,0x3F},{0x1F,0x20,0x40,0x20,0x1F},
 {0x3F,0x40,0x38,0x40,0x3F},{0x63,0x14,8,0x14,0x63},{3,4,0x78,4,3},{0x61,0x59,0x49,0x4D,0x43}};
static void chr(int x, int y, char c, int s, bool on) {
  c = (char)toupper((unsigned char)c);
  const uint8_t* g = FONT[(c < 32 || c > 90) ? ('?' - 32) : (c - 32)];
  for (int cx = 0; cx < 5; cx++)
    for (int cy = 0; cy < 7; cy++)
      if (g[cx] & (1 << cy))
        for (int sx = 0; sx < s; sx++) for (int sy = 0; sy < s; sy++) px(x + cx * s + sx, y + cy * s + sy, on);
}
static int textW(const string& t, int s) { return (int)t.size() * 6 * s - s; }
static void text(int x, int y, const string& t, int s = 1, bool on = true) {
  for (char c : t) { chr(x, y, c, s, on); x += 6 * s; }
}
static void rect(int x, int y, int w, int h, bool on) { for (int j = 0; j < h; j++) for (int i = 0; i < w; i++) px(x + i, y + j, on); }

// ---------------- plug state ----------------
enum State { ST_OFF, ST_ON, ST_TRIP_OC, ST_TRIP_TH };
static const char* STATE_NAME[] = {"OFF", "ON", "TRIP_OVERCURRENT", "TRIP_THERMAL"};
static string dev = "kizuna-0042", nvsPath = "p1_native_nvs.txt";
static State st = ST_OFF;
static bool relay = false, dirty = true, nvsDirty = false;
static float volt = 230, amp = 0, watt = 0, wh = 0, tempC = AMBIENT, sliderA = 0, injW = 0, injTemp = 0, tripA = 0, tripW = 0;
static string injName = "Aucun";
static int overCount = 0;
static uint32_t nvsAt = 0;
static mt19937 rng(12345);
static float rnd(float a, float b) { return uniform_real_distribution<float>(a, b)(rng); }
static bool tripped() { return st == ST_TRIP_OC || st == ST_TRIP_TH; }

static string clean(string s) { string o; for (char c : s) if (isalnum((unsigned char)c) || c == ' ' || c == '-' || c == '.') o += c; return o; }
static string jesc(const string& s) { string o; for (char c : s) { if (c == '"' || c == '\\') o += '\\'; if ((unsigned char)c >= 32) o += c; } return o; }
static void out(const string& s) { fputs(s.c_str(), stdout); fputc('\n', stdout); fflush(stdout); }
static void logf(const char* fmt, ...) {
  char b[200]; va_list a; va_start(a, fmt); vsnprintf(b, sizeof b, fmt, a); va_end(a);
  out(string("{\"t\":\"log\",\"msg\":\"") + jesc(b) + "\"}");
}
static void beep(const char* p) { out(string("{\"t\":\"beep\",\"p\":\"") + p + "\"}"); }
static void gpio() { char b[96]; snprintf(b, sizeof b, "{\"t\":\"gpio\",\"pin26\":%d,\"state\":\"%s\"}", relay ? 1 : 0, STATE_NAME[st]); out(b); }

static void nvsMark() { nvsDirty = true; nvsAt = millis(); }
static void nvsFlush(bool force) {
  if (!nvsDirty) return;
  if (force || millis() - nvsAt > NVS_DEBOUNCE_MS) {
    ofstream f(nvsPath, ios::trunc); f << (relay ? 1 : 0) << ' ' << wh << '\n'; nvsDirty = false;
  }
}

static void setRelay(bool on, const char* why) {
  if (on && tripped()) { logf("ON refused (%s): clear trip first", why); return; }
  if (on == relay) return;
  relay = on; st = on ? ST_ON : ST_OFF;
  nvsMark(); nvsFlush(true); dirty = true; beep("chirp"); gpio();
  logf("relay %s (%s)", on ? "ON" : "OFF", why);
}
static void command(const string& a, const char* why) {
  if (a == "ON") setRelay(true, why);
  else if (a == "OFF") setRelay(false, why);
  else if (a == "TOGGLE") { if (tripped()) command("RESET_TRIP", why); else setRelay(!relay, why); }
  else if (a == "RESET_TRIP") { if (tripped()) { st = ST_OFF; overCount = 0; dirty = true; beep("chirp"); gpio(); logf("trip cleared (%s), relay stays OFF", why); } }
  else if (a == "RESET_ENERGY") { wh = 0; nvsMark(); dirty = true; logf("energy counter reset (%s)", why); }
  else logf("unknown action %s", a.c_str());
}
static void trip(State k) {
  relay = false;                                // GPIO 26 = LOW first, reporting after
  st = k; overCount = 0; tripA = amp; tripW = watt;
  gpio(); beep("alarm"); dirty = true;
  logf("TRIP %s %.1f A %.0f W %.0f C", STATE_NAME[k], amp, watt, tempC);
  amp = watt = 0; nvsMark(); nvsFlush(true);
}

// ---------------- UART input thread ----------------
static mutex qm; static deque<string> inq; static atomic<bool> eof{false};
static void reader() { string l; while (getline(cin, l)) { lock_guard<mutex> g(qm); inq.push_back(l); } eof = true; }
static void handle(const string& line) {
  istringstream is(line); string w; is >> w;
  if (w == "CMD") { string a; is >> a; command(a, "gateway"); }
  else if (w == "BTN") { string k; is >> k; command(k == "long" ? "RESET_ENERGY" : "TOGGLE", "button"); }
  else if (w == "SLIDER") { float a = 0; is >> a; sliderA = fmaxf(0, fminf(20, a)); injW = 0; injName = "Slider ADC"; dirty = true; }
  else if (w == "LOAD") {
    float p = 0, t = 0; is >> p >> t; string n; getline(is, n); if (!n.empty() && n[0] == ' ') n.erase(0, 1);
    injW = p; injTemp = t; injName = n.empty() ? "?" : clean(n).substr(0, 24); dirty = true;
    logf("load injected: %s %.0f W", injName.c_str(), p);
  } else if (w == "UNLOAD") { injW = 0; injName = "Aucun"; dirty = true; }
}

// ---------------- OLED + telemetry ----------------
static void render(uint32_t now) {
  memset(fb, 0, sizeof fb);
  char b[48]; bool trp = tripped();
  string head = "P1 " + dev; text(0, 0, head.substr(0, 14), 1); text(128 - textW("LIVE", 1), 0, "LIVE", 1);
  rect(0, 9, 128, 1, true);
  if (trp) {
    rect(0, 12, 128, 11, true);
    string m = st == ST_TRIP_OC ? "TRIP: >16A OVERLOAD" : "TRIP: OVERHEAT";
    text((128 - textW(m, 1)) / 2, 14, m, 1, false);
  } else text(2, 14, relay ? "OUTPUT ON" : "OUTPUT OFF", 1);
  snprintf(b, sizeof b, "%.0fW", trp ? tripW : watt);
  text(2, 25, b, 3);
  snprintf(b, sizeof b, "%.2fA %.1fV", trp ? tripA : amp, volt); text(2, 48, b, 1);
  snprintf(b, sizeof b, "%.4fKWH %.0fC", wh / 1000.0f, tempC); text(2, 57, b, 1);
  bool inv = trp && ((now / 500) % 2);
  static const char* H = "0123456789abcdef"; string hex; hex.reserve(2048);
  for (uint8_t v : fb) { v = inv ? ~v : v; hex += H[v >> 4]; hex += H[v & 15]; }
  out("{\"t\":\"oled\",\"hex\":\"" + hex + "\"}");
}
static void telem(uint32_t now) {
  char b[480];
  float loadW = injW > 0 ? injW : roundf(sliderA / 20 * 4095) * 20 / 4095 * 230;
  snprintf(b, sizeof b,
    "{\"t\":\"telem\",\"relay\":%s,\"state\":\"%s\",\"voltage_v\":%.1f,\"current_a\":%.2f,\"power_w\":%.1f,"
    "\"energy_wh\":%.2f,\"temp_c\":%.1f,\"uptime_s\":%u,\"appliance\":\"%s\",\"load_w\":%.1f,\"rssi_dbm\":%d}",
    relay ? "true" : "false", STATE_NAME[st], volt, amp, watt, wh, tempC, now / 1000,
    injW > 0 ? injName.c_str() : (sliderA > 0 ? "Slider ADC" : "Aucun"), loadW, -54 + (int)rnd(-3, 3));
  out(b);
}

// ---------------- main loop (non-blocking, same cadence as the ESP32) ----------------
int main(int argc, char** argv) {
  if (argc > 1) dev = argv[1];
  if (argc > 2) nvsPath = argv[2];
  ifstream f(nvsPath); int r = 0; float e = 0;
  if (f >> r >> e) { relay = r != 0; wh = e; st = relay ? ST_ON : ST_OFF; }
  logf("boot - NVS restored relay=%s energy=%.1f Wh", relay ? "ON" : "OFF", wh);
  gpio();
  thread(reader).detach();

  uint32_t tS = millis(), tO = 0, tT = 0;
  while (!eof) {
    uint32_t now = millis();
    { lock_guard<mutex> g(qm); while (!inq.empty()) { handle(inq.front()); inq.pop_front(); } }

    if (now - tS >= SAMPLE_MS) {
      float dt = (now - tS) / 1000.0f; tS = now;
      float adcA = roundf(sliderA / 20.0f * 4095.0f) * 20.0f / 4095.0f;    // 12-bit ADC quantisation
      volt = 230.0f + 1.6f * sinf(now / 7000.0f) + rnd(-0.4f, 0.4f);
      float loadW = injW > 0 ? injW : adcA * 230.0f;
      if (relay) { amp = loadW / volt * (loadW > 0 ? 1 + rnd(-0.006f, 0.006f) : 1); watt = volt * amp; } else amp = watt = 0;
      wh += watt * dt / 3600.0f;
      if (watt > 0 && !nvsDirty) nvsMark();
      float target = AMBIENT + 0.11f * amp * amp;
      if (injW > 0 && injTemp > 0 && relay) target = fmaxf(target, injTemp);
      tempC += (target - tempC) * fminf(1.0f, dt / 6.0f);
      if (!tripped()) {
        if (amp > TRIP_A || watt > TRIP_W) { if (++overCount >= TRIP_SAMPLES) trip(ST_TRIP_OC); }
        else overCount = 0;
        if (tempC > TRIP_TEMP && !tripped()) trip(ST_TRIP_TH);
      }
      nvsFlush(false);
    }
    if (now - tO >= OLED_MS) { tO = now; render(now); }
    if (dirty || now - tT >= TELEM_MS) { tT = now; dirty = false; telem(now); }
    this_thread::sleep_for(chrono::milliseconds(1));
  }
  nvsMark(); nvsFlush(true);
  return 0;
}
