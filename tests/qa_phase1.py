"""Phase 1 QA: audio exclusivity matrix, global controls, sample loading.
Drives the real UI controls (not internal APIs) wherever a control exists.
"""
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8123"
errors, requests_log = [], []
results = []


def check(name, cond, extra=""):
    results.append((bool(cond), name, extra))


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True,
                                args=["--autoplay-policy=no-user-gesture-required"])
    page = browser.new_page()
    page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("response", lambda r: requests_log.append((r.status, r.url)))

    page.goto(URL)
    page.wait_for_load_state("networkidle")
    page.evaluate("window.app = window.AhordianApp")

    def nav(screen):
        page.locator(f".nav-btn[data-target='{screen}']").first.click()
        page.wait_for_timeout(120)

    def playing():
        """What is actually producing sound right now, per engine state."""
        return page.evaluate("""() => ({
            metronome: !!(window.app.metronome && window.app.metronome.isPlaying),
            jam:       !!(window.app.backingEngine && window.app.backingEngine.isPlaying),
            tab:       !!(window.app.tabPlayer && window.app.tabPlayer.isPlaying),
            ear:       !!(window.app.earTraining && window.app.earTraining.isActive),
            replay:    !!window.app.isReplaying,
            sessions:  Array.from(window.app.sessionManager ? window.app.sessionManager.activeSessions : []).map(s=>s.id)
        })""")

    def start_jam():
        nav("fretboard-screen")
        # If a previous sweep left Play disabled that is itself a bug (asserted
        # separately); force the UI back so the rest of the matrix can still run.
        if page.locator("#jam-play-btn").is_disabled():
            page.evaluate("window.app.stopJam && window.app.stopJam()")
        page.locator("#jam-play-btn").click()
        page.wait_for_timeout(400)

    def start_metronome():
        page.evaluate("window.app.initAudioContext(); window.app.metronome.initAudio(window.app.sessionManager); window.app.metronome.start()")
        page.wait_for_timeout(200)

    def start_tab():
        nav("tab-player-screen")
        page.locator("#tab-play-btn").click()
        page.wait_for_timeout(400)

    def start_ear():
        nav("ear-training-screen")
        page.locator("#ear-start-btn").click()
        page.wait_for_timeout(400)

    def start_replay():
        page.evaluate("""
            const now = performance.now();
            window.app.detectionHistory = [{note:'C4',t:now},{note:'E4',t:now+200},
                                           {note:'G4',t:now+400},{note:'C5',t:now+600}];
            void window.app.replayDetection();
        """)
        page.wait_for_timeout(200)

    # ---------------- SAMPLES ----------------
    page.evaluate("window.app.initAudioContext()")
    page.wait_for_timeout(1800)
    audio = [(s, u) for s, u in requests_log if "/audio/" in u]
    guitar = {u.rsplit("/", 1)[-1]: s for s, u in audio if "/guitar/" in u}
    drums = {u.rsplit("/", 1)[-1]: s for s, u in audio if "/drums/" in u}
    print(f"  info  guitar requests = {guitar}")
    print(f"  info  drum requests   = {drums}")
    # 19, not 6: the pack went from one sample per open string to roughly every
    # 3 semitones (GUITAR_NOTES in app/download_samples.py).
    check("all 19 guitar samples return 200",
          len(guitar) == 19 and all(s == 200 for s in guitar.values()), str(guitar))
    check("all 5 drum samples return 200",
          len(drums) == 5 and all(s == 200 for s in drums.values()), str(drums))
    check("no unexpected non-audio 404s",
          not [u for s, u in requests_log if s >= 400 and "/audio/" not in u],
          str([u for s, u in requests_log if s >= 400 and "/audio/" not in u][:3]))
    check("loading indicator resolved to a terminal state",
          page.evaluate("window.app.sampleManager.status") in ("ready", "partial", "error"),
          page.evaluate("window.app.sampleManager.status"))
    check("synth fallback wired in for missing samples",
          page.evaluate("typeof window.app.player.sampler.fallbackSynth.noteToFreq === 'function'"))
    check("drum synth fallback produces a hit without sample buffers",
          page.evaluate("""() => { try { window.app.drumSampler.scheduleDrumHit(
              'kick', window.app.audioContext.currentTime + 0.05, 0.5); return true; }
              catch (e) { return String(e); } }""") is True)

    # ---------------- EXCLUSIVITY MATRIX ----------------
    matrix = [
        ("Jam then Metronome stops Jam", start_jam, start_metronome, "jam", "metronome"),
        ("Metronome then Jam stops Metronome", start_metronome, start_jam, "metronome", "jam"),
        ("Jam then Ear Training stops Jam", start_jam, start_ear, "jam", "ear"),
        ("Ear Training then Jam stops Ear Training", start_ear, start_jam, "ear", "jam"),
        ("Tab then Jam stops Tab", start_tab, start_jam, "tab", "jam"),
        ("Jam then Tab stops Jam", start_jam, start_tab, "jam", "tab"),
        ("Replay then Jam stops Replay", start_replay, start_jam, "replay", "jam"),
    ]
    for name, first, second, loser, winner in matrix:
        page.evaluate("window.app.sessionManager && window.app.sessionManager.stopAll()")
        page.wait_for_timeout(150)
        first()
        before = playing()
        if not before[loser]:
            check(name, False, f"precondition failed: {loser} never started ({before})")
            continue
        second()
        after = playing()
        if not after[winner]:
            check(name, False, f"{winner} did not start ({after})")
            continue
        check(name, after[loser] is False, f"{loser} still playing; sessions={after['sessions']}")
        check(f"  -> exactly one session active after '{name}'",
              len(after["sessions"]) == 1, str(after["sessions"]))

    # ---------------- UI STATE FOLLOWS THE SWEEP ----------------
    # When another feature steals the session, the loser's own screen controls must
    # return to the idle state or the user is locked out of restarting it.
    page.evaluate("window.app.sessionManager.stopAll()")
    start_jam()
    start_metronome()
    nav("fretboard-screen")
    check("Jam Play re-enabled after the session was stolen",
          not page.locator("#jam-play-btn").is_disabled())
    check("Jam Stop disabled after the session was stolen",
          page.locator("#jam-stop-btn").is_disabled())
    check("live chord indicator hidden after the session was stolen",
          not page.locator("#live-chord-indicator").is_visible())

    page.evaluate("window.app.sessionManager.stopAll()")
    start_tab()
    start_jam()
    nav("tab-player-screen")
    check("Tab Play re-enabled after the session was stolen",
          not page.locator("#tab-play-btn").is_disabled())

    # ---------------- NAVIGATION STOPS EVERYTHING ----------------
    page.evaluate("window.app.sessionManager.stopAll()")
    start_jam()
    check("precondition: jam running before navigation", playing()["jam"])
    nav("home-screen")
    after = playing()
    check("navigation stops all audio",
          not any([after["metronome"], after["jam"], after["tab"], after["ear"], after["replay"]]), str(after))
    check("navigation leaves no orphaned session", after["sessions"] == [], str(after["sessions"]))

    # scale/pattern demo must also be cancelled by navigation (was orphaned before)
    nav("tools-screen")
    page.evaluate("void window.app.playSequence(['C4','D4','E4','F4','G4','A4','B4','C5'], 400)")
    page.wait_for_timeout(500)
    check("precondition: sequence session active",
          "note-preview" in playing()["sessions"], str(playing()["sessions"]))
    nav("home-screen")
    page.wait_for_timeout(200)
    check("navigation cancels scale/pattern playback",
          page.evaluate("window.app.sequenceAbortFlag === true") and playing()["sessions"] == [],
          str(playing()["sessions"]))

    # a note preview must NOT kill the jam track (soloing over the backing track)
    page.evaluate("window.app.sessionManager.stopAll()")
    start_jam()
    page.evaluate("window.app.triggerFretboardNote('A4')")
    page.wait_for_timeout(150)
    check("single note preview does NOT stop the jam track", playing()["jam"])

    # ---------------- GLOBAL CONTROLS ----------------
    def master_gain():
        return page.evaluate("window.app.sessionManager.masterGain.gain.value")

    page.locator("#master-volume").fill("0.7")
    page.locator("#master-volume").dispatch_event("input")
    page.wait_for_timeout(100)
    check("master volume slider changes master gain", abs(master_gain() - 0.7) < 0.01, str(master_gain()))

    page.locator("#global-mute-btn").click()
    page.wait_for_timeout(100)
    check("mute silences the master bus", master_gain() == 0, str(master_gain()))
    check("mute is reflected in state", page.evaluate("window.app.sessionManager.isMuted === true"))

    # changing volume while muted must not un-mute, but must be remembered
    page.locator("#master-volume").fill("0.45")
    page.locator("#master-volume").dispatch_event("input")
    page.wait_for_timeout(100)
    check("still silent after volume change while muted", master_gain() == 0, str(master_gain()))

    page.locator("#global-mute-btn").click()
    page.wait_for_timeout(100)
    check("unmute restores the volume chosen while muted",
          abs(master_gain() - 0.45) < 0.01, str(master_gain()))

    # ---------------- NOW PLAYING PILL ----------------
    page.evaluate("window.app.sessionManager.stopAll()")
    page.wait_for_timeout(150)
    pill_visible = "page.evaluate(...)"
    def pill():
        return page.evaluate("""() => {
            const el = document.getElementById('now-playing-pill');
            const label = document.getElementById('now-playing-label');
            return { shown: !!el && getComputedStyle(el).display !== 'none',
                     text: label ? label.textContent.trim() : null };
        }""")
    check("Now Playing hidden when nothing is playing", not pill()["shown"], str(pill()))
    start_jam()
    check("Now Playing shown during jam", pill()["shown"], str(pill()))
    check("Now Playing names the source", "Jam" in (pill()["text"] or ""), str(pill()))
    nav("home-screen")
    page.wait_for_timeout(150)
    check("Now Playing hidden again after navigation", not pill()["shown"], str(pill()))

    # goto jumps to the owning screen — from a *different* screen, and without
    # silencing the session it points at.
    nav("tools-screen")
    start_metronome()
    page.wait_for_timeout(150)
    check("Now Playing shown during metronome", pill()["shown"], str(pill()))
    page.locator("#now-playing-goto").click()
    page.wait_for_timeout(200)
    active = page.evaluate("document.querySelector('.screen.active').id")
    check("Now Playing goto navigates to the owning screen", active == "home-screen", active)
    check("Now Playing goto does NOT stop the session it points at",
          playing()["metronome"], str(playing()))
    check("Now Playing pill still shown after goto", pill()["shown"], str(pill()))
    page.evaluate("window.app.sessionManager.stopAll()")

    real_errors = [e for e in errors if "404" not in e]
    check("no console errors beyond the known drum 404s", not real_errors, "; ".join(real_errors[:5]))

    browser.close()

print()
for ok, name, extra in results:
    print(("  ok   " if ok else "  FAIL ") + name + (f"   [{extra}]" if extra and not ok else ""))
fails = sum(1 for ok, _, _ in results if not ok)
print(f"\n{len(results)-fails} passed, {fails} failed")
for e in dict.fromkeys(errors):
    print("  console: " + e)
