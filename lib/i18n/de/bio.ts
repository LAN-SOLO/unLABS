/**
 * German translations — area "bio" (biorhythm: Jade's needs, Food Replicator,
 * Neutro-Fridge, bed, ergometer). Key = exact English source string from `tr("…")`.
 */
export const DE_BIO: Record<string, string> = {
  // ── Achievements ──
  "Healthy Mind": "Gesunder Geist",
  "Get Jade balanced: every need at 60 or more and fitness at 70 or more (biorhythm).":
    "Bring Jade ins Gleichgewicht: jedes Bedürfnis auf 60 oder mehr und Fitness auf 70 oder mehr (Bio-Rhythmus).",
  "Morning Workout": "Frühsport",
  "Sleep in your bed, then train on the ergometer right after waking up.":
    "Schlaf in deinem Bett und trainiere gleich nach dem Aufwachen auf dem Ergometer.",

  // ── Provisions ──
  "Nutrient Bar": "Nährriegel",
  "Printed oats, nuts and something the replicator calls “flavour”. Filling.":
    "Gedruckter Hafer, Nüsse und etwas, das der Replikator »Geschmack« nennt. Sättigt.",
  "Water Bottle": "Wasserflasche",
  "Filtered water from the deep aquifer, bottled by the replicator. Tastes of rock.":
    "Gefiltertes Wasser aus dem tiefen Grundwasserleiter, vom Replikator abgefüllt. Schmeckt nach Fels.",
  "Protein Shake": "Protein-Shake",
  "Vanilla, allegedly. Fills a little, quenches a little — and the next workout counts more.":
    "Vanille, angeblich. Sättigt ein bisschen, löscht ein bisschen den Durst — und das nächste Training zählt mehr.",
  Provision: "Proviant",
  "Provisions (biorhythm)": "Proviant (Bio-Rhythmus)",

  // ── Rules (lib/world/biorhythm.ts) ──
  "Thirsty: a water bottle from the Food Replicator in the kitchen helps (+{n}).":
    "Durstig: Eine Wasserflasche vom Food-Replikator in der Küche hilft (+{n}).",
  "Hungry: a nutrient bar from the replicator restores +{n}.":
    "Hungrig: Ein Nährriegel aus dem Replikator bringt +{n}.",
  "Tired: a nap in your bed in Jade's Quarters restores rest fully.":
    "Müde: Ein Nickerchen in deinem Bett in Jades Quartier stellt die Erholung ganz wieder her.",
  "The ergometer in Jade's Quarters builds fitness (+{n} per workout).":
    "Das Ergometer in Jades Quartier baut Fitness auf (+{n} pro Training).",
  "Keep every need above {min} and fitness above {fit} for a small bonus.":
    "Halte jedes Bedürfnis über {min} und die Fitness über {fit} — dafür gibt es einen kleinen Bonus.",
  "Balanced: you walk a little faster. Nicely done.":
    "Ausgeglichen: Du gehst ein wenig schneller. Gut gemacht.",
  "The replicator does not know that recipe.": "Dieses Rezept kennt der Replikator nicht.",
  "The replicator needs at least {w} W on the grid.":
    "Der Replikator braucht mindestens {w} W im Netz.",
  "The print head is still cooling down.": "Der Druckkopf kühlt noch ab.",
  "Your bag already holds {n}. Eat one or put some in the Neutro-Fridge.":
    "In deiner Tasche sind schon {n}. Iss einen oder leg etwas in den Neutro-Fridge.",
  "The replicator hums and prints: {name}.": "Der Replikator summt und druckt: {name}.",
  "Jade is neither hungry nor thirsty yet.": "Jade hat noch weder Hunger noch Durst.",
  "No coffee at hand.": "Kein Kaffee zur Hand.",
  "Coffee from the singularity bus. Warm, bitter, awake.":
    "Kaffee vom Singularitätsbus. Warm, bitter, wach.",
  "That is not edible.": "Das ist nicht essbar.",
  "The fridge has none of that.": "Davon ist nichts im Kühlschrank.",
  "None left in the bag.": "Davon ist nichts mehr in der Tasche.",
  "{name}, fresh and cold from the Neutro-Fridge.":
    "{name}, frisch und kalt aus dem Neutro-Fridge.",
  "{name} — eaten.": "{name} — gegessen.",
  "{name} — drunk.": "{name} — getrunken.",
  "The Neutro-Fridge is full ({n}).": "Der Neutro-Fridge ist voll ({n}).",
  "Stored in the Neutro-Fridge.": "Im Neutro-Fridge verstaut.",
  "Taken along.": "Eingepackt.",
  "Jade is not tired.": "Jade ist nicht müde.",
  "Still too awake to sleep (rest {v} of {max}).":
    "Noch zu wach zum Schlafen (Erholung {v} von {max}).",
  "A few minutes of real sleep. The lab hummed on without you. You feel rested.":
    "Ein paar Minuten echter Schlaf. Das Labor hat ohne dich weitergesummt. Du fühlst dich erholt.",
  "Jade feels fit enough for now.": "Jade fühlt sich gerade fit genug.",
  "Catch your breath first.": "Erst mal durchatmen.",
  "Ten minutes on the ergometer — the shake kicks in. Legs burning, head clear.":
    "Zehn Minuten auf dem Ergometer — der Shake wirkt. Die Beine brennen, der Kopf ist klar.",
  "Ten minutes on the ergometer. Legs burning, head clear.":
    "Zehn Minuten auf dem Ergometer. Die Beine brennen, der Kopf ist klar.",

  // ── Barks ──
  "My stomach is filing a complaint. The replicator in the kitchen, maybe.":
    "Mein Magen legt Beschwerde ein. Vielleicht der Replikator in der Küche.",
  "Throat like the dust in the archive. Water. Soon.":
    "Kehle wie der Staub im Archiv. Wasser. Bald.",
  "My eyes are closing on their own. A short nap wouldn't hurt.":
    "Mir fallen die Augen von allein zu. Ein kurzes Nickerchen würde nicht schaden.",
  "Stiff as a lab stool. The ergometer upstairs is waiting.":
    "Steif wie ein Laborhocker. Das Ergometer oben wartet.",
  "Dr. Lawrence, your vital estimates are below baseline. The canteen is on Level +1.":
    "Dr. Lawrence, Ihre geschätzten Vitalwerte liegen unter dem Ausgangswert. Die Kantine ist auf Ebene +1.",
  "Reminder: humans require food, water and sleep. I merely require you.":
    "Erinnerung: Menschen benötigen Nahrung, Wasser und Schlaf. Ich benötige lediglich Sie.",
  "Staff are reminded that fainting in the corridors is not a break.":
    "Das Personal wird daran erinnert, dass Ohnmachtsanfälle in den Fluren keine Pause sind.",

  // ── Codex ──
  Biorhythm: "Bio-Rhythmus",
  "Food · drink · sleep · fitness": "Essen · Trinken · Schlafen · Fitness",
  "From your first visit to Level +1 Jade has four needs: satiation, hydration, rest and fitness (0–100). They drop slowly with play time — per minute {food} satiation, {drink} hydration, {rest} rest and {fit} fitness. The setting Game → Biorhythm halves that (relaxed) or switches it off.":
    "Ab deinem ersten Besuch auf Ebene +1 hat Jade vier Bedürfnisse: Sättigung, Flüssigkeit, Erholung und Fitness (0–100). Sie sinken langsam mit der Spielzeit — pro Minute {food} Sättigung, {drink} Flüssigkeit, {rest} Erholung und {fit} Fitness. Die Einstellung Spiel → Bio-Rhythmus halbiert das (entspannt) oder schaltet es ab.",
  "It is gentle by design: nothing is ever blocked, damaged or lost. A need below {low} only slows your walk a little (×{slow}); every need at {min}+ and fitness at {fit}+ counts as balanced and speeds you up a bit (×{fast}).":
    "Er ist bewusst sanft: Nichts wird je blockiert, beschädigt oder verloren. Ein Bedürfnis unter {low} verlangsamt dich nur ein wenig (×{slow}); jedes Bedürfnis ab {min} und Fitness ab {fit} gilt als ausgeglichen und macht dich etwas schneller (×{fast}).",
  Where: "Wo",
  "What it does": "Was es bewirkt",
  "Food Replicator (Canteen)": "Food-Replikator (Kantine)",
  "Prints a nutrient bar (+{bar} satiation), a water bottle (+{water} hydration) or a protein shake (+{sf} satiation, +{sd} hydration, next workout ×{pb}). Needs {w} W, one print every {cd} s, up to {carry} of each in your bag.":
    "Druckt einen Nährriegel (+{bar} Sättigung), eine Wasserflasche (+{water} Flüssigkeit) oder einen Protein-Shake (+{sf} Sättigung, +{sd} Flüssigkeit, nächstes Training ×{pb}). Braucht {w} W, ein Druck alle {cd} s, bis zu {carry} von jeder Sorte in der Tasche.",
  "Neutro-Fridge (Canteen)": "Neutro-Fridge (Kantine)",
  "Stores up to {cap} provisions. Eaten straight from the fridge they are fresh and restore {p} % more. Nothing ever spoils.":
    "Lagert bis zu {cap} Portionen Proviant. Direkt aus dem Kühlschrank verzehrt sind sie frisch und bringen {p} % mehr. Nichts verdirbt.",
  "Your bed (Jade's Quarters)": "Dein Bett (Jades Quartier)",
  "Sleep when rest is below {below}: rest back to 100, {min} minutes of play time pass (respawns and cooldowns advance too).":
    "Schlafen, wenn die Erholung unter {below} liegt: Erholung zurück auf 100, dabei vergehen {min} Minuten Spielzeit (Nachwachsen und Abklingzeiten laufen mit).",
  "Ergometer (Jade's Quarters)": "Ergometer (Jades Quartier)",
  "+{gain} fitness per workout (every {cd} s), costs a little hydration and rest.":
    "+{gain} Fitness pro Training (alle {cd} s), kostet etwas Flüssigkeit und Erholung.",
  Coffee: "Kaffee",
  "Drinkable from the inventory: +{d} hydration, +{r} rest.":
    "Aus dem Inventar trinkbar: +{d} Flüssigkeit, +{r} Erholung.",

  // ── Map & models ──
  "Jade's Bed": "Jades Bett",
  Ergometer: "Ergometer",
  "Food Replicator": "Food-Replikator",
  "The Food Replicator needs at least 50 W on the grid.":
    "Der Food-Replikator braucht mindestens 50 W im Netz.",
  "Neutro-Fridge": "Neutro-Fridge",
  "screen::FOOD": "ESSEN",

  // ── Settings, hint, MCP ──
  "bio::Normal": "normal",
  "bio::Relaxed": "entspannt",
  "Jade's food, drink, sleep and fitness — relaxed halves the decay, off hides it":
    "Jades Essen, Trinken, Schlaf und Fitness — entspannt halbiert den Abfall, aus blendet ihn aus",
  "hint::Biorhythm": "Bio-Rhythmus",
  "Jade now gets hungry, thirsty and tired — slowly. The Food Replicator in the kitchen, the Neutro-Fridge, your bed and the ergometer keep her going. Low needs only slow you a little; nothing is ever lost. Click the bio meters in the status panel for details.":
    "Jade bekommt jetzt Hunger, Durst und wird müde — langsam. Der Food-Replikator in der Küche, der Neutro-Fridge, dein Bett und das Ergometer halten sie in Schwung. Niedrige Werte bremsen dich nur ein wenig; verloren geht nie etwas. Klick auf die Bio-Anzeigen im Statusfeld für Details.",
  "MCP: Dr. Lawrence, welcome to the Living Quarters. From now on I will keep an eye on your food, water and sleep. Gently.":
    "MCP: Dr. Lawrence, willkommen in den Wohnquartieren. Ab jetzt behalte ich Ihr Essen, Ihr Wasser und Ihren Schlaf im Auge. Behutsam.",

  // ── UI (components/world/BioPanels.tsx) ──
  "bio::Satiation": "Sättigung",
  "bio::Hydration": "Flüssigkeit",
  "bio::Rest": "Erholung",
  "bio::Fitness": "Fitness",
  "bio::Worn out": "Erschöpft",
  "bio::Balanced": "Ausgeglichen",
  "bio::Fine": "In Ordnung",
  "{text} ({gains})": "{text} ({gains})",
  "Biorhythm — {status} (click for details)": "Bio-Rhythmus — {status} (Klick für Details)",
  "Worn out · walking ×{f}": "Erschöpft · Gehen ×{f}",
  "Balanced · walking ×{f}": "Ausgeglichen · Gehen ×{f}",
  "bio::Drink": "Trinken",
  "bio::Eat": "Essen",
  "Switched off in the settings — no decay, no effects.":
    "In den Einstellungen ausgeschaltet — kein Abfall, keine Wirkung.",
  "Relaxed: everything drops at half speed.": "Entspannt: Alles sinkt nur halb so schnell.",
  "Jade's needs drop slowly with play time. Nothing is ever lost.":
    "Jades Bedürfnisse sinken langsam mit der Spielzeit. Verloren geht nie etwas.",
  "−{rate} per minute": "−{rate} pro Minute",
  "bio::steady": "gleichbleibend",
  "low in about {min} min": "niedrig in etwa {min} min",
  "Worn out: walking ×{f}. Eat, drink or sleep and it passes.":
    "Erschöpft: Gehen ×{f}. Essen, trinken oder schlafen — dann geht es vorbei.",
  "Balanced: walking ×{f}.": "Ausgeglichen: Gehen ×{f}.",
  "No effects.": "Keine Wirkung.",
  "All fine — no effect. Balanced (every need 60+, fitness 70+) gives a small speed bonus.":
    "Alles in Ordnung — keine Wirkung. Ausgeglichen (jedes Bedürfnis ab 60, Fitness ab 70) gibt einen kleinen Tempobonus.",
  Tips: "Tipps",
  "ready in {n} s": "bereit in {n} s",
  "A kitchen fabricator on the lab grid. It prints one portion at a time into your bag (up to {n} of each).":
    "Ein Küchen-Fabrikator am Labornetz. Er druckt eine Portion nach der anderen in deine Tasche (bis zu {n} von jeder Sorte).",
  "next workout ×{f}": "nächstes Training ×{f}",
  "In your bag: {n}/{max}": "In der Tasche: {n}/{max}",
  Print: "Drucken",
  "Behind the new neutrino cooling, on the bottom shelf: a plate under cling film, labelled “D.F. — DO NOT TOUCH. That means you too, Jade.” The lasagne stays. Everything else is yours.":
    "Hinter der neuen Neutrino-Kühlung, im untersten Fach: ein Teller unter Frischhaltefolie, beschriftet »D.F. — NICHT ANFASSEN. Das gilt auch für dich, Jade.« Die Lasagne bleibt. Alles andere gehört dir.",
  Stored: "Eingelagert",
  "Fridge capacity": "Kühlschrank-Kapazität",
  "Fresh from the fridge: +{p} % more. Nothing spoils — not here, not in your bag.":
    "Frisch aus dem Kühlschrank: +{p} % mehr. Nichts verdirbt — weder hier noch in deiner Tasche.",
  "In the fridge": "Im Kühlschrank",
  "Empty, apart from the lasagne.": "Leer, bis auf die Lasagne.",
  Take: "Nehmen",
  "In your bag": "In deiner Tasche",
  "Nothing to store. The Food Replicator is right next door.":
    "Nichts zum Einlagern. Der Food-Replikator steht gleich nebenan.",
  Store: "Einlagern",
  "Made, and hardly ever slept in. A few minutes of real sleep bring rest back to 100 — {min} minutes of play time pass meanwhile.":
    "Gemacht und kaum je benutzt. Ein paar Minuten echter Schlaf bringen die Erholung zurück auf 100 — dabei vergehen {min} Minuten Spielzeit.",
  Sleep: "Schlafen",
  "Damien called it “the hamster wheel”. Ten minutes: +{gain} fitness, costs {drink} hydration and {rest} rest.":
    "Damien nannte es »das Hamsterrad«. Zehn Minuten: +{gain} Fitness, kostet {drink} Flüssigkeit und {rest} Erholung.",
  "Protein shake: this workout counts ×{f}.": "Protein-Shake: Dieses Training zählt ×{f}.",
  Train: "Trainieren",
  "The biorhythm is switched off in the settings.":
    "Der Bio-Rhythmus ist in den Einstellungen ausgeschaltet.",
  "Jade is not hungry, thirsty or tired yet.": "Jade ist noch weder hungrig, durstig noch müde.",
  "bio::print": "drucken",
  "bio::open": "öffnen",
  "bio::sleep": "schlafen",
  "bio::train": "trainieren",
};
