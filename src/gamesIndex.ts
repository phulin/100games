import G001 from "./games/Game001_EchoMaze";
import G002 from "./games/Game002_AnagramTower";
import G003 from "./games/Game003_TideGarden";
import G004 from "./games/Game004_LiarsCompass";
import G005 from "./games/Game005_WhisperChain";
import G006 from "./games/Game006_TheCartographersDoubt";
import G007 from "./games/Game007_Reverberation";
import G008 from "./games/Game008_MimicBird";
import G009 from "./games/Game009_Frostline";
import G010 from "./games/Game010_BorrowedTime";
import G011 from "./games/Game011_TheForger";
import G012 from "./games/Game012_Pilgrim";
import G013 from "./games/Game013_GhostRun";
import G014 from "./games/Game014_HeatMap";
import G015 from "./games/Game015_LocksmithsApprentice";
import G016 from "./games/Game016_StoneSoup";
import G017 from "./games/Game017_Constellation";
import G018 from "./games/Game018_Wavelength";
import G019 from "./games/Game019_TheAuctioneer";
import G020 from "./games/Game020_SnowflakeLab";
import G021 from "./games/Game021_BackwardsChess";
import G022 from "./games/Game022_FrequencyHunt";
import G023 from "./games/Game023_Wordweaver";
import G024 from "./games/Game024_PebblePond";
import G025 from "./games/Game025_HeirApparent";
import G026 from "./games/Game026_TowerOfTongues";
import G027 from "./games/Game027_VaultCracker";
import G028 from "./games/Game028_Migration";
import G029 from "./games/Game029_TheNegotiator";
import G030 from "./games/Game030_Refraction";
import G031 from "./games/Game031_FoundFootage";
import G032 from "./games/Game032_TollRoad";
import G033 from "./games/Game033_Origami";
import G034 from "./games/Game034_TheGlitch";
import G035 from "./games/Game035_WitnessBox";
import G036 from "./games/Game036_Cairn";
import G037 from "./games/Game037_Lullaby";
import G038 from "./games/Game038_Inkblot";
import G039 from "./games/Game039_TheCartomancer";
import G040 from "./games/Game040_Switchboard";
import G041 from "./games/Game041_SlowRace";
import G042 from "./games/Game042_AntiMatch";
import G043 from "./games/Game043_Lighthouse";
import G044 from "./games/Game044_Cuneiform";
import G045 from "./games/Game045_StaticSymphony";
import G046 from "./games/Game046_Sluice";
import G047 from "./games/Game047_Inheritance";
import G048 from "./games/Game048_CatchTheIdiom";
import G049 from "./games/Game049_PressConference";
import G050 from "./games/Game050_MagneticPoetry";
import G051 from "./games/Game051_LostLetter";
import G052 from "./games/Game052_TidePool";
import G053 from "./games/Game053_EchoChamber";
import G054 from "./games/Game054_PaperBirds";
import G055 from "./games/Game055_InkSpill";
import G056 from "./games/Game056_CompassRose";
import G057 from "./games/Game057_GlassGarden";
import G058 from "./games/Game058_MemoryTide";
import G059 from "./games/Game059_StarCartographer";
import G060 from "./games/Game060_ShadowTheater";
import G061 from "./games/Game061_BusRoute";
import G062 from "./games/Game062_CrystalGrowth";
import G063 from "./games/Game063_TheCurator";
import G064 from "./games/Game064_SpelunkersLogbook";
import G065 from "./games/Game065_FortuneCookie";
import G066 from "./games/Game066_BenchPress";
import G067 from "./games/Game067_TheLastWord";
import G068 from "./games/Game068_QuietRoom";
import G069 from "./games/Game069_GravityPainter";
import G070 from "./games/Game070_QuerulousGarden";
import G071 from "./games/Game071_DriftTrade";
import G072 from "./games/Game072_ShardGarden";
import G073 from "./games/Game073_Tightrope";
import G074 from "./games/Game074_Pendulum";
import G075 from "./games/Game075_BellRinger";
import G076 from "./games/Game076_KnapsackHeist";
import G077 from "./games/Game077_HiddenCamera";
import G078 from "./games/Game078_Tally";
import G079 from "./games/Game079_TheTranslator";
import G080 from "./games/Game080_Conducting";
import G081 from "./games/Game081_Spores";
import G082 from "./games/Game082_Mosaic";
import G083 from "./games/Game083_AntiquesRoadshow";
import G084 from "./games/Game084_Sundial";
import G085 from "./games/Game085_Punctuation";
import G086 from "./games/Game086_Sleight";
import G087 from "./games/Game087_Census";
import G088 from "./games/Game088_Volcano";
import G089 from "./games/Game089_Calligraphy";
import G090 from "./games/Game090_MageDuel";
import G091 from "./games/Game091_TrainYard";
import G092 from "./games/Game092_TipToes";
import G093 from "./games/Game093_CurtainCall";
import G094 from "./games/Game094_MortarAndPestle";
import G095 from "./games/Game095_Hourglass";
import G096 from "./games/Game096_Refactor";
import G097 from "./games/Game097_SpellDebug";
import G098 from "./games/Game098_Stitchwork";
import G099 from "./games/Game099_MagneticField";
import G100 from "./games/Game100_Sundown";

