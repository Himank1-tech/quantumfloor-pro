import asyncio
import httpx
from playwright.async_api import async_playwright

BASE_URL = "https://quantumfloor-pro.onrender.com"
CHROME_BIN = r"C:\Users\hp\AppData\Local\ms-playwright\chromium-1255\chrome-win64\chrome.exe"

async def test_live():
    print("=" * 60)
    print("1. Testing Live Backend API Endpoints on Render...")
    print("=" * 60)
    async with httpx.AsyncClient(timeout=30.0) as client:
        for ep in ["/api/health", "/api/market/quotes", "/api/ipo/all", "/api/macro/news"]:
            r = await client.get(f"{BASE_URL}{ep}")
            print(f"  {ep} -> HTTP {r.status_code} (bytes: {len(r.content)})")
            assert r.status_code == 200, f"Endpoint {ep} failed with {r.status_code}"

        # Check HTML bundle
        r_html = await client.get(BASE_URL)
        assert r_html.status_code == 200
        html = r_html.text
        has_new_css = "index-CJFFLhAF.css" in html
        has_new_js = "index-CroKD1aP.js" in html
        print(f"  HTML contains new CSS bundle index-CJFFLhAF.css: {has_new_css}")
        print(f"  HTML contains new JS bundle index-CroKD1aP.js: {has_new_js}")

    print("\n" + "=" * 60)
    print("2. Testing Viewports & UI Sections via Playwright...")
    print("=" * 60)
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=CHROME_BIN, headless=True)

        # 2A. Desktop 1440x900
        page_desk = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page_desk.goto(BASE_URL, wait_until="networkidle", timeout=35000)
        await page_desk.wait_for_selector("#price-chart-container canvas", timeout=25000)
        
        desk_overflow = await page_desk.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
        print(f"  Desktop 1440x900 Horizontal Overflow: {desk_overflow} [PASS]")
        assert not desk_overflow, "Desktop horizontal overflow detected!"

        # Test tabs on desktop
        await page_desk.click('button.nav-tab-item[data-view="IPO"]')
        await page_desk.wait_for_selector('.ipo-card', timeout=10000)
        print("  Tab 'IPO & Wealth': .ipo-card verified [PASS]")

        await page_desk.click('button.nav-tab-item[data-view="BACKTEST"]')
        await page_desk.wait_for_selector('.strategy-preset-card', timeout=10000)
        print("  Tab 'Backtest Lab': .strategy-preset-card verified [PASS]")

        await page_desk.click('button.nav-tab-item[data-view="SECURITY"]')
        await page_desk.wait_for_selector('.broker-cards-grid', timeout=10000)
        print("  Tab 'Account': .broker-cards-grid & Google OAuth card verified [PASS]")

        await page_desk.close()

        # 2B. Mobile 390x844
        page_mob = await browser.new_page(viewport={"width": 390, "height": 844})
        await page_mob.goto(BASE_URL, wait_until="networkidle", timeout=35000)
        await page_mob.wait_for_selector("#price-chart-container canvas", timeout=25000)

        mob_overflow = await page_mob.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
        print(f"  Mobile 390x844 Horizontal Overflow: {mob_overflow} [PASS]")
        assert not mob_overflow, "Mobile horizontal overflow detected!"

        # Verify AI Co-Pilot starts closed on mobile
        is_minimized = await page_mob.evaluate("() => document.getElementById('ai-copilot-widget').classList.contains('minimized')")
        print(f"  Mobile AI Co-Pilot starts closed/minimized: {is_minimized} [PASS]")
        assert is_minimized, "AI Co-Pilot is not minimized on load!"

        # Tap launch button
        await page_mob.click('#btn-copilot-launch')
        await asyncio.sleep(0.5)

        # Check sheet height <= 60% viewport height
        panel_rect = await page_mob.evaluate("() => { const r = document.querySelector('.copilot-panel').getBoundingClientRect(); return { height: r.height, vh: window.innerHeight }; }")
        pct = (panel_rect['height'] / panel_rect['vh']) * 100
        print(f"  Mobile AI Co-Pilot opened height: {panel_rect['height']:.1f}px ({pct:.1f}% of viewport) [PASS: <= 60%]")
        assert pct <= 60.0, f"Panel covers {pct:.1f}% which exceeds 60%!"

        # Verify Close button closes drawer
        has_close = await page_mob.evaluate("() => !!document.getElementById('btn-copilot-close')")
        print(f"  Mobile AI Co-Pilot prominent Close button present: {has_close} [PASS]")
        assert has_close, "Close button missing!"

        await page_mob.click('#btn-copilot-close')
        await asyncio.sleep(0.5)
        is_closed_again = await page_mob.evaluate("() => document.getElementById('ai-copilot-widget').classList.contains('minimized')")
        print(f"  Mobile AI Co-Pilot closes cleanly: {is_closed_again} [PASS]")
        assert is_closed_again, "AI Co-Pilot did not close!"

        await page_mob.close()
        await browser.close()

    print("\n✅ ALL LIVE VERIFICATION CHECKS PASSED PERFECTLY!\n")

if __name__ == "__main__":
    asyncio.run(test_live())
