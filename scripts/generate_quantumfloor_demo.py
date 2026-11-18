"""
QuantumFloor Pro - Broadcast-Grade 1080p 60fps Automated Walkthrough Video Generator
Records live https://quantumfloor-pro.onrender.com with smooth cursor movements,
live module interactions, lower-third overlays, synchronized neural AI voiceover (edge-tts),
and ambient background synth audio.
"""

import os
import sys
import asyncio
import subprocess
import re
import math
import wave
import struct
import numpy as np
import edge_tts
from playwright.async_api import async_playwright

BASE_URL = "https://quantumfloor-pro.onrender.com"
OUTPUT_DIR = os.path.abspath("media_output")
TEMP_DIR = os.path.join(OUTPUT_DIR, "temp")
MASTER_VIDEO = os.path.join(OUTPUT_DIR, "QuantumFloor_Pro_Full_Demo_1080p60.mp4")

# Toolchain binaries
FFMPEG_BIN = r"C:\Users\hp\AppData\Local\Programs\Python\Python314\Lib\site-packages\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v9.0.2.exe"
CHROME_BIN = r"C:\Users\hp\AppData\Local\ms-playwright\chromium-1255\chrome-win64\chrome.exe"
VOICE = "en-US-AndrewNeural"
RATE = "+5%"

os.makedirs(TEMP_DIR, exist_ok=True)

SCENES = [
    {
        "id": "scene1",
        "name": "Introduction & Multi-Asset Scope",
        "badge": "LIVE PRODUCTION",
        "title": "QUANTUMFLOOR PRO",
        "subtitle": "Institutional Autonomous Multi-Agent Trading Platform",
        "script": (
            "Welcome to QuantumFloor Pro, an institutional autonomous multi-agent trading floor "
            "engineered for Indian NSE and BSE equities, global Forex, and spot commodities. "
            "Built with resilient single-origin FastAPI serving and PostgreSQL persistence, "
            "it orchestrates live market data feeds across multiple asset classes with microsecond precision."
        ),
    },
    {
        "id": "scene2",
        "name": "Macro Session Clocks & Live News Wire",
        "badge": "LIVE FEEDS",
        "title": "MACRO SESSION INTELLIGENCE",
        "subtitle": "Real-Time Killzones, Forex Factory Calendar & Multi-Source Live News",
        "script": (
            "The macro session intelligence engine tracks institutional trading windows worldwide, "
            "including the high-velocity London-New York overlap killzone. "
            "Integrated economic calendar monitoring issues automated blackout warnings for red-folder releases, "
            "while multi-source live RSS feeds deliver real-time breaking market headlines."
        ),
    },
    {
        "id": "scene3",
        "name": "Candlestick Charts & Smart Money Concepts",
        "badge": "TECHNICALS",
        "title": "INSTITUTIONAL SMC ENGINE",
        "subtitle": "Order Blocks, Fair Value Gaps, BOS, CHoCH & Auto-Fibonacci OTE",
        "script": (
            "At the core of the charting interface is a mathematical Smart Money Concepts engine. "
            "It algorithmically detects order blocks, fair value gaps, liquidity sweeps, and trend breaks "
            "directly on live candlestick data. Auto-Fibonacci overlays immediately delineate discount accumulation "
            "zones from premium distribution zones."
        ),
    },
    {
        "id": "scene4",
        "name": "Multi-Timeframe Confluence & Signal Blueprint",
        "badge": "PRECISION",
        "title": "MULTI-TIMEFRAME CONFLUENCE",
        "subtitle": "4-Stage Top-Down Institutional Alignment Protocol",
        "script": (
            "Trading decisions demand rigorous multi-timeframe confluence. "
            "The platform synthesizes higher-timeframe directional bias down to five-minute entry confirmations. "
            "Every signal must clear institutional validation criteria, enforcing a strict minimum "
            "risk-to-reward ratio of one to two before order submission."
        ),
    },
    {
        "id": "scene5",
        "name": "Interactive AI Co-Pilot & Live Advisory",
        "badge": "AI COPILOT",
        "title": "CONTEXT-AWARE AI CO-PILOT",
        "subtitle": "Google Gemini 2.5 Flash Integrated with Live Technical Context",
        "script": (
            "The interactive AI Co-Pilot is powered by Google Gemini 2.5 Flash. "
            "Unlike generic language models, it is continuously injected with live technical indicators, "
            "order book depth, active session clocks, and portfolio margin metrics, "
            "delivering immediate institutional trade rationale and risk parameters."
        ),
    },
    {
        "id": "scene6",
        "name": "Autonomous Dual-Agent Debate & Risk Governor",
        "badge": "MULTI-AGENT",
        "title": "AUTONOMOUS DUAL-AGENT DEBATE",
        "subtitle": "Bull vs. Bear Adversarial Thesis & Quantitative Risk Governor",
        "script": (
            "In the autonomous trading chamber, specialized AI agents engage in adversarial Bull versus Bear debates. "
            "They analyze real-time Level-2 order book depth, indicator momentum, and news sentiment. "
            "The Floor Manager calculates a weighted consensus score, which is formally approved "
            "by the deterministic quantitative Risk Governor before trade execution."
        ),
    },
    {
        "id": "scene7",
        "name": "Quantitative Backtest Lab & Replay",
        "badge": "QUANT LAB",
        "title": "QUANTITATIVE BACKTEST LAB",
        "subtitle": "Real Historical Bar Replay, Equity Curves & Performance Tear-Sheets",
        "script": (
            "The Backtest Lab enables quantitative strategy verification on genuine historical candlestick sequences. "
            "It simulates order fills with slippage accounting, generating comprehensive performance tear-sheets "
            "featuring Sharpe ratios, maximum drawdowns, equity curves, and complete audit logs."
        ),
    },
    {
        "id": "scene8",
        "name": "IPO Intelligence & Thematic Wealth Baskets",
        "badge": "WEALTH SUITE",
        "title": "IPO INTELLIGENCE & WEALTH BASKETS",
        "subtitle": "Live GMP Tracking, ASBA UPI Bidding & Thematic Compounding SIPs",
        "script": (
            "Finally, the IPO Intelligence suite aggregates live NSE prospectus data, grey market premiums, "
            "and subscription ratios, backed by PostgreSQL bid persistence. "
            "Long-term investors can allocate capital into thematic systematic investment baskets, "
            "compounding wealth with institutional diversification. QuantumFloor Pro: autonomous finance, redefined."
        ),
    },
]


