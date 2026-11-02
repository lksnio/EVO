import { schema, t, type SchemaType } from '@colyseus/schema';

// Der Zustand eines Ortes, wie ihn der Server an alle Clients im Ort verteilt (nur Änderungen werden übertragen).

/** Ein Spieler-Fisch, so wie ihn die anderen sehen. */
export const NetFish = schema(
  {
    name: t.string(),
    x: t.float32(),
    y: t.float32(),
    facing: t.int8(),
    anim: t.uint8(),
    /** Körpergröße (wächst mit dem Alter) */
    size: t.float32(),
    /** Aussehen: JSON eines Morph – ändert sich selten (Wachstum in Stufen, neue Generation) */
    look: t.string(),
    gen: t.uint16(),
    /** Uhrzeit des Spielers bei seiner letzten Meldung (ms) – zum Glätten bei den anderen */
    t: t.float64(),
    /** Verbindung kurz weg: Der Fisch bleibt stehen, bis der Spieler zurück ist (oder der Platz verfällt) */
    away: t.boolean(),
  },
  'NetFish',
);
export type NetFish = SchemaType<typeof NetFish>;

/** Ein Tier des Ortes (vom Ortswächter gerechnet, siehe protocol.ts). */
export const NetAnimal = schema(
  {
    sp: t.string(),
    x: t.float32(),
    y: t.float32(),
    d: t.int8(),
    an: t.int16(),
    hp: t.float32(),
    mh: t.float32(),
    sz: t.float32(),
    tn: t.uint32(),
    al: t.uint8(),
    at: t.boolean(),
    /** wen es gerade jagt (Sitzungskennung, leer: niemanden) */
    hu: t.string(),
    /** Uhrzeit des Ortswächters, als er es zuletzt meldete (ms) */
    t: t.float64(),
  },
  'NetAnimal',
);
export type NetAnimal = SchemaType<typeof NetAnimal>;

/** Ein Stück Fleisch am Ort. */
export const NetMeat = schema(
  {
    sp: t.string(),
    kill: t.string(),
    x: t.float32(),
    y: t.float32(),
    v: t.float32(),
    s: t.uint8(),
  },
  'NetMeat',
);
export type NetMeat = SchemaType<typeof NetMeat>;

export const ZoneState = schema(
  {
    /** Zeitalter und Ort (zoneId) */
    zone: t.string(),
    /** der Ortswächter: Sein Spiel rechnet die Tiere dieses Ortes */
    host: t.string(),
    players: t.map(NetFish),
    /** die Tiere und das Fleisch des Ortes (Schlüssel: ihre Nummer) */
    animals: t.map(NetAnimal),
    meats: t.map(NetMeat),
    /** die Pflanzen des Ortes: übrige Bissen (Schlüssel: ihre Nummer, siehe FaunaMsg) */
    plants: t.map('uint8'),
  },
  'ZoneState',
);
export type ZoneState = SchemaType<typeof ZoneState>;

/**
 * Die gemeinsame Art eines Zeitalters (Koop): der Laich, den alle Spieler teilen. Die Geschwister (pool) gehören zur
 * Generation gen, der Laich (next) zur nächsten. Jedes Ei steht als JSON unter seiner Kennung (siehe GameState.RoeEgg).
 */
export const SpeciesState = schema(
  {
    epoch: t.uint8(),
    /** die Generation der Geschwister (0: noch keine Art) */
    gen: t.uint16(),
    pool: t.map('string'),
    next: t.map('string'),
    /** wer mitspielt (Kennung → Name) */
    members: t.map('string'),
    /** Momentan markiertes Ei je Spieler; eine Markierung reserviert kein Ei. */
    selections: t.map('string'),
    /** ausgestorben: warum (sonst leer) */
    over: t.string(),
  },
  'SpeciesState',
);
export type SpeciesState = SchemaType<typeof SpeciesState>;