export type GameEntry = {
	id: number;
	name: string;
	Component: React.ComponentType;
};

export const GAMES: GameEntry[] = [
	{ id: 1, name: "Echo Maze", Component: G001 },
	{ id: 2, name: "Anagram Tower", Component: G002 },
	{ id: 3, name: "Tide Garden", Component: G003 },
	{ id: 4, name: "Liar's Compass", Component: G004 },
	{ id: 5, name: "Whisper Chain", Component: G005 },
	{ id: 6, name: "The Cartographer's Doubt", Component: G006 },
	{ id: 7, name: "Reverberation", Component: G007 },
	{ id: 8, name: "Mimic Bird", Component: G008 },
	{ id: 9, name: "Frostline", Component: G009 },
	{ id: 10, name: "Borrowed Time", Component: G010 },
	{ id: 11, name: "The Forger", Component: G011 },
	{ id: 12, name: "The Pilgrim", Component: G012 },
	{ id: 13, name: "Ghost Run", Component: G013 },
	{ id: 14, name: "Heat Map", Component: G014 },
	{ id: 15, name: "Locksmith's Apprentice", Component: G015 },
	{ id: 16, name: "Stone Soup", Component: G016 },
	{ id: 17, name: "Constellation", Component: G017 },
	{ id: 18, name: "Wavelength", Component: G018 },
	{ id: 19, name: "The Auctioneer", Component: G019 },
	{ id: 20, name: "Snowflake Lab", Component: G020 },
	{ id: 21, name: "Backwards Chess", Component: G021 },
	{ id: 22, name: "Frequency Hunt", Component: G022 },
	{ id: 23, name: "Wordweaver", Component: G023 },
	{ id: 24, name: "Pebble Pond", Component: G024 },
	{ id: 25, name: "Heir Apparent", Component: G025 },
	{ id: 26, name: "Tower of Tongues", Component: G026 },
	{ id: 27, name: "Vault Cracker", Component: G027 },
	{ id: 28, name: "Migration", Component: G028 },
	{ id: 29, name: "The Negotiator", Component: G029 },
	{ id: 30, name: "Refraction", Component: G030 },
	{ id: 31, name: "Found Footage", Component: G031 },
	{ id: 32, name: "Toll Road", Component: G032 },
	{ id: 33, name: "Origami", Component: G033 },
	{ id: 34, name: "The Glitch", Component: G034 },
	{ id: 35, name: "Witness Box", Component: G035 },
	{ id: 36, name: "Cairn", Component: G036 },
	{ id: 37, name: "Lullaby", Component: G037 },
	{ id: 38, name: "Inkblot", Component: G038 },
	{ id: 39, name: "The Cartomancer", Component: G039 },
	{ id: 40, name: "Switchboard", Component: G040 },
	{ id: 41, name: "Slow Race", Component: G041 },
	{ id: 42, name: "Anti-Match", Component: G042 },
	{ id: 43, name: "Lighthouse", Component: G043 },
	{ id: 44, name: "Cuneiform", Component: G044 },
	{ id: 45, name: "Static Symphony", Component: G045 },
	{ id: 46, name: "The Sluice", Component: G046 },
	{ id: 47, name: "The Inheritance", Component: G047 },
	{ id: 48, name: "Catch the Idiom", Component: G048 },
	{ id: 49, name: "Press Conference", Component: G049 },
	{ id: 50, name: "Magnetic Poetry", Component: G050 },
	{ id: 51, name: "The Lost Letter", Component: G051 },
	{ id: 52, name: "Tide Pool", Component: G052 },
	{ id: 53, name: "Echo Chamber", Component: G053 },
	{ id: 54, name: "Paper Birds", Component: G054 },
	{ id: 55, name: "Ink Spill", Component: G055 },
	{ id: 56, name: "Compass Rose", Component: G056 },
	{ id: 57, name: "Glass Garden", Component: G057 },
	{ id: 58, name: "Memory Tide", Component: G058 },
	{ id: 59, name: "Star Cartographer", Component: G059 },
	{ id: 60, name: "Shadow Theater", Component: G060 },
	{ id: 61, name: "Bus Route", Component: G061 },
	{ id: 62, name: "Crystal Growth", Component: G062 },
	{ id: 63, name: "The Curator", Component: G063 },
	{ id: 64, name: "Spelunker's Logbook", Component: G064 },
	{ id: 65, name: "Fortune Cookie", Component: G065 },
	{ id: 66, name: "Bench Press", Component: G066 },
	{ id: 67, name: "The Last Word", Component: G067 },
	{ id: 68, name: "Quiet Room", Component: G068 },
	{ id: 69, name: "Gravity Painter", Component: G069 },
	{ id: 70, name: "The Querulous Garden", Component: G070 },
	{ id: 71, name: "Drift Trade", Component: G071 },
	{ id: 72, name: "Shard Garden", Component: G072 },
	{ id: 73, name: "Tightrope", Component: G073 },
	{ id: 74, name: "Pendulum", Component: G074 },
	{ id: 75, name: "Bell Ringer", Component: G075 },
	{ id: 76, name: "Knapsack Heist", Component: G076 },
	{ id: 77, name: "Hidden Camera", Component: G077 },
	{ id: 78, name: "Tally", Component: G078 },
	{ id: 79, name: "The Translator", Component: G079 },
	{ id: 80, name: "Conducting", Component: G080 },
	{ id: 81, name: "Spores", Component: G081 },
	{ id: 82, name: "Mosaic", Component: G082 },
	{ id: 83, name: "Antiques Roadshow", Component: G083 },
	{ id: 84, name: "Sundial", Component: G084 },
	{ id: 85, name: "Punctuation", Component: G085 },
	{ id: 86, name: "Sleight", Component: G086 },
	{ id: 87, name: "Census", Component: G087 },
	{ id: 88, name: "Volcano", Component: G088 },
	{ id: 89, name: "Calligraphy", Component: G089 },
	{ id: 90, name: "Mage Duel", Component: G090 },
	{ id: 91, name: "Train Yard", Component: G091 },
	{ id: 92, name: "Tip Toes", Component: G092 },
	{ id: 93, name: "Curtain Call", Component: G093 },
	{ id: 94, name: "Mortar & Pestle", Component: G094 },
	{ id: 95, name: "Hourglass", Component: G095 },
	{ id: 96, name: "Refactor", Component: G096 },
	{ id: 97, name: "Spell Debug", Component: G097 },
	{ id: 98, name: "Stitchwork", Component: G098 },
	{ id: 99, name: "Magnetic Field", Component: G099 },
	{ id: 100, name: "Sundown", Component: G100 },
];