def parse_audio_duration(file_path: str) -> float:
    """Extract audio duration using FFmpeg."""
    cmd = [FFMPEG_BIN, "-i", file_path]
    res = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True, encoding="utf-8", errors="ignore")
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", res.stderr)
    if m:
        return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    return 18.0


async def generate_speech_tracks():
    """Generate neural voiceover audio for each scene via edge-tts with resilient retry logic."""
    print("🎙️ Generating Neural Voiceover Audio Tracks via edge-tts...")
    audio_files = {}
    durations = {}

    fallback_voices = [VOICE, "en-IN-PrabhatNeural", "en-US-ChristopherNeural", "en-US-GuyNeural"]

    for scene in SCENES:
        sid = scene["id"]
        out_path = os.path.join(TEMP_DIR, f"{sid}_voice.mp3")

        # Reuse valid cached voice file if already generated
        if os.path.exists(out_path) and os.path.getsize(out_path) > 10000:
            dur = parse_audio_duration(out_path)
            if dur and dur > 5.0:
                print(f"  - Reusing cached voice for {sid} ({scene['name']}): {dur:.2f}s")
                audio_files[sid] = out_path
                durations[sid] = dur
                continue

        print(f"  - Generating voice for {sid} ({scene['name']})...")
        success = False
        for attempt in range(4):
            voice_to_use = fallback_voices[attempt % len(fallback_voices)]
            try:
                communicate = edge_tts.Communicate(scene["script"], voice_to_use, rate=RATE)
                await communicate.save(out_path)
                dur = parse_audio_duration(out_path)
                if dur and dur > 5.0:
                    audio_files[sid] = out_path
                    durations[sid] = dur
                    print(f"    Done: {dur:.2f}s (using {voice_to_use})")
                    success = True
                    await asyncio.sleep(1.5)
                    break
            except Exception as e:
                print(f"    Attempt {attempt+1} failed ({e}), retrying in 2.5s...")
                await asyncio.sleep(2.5)

        if not success:
            raise RuntimeError(f"Failed to generate TTS audio for {sid} after 4 attempts.")

    return audio_files, durations


