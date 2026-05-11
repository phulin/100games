# 100 Game Ideas

Each entry is a small, self-contained React component for a gallery. Backend (SQLite) is used only where genuinely useful — shared worlds, daily seeds, async social play. Every game answers two questions: *what do you do each second*, and *how do you win or score*.

---

## 1. Echo Maze
Top-down dark maze. You see only a small radius around your dot. Click anywhere to emit a sonar ping that briefly lights walls in expanding rings — but enemies hear it and orient toward the source. Reach the exit in as few pings as possible. The whole tension is *when to be loud*.

## 2. Anagram Tower
Letters fall Tetris-style. You can't rotate or move tiles — instead you type a word from any letters currently on screen and those letters dissolve. Rare letters score more; height keeps growing. Two pressures: keep the stack low *and* hunt for long words.

## 3. Tide Garden
A shoreline. Waves come on a steady beat. Between waves you plant seeds in wet sand; the next wave either feeds them or washes them away depending on plant type and tide line. Tide drifts unpredictably across a session. Grow a garden across 30 wave cycles.

## 4. Liar's Compass
Four NPCs each point a direction and claim that's where treasure is. Exactly one is honest. Each has a public bias ("lies on odd rounds", "always lies about east"). You get 10 rounds, then must point to a single grid square. Daily puzzle.

## 5. Whisper Chain
You see a sentence for 5 seconds, then type what you remember. Your version becomes the next player's prompt (pulled from SQLite). You can scroll the chain that led to your sentence. Async telephone game with a global, persistent transcript.

## 6. The Cartographer's Doubt
Partial hand-drawn map plus a stack of conflicting explorer reports ("two days west of the river, a hill"). You annotate the map with what you believe is true. Solved when your annotations match the hidden ground truth. Daily seed.

## 7. Reverberation
A circular music timeline plays continuously. Place tone-pegs on it. Each peg also triggers a configurable delayed echo. Match a target melody using as few pegs as possible by exploiting echoes to "buy" extra notes cheap.

## 8. Mimic Bird
A bird sings a 4-note phrase. You repeat it on a pitch keyboard. Then the bird sings *your* phrase back with one note changed; you must spot the swap. Alternates between mimicry and detection. Pure ear training as game.

## 9. Frostline
A river freezes across the screen in real time. Skate your path before the ice fully forms. Cross a too-thin section and you fall through. Plan around obstacle islands under a moving deadline.

## 10. Borrowed Time
A platformer-puzzle campaign where each level has a tight time budget — but you can borrow seconds from any *future* level. Borrowed time shows as a debt counter. Reach the finale without paying it off, you lose. Forces planning the entire run as one budget.

## 11. The Forger
Three "real" paintings, then a forgery of one with subtle changes. Identify the original *and* mark every change. Procedurally mutated gen-art originals. Attention-to-detail under time.

## 12. The Pilgrim
A side-scrolling endless walk. The only mechanic: stop. Stop at the right moments (shrines, sunsets, strange trees) to gain reverence. Stop wrong or too often and you lose energy. Pacing is the whole game.

## 13. Ghost Run
A platformer raced against your previous run, which started one second earlier. Catch up to beat it; your new winning run becomes the next ghost. Self-replacing speedrun.

## 14. Heat Map
A city grid. Each turn a new hot cell appears and heat spreads to neighbors. Drop a limited supply of cooling tokens to keep total heat below a threshold. Containment under real-time pressure.

## 15. The Locksmith's Apprentice
You see a lock's internal pins from the side. Outside, a partially cut key. Finish cutting by filing the key (mouse drag); each pin clicks down when its notch is right. Real lockpicking mechanics, abstracted.

## 16. Stone Soup
A pot and thirty ingredients. Each has hidden properties revealed only by adding it and reading the tasting note. Match a target dish. You can only *add* — never remove. A puzzle of irreversibility.

## 17. Constellation
Stars on a black field. Connect them into a shape, then name it. Future players see your constellation+name and vote whether the name fits. Score by community fit. SQLite stores all constellations.

## 18. Wavelength
A horizontal slider hides a target value on a spectrum (e.g., "cold ↔ hot"). Another player's clue word is shown. Move the slider to where you think their clue points. Clue pool is mined from past players.

## 19. The Auctioneer
Three items with hidden true values. Three NPC bidders bid against you; their behavior is visible from prior rounds and you can profile them. Win each item below its true value. Psychology + estimation.

## 20. Snowflake Lab
Design a snowflake by setting growth parameters at each branching step. It renders symmetrically. Novelty score: too similar to past flakes in SQLite scores lower. Forces creative deviation.

## 21. Backwards Chess
Standard chessboard. Shown an endgame position; un-play it back to a legal opening using only valid reverse moves. Curated endgames. A real-chess thinking exercise.

