# DUST

A browser voxel shooter set on a Minecraft-styled **de_dust2** layout: T spawn, long, mid doors, Xbox, catwalk, tunnels, A/B sites, and CT spawn.

## Play

```bash
npm install
npm run dev
```

Open the local URL, pick a team and AI difficulty (Easy / Normal / Hard / Expert), then click join. Easy bots miss and react slowly; Expert bots aim tight, dodge hard, and plant or defuse faster.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look |
| Click | Shoot |
| Space | Jump |
| Shift | Walk |
| R | Reload |
| 1 / 2 | Rifle / pistol |
| E | Plant or defuse |
| Walk over packs | Red = health · Blue = shield |

## Rounds

Classic bomb mode: Terrorists plant at **A** or **B**, Counter-Terrorists prevent the plant or defuse. If you die you are out for the rest of that round and spectate (Space / click cycles living teammates). After **6 rounds** the sides swap. First to **7** (or most after 12) wins the map.

Bots fight each other, dodge when aimed at or shot, carry / drop / plant the bomb, and retake to defuse.

This is a fan-made voxel layout inspired by Counter-Strike's Dust II. It does not use Valve art or code.
