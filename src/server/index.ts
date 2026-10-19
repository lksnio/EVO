import { networkInterfaces } from 'node:os';
import { defineRoom, defineServer } from 'colyseus';
import { ZONE_ROOM } from '../net/protocol';
import { ZoneRoom } from './ZoneRoom';

/** Der gebaute Server (npm start) lauscht hier – beim Entwickeln (npm run dev) läuft er in Vite auf Port 8080. */
const PORT = 2567;

/** Wohin Freunde ihren Browser schicken: die Tailscale-Adresse (100.x.y.z), daneben die im lokalen Netz. */
function announce() {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a!.address);
  const tail = ips.filter((ip) => ip.startsWith('100.'));
  console.log('\n  EVO läuft.');
  console.log(`  Du selbst:        http://localhost:${PORT}/?name=DeinName`);
  for (const ip of tail) console.log(`  Freunde (Tailscale): http://${ip}:${PORT}/?name=IhrName`);
  if (!tail.length) console.log('  Tailscale nicht gefunden – läuft es? (Adresse sonst mit: tailscale ip -4)');
  for (const ip of ips.filter((x) => !x.startsWith('100.'))) console.log(`  Im eigenen Netz:  http://${ip}:${PORT}/`);
  console.log('');
}

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
  beforeListen: () => {
    if (!process.env.VITEST) announce();
  },
});
