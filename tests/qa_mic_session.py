"""Microphone session semantics.

Pins the decision that mic detection is INPUT, not a playback session: it must never
raise Now Playing, must never be stolen by an exclusive session, and must survive
navigation (so the fretboard can mirror it) while still tearing the mic down on Stop.
Uses Chrome's fake capture device so getUserMedia resolves headlessly.
"""
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8123/"
passed = failed = 0


def check(label, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  ok   {label}" + (f"   [{extra}]" if extra else ""))
    else:
        failed += 1
        print(f"  FAIL {label}" + (f"   [{extra}]" if extra else ""))


def sessions(page):
    return page.evaluate("""() => {
        const sm = window.AhordianApp?.sessionManager;
        if (!sm) return null;
        return Array.from(sm.activeSessions).map(s => s.id);
    }""")


def mic_live(page):
    return page.evaluate("""() => {
        const s = window.AhordianApp?.micStream;
        return !!s && s.getTracks().some(t => t.readyState === 'live');
    }""")


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True, args=[
        "--autoplay-policy=no-user-gesture-required",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
    ])
    ctx = b.new_context(permissions=["microphone"])
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(URL)
    page.wait_for_load_state("networkidle")

    # The dead types must be gone from the enum, not merely unused.
    types = page.evaluate("""async () => {
        const m = await import('/js/audio/AudioSessionManager.js');
        return Object.keys(m.AudioSessionType);
    }""")
    check("TRANSCRIPTION removed from AudioSessionType", "TRANSCRIPTION" not in types)
    check("ANALYSIS removed from AudioSessionType", "ANALYSIS" not in types)
    check("playback types still present",
          all(t in types for t in ("METRONOME", "JAM_TRACK", "EAR_TRAINING",
                                   "NOTE_PREVIEW", "TAB_PLAYER", "REPLAY")),
          ", ".join(types))

    page.click('.nav-btn[data-target="detector-screen"]')
    page.wait_for_timeout(400)
    page.click("#start-btn")
    page.wait_for_timeout(1200)

    check("mic is live after Start Detection", mic_live(page))
    check("mic badge reads active",
          "off" not in page.locator("#mic-status").inner_text().lower(),
          page.locator("#mic-status").inner_text())
    check("detection raises NO audio session", sessions(page) == [], str(sessions(page)))
    check("detection raises NO Now Playing pill",
          not page.locator("#now-playing-pill").is_visible())

    # An exclusive playback session must not disturb the mic.
    page.click("#metronome-toggle")
    page.wait_for_timeout(800)
    check("metronome raises Now Playing", page.locator("#now-playing-pill").is_visible())
    check("Now Playing labels the metronome, not the mic",
          "metronome" in page.locator("#now-playing-label").inner_text().lower(),
          page.locator("#now-playing-label").inner_text())
    check("exclusive session did not stop the mic", mic_live(page))
    check("only the metronome session is active", sessions(page) == ["metronome"],
          str(sessions(page)))

    # Navigation: stopAll() silences playback but detection is input and survives.
    page.click('.nav-btn[data-target="fretboard-screen"]')
    page.wait_for_timeout(700)
    check("navigation cleared playback sessions", sessions(page) == [], str(sessions(page)))
    check("navigation hid Now Playing", not page.locator("#now-playing-pill").is_visible())
    check("navigation left detection running (input, not playback)", mic_live(page))

    # Stop must still tear the mic down.
    page.click('.nav-btn[data-target="detector-screen"]')
    page.wait_for_timeout(300)
    page.click("#stop-btn")
    page.wait_for_timeout(600)
    check("Stop Detection ends the mic tracks", not mic_live(page))
    check("mic badge reads off again",
          "off" in page.locator("#mic-status").inner_text().lower(),
          page.locator("#mic-status").inner_text())
    check("still no session after stop", sessions(page) == [], str(sessions(page)))

    real = [e for e in errors if "404" not in e and "Failed to load resource" not in e]
    check("no console errors beyond the known drum 404s", not real, "; ".join(real[:2]))

    print(f"\n{passed} passed, {failed} failed")
    b.close()
