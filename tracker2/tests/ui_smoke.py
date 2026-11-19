from playwright.sync_api import sync_playwright
from pathlib import Path
from re import sub
from shutil import which
base=Path(__file__).resolve().parent.parent
html=(base/'index.html').read_text()
html=sub(r'<meta http-equiv="Content-Security-Policy"[^>]+>', '', html)
html=sub(r'<script defer src="[^"]+"></script>', '', html)
html=sub(r'<link rel="stylesheet"[^>]+>', '', html)
def load(page):
 page.set_content(html)
 page.add_style_tag(content=(base/'styles.css').read_text())
 for name in ['finance-core.js','finance-repository.js','app.js']:
  page.add_script_tag(content=(base/name).read_text())

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=which('chromium') or which('google-chrome'),args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':800},device_scale_factor=1,accept_downloads=True)
 page.set_default_timeout(5000)
 errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
 load(page);page.screenshot(path=str(base/'preview-desktop.png'),full_page=True)
 assert page.locator('#page-title').inner_text()=='Inicio'
 assert '$615.011' in page.locator('#page-content').inner_text()
 page.locator('#menu-toggle').click();assert page.locator('#drawer').get_attribute('aria-hidden')=='false'
 page.get_by_role('button',name='Cuentas y movimientos').click();assert page.locator('#page-title').inner_text()=='Cuentas y movimientos'
 page.get_by_role('button',name='+ Nuevo movimiento').click()
 page.locator('#tx-type').select_option('transfer');page.locator('#tx-amount').fill('50000');page.locator('#tx-date').fill('2026-11-12');page.locator('#tx-from').select_option('bank-main');page.locator('#tx-to').select_option('mercado-pago');page.locator('#tx-note').fill('Traslado de prueba');page.get_by_role('button',name='Guardar movimiento').click()
 
 assert page.locator('#transaction-dialog').is_visible() is False
 page.locator('#menu-toggle').click();page.get_by_role('button',name='Inicio',exact=True).click()
 assert '$615.011' in page.locator('#page-content').inner_text()
 assert '$465.000' in page.locator('#page-content').inner_text()
 assert '$150.011' in page.locator('#page-content').inner_text()
 page.get_by_role('button',name='+ Nuevo movimiento').click()
 page.locator('#tx-type').select_option('expense');page.locator('#tx-amount').fill('10000');page.locator('#tx-date').fill('2026-11-14');page.locator('#tx-account').select_option('bank-main');page.locator('#tx-note').fill('<img src=x onerror=alert(1)>');page.get_by_role('button',name='Guardar movimiento').click()
 assert '$605.011' in page.locator('#page-content').inner_text()
 assert page.locator('#page-content img').count()==0
 page.locator('#menu-toggle').click();page.get_by_role('button',name='Estadísticas').click(); assert '$45.000' in page.locator('#page-content').inner_text()
 page.locator('#menu-toggle').click();page.get_by_role('button',name='Reportes').click();assert 'Flujo neto' in page.locator('#page-content').inner_text()
 
 with page.expect_download(timeout=5000) as info:page.get_by_role('button',name='Descargar CSV').click()
 assert info.value.suggested_filename=='tracker2-movimientos-demo.csv'
 page.locator('#menu-toggle').click();page.get_by_role('button',name='Cuentas y movimientos').click();page.get_by_role('button',name='Editar movimiento',exact=False).first.click();assert page.locator('#transaction-dialog').is_visible();page.get_by_role('button',name='Cancelar').last.click()
 page.locator('button[data-delete]').first.click();assert page.locator('#confirm-dialog').is_visible();page.locator('#confirm-delete').click();assert page.locator('#confirm-dialog').is_visible() is False
 page.get_by_role('button',name='Añadir cuenta').click();page.locator('#account-name').fill('Efectivo');page.locator('#account-opening').fill('15000');page.get_by_role('button',name='Crear cuenta').click();assert 'Efectivo' in page.locator('#page-content').inner_text()
 print('Desktop smoke OK; errors',errors)
 assert errors==[]
 mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
 mobile_errors=[];mobile.on('pageerror',lambda e: mobile_errors.append(str(e)))
 load(mobile);mobile.wait_for_timeout(350);mobile.screenshot(path=str(base/'preview-mobile.png'),full_page=True)
 mobile.locator('#menu-toggle').click();assert mobile.locator('#drawer').get_attribute('aria-hidden')=='false';mobile.get_by_role('button',name='Ahorros').click();assert mobile.locator('#drawer').get_attribute('aria-hidden')=='true';assert mobile.locator('#page-title').inner_text()=='Ahorros'
 assert mobile_errors==[]
 print('Mobile smoke OK')
 browser.close()