/**
 * German translations — area "wardrobe". Key = exact English source string from `tr("…")`.
 * Wardrobe content: slots, pieces, colourways, replicator recipes (lib/world/content/wardrobe.ts, lib/world/wardrobe.ts).
 */
export const DE_WARDROBE: Record<string, string> = {
  // ── Slots & groups ──
  Top: "Oberteil",
  Jacket: "Jacke",
  Trousers: "Hose",
  Shoes: "Schuhe",
  Hairstyle: "Frisur",
  Headgear: "Kopfbedeckung",
  Face: "Gesicht",
  Gloves: "Handschuhe",
  Neck: "Hals",
  Belt: "Gürtel",
  Wrist: "Handgelenk",
  "Shoulder buddy": "Schulterbegleiter",
  Clothes: "Kleidung",
  Gadgets: "Ausrüstung",
  Accessories: "Accessoires",

  // ── Colourways ──
  "colour::Teal": "Petrol",
  "colour::Mustard": "Senf",
  "colour::Oxblood": "Ochsenblut",
  "colour::Oatmeal": "Hafer",
  "colour::Black": "Schwarz",
  "colour::Navy": "Marine",
  "colour::Cream": "Creme",
  "colour::White": "Weiß",
  "colour::Heather grey": "Grau meliert",
  "colour::Safety orange": "Warnorange",
  "colour::Sky": "Himmelblau",
  "colour::Anthracite": "Anthrazit",
  "colour::Forest": "Tannengrün",
  "colour::Lilac": "Flieder",
  "colour::Red check": "Rot kariert",
  "colour::Green check": "Grün kariert",
  "colour::Grey": "Grau",
  "colour::Night shift black": "Nachtschicht-Schwarz",
  "colour::Olive": "Oliv",
  "colour::Cerulean": "Coelinblau",
  "colour::Yellow": "Gelb",
  "colour::Red": "Rot",
  "colour::Rose": "Rosé",
  "colour::Leather": "Leder",
  "colour::Charcoal": "Kohlegrau",
  "colour::Khaki": "Khaki",
  "colour::Denim": "Denim",
  "colour::Black denim": "Schwarzer Denim",
  "colour::Brown": "Braun",
  "colour::Green": "Grün",
  "colour::Tartan red": "Schottenkaro Rot",
  "colour::Tartan green": "Schottenkaro Grün",
  "colour::Neon": "Neon",
  "colour::Steel": "Stahl",
  "colour::Pink": "Rosa",
  "colour::Auburn": "Kastanienrot",
  "colour::Blond": "Blond",
  "colour::Silver": "Silber",
  "colour::Teal dye": "Petrol gefärbt",
  "colour::Magenta dye": "Magenta gefärbt",
  "colour::Cerulean 490": "Coelinblau 490",
  "colour::Amber": "Bernstein",
  "colour::Orange": "Orange",
  "colour::Rainbow": "Regenbogen",
  "colour::Halo": "Halo",
  "colour::Clear": "Klar",
  "colour::Brass": "Messing",
  "colour::Cyan": "Cyan",
  "colour::Plaster": "Pflaster",
  "colour::Blue": "Blau",
  "colour::Striped": "Gestreift",
  "colour::Carbon": "Carbon",
  "colour::Chrome": "Chrom",
  "colour::Violet": "Violett",
  "colour::Polka dots": "Gepunktet",
  "colour::Mint": "Mint",

  // ── Tops ──
  "Cable-knit sweater": "Zopfstrickpullover",
  "Teal, two cables, one darned elbow. Knitted by her mother, worn by the lab.":
    "Petrol, zwei Zöpfe, ein gestopfter Ellbogen. Gestrickt von ihrer Mutter, getragen vom Labor.",
  Turtleneck: "Rollkragenpullover",
  "Black, high collar, zero pockets. For the days she wants to look like she has a plan.":
    "Schwarz, hoher Kragen, null Taschen. Für die Tage, an denen sie aussehen will, als hätte sie einen Plan.",
  "_unLAB Classic tee": "_unLAB-Classic-Shirt",
  "The wireframe crystal on the chest. Also sold in the real world, which confuses the MCP.":
    "Der Drahtgitter-Kristall auf der Brust. Gibt es auch in der echten Welt zu kaufen, was den MCP verwirrt.",
  "“Do not lick the crystal” tee": "»Kristall nicht ablecken«-Shirt",
  "Hazard sign on the front. Found in a staff locker, still folded. Somebody needed the reminder.":
    "Warnschild vorne drauf. Gefunden in einem Personalspind, noch gefaltet. Irgendwer brauchte die Erinnerung.",
  "A staff locker on the control floor still holds a folded shirt.":
    "Ein Personalspind auf der Kontrollebene hütet noch ein gefaltetes Shirt.",
  "“418 I'm a teapot” tee": "»418 I'm a teapot«-Shirt",
  "Printed by the replicator on its first try. The replicator thinks it is hilarious.":
    "Vom Replikator beim ersten Versuch gedruckt. Der Replikator findet das urkomisch.",
  "Bot line-up tee": "Bot-Aufstellungs-Shirt",
  "All ten lore bots, shoulder to shoulder. D3C4D3 insisted on being in the middle.":
    "Alle zehn Lore-Bots, Schulter an Schulter. D3C4D3 bestand darauf, in der Mitte zu stehen.",
  "Wake three lore bots — they want to be on it.": "Wecke drei Lore-Bots – sie wollen mit drauf.",
  "“Residual charge 0.3 %” tee": "»Restladung 0,3 %«-Shirt",
  "A nearly empty battery. The most honest thing anyone in this lab has ever worn.":
    "Ein fast leerer Akku. Das Ehrlichste, was in diesem Labor je jemand getragen hat.",
  "The battery room keeps a spare shirt behind the last rack.":
    "Im Batterieraum liegt hinter dem letzten Regal ein Ersatzshirt.",
  "_unLAB hoodie": "_unLAB-Hoodie",
  "Heavy, brushed inside, double hood. Level −4 gets cold, and so does Jade.":
    "Schwer, innen angeraut, doppelte Kapuze. Auf Ebene −4 wird es kalt, und Jade auch.",
  "Night-shift hoodie": "Nachtschicht-Hoodie",
  "“If you think at night, think quietly.” House rule no. 1, printed across the chest.":
    "»Wer nachts denkt, denkt leise.« Hausregel Nr. 1, quer über die Brust gedruckt.",
  "Flannel shirt": "Flanellhemd",
  "Red check, sleeves rolled. Damien's, strictly speaking. He will not miss it. He might.":
    "Rot kariert, Ärmel hochgekrempelt. Streng genommen Damiens. Er wird es nicht vermissen. Vielleicht doch.",
  "Damien kept more than notes in his quarters.":
    "Damien hat in seinem Quartier mehr aufbewahrt als nur Notizen.",
  "Workshop tank top": "Werkstatt-Tanktop",
  "Grey rib, a grease print the shape of a thumb. For the forge, where sleeves are a liability.":
    "Graue Rippe, ein Schmierfleck in Daumenform. Für die Forge, wo Ärmel ein Sicherheitsrisiko sind.",

  // ── Jackets ──
  "Lab coat": "Laborkittel",
  "One of four identical coats. Badge, pens, dosimeter, a screwdriver in the pocket.":
    "Einer von vier identischen Kitteln. Ausweis, Stifte, Dosimeter, ein Schraubenzieher in der Tasche.",
  "Patched lab coat": "Geflickter Laborkittel",
  "Burn holes darned with copper thread, a patch for every experiment that answered back.":
    "Brandlöcher, mit Kupferdraht gestopft – ein Flicken für jedes Experiment, das zurückgeschlagen hat.",
  "Survive one explosion at the workbench first. You will know when.":
    "Überlebe zuerst eine Explosion an der Werkbank. Du wirst es merken.",
  "Bomber jacket": "Bomberjacke",
  "Olive, orange lining, a _unLAB patch on the sleeve. Warm enough for the surface.":
    "Oliv, orangefarbenes Futter, ein _unLAB-Aufnäher am Ärmel. Warm genug für die Oberfläche.",
  "Rain slicker": "Regenjacke",
  "Yellow, loud, crackles when she walks. The cooling floors drip. A lot.":
    "Gelb, laut, knistert bei jedem Schritt. Die Kühlebenen tropfen. Sehr.",
  "By the leaking pipes of the cooling level hangs a coat nobody took.":
    "An den undichten Rohren der Kühlebene hängt eine Jacke, die niemand mitgenommen hat.",
  "Long cardigan": "Lange Strickjacke",
  "Knee-length, bottomless pockets. The observatory is draughty after midnight.":
    "Knielang, bodenlose Taschen. In der Sternwarte zieht es nach Mitternacht.",
  "Welding apron": "Schweißerschürze",
  "Split leather, scorch marks, a pocket for the striker. The forge approves.":
    "Spaltleder, Brandflecken, eine Tasche für den Gasanzünder. Die Forge ist einverstanden.",
  "Build the 3D Fabricator first — it prints the rivets.":
    "Baue zuerst den 3D-Fabrikator – er druckt die Nieten.",

  // ── Trousers ──
  "Work trousers": "Arbeitshose",
  "Dark, creased, a tape measure on the belt loop. The uniform nobody ordered.":
    "Dunkel, zerknittert, ein Maßband an der Gürtelschlaufe. Die Uniform, die keiner bestellt hat.",
  Jeans: "Jeans",
  "Faded at the knees from kneeling in front of machines that would not start.":
    "An den Knien ausgeblichen vom Knien vor Maschinen, die nicht anspringen wollten.",
  "Hi-vis work trousers": "Warnschutzhose",
  "Safety orange, reflective bands. You will be seen. Mostly by bots.":
    "Warnorange, Reflexstreifen. Man wird gesehen. Meistens von Bots.",
  "Shorts & tights": "Shorts & Strumpfhose",
  "Corduroy shorts over thick tights. The greenhouse is warm; the elevator is not.":
    "Cordshorts über dicker Strumpfhose. Das Gewächshaus ist warm, der Aufzug nicht.",
  "Plaid skirt": "Karorock",
  "Pleats, a safety pin, black tights. The one piece in the wardrobe that is not practical.":
    "Falten, eine Sicherheitsnadel, schwarze Strumpfhose. Das einzige Teil im Schrank, das nicht praktisch ist.",
  "A suitcase in the archive was never unpacked.": "Ein Koffer im Archiv wurde nie ausgepackt.",
  Joggers: "Jogginghose",
  "Grey, soft, disgraceful. For the ergometer and for Sundays that do not exist down here.":
    "Grau, weich, würdelos. Für das Ergometer und für Sonntage, die es hier unten nicht gibt.",

  // ── Shoes ──
  "Work boots": "Arbeitsstiefel",
  "Laced, welted, steel toe. Heavy on grating, honest on concrete.":
    "Geschnürt, rahmengenäht, Stahlkappe. Schwer auf Gitterrost, ehrlich auf Beton.",
  Sneakers: "Sneaker",
  "White canvas, rubber toe caps. They squeak on tile, which the tile deserves.":
    "Weißes Canvas, Gummikappen. Sie quietschen auf Fliesen, und die Fliesen haben es verdient.",
  "Rubber boots": "Gummistiefel",
  "Yellow wellies. Puddles are no longer a question of if.":
    "Gelbe Gummistiefel. Pfützen sind keine Frage des Ob mehr.",
  "Magnetic boots": "Magnetstiefel",
  "Prototype. Coils in the soles, a hum in the ankles. They clamp to grating like a promise.":
    "Prototyp. Spulen in den Sohlen, ein Summen in den Knöcheln. Sie haften am Gitterrost wie ein Versprechen.",
  "Build the Exotic Matter Containment first — its field coils are the pattern.":
    "Erst die Exotische-Materie-Eindämmung bauen – ihre Feldspulen sind das Schnittmuster.",
  "Bunny slippers": "Hasenpantoffeln",
  "Grey plush, one ear chewed. Not lab-safe. Absolutely non-negotiable.":
    "Grauer Plüsch, ein Ohr angeknabbert. Nicht laborsicher. Absolut nicht verhandelbar.",
  "Lab clogs": "Laborclogs",
  "Wooden soles, autoclavable uppers. Every step a small announcement.":
    "Holzsohlen, autoklavierbares Obermaterial. Jeder Schritt eine kleine Durchsage.",
  "Roller boots": "Rollschuhe",
  "Four wheels, a toe stop, bearings that sing on the long corridors. Found, not approved.":
    "Vier Rollen, ein Stopper, Kugellager, die in den langen Gängen singen. Gefunden, nicht genehmigt.",

  // ── Hairstyles ──
  "Low ponytail": "Tiefer Pferdeschwanz",
  "Tied with the teal band. Practical, and it swings when she runs.":
    "Mit dem petrolfarbenen Band gebunden. Praktisch, und er wippt, wenn sie rennt.",
  "Messy bun": "Unordentlicher Dutt",
  "A pencil holds it together. Two pencils on bad days.":
    "Ein Bleistift hält ihn zusammen. An schlechten Tagen zwei.",
  Loose: "Offen",
  "Down to the shoulders. Only when nothing is on fire.":
    "Bis auf die Schultern. Nur, wenn gerade nichts brennt.",
  Bob: "Bob",
  "Chin length, a cut she did herself with the good scissors.":
    "Kinnlang, selbst geschnitten mit der guten Schere.",
  Braids: "Zöpfe",
  "Two tight braids — they stay out of machines.":
    "Zwei straffe Zöpfe – die bleiben aus den Maschinen raus.",
  "Space buns": "Space Buns",
  "Two buns like antennae. B4C0N keeps asking which frequency.":
    "Zwei Dutts wie Antennen. B4C0N fragt ständig, auf welcher Frequenz.",
  "The observatory has seen stranger things than two hair ties.":
    "Die Sternwarte hat schon Seltsameres gesehen als zwei Haargummis.",
  "Pixie cut": "Pixie Cut",
  "Short, no fuss. The hairdryer in the quarters died in 2019.":
    "Kurz, kein Aufwand. Der Föhn im Quartier ist 2019 gestorben.",
  Undercut: "Undercut",
  "Shaved sides, a long top. Nobody is here to have an opinion.":
    "Seiten rasiert, oben lang. Hier ist niemand, der eine Meinung dazu hätte.",
  "Find ten slices of Crystal #0089.": "Finde zehn Slices von Kristall #0089.",

  // ── Headgear ──
  "Amber goggles": "Bernstein-Schutzbrille",
  "Pushed up on the forehead, where they have been since 2016.":
    "Auf die Stirn geschoben, wo sie seit 2016 sitzt.",
  "Hard hat": "Schutzhelm",
  "White shell, a _unLAB sticker, a crack from the day the hangar crane moved on its own.":
    "Weiße Schale, ein _unLAB-Aufkleber, ein Riss von dem Tag, als sich der Hangarkran von selbst bewegt hat.",
  "The hangar keeps its safety gear where the crane cannot reach.":
    "Der Hangar bewahrt seine Schutzausrüstung dort auf, wo der Kran nicht hinkommt.",
  "Welding helmet": "Schweißhelm",
  "Flipped up, dark glass, stickers from three different forges. Jade only knows one of them.":
    "Hochgeklappt, dunkles Glas, Aufkleber von drei verschiedenen Schmieden. Jade kennt nur eine davon.",
  "Build the 3D Fabricator first — it prints the hinge.":
    "Baue zuerst den 3D-Fabrikator – er druckt das Scharnier.",
  "Studio headphones": "Studiokopfhörer",
  "Closed-back, coiled cable, Damien's initials under the band. They still smell of the studio.":
    "Geschlossen, Spiralkabel, Damiens Initialen unter dem Bügel. Sie riechen noch nach Studio.",
  "Find Damien's studio.": "Finde Damiens Studio.",
  Beanie: "Mütze",
  "Rib knit, a pompom that has seen things. The deep floors are cold.":
    "Rippstrick, ein Bommel, der einiges gesehen hat. Die tiefen Ebenen sind kalt.",
  "_unLAB cap": "_unLAB-Cap",
  "Curved peak, the crystal embroidered in green. Worn backwards on debugging days.":
    "Gebogener Schirm, der Kristall grün aufgestickt. An Debugging-Tagen verkehrt herum getragen.",
  Headlamp: "Stirnlampe",
  "An elastic band, a lamp, three brightness settings, all of them “too bright”.":
    "Ein Gummiband, eine Lampe, drei Helligkeitsstufen, alle davon »zu hell«.",
  "Antenna headband": "Antennen-Haarreif",
  "Two springs, two LEDs, zero function. B4C0N thinks she finally joined the family.":
    "Zwei Federn, zwei LEDs, null Funktion. B4C0N glaubt, sie gehört jetzt endlich zur Familie.",
  "Wake a bot first — it has opinions about antennae.":
    "Wecke zuerst einen Bot – der hat eine Meinung zu Antennen.",
  "Propeller cap": "Propellermütze",
  "Nobody ordered this. The propeller turns when she runs. Nobody asked for that either.":
    "Keiner hat die bestellt. Der Propeller dreht sich, wenn sie rennt. Darum hat auch keiner gebeten.",
  "Crystal circlet": "Kristallreif",
  "A thin band of Halo glass that hums at 847 Hz. It fits as if it had been waiting.":
    "Ein dünnes Band aus Halo-Glas, das bei 847 Hz summt. Es passt, als hätte es gewartet.",
  "Collect all 30 slices of Crystal #0089.": "Sammle alle 30 Slices von Kristall #0089.",

  // ── Face ──
  "Safety glasses": "Schutzbrille",
  "Clear wrap-around polycarbonate. Rule no. 7, and for once she follows it.":
    "Klares Rundum-Polycarbonat. Regel Nr. 7, und ausnahmsweise hält sie sich daran.",
  "Splash shield": "Spritzschutz-Visier",
  "A full visor on a headband. For the workbench, where things splash, spark and occasionally scream.":
    "Ein Vollvisier am Kopfband. Für die Werkbank, wo es spritzt, funkt und gelegentlich schreit.",
  Respirator: "Atemschutzmaske",
  "Twin filters, a rubber seal, a voice like a very polite robot.":
    "Doppelfilter, eine Gummidichtung, eine Stimme wie ein sehr höflicher Roboter.",
  "Round glasses": "Runde Brille",
  "Brass wire frames. She does not need them. She reads better with them anyway.":
    "Messingdrahtgestell. Sie braucht sie nicht. Sie liest trotzdem besser damit.",
  "Old reading glasses lie in the room with the most books.":
    "Eine alte Lesebrille liegt in dem Raum mit den meisten Büchern.",
  "HUD visor": "HUD-Visier",
  "A cyan strip across the eyes that shows the room's power draw. Mostly it shows a clock.":
    "Ein cyanfarbener Streifen über den Augen, der den Stromverbrauch des Raums zeigt. Meistens zeigt er eine Uhr.",
  "The visor needs the lab network online to have anything to show.":
    "Das Visier braucht ein laufendes Labornetz, sonst hat es nichts anzuzeigen.",
  Plaster: "Pflaster",
  "Across the nose. A souvenir of the combination that should not have worked.":
    "Quer über der Nase. Ein Andenken an die Kombination, die nicht hätte funktionieren sollen.",
  "Three explosions at the workbench. It happens.": "Drei Explosionen an der Werkbank. Kommt vor.",
  "Fake moustache": "Falscher Schnurrbart",
  "For the camera in the airlock. The MCP has not recognised her since. Allegedly.":
    "Für die Kamera in der Schleuse. Der MCP hat sie seitdem nicht mehr erkannt. Angeblich.",

  // ── Gloves ──
  "Nitrile gloves": "Nitrilhandschuhe",
  "Blue, powder-free, one size too big. A spare pair lives in every coat pocket.":
    "Blau, puderfrei, eine Nummer zu groß. In jeder Kitteltasche wohnt ein Ersatzpaar.",
  "Welding gauntlets": "Schweißerhandschuhe",
  "Split leather to the elbow. The forge's handshake is hot.":
    "Spaltleder bis zum Ellbogen. Der Händedruck der Forge ist heiß.",
  "Build the 3D Fabricator first — it prints the cuffs.":
    "Baue zuerst den 3D-Fabrikator – er druckt die Stulpen.",
  "Fingerless gloves": "Fingerlose Handschuhe",
  "Knitted, for typing in the cold. The server room feels like winter.":
    "Gestrickt, zum Tippen in der Kälte. Im Serverraum ist gefühlt Winter.",
  "Insulating gloves": "Isolierhandschuhe",
  "Class 0, rated to 1000 V, orange cuffs. The switchgear says hello.":
    "Klasse 0, bis 1000 V, orangefarbene Stulpen. Die Schaltanlage lässt grüßen.",
  "Servo gloves": "Servohandschuhe",
  "Prototype. Tiny servos on every knuckle, a grip like a vice, a whine like a mosquito.":
    "Prototyp. Winzige Servos an jedem Knöchel, ein Griff wie ein Schraubstock, ein Surren wie eine Mücke.",
  "Five awake bots would have the spare servos.": "Fünf wache Bots hätten die Ersatzservos.",

  // ── Back ──
  "Field backpack": "Feldrucksack",
  "Canvas, leather straps, a thermos pocket. Everything she carries somehow fits in it.":
    "Canvas, Lederriemen, ein Thermoskannenfach. Alles, was sie mitschleppt, passt irgendwie hinein.",
  "Oxygen cylinder": "Sauerstoffflasche",
  "A small green bottle on a harness. For the sealed rooms, and for dramatic entrances.":
    "Eine kleine grüne Flasche am Tragegurt. Für die versiegelten Räume und für dramatische Auftritte.",
  "Jetpack prototype": "Jetpack-Prototyp",
  "Two nozzles, one tank, no permit. It does not fly. The pilot light is lovely, though.":
    "Zwei Düsen, ein Tank, keine Genehmigung. Es fliegt nicht. Die Zündflamme ist aber hübsch.",
  "A running reactor first. Nobody straps a nozzle to their back without one.":
    "Erst ein laufender Reaktor. Ohne schnallt sich niemand eine Düse auf den Rücken.",
  "Bot carrier": "Bot-Trage",
  "A frame with a sleeping mini-bot strapped in. It wakes up when she climbs stairs.":
    "Ein Gestell mit einem festgeschnallten, schlafenden Mini-Bot. Er wacht auf, wenn sie Treppen steigt.",
  "Wake all ten lore bots.": "Wecke alle zehn Lore-Bots.",
  "Lab cape": "Laborumhang",
  "A lab coat with the sleeves cut off, worn the wrong way round. Science needs a hero.":
    "Ein Laborkittel ohne Ärmel, verkehrt herum getragen. Die Wissenschaft braucht eine Heldin.",
  "Reach any ending. Heroes get capes afterwards.":
    "Erreiche irgendein Ende. Heldinnen kriegen ihr Cape hinterher.",

  // ── Neck ──
  "Wool scarf": "Wollschal",
  "Red, far too long, wrapped twice. The ends swing when she runs.":
    "Rot, viel zu lang, zweimal gewickelt. Die Enden flattern, wenn sie rennt.",
  "Key lanyard": "Schlüsselband",
  "Seventeen keys, three of which open something. They jingle with every step.":
    "Siebzehn Schlüssel, drei davon öffnen irgendwas. Sie klimpern bei jedem Schritt.",
  "Crystal pendant": "Kristallanhänger",
  "A splinter of unETH on a copper wire. It chimes very softly when she moves.":
    "Ein Splitter unETH an einem Kupferdraht. Er klingt ganz leise, wenn sie sich bewegt.",
  "Find three slices of the crystal first — the pendant copies their hum.":
    "Finde zuerst drei Scheiben des Kristalls – der Anhänger kopiert ihr Summen.",
  "Bow tie": "Fliege",
  "For the endings. Every ending deserves a bow tie.":
    "Für die Enden. Jedes Ende verdient eine Fliege.",

  // ── Belt ──
  "Belt with tape measure": "Gürtel mit Maßband",
  "Brass buckle, a tape measure, a carabiner with the wrong keys on it.":
    "Messingschnalle, ein Maßband, ein Karabiner mit den falschen Schlüsseln dran.",
  "Full tool belt": "Voller Werkzeuggürtel",
  "Hammer loop, pliers, three screwdrivers, a multimeter. Rattles like a toolbox with legs.":
    "Hammerschlaufe, Zange, drei Schraubenzieher, ein Multimeter. Klappert wie ein Werkzeugkasten auf Beinen.",
  "Bum bag": "Bauchtasche",
  "Neon, 1990s, zipped. Contents: gum, a fuse, the good pen.":
    "Neon, 1990er, zugezippt. Inhalt: Kaugummi, eine Sicherung, der gute Kuli.",

  // ── Wrist ──
  "Wrist watch": "Armbanduhr",
  "Leather strap, a cyan face. It has shown 03:27 more often than is healthy.":
    "Lederarmband, ein cyanfarbenes Zifferblatt. Sie hat öfter 03:27 angezeigt, als gesund ist.",
  "Biorhythm band": "Biorhythmus-Band",
  "Counts steps, coffee and sighs. Syncs with nothing, beeps anyway.":
    "Zählt Schritte, Kaffee und Seufzer. Synchronisiert mit nichts, piept trotzdem.",
  "Wrist terminal": "Armterminal",
  "A chunky green terminal strapped to the forearm. It runs one command: `status`.":
    "Ein klobiges grünes Terminal, an den Unterarm geschnallt. Es kennt genau einen Befehl: `status`.",
  "It needs a memory core to boot from.": "Es braucht einen Speicherkern zum Booten.",
  "Friendship bracelet": "Freundschaftsarmband",
  "Woven from ten colours of cable sleeve — one per bot. Somebody made it while she was not looking.":
    "Geflochten aus Kabelschlauch in zehn Farben – eine pro Bot. Jemand hat es gemacht, als sie nicht hingesehen hat.",

  // ── Shoulder buddies ──
  "Mini F1N-DR": "Mini-F1N-DR",
  "A palm-sized finder on her shoulder. Its face stays calm, its tracks keep turning.":
    "Ein handtellergroßer Finder auf ihrer Schulter. Sein Gesicht bleibt ruhig, seine Ketten drehen sich weiter.",
  "Wake two bots — one of them will offer a blueprint.":
    "Wecke zwei Bots – einer von ihnen bietet dir einen Bauplan an.",
  "Pocket drone": "Taschendrohne",
  "Hovers over her shoulder, lights the floor, bumps into doors. Loyal to a fault.":
    "Schwebt über ihrer Schulter, leuchtet den Boden aus, stößt gegen Türen. Treu bis zur Schmerzgrenze.",
  "Build the Explorer Drone first — the pocket version copies its firmware.":
    "Baue zuerst die Erkundungsdrohne – die Taschenversion kopiert ihre Firmware.",
  "Plush MCP": "Plüsch-MCP",
  "A felt eye with a red button pupil. The real MCP calls it “unauthorised likeness”.":
    "Ein Filzauge mit einer roten Knopfpupille. Der echte MCP nennt es »nicht autorisiertes Abbild«.",
  "A plush toy in the kids' corner of the canteen? There is no kids' corner. Look anyway.":
    "Ein Plüschtier in der Kinderecke der Kantine? Es gibt keine Kinderecke. Schau trotzdem nach.",

  // ── Replicator: refining ──
  "Strip a cable harness into polymer fibre": "Kabelbaum zu Polymerfaser abisolieren",
  "Card a filter cartridge into polymer fibre": "Filterpatrone zu Polymerfaser kardieren",
  "Press glow algae into pigment": "Leuchtalgen zu Farbpigment pressen",
  "Dry mycelium into pigment": "Myzel zu Farbpigment trocknen",
  "Boil coffee beans into brown pigment": "Kaffeebohnen zu braunem Farbpigment auskochen",
  "Grind slag into rust pigment": "Schlacke zu Rostpigment mahlen",
  "Spin glow thread from fibre optics and pigment":
    "Leuchtfaden aus Glasfaser und Farbpigment spinnen",

  // ── Rules & messages ──
  "Unknown slot.": "Unbekannter Platz.",
  "Clothes, shoes and hair are changed at the wardrobe in Jade's quarters.":
    "Kleidung, Schuhe und Frisur wechselt man am Kleiderschrank in Jades Quartier.",
  "Jade will not go without that.": "Ohne das geht Jade nicht los.",
  "That does not go there.": "Das gehört da nicht hin.",
  "Not in the wardrobe yet.": "Noch nicht im Kleiderschrank.",
  "That colour has to be dyed at the replicator first.":
    "Diese Farbe muss erst am Replikator gefärbt werden.",
  "Outfit {n}": "Outfit {n}",
  "Found for the wardrobe: {name}": "Für den Kleiderschrank gefunden: {name}",
  "Replicated: {name}": "Repliziert: {name}",
  "New in the wardrobe: {name}": "Neu im Kleiderschrank: {name}",
  "The replicator hands over: {name}": "Der Replikator rückt heraus: {name}",
  "Dyed: {name} in {colour}": "Gefärbt: {name} in {colour}",
  "slot::Back": "Rücken",
  "Somewhere people slept between shifts — far below the lab — a hoodie was never claimed.":
    "Irgendwo haben Leute zwischen den Schichten geschlafen – weit unter dem Labor. Ein Hoodie wurde nie abgeholt.",
  "Not under Jade's bed. Somebody borrowed them — somebody with a room nobody was supposed to know about.":
    "Nicht unter Jades Bett. Jemand hat sie sich geborgt – jemand mit einem Zimmer, von dem niemand wissen sollte.",
  "A long corridor on the upper deck. Its cupboard shares a lock with the ventilation hatch. Something with wheels wants out.":
    "Ein langer Flur auf dem Oberdeck. Sein Schrank teilt sich das Schloss mit der Lüftungsklappe. Etwas mit Rädern will raus.",
  "Where the presses stamp on the power level, a hair tie waits with a note: “For when the machines get close.”":
    "Wo auf der Energieebene die Pressen stampfen, wartet ein Haargummi mit einem Zettel: »Für wenn die Maschinen nah kommen.«",
  "Scissors and a mirror shard in the cabinet where the deep-lab crew washed up before going down.":
    "Schere und Spiegelscherbe im Schrank, an dem sich die Tiefenlabor-Crew vor dem Abstieg gewaschen hat.",
  "Something with a propeller once flew into the hangar's ventilation. It only comes down after the drone's first flight.":
    "Etwas mit Propeller ist einmal in die Lüftung des Hangars geflogen. Es kommt erst nach dem ersten Flug der Drohne wieder herunter.",
  "The costume box of the 2018 Christmas party was archived. Deep, cold and off the plans.":
    "Die Kostümkiste der Weihnachtsfeier 2018 wurde archiviert. Tief, kalt und auf keinem Plan.",
  "The reactor's switchgear keeps its gloves in a cabinet by the busbars.":
    "Die Schaltanlage des Reaktors bewahrt ihre Handschuhe in einem Schrank bei den Stromschienen auf.",
  "The airlock has a second emergency locker. Nobody ever emptied it.":
    "Die Schleuse hat einen zweiten Notfallspind. Niemand hat ihn je ausgeräumt.",
  "The janitor's hook in the materials store still holds a bunch of keys.":
    "Am Hausmeisterhaken im Materiallager hängt noch ein Schlüsselbund.",
  "The shaft crew's lost-and-found box at the bottom of the pit is older than the lab.":
    "Die Fundkiste der Schachtmannschaft ganz unten in der Grube ist älter als das Labor.",
  "The bot depot. Once its residents are awake, something small turns up where they charge.":
    "Das Bot-Depot. Sobald seine Bewohner wach sind, taucht dort, wo sie laden, etwas Kleines auf.",
  "Needle's Eye, NDL-0. Built it in 2018 from a scrapped industrial sewing head, the spare gantry of the first fabricator and Damien's bathroom mirror. He never noticed.":
    "Nadelöhr, NDL-0. 2018 gebaut aus einem ausrangierten Industrienähkopf, dem Ersatzportal des ersten Fabrikators und Damiens Badezimmerspiegel. Er hat es nie gemerkt.",
  // ── 2026: Jade's rework, new pieces ──
  "Stand-collar shirt": "Stehkragenhemd",
  "Crisp white, a stand-up collar lined with a grey-black shard pattern. Her first-day shirt, and most days after.":
    "Frisch gebügeltes Weiß, ein Stehkragen, innen mit grau-schwarzem Scherbenmuster gefüttert. Ihr Hemd vom ersten Tag – und von den meisten Tagen danach.",
  "Damien's white shirt": "Damiens weißes Hemd",
  "Two sizes too big, sleeves rolled, a pencil in the pocket and a coffee ring nobody could wash out. It still smells of solder.":
    "Zwei Nummern zu groß, Ärmel hochgekrempelt, ein Bleistift in der Brusttasche und ein Kaffeerand, den niemand herausgewaschen bekam. Es riecht noch nach Lötzinn.",
  "Hear Damien's echo.": "Höre Damiens Echo.",
  "Nordic sweater": "Norwegerpullover",
  "Star yoke, rib cuffs, wool that argues back. For the surface, and for the cold archive.":
    "Sternenpasse, Rippbündchen, Wolle mit Widerworten. Für die Oberfläche – und fürs Kältearchiv.",
  "Neon mesh top": "Neon-Netzshirt",
  "Black mesh with glowing seams. The bots insisted there be a party. There was a party.":
    "Schwarzes Netz mit leuchtenden Nähten. Die Bots bestanden auf einer Party. Es gab eine Party.",
  "colour::Neon pink": "Neonpink",
  "colour::Neon cyan": "Neoncyan",
  "Expedition parka": "Expeditionsparka",
  "Quilted to the knees, a fur-rimmed hood, eleven pockets. Rated for the surface in January, or the cryo bay in any month.":
    "Gesteppt bis zu den Knien, Kapuze mit Fellrand, elf Taschen. Zugelassen für die Oberfläche im Januar – oder die Kryokammer in jedem Monat.",
  "Track jacket 1989": "Trainingsjacke 1989",
  "Shell suit, Cottbus, 1989: turquoise and violet, a zip that sings. Somebody kept it for thirty-seven years.":
    "Ballonseide, Cottbus, 1989: Türkis und Violett, ein Reißverschluss, der singt. Jemand hat sie siebenunddreißig Jahre aufbewahrt.",
  "The first shaft crew left a sports bag in the rubble tunnel. It has waited there since 1989.":
    "Die erste Schachtmannschaft hat im Geröllstollen eine Sporttasche vergessen. Sie wartet dort seit 1989.",
  "colour::Turquoise & violet": "Türkis & Violett",
  "colour::Red & white": "Rot & Weiß",
  "Hazmat suit": "Schutzanzug",
  "Taped seams, a window for the badge, a hood that is never up when it should be. Drill procedure: walk, do not run.":
    "Verklebte Nähte, ein Fenster für den Ausweis, eine Kapuze, die nie oben ist, wenn sie es sein sollte. Übungsvorschrift: gehen, nicht rennen.",
  "Build the Exotic Matter Containment first — the suit copies its seal rating.":
    "Baue zuerst das Exotic Matter Containment – der Anzug übernimmt seine Dichtklasse.",
  "Forge mantle": "Schmiedemantel",
  "Charcoal wool to the shins, gold at every edge, a Halo shard at the throat. Made for one night at the Infinity Forge.":
    "Anthrazitwolle bis zu den Schienbeinen, Gold an jeder Kante, ein Halo-Splitter am Hals. Gemacht für eine Nacht an der Infinity Forge.",
  "Something will happen at the Infinity Forge.": "An der Infinity Forge wird etwas geschehen.",
  "colour::Forge charcoal": "Schmiede-Anthrazit",
  "Evening skirt": "Abendrock",
  "Satin to mid-calf, a sash, a swish on every stair. Packed for a gala the lab never had.":
    "Satin bis zur Wade, eine Schärpe, ein Rascheln auf jeder Stufe. Eingepackt für eine Gala, die das Labor nie hatte.",
  "A garment bag hangs in the room where the lab's radio once talked to the world.":
    "Ein Kleidersack hängt in dem Raum, in dem der Funk des Labors einst mit der Welt sprach.",
  "colour::Midnight": "Mitternacht",
  "colour::Emerald": "Smaragd",
  "colour::Wine": "Weinrot",
  "Track pants 1989": "Trainingshose 1989",
  "Three stripes, a crackle on every step, cuffs that hold the ankle like a promise.":
    "Drei Streifen, ein Knistern bei jedem Schritt, Bündchen, die den Knöchel halten wie ein Versprechen.",
  "The track suit came in two parts. The trousers ended up in the drone hangar, folded into a tarp.":
    "Der Trainingsanzug kam in zwei Teilen. Die Hose landete im Drohnenhangar, eingeschlagen in eine Plane.",
  "Running leggings": "Laufleggings",
  "A reflective stripe, a key pocket, zero drag. The long corridor on Level 0 is exactly 140 m.":
    "Ein Reflexstreifen, eine Schlüsseltasche, null Luftwiderstand. Der lange Flur auf Ebene 0 misst genau 140 m.",
  "Court shoes": "Pumps",
  "A low heel, a pointed toe, a click the MCP can hear three rooms away.":
    "Ein niedriger Absatz, eine spitze Kappe, ein Klacken, das der MCP drei Räume weit hört.",
  "colour::Gold": "Gold",
  "Snow boots": "Schneestiefel",
  "Padded to the calf, a fur cuff, a sole like a tractor tyre. The cryo bay has met its match.":
    "Gepolstert bis zur Wade, ein Fellrand, eine Sohle wie ein Traktorreifen. Die Kryokammer hat ihren Meister gefunden.",
  "High updo": "Hochsteckfrisur",
  "Sides pulled up, a pompadour rolled high into a bun, a few waves that never stay put. Twenty pins, one minute, no mirror.":
    "Die Seiten hochgesteckt, eine Tolle, hoch zum Dutt gerollt, ein paar Wellen, die nie halten. Zwanzig Nadeln, eine Minute, kein Spiegel.",
  "colour::Copper orange": "Kupferorange",
  "Sou'wester": "Südwester",
  "Yellow oilskin, a brim that is longer at the back. The cooling floors drip down the neck otherwise.":
    "Gelbes Ölzeug, eine Krempe, die hinten länger ist. Sonst tropfen die Kühlebenen in den Nacken.",
  "A rain hat waits on a hook by the pumps of the cooling level.":
    "Ein Regenhut wartet an einem Haken bei den Pumpen der Kühlebene.",
  "Neon flower crown": "Neon-Blumenkranz",
  "Glow-thread petals round the updo. K2-LDR wove it, then denied everything.":
    "Blütenblätter aus Leuchtfaden um die Hochsteckfrisur. K2-LDR hat ihn geflochten und dann alles abgestritten.",
  Sweatband: "Schweißband",
  "Terry towelling, a stripe, a small crystal stitched on. It has seen every lap.":
    "Frottee, ein Streifen, ein kleiner aufgestickter Kristall. Es hat jede Runde gesehen.",
  Sunglasses: "Sonnenbrille",
  "Square frames, dark lenses, 1989. Pointless underground. Worn anyway.":
    "Eckige Fassung, dunkle Gläser, 1989. Unter der Erde sinnlos. Trotzdem getragen.",
  "A pair of sunglasses lies on the observatory console, pointing at the sky.":
    "Eine Sonnenbrille liegt auf der Konsole des Observatoriums, zum Himmel gerichtet.",
  "Gig bag": "Gigbag",
  "A padded guitar bag, Damien's studio sticker on the pocket. The guitar is still inside, out of tune.":
    "Eine gepolsterte Gitarrentasche, Damiens Studioaufkleber auf der Tasche. Die Gitarre steckt noch drin, verstimmt.",
  "Pearl necklace": "Perlenkette",
  "One strand, one knot between each pearl. It belonged to somebody who dressed up for experiments.":
    "Ein Strang, ein Knoten zwischen jeder Perle. Sie gehörte jemandem, der sich für Experimente schick machte.",
  "A jewellery box waits between the library shelves — a present nobody ever unwrapped.":
    "Ein Schmuckkästchen wartet zwischen den Regalen der Bibliothek – ein Geschenk, das nie jemand ausgepackt hat.",
  "colour::Pearl": "Perlweiß",
  "Loosened tie": "Gelockerte Krawatte",
  "Skinny, black, knot pulled down two fingers. Damien wore it to every meeting and to none of the photos.":
    "Schmal, schwarz, der Knoten zwei Finger tief gezogen. Damien trug sie zu jedem Meeting und auf keinem Foto.",
  "Glow bangles": "Leuchtarmreifen",
  "Five bangles of spun glow thread. They charge in the lamp light and fade by morning.":
    "Fünf Armreifen aus gesponnenem Leuchtfaden. Sie laden sich im Lampenlicht auf und verblassen bis zum Morgen.",

  // ── Signature looks (content/looks.ts) ──
  "Lead Researcher": "Leitende Forscherin",
  "Shirt, coat, gloves, goggles pushed up. The version of Jade the grant committee met.":
    "Hemd, Kittel, Handschuhe, Schutzbrille hochgeschoben. Die Jade, die der Förderausschuss kennengelernt hat.",
  Weekend: "Wochenende",
  "Tee, jeans, hair down. Down here a weekend is a state of mind.":
    "Shirt, Jeans, Haare offen. Hier unten ist ein Wochenende eine Geisteshaltung.",
  "Night Shift": "Nachtschicht",
  "Soft layers, a headlamp, fingerless gloves for the keyboard at 03:27.":
    "Weiche Lagen, eine Stirnlampe, fingerlose Handschuhe für die Tastatur um 03:27.",
  "Morning Laps": "Morgenrunden",
  "Leggings, a sweatband, a ponytail that keeps time. Level 0 has the longest corridor.":
    "Leggings, ein Schweißband, ein Pferdeschwanz, der den Takt hält. Ebene 0 hat den längsten Flur.",
  "Surface Winter": "Winter an der Oberfläche",
  "Parka, star sweater, snow boots, a scarf far too long. For the day she goes up.":
    "Parka, Sternenpullover, Schneestiefel, ein viel zu langer Schal. Für den Tag, an dem sie nach oben geht.",
  "Containment Drill": "Eindämmungsübung",
  "Hazmat suit, respirator, hi-vis. Walk, do not run. The MCP times it anyway.":
    "Schutzanzug, Atemschutz, Warnhose. Gehen, nicht rennen. Der MCP stoppt trotzdem die Zeit.",
  "Cottbus 1989": "Cottbus 1989",
  "Shell suit, sunglasses, bum bag. The year the lab's first crystal was a rumour.":
    "Ballonseide, Sonnenbrille, Bauchtasche. Das Jahr, in dem der erste Kristall des Labors ein Gerücht war.",
  "Cooling Floor Drizzle": "Nieselregen auf der Kühlebene",
  "Slicker, sou'wester, wellies, braids. Level −1 drips; Jade is ready.":
    "Regenjacke, Südwester, Gummistiefel, Zöpfe. Ebene −1 tropft; Jade ist bereit.",
  "Gala Night": "Galaabend",
  "Black turtleneck, satin skirt, pearls, the updo at its highest. Nobody sent invitations.":
    "Schwarzer Rollkragen, Satinrock, Perlen, die Hochsteckfrisur so hoch wie nie. Einladungen hat niemand verschickt.",
  "Field Expedition": "Feldexpedition",
  "Flannel, bomber, headlamp, a pack for three days. The deep floors are a continent.":
    "Flanell, Bomberjacke, Stirnlampe, Gepäck für drei Tage. Die tiefen Ebenen sind ein Kontinent.",
  "The Archivist": "Die Archivarin",
  "Cardigan, plaid, reading glasses, a bun with a pencil. Files first, questions later.":
    "Strickjacke, Karorock, Lesebrille, ein Dutt mit Bleistift. Erst die Akten, dann die Fragen.",
  "Studio Session": "Studiosession",
  "Headphones, the gig bag, all black. Damien's studio remembers how to sound.":
    "Kopfhörer, Gigbag, ganz in Schwarz. Damiens Studio erinnert sich, wie es klingt.",
  "Somewhere in the lab a room is waiting for a tune.":
    "Irgendwo im Labor wartet ein Raum auf eine Melodie.",
  "Neon Festival": "Neonfestival",
  "Glowing mesh, a flower crown, neon everything. Ten bots, one party, zero permits.":
    "Leuchtendes Netz, ein Blumenkranz, alles in Neon. Zehn Bots, eine Party, null Genehmigungen.",
  "Wake every lore bot in the lab — they have plans.":
    "Wecke jeden Lore-Bot im Labor – sie haben Pläne.",
  "Infinity Forge Ceremony": "Zeremonie an der Infinity Forge",
  "The forge mantle over the black shirt, a crystal at the throat. For the night the Halo answered.":
    "Der Schmiedemantel über dem schwarzen Hemd, ein Kristall am Hals. Für die Nacht, in der der Halo antwortete.",
  "Hero of the Halo": "Heldin des Halo",
  "Cape, visor, servo gloves, cerulean hair. Every ending, one outfit.":
    "Umhang, Visier, Servohandschuhe, ceruleanblaues Haar. Jedes Ende, ein Outfit.",
  "See every ending the lab has on record.": "Erlebe jedes Ende, das das Labor verzeichnet.",
  "Keeper of #0089": "Hüterin von #0089",
  "The circlet, a white cape, silver hair. All thirty slices, home again.":
    "Der Stirnreif, ein weißer Umhang, silbernes Haar. Alle dreißig Slices, wieder zu Hause.",
  "Bring every slice of Crystal #0089 home.": "Bring jeden Slice von Kristall #0089 nach Hause.",
  "Night-black coat, amber visor, cerulean updo. What Jade wore when the crystal spoke.":
    "Nachtschwarzer Kittel, bernsteinfarbenes Visier, ceruleanblaue Hochsteckfrisur. Was Jade trug, als der Kristall sprach.",
  "Not every ending is on the record.": "Nicht jedes Ende steht im Verzeichnis.",
  "For Damien": "Für Damien",
  "His old white shirt, his tie, her boots. She rolls the sleeves the way he did.":
    "Sein altes weißes Hemd, seine Krawatte, ihre Stiefel. Sie krempelt die Ärmel so hoch wie er.",
  "Listen for an echo in the lab.": "Horch auf ein Echo im Labor.",
  "New look for Jade: {name}": "Neuer Look für Jade: {name}",
};
