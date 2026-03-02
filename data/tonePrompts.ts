
import { MemeTone } from '../types';

export const TONE_PROMPTS: Record<MemeTone, string> = {
  Funny: `
    STYLE: A structured, clever parody. The user is clearly a caricature inserted into a serious scene, looking slightly bewildered or out of place.
    TEXT: Relies on witty puns and clever wordplay.
    EXAMPLE: Title: "THE EXTERMINTARO", Tagline: "He'll be back... right after his nap.", Credits: "Directed by Justin Case • Produced by Hazel Nutt"
  `,
  Funnier: `
    STYLE: Absolute, absurd slapstick. Extreme physical caricature (bug-eyes, ridiculous proportions), holding household items instead of weapons.
    TEXT: Totally farcical and over-the-top.
    EXAMPLE: Title: "TERMINATOR: SALVATION ARMY", Tagline: "I'll be back... for your donations.", Credits: "Directed by Phil McCracken • Produced by Anita Bath"
  `,
  'Dumb Funny': `
    STYLE: So stupid it's hilarious. Think bad puns, ridiculous situations, and completely nonsensical elements.
    TEXT: Childish humor, terrible dad jokes, and non-sequiturs.
    EXAMPLE: Title: "THE TURMINATOR", Tagline: "He'll be back... to return this blender.", Credits: "Directed by A. Potato • Produced by Some Guy"
  `
};
