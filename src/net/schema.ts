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

export const ZoneState = schema(
  {
    /** Zeitalter und Ort (zoneId) */
    zone: t.string(),
    players: t.map(NetFish),
  },
  'ZoneState',
);
export type ZoneState = SchemaType<typeof ZoneState>;
