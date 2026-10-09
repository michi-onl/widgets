const test = require("node:test");
const assert = require("node:assert/strict");
require("./scriptable-stubs");
const {
  CONFIG,
  StatusBoardDataSource,
  GitHubDataSource,
  BooksDataSource,
  SteamDataSource,
  HackerNewsDataSource,
} = require("../src/index.js");

test("every configured source (other than statusboard) has a topItemExtractors entry", () => {
  const sourceNames = Object.keys(CONFIG.sources).filter(
    (name) => name !== "statusboard",
  );
  const covered = Object.keys(StatusBoardDataSource.topItemExtractors);

  for (const name of sourceNames) {
    assert.ok(
      covered.includes(name),
      `StatusBoardDataSource.topItemExtractors is missing "${name}" — its row ` +
        `would silently show "no data" on the Status Board`,
    );
  }
});

test("extractTopItem formats a representative item per source", () => {
  const board = new StatusBoardDataSource(CONFIG.sources.statusboard, null);

  assert.equal(
    board.extractTopItem("books", { title: "Dune" }),
    "Dune",
  );
  assert.equal(
    board.extractTopItem("activity", {
      items: [{ title: "repo v1.0.0" }],
    }),
    "repo v1.0.0",
  );
  assert.equal(board.extractTopItem("unknown-source", { anything: true }), null);
  assert.equal(board.extractTopItem("books", null), null);
});

test("GitHubDataSource.fetchReleases rejects clearly when no repos are configured", async () => {
  const source = new GitHubDataSource({ ...CONFIG.sources.github, repos: [] }, null);
  await assert.rejects(
    () => source.fetchReleases("medium"),
    /Set github repos in CONFIG/,
  );
});

test("GitHubDataSource.fetchReleases skips repos the API could not read", async () => {
  const api = {
    fetch: async () => ({
      releases: [
        { repo: "owner/broken", error: "No such repo, or it has no releases" },
        { repo: "owner/tool", tagName: "v1.0.0", author: "octo" },
      ],
    }),
  };
  const source = new GitHubDataSource({ ...CONFIG.sources.github, repos: ["owner/tool"] }, api);
  const releases = await source.fetchReleases("medium");
  assert.deepEqual(releases.map((r) => r.tagName), ["v1.0.0"]);
});

test("SteamDataSource.fetchData reads the profiles and skips failed ones", async () => {
  const api = {
    fetch: async () => ({
      profiles: {
        broken: { profileName: "broken", error: "Could not load the profile" },
        me: {
          profileName: "Me",
          recentGames: [
            { name: "Short", hoursPlayed: 1, lastPlayed: "1 Oct", iconUrl: null },
            { name: "Long", hoursPlayed: 9, lastPlayed: "2 Oct", iconUrl: null },
          ],
        },
      },
      degraded: true,
    }),
  };
  const source = new SteamDataSource(CONFIG.sources.steam, api);
  const { games } = await source.fetchData("medium");
  assert.deepEqual(games.map((g) => g.name), ["Long", "Short"]);

  // API v2 sent the profiles bare; the widget reads both until v3 is deployed.
  const v2 = new SteamDataSource(CONFIG.sources.steam, {
    fetch: async () => ({ me: (await api.fetch()).profiles.me }),
  });
  const { games: v2Games } = await v2.fetchData("medium");
  assert.deepEqual(v2Games.map((g) => g.name), ["Long", "Short"]);
});

test("HackerNewsDataSource.fetchData rejects when the API's scrape failed", async () => {
  const api = { fetch: async () => ({ stories: null, degraded: true }) };
  const source = new HackerNewsDataSource(CONFIG.sources.hackernews, api);
  await assert.rejects(() => source.fetchData("medium"), /unavailable/);
});

test("BooksDataSource.fetchData rejects clearly when no isbn is available", async () => {
  const source = new BooksDataSource(
    { ...CONFIG.sources.books, defaultIsbn: undefined },
    null,
  );
  await assert.rejects(
    () => source.fetchData("medium"),
    /Set defaultIsbn in CONFIG or use books:<isbn>/,
  );
});