## 22. Frequency Hunt
A radio dial. Turning it fades signals in and out — each signal a short audio clue. Tune to find all clues, then answer a question that combines them. Spatial exploration on a one-dimensional dial.

## 23. Wordweaver
Each turn you're given a letter. Add it to either end of your current word. It must remain a valid English word at every step. How long can you grow it? Dictionary as terrain.

## 24. Pebble Pond
Drop pebbles in a still pond. Each makes ripples that reflect off the shore. Goal: produce an interference pattern that rings target lily pads in a specified order. Wave physics puzzle.

## 25. Heir Apparent
A throne room and five potential heirs with mostly-hidden traits. Each round an event tests one trait; you choose who to send. Outcomes reveal traits. After ten rounds you crown one — score based on suitability for a final secret challenge.

## 26. Tower of Tongues
A staircase of tiles, each labeled in a different language. Step up by matching meaning. Each language's stairs use cognates and shared patterns so you can *learn to read* it by climbing. The puzzle teaches.

## 27. Vault Cracker
A four-number combination dial. As you turn, the vault makes clicks and resistance shifts subtly near the right number. Pure audio-feedback puzzle, no visual hints.

## 28. Migration
You lead a small flock across a procedural continent. Rest stops have limited food and safety; weather closes routes. Optimize path over a fixed number of days. New seed daily.

## 29. The Negotiator
You and an AI split a pile of resources via alternating offers. The AI has visible preferences (loves apples, hates pears) and a hidden patience meter. Maximize your value while keeping their acceptance. Game theory in miniature.

## 30. Refraction
Light enters from one edge. Place prisms, lenses, and mirrors to split, redirect, and recombine it so each colored beam hits the matching target. Full-spectrum optics puzzle.

## 31. Found Footage
A short looped video clip. Five subtle anomalies are layered onto stock footage. Click to mark each. Procedurally generated mutations. Pure observation game.

## 32. Toll Road
A grid where you place roads and set per-road tolls. Each turn an NPC car wants to cross from A to B and takes the cheapest route. Maximize revenue across many turns. Think like a traffic engineer.

## 33. Origami
A flat sheet seen from above. Drag fold lines (valley or mountain); the sheet renders in 3D as it folds. Goal: match a target silhouette in as few folds as possible.

## 34. The Glitch
A normal-looking grid puzzle (sudoku-like). One cell is silently misbehaving. Surface puzzle is straightforward — the real game is diagnosing *which cell is corrupted and how*.

## 35. Witness Box
Three witnesses give overlapping, partially conflicting statements about an incident. Drag statement-fragments into a single coherent timeline. Some fragments are wrong; flag them. Procedural scripts.

## 36. Cairn
Stack ten uneven stones. Physics simulates each placement. The whole tower must hold for three seconds at the end. A pure tactile spatial game.

## 37. Lullaby
A baby cries on screen. You play notes on a small keyboard. Certain note sequences soothe, others provoke. Each baby has slightly different preferences you learn empirically. Ear training as cozy gameplay.

## 38. Inkblot
You see a procedural inkblot. Type a one-word interpretation. Then you see a word cloud of past players' words. Score double-peaks: being either the *most common* response or a *uniquely apt* one (judged by re-vote).

## 39. The Cartomancer
A five-card spread of symbolic cards is drawn. You write a short "fortune" interpreting it. Future players draw spreads and vote on the most fitting fortune from the archive. The game is reading and writing.

## 40. Switchboard
A 1940s telephone operator's board. Subscribers' names and line numbers flash at the start. Calls come in by name; plug the right line under time pressure. Memory under load.

## 41. The Slow Race
A race in which the *slowest* car wins — but you can't fully stop, and downhill stretches force acceleration. Multiple tracks. The art of barely moving.

## 42. Anti-Match
A queue of incoming colored marbles, one at a time. Place each into one of five columns. Three-in-a-row of any color = penalty. Plan ahead. Reverse match-3.

## 43. Lighthouse
A coastline. Ships approach at night from different angles. Aim the lighthouse's rotating beam to warn them off rocks. Beam has finite width; multiple ships at once. Triage under rotation.

## 44. Cuneiform
A clay tablet with unknown symbols. A glossary unlocks one symbol per inference. Symbols are procedurally generated with consistent grammar; you build a personal dictionary across a session. Code-cracking via linguistics.

## 45. Static Symphony
A 4-bar loop plays continuously. Toggle cells on a grid; each "on" cell plays a note at its time/pitch. Match a target audio loop by ear. No staff notation, only listening.

## 46. The Sluice
A river splits at multiple gates. Set gate angles. Water carries logs to downstream mills. Each mill needs a target volume of water *and* a target log count. Two-resource fluid routing.

