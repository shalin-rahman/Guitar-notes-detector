"""Settings -> Guitar Tone: both packs ship, the choice persists, and the two
tones are actually different audio (not the same buffer under two names)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

# Screenshots live beside the suites, not in the CWD, so the run location is free.
SHOTS = Path(__file__).resolve().parent / "screenshots"
SHOTS.mkdir(exist_ok=True)

URL = "http://127.0.0.1:8123"
results, errors, reqs = [], [], []


def check(name, cond, extra=""):
    results.append((bool(cond), name, extra))


# peak amplitude on the master bus while one note sounds
MEASURE = """
async () => {
    const app = window.AhordianApp;
    const ctx = app.audioContext, bus = app.sessionManager.masterGain;
    const an = ctx.createAnalyser(); an.fftSize = 2048; bus.connect(an);
    const buf = new Float32Array(an.fftSize);
    let peak = 0;
    app.player.playNote('A3', 1.0);
    const t0 = performance.now();
    while (performance.now() - t0 < 700) {
        an.getFloatTimeDomainData(buf);
        for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > peak) peak = v; }
        await new Promise(r => setTimeout(r, 16));
    }
    bus.disconnect(an);
    return peak;
}
"""

# a cheap fingerprint of a decoded buffer, so "steel != nylon" is provable
FINGERPRINT = """
(key) => {
    const b = window.AhordianApp.sampleManager.getBuffer(key);
    if (!b) return null;
    const d = b.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < Math.min(d.length, 40000); i++) sum += Math.abs(d[i]);
    return {len: d.length, energy: Math.round(sum * 1000)};
}
"""

TONE_STATE = """
() => {
    const app = window.AhordianApp;
    const keys = [...app.sampleManager.buffers.keys()];
    return {
        tone: app.player.sampler.tone,
        steel: keys.filter(k => k.startsWith('guitar:steel:')).length,
        nylon: keys.filter(k => k.startsWith('guitar:nylon:')).length,
        stored: JSON.parse(localStorage.getItem('ahordian_settings') || '{}').guitarTone,
        mapSample: Object.values(app.player.sampler.sampleMap)[0]
    };
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True,
                                args=["--autoplay-policy=no-user-gesture-required"])
    page = browser.new_page(viewport={"width": 1500, "height": 1000})
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("response", lambda r: reqs.append((r.status, r.url)))

    page.goto(URL)
    page.wait_for_load_state("networkidle")
    page.evaluate("localStorage.removeItem('ahordian_settings')")
    page.reload()
    page.wait_for_load_state("networkidle")

    # ---- the select exists and is generated from GUITAR_TONES --------------
    opts = page.eval_on_selector_all("#setting-guitar-tone option",
                                     "els => els.map(e => e.value)")
    check("Guitar Tone select is populated", opts == ["steel", "nylon"], str(opts))
    check("select shows a non-blank default",
          page.input_value("#setting-guitar-tone") == "steel",
          page.input_value("#setting-guitar-tone"))

    # ---- default tone loads and sounds ------------------------------------
    page.locator(".nav-btn[data-target='fretboard-screen']").first.click()
    page.evaluate("window.AhordianApp.initAudioContext()")
    page.wait_for_timeout(3000)

    st = page.evaluate(TONE_STATE)
    check("default tone is steel", st["tone"] == "steel", str(st))
    check("19 steel buffers loaded", st["steel"] == 19, str(st))
    check("nylon is NOT fetched until asked for", st["nylon"] == 0, str(st))
    check("sampleMap points at the tone directory",
          "/guitar/steel/" in st["mapSample"], st["mapSample"])

    steel_peak = page.evaluate(MEASURE)
    check("steel tone is audible", steel_peak > 0.002, f"peak={steel_peak:.5f}")
    steel_fp = page.evaluate(FINGERPRINT, "guitar:steel:A3")
    check("steel A3 buffer decoded", steel_fp and steel_fp["len"] > 0, str(steel_fp))

    nylon_404s = [u for s, u in reqs if s >= 400 and "/nylon/" in u]
    check("no stale 404s for the unloaded pack", not nylon_404s, str(nylon_404s[:2]))

    # ---- switch to nylon via the real UI ----------------------------------
    page.wait_for_timeout(1500)
    # the select lives on settings-screen and Playwright will not drive a hidden
    # control, so navigate there first
    page.locator(".nav-btn[data-target='settings-screen']").first.click()
    page.wait_for_timeout(400)
    page.select_option("#setting-guitar-tone","nylon")
    page.locator("#save-settings-btn").click()
    page.wait_for_timeout(3500)

    st2 = page.evaluate(TONE_STATE)
    check("saving switches the active tone", st2["tone"] == "nylon", str(st2))
    check("19 nylon buffers loaded on demand", st2["nylon"] == 19, str(st2))
    check("steel buffers survive the switch (namespaced, not overwritten)",
          st2["steel"] == 19, str(st2))
    check("choice is persisted", st2["stored"] == "nylon", str(st2))
    check("sampleMap follows the switch",
          "/guitar/nylon/" in st2["mapSample"], st2["mapSample"])

    nylon_fp = page.evaluate(FINGERPRINT, "guitar:nylon:A3")
    check("nylon A3 buffer decoded", nylon_fp and nylon_fp["len"] > 0, str(nylon_fp))
    check("nylon is genuinely different audio from steel",
          nylon_fp and steel_fp and nylon_fp != steel_fp,
          f"steel={steel_fp} nylon={nylon_fp}")

    nylon_peak = page.evaluate(MEASURE)
    check("nylon tone is audible", nylon_peak > 0.002, f"peak={nylon_peak:.5f}")

    # the played buffer must be the nylon one, not a leftover steel buffer
    which = page.evaluate("""
        () => {
            const s = window.AhordianApp.player.sampler;
            const info = s.getBufferForNote('A3', 1.0);
            const nyl = window.AhordianApp.sampleManager.getBuffer('guitar:nylon:A3');
            return {isSynth: info.isSynth, isNylonBuffer: info.buffer === nyl,
                    rate: info.playbackRate};
        }""")
    check("getBufferForNote returns the nylon buffer for an exact match",
          which["isNylonBuffer"] and not which["isSynth"] and which["rate"] == 1.0,
          str(which))

    # a note with no exact sample must still pitch-shift within the active tone
    shifted = page.evaluate("""
        () => {
            const s = window.AhordianApp.player.sampler;
            const info = s.getBufferForNote('A#3', 1.0);
            const nylA = window.AhordianApp.sampleManager.getBuffer('guitar:nylon:A3');
            return {isSynth: info.isSynth, fromNylon: info.buffer === nylA,
                    rate: Number(info.playbackRate.toFixed(4))};
        }""")
    check("unsampled note pitch-shifts from a nylon neighbour, not the synth",
          shifted["fromNylon"] and not shifted["isSynth"] and 1.0 < shifted["rate"] < 1.1,
          str(shifted))

    # ---- persistence across a reload --------------------------------------
    page.reload()
    page.wait_for_load_state("networkidle")
    check("select reflects the saved tone after reload",
          page.input_value("#setting-guitar-tone") == "nylon",
          page.input_value("#setting-guitar-tone"))
    page.locator(".nav-btn[data-target='fretboard-screen']").first.click()
    page.evaluate("window.AhordianApp.initAudioContext()")
    page.wait_for_timeout(3000)
    st3 = page.evaluate(TONE_STATE)
    check("nylon is the tone loaded on a cold start", st3["tone"] == "nylon", str(st3))
    check("only the chosen pack is fetched on a cold start",
          st3["nylon"] == 19 and st3["steel"] == 0, str(st3))

    # ---- switching back is instant and refetch-free ------------------------
    before = len([u for s, u in reqs if "/guitar/steel/" in u])
    # the select lives on settings-screen and Playwright will not drive a hidden
    # control, so navigate there first
    page.locator(".nav-btn[data-target='settings-screen']").first.click()
    page.wait_for_timeout(400)
    page.select_option("#setting-guitar-tone","steel")
    page.locator("#save-settings-btn").click()
    page.wait_for_timeout(3000)
    st4 = page.evaluate(TONE_STATE)
    check("switching back works", st4["tone"] == "steel" and st4["steel"] == 19, str(st4))
    check("steel is fetched once per page, then cached",
          len([u for s, u in reqs if "/guitar/steel/" in u]) == before + 19,
          f"{before} -> {len([u for s, u in reqs if '/guitar/steel/' in u])}")

    real_errors = [e for e in errors if "404" not in e]
    check("no console errors", not real_errors, "; ".join(real_errors[:4]))
    page.locator(".nav-btn[data-target='home-screen']").first.click()
    page.wait_for_timeout(300)
    page.screenshot(path=str(SHOTS / "v_guitar_tone.png"), full_page=False)
    browser.close()

print()
for ok, name, extra in results:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}" + (f"   [{extra}]" if extra else ""))
passed = sum(1 for ok, _, _ in results if ok)
print(f"\n{passed} passed, {len(results) - passed} failed")
