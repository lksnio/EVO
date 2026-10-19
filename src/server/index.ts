import { defineRoom, defineServer } from 'colyseus';
import { ZONE_ROOM } from '../net/protocol';
import { ZoneRoom } from './ZoneRoom';

/**
 * Der Spielserver (Colyseus). Beim Entwickeln läuft er in Vite mit (`npm run dev`, gleicher Port wie das Spiel), gebaut
 * als eigenständiger Server (`npm run build`, dann `npm start`), der auch das Spiel ausliefert.
 *
 * Je Ort und Zeitalter gibt es einen Raum: joinOrCreate('zone', { zone: '0/lagune', … }) führt alle Spieler am selben Ort
 * zusammen (filterBy).
 */
export const server = defineServer({
  rooms: {
    [ZONE_ROOM]: defineRoom(ZoneRoom).filterBy(['zone']),
  },
});