## 47. The Inheritance
You're a will-executor. Eight heirs, mostly-hidden traits, and a vague written wish ("the kind one gets the cottage"). Watch heirs interact across five in-game days, then allocate. Social deduction with ambiguity.

## 48. Catch the Idiom
A literal scene plays out (a bucket gets kicked; someone spills the beans). Type the idiom. Time pressure, growing absurdity.

## 49. Press Conference
You're a reporter. The politician answers your questions but only reveals hidden facts when questions are sequenced correctly — each answer unlocks topics for the next. Limited time. Investigative dialogue puzzle.

## 50. Magnetic Poetry
A pool of word tiles. Drag them onto a fridge to form a short poem on today's theme. Community votes pick the day's winners. SQLite stores all poems.

## 51. The Lost Letter
A handwritten letter with some words smudged. Letter-bit fragments and length are visible; context fills in the rest. Vocabulary + reading game.

## 52. Hex Wars
A small hex map. You and an AI place pieces alternately. Adjacent pieces auto-resolve; the side with more surrounding hexes wins. Games last about 10 moves with surprisingly deep tactics.

## 53. The Lottery
A village of named villagers. Each round you award tickets; one wins a prize. Villagers remember favoritism and their actions next round reflect it. Optimize total village happiness over 30 rounds.

## 54. Tetrahedron
Four 3D puzzle pieces. Rotate each with the mouse. Only specific orientations fit together into a tetrahedron. Real spatial reasoning, no tricks.

## 55. Spell Check
A short paragraph with a mix of subtle misspellings *and* deliberate archaic-but-correct spellings. Mark only the wrong ones. Confidence as much as knowledge.

## 56. The Roost
A dovecote. Each day six birds return and pick perches. Over a week, patterns emerge — same bird tends to the same perch. On day 7 you name each bird from prior days' behavior. Memory across sessions; persistent in SQLite.

## 57. Drift
A boat on an open sea. No engine — only sail angle and rudder. Wind shifts. Reach buoys in order. Pure sailing physics.

## 58. The Apothecary
Customers describe ailments cryptically. Choose 1-3 herbs from a shelf of twenty. Effects are learned empirically across many customers. Build a mental model of an alternate-world pharmacology.

## 59. Soft Lock
A hidden combination. Each guess is scored per-digit as warmer/colder, not right/wrong. Mastermind variant with continuous feedback.

## 60. Shadow Theater
Position 2D cutouts in front of a light source. Their combined shadow must form a target silhouette. Cutouts overlap and combine. Spatial-projection puzzle.

## 61. Bus Route
A city of stops with passenger demands. Plan one bus route. Each stop adds time; each unserved passenger costs reputation. Daily generated city.

## 62. Crystal Growth
Drop a seed in saturated solution. Tap to add directional pulses that bias growth. Goal: produce a crystal of target shape. Pulses also induce unwanted side-growth — the puzzle is the tradeoff.

## 63. The Curator
A gallery with five rooms, four paintings each. Twenty paintings to place. Each has tags (period, palette, subject). Visitors rate based on hidden adjacency preferences you discover over time. Aesthetics as puzzle.

## 64. Spelunker's Logbook
A dark cave. You see only your light cone. As you move, you annotate the map yourself (click to mark walls). Backtrack to find exits trusting only your own notes.

## 65. Fortune Cookie
You write short fortunes. Later players draw your fortune and rate whether it felt true today. Cumulative score across days. Persistent fortune economy.

## 66. Bench Press
A park bench. People come, sit, and chat. You place small props nearby (pigeon, newspaper, umbrella) to steer conversations. Score: longest sustained conversation across the day.

## 67. The Last Word
You and an async opponent take turns adding one word to a story. Each player secretly holds five "word-type" cards they must use across the game. After 50 words, both guess the other's hidden cards. Bluff + collaborate.

## 68. Quiet Room
A blank screen with stereo ambient sounds. Each sound corresponds to a hidden object on a grid. Place objects on the grid; the soundscape updates. Reconstruct a target soundscape by ear alone.

## 69. Gravity Painter
A ball at the top of the screen. Rotate the world (not the ball) to roll it through floating rings. The ball leaves a paint trail. Score from rings; the *art* is saved and gallery-displayed beside your score.

## 70. The Querulous Garden
Each plant asks questions ("am I getting enough sun?"). The honest answer depends on visible conditions, but plants have hidden personalities — paranoid, honest, contrarian. Diagnose what each *actually* needs.

## 71. Drift Trade
A small ring of ports. Commodity prices oscillate on visible rhythms. Sail between, buying low and selling high. Limited hold, limited fuel, occasional storms. About reading the price waves.

## 72. Shard Garden
Drop colored shards into a kaleidoscope. Each tessellates symmetrically. Match a target pattern as closely as possible (pixel-distance after symmetry normalization). Meditative.

