import { useEffect, useRef, useState } from "react";

// Anagram Tower: letters fall; type words to dissolve them. Keep stack low.

const COLS = 8;
const ROWS = 14;
const CELL = 38;

const FREQ: Record<string, number> = {
  A: 8, B: 2, C: 3, D: 4, E: 12, F: 2, G: 2, H: 4, I: 7, J: 1, K: 1, L: 4,
  M: 3, N: 7, O: 8, P: 2, Q: 1, R: 6, S: 6, T: 9, U: 3, V: 1, W: 2, X: 1, Y: 2, Z: 1,
};
const LETTER_SCORE: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1,
  M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
};

// Small dictionary embedded (curated common words 3-8 letters).
const DICT = new Set<string>(
  (
    "are art ate ace age ago aid aim and any ape arc ask back bake band base bath bear " +
    "best bird bite blue boat body bone book boss bowl boys bull cake calm came care cars " +
    "case cast cell chat chip city clay club coal coat cold come cook cool corn cost dare " +
    "dark dawn days dead deal deep deer desk dial diet dive door down drop drum duck dust " +
    "each earn east easy edge enemy energy enter equal even ever exit eyes face fact fade " +
    "fail fair fall fame farm fast fate fear feed feel felt fern field fight find fine " +
    "fire firm fish five flag flat flew flow food foot form four free from full game gate " +
    "gave gear gift give glad glow goal goat gold gone good gray great green grew grow " +
    "hair half hand hard harm hate have head hear heat help here hide high hill hint hire " +
    "hold hole holy home hope horn hour huge hunt idea iron jail jazz join joke jump just " +
    "keep kept kick kind king kiss knee knew knit know lake lamp land lane last late lead " +
    "leaf lean leap left lend less liar life lift like line lion list live loaf lock long " +
    "look lord lose loss loud love luck made mail main make male many mark mass mate meal " +
    "mean meat meet melt mend mild mile milk mind mine mint miss mode moon more most move " +
    "much must name navy near neat neck need nest news next nice nine node none noon nose " +
    "note noun open oral over pack page paid pain pair pale palm park part past path peak " +
    "pear pen plan play plus poem poet pole pond poor port pose post pour pray prey print " +
    "pull pure push quit race rage rain ramp rare rate raw read real rear reap rent rest " +
    "rice rich ride ring rise risk road rock role rope rose rule rush sack safe sage sail " +
    "salt same sand save scan seal seat seed seek seem self sell send sense sent ship shoe " +
    "shop show shut sick side sign silk sing sink site size skin slid slow snow soft soil " +
    "sold some song soon sort soul soup spin spot star stay step stir stop stem stone story " +
    "stove sugar suit summer sun sure swim tail take tale talk tall tame tank tape task " +
    "team tear tend tent term test text than that them then they thin this thus tide tied " +
    "time tiny tire toad told tone tool torn town tray tree trim trip true tuna tune turn " +
    "twin type ugly unit upon urge used user vary vast veil vein vent very vest vine vote " +
    "wage wait wake walk wall ward warm warn wash wave wear week well went west what when " +
    "whip whom wide wife wild will wind wine wing wins wire wise wish with wolf wood word " +
    "wore work worn yard year zone zoom acres after again agent alarm album alert alien " +
    "alley alone along amber angel anger ankle apple arena armor arrow audio award awoke " +
    "bacon badge baker baron basic batch beach beard beast began begin being bench bible " +
    "birth black blade blame blast bleak blend bless blind block blood blown blunt blush " +
    "board bonus boost booth bound brave bread break brick bride brief bring broad brook " +
    "brown brush build burst cable cabin candy cargo carry catch chain chair chalk champ " +
    "chase cheap cheat check chess chest chief child chime china chord chose chunk class " +
    "clean clear cliff climb clock close cloth cloud clown clung coach coast color couch " +
    "could count court cover craft crane crash cream creek crime crisp cross crowd crown " +
    "crush crust cycle daily dairy dance death depth dirty ditch dough doubt drain dream " +
    "dress drink drive eager early earth eight elbow enjoy entry equal essay event every " +
    "exile exist extra fable faith false fancy farms fault favor feast fence fever fiber " +
    "field fifth fight final first flame flash flesh float flood floor flora flour fluid " +
    "flush focus force forge forty found frame frank fresh frock frost fruit fuzzy gamer " +
    "ghost giant given glory glove going grade grain grand grant grape grass grave great " +
    "greed green grief gross group grove grown guard guess guest guide habit hairy hands " +
    "happy harsh haste hasty haunt heard heart heavy henry hippo hobby honor horns horse " +
    "hotel house humor humid hurry idiom image imply incur index inner input inset issue " +
    "ivory jewel joint judge juice knack knife knock known label lance large laser later " +
    "laugh layer learn lease least leave legal level light limit linen linen liver loaf " +
    "lobby local lodge logic loose lower loyal lucid lunar lunch lyric magic major maker " +
    "march marsh match maybe meals meant medal media melon merit metal meter midst might " +
    "minor model moist money month mooth motor mount mouse mouth moved music mythic naked " +
    "narrow nasty needs nerve never newer night noble noisy north novel nurse oasis ocean " +
    "octal often olive onion onset opera order organ ought ounce outer owner paint panel " +
    "panic paper party patch pause peach pearl pedal penny perch perky petal phase phone " +
    "photo piano piece pilot pinch pious pitch pivot place plain plane plant plate plaza " +
    "pleat point poker polar polka porch pouch pound power press price pride prime print " +
    "prior prize probe prone proof proud prove prune pulse punch pupil purse queen quest " +
    "quick quiet quill quirk quite quote raise rally ranch range rapid ratio reach react " +
    "ready rebel refer relic remit reply reset rider ridge rifle right rigid risen river " +
    "roast robin rocky roman rough round route rover royal rules rural saint salad salon " +
    "sandy sauce scale scar scarf scene scent scoop scope score scorn scout scrap screw " +
    "scrub seize sense seven sever shady shaft shake shall shame shape share sharp shave " +
    "shawl shell shift shine ship shirt shock shone shoot shore short shout shown shred " +
    "shrub sigh sight silly since siren sixth sixty skate skill skirt skull slang slate " +
    "sleep slice slime sling slip slope slosh small smart smash smell smile smith smoke " +
    "snail snake sneak sneer snore snort solid solve sorry sound south space spade spare " +
    "spark speak spear speed spell spend spent spice spike spine spire spite splat split " +
    "spoil spoke sport spout spray spree spurt squad stack staff stage stain stair stake " +
    "stale stalk stall stamp stand stare start state stave steam steel steep steer stern " +
    "stick stiff still sting stink stock stoke stole stomp stone stood stool stoop store " +
    "storm story stove strap straw stray strut stuck study stuff stump stunt style sugar " +
    "suite super surge swarm sweat sweep sweet swept swift swing sword table taken talent " +
    "taste taunt teach tease teeth tempo tempt tenor tense terms thank theme there these " +
    "thick thief thigh think third thorn those three threw throb throw thumb thump tidal " +
    "tiger tight timer tired title toast today token tonic torch total tough tower toxic " +
    "trade trail train trait tramp trap trash tread treat trend trial tribe trick tried " +
    "trim trio trip troop trout truck truly trunk trust truth tutor twice twist tyrant " +
    "uncle under unify union unite unity until upper urban usage usual valid value valve " +
    "vapor vault venom verge verse vigil villa vinyl vivid vocal vodka voice vowel waged " +
    "wagon waist waltz waste watch water weigh weird whale wheat wheel where which while " +
    "whirl white whole whose widow width witch woman women words world worry worth would " +
    "wound woven wreck wrist write wrong yacht yield young youth zebra"
  ).split(/\s+/),
);

