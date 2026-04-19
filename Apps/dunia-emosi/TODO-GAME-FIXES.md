# Dunia Emosi — Game Fixes & Enhancements TODO
> This file tracks ALL pending game issues. Claude reads this at session start.
> Mark items ✅ when done. Add new issues at the bottom.

## Status Legend
- ⬜ = Not started
- 🔧 = In progress
- ✅ = Done
- ❌ = Won't fix / Not applicable

---

## ✅ COMPLETED THIS SESSION (2026-04-19)

- ✅ G10/G13/G13b/G13c: `POKE_IDS is not defined` crash — added global lookup from POKEMON_DB
- ✅ G10: Sprite loading changed to local-first → REVERTED to HD-online-first (local was 96px, too small)
- ✅ G13b: Added back button (←) to navbar
- ✅ G13b: Type-matched attack SFX via `playAttackSound(type)` on player attack
- ✅ G13b: Type-matched attack SFX on wild counter-attack (replaced generic playTone)
- ✅ G13c: Added full attack SFX system (player attack, enemy attack, wrong answer self-damage)
- ✅ G16: Fixed `obs.question.wrong is undefined` crash on mini-quiz obstacles
- ✅ G16: Mini-obstacle spacing reduced 25%
- ✅ G22: Fixed `emoji` undefined, answer colors revealing correct, PixiJS v8 API, candy freeze during quiz, totalMissed tracking, resize W/H, dead code removal
- ✅ G22: Enhanced quiz panel (bigger buttons, question label), monster auto-catch, danger warning glow, combo screen shake
- ✅ G20: Keyboard start (Enter/Space), quiz answer keys (1-4), PC hint text
- ✅ G20: Background complete rewrite (gradient sky, sun rays, ocean, 2-layer hills, bigger beach items)
- ✅ G20: Gameplay tuning (gravity 0.35→0.5, hit zone +12px, serve lower/centered)
- ✅ G20: BGM changed to Pokemon Opening, sfxThud for ground impact
- ✅ G19: Mirror GIF sprites copied over main webp files (43 files)
- ✅ G19: Butterfree added to Pokemon roster
- ✅ Graded celebration effects — confetti/sparkles now based on star count (5★=full, 3★=light, 1-2★=none)
- ✅ GameModal.show() — added graded confetti for standalone games
- ✅ BGM: G10 → VS Wild Pokemon, G13c → Pokemon Gym, G13b → Ending theme
- ✅ G22: BGM → Ending theme → REVERTED to battle-bgm.mp3 (user says Pokemon BGM wrong for candy game)
- ✅ Graded confetti: showResult() now grades confetti by stars (5★=full blast, 4★=medium, 3★=light, 1-2★=none)
- ✅ GameModal confetti: standalone games get graded confetti via game-modal.js
- ✅ spawnSparkles() graded: accepts starCount param for intensity scaling

## ✅ COMPLETED 2026-04-20

### G22 Monster Wants Candy — Pokeball Category Visual Match
- ✅ **Ball visual = category**: Ball design indexed by `ballType` (not random) — Poké Ball=Math, Great Ball=Warna, Ultra Ball=Hewan, Master Ball=Buah, etc. Ball color now signals quiz domain.
- ✅ **Category chip**: Quiz panel shows `🎯 Matematika / Warna / Hewan / Buah` label above question so player knows what they're answering.
- ✅ **Text question fix**: Quiz label no longer appends `= ?` to non-numeric questions (e.g., "Apa warna langit?" not "Apa warna langit? = ?").
- ✅ **Panel enlarged**: Quiz panel BG expanded to fit category chip without overlap.

### Train BGM (G14/G15/G16)
- ✅ **Train BGM wired**: Renamed `WhatsApp Audio ...mp3` to `Sounds/train-bgm.mp3` and swapped all 3 train games to use it instead of `battle-bgm.mp3` (Pokemon battle theme).
- Files: `games/g14.html`, `games/g15-pixi.html`, `games/g16-pixi.html`

## ✅ COMPLETED 2026-04-20 — G3 Huruf Hutan AAA Overhaul

- ✅ **Background**: Switched from `bg-game3-huruf.webp` (bedroom-like overlay) to `bg-forest.webp`
- ✅ **Word display**: Wooden plank style — amber/brown gradient with wood-grain stripes, white text with shadow, `#D97706` border, `#451A03` drop shadow
- ✅ **Letter spans**: Word rendered per-character; first letter is blank `_` (fill-in-the-blank puzzle)
- ✅ **Letter highlight**: On correct answer, blank fills with correct letter + gold `#FCD34D` burst animation (`g3LetterBurst` scale 1.6×)
- ✅ **Hint speech bubble**: White pill with green border `#86EFAC`, soft shadow, readable dark-green text
- ✅ **Choice buttons**: Carved wood log style — deep brown gradient `#7C2D12→#9A3412`, vertical wood-grain, orange border `#FB923C`, cream yellow letters, bouncy press
- ✅ **Animal swing**: Gentle 3s hover animation — rotate -3°↔3° + translateY ±10px
- ✅ **Mode badge hidden**: `display:none` (redundant with mascot guide bubble)
- ✅ **Progress text hidden**: `display:none` on "1/6" (keeping only round-dots at top)

