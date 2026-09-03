"""Circle-of-Fifths empty-state polish check: hint before a key is picked, real
metadata after, and no orphaned section headings in either state."""
from pathlib import Path
from playwright.sync_api import sync_playwright

# Screenshots live beside the suites, not in the CWD, so the run location is free.
SHOTS = Path(__file__).resolve().parent / "screenshots"
SHOTS.mkdir(exist_ok=True)

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


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True,
                          args=["--autoplay-policy=no-user-gesture-required"])
    page = b.new_page(viewport={"width": 1500, "height": 1000})
    page.goto(URL)
    page.wait_for_load_state("networkidle")
    page.click('.nav-btn[data-target="circle-screen"]')
    page.wait_for_timeout(600)

    hint = page.locator("#cof-empty-hint")
    meta = page.locator("#cof-key-meta")
    check("empty state: hint visible", hint.is_visible())
    check("empty state: metadata block hidden", not meta.is_visible())
    check("empty state: no orphaned 'Diatonic Triads' heading",
          not page.locator("#cof-diatonic-chords").is_visible())
    check("empty state: no orphaned 'Scale Boxes' heading",
          not page.locator("#cof-positions-section").is_visible())
    check("empty state: no bare '--' rendered",
          "--" not in page.locator("#circle-info-panel").inner_text())
    page.screenshot(path=str(SHOTS / "shot_cof_empty.png"))

    # Pick a key on the wheel.
    page.locator(".cof-segment").first.click()
    page.wait_for_timeout(900)

    check("after select: hint hidden", not hint.is_visible())
    check("after select: metadata block visible", meta.is_visible())
    check("after select: scale notes populated",
          page.locator("#cof-scale-notes .note-pill-btn").count() > 0,
          f"{page.locator('#cof-scale-notes .note-pill-btn').count()} pills")
    sig = page.locator("#cof-key-sig").inner_text()
    check("after select: key signature populated", "Signature" in sig, sig.replace("\n", " ")[:60])
    check("after select: relative key populated",
          "Relative" in page.locator("#cof-relative-minor").inner_text())
    check("after select: diatonic triads rendered",
          page.locator("#cof-diatonic-chords button").count() > 0,
          f"{page.locator('#cof-diatonic-chords button').count()} chords")
    check("after select: title is no longer 'Select a Key'",
          page.locator("#cof-key-title").inner_text().strip() != "Select a Key",
          page.locator("#cof-key-title").inner_text().strip())
    page.screenshot(path=str(SHOTS / "shot_cof_selected.png"))

    # Topbar metronome cluster: one row, grouped pill.
    mc = page.locator(".metronome-control")
    box = mc.bounding_box()
    tb = page.locator(".global-topbar").bounding_box()
    check("metronome cluster fits one topbar row", box["height"] < tb["height"],
          f"cluster {box['height']:.0f}px vs topbar {tb['height']:.0f}px")
    check("metronome cluster has grouped border",
          page.evaluate("getComputedStyle(document.querySelector('.metronome-control')).borderRadius") != "0px")
    check("bpm input is narrow, not full width",
          page.locator("#metronome-bpm").bounding_box()["width"] < 60,
          f"{page.locator('#metronome-bpm').bounding_box()['width']:.0f}px")

    # Nav glyphs must be distinct.
    fb = page.evaluate("document.querySelector('.nav-btn[data-target=\"fretboard-screen\"] svg').innerHTML")
    tp = page.evaluate("document.querySelector('.nav-btn[data-target=\"tab-player-screen\"] svg').innerHTML")
    se = page.evaluate("document.querySelector('.nav-btn[data-target=\"scale-explorer-screen\"] svg').innerHTML")
    check("fretboard and tab-player glyphs now differ", fb != tp)
    check("scale-explorer glyph is no longer the smiley", "M8 14s1.5 2 4 2 4-2 4-2" not in se)
    for t in ("fretboard-screen", "tab-player-screen", "scale-explorer-screen"):
        bx = page.locator(f'.nav-btn[data-target="{t}"] svg').bounding_box()
        check(f"{t} nav svg is 20px", abs(bx["height"] - 20) < 1, f"{bx['height']:.0f}px")

    print(f"\n{passed} passed, {failed} failed")
    b.close()
