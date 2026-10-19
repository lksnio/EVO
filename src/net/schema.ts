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
  },
  'NetAnimal',
);
export type NetAnimal = SchemaType<typeof NetAnimal>;

/** Ein Stück Fleisch am Ort. */
export const NetMeat = schema(
  {
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
  },
  'ZoneState',
);
export type ZoneState = SchemaType<typeof ZoneState>;
