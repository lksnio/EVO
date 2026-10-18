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