function pickLetter(rng: () => number) {
  const total = Object.values(FREQ).reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (const [l, w] of Object.entries(FREQ)) {
    r -= w;
    if (r <= 0) return l;
  }
  return "E";
}

export default function Game002_AnagramTower() {
  const [board, setBoard] = useState<(string | null)[][]>(() =>
    Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null)),
  );
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [msg, setMsg] = useState("");
  const tickRef = useRef(0);
  const boardRef = useRef(board);
  boardRef.current = board;

  // gravity / spawn loop
  useEffect(() => {
    if (gameOver) return;
    const id = setInterval(() => {
      tickRef.current++;
      setBoard((b) => {
        const nb = b.map((r) => r.slice());
        // gravity: shift down letters that have empty below
        for (let y = ROWS - 2; y >= 0; y--) {
          for (let x = 0; x < COLS; x++) {
            if (nb[y][x] && !nb[y + 1][x]) {
              nb[y + 1][x] = nb[y][x];
              nb[y][x] = null;
            }
          }
        }
        // spawn every ~3 ticks: pick random col, drop at top
        if (tickRef.current % 3 === 0) {
          const col = Math.floor(Math.random() * COLS);
          if (nb[0][col]) {
            setGameOver(true);
          } else {
            nb[0][col] = pickLetter(Math.random);
          }
        }
        return nb;
      });
    }, 350);
    return () => clearInterval(id);
  }, [gameOver]);

  // input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameOver) return;
      if (e.key === "Backspace") {
        setInput((s) => s.slice(0, -1));
      } else if (e.key === "Enter") {
        submit();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        setInput((s) => (s + e.key).toUpperCase());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, input]);

  const submit = () => {
    const word = input.toLowerCase();
    if (word.length < 3) {
      setMsg("too short");
      setInput("");
      return;
    }
    if (!DICT.has(word)) {
      setMsg(`'${word}' not in lexicon`);
      setInput("");
      return;
    }
    // try to find letters on board (one per tile, prefer highest tiles first)
    const b = boardRef.current.map((r) => r.slice());
    const used: [number, number][] = [];
    let ok = true;
    for (const ch of word.toUpperCase()) {
      // search from top
      let found = false;
      for (let y = 0; y < ROWS && !found; y++) {
        for (let x = 0; x < COLS && !found; x++) {
          if (b[y][x] === ch && !used.some(([uy, ux]) => uy === y && ux === x)) {
            used.push([y, x]);
            found = true;
          }
        }
      }
      if (!found) {
        ok = false;
        break;
      }
    }
    if (!ok) {
      setMsg("letters not on board");
      setInput("");
      return;
    }
    let gained = 0;
    for (const [y, x] of used) {
      gained += LETTER_SCORE[b[y][x] as string] || 1;
      b[y][x] = null;
    }
    gained *= word.length >= 6 ? 3 : word.length >= 5 ? 2 : 1;
    setScore((s) => s + gained);
    setMsg(`+${gained} (${word.toUpperCase()})`);
    setInput("");
    setBoard(b);
  };

  const reset = () => {
    setBoard(Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null)));
    setInput("");
    setScore(0);
    setMsg("");
    setGameOver(false);
    tickRef.current = 0;
  };

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui", padding: 8 }}>
      <h2 style={{ margin: "4px 0" }}>Anagram Tower</h2>
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        Type a word from any letters on screen, press Enter. Long/rare words score more.
      </div>
      <div style={{ margin: "6px 0" }}>
        Score: <b>{score}</b> | typing: <b style={{ color: "#fc8" }}>{input || "—"}</b> | {msg}
        {gameOver && (
          <>
            {" — game over. "}
            <button type="button" onClick={reset}>
              again
            </button>
          </>
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
          gridAutoRows: `${CELL}px`,
          gap: 2,
          background: "#222",
          padding: 4,
          width: "max-content",
        }}
      >
        {board.flatMap((row, y) =>
          row.map((c, x) => (
            <div
              key={`${y}-${x}`}
              style={{
                background: c ? "#3a4d6b" : "#111",
                color: c ? "#fff" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 20,
                borderRadius: 4,
              }}
            >
              {c}
            </div>
          )),
        )}
      </div>
    </div>
  );
}
