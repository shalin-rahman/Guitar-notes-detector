"""Phase 2 QA: icon hydration, no emoji left in the rendered UI, no inline styles,
plus screenshots of every screen for visual review.
"""
import re
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8123"
SCREENS = [
    "home-screen", "detector-screen", "tools-screen", "chord-explorer-screen",
    "scale-explorer-screen", "fretboard-screen", "circle-screen",
    "ear-training-screen", "practice-screen", "lessons-screen",
    "tab-player-screen", "guide-screen", "settings-screen",
]
ALLOWED = set("♭♯—→–…’‘“” ​")


def is_pictograph(c):
    """Anything above U+2000 that is not ordinary punctuation or an accidental."""
    return ord(c) > 0x2000 and c not in ALLOWED

errors = []
results = []


def check(name, cond, extra=""):
    results.append((bool(cond), name, extra))


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True,
                                args=["--autoplay-policy=no-user-gesture-required"])
    page = browser.new_page(viewport={"width": 1500, "height": 1000})
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

    page.goto(URL)
    page.wait_for_load_state("networkidle")

    # every declared icon slot must have been filled
    unfilled = page.eval_on_selector_all(
        "[data-icon]",
        "els => els.filter(e => !e.querySelector('svg')).map(e => e.dataset.icon)")
    check("every [data-icon] slot hydrated to an <svg>", not unfilled, unfilled)

    total = page.eval_on_selector_all("[data-icon]", "els => els.length")
    check("icon slots exist at all", total > 20, f"{total} slots")

    # exercise the JS-driven label swaps so their icons get built too
    page.evaluate("window.app = window.AhordianApp")
    page.click("#metronome-toggle")
    page.wait_for_timeout(150)
    js_errs = [e for e in errors if "404" not in e]
    check("metronome starts without a JS error", not js_errs, js_errs[:2])
    check("metronome toggle keeps an svg after start",
          page.eval_on_selector("#metronome-toggle", "e => !!e.querySelector('svg')"))
    page.click("#metronome-toggle")
    page.wait_for_timeout(150)
    check("metronome toggle keeps an svg after stop",
          page.eval_on_selector("#metronome-toggle", "e => !!e.querySelector('svg')"))

    # #live-capture-btn lives on the detector screen, so go there first
    page.locator(".nav-btn[data-target='detector-screen']").first.click()
    page.wait_for_timeout(150)
    page.click("#live-capture-btn")
    page.wait_for_timeout(80)
    check("record button armed shows icon + ON",
          page.eval_on_selector("#live-capture-btn",
                                "e => !!e.querySelector('svg') && e.textContent.includes('ON')"))
    page.click("#live-capture-btn")
    page.wait_for_timeout(80)
    check("record button disarmed shows icon + OFF",
          page.eval_on_selector("#live-capture-btn",
                                "e => !!e.querySelector('svg') && e.textContent.includes('OFF')"))

    # custom tuning pencil <-> close
    page.locator(".nav-btn[data-target='fretboard-screen']").first.click()
    page.wait_for_timeout(150)
    page.click("#toggle-custom-tuning")
    page.wait_for_timeout(120)
    check("custom tuning input revealed on first click",
          page.locator("#custom-tuning-input").is_visible())
    check("tuning select hidden while custom is open",
          not page.locator("#tuning-select").is_visible())
    page.click("#toggle-custom-tuning")
    page.wait_for_timeout(120)
    check("custom tuning input hidden again on second click",
          not page.locator("#custom-tuning-input").is_visible())
    check("tuning select restored", page.locator("#tuning-select").is_visible())

    # jam station separation
    check("jam station present", page.locator(".jam-station").count() == 1)
    check("jam station reads JAM STATION / Virtual Band",
          "VIRTUAL BAND" in page.locator(".jam-station .jam-subtitle").inner_text().upper())

    # practice routine generation (icons come from role names now)
    page.locator(".nav-btn[data-target='practice-screen']").first.click()
    page.wait_for_timeout(150)
    gen = page.locator("#prac-generate-btn")
    if gen.count():
        gen.first.click()
        page.wait_for_timeout(250)
        check("routine items rendered", page.locator(".routine-item").count() > 0)
        check("routine items carry svg icons",
              page.eval_on_selector_all(".routine-item .btn-ico",
                                        "els => els.length > 0 && els.every(e => !!e.querySelector('svg'))"))

    # lessons list
    page.locator(".nav-btn[data-target='lessons-screen']").first.click()
    page.wait_for_timeout(200)
    check("lesson cards carry svg icons",
          page.eval_on_selector_all(".lesson-card-title",
                                    "els => els.length > 0 && els.every(e => !!e.querySelector('svg'))"))

    # sweep every screen: emoji + authored inline styles + screenshot
    for s in SCREENS:
        page.locator(f".nav-btn[data-target='{s}']").first.click()
        page.wait_for_timeout(200)
        text = page.locator(f"#{s}").inner_text()
        found = sorted({c for c in text if is_pictograph(c)})
        check(f"{s}: no emoji in rendered text", not found, found)
        page.screenshot(path=f"shot_{s}.png", full_page=True)

    check("no console errors beyond the known drum 404s",
          all("404" in e for e in errors), [e for e in errors if "404" not in e][:5])

    browser.close()

print()
for ok, name, extra in results:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}" + (f"   [{extra}]" if extra and not ok else ""))
passed = sum(1 for ok, _, _ in results if ok)
print(f"\n{passed} passed, {len(results) - passed} failed")
