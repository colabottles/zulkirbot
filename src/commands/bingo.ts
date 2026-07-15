import type { Client } from 'tmi.js';
import { markSquare, startNewSession, getActiveSession } from '../lib/bingoSession';
import { addBonusEntry, getGiveawayState } from '../lib/giveaway';

const CHANNEL = process.env.TWITCH_CHANNEL!;
const BINGO_REWARD_TITLE = 'Call a Bingo Square';

export async function handleBingo(
  client: Client,
  username: string,
  args: string[]
): Promise<void> {
  const raw = args[0];
  const squareNumber = parseInt(raw, 10);

  if (isNaN(squareNumber) || squareNumber < 1 || squareNumber > 25 || squareNumber === 13) {
    await client.say(
      CHANNEL,
      `@${username} — pick a square number between 1–25 (13 is the FREE square).`
    );
    return;
  }

  const session = await getActiveSession();
  if (!session) {
    await client.say(
      CHANNEL,
      `@${username} — no active bingo session right now. Zulkir Jax needs to start one!`
    );
    return;
  }

  const squareLabel = session.squares[squareNumber - 1];
  const result = await markSquare(squareNumber);

  if (!result) {
    await client.say(
      CHANNEL,
      `@${username} — couldn't mark that square. Try again!`
    );
    return;
  }

  if (result.alreadyMarked) {
    await client.say(
      CHANNEL,
      `@${username} — square ${squareNumber} ("${squareLabel}") is already marked!`
    );
    return;
  }

  await client.say(
    CHANNEL,
    `@${username} marked square ${squareNumber}: "${squareLabel}" 🎲`
  );

  if (result.isWin) {
    await client.say(
      CHANNEL,
      `🎉 BINGO! The card is complete! Well met, adventurers! PogChamp`
    );

    // Add a bonus giveaway entry for the viewer who completed the card
    if (getGiveawayState().active) {
      addBonusEntry(username);
      await client.say(
        CHANNEL,
        `🎲 @${username} earned a bonus giveaway entry for completing the bingo card!`
      );
    }
  }
}

export async function handleBingoStart(
  client: Client,
  username: string,
  broadcasterName: string
): Promise<void> {
  if (username.toLowerCase() !== broadcasterName.toLowerCase()) {
    return;
  }

  const session = await startNewSession();

  if (!session) {
    await client.say(CHANNEL, 'Failed to start a new bingo session. Check the logs.');
    return;
  }

  await client.say(
    CHANNEL,
    `🎲 New bingo card is live! Redeem "${BINGO_REWARD_TITLE}" and type !bingo <1–25> to mark a square.`
  );
}