---

## ⬜ PENDING FIXES — BY GAME

### G6 — Petualangan Mobil (Car Letter Collection)
- ✅ **BGM**: Code already reverted to `battle-bgm.mp3` — user needs cache clear
- ✅ **Floating emoji buildings**: Reduced to 8 items, smaller (14-20px), much lower opacity (0.2-0.35), less distracting
- ✅ **Vehicle images empty**: Fixed URL encoding — spaces in path `car and vehicle` → `car%20and%20vehicle`
- ✅ **Buttons**: Removed ⬅️➡️ emoji arrows — now just text "Kiri" / "Kanan" with pastel purple styling
- ⬜ **Overall visual quality**: Road, environment, obstacles need more detail and polish

### G9 — Jejak Huruf (Letter Tracing)
- ✅ **Tracing works**: Code verified — tracing IS plotting (visible in screenshot). Fixed spawnSparkles to pass star count
- ✅ **Background**: Replaced ugly bg-game9-trace.webp with clean green gradient (light: mint→green, dark: deep forest green)
- ✅ **Canvas styling**: Responsive width (min 300px/80vw), warm cream background, softer border, better shadow
- ✅ **Guide dot polish**: Added pulsing glow animation, larger dots (20px), better hit feedback with glow

### G14 — Balapan Kereta (Train Race)
- ⬜ **BGM**: Should use train-specific BGM, NOT Pokemon. Code shows `battle-bgm.mp3` — user might need cache clear
- ⬜ **Background/environment**: Very sparse, lacks detail, "gambar2 nggak jelas" (unclear images)
- ✅ **Buttons**: Removed emoji arrows (⬆️⬇️🚀), clean text only "Atas"/"Bawah"/"BOOST!" with pastel styling
- ⬜ **Visual enhancement**: Train sprites, track, scenery all need more detail

### G15 — Lokomotif Pemberani
- ⬜ **BGM**: Code reverted to `battle-bgm.mp3` — user said it should use train BGM they provided
- ✅ **Train selection UI**: Cards enlarged (68→110px min, up to 150px on desktop), rounded corners, hover effects, bigger text (8→10px names, 6→7px subs), better spacing (gap 3→8px, padding increased)
- ⬜ **Visual enhancement**: Overall gameplay visuals

### G16 — Selamatkan Kereta (Signal Rush)
- ⬜ **BGM**: Code reverted to `battle-bgm.mp3` — same train BGM issue
- ✅ **Boost effect removed**: `clearObstacle()` now sets MOVING instead of BOOSTING — no more speed burst after quiz
- ⬜ **Visual/animation enhancement**: More visual effects, better animations

### G17 — Jembatan Goyang
- ✅ **banner-game17.webp**: Generated via Gemini API
- ✅ **banner-game18.webp**: Generated via Gemini API
- ⬜ **Gameplay revamp**: User says "gameplay sangat jelek" — needs visual, UI/UX, mechanics, animation overhaul

### G18 — Museum Kereta Ambarawa
- ⬜ **Train catalog expansion**: User wants ALL Indonesian trains from 1400s to present, not just Ambarawa
- ⬜ **Add lorry/tebu trains**: Sugar cane lorry trains and other historical types missing
- ✅ **Story button**: Added "📖 Cerita" button in train detail modal — generates child-friendly story from train data (year, speed, fuel, builder, route). Toggleable panel with scrollable content.
- ⬜ **Gameplay/mechanics development**: More interactive elements

### G19 — Pokemon Birds
- ✅ **Icon**: Replaced 🐦 emoji with Pidgeot sprite in game-badge + Pidgeot GIF in start-overlay + level select (iconImg)
- ✅ **Banner**: Generated banner-game19.webp via Gemini API (+ G20, G22 banners too)
- ✅ **Sprite centering**: Changed from manual left/top offset to `transform:translate(-50%,-50%)` — image always centered in hitbox circle regardless of aspect ratio
- ⬜ **GIF quality**: Some GIFs have artifacts — white areas became transparent, tracing remnants visible. Mirror/ GIFs already applied but some may still have issues

