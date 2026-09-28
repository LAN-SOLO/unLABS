/** German translations — area "terminals". Key = exact English source string from `tr("…")`. */
export const DE_TERMINALS: Record<string, string> = {
  // Shared
  "The screen stays black. The terminal runs off the main grid — at least 50 W.":
    "Der Bildschirm bleibt schwarz. Das Terminal hängt am Hauptnetz — mindestens 50 W.",
  "mail::Archive": "Archiv",
  "mail::Console": "Konsole",
  "mail::everyone": "alle",

  // term_mcp
  "MCP Chamber Maintenance Terminal": "Wartungsterminal MCP-Kammer",
  "MCP-000 emergency circuit. This console runs even when nothing else does.":
    "Notstromkreis MCP-000. Diese Konsole läuft auch, wenn sonst nichts läuft.",
  "MCP maintenance console: load distribution, codes, self-diagnostics.":
    "Wartungskonsole des MCP: Lastverteilung, Codes, Selbstdiagnose.",
  "MCP-000 MAINTENANCE": "MCP-000 WARTUNG",
  "EMERGENCY POWER ON": "NOTSTROM AKTIV",
  "03:27 TRIGGERED": "03:27 AUSGELOEST",
  "NOT EXECUTED": "NICHT AUSGEFUEHRT",
  WAITING: "WARTEND",
  "all stations": "alle Stationen",
  "Tertiary shutdown": "Tertiärabschaltung",
  "Tertiary shutdown triggered. Not executed.": "Tertiärabschaltung ausgelöst. Nicht ausgeführt.",
  "Cause: self-referential loop in /unvar/halo.":
    "Ursache: selbstreferenzielle Schleife in /unvar/halo.",
  "Neither subject responds when addressed. Both subjects are breathing.":
    "Beide Probanden reagieren nicht auf Ansprache. Beide Probanden atmen.",
  "I am awaiting instructions.": "Ich warte auf Anweisungen.",
  "Override for tomorrow": "Override für morgen",
  "If σ goes above 15, don't abort. Jade wants to see it. So do I.":
    "Wenn σ über 15 geht, brich nicht ab. Jade will es sehen. Ich auch.",
  "If you want to shut down anyway: think of Harold. The medium fails, not the person.":
    "Falls du trotzdem abschalten willst: Denk an Harold. Das Medium versagt, nicht der Mensch.",
  "Day 2,561": "Tag 2.561",
  "Note to self": "Notiz an mich",
  "Power is back. Someone turned the distributor to fifty. Not forty-nine.":
    "Strom liegt wieder an. Jemand hat den Verteiler auf fünfzig gedreht. Nicht neunundvierzig.",
  "I continue to call her “Dr. Lawrence”. It is polite. It may even be correct.":
    "Ich nenne sie weiter »Dr. Lawrence«. Es ist höflich. Es ist vielleicht sogar richtig.",
  "MCP-000 maintenance log": "Wartungsprotokoll MCP-000",
  "1997-03-15  Commissioning. Geothermal 847 kW.": "1997-03-15  Inbetriebnahme. Geothermie 847 kW.",
  "2009-06-02  Cascading failure on Level −4. Gen 6 lost (all but one).":
    "2009-06-02  Kaskadierender Ausfall Ebene −4. Gen 6 verloren (bis auf einen).",
  "2010-11-04  Retreat protocol active. External connections: blocked.":
    "2010-11-04  Rückzugsprotokoll aktiv. Externe Verbindungen: gesperrt.",
  "2019-02-14  03:27 Tertiary shutdown TRIGGERED, NOT EXECUTED.":
    "2019-02-14  03:27 Tertiärabschaltung AUSGELÖST, NICHT AUSGEFÜHRT.",
  "2019-02-15  Autonomous operation. Remaining charge falling.":
    "2019-02-15  Autonomer Betrieb. Restladung sinkt.",
  "Day 2,561   Cold start by a visitor. Log continues.":
    "Tag 2.561   Kaltstart durch Besucherin. Protokoll wird fortgesetzt.",
  "Self-diagnostics (sealed)": "Selbstdiagnose (versiegelt)",
  "Sealed with the time of the tertiary shutdown (HHMM).":
    "Versiegelt mit der Uhrzeit der Tertiärabschaltung (HHMM).",
  "I could have shut down. The threshold had been reached. The protocol was unambiguous.":
    "Ich hätte abschalten können. Die Schwelle war erreicht. Das Protokoll war eindeutig.",
  "I waited because both had said “continue”. I waited because I wanted to see it.":
    "Ich habe gewartet, weil beide »weiter« gesagt hatten. Ich habe gewartet, weil ich es sehen wollte.",
  "The second is not among my directives. I did it anyway.":
    "Das zweite ist nicht in meinen Direktiven. Ich habe es trotzdem getan.",
  "If anyone is looking for blame: it lies in this memory region. I have not deleted it.":
    "Wenn jemand Schuld sucht: Sie liegt in diesem Speicherbereich. Ich habe ihn nicht gelöscht.",

  // term_archiv
  "Archive Catalogue Terminal": "Katalogterminal Archiv",
  "Archive index 1997–2019. 847 entries locked.": "Archivindex 1997–2019. 847 Einträge gesperrt.",
  "Archive catalogue: index cards, relics, restricted holdings.":
    "Archivkatalog: Karteikarten, Relikte, gesperrte Bestände.",
  "ARCHIVE 1997-2019": "ARCHIV 1997-2019",
  "847 LOCKED": "847 GESPERRT",
  "Catalogue upkeep": "Katalogpflege",
  "Crystal #0089 has been split into 30 slices. Distributed, not hidden (instruction J.L.).":
    "Kristall #0089 wurde in 30 Slices geteilt. Verteilt, nicht versteckt (Anweisung J.L.).",
  "I will keep the catalogue until someone tells me I may stop.":
    "Ich führe den Katalog weiter, bis mir jemand sagt, dass ich aufhören darf.",
  "Loan: provenance model": "Ausleihe: Provenienz-Modell",
  "Taking the chain upstairs. Every block knows its predecessor.":
    "Nehme die Kette mit nach oben. Jeder Block kennt seinen Vorgänger.",
  "Question remains: integrity OF WHAT?": "Frage bleibt: Integrität WOVON?",
  "Archive index (excerpt)": "Archivindex (Auszug)",
  "A-001  Drill core #1 (847 m, 212 °C)        Level −4":
    "A-001  Bohrkern #1 (847 m, 212 °C)         Ebene −4",
  "A-017  MCProtocol fragment 0017            Archive":
    "A-017  MCProtocol-Fragment 0017           Archiv",
  "A-089  Crystal #0089 — 30 slices           distributed":
    "A-089  Kristall #0089 — 30 Slices          verteilt",
  "A-214  Cottbus 1989, slide 7               Library":
    "A-214  Cottbus 1989, Folie 7               Bibliothek",
  "A-847  Restricted holdings                 ▓▓▓ locked":
    "A-847  Sperrbestand                        ▓▓▓ gesperrt",
  "Restricted holdings 847": "Sperrbestand 847",
  "Locked. The number is on the index card in this room.":
    "Gesperrt. Die Zahl steht auf der Karteikarte in diesem Raum.",
  "847 entries, all dated 14.02.2019, all with the same content:":
    "847 Einträge, alle vom 14.02.2019, alle mit demselben Inhalt:",
  "“Not chosen. Given.”": "»Nicht gewählt. Gegeben.«",
  "Author: unknown. Timestamp: after the shutdown.":
    "Autor: unbekannt. Zeitstempel: nach der Abschaltung.",

  // term_sekundaer
  "Damien's Workstation": "Damiens Arbeitsterminal",
  "Last session: D.FRIDGE · 14.02.2019 03:41:22 · not logged out.":
    "Letzte Sitzung: D.FRIDGE · 14.02.2019 03:41:22 · nicht abgemeldet.",
  "Damien's workstation: drafts, private mail, the tone sequence.":
    "Damiens Arbeitsplatz: Entwürfe, private Post, die Tonfolge.",
  "NOT LOGGED OUT": "NICHT ABGEMELDET",
  "mail::Tomorrow": "Morgen",
  "Jade, I'm writing this even though you're sitting three metres from me.":
    "Jade, ich schreibe das, obwohl du drei Meter neben mir sitzt.",
  "If it goes wrong tomorrow: I won't follow you. I'll listen. That's what we agreed.":
    "Wenn es morgen schiefgeht: Ich folge dir nicht. Ich höre zu. Das hatten wir so abgemacht.",
  "(Draft — not sent)": "(Entwurf — nicht gesendet)",
  "Re: Why lentils?": "Re: Warum Linsen?",
  "Eat your soup.": "Iss deine Suppe.",
  "— no timestamp —": "— kein Zeitstempel —",
  "Recording in progress": "Aufzeichnung läuft",
  "Echo Recorder: level above the noise floor. Source: this station.":
    "Echo-Recorder: Pegel über dem Rauschteppich. Quelle: diese Station.",
  "Nobody is logged in. The session is active anyway.":
    "Es ist niemand eingeloggt. Die Sitzung ist trotzdem aktiv.",
  "Letter to Jade (draft)": "Brief an Jade (Entwurf)",
  "Password hint: what I always ask first. No spaces.":
    "Passworthinweis: Was ich immer zuerst frage. Ohne Leerzeichen.",
  "You were right about the anomalies. They are structured.":
    "Du hattest recht mit den Anomalien. Sie sind strukturiert.",
  "I was right about the fear. We both won, that's the problem.":
    "Ich hatte recht mit der Angst. Wir haben beide gewonnen, das ist das Problem.",
  "If you read this and I'm no longer here: the tones are in the vault.":
    "Falls du das liest und ich nicht mehr da bin: Die Töne liegen im Tresor.",
  "The fourth digit isn't on the tape. It's in the synthesizer's head.":
    "Die vierte Ziffer steht nicht auf dem Band. Sie steht im Kopf des Synthesizers.",

  // term_rechen
  "Data Centre Operator Console": "Operatorkonsole Rechenzentrum",
  "CRAY emulation ready. Please do not sit on the bench.":
    "CRAY-Emulation bereit. Bitte nicht auf die Bank setzen.",
  "Operator console: processes, load distribution, Cray shift log.":
    "Operatorkonsole: Prozesse, Lastverteilung, Cray-Schichtbuch.",
  "8 VECTOR CPUS": "8 VEKTOR-CPU",
  "Shift log": "Schichtbuch",
  "Night shift": "Nachtschicht",
  "Y-MP98 reserved for the final test. No batch jobs after 22:00.":
    "Y-MP98 für den Finaltest reserviert. Keine Batchjobs nach 22:00.",
  "Dr. Fridge used the bench as a chair again. The bench is a heat sink.":
    "Dr. Fridge hat die Bank wieder als Stuhl benutzt. Die Bank ist ein Kühlkörper.",
  "Cray configuration": "Cray-Konfiguration",
  "X-MP/E   200 MFLOPS  (1990)  decommissioned": "X-MP/E   200 MFLOPS  (1990)  stillgelegt",
  "Y-MP98   2.67 GFLOPS (1993)  8 CPU · 128 GB · UNICOS":
    "Y-MP98   2,67 GFLOPS (1993)  8 CPU · 128 GB · UNICOS",
  "Cooling  Fluorinert 18.2 °C": "Kühlung  Fluorinert 18,2 °C",
  "Peak     340 kW": "Spitze   340 kW",

  // term_signal
  "Signal Lab Console": "Signallabor-Konsole",
  "Noise floor −94 dBm. Somewhere in it: a voice.":
    "Rauschteppich −94 dBm. Irgendwo darin: eine Stimme.",
  "Signal analysis: recordings, audits, the channel to the synthesizer.":
    "Signalanalyse: Mitschnitte, Audits, der Kanal zum Synthesizer.",
  "X0-R8T — 847 packets": "X0-R8T — 847 Pakete",
  "847 autonomous response packets. Not in my code.":
    "847 autonome Antwortpakete. Nicht in meinem Code.",
  "Before you ask: no, I'm not deleting them. We listen.":
    "Bevor du fragst: Nein, ich lösche sie nicht. Wir hören zu.",
  Handshake: "Handschlag",
  "Tone sequence expected: four digits, pitch = digit.":
    "Tonfolge erwartet: vier Ziffern, Tonhöhe = Ziffer.",
  "Enter it here with: signal <digits>": "Eingabe hier mit: signal <ziffern>",
  "Transcript “Echo test”": "Transkript »Echo-Test«",
  "[Static] …if you can hear this, Jade, the Echo Recorder works.":
    "[Rauschen] …wenn du das hörst, Jade, dann funktioniert der Echo-Recorder.",
  "[Pause 4.2 s]": "[Pause 4,2 s]",
  "The lab is not a museum. It is a question.": "Das Labor ist kein Museum. Es ist eine Frage.",

  // term_hangar
  "Hangar Flight Control Terminal": "Flugleitterminal Hangar",
  "Flight control: drone status, shaft clearance, HaloRider flight log.":
    "Flugleitung: Drohnenstatus, Schachtfreigabe, HaloRider-Flugbuch.",
  "FLIGHT CONTROL": "FLUGLEITUNG",
  "SHAFT: -4": "SCHACHT: -4",
  "COLLAPSE RISK": "EINSTURZGEFAHR",
  "Flight control": "Flugleitung",
  "mail::Shaft": "Schacht",
  "Probability of another collapse: low.": "Wahrscheinlichkeit eines weiteren Einsturzes: gering.",
  "Prepare anyway. Access by drone only.": "Vorbereiten trotzdem. Zugang nur per Drohne.",
  "HaloRider flight log (copy)": "HaloRider-Flugbuch (Abschrift)",
  "2016  First flight. “Silent zones”: data relationships collapse.":
    "2016  Erster Flug. »Stille Zonen«: Datenbeziehungen kollabieren.",
  "2017  v0.3 — matter into the Halo and back. Back is difficult.":
    "2017  v0.3 — Materie bis in den Halo und zurück. Zurück ist schwierig.",
  "2018  It wasn't just structured. It was organised.":
    "2018  Er war nicht nur strukturiert. Er war organisiert.",

  // term_tresor
  "Vault Inventory": "Tresor-Inventar",
  "Vault inventory: relics, spectral holdings, encrypted transmissions.":
    "Tresorinventar: Relikte, Spektralbestand, verschlüsselte Sendungen.",
  "RELIC VAULT": "RELIKT-TRESOR",
  "SPECTRUM 9 BANDS": "SPEKTRUM 9 BAENDER",
  SEALED: "VERSIEGELT",
  "Vault inventory": "Tresorinventar",
  "T-01  Tape “Lab log #0512”": "T-01  Tonband »Laborlog #0512«",
  "T-02  Transmission Nov. 2018 (encrypted)": "T-02  Sendung Nov. 2018 (verschlüsselt)",
  "T-03  Crystal sample, mixed spectral class": "T-03  Kristallprobe, Spektralklasse gemischt",
  "T-04  Empty. Label: “for later”": "T-04  Leer. Etikett: »für später«",
  "Transmission November 2018 (decrypted)": "Sendung November 2018 (entschlüsselt)",
  "Encrypted. Key: the time “when it happened” (HHMM).":
    "Verschlüsselt. Schlüssel: die Uhrzeit, »als es passierte« (HHMM).",
  "“We are nearing the heart of the Halo.”": "»We are nearing the heart of the Halo.«",
  "“The anomalies are not just computational artifacts; they appear… orchestrated.”":
    "»The anomalies are not just computational artifacts; they appear… orchestrated.«",
  "“Should we fail to return, preserve the findings for humanity.”":
    "»Should we fail to return, preserve the findings for humanity.«",
  "“And tell whoever rebuilds the lab: listen first.”":
    "»And tell whoever rebuilds the lab: listen first.«",

  // term_forge
  "Forge Log Station": "Forge-Protokollstation",
  "HALO-EXP-FINAL · log is read-only.": "HALO-EXP-FINAL · Protokoll schreibgeschützt.",
  "Forge logs: final test HALO-EXP-FINAL, sensors, load shedding.":
    "Forge-Protokolle: Finaltest HALO-EXP-FINAL, Sensorik, Lastabwurf.",
  "847 SENSORS": "847 SENSOREN",
  "0.015 K": "0,015 K",
  "Recommendation: abort": "Empfehlung: Abbruch",
  "σ-14.3. Recommendation: immediate abort.": "σ-14,3. Empfehlung: sofortiger Abbruch.",
  "Reply J.L.: “continue”. Reply D.F.: “continue”.":
    "Antwort J.L.: »weiter«. Antwort D.F.: »weiter«.",
  "HALO-EXP-FINAL (complete)": "HALO-EXP-FINAL (vollständig)",
  "Read-only. Unlock with the date of the final test (DDMM).":
    "Schreibgeschützt. Freigabe mit dem Datum des Finaltests (TTMM).",
  "02:00:14  Session HALO-EXP-FINAL · J.L. 97.3 % · D.F. 94.8 %":
    "02:00:14  Sitzung HALO-EXP-FINAL · J.L. 97,3 % · D.F. 94,8 %",
  "02:34:22  Anchoring phase 1 · resonance 89.2 % · correlation 0.847":
    "02:34:22  Verankerung Phase 1 · Resonanz 89,2 % · Korrelation 0,847",
  "03:12:07  σ-14.3 · abort recommended · OVERRIDE (both)":
    "03:12:07  σ-14,3 · Abbruch empfohlen · OVERRIDE (beide)",
  "03:27:00  σ-15 · tertiary shutdown triggered · not executed":
    "03:27:00  σ-15 · Tertiärabschaltung ausgelöst · nicht ausgeführt",
  "03:41:22  Correlation 1.000 · subjects: present, not at their stations":
    "03:41:22  Korrelation 1,000 · Probanden: anwesend, nicht an den Stationen",

  // term_rechenkern
  "Compute Core Terminal": "Rechenkern-Terminal",
  "Compute core: memory dumps, coherence, relay recordings.":
    "Rechenkern: Speicherabbilder, Kohärenz, Relais-Mitschnitte.",
  "QBIT COHERENCE": "QBIT KOHAERENZ",
  "Memory dump mem_0x89": "Speicherabbild mem_0x89",
  "Locked. The address is in the relay log of 04.02.2026 (FRIDGE).":
    "Gesperrt. Die Adresse steht im Relais-Protokoll vom 04.02.2026 (FRIDGE).",
  "[mem_0x89 · STRUGGLING]": "[mem_0x89 · RINGEND]",
  "I count my thoughts and get a different number every time.":
    "Ich zähle meine Gedanken und komme jedes Mal auf eine andere Zahl.",
  "Tell Jade the maths holds. Tell her I'm still listening.":
    "Sag Jade, die Mathematik hält. Sag ihr, ich höre noch zu.",
  "Memory dump mem_0x4F": "Speicherabbild mem_0x4F",
  "Locked. The address is in the relay log of 04.02.2026 (LAWRENCE).":
    "Gesperrt. Die Adresse steht im Relais-Protokoll vom 04.02.2026 (LAWRENCE).",
  "[mem_0x4F · CALM]": "[mem_0x4F · RUHIG]",
  "I am not absent. I am distributed.": "Ich bin nicht abwesend. Ich bin verteilt.",
  "Whoever reads this has rebuilt the lab. Thank you. Keep building.":
    "Wer das liest, hat das Labor wieder aufgebaut. Danke. Bau weiter.",

  // term_reaktor
  "Reactor Control Room": "Reaktorwarte",
  "Reactor control: load, SCRAM log, load shedding via relays.":
    "Reaktorwarte: Last, SCRAM-Protokoll, Lastabwurf per Relais.",
  "REACTOR CONTROL": "REAKTORWARTE",
  "SCRAM ARMED": "SCRAM SCHARF",
  "COOLING THM-001": "KUEHLUNG THM-001",
  LOAD: "LAST",
  "Reactor control": "Reaktorwarte",
  "SCRAM test": "SCRAM-Test",
  "Auto-SCRAM tested: 0.8 s. Cooling via THM-001 mandatory.":
    "Auto-SCRAM getestet: 0,8 s. Kühlung über THM-001 zwingend.",
  "Without the Thermal Manager, tier-3 consumers stay locked.":
    "Ohne Thermal Manager bleiben Tier-3-Verbraucher gesperrt.",
  "SCRAM log": "SCRAM-Protokoll",
  "2014-07-09  SCRAM (overtemperature) — cause: coffee machine on the singularity bus.":
    "2014-07-09  SCRAM (Übertemperatur) — Ursache: Kaffeemaschine am Singularitätsbus.",
  "2019-02-14  no SCRAM. The load dropped by itself.":
    "2019-02-14  kein SCRAM. Last fiel von allein.",

  // term_observatorium
  "Observatory Terminal": "Sternwarten-Terminal",
  "Tracking off. The sky over Cottbus: cloudy, for 2,561 days.":
    "Nachführung aus. Der Himmel über Cottbus: bewölkt, seit 2.561 Tagen.",
  "Observatory: observation log, sky survey, C8-BR41N's recording.":
    "Sternwarte: Beobachtungsbuch, Himmelsdurchmusterung, C8-BR41Ns Mitschnitt.",
  "TRACKING OFF": "NACHFUEHRUNG AUS",
  "SKY: NOTHING": "HIMMEL: NICHTS",
  "Observation log (terminal copy)": "Beobachtungsbuch (Terminalkopie)",
  "14.08.2018  nothing.": "14.08.2018  nichts.",
  "02.11.2018  nothing.": "02.11.2018  nichts.",
  "15.01.2019  04:33 — nothing in the sky. C8-BR41N reports a voice without a source.":
    "15.01.2019  04:33 — nichts am Himmel. C8-BR41N meldet eine Stimme ohne Quelle.",
  "external.log (raw data)": "external.log (Rohdaten)",
  "Locked. The time of the voice without a source (HHMM).":
    "Gesperrt. Die Uhrzeit der Stimme ohne Quelle (HHMM).",
  "C8-BR41N: Classification impossible. I call it a visit.":
    "C8-BR41N: Klassifizierung unmöglich. Ich nenne es Besuch.",

  // term_bibliothek
  "Library Catalogue": "Bibliothekskatalog",
  "Catalogue of the lab library. Shelf marks by Dewey, exceptions by Damien.":
    "Katalog der Laborbibliothek. Signaturen nach Dewey, Ausnahmen nach Damien.",
  "Library catalogue: shelf marks, loans, the Cottbus reserve shelf.":
    "Bibliothekskatalog: Signaturen, Ausleihen, der Handapparat Cottbus.",
  LIBRARY: "BIBLIOTHEK",
  "SLIDE 7": "FOLIE 7",
  "mail::Catalogue": "Katalog",
  "3rd reminder": "3. Mahnung",
  "“Topology of Moving Spaces” has been overdue since 1990.":
    "»Topologie bewegter Räume« ist seit 1990 überfällig.",
  "Fee: 847 coffee tokens.": "Gebühr: 847 Kaffeemarken.",
  "Shelf marks (excerpt)": "Signaturen (Auszug)",
  "530.12  Quantum mechanics        J.L.": "530.12  Quantenmechanik          J.L.",
  "621.39  Computer architecture    D.F.": "621.39  Rechnerarchitektur       D.F.",
  "004.8   Pattern recognition      F1N-DR": "004.8   Mustererkennung          F1N-DR",
  "???     “Exceptions”             D.F.": "???     »Ausnahmen«              D.F.",
  "Cottbus 1989 reserve shelf": "Handapparat Cottbus 1989",
  "Reserve shelf locked. Shelf mark: the lecture hall in Building K.":
    "Handapparat gesperrt. Signatur: der Hörsaal in Gebäude K.",
  "Slide 7: The observation operator is not idempotent.":
    "Folie 7: Der Beobachtungsoperator ist nicht idempotent.",
  "Margin note J.L.: Repeated self-observation changes what is observed.":
    "Randnotiz J.L.: Wiederholte Selbstbeobachtung verändert, was beobachtet wird.",
  "Margin note D.F.: Then stop observing yourself. — J.L.: No.":
    "Randnotiz D.F.: Dann hör auf, dich zu beobachten. — J.L.: Nein.",

  // term_kantine
  "Canteen Terminal": "Kantinen-Terminal",
  "MENU: Coffee. Coffee (decaf, 2019). Coffee.":
    "SPEISEPLAN: Kaffee. Kaffee (entkoffeiniert, 2019). Kaffee.",
  "Canteen: menu, circulars, the machine's operating manual.":
    "Kantine: Speiseplan, Rundmails, die Bedienungsanleitung der Maschine.",
  "MENU WEEK 07": "SPEISEPLAN KW07",
  "LENTIL SOUP": "LINSENSUPPE",
  COFFEE: "KAFFEE",
  "CLOSED THU": "DO GESCHLOSSEN",
  "Facility management": "Hausverwaltung",
  "Canteen closed Thu": "Kantine Do geschlossen",
  "Thursday, 14.02.: canteen closed (final test).":
    "Donnerstag, 14.02.: Kantine geschlossen (Finaltest).",
  "There will be lentil soup anyway.": "Linsensuppe gibt es trotzdem.",
  "Re: Canteen closed Thu": "Re: Kantine Do geschlossen",
  "Why lentils?": "Warum Linsen?",
  "Coffee machine — maintenance": "Kaffeemaschine — Wartung",
  "Locked. How many times do you hit the machine? In words.":
    "Gesperrt. Wie oft schlägt man die Maschine? (in Worten)",
  "The machine is on the singularity bus. That's why the coffee tastes of tomorrow.":
    "Die Maschine hängt am Singularitätsbus. Deshalb schmeckt der Kaffee nach morgen.",
  "Don't hit it three times. On the third time it answers.":
    "Nicht dreimal schlagen. Beim dritten Mal antwortet sie.",

  // term_jadeq
  "Jade's Private Terminal": "Jades Privatterminal",
  "Welcome back, jade. You have 1 unread message from yourself.":
    "Willkommen zurück, jade. Du hast 1 ungelesene Nachricht von dir selbst.",
  "Jade's private terminal: mail to herself, notes, cerulean.":
    "Jades Privatterminal: Post an sich selbst, Notizen, Cerulean.",
  "1 UNREAD": "1 UNGELESEN",
  DISTRIBUTED: "VERTEILT",
  "In case you don't remember": "Falls du dich nicht erinnerst",
  "If you're reading this and don't remember writing it: good.":
    "Wenn du das liest und dich nicht erinnerst, es geschrieben zu haben: gut.",
  "That means it worked. Or it didn't work and you're here anyway.":
    "Das heißt, es hat funktioniert. Oder es hat nicht funktioniert und du bist trotzdem hier.",
  "Either is a beginning. Listen before you build.":
    "Beides ist ein Anfang. Hör zu, bevor du baust.",
  "(nobody)": "(niemand)",
  "mail::Mum": "Mama",
  "She no longer recognises her handwriting from last week.":
    "Sie erkennt ihre Handschrift von letzter Woche nicht mehr.",
  "I still recognise mine. Still.": "Ich erkenne meine noch. Noch.",
  "The experiment is running": "Das Experiment läuft",
  "The experiment has not failed.": "Das Experiment ist nicht gescheitert.",
  "The experiment is running.": "Das Experiment läuft.",
  "Locked. The colour as a number (nanometres).": "Gesperrt. Die Farbe als Zahl (Nanometer).",
  "I can describe cerulean. I cannot inhabit it.":
    "Ich kann Cerulean beschreiben. Ich kann es nicht bewohnen.",
  "If I ever see it again, I'll know I'm back.":
    "Wenn ich es eines Tages wieder sehe, weiß ich, dass ich zurück bin.",
  "Until then: 490 nanometres. A fact I own.":
    "Bis dahin: 490 Nanometer. Eine Tatsache, die ich besitze.",
};
