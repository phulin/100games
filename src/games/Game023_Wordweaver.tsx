import { useMemo, useState } from "react";

// A small embedded dictionary of common short words. The player is given a
// random letter each turn and must add it to either end of their current word,
// keeping it a valid dictionary word.

// Roughly ~600 short English words, weighted toward chain-friendly ones.
const RAW_WORDS = `a an as at ax ad am ah ai be by bi bo bay bat bad bag ban bar bat
bay bed bee beg bet bid big bin bit bog boy bow bun bus but buy bye
ca cab can cap car cat caw cob cod cog con cop cot cow cry cub cue cup cut
da dab dad day deb den dew did die dig dim din dip do doe dog don dot dub
dud due dug dye e ear eat eel egg eh elf elk elm em en end era ere err
eta eve eye fa fad fan far fat fed fee fen few fig fin fir fit fix flu
fly foe fog for fox fro fry fun fur ga gab gad gag gal gap gas gay gel
gem get gig gin go god got gum gun gut guy ha had ham hat hay he hem hen
her hew hex hey hi hid him hip his hit hob hod hoe hog hop hot how hub
hue hug hum hut i ice icy if ilk ill imp in ink inn into ion ire is it
its ivy jab jag jam jaw jay jet jib jig job joe jog jot joy jug jut keg
key kid kin kit la lab lad lag lap law lax lay led lee leg let lev lid
lie lip lit lo log loo lop lot low lug lye ma mad man map mar mat may me
men met mew mid mix mob mod mom mop mow mud mug mum my na nab nag nap nat
nay ne ned net new nib nil nip no nod nor not now nu nub nun nut oaf oak
oar oat ob odd ode of off oh oil ok old on once one ooh oops opt or orb
ore our out ova owe owl own ox pa pad pal pan par pat paw pay pea pee
peg pen pep per pet pew pi pie pig pin pip pit ply pod poi pop pot pow
pox pry pug pun pup pur put rad rag rah ram ran rap rat raw ray re reb
red ref rep rev rib rid rig rim rip rob rod roe rot row rub rue rug rum
run rut rye sac sad sag sap sat saw say sea see set sew sh she shy sic
sin sip sir sis sit six ski sky sly so sob sod son sop sot sow soy spa
spy sub sue sum sun sup ta tab tad tag tam tan tap tar tat tax tea ted
tee ten the thy tic tie til tin tip to toe tog tom ton too top tor tot
tow toy try tub tug tun tut twa tyke up us use ute vat vet vie vow vox
wad wag wan war was wax way we web wed wee wen wet who why wig win wit
woe wok won woo wow yak yam yap yaw ye yea yen yep yes yet yew yip yo
yob yon yore you yow yum zag zap zed zee zen zip zit zoo
able about above acre acid afar afro aged ages aide aids aims airs
also amen amid amok amps anew ants apex apse arch arcs area arms army
arts ashy atom atop aunt aura auto awed away awry axes baby back bade
bake bald bale balk ball balm band bane bang bank bans bard bare bark
barn bars base bash bask bass bath bats bawl bays bead beak beam bean
bear beat been beef beep beer bees beet bell belt bend bent best bets
bias bibs bide bids bike bile bilk bill bind bins bird bite bits boar
boat body bogs boil bold bolt bomb bond bone bong bonk bony book boom
boon boor boot bops bore born bosh boss bows boys brag bran bras bray
brew brig brim brow buck buds buff bugs bulb bulk bull bums bumi bumf
buns bunk buns buoy burn burp burr bury bush bust busy buys buzz cabs
cafe cage cake calf call calm came camp cane cans cape caps card care
cars cart case cash cask cast cats cave cell cent chap char chat chef
chew chic chin chip chop chub chug chum cite city clad clam clan clap
claw clay clip clod clog clop club clue coal coat coax cobs cock coda
code cods coed coil coin coke cola cold colt coma comb come cone cons
cook cool coop cope cops copy cord core cork corn cost cosy cots couch
coup cove cowl cows cozy crab crag cram crap craw crew crib crow crud
cube cubs cuds cued cues cuff cull cult curb curd cure curl curt cusp
cuss cute cyst dabs dads daft dais dale dame damn damp dams dare dark
darn dart dash data date dawn days daze dead deaf deal dean dear debt
deck deed deem deep deer deft defy deli dell demo dens dent deny desk
dewy dial dice dies diet digs dike dill dime dims dine ding dins dint
dips dire dirt disc dish disk dive dock does doff dogs doll dome done
dons doom door dope dose dote dots down doze drag dram draw dray drew
drip drop drug drum dual duck duct dude duds duel dues dug duke dull
duly dumb dump dune dung dunk duns duos dupe dusk dust duty dyad dyed
dyes each earl earn ears ease east easy eats ebbs echo eddy edge edgy
eels eggs egos ekes elks elms else emit emus ends envy epic eras ergo
errs even ever eves evil ewes exam exit eyed eyes face fact fade fads
fail fair fake fall fame fang fans fare farm fast fate fats faun fawn
fays faze fear feat feds feed feel fees feet fell felt fend fens fern
fess feta fete feud fiat fibs fief fifo file fill film find fine fink
fins fire firm firs fish fist fits five fizz flag flak flap flat flaw
flea fled flee flew flex flip flit floe flog flop flow flub flue flux
foal foam fobs foci foes foil fold folk fond font food fool foot fops
fora forb ford fore fork form fort foul four fowl foxy frap fray free
fret frog from fuel full fume fund fungi funk furl fury fuse fuss fuzz
gabs gads gaff gage gain gait gala gale gall game gang gape gaps gash
gasp gate gave gaze gear geek gels gems gene gent germ gets gibe gift
gigs gild gill gilt gimp gins girl girt gist give glee glob glow glue
glum glut gnat gnaw goad goal goat gobs gods goer goes gold golf gong
good goof goon goop gore gory gosh gout gown grab gray grew grey grid
grim grin grip grit grog grow grub guff gulf gull gulp gums gunk guns
guru gush gust guts guys gyms gyps gyre habs hack haft hags hail hair
hake hale half hall halo halt hams hand hang hank hard hare hark harm
harp hart hash hasp hate hats haul have hawk haze hazy head heal heap
hear heat heck heed heel heft heir held hell helm help hemp hens herb
herd here hero hers hewn hews hick hide high hike hill hilt him hind
hint hips hire hiss hits hive hoax hobs hock hods hoed hoes hogs hold
hole holy home hone honk hoof hook hoop hoot hope hops horn host hosts
hour hove howl hows hubs huck huff hugs hula hulk hull hump hums hung
hunk hunt hurl hurt hush husk huts hymn hype hypo iamb ibex ibis iced
ices icky idea idle idly idol iffy iiss ilks ills imps inca inch ions
iota ipso ires iris irks iron isle item itch jabs jack jade jails jamb
jams jape jars jaws jays jazz jean jeep jeer jell jerk jest jets jibe
jibs jiff jigs jilt jinx jive jobs jock joey jogs john join joke jolt
josh joss jots joys judo jugs juju juke july jump june junk jury just
jute juts kale keel keen keep kegs kelp kept keys kick kids kiln kilo
kilt kind king kink kins kips kiss kite kits kiwi knee knew knit knob
knot know kook labs lace lack lads lady lain lair lake lamb lame lamp
land lane lank laps lard lark lash lass last late lath laud lava lawn
laws lays laze lazy lead leaf leak lean leap leek leer left legs lend
lens lent less lest let lewd liar lick lids lied lien lies life lift
like lilt lily limb lime limn limp line ling link lint lion lips list
lisp live load loaf loan lobe lobs lock loco loft loge logo logs loin
loll lone long look loom loon loop loot lope lord lore lose loss lost
lots loud love luck lull lumber lump lung lure lurk lush lust lute lynx
lyre mace made magi maid mail maim main make male mall malt mama mane
maps mare mark mart mash mask mass mast mate math maul maws mayo maze
mead meal mean meat meek meet mega meld melt memo mend menu meow mesh
mess mete mews mica mice mick mics midi mild mile milk mill mils mime
mind mine mini mink mint minx mire miss mist mite mitt moan moat mobs
mock mode mods mole moll molt monk mood moon moor moos moot mope mops
more morn mosh moss most moth move much muck muff mugs mule mull mumps
muse mush musk muss must mute mutt myth nabs nags nail name nape naps
narc nary naps nave navy nays near neat necks need neon nerd nest nets
news newt next nice nick nigh nine nips nits nobs node nods noel none
nook noon nope norm nose nosh note noun nous nova nude nuke null nuns
nuts oafs oaks oars oath oats odds odes off ogle ogre oils oily okra
olds omen once ones only ooze ooses opal open opts opus orbs ores
organ ouch ours oust outs oval oven over owed owes owls owns oxen pace
pack pact pads page paid pail pain pair pale pall palm pals pane pang
pant papa papers paps para pard pare park pars part pass past path pats
pave pawn paws pays peak peal pear peas peat peck peed peek peel peer
pees pegs pelt pens pent peon perp peso pest pets pews pick pied pier
pies pigs pike pile pill pimp pine ping pink pins pint pips pita pith
pits pity plan play plea pled plod plop plot plow ploy plug plum plus
pock pods poem poet pogo poke pole poll polo pomp pond pong pony pool
poop poor pope pops pore pork porn port pose posh post pots pour pout
pram prat pray prey prig prim proa prod prof prom prop pros prow puce
puck puds puff pugh pugs puke pull pulp puls puma pump puns punt puny
pups pure purr push puss puts putt pyre quad qua quay quid quip quit
quiz rabs race rack racy raft rage rags raid rail rain rake rams rang
rank rant rape rapt rare rash rasp rate rats rave raws rays raze read
real ream reap rear redo redx reds reed reef reek reel rein reps rest
revs ribs rice rich rick ride rids riff rift rigs rile rill rims rind
ring rink riot ripe rips rise risk rite road roam roar robe robs rock
rode rods roes role roll romp rood roof rook room roost root rope rose
rosy rote rots roue rout rove rows rube ruby rude ruff rugs ruin rule
rump rums rune rung runs runt ruse rush rusk rust ruts sack sacs safe
saga sage sago sags said sail sake sale salt same sand sane sang sank
sans saps sari sash sass sate sauce save saws says scab scam scan scar
scat scud scum scut seal seam sear seas seat sect seed seek seem seen
seep seer sees self sell semi send sent sept sera serf seta sets sett
sewn sews sexy shag shah sham she shed shes shim shin ship shoe shoo
shop shot show shun shut sick side sift sigh sign silk sill silo silt
sing sink sins sips sire sirs site sits size skid skim skin skip skis
slab slag slap slat slaw slay sled slid slip slit slob slog slop slot
slow slug slum slur smog smut snag snap snip snit snob snog snot snow
snub snug soak soap soar sobs sock soda sofa soft soil sold sole solo
some song sons soon soot sops sore sort sorts sots soul soup sour sown
sows soya spab spam span spar spas spat spay sped spew spin spit spot
spry spud spun spur stab stag star stay stem step stew stir stop stub
stud stun sub subs such suds sued suer sues suet suit sulk sumo sump
sums sung sunk suns sups sure surf swab swag swam swap swat sway swig
swim swum tabs tack tact tags tail take tale talk tall tame tamp tang
tank tans tape taps tare taro tarp tars tart task tats taut taxi teak
teal team tear teas teat tech teed teem teen tees tell temp tend tens
tent term tern test text than that thaw thee them then they thin this
thou thud thug thus tick tide tidy tied tier ties tiff tile till tils
tilt time tine ting tint tiny tips tire toad toes tofu toga togs toil
told toll tomb tome toms tone tong tons tony took tool toot tope tops
torn tors tort toss tote tots tour tout town tows toys trap tray tree
trek trim trio trip trot true tsar tuba tube tubs tuck tuft tugs tule
tums tuna tune tuns turd turf turn tush tusk tuts twin twit type typo
ugly undo unit untie upon urea urge urns used user uses ushers utes
vain vale vamp vane vans vary vase vast vats veal veer veil vein vend
vent verb very vest veto vets vexed vial vibe vice vide vied vies view
vile vine vino viol visa vise viva vivo void vole volt vote vows wabs
wack wade wads wage wags waif wail wait wake wale walk wall wand wane
want ward ware warm warn warp wars wart wary wash wasp watt wave wavy
wax ways weak wean wear webs weds weed week weep weft well welt went
wept were west weta wets wham what when whet whey whig whim whip whir
whit whiz whoa whom whop whup wick wide wife wigs wild wile will wilt
wily wimp wind wine wing wink wins wipe wire wise wish wisp wits wive
woes woke wolf womb wont wood woof wool woos word wore work worm worn
wrap wren writ yack yams yank yard yarn yawn yaws year yeas yeti yips
yoga yoke yolk yore your yowl yule zaps zeal zebra zero zest zinc zing
zips zone zoom`;

