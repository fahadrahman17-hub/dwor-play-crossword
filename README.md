# DWOR (word) PLAY :) online

Anyone with the link can open it, pick a team and play. No accounts, no invites.

## Run locally
    npm install
    npm start
Open http://localhost:3000

## Put it online for free (Render.com)
1. Upload this folder to a new GitHub repository.
2. On render.com: New > Web Service > connect the repo.
3. Build command: `npm install`   Start command: `npm start`   Plan: Free.
4. When it finishes you get a link like https://dwor-play.onrender.com. Share that link.

(Replit, Glitch, Railway and Fly.io work too: any host that runs Node.js.)
Free plans sleep when idle, so the first open after a break may take ~30 seconds.

## How to play
Two links: the **team link** (`/?g=CODE`) is what players open; the private **host link** (`/?g=CODE&k=KEY`) runs the game. Both are shown to the host after creating a game.

Host: open the link > Host a new game > add words and teams > Create game > share the invite link.
Players: open the invite link, type a name, tap Join, choose a team. Others can just watch.

Answer modes: players type the word (auto-checked), or say it out loud and the host taps Check answer, then Correct / Wrong.

## Crossword game
Open /crossword on your site. The host builds one crossword per team and sets the minutes per team. Teams play one at a time; the fastest finisher wins (or the most correct words if nobody finishes).
