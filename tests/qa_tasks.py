"""tasks.txt items 1 & 2:
  1. aggregate sample-loading state (one line, per-pack, no loader overwriting the other)
  2. drum fallback -- all five voices must actually produce sound, no orphan nodes
"""
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8123"
DRUMS = ["kick", "snare", "hihat", "hihat-open", "ride"]

results = []
errors = []


def check(name, cond, extra=""):
    results.append((bool(cond), name, extra))


# measures peak amplitude on the master bus while one drum voice fires
MEASURE = """
async (drumType) => {
    const app = window.AhordianApp;
    const ctx = app.audioContext;
    const bus = app.sessionManager.masterGain;
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    bus.connect(an);
    const buf = new Float32Array(an.fftSize);
    let peak = 0;
    app.drumSampler.scheduleDrumHit(drumType, ctx.currentTime + 0.02, 0.9);
    const t0 = performance.now();
    while (performance.now() - t0 < 700) {
        an.getFloatTimeDomainData(buf);
        for (let i = 0; i < buf.length; i++) {
            const v = Math.abs(buf[i]);
            if (v > peak) peak = v;
        }
        await new Promise(r => setTimeout(r, 16));
    }
    bus.disconnect(an);
    return peak;
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True,
                                args=["--autoplay-policy=no-user-gesture-required"])
    page = browser.new_page(viewport={"width": 1500, "height": 1000})
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

    page.goto(URL)
    page.wait_for_load_state("networkidle")

    # an AudioContext (and therefore sample loading) only exists after audio init
    page.locator(".nav-btn[data-target='fretboard-screen']").first.click()
    page.evaluate("window.AhordianApp.initAudioContext()")
    page.wait_for_timeout(2500)

    # --- item 1: aggregate status -------------------------------------------
    packs = page.eval_on_selector_all(
        "#sample-status-indicator .sample-pack",
        "els => els.map(e => ({text: e.innerText.trim(), incomplete: e.classList.contains('incomplete'), svg: !!e.querySelector('svg')}))")
    labels = " | ".join(x["text"] for x in packs)
    check("status line shows both packs", len(packs) == 2, labels)
    check("Guitar pack listed", any("Guitar" in x["text"] for x in packs), labels)
    check("Drums pack listed", any("Drums" in x["text"] for x in packs), labels)
    check("each pack has an svg mark", packs and all(x["svg"] for x in packs))
    check("indicator is visible", page.locator("#sample-status-indicator").is_visible())

    prog = page.evaluate("window.AhordianApp.sampleManager.getPackProgress()")
    by = {p["label"]: p for p in prog}
    check("guitar pack fully loaded", by.get("Guitar", {}).get("loaded") == by.get("Guitar", {}).get("total"),
          by.get("Guitar"))
    # the drum WAVs are user-supplied, so an incomplete drum pack must be *shown*,
    # not hidden behind the synth fallback
    drums = by.get("Drums", {})
    if drums.get("loaded", 0) < drums.get("total", 5):
        dpack = next((x for x in packs if "Drums" in x["text"]), None)
        check("incomplete drum pack flagged as incomplete", dpack and dpack["incomplete"], dpack)
        check("aggregate state is warn/error, not ok",
              page.eval_on_selector("#sample-status-indicator",
                                    "e => e.classList.contains('state-warn') || e.classList.contains('state-error')"))
        check("a fully-loaded guitar pack still reports 6/6 alongside it",
              by["Guitar"]["loaded"] == by["Guitar"]["total"])
    else:
        check("both packs complete -> state-ok",
              page.eval_on_selector("#sample-status-indicator", "e => e.classList.contains('state-ok')"))

    # --- item 2: every drum voice makes sound -------------------------------
    for d in DRUMS:
        peak = page.evaluate(MEASURE, d)
        check(f"{d} produces audible output", peak > 0.002, f"peak={peak:.5f}")

    # unknown voice: no throw, no orphaned oscillator left connected
    #
    # MEASURE only listens for 700 ms but the real ride sample rings for ~2 s, so
    # without this gap the "silent" reading is just the previous voice's tail.
    page.wait_for_timeout(2500)
    before = len(errors)
    silent = page.evaluate(MEASURE, "cowbell")
    check("unknown drum voice does not throw", len(errors) == before,
          errors[before:][:2])
    check("unknown drum voice stays silent (nodes torn down)", silent < 0.002, f"peak={silent:.5f}")

    check("no console errors beyond the known drum 404s",
          all("404" in e or "Error loading" in e for e in errors),
          [e for e in errors if "404" not in e and "Error loading" not in e][:5])

    page.screenshot(path="shot_topbar_status.png", clip={"x": 250, "y": 0, "width": 1250, "height": 46})
    browser.close()

print()
for ok, name, extra in results:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}" + (f"   [{extra}]" if extra else ""))
passed = sum(1 for ok, _, _ in results if ok)
print(f"\n{passed} passed, {len(results) - passed} failed")
