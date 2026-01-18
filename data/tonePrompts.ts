
import { MemeTone } from '../types';

export const TONE_PROMPTS: Record<MemeTone, string> = {
  Funny: `
    STYLE: Satirical, absurd, self-deprecating, and 80s parody (like 'The Naked Gun' or 'Airplane!').
    INSTRUCTIONS:
    - Movie Title: Must be a ridiculous pun or an overly literal description of the situation.
    - Slogan: A complete non-sequitur or a joke about the hero's incompetence.
    - Cover Text: Describe a mundane, low-stakes situation as if it were a global catastrophe.
    - EXAMPLE: Title: "DIE HARDLY", Slogan: "He forgot his pants.", Plot: "When the office coffee machine breaks, one accountant must type faster than ever before."
  `,
  Action: `
    STYLE: Gritty 90s blockbuster, high-octane, intense, and overly masculine (like 'Die Hard' or 'Taken').
    INSTRUCTIONS:
    - Movie Title: Short, punchy, aggressive words (e.g., 'VENGEANCE', 'PROTOCOL', 'IMPACT').
    - Slogan: Must start with "One man...", "In a world...", or "This time...".
    - Cover Text: Describe an impossible mission involving terrorists, nuclear devices, or rogue agents.
    - EXAMPLE: Title: "MAXIMUM FORCE", Slogan: "This time, it's personal.", Plot: "They stole his daughter's hamster. Now he's burning the city to the ground."
  `,
  Horror: `
    STYLE: Psychological thriller, ominous, A24 aesthetic, or 80s Slasher.
    INSTRUCTIONS:
    - Movie Title: Abstract, single nouns or "The [Noun]" (e.g., 'THE SILENCE', 'HEREDITARY').
    - Slogan: A chilling warning or a cryptic message.
    - Cover Text: Suggest an ancient curse, isolation, or a past sin coming back to haunt the protagonist. Use words like 'whispers', 'shadows', 'blood'.
    - EXAMPLE: Title: "THE GUEST", Slogan: "Don't let him in.", Plot: "The house was supposed to be empty. But the walls have eyes, and they are hungry."
  `,
  Romance: `
    STYLE: Cheesy Hallmark movie, melodramatic, weeping tragedy, or steamy paperback novel.
    INSTRUCTIONS:
    - Movie Title: Two words connected by 'Of', 'In', or 'Forever' (e.g., 'WINDS OF PASSION').
    - Slogan: About destiny, forbidden love, or secrets.
    - Cover Text: A misunderstanding between a small-town girl and a big-city executive (or similar trope).
    - EXAMPLE: Title: "AUTUMN WHISPERS", Slogan: "Love waits for no one.", Plot: "She was a baker who loved Christmas. He was a CEO who hated joy. Together, they found the recipe for love."
  `
};
