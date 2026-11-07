export type Pos = 'C' | 'LW' | 'RW' | 'D' | 'G';

export type Personality = 'profesionalec' | 'ambiciozen' | 'zvest' | 'temperamenten' | 'vodja' | 'individualist' | 'delaven' | 'nezanesljiv' | 'uravnotezen';

export interface Attrs {
  // tehnični
  skating: number;
  shooting: number;
  passing: number;
  puckHandling: number;
  faceoffs: number;
  blocking: number;
  // mentalni
  decisions: number;
  positioning: number;
  workRate: number;
  leadership: number;
  aggression: number;
  // fizični
  strength: number;
  speed: number;
  stamina: number;
  // golman
  reflexes: number;
  gPositioning: number;
  reboundControl: number;
  puckPlay: number;
}

export interface SkaterStats {
  gp: number;
  g: number;
  a: number;
  pim: number;
  pm: number;
  sog: number;
  // golman
  sa: number;
  ga: number;
  w: number;
  so: number;
}

export interface Player {
  id: string;
  first: string;
  last: string;
  nat: string;
  clubId: string | null;
  number: number;
  pos: Pos;
  shoots: 'L' | 'D';
  birthYear: number;
  attrs: Attrs;
  potential: number; // 1-100
  ovr: number; // 1-100
  morale: number; // 0-100
  form: number; // -2..+2 (zadnje tekme)
  energy: number; // 0-100 svežina med tekmami
  injuryDays: number;
  wage: number; // €/mes
  contractUntil: number; // leto
  isAI: boolean;
  photo?: string; // pot do portreta, npr. /igralci/luka-ferjan.jpg
  personality?: Personality;
  benchStreak?: number; // zaporedne tekme brez igranja ali v 4. napadu
  mentorId?: string;
  listed?: boolean; // na seznamu za prodajo
  youth?: 'U20' | 'U18'; // igralec mladinske šole
  homegrown?: string;
  negotiations?: number;
  lastTalk?: string;
  loan?: { from: string; until: number };
  abroad?: { club: string; league: string; since: number };
  sellOn?: { clubId: string; pct: number };
  awayDays?: number; // odsoten zaradi reprezentance
  caps?: { event: string; team: string; gp: number; g: number; a: number; place: number }[]; // klub, v katerem je bil vzgojen
  story?: { date: string; text: string }[];
  stats: SkaterStats; // tekoča sezona
  history: { season: string; clubId: string; stats: SkaterStats }[];
}

export interface Arena {
  name: string;
  city: string;
  capacity: number;
}

export interface Club {
  id: string;
  name: string;
  short: string;
  city: string;
  country: 'SLO' | 'HR' | 'SRB';
  color: string;
  arena: Arena;
  reputation: number; // 1-100
  budget: number; // 1-5
  boardGoal: string;
}

export interface Lines {
  f: [string, string, string][]; // 4 napadi: LW, C, RW
  d: [string, string][]; // 3 pari
  g: [string, string]; // začetni, rezerva
  pp: { f: [string, string, string]; d: [string, string] }[]; // 2 enoti
  pk: { f: [string, string]; d: [string, string] }[]; // 2 enoti
}

export type Forecheck = 'agresiven' | 'uravnotezen' | 'pasiven';
export type Tempo = 'hiter' | 'normalen' | 'pocasen';

export interface Tactics {
  forecheck: Forecheck;
  tempo: Tempo;
  lineUsage: [number, number, number, number]; // deleži minutaže napadov
  pull?: 'zgodaj' | 'normalno' | 'pozno'; // kdaj umakniti golmana
  lineMatch?: boolean; // najboljši napad proti najboljšemu napadu nasprotnika
}

export interface Fixture {
  id: string;
  date: string; // YYYY-MM-DD
  round: number;
  home: string;
  away: string;
  stage: 'redni' | 'cetrtfinale' | 'polfinale' | 'finale' | 'prijateljska';
  seriesId?: string;
  played: boolean;
  result?: MatchResult;
}

export interface GoalEvent {
  t: number; // sekunda
  team: 'home' | 'away';
  scorer: string;
  assists: string[];
  strength: 'EV' | 'PP' | 'SH' | 'EN';
}

export interface MatchResult {
  hg: number;
  ag: number;
  ot: boolean;
  so: boolean;
  hShots: number;
  aShots: number;
  goals: GoalEvent[];
  attendance: number;
  // poročilo s tekme (starejše tekme ga morda nimajo)
  shotsByPeriod?: { home: number[]; away: number[] };
  penalties?: { t: number; team: 'home' | 'away'; playerId: string; min: number; reason: string }[];
  // [id, ekipa 0=domači 1=gostje, goli, podaje, +/-, KM, streli, streli na golmana, prejeti]
  box?: [string, 0 | 1, number, number, number, number, number, number, number][];
  shootout?: { team: 'home' | 'away'; playerId: string; scored: boolean }[];
  goalies?: { home: string; away: string };
}

export interface Series {
  id: string;
  stage: 'cetrtfinale' | 'polfinale' | 'finale';
  high: string; // višje uvrščen
  low: string;
  winsNeeded: number;
  hw: number;
  lw: number;
  winner?: string;
}