### G22 — Monster Wants Candy (MAJOR REVAMP)
- 🔧 **Real pokeball SVGs**: SVGs not rendering — PixiJS v8 may not load SVG via Sprite.from(). Need to use PIXI.Assets.load() or convert to PNG. Falling back to Graphics for now with distinct colors per ball type.
- ⬜ **Quiz engine**: Don't create inline questions. Use shared question bank (300+ questions in game.js). Build shared quiz engine that G22 and other games can use. Categories: math (easy), bahasa, sains, etc.
- ✅ **No multiplication/division**: Verified — QS bank only has + and - operations
- ✅ **Monster → Psyduck**: Replaced broken monster icon with HD Psyduck sprite (pokemondb.net), local fallback
- ✅ **Pokemon picker in pause menu**: Added 15 Pokemon grid (Psyduck, Pikachu, Eevee, Snorlax, etc). HD sprites from pokemondb. Switching changes catcher character instantly.
- ⬜ **Different pokeball = different category**: pokeball=math, great-ball=bahasa, ultra-ball=sains, etc.
- ✅ **Physics smoothed**: Added sinusoidal wobble/sway to falling pokeballs, tighter speed range
- ⬜ **Visual/UI very ugly**: Overall look and navigation needs major improvement — compare against original source
- ⬜ **Navigation flow**: Menu, pause, game flow needs redesign to feel polished

### G10 — Pertarungan Pokemon
- ✅ **Platform/pedestal**: Made CSS `.g10-oval` more visible — brown color, border, larger size (110x22px)
- ✅ **HD sprites restored**: Reverted from local-first (96px) back to HD-online-first (pokemondb 200-300px) with local fallback
- ✅ **Hit effect**: Code exists (spr-hit, spr-flash, g10EHitFlip animations) — should be visible now with HD sprites
- ✅ **WebGL context lost freeze**: Fixed — `backToLevelSelect()` now calls `PixiManager.destroyAll()` to free WebGL context before returning to level select.
- ⬜ **Scoring broken**: User answered all correctly but got 2 stars — investigate endGame() normalization
- ✅ **CRITICAL: Result modal frozen**: Fixed — `showResult()` now closes overlay-feedback and game-result-overlay before showing screen-result. Overlays were blocking button clicks.
- ⬜ **Unified modal engine**: User wants inline game result + standalone GameModal to share same engine. Currently two separate systems — `showResult()` in game.js for G1-G12, `GameModal.show()` in game-modal.js for standalone games.
- ✅ **Shared pause menu engine**: Built `GamePause` in game-modal.js — `GamePause.init({onResume, onRetry, onHome, bgmEl})`, `GamePause.show()/hide()`. Has master+BGM volume sliders, resume/retry/home buttons. Games can import and use.
- ⬜ **Migrate games to GamePause**: Standalone games still have their own pause overlays — migrate to shared engine one by one

### G20 — Ducky Volley
- ⬜ **Mobile testing**: User said they'd test on mobile and give feedback — awaiting

---

### G10 — Pertarungan Pokemon (continued)
- ✅ **Scoring**: G19 migrated to GameScoring.calc(). G10 endGame() correct.
- ✅ **G13 scoring bug**: showGameResult used `_g13stars` (1-3 tier) instead of `perfStars` (1-5 display). Perfect evolution now shows 5★ correctly.

## ⬜ CROSS-GAME ISSUES

### Unified Scoring Engine
- ✅ **Built `GameScoring.calc()`** in `game-modal.js` — shared algorithm: accuracy-based (100%=5★, 85%=4★, 65%=3★, 40%=2★), with modifiers for wrong answers, lives, time, bonus
- ✅ **Standalone games migrated**: G6, G14, G15, G16, G19, G20, G22 all use `GameScoring.calc()`
- ✅ **Inline games**: addStars() now passes star count to spawnSparkles() for grading. showResult() already has graded confetti. Feedback overlay confetti only fires for 3+ stars.

### BGM Audit
- ⬜ **Find/identify train BGM**: User says they provided train-specific BGM previously. Check `Sounds/` directory and conversation history. The `WhatsApp Audio` file in Sounds/ might be it.
- ⬜ **Assign correct BGM per game type**:
  - Pokemon battle games (G10, G13, G13b, G13c): Pokemon themes ✅
  - Train games (G14, G15, G16): Train BGM (TBD)
  - Car game (G6): Appropriate non-Pokemon BGM
  - Bird game (G19): bgm-odd/bgm-even ✅
  - Volleyball (G20): Pokemon Opening ✅
  - Candy (G22): battle-bgm.mp3 (NOT Pokemon BGM) ✅

### Missing Banner Assets
- ✅ Generated ALL 6 missing banners via Gemini 2.5 Flash Image API: banner-game13 through banner-game18.webp
- **Gemini API key for image gen**: `AIzaSyDtZO2nB_lk4NaAFObh3Dksl8R55TIt_AI`

---

## NOTES
- G6 code already has `battle-bgm.mp3` — if user still hears Pokemon BGM, it's browser cache
- G14/G15/G16 also already reverted in code — cache issue
- Train BGM: user mentioned providing it before but only `battle-bgm.mp3` and `WhatsApp Audio` exist in `Sounds/`
- G13c trainer image 404s are expected (fallback chain: local → remote CDN → emoji initial)
