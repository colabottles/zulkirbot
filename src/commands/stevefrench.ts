import { BotCommand } from '../types'
import { supabase } from '../lib/supabase'

let steveFrenchActive = false

const ALLOWED_USER = 'neutralagent'

const STEVE_FRENCH_APPEARANCES = [
  `🦁 NeutralAgent whistles once. Steve French pads out of the shadows, surveys the dungeon, and sits down next to @neutralagent like he owns the place. He probably does.`,
  `🦁 Steve French arrives. He is a mountain lion. He is enormous. He is sitting very close to @neutralagent and staring at everyone else with profound disinterest.`,
  `🦁 A low rumble echoes through the dungeon. Steve French has arrived. @neutralagent scratches him behind the ears. Steve French allows this.`,
  `🦁 Steve French materializes from wherever mountain lions go when they're not being summoned. He headbutts @neutralagent affectionately and then glares at the nearest monster.`,
  `🦁 @neutralagent produces a piece of jerky. Steve French appears instantly, as if he was always there. He takes the jerky. He stays. This is his dungeon now.`,
  `🦁 @neutralagent: "Steve French is a God-given gift to this world and I won't hear otherwise." Steve French enters the dungeon. Everyone agrees immediately.`,
  `🦁 "He's not dangerous, he's just big-boned and misunderstood." Steve French proves this by sitting on a goblin. The goblin is fine. Mostly.`,
  `🦁 @neutralagent said he'd never leave Steve French behind and he meant it. Steve French pads in, surveys the dungeon, and claims it as his territory.`,
  `🦁 "Steve French is way more than just a mountain lion. He's my best friend." Steve French enters. The dungeon feels safer. And more dangerous. Simultaneously.`,
  `🦁 Steve French appears. big stoned horny kitty with the munchies.`,
]

const STEVE_FRENCH_ACTIONS = [
  `🦁 Steve French yawns, revealing teeth that are extremely large and extremely close to everyone present.`,
  `🦁 Steve French is sitting on @neutralagent's pack. @neutralagent has not asked him to move. No one is asking him to move.`,
  `🦁 Steve French makes eye contact with the nearest player and holds it for an uncomfortable amount of time.`,
  `🦁 Steve French has found a goblin. The goblin is reconsidering its life choices.`,
  `🦁 Steve French is grooming himself. Everyone nearby has decided that this is fine and that they are also fine.`,
  `🦁 Steve French paces the perimeter of the party. This is either protective or predatory. Possibly both.`,
  `🦁 Steve French sits on a treasure chest. It is his treasure chest now. This is non-negotiable.`,
  `🦁 Steve French chirps at @neutralagent. @neutralagent nods seriously, as if receiving tactical advice.`,
  `🦁 @neutralagent whispers: "He just needs some good food and some love, that's all." Steve French headbutts him and knocks him sideways. It is loving.`,
  `🦁 "Steve French doesn't mean any harm. He's just a little high-strung." Steve French is currently staring at the rogue without blinking. The rogue is sweating.`,
  `🦁 @neutralagent: "He's not gonna hurt ya, he's just smellin' ya." Steve French is smelling everyone. This takes a while. No one moves.`,
  `🦁 "You gotta talk to him gently." @neutralagent crouches down. Steve French listens. Steve French then does exactly what he was going to do anyway.`,
]

const STEVE_FRENCH_COMBAT = [
  `🦁 Steve French enters the fight. The monster looks at Steve French. Steve French looks at the monster. The monster takes 25 damage and reconsiders everything.`,
  `🦁 Steve French swipes at the enemy for 30 damage. He does not look like he was trying very hard.`,
  `🦁 Steve French pounces. The enemy takes 28 damage and a considerable amount of emotional damage as well.`,
  `🦁 Steve French growls once. The enemy takes 20 damage from sheer intimidation before Steve French even touches them.`,
  `🦁 Steve French bats at the enemy with one paw. 22 damage. He is still yawning.`,
  `🦁 @neutralagent: "Get 'em, Steve French!" Steve French does not need to be told twice. 27 damage. The monster had a bad day.`,
  `🦁 "He's not a pet, he's a companion." Steve French demonstrates the difference by dealing 25 damage with surgical precision and sitting back down calmly.`,
  `🦁 @neutralagent: "Steve French knows what he's doin', he's been in tough spots before." Steve French deals 30 damage. This is not his first dungeon.`,
  `🦁 Steve French leaps. @neutralagent covers his eyes. 28 damage. "Good boy," @neutralagent says quietly. Steve French purrs.`,
]

const pickRandom = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]

export const stevefrenchCommand: BotCommand = {
  name: 'stevefrench',
  cooldownSeconds: 30,
  handler: async (channel, username, _args, client) => {
    if (username.toLowerCase() !== ALLOWED_USER) {
      client.say(channel,
        `@${username} — Steve French does not come when called by strangers. He is very selective.`
      )
      return
    }

    if (steveFrenchActive) return
    steveFrenchActive = true

    const { data: char } = await supabase
      .from('characters')
      .select('hp, max_hp')
      .eq('twitch_username', username)
      .single()

    if (!char) return

    // Appearance
    client.say(channel, pickRandom(STEVE_FRENCH_APPEARANCES))

    await new Promise(r => setTimeout(r, 2000))

    // Action
    client.say(channel, pickRandom(STEVE_FRENCH_ACTIONS))

    await new Promise(r => setTimeout(r, 2000))

    // If in a fight, Steve French attacks
    const { activeFights } = await import('../game/engine')
    if (activeFights.has(username)) {
      const fight = activeFights.get(username)!
      const combat = pickRandom(STEVE_FRENCH_COMBAT)
      const damage = Math.floor(Math.random() * 15) + 20
      fight.monster_current_hp = Math.max(0, fight.monster_current_hp - damage)
      client.say(channel, combat)

      if (fight.monster_current_hp <= 0) {
        client.say(channel, `🦁 Steve French has ended the fight. @neutralagent nods approvingly.`)
      } else {
        client.say(channel,
          `🦁 ${fight.monster.name} has ${fight.monster_current_hp} HP remaining. Steve French is not impressed.`
        )
      }
    }

    // Small HP buff from the comfort of a mountain lion companion
    const hpBonus = 15
    const newHp = Math.min(char.max_hp, char.hp + hpBonus)
    await supabase.from('characters').update({ hp: newHp }).eq('twitch_username', username)
    await new Promise(r => setTimeout(r, 1500))
    client.say(channel,
      `🦁 Being near Steve French is oddly reassuring. @neutralagent recovers ${hpBonus} HP. (${newHp}/${char.max_hp} HP)`
    )
    steveFrenchActive = false
  }
}