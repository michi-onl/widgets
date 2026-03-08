# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

![Screenshot of widgets on MacOS](images/desktop.png)

## Project Overview

iOS/macOS widgets for the [Scriptable](https://scriptable.app/) app. The entire project is a single JavaScript file (`UniversalDataWidget.js`) that runs inside Scriptable on device. There is no build system, package manager, or test runner — development is editing the JS file directly and testing inside the Scriptable app.

## Architecture

The widget is structured as a class hierarchy inside one file (~1565 lines):

### Configuration (`CONFIG` object, top of file)
- `defaultSource` — which data source to use if no widget parameter is set
- `apiBaseUrl` — points to `https://api.michi.onl/api` (custom backend)
- `sizing` — per-size (small/medium/large) layout constants
- `colors` — iOS dynamic color palette
- `sources` — per-source config: endpoint, icon, refresh interval, URL scheme, and source-specific settings (profiles, repos, credentials)

### Utility Classes
- `APIClient` — wraps Scriptable's `Request` for GET/POST with URL building
- `ImageCache` — in-memory cache for remote images loaded during a widget render
- `CacheManager` — persists fetched data to iCloud/local file system as JSON under `widget-cache/cache_<source>.json`; serves stale data when offline (48h max)
- `CredentialManager` — stores sensitive credentials (Wikipedia tokens) in iOS Keychain via `Keychain.set/get`
- `FormatUtils` — shared string/number/date formatting helpers

### Data Source Pattern
Each data source extends the abstract `DataSource` base class and must implement:
- `fetchData(widgetSize)` — fetches and normalizes data, returns a plain object
- `isEmpty(data)` — returns true when data has no displayable content
- `renderWidget(widget, data, widgetSize)` — builds the Scriptable `ListWidget` UI

Implemented sources: `BillboardDataSource`, `IMDbDataSource`, `SteamDataSource`, `HackerNewsDataSource`, `GitHubDataSource`, `WikipediaDataSource`, `TimelineDataSource`, `BookmarksDataSource`, `BooksDataSource`.

`DataSourceFactory.create(sourceName, apiClient)` handles the `"source:extra"` parameter syntax (e.g., `"timeline:contributions"`, `"books:9780099518471"`).

### Main Flow (`UniversalWidget`)
1. Reads `args.widgetParameter` (or falls back to `CONFIG.defaultSource`)
2. Instantiates the correct `DataSource` via factory
3. Calls `fetchData` → caches result → calls `renderWidget`
4. Falls back to `CacheManager` on network failure
5. Adds a footer with timestamp (large widgets only) and offline indicator

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

## Per-Source Customization

Edit `CONFIG.sources` at the top of the file:
- **Steam**: `profiles` array — add Steam usernames
- **GitHub**: `repos` array — add `"owner/repo"` strings
- **Wikipedia**: `usernames`, `tokens`, and `hours` (1-720), or use the in-app setup wizard (run the script directly in Scriptable)
- **Books**: `defaultIsbn` — fallback ISBN when none is passed as parameter

## Scriptable-Specific APIs Used

The file relies on Scriptable globals (`ListWidget`, `Stack`, `SFSymbol`, `Font`, `Color`, `Request`, `FileManager`, `Keychain`, `Script`, `config`, `args`). These are not available outside of Scriptable — the file cannot be linted or executed in a standard Node.js environment.
