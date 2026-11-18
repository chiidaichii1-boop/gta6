[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/chiidaichii1-boop/gta6/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/chiidaichii1-boop/gta6/reward.svg)](https://make.fun/c/gta6-01)

# Solmar City

An open-world crime game in the spirit of GTA 6, built for [make.fun's GTA 6 bounty](https://make.fun/c/gta6-01). Everything is original: the city, the characters, the cars, the story, the art and the sound.

**The story.** Leo Marín came to Solmar City to drive. Vera Solano has five jobs for him — from a first fare in a yellow taxi to the heist of the decade — with the whole SCPD in between.

**The city.** A sun-soaked coastal grid to explore on foot and by car: traffic and pedestrians, cars to steal, a wanted level with police who chase, ram and bust you, missions with a story, combat on foot, and a HUD with a minimap.

**How to play.** Open `game/index.html` in a desktop browser (or `node serve.ts` and visit http://localhost:8080). WASD / arrows to walk and drive, E to enter and steal cars, F to fight, SPACE for the handbrake, T to call Vera for the next job, P to pause, M to mute. Progress saves in the browser.

**Tech.** Plain static files under `game/` — no build step, no network, no libraries. Canvas 2D rendering, WebAudio synthesized sound, localStorage saves. `main.ts` copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.

## License

MIT — see [LICENSE](LICENSE).
