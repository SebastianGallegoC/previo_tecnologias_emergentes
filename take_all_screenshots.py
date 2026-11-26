import os
import sys
import time
import threading
import http.server
import socketserver
from playwright.sync_api import sync_playwright

PORT = 5197
DIRECTORY = os.path.abspath("dist")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    def log_message(self, format, *args):
        pass

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        httpd.serve_forever()

server_thread = threading.Thread(target=run_server, daemon=True)
server_thread.start()
time.sleep(1)

os.makedirs("capturas", exist_ok=True)
print(f"Server started on port {PORT}. Taking precision screenshots...")

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
    )
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    
    # 1. Mapa General
    print("1. Capturing Mapa General...")
    page.goto(f"http://127.0.0.1:{PORT}")
    page.wait_for_timeout(2000)
    page.locator("header nav button", has_text="Mapa").click()
    page.wait_for_timeout(2500)
    page.screenshot(path="capturas/captura_01_mapa_general.png")
    
    # 2. Popup Telemetria Bus
    print("2. Capturing Popup Telemetria...")
    markers = page.locator(".leaflet-marker-icon")
    if markers.count() > 0:
        markers.nth(1).click()
        page.wait_for_timeout(1000)
    page.screenshot(path="capturas/captura_02_bus_popup_telemetria.png")
    
    # 3. Planificador Rutas
    print("3. Capturing Planificador Rutas...")
    page.locator("header nav button", has_text="Viajar").click()
    page.wait_for_timeout(2000)
    page.screenshot(path="capturas/captura_03_planificador_rutas.png")
    
    # 4. Pago NFC
    print("4. Capturing Pago NFC Modal...")
    # Click on 'Pagar' button on map or planner
    page.locator("header nav button", has_text="Mapa").click()
    page.wait_for_timeout(1000)
    page.locator(".leaflet-marker-icon").nth(0).click()
    page.wait_for_timeout(800)
    page.locator("button:has-text('Pagar pasaje')").first.click()
    page.wait_for_timeout(1000)
    # Enable simulation mode if restricted
    sim_link = page.locator("button:has-text('Simular NFC')")
    if sim_link.is_visible():
        sim_link.click()
        page.wait_for_timeout(800)
    page.screenshot(path="capturas/captura_04_pago_nfc.png")
    
    # 5. Tique Digital
    print("5. Triggering payment to capture Tique Digital...")
    nfc_pay_btn = page.locator("button:has-text('Pagar')").last
    if nfc_pay_btn.is_visible():
        nfc_pay_btn.click()
        page.wait_for_timeout(2500) # wait for confetti & ticket modal
    page.screenshot(path="capturas/captura_05_tique_digital.png")
    
    # Close ticket modal
    page.keyboard.press("Escape")
    page.wait_for_timeout(800)
    close_btns = page.locator("button[aria-label='Cerrar']")
    if close_btns.count() > 0 and close_btns.first.is_visible():
        close_btns.first.click()
        page.wait_for_timeout(600)
        
    # 6. Billetera Digital
    print("6. Capturing Billetera Digital...")
    page.locator("header nav button", has_text="Billetera").click()
    page.wait_for_timeout(1500)
    page.screenshot(path="capturas/captura_06_billetera_digital.png")
    
    # 7. Consola Conductor
    print("7. Capturing Consola Conductor...")
    page.locator("header nav button", has_text="Conductor").click()
    page.wait_for_timeout(1500)
    plus_btn = page.locator("button:has-text('+'), button:has-text('Subir')")
    if plus_btn.count() > 0 and plus_btn.first.is_visible():
        plus_btn.first.click()
        page.wait_for_timeout(500)
    page.screenshot(path="capturas/captura_07_consola_conductor.png")
    
    # 8. Auditor de Hardware
    print("8. Capturing Auditor de Hardware...")
    hw_btn = page.locator("header button[title*='hardware'], header button[title*='dispositivo']")
    if hw_btn.count() > 0 and hw_btn.first.is_visible():
        hw_btn.first.click()
        page.wait_for_timeout(1200)
    page.screenshot(path="capturas/captura_08_auditor_hardware.png")
    
    browser.close()
    print("All precision screenshots captured successfully!")