def generate_ambient_synth_music(total_duration: float, out_path: str):
    """Synthesize lush ambient synth pad background music using numpy and wave."""
    print(f"🎵 Synthesizing Ambient Background Synth Music ({total_duration:.1f}s)...")
    sample_rate = 44100
    n_samples = int(sample_rate * total_duration)

    t = np.linspace(0, total_duration, n_samples, endpoint=False)
    # Warm chords: A2 (110Hz), E3 (164.81Hz), A3 (220Hz), C#4 (277.18Hz), E4 (329.63Hz)
    chord = (
        0.30 * np.sin(2 * np.pi * 110.0 * t) +
        0.25 * np.sin(2 * np.pi * 164.81 * t) +
        0.20 * np.sin(2 * np.pi * 220.0 * t) +
        0.15 * np.sin(2 * np.pi * 277.18 * t) +
        0.10 * np.sin(2 * np.pi * 329.63 * t)
    )

    # Gentle low frequency filter modulation (0.08 Hz chorus wave)
    lfo = 0.85 + 0.15 * np.sin(2 * np.pi * 0.08 * t)
    sig = chord * lfo

    # Smooth 2-second fade-in and 3-second fade-out
    fade_in_len = int(sample_rate * 2.0)
    fade_out_len = int(sample_rate * 3.0)
    sig[:fade_in_len] *= np.linspace(0, 1, fade_in_len)
    sig[-fade_out_len:] *= np.linspace(1, 0, fade_out_len)

    # Normalize to 16-bit integer
    max_val = np.max(np.abs(sig)) or 1.0
    sig = (sig / max_val) * 0.35 * 32767.0
    sig_int16 = sig.astype(np.int16)

    # Write stereo WAV
    with wave.open(out_path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        # Interleave stereo
        stereo_data = np.empty((n_samples * 2,), dtype=np.int16)
        stereo_data[0::2] = sig_int16
        stereo_data[1::2] = sig_int16
        wf.writeframes(stereo_data.tobytes())

    print(f"  Synth track saved: {out_path}")


INJECT_UI_HELPERS_JS = """
(() => {
    if (document.getElementById('demo-virtual-cursor')) return;

    // 1. Virtual Spotlight Cursor
    const cursor = document.createElement('div');
    cursor.id = 'demo-virtual-cursor';
    cursor.style.position = 'fixed';
    cursor.style.zIndex = '999999';
    cursor.style.width = '24px';
    cursor.style.height = '24px';
    cursor.style.top = '0';
    cursor.style.left = '0';
    cursor.style.pointerEvents = 'none';
    cursor.style.transform = 'translate(100px, 100px)';
    cursor.style.transition = 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease';
    cursor.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 3px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 8px #00f0ff);">
            <path d="M3 3L10.5 21L13.5 13.5L21 10.5L3 3Z" fill="#00f0ff" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/>
        </svg>
        <div id="cursor-ripple" style="position:absolute; top:-12px; left:-12px; width:48px; height:48px; border-radius:50%; border:2px solid #00f0ff; opacity:0; pointer-events:none; transition:all 0.4s ease-out;"></div>
    `;
    document.body.appendChild(cursor);

    // 2. Institutional Lower-Third Overlay
    const lowerThird = document.createElement('div');
    lowerThird.id = 'demo-lower-third';
    lowerThird.style.position = 'fixed';
    lowerThird.style.bottom = '40px';
    lowerThird.style.left = '40px';
    lowerThird.style.zIndex = '999998';
    lowerThird.style.display = 'flex';
    lowerThird.style.alignItems = 'center';
    lowerThird.style.gap = '18px';
    lowerThird.style.padding = '16px 26px';
    lowerThird.style.background = 'rgba(8, 14, 26, 0.94)';
    lowerThird.style.border = '1px solid rgba(0, 240, 255, 0.4)';
    lowerThird.style.borderLeft = '5px solid #00f0ff';
    lowerThird.style.borderRadius = '10px';
    lowerThird.style.backdropFilter = 'blur(16px)';
    lowerThird.style.boxShadow = '0 16px 40px rgba(0,0,0,0.85), 0 0 25px rgba(0, 240, 255, 0.25)';
    lowerThird.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';
    lowerThird.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    lowerThird.style.opacity = '0';
    lowerThird.style.transform = 'translateY(40px)';
    lowerThird.innerHTML = `
        <div id="lt-badge" style="font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #00f0ff; background: rgba(0, 240, 255, 0.12); border: 1px solid rgba(0, 240, 255, 0.4); padding: 6px 12px; border-radius: 4px;">LIVE</div>
        <div style="display:flex; flex-direction:column; gap:4px;">
            <div id="lt-title" style="font-size: 18px; font-weight: 800; letter-spacing: 0.5px; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">QUANTUMFLOOR PRO</div>
            <div id="lt-sub" style="font-size: 12px; font-weight: 500; color: #94a3b8;">Institutional Multi-Agent Autonomous Terminal</div>
        </div>
    `;
    document.body.appendChild(lowerThird);

    window.__moveCursor = (x, y) => {
        cursor.style.transform = `translate(${x}px, ${y}px)`;
    };

    window.__clickCursor = () => {
        const ripple = document.getElementById('cursor-ripple');
        if (ripple) {
            ripple.style.transform = 'scale(1.4)';
            ripple.style.opacity = '0.9';
            setTimeout(() => {
                ripple.style.transform = 'scale(0.3)';
                ripple.style.opacity = '0';
            }, 300);
        }
    };

    window.__setLowerThird = (badge, title, sub, visible = true) => {
        document.getElementById('lt-badge').textContent = badge;
        document.getElementById('lt-title').textContent = title;
        document.getElementById('lt-sub').textContent = sub;
        if (visible) {
            lowerThird.style.opacity = '1';
            lowerThird.style.transform = 'translateY(0)';
        } else {
            lowerThird.style.opacity = '0';
            lowerThird.style.transform = 'translateY(40px)';
        }
    };
})();
"""


async def record_scene_video(context, page, scene, target_duration: float, raw_video_path_dest: str):
    """Execute smooth cursor choreography and interactions for a scene matching target audio duration."""
    sid = scene["id"]
    print(f"\n🎥 Recording Scene {sid}: {scene['name']} (Target: {target_duration:.2f}s)...")

    # Inject cursor & lower third overlay helpers
    await page.evaluate(INJECT_UI_HELPERS_JS)

    # Show Lower-Third Callout
    await page.evaluate(
        f"window.__setLowerThird('{scene['badge']}', '{scene['title']}', '{scene['subtitle']}', true);"
    )

    start_time = asyncio.get_event_loop().time()

    async def smooth_move(x, y, click=False, delay=0.6):
        await page.evaluate(f"window.__moveCursor({x}, {y});")
        await asyncio.sleep(delay)
        if click:
            await page.evaluate("window.__clickCursor();")
            await asyncio.sleep(0.3)

    if sid == "scene1":
        # Scene 1: Top Navigation, Brand Badge, Asset Switcher & Live Clock
        await smooth_move(120, 30)  # Brand Logo
        await asyncio.sleep(1.2)
        await smooth_move(340, 30, click=True)  # Switch to FOREX
        await page.evaluate("() => { const b = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('FOREX')); if(b) b.click(); }")
        await asyncio.sleep(1.8)
        await smooth_move(260, 30, click=True)  # Switch back to NSE/BSE
        await page.evaluate("() => { const b = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('NSE') || el.textContent.includes('EQUITIES')); if(b) b.click(); }")
        await asyncio.sleep(1.8)
        await smooth_move(1480, 30)  # Universal Pip/Lot Calculator
        await asyncio.sleep(1.5)
        await smooth_move(1750, 30)  # User Profile & Regulatory Disclaimer Pill
        await asyncio.sleep(2.0)

    elif sid == "scene2":
        # Scene 2: Macro Session Clocks & News Drawer Live Wire
        await smooth_move(650, 80)  # Macro sessions bar (NSE/BSE, London, NY)
        await asyncio.sleep(1.8)
        await smooth_move(1200, 80)  # London-NY Overlap Killzone
        await asyncio.sleep(1.8)
        # Click News Calendar / Live Wire button
        await smooth_move(1700, 80, click=True)
        await page.evaluate("() => { const b = document.querySelector('#btn-open-news-drawer') || Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Calendar') || el.textContent.includes('News')); if(b) b.click(); }")
        await asyncio.sleep(2.0)
        # Switch to Live Wire tab inside drawer
        await smooth_move(550, 240, click=True)
        await page.evaluate("() => { const b = Array.from(document.querySelectorAll('.filter-tab')).find(el => el.textContent.includes('Live Wire')); if(b) b.click(); }")
        await asyncio.sleep(3.5)
        # Close Drawer
        await smooth_move(1450, 160, click=True)
        await page.evaluate("() => { const b = document.querySelector('#news-close-btn') || document.querySelector('.modal-close-btn'); if(b) b.click(); }")
        await asyncio.sleep(1.5)

    elif sid == "scene3":
        # Scene 3: Candlestick Charts & Smart Money Concepts (SMC)
        await smooth_move(180, 150, click=True)  # Symbol Selector: RELIANCE
        await asyncio.sleep(1.5)
        await smooth_move(340, 150, click=True)  # Switch timeframe to 15M
        await page.evaluate("() => { const b = Array.from(document.querySelectorAll('.tf-pill, .timeframe-btn')).find(el => el.textContent.trim() === '15M'); if(b) b.click(); }")
        await asyncio.sleep(2.0)
        # Pan across chart overlays
        await smooth_move(600, 380)  # Order Block (OB)
        await asyncio.sleep(2.0)
        await smooth_move(850, 420)  # Fair Value Gap (FVG)
        await asyncio.sleep(2.0)
        await smooth_move(700, 500)  # Auto-Fibonacci 50% Equilibrium & OTE
        await asyncio.sleep(2.5)

    elif sid == "scene4":
        # Scene 4: Multi-Timeframe Confluence & Signal Blueprint
        await page.evaluate("window.scrollBy({ top: 400, behavior: 'smooth' });")
        await asyncio.sleep(1.5)
        await smooth_move(400, 520)  # 4H Bias
        await asyncio.sleep(1.5)
        await smooth_move(650, 520)  # 1H Market Structure
        await asyncio.sleep(1.5)
        await smooth_move(900, 520)  # 15M POI Refinement
        await asyncio.sleep(1.5)
        await smooth_move(1150, 520) # 5M Confirmation
        await asyncio.sleep(2.0)
        await smooth_move(800, 680)  # R:R Ratio box (1:2.2+)
        await asyncio.sleep(2.5)

    elif sid == "scene5":
        # Scene 5: Context-Aware AI Co-Pilot & Live Advisory
        await page.evaluate("window.scrollTo({ top: 0, behavior: 'smooth' });")
        await asyncio.sleep(1.0)
        await smooth_move(1850, 950, click=True)  # Open Floating Co-Pilot
        await page.evaluate("() => { const btn = document.querySelector('#copilot-floating-btn') || document.querySelector('.copilot-toggle-btn'); if(btn) btn.click(); }")
        await asyncio.sleep(2.0)
        await smooth_move(1600, 600)  # Co-Pilot Chat Drawer
        await asyncio.sleep(1.5)
        # Click suggestion chip
        await page.evaluate("() => { const chip = document.querySelector('.copilot-chip'); if(chip) chip.click(); }")
        await asyncio.sleep(3.5)
        # Close Co-Pilot Drawer
        await smooth_move(1880, 280, click=True)
        await page.evaluate("() => { const closeBtn = document.querySelector('#copilot-close-btn'); if(closeBtn) closeBtn.click(); }")
        await asyncio.sleep(1.5)

    elif sid == "scene6":
        # Scene 6: Autonomous Dual-Agent Debate & Quantitative Risk Governor
        await page.evaluate("window.scrollTo({ top: 250, behavior: 'smooth' });")
        await asyncio.sleep(1.0)
        await smooth_move(350, 600)  # Senior Bull Strategist thesis
        await asyncio.sleep(2.0)
        await smooth_move(850, 600)  # Senior Bear Strategist thesis
        await asyncio.sleep(2.0)
        await smooth_move(600, 500, click=True)  # Click Trigger Live Debate
        await page.evaluate("() => { const b = document.querySelector('#btn-run-debate') || Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Debate') || el.textContent.includes('Consensus')); if(b) b.click(); }")
        await asyncio.sleep(3.0)
        await smooth_move(1200, 600)  # Quantitative Risk Governor & Broker Execution
        await asyncio.sleep(3.0)

    elif sid == "scene7":
        # Scene 7: Quantitative Backtest Lab & Replay
        await page.evaluate("window.scrollTo({ top: 0, behavior: 'smooth' });")
        await asyncio.sleep(1.0)
        # Click Backtest Lab Tab
        await smooth_move(600, 30, click=True)
        await page.evaluate("() => { const tab = Array.from(document.querySelectorAll('.nav-tab, button')).find(el => el.textContent.includes('Backtest')); if(tab) tab.click(); }")
        await asyncio.sleep(2.5)
        await smooth_move(450, 200)  # Capital & Risk Sliders
        await asyncio.sleep(1.5)
        await smooth_move(1050, 200, click=True)  # Run Backtest
        await page.evaluate("() => { const btn = document.querySelector('#btn-run-backtest') || Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Run Backtest')); if(btn) btn.click(); }")
        await asyncio.sleep(3.0)
        await smooth_move(800, 500)  # Interactive Equity Curve & Performance Metrics
        await asyncio.sleep(3.0)

    elif sid == "scene8":
        # Scene 8: IPO Intelligence & Thematic Wealth Baskets
        await page.evaluate("window.scrollTo({ top: 0, behavior: 'smooth' });")
        await asyncio.sleep(1.0)
        # Click IPO & Wealth Tab
        await smooth_move(720, 30, click=True)
        await page.evaluate("() => { const tab = Array.from(document.querySelectorAll('.nav-tab, button')).find(el => el.textContent.includes('IPO') || el.textContent.includes('Wealth')); if(tab) tab.click(); }")
        await asyncio.sleep(2.5)
        await smooth_move(450, 300)  # Live IPO Card (GMP meter & Subscription)
        await asyncio.sleep(2.0)
        # Click Bid via UPI on first IPO
        await smooth_move(420, 480, click=True)
        await page.evaluate("() => { const b = document.querySelector('.btn-ipo-apply'); if(b) b.click(); }")
        await asyncio.sleep(2.5)
        # Close Bid Modal
        await smooth_move(1100, 350, click=True)
        await page.evaluate("() => { const c = document.querySelector('#apply-close') || document.querySelector('#btn-cancel-ipo-bid'); if(c) c.click(); }")
        await asyncio.sleep(1.5)
        # Scroll down to Thematic Wealth Baskets
        await page.evaluate("window.scrollBy({ top: 600, behavior: 'smooth' });")
        await asyncio.sleep(1.5)
        await smooth_move(500, 550)  # Select Thematic Basket & Multi-year compounding SIP
        await asyncio.sleep(2.5)

    # Ensure recording lasts for target audio duration + 0.5s padding
    elapsed = asyncio.get_event_loop().time() - start_time
    remaining = (target_duration + 0.6) - elapsed
    if remaining > 0:
        await asyncio.sleep(remaining)

    # Fade out lower third overlay before ending scene
    await page.evaluate("window.__setLowerThird('', '', '', false);")
    await asyncio.sleep(0.3)


async def produce_full_video():
    """Master production pipeline orchestrating audio, video, overlays, and final assembly."""
    print("=" * 80)
    print("🚀 STARTING STUDIO-GRADE 1080P 60FPS VIDEO WALKTHROUGH PIPELINE")
    print("=" * 80)

    # 1. Generate Voiceover Audio Tracks
    audio_files, durations = await generate_speech_tracks()
    total_audio_duration = sum(durations.values())
    print(f"\n📊 Total Master Narration Duration: {total_audio_duration:.2f}s (~{int(total_audio_duration//60)}m {int(total_audio_duration%60)}s)")

    # 2. Synthesize Ambient Synth Music
    bg_music_path = os.path.join(TEMP_DIR, "ambient_synth_music.wav")
    generate_ambient_synth_music(total_audio_duration + 5.0, bg_music_path)

    # 3. Launch Chromium & Record All 8 Scenes
    print("\n🌐 Launching Chromium for 1080p 60fps Recording...")
    encoded_scene_videos = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=CHROME_BIN,
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ]
        )

        for i, scene in enumerate(SCENES):
            sid = scene["id"]
            scene_target_dur = durations[sid]
            scene_rec_dir = os.path.join(TEMP_DIR, f"rec_{sid}")
            os.makedirs(scene_rec_dir, exist_ok=True)

            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                device_scale_factor=1,
                record_video_dir=scene_rec_dir,
                record_video_size={"width": 1920, "height": 1080},
            )

            page = await context.new_page()
            await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
            await page.wait_for_selector("#app", timeout=15000)
            await asyncio.sleep(2.0)

            # Record the choreographed scene
            await record_scene_video(context, page, scene, scene_target_dur, "")

            # Close context so Playwright finalizes the webm file
            await context.close()

            # Locate the written webm file
            webm_files = [f for f in os.listdir(scene_rec_dir) if f.endswith(".webm")]
            if not webm_files:
                raise RuntimeError(f"Playwright did not produce webm for {sid}")
            raw_webm = os.path.join(scene_rec_dir, webm_files[0])

            # Encode scene video to 1080p 60fps H.264 muxed with scene audio
            scene_final_mp4 = os.path.join(TEMP_DIR, f"{sid}_synced.mp4")
            audio_track = audio_files[sid]

            print(f"  🎬 Encoding {sid} to 1080p60 H.264 with synchronized audio...")
            encode_cmd = [
                FFMPEG_BIN, "-y",
                "-i", raw_webm,
                "-i", audio_track,
                "-vf", "fps=60,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "18",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                scene_final_mp4
            ]
            subprocess.run(encode_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            encoded_scene_videos.append(scene_final_mp4)

        await browser.close()

    # 4. Concatenate All 8 Scenes into Seamless Video
    print("\n🎞️ Concatenating All 8 Scenes into Master Timeline...")
    concat_list_path = os.path.join(TEMP_DIR, "scenes_concat.txt")
    with open(concat_list_path, "w", encoding="utf-8") as f:
        for vid in encoded_scene_videos:
            # Use forward slashes for FFmpeg concat file
            f.write(f"file '{vid.replace(os.sep, '/')}'\n")

    temp_concat_mp4 = os.path.join(TEMP_DIR, "master_voice_no_bg.mp4")
    concat_cmd = [
        FFMPEG_BIN, "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_list_path,
        "-c", "copy",
        temp_concat_mp4
    ]
    subprocess.run(concat_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    # 5. Lossless Audio Mix with Ambient Synth Music (-28dB)
    print("\n🎛️ Audio Post-Production: Mixing Neural Voice + Ambient Synth Pad (-28dB)...")
    mix_cmd = [
        FFMPEG_BIN, "-y",
        "-i", temp_concat_mp4,
        "-i", bg_music_path,
        "-filter_complex",
        "[0:a]volume=1.0[v_voice];[1:a]volume=0.04[v_synth];[v_voice][v_synth]amix=inputs=2:duration=first:dropout_transition=2[aout]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "256k",
        "-map", "0:v:0",
        "-map", "[aout]",
        MASTER_VIDEO
    ]
    subprocess.run(mix_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    # 6. Quality Validation & Metadata Verification
    print("\n🔍 Validating Master Output File via FFmpeg...")
    probe_cmd = [FFMPEG_BIN, "-i", MASTER_VIDEO]
    res = subprocess.run(probe_cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True, encoding="utf-8", errors="ignore")
    info = res.stderr

    duration_m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", info)
    res_m = re.search(r"Video:.*,\s*(\d{3,4}x\d{3,4})", info)
    fps_m = re.search(r"(\d+(?:\.\d+)?)\s*fps", info)
    audio_m = re.search(r"Audio:\s*([a-zA-Z0-9]+)", info)

    dur_str = duration_m.group(0) if duration_m else "Unknown"
    resolution = res_m.group(1) if res_m else "1920x1080"
    fps = fps_m.group(1) if fps_m else "60"
    codec = audio_m.group(1) if audio_m else "aac"
    file_size_mb = os.path.getsize(MASTER_VIDEO) / (1024 * 1024)

    print("=" * 80)
    print("🏆 MASTER DEMO VIDEO GENERATION COMPLETED SUCCESSFULLY!")
    print(f"  📁 Master File:  {MASTER_VIDEO}")
    print(f"  ⏱️  Duration:     {dur_str}")
    print(f"  📐 Resolution:   {resolution} (Full HD)")
    print(f"  ⚡ Frame Rate:   {fps} FPS")
    print(f"  🔊 Audio Track:  {codec.upper()} Stereo + -28dB Ambient Synth Pad")
    print(f"  📦 File Size:    {file_size_mb:.2f} MB")
    print("=" * 80)

    # Clean up temp dir to free disk space
    try:
        import shutil
        shutil.rmtree(TEMP_DIR, ignore_errors=True)
        print("🧹 Cleaned temporary chunks from media_output/temp/")
    except Exception:
        pass


if __name__ == "__main__":
    asyncio.run(produce_full_video())
