# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

iOS/macOS widgets for the [Scriptable](https://scriptable.app/) app. The entire project is a single JavaScript file (`Mosaic.js`) that runs inside Scriptable on device. There is no build system, package manager, or test runner. Development is editing the JS file directly and testing inside the Scriptable app.

The file relies on Scriptable globals (`ListWidget`, `Stack`, `SFSymbol`, `Font`, `Color`, `Request`, `FileManager`, `Keychain`, `Script`, `Location`, `config`, `args`). It cannot be linted or executed in Node.js.

## Architecture

### CONFIG object (top of file)

Structural defaults only: endpoints, icons, refresh intervals, sizing constants, color palette. User-specific settings live in `widget-config.json` (synced via iCloud), never in the JS file. `ConfigManager` deep-merges the two at startup.

### Data Source Pattern

Each source extends `DataSource` and implements three methods:

- `fetchData(widgetSize)` — fetch and normalize data
- `isEmpty(data)` — true when nothing to display
- `renderWidget(widget, data, widgetSize)` — build the `ListWidget` UI

`DataSourceFactory.create(sourceName, apiClient)` parses the `"source:extra"` parameter syntax (e.g., `"timeline:contributions"`, `"books:9780099518471"`).

### Main Flow (`Mosaic`)

1. Load iCloud config via `ConfigManager.load()`, merge into `CONFIG`
2. Read `args.widgetParameter` (or fall back to `CONFIG.defaultSource`)
3. Instantiate `DataSource` via factory
4. `fetchData` -> record success/error in `RefreshManager` -> cache result
5. Diff mode: load previous cache, mark new items with `_isNew` flag
6. `renderWidget` (sources render green dot for `_isNew` items)
7. Fall back to `CacheManager` on network failure
8. Add footer with timestamp (medium/large) and offline indicator
9. In-app: offer config setup UI for sources with editable fields

## Design Conventions

- **Design tokens** live in `CONFIG.designTokens` (badge corner radius, padding). Use these instead of hardcoded values.
- **Badges** use `DataSource.addBadge()` for colored rounded-rect labels. Plain styled text labels (like GitHub pre-release) stay inline.
- **`addHeader()`** accepts an optional `options` object with `subtitle` for filtered views. Do not add item counts to headers.
- **Footers** show on medium (compact, time only) and large (time + offline text). Small widgets have no footer.
- **Error widget** is size-aware. Always pass `widgetSize` to `createErrorWidget()`.
- **Separators** (`renderItemList` with `useSeparators = true`) are for text-heavy list widgets without visual anchors. Avoid in multi-column layouts.
- **Diff mode**: Sources that implement `getItemKey(item)` and `getItemsFromData(data)` get automatic new-item detection. Billboard is excluded (has its own "new" indicators).
- **Status Board** extracts one top item per sub-source. Add new sources to `StatusBoardDataSource.extractTopItem()`.
- **ConfigManager** stores all user settings in `widget-config.json`. Never add user-specific values to CONFIG.
- **TimelineDataSource** `sourceIcons` and `sourceColors` are static class properties mapping internal source types, not user config.
