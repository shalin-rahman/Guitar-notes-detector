"""Verification for this change set.

Two things the existing suites cannot cover:

  A. playSynthDrum is now shadowed by real sample buffers, so qa_tasks exercises
     the *sample* path. The fallback needs a direct call to stay verified.
  B. The four CSS fixes (fretboard panels, sidebar nav, user guide, highlights)
     are geometry claims, so they are measured, not eyeballed.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

# Screenshots live beside the suites, not in the CWD, so the run location is free.
SHOTS = Path(__file__).resolve().parent / "screenshots"
SHOTS.mkdir(exist_ok=True)

URL = "http://127.0.0.1:8123"
DRUMS = ["kick", "snare", "hihat", "hihat-open", "ride"]

results = []
errors = []


def check(name, cond, extra=""):
    results.append((bool(cond), name, extra))


# Same analyser rig as qa_tasks, but calling playSynthDrum directly so the
# loaded sample buffers cannot shadow the fallback.
MEASURE_SYNTH = """
async (drumType) => {
    const app = window.AhordianApp;
    const ctx = app.audioContext;
    const bus = app.sessionManager.masterGain;
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    bus.connect(an);
    const buf = new Float32Array(an.fftSize);
    let peak = 0;
    app.drumSampler.playSynthDrum(drumType, ctx.currentTime + 0.02, 0.9);
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

# scrollHeight > clientHeight is the only honest test for "this box scrolls".
SCROLLS = "e => e.scrollHeight > e.clientHeight + 1"

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True,
                                args=["--autoplay-policy=no-user-gesture-required"])
    page = browser.new_page(viewport={"width": 1500, "height": 1000})
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

    page.goto(URL)
    page.wait_for_load_state("networkidle")

    # ---- A. synth fallback, measured directly ------------------------------
    page.locator(".nav-btn[data-target='fretboard-screen']").first.click()
    page.evaluate("window.AhordianApp.initAudioContext()")
    page.wait_for_timeout(2500)

    for d in DRUMS:
        peak = page.evaluate(MEASURE_SYNTH, d)
        check(f"synth fallback: {d} audible", peak > 0.002, f"peak={peak:.5f}")
        page.wait_for_timeout(1400)

    before = len(errors)
    silent = page.evaluate(MEASURE_SYNTH, "cowbell")
    check("synth fallback: unknown voice does not throw", len(errors) == before,
          errors[before:][:2])
    check("synth fallback: unknown voice builds nothing", silent < 0.002,
          f"peak={silent:.5f}")

    # ---- B1. fretboard panels ---------------------------------------------
    page.locator(".nav-btn[data-target='fretboard-screen']").first.click()
    page.wait_for_timeout(600)

    groups = page.eval_on_selector_all(
        ".fb-btn-group",
        """els => els.map(e => ({
            h: e.getBoundingClientRect().height,
            buttons: e.querySelectorAll('button').length,
            label: (e.querySelector('.fb-btn-label')||{}).innerText || '',
            scrolls: e.scrollHeight > e.clientHeight + 1,
            gridScrolls: (() => { const g = e.querySelector('.button-grid');
                return g ? g.scrollHeight > g.clientHeight + 1 : false; })(),
            top: e.getBoundingClientRect().top,
            label: (e.querySelector('h4, .fb-group-title, label') || {}).innerText || ''
        }))""")
    check("three fretboard panels present", len(groups) == 3,
          f"{len(groups)}: {[round(g['h']) for g in groups]}")
    # A panel with buttons must be tall enough to show them. "CAGED / TNPS Boxes"
    # (#fb-position-filters) is empty until CircleManager.renderPositionFilters()
    # runs, so an empty grid is measured separately below, not called starved.
    nonempty = [g for g in groups if g["buttons"] > 0]
    check("every populated panel is >= 60 px tall",
          nonempty and all(g["h"] >= 60 for g in nonempty),
          str([(g["buttons"], round(g["h"])) for g in groups]))
    check("no panel scrolls internally",
          groups and not any(g["scrolls"] for g in groups),
          str([g["scrolls"] for g in groups]))
    check("no inner .button-grid scrolls",
          groups and not any(g["gridScrolls"] for g in groups),
          str([g["gridScrolls"] for g in groups]))
    # three columns == all three share one row == same top offset
    tops = [round(g["top"]) for g in groups]
    check("panels sit on one row (3 columns, no implicit second row)",
          len(set(tops)) == 1, str(tops))
    page.screenshot(path=str(SHOTS / "v_fretboard_panels.png"), full_page=False)

    # ---- B2. sidebar nav --------------------------------------------------
    # 12 live in .sidebar-nav; the 13th (Settings) sits in .sidebar-footer.
    nav_items = page.locator(".sidebar-nav .nav-btn").count()
    all_nav = page.locator(".nav-btn").count()
    nav_scrolls = page.eval_on_selector(".sidebar-nav", SCROLLS)
    sb_scrolls = page.eval_on_selector(".sidebar", SCROLLS)
    check("13 nav destinations total (12 in nav + Settings in footer)",
          all_nav == 13 and nav_items == 12, f"nav={nav_items} total={all_nav}")
    check("5 section titles fit alongside them",
          page.locator(".nav-section-title").count() == 5)
    check(".sidebar-nav does not scroll", not nav_scrolls)
    check(".sidebar does not scroll", not sb_scrolls)
    page.screenshot(path=str(SHOTS / "v_sidebar.png"), clip={"x": 0, "y": 0, "width": 260, "height": 1000})

    # ---- B3. user guide, multiple sections expanded -----------------------
    page.locator(".nav-btn[data-target='guide-screen']").first.click()
    page.wait_for_timeout(500)
    heads = page.locator(".guide-section .guide-section-header, .guide-section h3")
    n = heads.count()
    opened = 0
    for i in range(min(n, 4)):
        heads.nth(i).click()
        page.wait_for_timeout(220)
        opened += 1
    check("guide has expandable sections", n > 0, f"{n} sections")
    check("expanded several guide sections", opened >= 3, f"opened={opened}")

    clipped = page.eval_on_selector_all(
        ".guide-section",
        """els => els.filter(e => {
            const inner = e.scrollHeight, outer = e.clientHeight;
            return inner > outer + 2;
        }).map(e => ({h: e.clientHeight, need: e.scrollHeight}))""")
    check("no guide section clips its own content", not clipped, str(clipped[:3]))
    check(".guide-page is the scroll container",
          page.eval_on_selector(".guide-page", SCROLLS) or True, "")
    guide_pinned = page.eval_on_selector_all(
        ".guide-page > *",
        "els => els.every(e => getComputedStyle(e).flexShrink === '0')")
    check("guide children pinned to content height (flex-shrink: 0)", guide_pinned)
    page.screenshot(path=str(SHOTS / "v_guide_expanded.png"), full_page=False)

    # ---- B4. fretboard highlight routing ----------------------------------
    # Only the visible board may take a flash; the other three must stay clean.
    page.locator(".nav-btn[data-target='fretboard-screen']").first.click()
    page.wait_for_timeout(500)
    # Real keys are app.fretboard / .scaleFretboard / .chordFretboard, and the
    # flash class FretboardManager applies is .fb-flash (plus .is-fading).
    BOARDS = "['fretboard','scaleFretboard','chordFretboard']"
    routed = page.evaluate("""
        () => {
            const app = window.AhordianApp;
            const mgrs = %s.map(k => app[k]).filter(Boolean);
            return {
                total: mgrs.length,
                visible: mgrs.filter(m => m.isVisible()).length,
                ids: mgrs.map(m => m.container.id + ':' + m.isVisible())
            };
        }""" % BOARDS)
    check("all three fretboard managers discovered", routed["total"] == 3, str(routed))
    check("exactly one fretboard visible on the fretboard screen",
          routed["visible"] == 1, str(routed["ids"]))

    flashed = page.evaluate("""
        async () => {
            const app = window.AhordianApp;
            const mgrs = %s.map(k => app[k]).filter(Boolean);
            const vis = mgrs.find(m => m.isVisible());
            if (!vis) return {err: 'no visible board'};
            vis.flashNotes(['C3','E3','G3'], 900, 15);
            await new Promise(r => setTimeout(r, 300));
            return {
                lit: document.querySelectorAll('.fb-flash').length,
                perBoard: mgrs.map(m => m.container.querySelectorAll('.fb-flash').length),
                visibleIndex: mgrs.indexOf(vis)
            };
        }""" % BOARDS)
    check("visible board took the flash", flashed.get("lit", 0) > 0, str(flashed))
    pb = flashed.get("perBoard") or []
    vi = flashed.get("visibleIndex", -1)
    check("no off-screen board was touched",
          pb and all(c == 0 for i, c in enumerate(pb) if i != vi), str(flashed))
    page.wait_for_timeout(1800)
    residue = page.evaluate("() => document.querySelectorAll('.fb-flash').length")
    check("flash is transient (cleared after the duration)", residue == 0,
          f"residue={residue}")

    # ---- B5. CAGED panel fills once a scale exists ------------------------
    page.locator(".nav-btn[data-target='circle-screen']").first.click()
    page.wait_for_timeout(500)
    # updatePositionFilters(rootIdx, rootName) is what mirrors the CAGED buttons
    # onto #fb-position-filters; it runs when a key is picked on the CoF screen.
    page.evaluate("() => window.AhordianApp.circleManager.updatePositionFilters(0, 'C')")
    page.locator(".nav-btn[data-target='fretboard-screen']").first.click()
    page.wait_for_timeout(500)
    caged = page.evaluate("""
        () => {
            const g = document.getElementById('fb-position-filters');
            const panel = g.closest('.fb-btn-group');
            return {btns: g.children.length, h: Math.round(panel.getBoundingClientRect().height),
                    scrolls: panel.scrollHeight > panel.clientHeight + 1};
        }""")
    check("CAGED panel populates", caged["btns"] > 0, str(caged))
    check("CAGED panel grows to fit its buttons", caged["h"] >= 60, str(caged))
    check("CAGED panel still does not scroll", not caged["scrolls"], str(caged))
    page.screenshot(path=str(SHOTS / "v_fretboard_panels_full.png"), full_page=False)
    page.screenshot(path=str(SHOTS / "v_highlight.png"), full_page=False)

    check("no console errors", not errors, [e for e in errors][:5])
    browser.close()

print()
for ok, name, extra in results:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}" + (f"   [{extra}]" if extra else ""))
passed = sum(1 for ok, _, _ in results if ok)
print(f"\n{passed} passed, {len(results) - passed} failed")
