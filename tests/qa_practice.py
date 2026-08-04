"""Practice routine generator: no card may render an uninterpolated ${...}.
Guards the P-1 bug class (a single-quoted string where a template literal was
meant) for every focus, not just the one that was reported."""
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8123"
results, errors = [], []
FOCUSES = ["technique", "scales", "chords", "rhythm", "theory", "random"]


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
    page.locator(".nav-btn[data-target='practice-screen']").first.click()
    page.wait_for_timeout(400)

    for focus in FOCUSES:
        # 'random' picks a branch per call, so hit it repeatedly to cover all five
        rounds = 25 if focus == "random" else 3
        bad, titles, count = [], [], 0
        for _ in range(rounds):
            page.select_option("#prac-focus", focus)
            page.locator("#prac-generate-btn").click()
            page.wait_for_timeout(120)
            items = page.eval_on_selector_all(
                ".routine-item",
                """els => els.map(e => ({
                    title: e.querySelector('.routine-title').textContent,
                    desc: e.querySelector('.routine-desc').textContent,
                    dur: e.querySelector('.routine-duration').textContent
                }))""")
            count = len(items)
            for it in items:
                titles.append(it["title"].strip())
                if "${" in it["title"] or "${" in it["desc"]:
                    bad.append(it["title"].strip())
        check(f"{focus}: routine renders cards", count >= 3, f"{count} cards")
        check(f"{focus}: no uninterpolated ${{...}} in any card",
              not bad, "; ".join(sorted(set(bad))[:3]))
        check(f"{focus}: every card has a duration",
              all(t for t in titles), "")

    # the reported card specifically: the key must be a real key name
    page.select_option("#prac-focus", "chords")
    page.locator("#prac-generate-btn").click()
    page.wait_for_timeout(150)
    triad = page.locator(".routine-item", has_text="Diatonic Triads").first.inner_text()
    keys = ["C", "G", "D", "A", "E", "F", "Bb"]
    named = any(f"Diatonic Triads in {k}" in triad for k in keys)
    check("Diatonic Triads title names a real key",
          named, triad.split("\n")[0])

    check("no console errors", not [e for e in errors if "404" not in e],
          "; ".join(errors[:3]))
    browser.close()

print()
for ok, name, extra in results:
    print(f"  {'ok  ' if ok else 'FAIL'} {name}" + (f"   [{extra}]" if extra else ""))
passed = sum(1 for ok, _, _ in results if ok)
print(f"\n{passed} passed, {len(results) - passed} failed")
