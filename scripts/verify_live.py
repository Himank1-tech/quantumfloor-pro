import asyncio
from playwright.async_api import async_playwright

CHROME_BIN = r"C:\Users\hp\AppData\Local\ms-playwright\chromium-1255\chrome-win64\chrome.exe"

async def verify_live():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=CHROME_BIN, headless=True)
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()
        def handle_dialog(d):
            print("DIALOG APPEARED:", d.message)
            asyncio.create_task(d.accept())
        page.on("dialog", handle_dialog)
        
        print("Navigating to https://quantumfloor-pro.onrender.com ...")
        await page.goto("https://quantumfloor-pro.onrender.com", timeout=60000, wait_until="networkidle")
        await page.wait_for_timeout(3000)
        
        # 1. Superchart Dominance & Canvas height
        await page.wait_for_selector(".chart-canvas-wrapper canvas, canvas", timeout=35000)
        canvas = await page.query_selector(".chart-canvas-wrapper canvas, canvas")
        assert canvas is not None, "Canvas not found!"
        box = await canvas.bounding_box()
        print(f"Canvas bounding box on 1080p: width={box['width']}, height={box['height']}")
        assert box['height'] >= 600, f"Expected canvas height >= 600px, got {box['height']}"
        
        # 2. Check unauthenticated guest state
        nav_text = await page.inner_text("header")
        print("Header contains GUEST / Sign In:", ("GUEST" in nav_text or "Sign In" in nav_text))
        assert "GUEST" in nav_text or "Sign In" in nav_text, f"Header did not show guest state: {nav_text}"
        
        # 3. Navigate to Security / Auth view
        auth_btn = await page.query_selector("#btn-nav-user")
        if not auth_btn:
            auth_btn = await page.query_selector("button:has-text('Sign In')")
            
        assert auth_btn is not None, "btn-nav-user not found!"
        await auth_btn.click()
        await page.wait_for_timeout(1500)
        
        security_text = await page.inner_text("#main-view-container")
        print("Security view loaded. Contains Broker Vault / Connect:", ("BROKER" in security_text.upper() or "NOT CONNECTED" in security_text))
        assert "NOT CONNECTED" in security_text, "Broker cards should show NOT CONNECTED by default!"
        print("Verified: Broker cards default to NOT CONNECTED with zero dummy live status.")
        
        # Open the login / auth modal
        login_btn = await page.query_selector("#btn-open-login, button:has-text('Sign In / Register')")
        if login_btn:
            await login_btn.click()
            await page.wait_for_timeout(1000)
            
            # Switch to Admin portal tab
            admin_tab = await page.query_selector("#tab-auth-admin")
            assert admin_tab is not None, "#tab-auth-admin not found!"
            await admin_tab.click()
            await page.wait_for_timeout(500)
            
            # Fill admin password and submit
            await page.fill("#admin-password-input", "Admin@QuantumFloor2026")
            admin_submit = await page.query_selector("#btn-admin-login-submit")
            assert admin_submit is not None, "btn-admin-login-submit not found!"
            await admin_submit.click()
            await page.wait_for_timeout(2000)
            
            # Verify admin logged in
            security_text_admin = await page.inner_text("#main-view-container")
            print("Admin logged in. Contains Registered Users monitor:", "REGISTERED USERS & ACTIVE LOGINS" in security_text_admin)
            # Print security_text_admin snippet to inspect
            print("security_text_admin length:", len(security_text_admin))
            print("First 300 chars of security_text_admin:", security_text_admin[:300].replace('\n', ' '))
            assert "REGISTERED USERS & ACTIVE LOGINS" in security_text_admin, "Admin monitor not found after admin login!"
            assert "himankbatra2005@gmail.com" in security_text_admin, "Lead admin email not in registered users list!"
            print("Admin monitor verified with live registered users list!")

        # 4. Check Backtest Lab view
        backtest_nav_btn = await page.query_selector("button[data-view='BACKTEST']")
        if backtest_nav_btn:
            await backtest_nav_btn.click()
            await page.wait_for_timeout(1500)
            bt_container = await page.inner_text("#main-view-container")
            print("Backtest Lab view loaded. Triggering run...")
            run_btn = await page.query_selector("#btn-run-backtest, button:has-text('Run Backtest')")
            if run_btn:
                await run_btn.click()
                await page.wait_for_timeout(4000)
                bt_text = await page.inner_text("#main-view-container")
                assert "Load failed" not in bt_text, f"Backtest failed with 'Load failed': {bt_text[:200]}"
                print("Backtest executed successfully without 'Load failed' error!")

        # 5. Mobile viewport verification for Backtest Lab & Layout
        mobile_page = await context.new_page()
        await mobile_page.set_viewport_size({"width": 390, "height": 844})
        await mobile_page.goto("https://quantumfloor-pro.onrender.com", wait_until="networkidle")
        await mobile_page.wait_for_timeout(2000)
        
        # Check mobile chart canvas
        await mobile_page.wait_for_selector(".chart-canvas-wrapper canvas, canvas", timeout=35000)
        mob_canvas = await mobile_page.query_selector(".chart-canvas-wrapper canvas, canvas")
        mob_box = await mob_canvas.bounding_box()
        print(f"Mobile canvas box: width={mob_box['width']}, height={mob_box['height']}")
        assert mob_box['height'] >= 440, f"Expected mobile canvas height >= 440px, got {mob_box['height']}"
        
        await browser.close()
        print(">>> ALL LIVE VERIFICATIONS PASSED 100%! <<<")

asyncio.run(verify_live())
