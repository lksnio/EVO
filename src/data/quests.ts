// Die Aufträge der Artgenossen. Artgenossen sind selten und fast immer Auftraggeber: Man trifft sie an einer bestimmten Stelle,
// spricht sie an (Taste F) und erlebt dann etwas mit ihnen. Jeder Auftrag hat Schritte (0 = noch nicht begonnen).

export interface QuestDef {
  id: string;
  /** In welchem Zeitalter der Auftrag spielt */
  epoch: string;
  /** Das Tier, das den Gefährten frisst – es muss in diese Zeit und in dieses Wasser passen */
  eater: string;
  /** Erstes Gespräch (im Startort); {ort} ist der Ort, zu dem er vorausschwimmt */
  first: string[];
  /** Zweites Gespräch im Zielort (kurz) */
  second: string[];
  /** Der letzte Satz des zweiten Gesprächs: Danach lauschen beide, und das Tier kommt */
  hear: string;
}

/**
 * „Der Gefährte“: Ein Artgenosse erzählt von einem sicheren Ort voller Pflanzen, ohne Räuber, und schwimmt vor. Im nächsten
 * Ort wartet er – und wird von einem Tier gefressen, das in diese Zeit passt.
 * Schritte: 0 noch nicht getroffen · 1 er ist vorausgeschwommen · 2 er wurde gefressen (erledigt)
 */
export const QUESTS: QuestDef[] = [
  {
    id: 'gefaehrte',
    epoch: 'ordovizium',
    // ein Riesenkopffüßer (Cameroceras): das große Raubtier des Ordoviziums
    eater: 'cameroceras',
    first: [
      'Du siehst aus wie ich … Ich dachte schon, ich wäre der Einzige hier.',
      'Ich habe von einem Ort gehört, an dem keine Räuber lauern.',
      'Dafür wachsen dort überall Pflanzen. Ein sicherer Ort, an dem man es sich gut gehen lassen kann.',
      'Ich habe mir überlegt, dorthin aufzubrechen. Komm doch mit!',
      'Ich schwimme schon vor. Ich warte in {ort} auf dich.',
    ],
    second: [
      'Da bist du ja! Sieh dich um: Pflanzen, wohin man schaut.',
      'Und weit und breit kein Räuber. Hier könnten wir bleiben.',
    ],
    hear: 'Warte … hörst du das?',
  },
];

export const questOf = (epochId: string): QuestDef | undefined => QUESTS.find((q) => q.epoch === epochId);

/**
 * „Die gemeinsame Jagd“: Nachdem der Gefährte gefressen wurde, trifft man im selben Ort eine kleine Gruppe Überlebender deiner
 * Art. Einer erzählt von einem Schwarm Sacabambaspis in der Nähe – sie wollen gemeinsam jagen. Wer mitmacht, jagt mit ihnen
 * (mit den gewohnten Mitteln: Biss, Stoß, die Artgenossen helfen mit, die Beute wehrt sich und flieht). Sind genug erlegt – und
 * du hast selbst mitgejagt –, erklärt dir einer der Überlebenden, wie du die Gruppe später rufen kannst (siehe SWARM).
 * Schritte: 0 noch nicht angesprochen · 1 abgelehnt (die Gruppe wartet) · 2 die Jagd läuft · 3 geschafft
 */
