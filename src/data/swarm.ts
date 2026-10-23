/** Einstellungen für die Begleitung durch Artgenossen. */
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
