HoD Faction Utility Script

## Overview

HoD is a simple browser tool designed specifically for members of the HoD faction in Torn City. It adds a handy overlay panel to your game screen, making it easier to stay organized and on top of faction activities. This is a private script meant only for HoD members—please don't share it outside the faction. The script only works for verified House of Dragonborn members: upon entering your API key, it checks your faction affiliation (ID 10877 or "House of Dragonborn") and it welcomes you by name and Rank, If you're not in HoD, the welcome you get is "You are not worthy of this tool" and the script wont load in order to prevent unauthorized use (which means if you ever leave, or kicked you will lose functionality of The faction script). 

## What It Does

The script provides a pull-out tab on the side of your Torn City page. When you click it, an overlay opens with several useful sections:

- **Targets**: Keep a list of up to 50 players you're tracking for attacks. View their level, faction, life, status (like if they're in hospital or jail), last action, and respect gained from recent attacks. Add targets by ID or directly from profiles, remove them easily, and refresh to update info.
- **War Targets**: A separate list for war-specific enemies, with the same detailed info. Perfect for quick attacks and being ontop of timers.
- **Chain Tracker**: Monitors Faction chain progress in real-time, including current count, max length, timeout, and it highlights approaching bonuses (e.g., 10, 25, 100 hits etc) and sends notifications for low timeouts.
- **Members**: Displays a sortable list of all of fellow your faction members, showing their level, position, days in faction, last action, and status (with timers for hospital/jail/travel).
- **Enemy**: Track enemy factions from ongoing ranked pulled automatocally during times of war, or add them manually by ID. View their members' details similar to the faction list, including war scores and differences. Get alerts if more than 5 enemies are online (possible push warning).
- **Errors**: A log of any issues the script encounters, with options to refresh or clear.
- **Settings**: Adjust chain alert thresholds, enemy online warnings, and manage your API key.

It's like having a quick dashboard for faction tasks, helping you coordinate better without leaving the game or relying heavily on outside apps or websites.

## Installation

1. Install Tampermonkey (browser extension for Chrome, Firefox, etc.).
2. Get the script from here, or ask me (BjornOdinsson89) for the user script.
3. Open Tampermonkey and click the plus button to create a script and paste the code, make sure to click save and refresh Torn.
4. Enter your full access API key when asked (needed for game data access). The script will automatically verify if you're a HoD member—if not, it will alert you and restrict access, MAKE SURE YOU HAVE YOUR KEY READY BEFORE TURNING ON THE SCRIPT, THERES A BUG THAT WILL ANNOY THE HELL OUT OF YOU THAT I HAVE NOT BEEN ABOE TO WORK OUT YET. 
5. Go back to the Torn webpage—the side tab should appear (only if verification passes).

## Usage

- Click the tab to open/close the overlay.
- Switch sections using the menu at the top.
- Add targets or factions via the input fields.
- The script auto-refreshes some data in the background, If something breaks, check the Errors section or ask me directly

## Security and Privacy

Your safety is a top priority. Here's how the script keeps things secure:

- **API Key Handling**: Your Torn API key is encrypted and stored only on your local device using browser storage (localStorage and IndexedDB). It never leaves your computer or gets sent to any external servers besides Torn's official API.
- **No External Communication**: The script only interacts with Torn.com's API for game data and GitHub for checking script updates. No data is shared with third parties, and there's no tracking or logging of your activities.
- **Local Data Storage**: All lists (targets, enemies, etc.) and cached info are saved locally on your device. Nothing is uploaded or shared.
- **Private Script**: This is for HoD members only—do not share the script or your API key. Using a full-access API key is required, but since everything stays local, your account remains secure as long as you don't expose the key. The faction check ensures only verified members can use it fully.

If you have questions, concerns, or suggestions please reach out to me in-game. Happy hunting!
