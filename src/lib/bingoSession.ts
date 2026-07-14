import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FREE_INDEX = 12;
const TOTAL_CELLS = 25;

export interface BingoSession {
  id: string;
  session_id: string;
  squares: string[];
  marked: boolean[];
  active: boolean;
  created_at: string;
}

/* All DDO bingo square pool */
const SQUARE_POOL: string[] = [
  /* Deaths & disaster */
  'Zulkir Jax dies to a trap',
  'Falls off a ledge',
  'Killed by own hireling',
  'Lag death',
  '"I should have rested"',
  'Party wipe',
  'Reaper death',
  'Dungeon alert maxes out',
  '"That was my fault"',
  'Killed by a mob',
  'Knocked off a bridge',
  'Died to a blade trap',
  'Swarmed by skeletons',
  '"I forgot to turn on Reaper Mode"',
  'Resurrection sickness acquired',
  'Last party member standing',
  'Raised mid-combat',
  'Died to a boss AoE',
  '"I wasn\'t paying attention"',

  /* Quests & gameplay */
  'Elite skull run',
  'Ransack a chest',
  'Bonus XP objective missed',
  'Secret door found',
  'Optionals completed',
  'Zerg run attempt',
  'Shrine camping',
  'Backtracked at least once',
  'Hirelings get stuck',
  'End reward skipped',
  '"We skipped the optional"',
  'Wilderness area entered',
  'Collectable grabbed off the ground',
  'Voice of the Master referenced',
  'Voluntary self-destruct to reset',
  '"Let me check the wiki"',
  'Lever puzzle causes confusion',
  'Wrong door opened',
  'Running out of time on a timed quest',
  'Dungeon alert triggered on entry',
  'Chest opened with no key',

  /* Loot & economy */
  'Named item drops',
  'Artifact pulled from chest',
  'Augment slot item found',
  'Crafting bench visited',
  '"I need this for my build"',
  'Sold something by accident',
  'Inventory is full',
  'Astral Shard spent',
  'New gear equipped mid-quest',
  'Green Steel item mentioned',
  'Cannith Crafting invoked',
  'Collectables turned in',
  '"That rolled terrible stats"',
  'Random loot better than named',
  'Draconic rune found',
  'Trophy dropped from rare',
  'Sentient gem referenced',
  'Cosmetic armor skin equipped',

  /* Social & stream */
  'Someone donates',
  'New follower',
  'Zulkir Jax reads chat mid-fight',
  'Death followed by silence',
  '"Good fight"',
  'Rule of Three invoked',
  'Someone in chat says GG',
  'NeutralAgent takes damage from a trap',
  'Zulkir Jax quotes a spell name',
  'Lore explanation given',
  'NPC voice imitated',
  'Raid team assembled',
  '"Has anyone done this quest before?"',
  'Someone in party afk',
  'Zulkir Jax explains a mechanic twice',
  'Sub train happens',
  'Bits cheered',
  '"Chat, should I?"',
  'Someone asks what class Zulkir Jax is',
  'Zulkir Jax laughs at his own death',
  'First-time viewer says hello',

  /* Class & build */
  'Action boost used',
  'Spell point bar empty',
  'Lay on Hands saves the day',
  'Adrenaline popped',
  'Sneak attack mentioned',
  'Metamagic clicked wrong',
  'Rage ends at worst moment',
  'Mass Hold lands perfectly',
  'Warlock Eldritch Blast mentioned',
  'Reaper enhancement taken',
  'Destiny ability used',
  'Past life feat referenced',
  'TR (True Reincarnation) mentioned',
  'Iconic hero discussed',
  'Universal tree ability used',
  'Draconic Incarnation invoked',
  'Cores explained to chat',
  '"I\'m still leveling the tree"',

  /* Environment */
  'Korthos referenced',
  'Stormreach Harbor visited',
  'Marketplace mentioned',
  'House K, C, D, or P referenced',
  'Eberron lore explained',
  'Xen\'drik dungeon entered',
  'Shavarath reference',
  'Undead Asylum run',
  'Ravenloft dungeon entered',
  'Feywild referenced',
  'Forgotten Realms content mentioned',
  'Cogs of Sharn visited',
  'Eveningstar mentioned',
  'Thunder Peaks dungeon run',
  'Stormhorns wilderness area',
  'Wheloon Prison referenced',
  'Devil Battlefield mentioned',
  'King\'s Forest entered',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildSquares(): string[] {
  const pool = shuffle(SQUARE_POOL).slice(0, TOTAL_CELLS - 1);
  const squares: string[] = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    squares.push(i === FREE_INDEX ? 'FREE Square' : pool.shift()!);
  }
  return squares;
}

export function buildSessionId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `stream-${y}-${m}-${d}`;
}

/* Deactivates any current active session, then inserts a fresh one */
export async function startNewSession(): Promise<BingoSession | null> {
  await supabase
    .from('bingo_sessions')
    .update({ active: false })
    .eq('active', true);

  const squares = buildSquares();
  const marked = new Array<boolean>(TOTAL_CELLS).fill(false);
  marked[FREE_INDEX] = true;

  const { data, error } = await supabase
    .from('bingo_sessions')
    .insert({
      session_id: buildSessionId(),
      squares,
      marked,
      active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('[bingoSession] startNewSession error:', error.message);
    return null;
  }

  return data as BingoSession;
}

export async function getActiveSession(): Promise<BingoSession | null> {
  const { data, error } = await supabase
    .from('bingo_sessions')
    .select('*')
    .eq('active', true)
    .single();

  if (error) {
    console.error('[bingoSession] getActiveSession error:', error.message);
    return null;
  }

  return data as BingoSession;
}

/* Marks a square by 1-based index from chat (1–25), skipping FREE */
export async function markSquare(
  squareNumber: number
): Promise<{ session: BingoSession; alreadyMarked: boolean; isWin: boolean } | null> {
  const index = squareNumber - 1;

  if (index < 0 || index >= TOTAL_CELLS || index === FREE_INDEX) {
    return null;
  }

  const session = await getActiveSession();
  if (!session) return null;

  const alreadyMarked = session.marked[index];
  const marked = [...session.marked];
  marked[index] = true;

  const { data, error } = await supabase
    .from('bingo_sessions')
    .update({ marked })
    .eq('id', session.id)
    .select()
    .single();

  if (error) {
    console.error('[bingoSession] markSquare error:', error.message);
    return null;
  }

  const updated = data as BingoSession;
  return {
    session: updated,
    alreadyMarked,
    isWin: checkWin(updated.marked),
  };
}

/* Win lines: rows, columns, diagonals */
const WIN_LINES: number[][] = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

export function checkWin(marked: boolean[]): boolean {
  return WIN_LINES.some(line => line.every(i => marked[i]));
}