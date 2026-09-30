/**
 * Speech lines of the title-screen lab (lib/world/title-life.ts): Jade, the
 * MCP and the bots comment on what happens. German: lib/i18n/de/title.ts.
 */
import { tr } from "@/lib/i18n";

export const JADE_LINES = {
  repairStart: [
    tr("Okay. You and me."),
    tr("Hold still…"),
    tr("Where's the 7 mm?"),
    tr("Let's see what you've got."),
  ],
  repairFail: [
    tr("Oh, come ON."),
    tr("Who designed this? … Oh. Me."),
    tr("Not today, apparently."),
    tr("That was the wrong wire."),
    tr("Great. Now it's smoking."),
  ],
  repairSuccess: [
    tr("Ha! Got you!"),
    tr("And THAT is science."),
    tr("Purring like a cat."),
    tr("Fixed. Nobody saw the tape."),
  ],
  deviceBreak: [
    tr("Seriously?"),
    tr("That smell is new."),
    tr("Was that… important?"),
    tr("No no no no."),
  ],
  thanksDrink: [
    tr("You're a lifesaver, B4C-0N!"),
    tr("Coffee. Finally."),
    tr("Cardamom? … Damien's recipe."),
  ],
  thanksHelp: [tr("Thanks, P1N-DR0. Hold the light there."), tr("Teamwork!")],
  spin: [tr("Wheee—"), tr("Productive thinking."), tr("Don't tell the MCP.")],
  tired: [tr("Five more minutes…"), tr("*yawn*"), tr("Is it 3 a.m. again?")],
  think: [
    tr("Hmm… inverted."),
    tr("847 Hz. Again."),
    tr("What if… no."),
    tr("Where did I put the notes?"),
  ],
  idea: [tr("Oh! Of course!"), tr("Wait — that's it!")],
  bored: [tr("The lab is… quiet."), tr("Anybody? No? Okay.")],
  mischief: [tr("W2-REK! My chair!"), tr("Hey! I was thinking!")],
  careful: [tr("Careful!"), tr("That was a full crate…")],
  explosion: [
    tr("…okay. Prototype four."),
    tr("Nobody saw that."),
    tr("At least it was a small one."),
  ],
  greetBot: [tr("Hey there!"), tr("Morning, little one."), tr("Found anything?")],
  coffeeBroken: [tr("The coffee machine. Not the coffee machine!")],
  drink: [tr("Ahh."), tr("Better.")],
} as const;

export const MCP_LINES = {
  snark: [
    tr("Structural integrity: questionable."),
    tr("Coffee consumption: statistically alarming."),
    tr("Dr. Lawrence, the manual exists."),
    tr("Logging this as “educational”."),
    tr("Humming at 847 Hz. As usual."),
  ],
  spin: [tr("Please stop spinning. My sensors get dizzy.")],
  afterFail: [tr("I had put 12 % on that."), tr("Noted. Again.")],
  afterSuccess: [tr("Acceptable."), tr("Congratulations. Mildly.")],
  afterBreak: [tr("That was not me."), tr("I did warn you. Internally.")],
} as const;

export const BOT_LINES: Readonly<Record<string, readonly string[]>> = {
  b4c0n: [tr("Almost is just another word for soon!"), tr("♪ Beep-boop, coffee!")],
  p1ndr0: [tr("Never give up!"), tr("Holding the light!")],
  f1ndr: [tr("Scanning…"), tr("Ping… ping…")],
  w2rek: [tr("Click-click."), tr("*skitter*")],
  k2ldr: [tr("Index card 4711!"), tr("Filed under: urgent.")],
};
