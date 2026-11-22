Here is the engineering specification to set up your zero-hardware Smart Plug P1 Digital Twin dev environment and build the hackathon demo.

Project Specification: Smart Plug P1 — Hardware-in-the-Loop Digital Twin


1. System Architecture

The prototype eliminates physical 230V hardware by linking an instruction-level ESP32 simulator (Wokwi) to an interactive 3D product twin (Three.js Web App) via a real-time MQTT over WebSockets broker.
Show Code
Download diagram SVG

2. Development Environment Setup


A. Local Tooling

1. IDE: Visual Studio Code.
2. Extensions:
	• PlatformIO IDE (compiles C++/Arduino or ESP-IDF firmware with deterministic library versions).
	• Wokwi Simulator (runs the compiled .bin firmware directly inside VS Code, or use wokwi.com in-browser for zero local install).
	• Live Server (serves your Three.js HTML page locally without CORS issues).
3. Browser: Chrome or Edge (WebGL2 + WebAudio enabled).

B. Cloud / Network Dependencies (Zero-Config)

• MQTT Broker: broker.emqx.io (Free, no auth required for hackathon PoC; use a unique topic prefix like p1-plug-tn-<your_team_id>/... to avoid collisions).
	• ESP32 TCP Endpoint: mqtt://broker.emqx.io:1883
	• Web Twin WSS Endpoint: wss://broker.emqx.io:8084/mqtt
• Frontend CDN Libraries:
	• three.js (r128, already in your HTML)
	• mqtt.js (https://unpkg.com)

3. Component & Pin Mapping (Wokwi Virtual Hardware)


BOM Component	Wokwi Part ID	ESP32 GPIO	Behavior / Role
MCU	board-esp32-devkit-c-v4	—	Dual-core Wi-Fi controller
16A Relay (HF115F)	wokwi-relay-module	GPIO 26	Active HIGH; switches AC output
Output Load Indicator	wokwi-led (Green)	GPIO 26	Visualizes live 230V output state
Shunt Current Sensor	wokwi-slide-potentiometer	GPIO 34 (ADC1)	Maps 0–4095 ADC → 0.0A–20.0A (overridable via MQTT load injection)
Status Display	board-ssd1306 (128×64 I2C)	SDA: 21, SCL: 22	Renders V, A, W, Wi-Fi/MQTT status, and TRIP alerts
Piezo Buzzer	wokwi-buzzer	GPIO 25	PWM tone (2.4 kHz) on button press & overload trip
Physical Tactile Button	wokwi-pushbutton	GPIO 27 (INPUT_PULLUP)	Short press: toggle relay / clear trip; Long press (3s): reset energy counter


4. MQTT Communication Protocol

Use a unique namespace prefix: p1/<device_id>/... (e.g., p1/tn-01/).

1. Telemetry (p1/tn-01/telemetry) — ESP32 → Web Twin (Published every 1000 ms & on state change)

json
{
  "relay": true,
  "state": "ON",          // "ON" | "OFF" | "TRIP_OVERCURRENT" | "TRIP_THERMAL"
  "voltage_v": 230.4,
  "current_a": 7.82,
  "power_w": 1801.7,
  "energy_wh": 412.5,
  "temp_c": 38.2,
  "uptime_s": 145
}
Use code with caution.

2. Control Commands (p1/tn-01/cmd) — Web Twin / Mobile → ESP32

json
{ "action": "TOGGLE" }      // "ON" | "OFF" | "TOGGLE" | "RESET_TRIP" | "RESET_ENERGY"
Use code with caution.

3. Virtual Load Injection (p1/tn-01/sim/load) — Web Twin → ESP32 (Simulates plugging in appliances)

json
{
  "appliance": "Space Heater",
  "watts": 2200,
  "temp_c": 44.0
}
Use code with caution.
(Note: When watts > 0 is received via MQTT, firmware uses the injected load; moving the Wokwi slider returns control to the ADC pin.)

5. Production-Grade Firmware Requirements (ESP32)

To demonstrate manufacturing readiness to judges, implement these 5 behaviors in firmware:
1. Hardware Protection Cutoff (< 50 ms loop):
	• If current_a > 16.0A (or power_w > 3680W) for 3 consecutive samples, immediately set GPIO 26 = LOW, set state to TRIP_OVERCURRENT, trigger buzzer alarm pattern, and publish an immediate alert packet.
2. Power-Loss State Recovery (NVS Preferences.h):
	• Persist relay_state and energy_wh to flash on change (debounced) so rebooting the Wokwi simulation restores the last state—just like a commercial smart plug.
3. Non-Blocking Architecture:
	• Avoid delay() in the main loop; use millis() timers for ADC sampling (20 ms), OLED refresh (250 ms), and MQTT telemetry (1000 ms).
4. Auto-Reconnect Watchdog:
	• Automatically recover Wi-Fi and MQTT connections without freezing button or overcurrent protection tasks.
5. Buzzer Acoustic Feedback:
	• Single short chirp on relay toggle; 3 rapid high-pitched beeps on overcurrent trip.

6. 3D Digital Twin Web UI Upgrades (Three.js HTML)

Extend your existing exploded-view HTML with a Live Twin Mode panel:
1. Dynamic 3D OLED Texture: Render a live HTML5 <canvas> onto the 3D plug's OLED screen mesh so wattage, current, and OVERLOAD TRIP warnings update directly on the 3D model.
2. Interactive 3D Button & Status LED: Raycast clicks on the 3D power button to publish {"action": "TOGGLE"} and animate the 3D status LED (Green = ON, Off = OFF, Flashing Red = TRIP).
3. Appliance Preset Selector: Buttons to simulate realistic loads:
	• Standby / Phone Charger (15 W / 0.07 A)
	• Gaming PC + Monitor (450 W / 1.96 A)
	• 2000W Heater (2100 W / 9.13 A)
	• Fault / Overload Test (4100 W / 17.8 A → triggers 16A trip)
4. WebAudio Buzzer: Play a short 2400 Hz WebAudio oscillator beep in the browser synchronized with telemetry trip events.

7. Build & Verification Checklist

• Step 1 (Env): Create a Wokwi project (web or VS Code) with PubSubClient + ArduinoJson + Adafruit_SSD1306.
• Step 2 (Firmware): Flash virtual ESP32, verify MQTT connection to broker.emqx.io, and confirm 16A trip logic via the slide potentiometer.
• Step 3 (3D Twin): Add mqtt.js to your Three.js HTML file and bind incoming JSON telemetry to the 3D OLED canvas and status LED.
• Step 4 (End-to-End Test): Click "Fault / Overload Test" in the 3D web UI → verify ESP32 trips relay in Wokwi → verify 3D OLED displays TRIP: >16A and plays alarm.
Which piece would you like me to generate first so you can start coding immediately:
• The Wokwi diagram.json + platformio.ini configuration files
• The complete ESP32 C++ firmware (main.cpp)
• The MQTT + live 3D OLED + appliance simulator patch for your Three.js HTML file
