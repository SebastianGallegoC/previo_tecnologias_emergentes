import os
import sys
import time
import threading
import http.server
import socketserver
from playwright.sync_api import sync_playwright

PORT = 5196
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

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
    )
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.goto(f"http://127.0.0.1:{PORT}")
    page.wait_for_timeout(2000)
    
    # Enable simulated NFC mode via localStorage / script
    page.evaluate("""() => {
        // Find simulation toggle or set mode
        const caps = JSON.parse(localStorage.getItem('transcucuta_caps') || '{}');
    }""")
    
    # Open Trip Planner and click Pay with QR
    page.locator("header nav button", has_text="Viajar").click()
    page.wait_for_timeout(1500)
    
    # Click on the button 'Pagar pasaje con QR'
    qr_pay_btn = page.locator("button:has-text('Pagar pasaje con QR')").first
    if qr_pay_btn.is_visible():
        qr_pay_btn.click()
        page.wait_for_timeout(1000)
        
        # Take NFC/QR payment modal screenshot
        page.screenshot(path="capturas/captura_04_pago_nfc.png")
        print("Captured captura_04_pago_nfc.png")
        
        # Click Confirmar Pago QR
        confirm_btn = page.locator("button:has-text('Confirmar Pago QR')").first
        if confirm_btn.is_visible():
            confirm_btn.click()
            page.wait_for_timeout(1500)
            
            # Now ticket modal should be open!
            page.screenshot(path="capturas/captura_05_tique_digital.png")
            print("Captured captura_05_tique_digital.png")

    browser.close()