export const JAGD = {
  id: 'jagd',
  epoch: 'ordovizium',
  /** erst danach (und im Ort, in dem er gefressen wurde) wartet die Gruppe */
  after: 'gefaehrte',
  /** so viele Artgenossen gehören zur Gruppe (von … bis) */
  group: [4, 5] as [number, number],
  /** die Beute: ein Schwarm dieser Art … */
  prey: 'sacabambaspis',
  /** … aus so vielen Tieren – kräftige Exemplare (Größe von … bis), die sich mit einem Gegenstoß wehren */
  school: 5,
  size: [1.15, 1.3] as [number, number],
  /** so viele müssen erlegt werden – von dir oder deiner Gruppe; du selbst musst dabei mitgejagt haben */
  kills: 3,
  /** so weit (Bildpunkte) liegt der Schwarm vom Treffpunkt entfernt */
  far: 1300,
  /** fehlen Tiere (geflohen, von anderen gefressen), sammelt sich der Schwarm nach so vielen Sekunden neu */
  regroup: 8,
  lines: {
    first: [
      'Noch einer von uns! Du lebst – so wie wir. Wir haben uns versteckt, als das große Tier kam.',
      'Wir sind nicht mehr viele. Wer hier allein bleibt, den frisst früher oder später etwas.',
      'Nicht weit von hier zieht ein Schwarm Sacabambaspis. Gepanzert und wehrhaft – aber einer allein macht uns alle satt.',
      'Allein traut sich keiner von uns heran. Zusammen schaffen wir es.',
    ],
    again: ['Da bist du ja wieder. Die Sacabambaspis sind noch in der Nähe.'],
    ask: 'Jagst du mit uns?',
    yes: 'Ich jage mit',
    no: 'Lieber nicht',
    accept: [
      'Gut! Schwimm voraus, wir folgen dir. Greifst du an, sind wir zur Stelle.',
      'Pass auf: Sie wehren sich und stoßen zurück. Drei sollten reichen.',
    ],
    decline: ['Schade. Wir bleiben hier – falls du es dir anders überlegst.'],
    success: [
      'Geschafft! Davon werden wir alle satt.',
      'Allein wäre keiner von uns so weit gekommen.',
      'Hör zu: Wenn du uns brauchst, ruf uns – {ruf}. Wir kommen, so viele wir sind, und helfen dir, sobald du angreifst.',
      'Aber wer mitjagt, will auch mitfressen. Lass uns etwas von der Beute übrig, dann werden wir mehr.',
      'Und wer stirbt, kommt nicht wieder. Ruf uns nicht leichtfertig.',
    ],
  },
  /** Anzeige während der Jagd */
  hud: {
    title: 'Die gemeinsame Jagd',
    goal: 'Sacabambaspis erlegt: {n} von {k}',
    group: 'Deine Gruppe: {a} von {g}',
    join: 'Du musst selbst mitjagen – greif einen an!',
    where: 'Der Schwarm zieht {dir} von dir.',
    away: 'Der Schwarm ist in {ort}.',
    regroup: 'Der Schwarm sammelt sich neu …',
    lost: 'Geschafft – aber von deiner Gruppe hat keiner überlebt.',
  },
};

/**
 * Der Schwarm: deine Gruppe, die auf deinen Ruf kommt (gelernt in „Die gemeinsame Jagd“). Wer gerufen wird, schwimmt von
 * außerhalb des Bildes herbei, folgt dir locker und hilft, sobald du angreifst – will aber von der Beute mitfressen. Jeder
 * Artgenosse hat so viel Lebenskraft wie du, greift aber schwächer an. Wer stirbt, fehlt beim nächsten Ruf; wer oft mit dir
 * Beute teilt, lockt weitere an. Der Zusammenhalt (die Evolutionsplatte „Schwarmfisch“) macht die Gruppe größer und stärker.
 */
export const SWARM = {
  /** so viele kommen höchstens auf einen Ruf … */
  cap: 6,
  /** … und so viele mehr mit vollem Zusammenhalt */
  capPlus: 4,
  /** nach so vielen gemeinsam erlegten und geteilten Beutetieren kommt ein Artgenosse dazu (mit vollem Zusammenhalt halb so viele) */
  growEvery: 4,
  /** Angriffskraft eines Artgenossen im Verhältnis zu deiner (die Lebenskraft ist gleich) … */
  dmg: 0.5,
  /** … und so viel mehr mit vollem Zusammenhalt (bleibt immer unter deiner) */
  dmgPlus: 0.25,
  /** so lange (ms) nach dem Fortschicken, bis man wieder rufen kann */
  cooldown: 8000,
  /** so weit außerhalb des Bildes tauchen die Gerufenen auf */
  spawnOff: 150,
};
