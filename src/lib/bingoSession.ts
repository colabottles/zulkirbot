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
  /* Deaths */
  'Zulkir Jax dies to a trap',
  'Zulkir Jax falls off a ledge',
  'Party wipe — everyone down',
  'Resurrection shrine used',
  'Zulkir Jax dies to a blade trap',
  'Zulkir Jax dies to a boss AoE',
  'Zulkir Jax dies to a caster mob',
  'Hireling raises Zulkir Jax mid-combat',
  'Zulkir Jax dies within 10 seconds of entering a room',
  'Zulkir Jax dies to a ranged enemy',

  /* Quest events */
  'Secret door opened',
  'Zulkir Jax runs past a chest without opening it',
  'Quest completed on Elite',
  'Optionals skipped',
  'Dungeon alert turns red',
  'Hireling walks into a trap',
  'Zulkir Jax backtracks through a completed room',
  'A lever opens a secret wall with nothing behind it',
  'A timed quest objective appears',
  'Zulkir Jax gets lost',
  'Zulkir Jax rests at a shrine',
  'Zulkir Jax jumps over an enemy instead of attacking',
  'A puzzle appears on screen',
  'Zulkir Jax runs past a collectable on the ground',
  'Zulkir Jax opens a chest immediately after a boss fight',

  /* Loot */
  'An Epic item appears in the loot list',
  'A Mythic item appears in the loot list',
  'An Artifact item appears in the loot list',
  'A Purple-bordered item appears in the loot list',
  'An Orange-bordered item appears in the loot list',
  'Inventory full message appears',
  'Zulkir Jax equips new gear mid-quest',
  'Augment slot item looted',
  'Peridot picked up off the ground',
  'Zulkir Jax opens the Adventure Compendium',

  /* Visible on screen */
  'Spell point bar hits zero',
  'Action boost is used',
  'A 5th level spell is cast',
  'An enemy is sent flying off a ledge',
  'Zulkir Jax is surrounded by 5+ enemies at once',
  'Dungeon alert turns red',
  'A cutscene or NPC dialogue box appears',
  'Zulkir Jax uses a summon monster spell',
  'A demon named boss appears on screen',
  'Zulkir Jax uses a clickie item',
  'Hireling runs in the wrong direction',
  'Zulkir Jax uses a potion',

  /* Zulkir Jax says */
  'Zulkir Jax says "I should have rested"',
  'Zulkir Jax says "Let me check the wiki"',
  'Zulkir Jax says "That was my fault"',
  'Zulkir Jax says "Chat, should I?"',
  'Zulkir Jax says "I forgot about that trap"',
  'Zulkir Jax says "We skipped the optional"',
  'Zulkir Jax says "I need this for my build"',
  'Zulkir Jax says "Has anyone done this quest before?"',
  'Zulkir Jax says "I was not paying attention"',
  'Zulkir Jax swears out loud',
  'Zulkir Jax explains a mechanic to chat',
  'Zulkir Jax mentions a past life',

  /* Stream events */
  'A new subscriber appears in chat',
  'Bits are cheered in chat',
  'A raid notification appears on screen',
  'A new follower notification appears',
  'Zulkir Jax reads a chat message out loud',
  'A donation alert plays',
  'Zulkir Jax laughs out loud',
  'Zulkir Jax goes AFK mid-quest',

  /* Location */
  'Stormreach Harbor shown on screen',
  'The Marketplace shown on screen',
  'A House Kundarak, Cannith, Deneith, or Phiarlan quest entered',
  'Ravenloft loading screen appears',
  'Korthos Island shown on screen',
  'Shavarath loading screen appears',
  'Cogs of Sharn shown on screen',
  "Xen'drik loading screen appears",
  'Thunder Peaks loading screen appears',
  "King's Forest shown on screen",
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
  return `stream-${Date.now()}`;
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

/* Marks a square by 1-based index from chat (1-25), skipping FREE */
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