const DICT = new Set(
	RAW_WORDS.replace(/\s+/g, " ")
		.toLowerCase()
		.split(" ")
		.filter((w) => w.length > 0 && /^[a-z]+$/.test(w)),
);

function randLetter() {
	// weighted-ish toward common letters
	const pool = "eeeaaaiioonnrrttllssduhmcybgpfwkvjxqz";
	return pool[Math.floor(Math.random() * pool.length)];
}

export default function Wordweaver() {
	const startWords = useMemo(
		() => Array.from(DICT).filter((w) => w.length === 2 || w.length === 3),
		[],
	);
	const [word, setWord] = useState(() => {
		return startWords[Math.floor(Math.random() * startWords.length)];
	});
	const [letter, setLetter] = useState(randLetter);
	const [history, setHistory] = useState<string[]>([]);
	const [msg, setMsg] = useState("Add to front or back, keep it a word.");
	const [over, setOver] = useState(false);
	const [best, setBest] = useState(() => {
		try {
			return Number(localStorage.getItem("wordweaver_best") || "0");
		} catch {
			return 0;
		}
	});

	const tryAdd = (side: "front" | "back") => {
		if (over) return;
		const candidate = side === "front" ? letter + word : word + letter;
		if (!DICT.has(candidate)) {
			setMsg(`"${candidate}" isn't in the dictionary. Game over.`);
			setOver(true);
			if (word.length > best) {
				setBest(word.length);
				try {
					localStorage.setItem("wordweaver_best", String(word.length));
				} catch {
					/* ignore */
				}
			}
			return;
		}
		setHistory((h) => [...h, candidate]);
		setWord(candidate);
		setLetter(randLetter());
		setMsg(`Nice. "${candidate}" — keep going.`);
	};

	const skip = () => {
		if (over) return;
		// You can skip but it costs a "strike" — too many and you end.
		setLetter(randLetter());
		setMsg("Skipped that letter.");
	};

	const reset = () => {
		setWord(startWords[Math.floor(Math.random() * startWords.length)]);
		setHistory([]);
		setLetter(randLetter());
		setOver(false);
		setMsg("Add to front or back, keep it a word.");
	};

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "linear-gradient(180deg,#1a1d24,#0d1015)",
				color: "#e0e6f0",
				fontFamily: "Georgia, serif",
				padding: 24,
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
			}}
		>
			<h2 style={{ margin: 0 }}>Wordweaver</h2>
			<div style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
				Add the given letter to the front or back. Result must be a real word.
			</div>
			<div
				style={{
					fontSize: 28,
					letterSpacing: 4,
					padding: "10px 18px",
					background: "#222a36",
					borderRadius: 6,
					minWidth: 200,
					textAlign: "center",
				}}
			>
				<span style={{ color: "#8fd1ff" }}>{letter}</span>
				<span style={{ opacity: 0.4, margin: "0 12px" }}>+</span>
				<span>{word}</span>
			</div>
			<div style={{ marginTop: 16, display: "flex", gap: 10 }}>
				<button
					type="button"
					onClick={() => tryAdd("front")}
					disabled={over}
					style={{
						padding: "10px 16px",
						background: "#3a6fa3",
						color: "#fff",
						border: "none",
						borderRadius: 4,
						cursor: over ? "not-allowed" : "pointer",
						fontSize: 14,
					}}
				>
					Add to FRONT → {letter}
					{word}
				</button>
				<button
					type="button"
					onClick={() => tryAdd("back")}
					disabled={over}
					style={{
						padding: "10px 16px",
						background: "#3a6fa3",
						color: "#fff",
						border: "none",
						borderRadius: 4,
						cursor: over ? "not-allowed" : "pointer",
						fontSize: 14,
					}}
				>
					Add to BACK → {word}
					{letter}
				</button>
				<button
					type="button"
					onClick={skip}
					disabled={over}
					style={{
						padding: "10px 16px",
						background: "#444",
						color: "#fff",
						border: "1px solid #666",
						borderRadius: 4,
						cursor: over ? "not-allowed" : "pointer",
						fontSize: 14,
					}}
				>
					Reroll letter
				</button>
			</div>
			<div
				style={{
					marginTop: 16,
					padding: 8,
					minHeight: 24,
					color: over ? "#cc7070" : "#9bcc70",
				}}
			>
				{msg}
			</div>
			<div style={{ marginTop: 4, fontSize: 13 }}>
				Length: {word.length} · Best: {best}
			</div>
			{history.length > 0 && (
				<div
					style={{
						marginTop: 16,
						fontSize: 12,
						opacity: 0.7,
						maxWidth: 700,
						textAlign: "center",
					}}
				>
					Chain: {history.join(" → ")}
				</div>
			)}
			{over && (
				<button
					type="button"
					onClick={reset}
					style={{
						marginTop: 20,
						padding: "8px 16px",
						background: "#9bcc70",
						color: "#000",
						border: "none",
						borderRadius: 4,
						cursor: "pointer",
					}}
				>
					Play again
				</button>
			)}
		</div>
	);
}
