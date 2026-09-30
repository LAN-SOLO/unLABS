/**
 * German translations — area "studio": music styles, genres, mixer parts,
 * instruments (lib/world/audio/songs/labels.ts), the settings entry, the
 * now-playing chip and the sound studio. Key = exact English source string.
 */
export const DE_STUDIO: Record<string, string> = {
  // Genres & styles
  "genre::Calm": "Ruhig",
  "genre::Rhythmic": "Rhythmisch",
  "genre::Electronic": "Elektronisch",
  "genre::Chill": "Chill",
  "genre::Ambient": "Ambient",
  "genre::Classical": "Klassisch",
  "Ocarina, harp and music box — lullabies for safe rooms.":
    "Okarina, Harfe und Spieluhr — Wiegenlieder für sichere Räume.",
  "Marimba, brass and drums — the workshop's heartbeat.":
    "Marimba, Bläser und Trommeln — der Herzschlag der Werkstatt.",
  "Chip leads, FM bass and arpeggios — the machines singing.":
    "Chip-Melodien, FM-Bass und Arpeggien — die Maschinen singen.",
  "Electric piano, vibes and a lazy swing — kantine evenings.":
    "E-Piano, Vibrafon und ein fauler Swing — Abende in der Kantine.",
  "Glass pads and distant bells — the deep floors dreaming.":
    "Glasflächen und ferne Glocken — die tiefen Ebenen träumen.",
  "Piano, strings and choir — minuets, nocturnes, marches.":
    "Klavier, Streicher und Chor — Menuette, Nocturnes, Märsche.",
  "style::Adaptive (follows the lab)": "Adaptiv (folgt dem Labor)",
  "style::Generative score (classic)": "Generative Musik (klassisch)",
  // Mixer parts
  "part::Lead": "Melodie",
  "part::Counter": "Gegenstimme",
  "part::Bells": "Glocken",
  "part::Arpeggio": "Arpeggio",
  "part::Pad": "Fläche",
  "part::Bass": "Bass",
  "part::Drums": "Schlagzeug",
  // Instruments
  "inst::Ocarina": "Okarina",
  "inst::Flute": "Flöte",
  "inst::Chip lead": "Chip-Lead",
  "inst::Synth lead": "Synth-Lead",
  "inst::Brass": "Blechbläser",
  "inst::Strings": "Streicher",
  "inst::Choir": "Chor",
  "inst::Whistle": "Pfeifen",
  "inst::Harp": "Harfe",
  "inst::Celesta": "Celesta",
  "inst::Kalimba": "Kalimba",
  "inst::Marimba": "Marimba",
  "inst::Vibraphone": "Vibrafon",
  "inst::Electric piano": "E-Piano",
  "inst::Piano": "Klavier",
  "inst::Nylon guitar": "Nylongitarre",
  "inst::Synth pluck": "Synth-Pluck",
  "inst::Music box": "Spieluhr",
  "inst::Warm pad": "Warme Fläche",
  "inst::Glass pad": "Glasfläche",
  "inst::Organ": "Orgel",
  "inst::String pad": "Streicherfläche",
  "inst::Choir pad": "Chorfläche",
  "inst::Dark pad": "Dunkle Fläche",
  "inst::Sub bass": "Sub-Bass",
  "inst::Synth bass": "Synth-Bass",
  "inst::Upright bass": "Kontrabass",
  "inst::FM bass": "FM-Bass",
  "inst::Chip bass": "Chip-Bass",
  "kit::Acoustic": "Akustisch",
  "kit::Electro": "Elektro",
  "kit::Chip": "Chip",
  "kit::Lo-fi": "Lo-Fi",
  "kit::Hand percussion": "Handpercussion",
  // Settings & HUD
  "Music style": "Musikstil",
  "Adaptive picks songs that fit the room and the moment; a genre plays only that; generative is the original endless score":
    "Adaptiv wählt Stücke, die zum Raum und zum Moment passen; ein Genre spielt nur dieses; generativ ist die ursprüngliche endlose Musik",
  Studio: "Studio",
  // Studio panel (components/world/studio/StudioPanel.tsx)
  "studio::Jukebox": "Jukebox",
  "studio::Mixer": "Mischpult",
  "studio::Keys": "Tasten",
  "studio::Sequencer": "Sequencer",
  "studio::Sounds": "Klänge",
  "mode::major": "Dur",
  "mode::dorian": "dorisch",
  "mode::phrygian": "phrygisch",
  "mode::lydian": "lydisch",
  "mode::mixolydian": "mixolydisch",
  "mode::minor": "Moll",
  "mode::harmonic minor": "harmonisch Moll",
  "Damien's Sound Studio": "Damiens Tonstudio",
  "♪ {title} · {genre} · {pos} / {total}": "♪ {title} · {genre} · {pos} / {total}",
  "The desk is warm. Nothing is playing.": "Das Pult ist warm. Es läuft nichts.",
  "Studio sections": "Studiobereiche",
  "Search songs": "Stücke suchen",
  "No song matches.": "Kein Stück passt.",
  "Now playing": "Es läuft",
  "Song progress": "Fortschritt des Stücks",
  Genre: "Genre",
  Tempo: "Tempo",
  Lead: "Melodie",
  Form: "Form",
  "Chosen at the desk.": "Am Pult gewählt.",
  "Chosen by the lab (adaptive).": "Vom Labor gewählt (adaptiv).",
  "Silence. Pick a song, or let the lab choose.":
    "Stille. Wähl ein Stück — oder lass das Labor wählen.",
  "Next ⏭": "Weiter ⏭",
  "A song picked here keeps playing when you leave the studio. “Back to the lab” lets the rooms choose again. The music style is also in the settings (Audio).":
    "Ein hier gewähltes Stück läuft weiter, wenn du das Studio verlässt. „Zurück ans Labor“ lässt wieder die Räume wählen. Den Musikstil gibt es auch in den Einstellungen (Audio).",
  "1.0 = as composed": "1,0 = wie komponiert",
  Channels: "Kanäle",
  "{part} level": "Pegel {part}",
  M: "M",
  "Lead instrument": "Melodie-Instrument",
  "as composed": "wie komponiert",
  "The mix applies to every song until you reset it — in the studio and in the rest of the lab.":
    "Die Mischung gilt für jedes Stück, bis du sie zurücksetzt — im Studio und im restlichen Labor.",
  "drum::Kick": "Kick",
  "drum::Snare": "Snare",
  "drum::Hi-hat": "Hi-Hat",
  "drum::Open hat": "Offene Hi-Hat",
  "drum::Clap": "Clap",
  "drum::Rim": "Rim",
  "drum::Shaker": "Shaker",
  "drum::Tom high": "Tom hoch",
  "drum::Tom low": "Tom tief",
  "drum::Brush": "Besen",
  "drum::Ride": "Ride",
  "drum::Crash": "Crash",
  "Keyboard: play with the A–L row, drums with Z–comma, octave with arrow keys":
    "Tastatur: spielen mit der Reihe A–L, Trommeln mit Y–Komma, Oktave mit den Pfeiltasten",
  Instrument: "Instrument",
  Octave: "Oktave",
  "Piano keys": "Klaviertasten",
  "Drum kit": "Schlagzeug",
  "Click here first, then play: the A–L row are keys, Z–comma the pads, arrow keys change the octave.":
    "Erst hier klicken, dann spielen: Die Reihe A–L sind Tasten, Y–Komma die Pads, die Pfeiltasten wechseln die Oktave.",
  "Stop ■": "Stopp ■",
  "Play ▶": "Abspielen ▶",
  Scale: "Tonleiter",
  "Step grid": "Schrittraster",
  "{row}, step {n}": "{row}, Schritt {n}",
  "The pattern is saved on this computer. Four drum rows, four notes of the chosen scale.":
    "Das Muster wird auf diesem Computer gespeichert. Vier Schlagzeugreihen, vier Töne der gewählten Tonleiter.",
  "sfxgroup::Rewards & discovery": "Belohnung & Entdeckung",
  "sfxgroup::Devices & power": "Geräte & Energie",
  "sfxgroup::Doors & elevator": "Türen & Aufzug",
  "sfxgroup::Interface": "Oberfläche",
  "sfxgroup::Lab life": "Laborleben",
  "sfxgroup::Anomalies & machines": "Anomalien & Maschinen",
  "sfxgroup::Studio": "Studio",
  "sfxgroup::More": "Weitere",
  "sfxgroup::Footsteps": "Schritte",
  "surface::Metal": "Metall",
  "surface::Grating": "Gitterrost",
  "surface::Concrete": "Beton",
  "surface::Tiles": "Fliesen",
  "surface::Carpet": "Teppich",
  "surface::Wood": "Holz",
  // The studio in the world (floorplan.ts, map.ts, story.ts, puzzles.ts, achievements.ts)
  "Damien's Sound Studio (secret)": "Damiens Tonstudio (geheim)",
  "Behind the listening ring's outer wall: a studio no plan admits to. A mixing desk under a dust cover, monitors, tape machines, a synthesizer with a note on it: “Play it loud. The lab likes music.”":
    "Hinter der Außenwand des Horchrings: ein Studio, das kein Plan zugibt. Ein Mischpult unter einer Staubhülle, Abhörboxen, Bandmaschinen, ein Synthesizer mit einem Zettel darauf: „Spiel es laut. Das Labor mag Musik.“",
  "The outer wall of the ring is covered in acoustic foam — except for one panel with eight small keys. It is waiting for a song.":
    "Die Außenwand des Rings ist mit Akustikschaum verkleidet — bis auf ein Paneel mit acht kleinen Tasten. Es wartet auf ein Lied.",
  "Tape Label (torn)": "Bandetikett (abgerissen)",
  "JL — the song for the door, bars 1–2:  3 · 5\n\nThe rest is on the other two pieces. Never keep a song in one place. Songs in one place get deleted.":
    "JL — das Lied für die Tür, Takt 1–2:  3 · 5\n\nDer Rest steht auf den anderen beiden Stücken. Bewahr ein Lied nie an einem Ort auf. Lieder an einem Ort werden gelöscht.",
  "Frosted Lid": "Bereifter Deckel",
  "…then climb to 8 and let it fall to 6.\n\nIf you found this in the cold, you found the hardest piece. — D.":
    "…dann hinauf zur 8 und hinab zur 6.\n\nWenn du das in der Kälte gefunden hast, hast du das schwerste Stück gefunden. — D.",
  "Radio Log, Back Side": "Funkprotokoll, Rückseite",
  "Last part: 7 · 5. Never end on the 1 — it is not finished. Neither are we.\n\nThe door listens on Level −2, where the ring listens too.":
    "Letzter Teil: 7 · 5. Nie auf der 1 enden — es ist nicht fertig. Wir auch nicht.\n\nDie Tür horcht auf Ebene −2, dort, wo auch der Ring horcht.",
  "Maintenance Note: Foam": "Wartungsnotiz: Schaumstoff",
  "Panel 7 in the foam of the Signal Core is not foam. It is foam-coloured, and it has keys. Do not tap on them. The wall behind this ring hums back. — L0G-1K":
    "Paneel 7 im Schaum des Signalkerns ist kein Schaum. Es ist schaumfarben, und es hat Tasten. Nicht darauf tippen. Die Wand hinter diesem Ring summt zurück. — L0G-1K",
  "Legal Pad #18": "Notizblock Nr. 18",
  "If the lab ever goes too quiet: the ring on −2 listens both ways. I left J. a song in three pieces — where the files sleep, where the cold keeps things, where the radio talks to nobody.":
    "Falls es im Labor je zu still wird: Der Ring auf −2 horcht in beide Richtungen. Ich habe J. ein Lied in drei Teilen hinterlassen — dort, wo die Akten schlafen, wo die Kälte Dinge aufbewahrt, wo das Funkgerät mit niemandem spricht.",
  "Session Log #212": "Sitzungsprotokoll Nr. 212",
  "The lab plays itself now: calm for the quarters, rhythm for the forge, glass for the deep floors, a little swing for the kantine. The desk lets you choose. Mixer, keys, a sequencer, every sound this place makes. If you are reading this, Jade: the fader on the left is yours. — D.":
    "Das Labor spielt sich jetzt selbst: Ruhe für die Quartiere, Rhythmus für die Schmiede, Glas für die tiefen Ebenen, ein wenig Swing für die Kantine. Am Pult kannst du wählen. Mischpult, Tasten, ein Sequencer, jedes Geräusch, das dieser Ort macht. Wenn du das liest, Jade: Der Regler links gehört dir. — D.",
  "Foam Panel with Keys": "Schaumpaneel mit Tasten",
  "Eight small keys under the foam, like a tiny piano. It waits for a song — Damien's song. He never wrote it down in one place.":
    "Acht kleine Tasten unter dem Schaum, wie ein winziges Klavier. Es wartet auf ein Lied — Damiens Lied. Er hat es nie an einem Ort aufgeschrieben.",
  "Mixing Desk": "Mischpult",
  "Song Scrap I": "Liedfetzen I",
  "A torn tape label in Damien's hand: “JL — the song for the door, bars 1–2: 3 · 5.”":
    "Ein abgerissenes Bandetikett in Damiens Handschrift: „JL — das Lied für die Tür, Takt 1–2: 3 · 5.“",
  "Song Scrap II": "Liedfetzen II",
  "On a frosted lid in the cold archive: “…then climb to 8 and let it fall to 6.”":
    "Auf einem bereiften Deckel im Kältearchiv: „…dann hinauf zur 8 und hinab zur 6.“",
  "Song Scrap III": "Liedfetzen III",
  "On the back of a radio log: “Last part: 7 · 5. Never end on the 1.” And: the door listens on Level −2, where the ring listens too.":
    "Auf der Rückseite eines Funkprotokolls: „Letzter Teil: 7 · 5. Nie auf der 1 enden.“ Und: Die Tür horcht auf Ebene −2, dort, wo auch der Ring horcht.",
  "Damien's Song": "Damiens Lied",
  "Three scraps, one tune: 3 · 5 · 8 · 6 · 7 · 5. It does not end on the 1 — it is not finished. Somewhere on Level −2 a panel is waiting for it.":
    "Drei Fetzen, eine Melodie: 3 · 5 · 8 · 6 · 7 · 5. Sie endet nicht auf der 1 — sie ist nicht fertig. Irgendwo auf Ebene −2 wartet ein Paneel darauf.",
  "The Studio": "Das Studio",
  "Damien built a sound studio behind the listening ring on Level −2. Every song the lab plays is in there — and a mixing desk that lets you play them yourself.":
    "Damien hat hinter dem Horchring auf Ebene −2 ein Tonstudio gebaut. Jedes Stück, das das Labor spielt, ist dort — und ein Mischpult, an dem du sie selbst spielen kannst.",
  "The Studio Door": "Die Studiotür",
  "Eight small keys under the foam. You know Damien's song now — three scraps put together. The panel hums it back once; play it without a mistake.":
    "Acht kleine Tasten unter dem Schaum. Du kennst Damiens Lied jetzt — drei Fetzen, zusammengesetzt. Das Paneel summt es einmal vor; spiel es ohne Fehler nach.",
  "A room I did not know I had. Forty kilos of acoustic foam, one very good chair. Dr. Fridge built a studio in my listening ring and never told me. I would like to be offended. I would rather listen.":
    "Ein Raum, von dem ich nicht wusste, dass ich ihn habe. Vierzig Kilo Akustikschaum, ein sehr guter Stuhl. Dr. Fridge hat in meinem Horchring ein Studio gebaut und es mir nie gesagt. Ich wäre gern gekränkt. Ich höre lieber zu.",
  "Sound Engineer": "Tonmeister",
  "Find Damien's hidden sound studio.": "Finde Damiens verborgenes Tonstudio.",
  // Barks (content/barks.ts)
  "A studio. Of course he built a studio. The chair is still warm — no, that is the amplifier.":
    "Ein Studio. Natürlich hat er ein Studio gebaut. Der Stuhl ist noch warm — nein, das ist der Verstärker.",
  "Three, five, eight, six, seven, five. The foam in here hums along — one panel hums louder.":
    "Drei, fünf, acht, sechs, sieben, fünf. Der Schaum hier summt mit — ein Paneel summt lauter.",
  // Lab archive (content/archive/floor2.ts)
  "Torn sheet music": "Zerrissene Noten",
  "A page of sheet music under the papers, torn in three. Only the header survived, in Damien's hand:\n“For J. — the door that listens. Six notes, never in one place.”\nOn the back, a sketch: the ring, and a room behind its outer wall.":
    "Ein Notenblatt unter den Papieren, in drei Teile gerissen. Nur die Überschrift ist geblieben, in Damiens Handschrift:\n„Für J. — die Tür, die zuhört. Sechs Töne, nie an einem Ort.“\nAuf der Rückseite eine Skizze: der Ring und ein Raum hinter seiner Außenwand.",
};
