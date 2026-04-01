# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

![Screenshot of widgets on MacOS](images/desktop.png)

## Project Overview

iOS/macOS widgets for the [Scriptable](https://scriptable.app/) app. The entire project is a single JavaScript file (`UniversalDataWidget.js`) that runs inside Scriptable on device. There is no build system, package manager, or test runner — development is editing the JS file directly and testing inside the Scriptable app.

## Architecture

The widget is structured as a class hierarchy inside one file (~2573 lines):

### Configuration (`CONFIG` object, top of file)
- `defaultSource` — which data source to use if no widget parameter is set
- `apiBaseUrl` — points to `https://api.michi.onl/api` (custom backend)
- `sizing` — per-size (small/medium/large) layout constants
- `colors` — iOS dynamic color palette
- `sources` — per-source config: endpoint, icon, refresh interval, URL scheme, and source-specific settings (profiles, repos, credentials)

### Utility Classes
- `APIClient` — wraps Scriptable's `Request` for GET/POST with URL building
- `ImageCache` — in-memory cache for remote images loaded during a widget render
- `CacheManager` — persists fetched data to iCloud/local file system as JSON under `widget-cache/cache_<source>.json`; serves stale data when offline (48h max); stores previous cache for diff mode
- `RefreshManager` — tracks fetch success/error rates per source; applies exponential backoff on consecutive failures (2^n multiplier, max 8x)
- `ConfigManager` — syncs user configuration across devices via iCloud (`widget-config.json`); deep-merges with hardcoded `CONFIG.sources` at startup; provides in-app setup UI
- `CredentialManager` — stores sensitive credentials (Wikipedia tokens) in iOS Keychain via `Keychain.set/get`
- `FormatUtils` — shared string/number/date formatting helpers

### Data Source Pattern
Each data source extends the abstract `DataSource` base class and must implement:
- `fetchData(widgetSize)` — fetches and normalizes data, returns a plain object
- `isEmpty(data)` — returns true when data has no displayable content
- `renderWidget(widget, data, widgetSize)` — builds the Scriptable `ListWidget` UI

Implemented sources: `BillboardDataSource`, `IMDbDataSource`, `SteamDataSource`, `HackerNewsDataSource`, `GitHubDataSource`, `WikipediaDataSource`, `TimelineDataSource`, `BookmarksDataSource`, `BooksDataSource`, `AstronomyDataSource`, `BlueskyDataSource`, `StatusBoardDataSource`.

`DataSourceFactory.create(sourceName, apiClient)` handles the `"source:extra"` parameter syntax (e.g., `"timeline:contributions"`, `"books:9780099518471"`).

### Main Flow (`UniversalWidget`)
1. Loads iCloud config via `ConfigManager.load()` and merges with hardcoded `CONFIG`
2. Reads `args.widgetParameter` (or falls back to `CONFIG.defaultSource`)
3. Instantiates the correct `DataSource` via factory
4. Calls `fetchData` → records success/error in `RefreshManager` → caches result
5. Runs diff mode: loads previous cache, marks new items with `_isNew` flag
6. Calls `renderWidget` (sources render green dot for `_isNew` items)
7. Falls back to `CacheManager` on network failure
8. Adds a footer with timestamp (medium/large) and offline indicator
9. When running in-app: offers config setup UI for sources with editable fields

## Widget Parameter Syntax

| Parameter | Effect |
|---|---|
| `billboard` | Billboard 200 chart |
| `imdb` | IMDb popular movies & TV |
| `steam` | Steam recent games |
| `hackernews` | Hacker News top stories |
| `github` | GitHub releases for tracked repos |
| `wikipedia` | Wikipedia watchlist edits |
| `timeline` | Full timeline |
| `timeline:contributions` | Filtered: contributions only |
| `timeline:media` | Filtered: media only |
| `bookmarks` | Recent Linkding bookmarks |
| `books` | Currently reading (default ISBN) |
| `books:9780099518471` | Currently reading (specific ISBN) |
| `astronomy` | Sun/moon/UV/golden hour data |
| `bluesky` | Bluesky public feed |
| `statusboard` | Composite: top item from multiple sources |

## Per-Source Customization

Edit `CONFIG.sources` at the top of the file:
- **Steam**: `profiles` array — add Steam usernames
- **GitHub**: `repos` array — add `"owner/repo"` strings
- **Wikipedia**: `usernames`, `tokens`, and `hours` (1-720), or use the in-app setup wizard (run the script directly in Scriptable)
- **Books**: `defaultIsbn` — fallback ISBN when none is passed as parameter
- **Astronomy**: `latitude`, `longitude` — coordinates (blank = use device location)
- **Bluesky**: `handle` — Bluesky handle (e.g. `"user.bsky.social"`)
- **Status Board**: `boardSources` array — source names to display (e.g. `["hackernews", "github"]`)

All per-source settings can also be configured via in-app setup UI, which syncs across devices through iCloud (`widget-config.json`).

## Scriptable-Specific APIs Used

The file relies on Scriptable globals (`ListWidget`, `Stack`, `SFSymbol`, `Font`, `Color`, `Request`, `FileManager`, `Keychain`, `Script`, `Location`, `config`, `args`). These are not available outside of Scriptable — the file cannot be linted or executed in a standard Node.js environment.

## Design Conventions

- **Design tokens** live in `CONFIG.designTokens` (badge corner radius, padding). Use these instead of hardcoded values when adding badges or rounded-rect UI elements.
- **Badges** should use `DataSource.addBadge()` for colored rounded-rect labels (text or SF Symbol). Exception: plain styled text labels (like GitHub pre-release) are not badges and should stay inline.
- **`addHeader()`** accepts an optional `options` object with `subtitle` for filtered views. Do not add item counts to headers — the API responses don't carry totals.
- **Footers** show on medium (compact, time only) and large (time + offline text). Small widgets have no footer.
- **Error widget** is size-aware. Always pass `widgetSize` to `createErrorWidget()`.
- **Separators** (`renderItemList` with `useSeparators = true`) are for text-heavy list widgets without visual anchors. Avoid in multi-column layouts (e.g. HackerNews medium).
- Keep `TimelineDataSource.sourceIcons` and `sourceColors` as static class properties. They map internal source types, not user config.
- **Diff mode**: Sources that implement `getItemKey(item)` and `getItemsFromData(data)` get automatic new-item detection. Render `_isNew` items with a green dot (●). Billboard is excluded (has its own "new" indicators).
- **Status Board** extracts one top item per sub-source. Add new sources to `StatusBoardDataSource.extractTopItem()` when adding data sources.
- **ConfigManager** stores non-sensitive settings only. Credentials (API tokens, passwords) stay in Keychain via `CredentialManager`.