## 73. Tightrope
Walk a tightrope across a chasm. Mouse left/right balances; procedural gusts push you. A balance pole, when added, slows reaction but increases stability. Pure analog feel.

## 74. Pendulum
A pendulum. Click at the right phase to add energy. Build amplitude to ring specific bells arranged in arcs around the swing. Phase-locked rhythm game.

## 75. Bell Ringer
Six church bells. Ring them in valid change-ringing permutations (real method-ringing rules). Patterns build into longer methods. Music-theory-as-combinatorics.

## 76. Knapsack Heist
A getaway bag and twenty loot items, each with weight, value, *and* noise. Footsteps approach — every second a guard closes in. Pack and leave. Three-dimensional knapsack.

## 77. Hidden Camera
A static security-camera scene plays out over a minute. You scrub the timeline to identify *when* a specific event happened (who took the wallet, when the door opened). Multiple events per scene.

## 78. Tally
A herd of animals flashes for half a second. Estimate count. Hundreds of rounds with different distributions; score is mean accuracy. Subitization + estimation training.

## 79. The Translator
A poem in a fictional language with a glossary. Word-for-word translation is nonsense — reorder and pick synonym options to produce English that scans and rhymes. Creative + linguistic.

## 80. Conducting
Mouse height controls a section's volume; horizontal position selects which section. Conduct a piece to match its target dynamic curve. Real classical excerpts.

## 81. Spores
A fungus spreads on a grid each tick. You can cut firebreaks (limited supply) to protect target cells. Containment under a spreading process.

## 82. Mosaic
A bag of colored tiles. Place them on a board to approximate a target image at low resolution. Limited tile budget. Painting with a budget.

## 83. Antiques Roadshow
Four items per round, each with a brief story hint. Set a price. True price revealed; score by total absolute error across many rounds. Calibration game.

## 84. Sundial
A sundial whose sun moves through the day. Place marker stones to anchor specified events ("noon prayer", "evening bell"). Stones drift relative each season. Astronomy puzzle.

## 85. Punctuation
A sentence with no punctuation. Add commas, periods, and dashes to make it mean a specific target meaning. Same words, different meanings. ("Let's eat, grandma.")

## 86. Sleight
A card trick from the audience's POV. You play the magician. Click subtle prompts at the right moment to force a card. Audience confidence visible; success = they pick the forced card without suspicion.

## 87. Census
Thirty NPCs pass through a town square over a minute. Note their demographics. Some lie; cross-check sightings across multiple passes. Accuracy scoring.

## 88. Volcano
Lava flows down a procedural mountain. Place barriers to divert flow from villages. Lava cools and hardens — barriers become permanent terrain. Real-time strategy in a small space.

## 89. Calligraphy
Trace kanji-like characters in the correct stroke order and direction. Score: smoothness + correctness. Teaches real stroke order via play.

## 90. Mage Duel
Seven elements with a known combo chart. Each round, you and the AI pick simultaneously, then reveal. Combos cascade. Best of 9. Bluff and pattern reading.

## 91. Train Yard
A shunting puzzle. Reorder train cars to a target order using a single switch and a limited side track. 15-puzzle on rails — surprisingly tactile.

## 92. Tip Toes
A sleeping house. Move with arrow keys; movement generates noise on a meter. Find a target item and reach the exit before the noise wakes the dog. Floors creak differently.

## 93. Curtain Call
A play's lines scroll. One actor is yours — say their line (press space) at the exact right beat. Rhythm + memorization of cues.

## 94. Mortar & Pestle
Grind ingredients in pairs in specific orders. Each ingredient changes when ground after another. Discover recipes through pairings, write them in your notebook. Empirical chemistry.

## 95. Hourglass
An hourglass with multiple branching chambers. Tilt to redirect sand flow. Goal: fill bottom chambers to target proportions before sand runs out. Real-time fluid routing.

## 96. Refactor
A short blob of pseudocode and a hidden test suite that passes. Reduce the code's length while keeping all tests green. Each level introduces one new refactoring concept (inline, extract, dedupe).

## 97. Spell Debug
A wizard's spell shown as a sequence of glyphs. Running it produces unintended effects (frog explodes instead of teleporting). Swap, remove, or add glyphs to fix it. Debugging puzzle dressed as alchemy.

## 98. Stitchwork
A cross-stitch pattern. Reproduce it on an empty grid — but you may only place stitches in continuous unbroken thread paths. Plan thread routes to reach every required stitch.

## 99. Magnetic Field
Drag dipoles on a plane. Iron filings render around them in real time. Goal: produce a field shape matching a target outline. The puzzle is choosing dipole positions and orientations together.

## 100. Sundown
A single screen. A sun setting over a procedurally drawn landscape. Press space at the *exact* moment you believe the sun is fully below the horizon. Sub-pixel scoring; daily seed. A one-button game about attention.