export interface NewsItem {
  id: string;
  date: string;
  title: string;
  body: string;
  kind: 'liga' | 'garderoba' | 'uprava' | 'tekma' | 'prestopi' | 'mediji' | 'klub';
  read: boolean;
  fixtureId?: string;
}

export interface Manager {
  first: string;
  last: string;
  nat: string;
  age: number;
  background: 'reprezentant' | 'igralec' | 'brez';
  style: 'napadalni' | 'uravnotezen' | 'obrambni';
  reputation: number;
}

export interface Standing {
  clubId: string;
  gp: number;
  w: number;
  otw: number;
  otl: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

export interface ClubFinance {
  balance: number;
  wageBudget: number; // €/mes za plače
  prices: { regular: number; derby: number; playoff: number };
  sponsor: { name: string; monthly: number; playoffBonus: number; titleBonus: number };
  ledger: Record<string, Record<string, number>>; // 'YYYY-MM' -> postavka -> znesek (+ prihodek, - odhodek)
}

export interface DecisionOption {
  label: string;
  effect: string; // ključ učinka, ki ga razreši engine/events.ts
}

export interface Decision {
  id: string;
  date: string;
  kind: 'garderoba' | 'konferenca' | 'uprava';
  title: string;
  body: string;
  options: DecisionOption[];
  playerId?: string;
  otherId?: string;
  fixtureId?: string;
  blocking: boolean; // ustavi "Nadaljuj"
  expires?: string;
}

export interface PromiseItem {
  playerId: string;
  type: 'vloga' | 'okrepitve';
  until: string;
}

export interface SeasonRecord {
  season: string;
  champion: string;
  regularWinner: string;
  awards?: import('./awards').Award[];
  final?: string; // npr. "3:1"
  runnerUp?: string;
  topScorer?: { name: string; clubId: string; pts: number; g: number; a: number };
  topGoals?: { name: string; clubId: string; g: number };
  bestGoalie?: { name: string; clubId: string; svp: number; gaa: number };
  userFinish: number;
  userClubId: string;
}

export interface Legend {
  name: string;
  clubId: string;
  pos: Pos;
  seasons: number;
  gp: number;
  g: number;
  a: number;
  retired: string;
}

export interface InfraLevels {
  training: number;
  youth: number;
  medical: number;
  scouting: number;
  marketing: number;
}

export interface InfraProject {
  key: keyof InfraLevels | 'arena';
  clubId: string;
  finish: string;
  cost: number;
  seats?: number;
}

export interface ClubRecordStats {
  titles: number;
  seasons: number;
  gp: number;
  w: number;
  pts: number;
  gf: number;
  ga: number;
  biggestWin?: { score: string; vs: string; season: string; diff: number };
}

export interface GameState {
  version: number;
  seed: number;
  manager: Manager;
  userClubId: string;
  seasonYear: number; // 2026 = sezona 2026/27
  date: string;
  phase: 'redni' | 'koncnica' | 'konec' | 'poletje';
  clubs: Club[];
  players: Record<string, Player>;
  lines: Record<string, Lines>;
  tactics: Record<string, Tactics>;
  fixtures: Fixture[];
  series: Series[];
  news: NewsItem[];
  champion?: string;
  pastChampions: { season: string; clubId: string }[];
  finance: Record<string, ClubFinance>;
  // v2: slačilnica, mediji, infrastruktura, zgodovina
  decisions?: Decision[];
  promises?: PromiseItem[];
  fans?: number; // podpora navijačev 0-100 (tvoj klub)
  board?: number; // zaupanje uprave 0-100
  infra?: Record<string, InfraLevels>;
  projects?: InfraProject[];
  seasonRecords?: SeasonRecord[];
  legends?: Legend[];
  clubRecords?: Record<string, ClubRecordStats>;
  staff?: Record<string, import('./staff').Staff>;
  achievements?: { id: string; date: string }[];
  training?: Record<string, import('./training').TrainingPlan>;
  chem?: Record<string, number>;
  challenge?: import('./challenges').Challenge;
  scout?: { known: Record<string, number>; tasks: { playerId: string; until: string }[] };
  prediction?: { season: number; order: string[] };
  lastAwards?: { season: string; list: import('./awards').Award[] };
  captains?: Record<string, { c?: string; a: string[] }>;
  career?: import('./career').CareerEntry[];
  unemployed?: boolean;
  sponsorOffers?: { name: string; monthly: number; playoffBonus: number; titleBonus: number }[];
  national?: { event: 'U18' | 'U20' | 'SP'; year: number; squads: Record<string, string[]> };
  counters?: { buys: number; frees: number; sales?: number };
  sales?: Record<string, import('./sales').SaleListing>;
  managerStats?: { gp: number; w: number; l: number; titles: number; seasons: number };
  streak?: number; // + zmage zapored, - porazi zapored (tvoj klub)
  pressDone?: string[]; // id tekem, kjer je bila konferenca
  pressMood?: { fixtureId: string; mood: 'confident' | 'humble' };
  pressRecent?: string[];
  agreedFees?: Record<string, number>; // dogovorjene odškodnine s klubi
  youth?: Record<string, Player>;
  youthFixtures?: YouthFixture[];
}

export interface YouthFixture {
  id: string;
  date: string;
  league: 'U20' | 'U18';
  home: string;
  away: string;
  hg?: number;
  ag?: number;
  ot?: boolean;
}
