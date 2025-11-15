// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: chart-line;

/**
 * Universal Data Widget
 * Author: Michael Wagner, michi.onl
 *
 * A comprehensive Scriptable widget displaying data from multiple sources
 * Supported sources: billboard, imdb, steam, hackernews, github, wikipedia
 *
 * Configuration: Set widget parameter to source name (e.g., "billboard")
 * or leave empty to use defaultSource from CONFIG
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Default settings
  defaultSource: "billboard",
  apiBaseUrl: "https://api.michi.onl",
  refreshInterval: 3600000, // 1 hour in milliseconds

  // Widget sizing configuration
  sizing: {
    small: {
      maxItems: 3,
      fontSize: { primary: 11, secondary: 9, tertiary: 8 },
      iconSize: 14,
      spacing: 4,
      padding: 12,
    },
    medium: {
      maxItems: 6,
      fontSize: { primary: 12, secondary: 10, tertiary: 9 },
      iconSize: 16,
      spacing: 6,
      padding: 14,
    },
    large: {
      maxItems: 10,
      fontSize: { primary: 13, secondary: 11, tertiary: 10 },
      iconSize: 18,
      spacing: 8,
      padding: 16,
    },
  },

  // Color scheme following iOS system design
  colors: {
    // Dynamic colors that adapt to light/dark mode
    primary: Color.dynamic(new Color("#000000"), new Color("#FFFFFF")),
    secondary: Color.dynamic(new Color("#8E8E93"), new Color("#8E8E93")),
    tertiary: Color.dynamic(new Color("#C7C7CC"), new Color("#48484A")),

    // Semantic colors
    accent: new Color("#007AFF"),
    success: new Color("#34C759"),
    warning: new Color("#FF9500"),
    error: new Color("#FF3B30"),

    // Status indicators
    new: new Color("#FF9500"),
    up: new Color("#34C759"),
    down: new Color("#FF3B30"),
    unchanged: Color.dynamic(new Color("#8E8E93"), new Color("#636366")),

    // Background colors
    cardBackground: Color.dynamic(
      new Color("#FFFFFF", 0.8),
      new Color("#1C1C1E", 0.8)
    ),

    // Specialized colors
    star: new Color("#FFD60A"),
  },

  // Source-specific configuration
  sources: {
    billboard: {
      name: "Billboard 200",
      endpoint: "/billboard-200",
      icon: "chart.bar.fill",
      refreshHours: 24,
      urlScheme: "https://www.billboard.com/charts/billboard-200/",
    },
    imdb: {
      name: "IMDb Popular",
      endpoint: "/imdb",
      icon: "tv.fill",
      refreshHours: 12,
      urlScheme: "imdb://",
    },
    steam: {
      name: "Steam Games",
      endpoint: "/steam-profiles",
      icon: "gamecontroller.fill",
      refreshHours: 6,
      urlScheme: "steam://",
      // Add your Steam profile names here
      profiles: ["exampleuser1", "exampleuser2"],
    },
    hackernews: {
      name: "Hacker News",
      endpoint: "/hackernews",
      icon: "newspaper.fill",
      refreshHours: 1,
      urlScheme: "https://news.ycombinator.com/",
    },
    github: {
      name: "GitHub Releases",
      endpoint: "/github-releases",
      icon: "arrow.down.circle.fill",
      refreshHours: 6,
      urlScheme: "https://github.com/",
      // Add repositories to track (format: "owner/repo")
      repos: ["anthropics/anthropic-sdk-python", "fasthtml/fasthtml"],
    },
    wikipedia: {
      name: "Wikipedia Edits",
      endpoint: "/wikipedia-watchlist",
      icon: "book.fill",
      refreshHours: 2,
      urlScheme: "https://wikipedia.org/",
      // Configure Wikipedia watchlist credentials
      // Format: "lang:username" for each language
      usernames: "",
      // Format: "lang:token" for each language
      tokens: "",
      // Languages to check
      languages: "en,de",
      limit: 10,
    },
  },
};

// ============================================================================
// UTILITY CLASSES
// ============================================================================

class APIClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async fetch(endpoint, params = {}) {
    const url = this.buildUrl(endpoint, params);
    console.log(`Fetching: ${url}`);

    const request = new Request(url);

    try {
      const response = await request.loadJSON();
      console.log(`Success: ${endpoint}`);
      return response;
    } catch (error) {
      console.error(`API Error for ${endpoint}: ${error.message}`);
      console.error(`URL was: ${url}`);
      throw new Error(`Failed to fetch from ${endpoint}: ${error.message}`);
    }
  }

  buildUrl(endpoint, params) {
    let url = this.baseUrl + endpoint;

    const queryParams = Object.entries(params)
      .filter(([key, value]) => value !== null && value !== undefined)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
      )
      .join("&");

    if (queryParams) {
      url += "?" + queryParams;
    }

    return url;
  }
}

class ImageCache {
  static cache = {};

  static async load(url) {
    if (!url) return null;

    if (this.cache[url]) {
      return this.cache[url];
    }

    try {
      const request = new Request(url);
      const image = await request.loadImage();
      this.cache[url] = image;
      return image;
    } catch (error) {
      console.error(`Failed to load image: ${url}`);
      return null;
    }
  }
}

class FormatUtils {
  static truncate(text, maxLength) {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 1) + "…";
  }

  static formatNumber(num) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }

  static formatTimeAgo(dateString) {
    if (!dateString) return "Unknown";

    let date;
    // Handle Unix timestamp (number)
    if (typeof dateString === "number") {
      date = new Date(dateString);
    } else {
      date = new Date(dateString);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) return "Unknown";

    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 0) return "Just now";

    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval}${unit.charAt(0)} ago`;
      }
    }

    return "Just now";
  }

  static formatDuration(hours) {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    return `${hours.toFixed(1)}h`;
  }

  static cleanTitle(title) {
    if (!title) return "";
    return title
      .replace(/\[feat\. .*?\]/gi, "")
      .replace(/\(.*?\)/gi, "")
      .trim();
  }
}

// ============================================================================
// DATA SOURCE IMPLEMENTATIONS
// ============================================================================

class DataSource {
  constructor(config, apiClient) {
    this.config = config;
    this.api = apiClient;
  }

  async fetchData(widgetSize) {
    throw new Error("fetchData must be implemented by subclass");
  }

  renderWidget(widget, data, widgetSize) {
    throw new Error("renderWidget must be implemented by subclass");
  }
}

class BillboardDataSource extends DataSource {
  async fetchData(widgetSize) {
    const response = await this.api.fetch(this.config.endpoint);

    if (!response.music?.data) {
      throw new Error("Invalid Billboard data structure");
    }

    const limit = CONFIG.sizing[widgetSize].maxItems;
    return {
      title: response.music.data_title || "Billboard 200",
      subtitle: response.music.data_desc || "",
      items: response.music.data.slice(0, limit).map((item) => ({
        position: item.position,
        title: FormatUtils.cleanTitle(item.title),
        subtitle: item.artist,
        metadata: {
          last_week: item.last_week,
          peak: item.peak,
          weeks: item.weeks,
        },
      })),
    };
  }

  renderWidget(widget, data, widgetSize) {
    const sizes = CONFIG.sizing[widgetSize];

    // Header
    this.addHeader(widget, data.title, sizes);

    widget.addSpacer(sizes.spacing);

    // Content
    const columns = this.getColumnLayout(widgetSize);
    const itemsPerColumn = Math.ceil(data.items.length / columns);

    const contentStack = widget.addStack();
    contentStack.layoutHorizontally();

    for (let col = 0; col < columns; col++) {
      if (col > 0) contentStack.addSpacer(sizes.spacing * 2);

      const columnStack = contentStack.addStack();
      columnStack.layoutVertically();

      const start = col * itemsPerColumn;
      const end = Math.min(start + itemsPerColumn, data.items.length);

      for (let i = start; i < end; i++) {
        this.renderItem(columnStack, data.items[i], sizes);
        if (i < end - 1) columnStack.addSpacer(sizes.spacing);
      }
    }
  }

  renderItem(stack, item, sizes) {
    const itemStack = stack.addStack();
    itemStack.layoutHorizontally();
    itemStack.centerAlignContent();

    // Position indicator
    const positionStack = itemStack.addStack();
    positionStack.layoutVertically();
    positionStack.centerAlignContent();

    this.addPositionIndicator(positionStack, item, sizes);

    itemStack.addSpacer(sizes.spacing);

    // Text content
    const textStack = itemStack.addStack();
    textStack.layoutVertically();

    const titleText = textStack.addText(FormatUtils.truncate(item.title, 35));
    titleText.font = Font.mediumSystemFont(sizes.fontSize.primary);
    titleText.textColor = CONFIG.colors.primary;
    titleText.lineLimit = 1;

    const subtitleText = textStack.addText(
      FormatUtils.truncate(item.subtitle, 30)
    );
    subtitleText.font = Font.systemFont(sizes.fontSize.secondary);
    subtitleText.textColor = CONFIG.colors.secondary;
    subtitleText.lineLimit = 1;

    if (item.metadata.weeks) {
      const metaText = textStack.addText(`${item.metadata.weeks} weeks`);
      metaText.font = Font.systemFont(sizes.fontSize.tertiary);
      metaText.textColor = CONFIG.colors.tertiary;
    }

    itemStack.addSpacer();
  }

  addPositionIndicator(stack, item, sizes) {
    const lastWeek = item.metadata.last_week;
    const current = item.position;

    let symbol, color;

    if (lastWeek === 0) {
      symbol = "star.circle.fill";
      color = CONFIG.colors.new;
    } else if (current < lastWeek) {
      symbol = "arrow.up.circle.fill";
      color = CONFIG.colors.up;
    } else if (current > lastWeek) {
      symbol = "arrow.down.circle.fill";
      color = CONFIG.colors.down;
    } else {
      symbol = "minus.circle.fill";
      color = CONFIG.colors.unchanged;
    }

    const icon = stack.addImage(SFSymbol.named(symbol).image);
    icon.imageSize = new Size(sizes.iconSize, sizes.iconSize);
    icon.tintColor = color;
  }

  addHeader(widget, title, sizes) {
    const headerStack = widget.addStack();
    headerStack.layoutHorizontally();
    headerStack.centerAlignContent();

    const iconImage = SFSymbol.named(this.config.icon).image;
    const icon = headerStack.addImage(iconImage);
    icon.imageSize = new Size(sizes.iconSize + 2, sizes.iconSize + 2);
    icon.tintColor = CONFIG.colors.accent;

    headerStack.addSpacer(sizes.spacing);

    const titleText = headerStack.addText(title);
    titleText.font = Font.boldSystemFont(sizes.fontSize.primary);
    titleText.textColor = CONFIG.colors.primary;
  }

  getColumnLayout(widgetSize) {
    return widgetSize === "small" ? 1 : widgetSize === "medium" ? 2 : 2;
  }
}

class IMDbDataSource extends DataSource {
  async fetchData(widgetSize) {
    const response = await this.api.fetch(this.config.endpoint);

    const limit = CONFIG.sizing[widgetSize].maxItems;

    // Handle the actual API response structure - movies and tv_shows are objects with data arrays
    const movies =
      response.movies?.data && Array.isArray(response.movies.data)
        ? response.movies.data.slice(0, Math.ceil(limit / 2))
        : [];
    const tvShows =
      response.tv_shows?.data && Array.isArray(response.tv_shows.data)
        ? response.tv_shows.data.slice(0, Math.ceil(limit / 2))
        : [];

    return {
      movies: movies.map((m) => this.formatItem(m, "movie")),
      tvShows: tvShows.map((t) => this.formatItem(t, "tv")),
    };
  }

  formatItem(item, type) {
    return {
      title: FormatUtils.truncate(item.title, 30),
      subtitle: `${item.year || "N/A"} • ${item.length || ""}`,
      rating: item.rating,
      type: type,
    };
  }

  renderWidget(widget, data, widgetSize) {
    const sizes = CONFIG.sizing[widgetSize];

    this.addHeader(widget, "Popular on IMDb", sizes);
    widget.addSpacer(sizes.spacing);

    const contentStack = widget.addStack();
    contentStack.layoutHorizontally();

    // Movies column
    if (data.movies.length > 0) {
      const moviesStack = contentStack.addStack();
      moviesStack.layoutVertically();

      this.addSectionHeader(moviesStack, "Movies", sizes);
      data.movies.forEach((item, index) => {
        this.renderItem(moviesStack, item, sizes);
        if (index < data.movies.length - 1) {
          moviesStack.addSpacer(sizes.spacing);
        }
      });
    }

    if (widgetSize !== "small" && data.tvShows.length > 0) {
      contentStack.addSpacer(null);

      // TV Shows column
      const tvStack = contentStack.addStack();
      tvStack.layoutVertically();

      this.addSectionHeader(tvStack, "TV Shows", sizes);
      data.tvShows.forEach((item, index) => {
        this.renderItem(tvStack, item, sizes);
        if (index < data.tvShows.length - 1) {
          tvStack.addSpacer(sizes.spacing);
        }
      });
    }
  }

  renderItem(stack, item, sizes) {
    const itemStack = stack.addStack();
    itemStack.layoutHorizontally();
    itemStack.centerAlignContent();

    // Rating badge
    if (item.rating !== undefined && item.rating !== null) {
      const ratingStack = itemStack.addStack();
      ratingStack.backgroundColor = CONFIG.colors.accent;
      ratingStack.cornerRadius = 4;
      ratingStack.setPadding(2, 4, 2, 4);

      // Display "+" for empty string, otherwise show the rating
      const displayText = item.rating === "" ? "NEW" : item.rating.toString();
      const ratingText = ratingStack.addText(displayText);
      ratingText.font = Font.boldSystemFont(sizes.fontSize.tertiary);
      ratingText.textColor = Color.white();

      itemStack.addSpacer(sizes.spacing);
    }

    // Text content
    const textStack = itemStack.addStack();
    textStack.layoutVertically();

    const titleText = textStack.addText(item.title);
    titleText.font = Font.mediumSystemFont(sizes.fontSize.secondary);
    titleText.textColor = CONFIG.colors.primary;
    titleText.lineLimit = 1;

    const subtitleText = textStack.addText(item.subtitle);
    subtitleText.font = Font.systemFont(sizes.fontSize.tertiary);
    subtitleText.textColor = CONFIG.colors.secondary;
  }

  addHeader(widget, title, sizes) {
    const headerStack = widget.addStack();
    headerStack.layoutHorizontally();

    const icon = headerStack.addImage(SFSymbol.named(this.config.icon).image);
    icon.imageSize = new Size(sizes.iconSize + 2, sizes.iconSize + 2);
    icon.tintColor = CONFIG.colors.accent;

    headerStack.addSpacer(sizes.spacing);

    const titleText = headerStack.addText(title);
    titleText.font = Font.boldSystemFont(sizes.fontSize.primary);
    titleText.textColor = CONFIG.colors.primary;
  }

  addSectionHeader(stack, title, sizes) {
    const headerText = stack.addText(title);
    headerText.font = Font.semiboldSystemFont(sizes.fontSize.secondary);
    headerText.textColor = CONFIG.colors.secondary;
    stack.addSpacer(sizes.spacing);
  }
}

class SteamDataSource extends DataSource {
  async fetchData(widgetSize) {
    const profiles = this.config.profiles.join(",");
    const response = await this.api.fetch(this.config.endpoint, { profiles });

    const limit = CONFIG.sizing[widgetSize].maxItems;
    const allGames = [];

    for (const [username, userData] of Object.entries(response)) {
      if (userData.recentGames) {
        userData.recentGames.forEach((game) => {
          allGames.push({
            name: game.name,
            hoursPlayed: game.hoursPlayedNumeric || 0,
            username: username,
          });
        });
      }
    }

    // Sort by play time and take top items
    allGames.sort((a, b) => b.hoursPlayed - a.hoursPlayed);

    return {
      games: allGames.slice(0, limit),
    };
  }

  renderWidget(widget, data, widgetSize) {
    const sizes = CONFIG.sizing[widgetSize];

    this.addHeader(widget, "Recently Played", sizes);
    widget.addSpacer(sizes.spacing);

    const contentStack = widget.addStack();
    contentStack.layoutVertically();

    data.games.forEach((game, index) => {
      this.renderItem(contentStack, game, sizes);
      if (index < data.games.length - 1) {
        contentStack.addSpacer(sizes.spacing);
      }
    });
  }

  renderItem(stack, game, sizes) {
    const itemStack = stack.addStack();
    itemStack.layoutHorizontally();
    itemStack.centerAlignContent();

    const icon = itemStack.addImage(
      SFSymbol.named("gamecontroller.fill").image
    );
    icon.imageSize = new Size(sizes.iconSize, sizes.iconSize);
    icon.tintColor = CONFIG.colors.secondary;

    itemStack.addSpacer(sizes.spacing);

    const textStack = itemStack.addStack();
    textStack.layoutVertically();

    const titleText = textStack.addText(FormatUtils.truncate(game.name, 35));
    titleText.font = Font.mediumSystemFont(sizes.fontSize.primary);
    titleText.textColor = CONFIG.colors.primary;
    titleText.lineLimit = 1;

    const metaText = textStack.addText(
      `${FormatUtils.formatDuration(game.hoursPlayed)}`
    );
    metaText.font = Font.systemFont(sizes.fontSize.secondary);
    metaText.textColor = CONFIG.colors.secondary;

    itemStack.addSpacer();
  }

  addHeader(widget, title, sizes) {
    const headerStack = widget.addStack();
    const icon = headerStack.addImage(SFSymbol.named(this.config.icon).image);
    icon.imageSize = new Size(sizes.iconSize + 2, sizes.iconSize + 2);
    icon.tintColor = CONFIG.colors.accent;

    headerStack.addSpacer(sizes.spacing);

    const titleText = headerStack.addText(title);
    titleText.font = Font.boldSystemFont(sizes.fontSize.primary);
    titleText.textColor = CONFIG.colors.primary;
  }
}

class HackerNewsDataSource extends DataSource {
  async fetchData(widgetSize) {
    const response = await this.api.fetch(this.config.endpoint);

    const limit = CONFIG.sizing[widgetSize].maxItems;

    // API returns stories array with different field names
    return {
      stories: response.stories.slice(0, limit).map((story) => ({
        title: FormatUtils.truncate(story.title, 50),
        points: story.points,
        comments: story.numComments,
        author: story.author,
        timeAgo: story.timePosted,
        url: story.url,
      })),
    };
  }

  renderWidget(widget, data, widgetSize) {
    const sizes = CONFIG.sizing[widgetSize];

    this.addHeader(widget, "Hacker News", sizes);
    widget.addSpacer(sizes.spacing);

    // For medium widgets, use columns to fit more items
    if (widgetSize === "medium" && data.stories.length > 3) {
      const contentStack = widget.addStack();
      contentStack.layoutHorizontally();

      const itemsPerColumn = Math.ceil(data.stories.length / 2);

      // First column
      const firstColumn = contentStack.addStack();
      firstColumn.layoutVertically();

      for (let i = 0; i < itemsPerColumn && i < data.stories.length; i++) {
        this.renderItem(firstColumn, data.stories[i], sizes);
        if (i < itemsPerColumn - 1 && i < data.stories.length - 1) {
          firstColumn.addSpacer(sizes.spacing);
        }
      }

      contentStack.addSpacer(sizes.spacing * 2);

      // Second column
      const secondColumn = contentStack.addStack();
      secondColumn.layoutVertically();

      for (let i = itemsPerColumn; i < data.stories.length; i++) {
        this.renderItem(secondColumn, data.stories[i], sizes);
        if (i < data.stories.length - 1) {
          secondColumn.addSpacer(sizes.spacing);
        }
      }
    } else {
      // Small or large widget - single column
      const contentStack = widget.addStack();
      contentStack.layoutVertically();

      data.stories.forEach((story, index) => {
        this.renderItem(contentStack, story, sizes);
        if (index < data.stories.length - 1) {
          contentStack.addSpacer(sizes.spacing);
        }
      });
    }
  }

  renderItem(stack, story, sizes) {
    const itemStack = stack.addStack();
    itemStack.layoutVertically();

    const titleText = itemStack.addText(story.title);
    titleText.font = Font.mediumSystemFont(sizes.fontSize.primary);
    titleText.textColor = CONFIG.colors.primary;
    titleText.lineLimit = 2;

    const metaStack = itemStack.addStack();
    metaStack.layoutHorizontally();

    // More compact metadata format
    const metaText = metaStack.addText(
      `${story.points}pts • ${story.comments}cmt`
    );
    metaText.font = Font.systemFont(sizes.fontSize.tertiary);
    metaText.textColor = CONFIG.colors.secondary;
  }

  addHeader(widget, title, sizes) {
    const headerStack = widget.addStack();
    const icon = headerStack.addImage(SFSymbol.named(this.config.icon).image);
    icon.imageSize = new Size(sizes.iconSize + 2, sizes.iconSize + 2);
    icon.tintColor = CONFIG.colors.accent;

    headerStack.addSpacer(sizes.spacing);

    const titleText = headerStack.addText(title);
    titleText.font = Font.boldSystemFont(sizes.fontSize.primary);
    titleText.textColor = CONFIG.colors.primary;
  }
}

class GitHubDataSource extends DataSource {
  async fetchData(widgetSize) {
    const repos = this.config.repos.join(",");
    const response = await this.api.fetch(this.config.endpoint, { repos });
    const limit = CONFIG.sizing[widgetSize].maxItems;

    // The API returns releases directly in an array
    if (!response || !Array.isArray(response.releases)) {
      return { releases: [] };
    }

    const allReleases = response.releases.map((release) => ({
      repo: this.extractRepoName(release.repo),
      name: release.name || release.tagName,
      tagName: this.cleanTagName(release.tagName),
      publishedAt: release.publishedAt,
      timeAgo: release.timeAgo,
      author: release.author,
      isPrerelease: release.isPrerelease,
      url: release.url,
    }));

    return {
      releases: allReleases.slice(0, limit),
    };
  }

  extractRepoName(repoString) {
    // Extract repo name from "owner/repo" format
    if (repoString.includes("/")) {
      return repoString.split("/").pop();
    }
    return repoString;
  }

  cleanTagName(tagName) {
    // Remove "releases/" prefix if present
    if (tagName.startsWith("releases/")) {
      return tagName.substring(9); // Remove "releases/"
    }
    return tagName;
  }

  renderWidget(widget, data, widgetSize) {
    const sizes = CONFIG.sizing[widgetSize];
    this.addHeader(widget, "Recent Releases", sizes);
    widget.addSpacer(sizes.spacing);

    const contentStack = widget.addStack();
    contentStack.layoutVertically();

    data.releases.forEach((release, index) => {
      this.renderItem(contentStack, release, sizes);
      if (index < data.releases.length - 1) {
        contentStack.addSpacer(sizes.spacing);
      }
    });
  }

  renderItem(stack, release, sizes) {
    const itemStack = stack.addStack();
    itemStack.layoutVertically();

    const headerStack = itemStack.addStack();
    headerStack.layoutHorizontally();

    const repoText = headerStack.addText(release.repo);
    repoText.font = Font.semiboldSystemFont(sizes.fontSize.secondary);
    repoText.textColor = CONFIG.colors.accent;

    headerStack.addSpacer(4);

    const tagText = headerStack.addText(release.tagName);
    tagText.font = Font.systemFont(sizes.fontSize.tertiary);
    tagText.textColor = CONFIG.colors.secondary;

    if (release.isPrerelease) {
      headerStack.addSpacer(4);
      const preText = headerStack.addText("pre");
      preText.font = Font.boldSystemFont(sizes.fontSize.tertiary);
      preText.textColor = CONFIG.colors.warning;
    }

    const metaText = itemStack.addText(
      `${release.author} • ${release.timeAgo}`
    );
    metaText.font = Font.systemFont(sizes.fontSize.tertiary);
    metaText.textColor = CONFIG.colors.secondary;
  }

  addHeader(widget, title, sizes) {
    const headerStack = widget.addStack();
    const icon = headerStack.addImage(SFSymbol.named(this.config.icon).image);
    icon.imageSize = new Size(sizes.iconSize + 2, sizes.iconSize + 2);
    icon.tintColor = CONFIG.colors.accent;
    headerStack.addSpacer(sizes.spacing);

    const titleText = headerStack.addText(title);
    titleText.font = Font.boldSystemFont(sizes.fontSize.primary);
    titleText.textColor = CONFIG.colors.primary;
  }
}

class WikipediaDataSource extends DataSource {
  async fetchData(widgetSize) {
    const params = {
      username: this.config.usernames,
      token: this.config.tokens,
      lang: this.config.languages,
      limit: this.config.limit || CONFIG.sizing[widgetSize].maxItems,
    };

    const response = await this.api.fetch(this.config.endpoint, params);

    // Safely handle response
    if (!response || !Array.isArray(response.edits)) {
      return { edits: [] };
    }

    return {
      edits: response.edits.map((edit) => ({
        title: FormatUtils.truncate(edit.title, 40),
        language: edit.languageName || edit.language,
        user: edit.user,
        timeAgo: edit.timeAgo,
        comment: FormatUtils.truncate(edit.comment || "N/A", 60),
        url: edit.url,
      })),
    };
  }

  renderWidget(widget, data, widgetSize) {
    const sizes = CONFIG.sizing[widgetSize];

    this.addHeader(widget, "Recent Edits", sizes);
    widget.addSpacer(sizes.spacing);

    const contentStack = widget.addStack();
    contentStack.layoutVertically();

    data.edits.forEach((edit, index) => {
      this.renderItem(contentStack, edit, sizes);
      if (index < data.edits.length - 1) {
        contentStack.addSpacer(sizes.spacing);
      }
    });
  }

  renderItem(stack, edit, sizes) {
    const itemStack = stack.addStack();
    itemStack.layoutVertically();

    const headerStack = itemStack.addStack();
    headerStack.layoutHorizontally();

    const langBadge = headerStack.addStack();
    langBadge.backgroundColor = CONFIG.colors.accent;
    langBadge.cornerRadius = 3;
    langBadge.setPadding(2, 4, 2, 4);

    const langText = langBadge.addText(edit.language);
    langText.font = Font.boldSystemFont(sizes.fontSize.tertiary);
    langText.textColor = Color.white();

    headerStack.addSpacer(sizes.spacing);

    const titleText = headerStack.addText(edit.title);
    titleText.font = Font.mediumSystemFont(sizes.fontSize.primary);
    titleText.textColor = CONFIG.colors.primary;
    titleText.lineLimit = 1;

    if (edit.comment && edit.comment !== "N/A") {
      const commentText = itemStack.addText(edit.comment);
      commentText.font = Font.systemFont(sizes.fontSize.secondary);
      commentText.textColor = CONFIG.colors.secondary;
      commentText.lineLimit = 1;
    }

    const metaText = itemStack.addText(`${edit.user} • ${edit.timeAgo}`);
    metaText.font = Font.systemFont(sizes.fontSize.tertiary);
    metaText.textColor = CONFIG.colors.tertiary;
  }

  addHeader(widget, title, sizes) {
    const headerStack = widget.addStack();
    const icon = headerStack.addImage(SFSymbol.named(this.config.icon).image);
    icon.imageSize = new Size(sizes.iconSize + 2, sizes.iconSize + 2);
    icon.tintColor = CONFIG.colors.accent;

    headerStack.addSpacer(sizes.spacing);

    const titleText = headerStack.addText(title);
    titleText.font = Font.boldSystemFont(sizes.fontSize.primary);
    titleText.textColor = CONFIG.colors.primary;
  }
}

// ============================================================================
// DATA SOURCE FACTORY
// ============================================================================

class DataSourceFactory {
  static create(sourceName, apiClient) {
    const config = CONFIG.sources[sourceName];

    if (!config) {
      throw new Error(`Unknown source: ${sourceName}`);
    }

    const sourceMap = {
      billboard: BillboardDataSource,
      imdb: IMDbDataSource,
      steam: SteamDataSource,
      hackernews: HackerNewsDataSource,
      github: GitHubDataSource,
      wikipedia: WikipediaDataSource,
    };

    const SourceClass = sourceMap[sourceName];
    if (!SourceClass) {
      throw new Error(`Source not implemented: ${sourceName}`);
    }

    return new SourceClass(config, apiClient);
  }
}

// ============================================================================
// MAIN WIDGET CLASS
// ============================================================================

class UniversalWidget {
  constructor() {
    this.sourceName = args.widgetParameter || CONFIG.defaultSource;
    this.apiClient = new APIClient(CONFIG.apiBaseUrl);
    this.dataSource = DataSourceFactory.create(this.sourceName, this.apiClient);
  }

  async run() {
    try {
      const widgetSize = config.widgetFamily || "medium";
      const widget = await this.createWidget(widgetSize);

      if (config.runsInWidget) {
        Script.setWidget(widget);
      } else {
        await this.presentWidget(widget, widgetSize);
      }

      Script.complete();
    } catch (error) {
      console.error("Widget error:", error);
      const errorWidget = this.createErrorWidget(error.message);
      Script.setWidget(errorWidget);
      Script.complete();
    }
  }

  async createWidget(widgetSize) {
    const widget = new ListWidget();
    const sizes = CONFIG.sizing[widgetSize];

    // Configure widget appearance
    widget.setPadding(
      sizes.padding,
      sizes.padding,
      sizes.padding,
      sizes.padding
    );

    // Set refresh interval
    const refreshDate = new Date(Date.now() + CONFIG.refreshInterval);
    widget.refreshAfterDate = refreshDate;

    // Set URL scheme if available
    if (this.dataSource.config.urlScheme) {
      widget.url = this.dataSource.config.urlScheme;
    }

    try {
      const data = await this.dataSource.fetchData(widgetSize);

      if (
        !data ||
        (data.items?.length === 0 &&
          data.movies?.length === 0 &&
          data.games?.length === 0 &&
          data.stories?.length === 0 &&
          data.releases?.length === 0 &&
          data.edits?.length === 0)
      ) {
        return this.createErrorWidget("No data available");
      }

      this.dataSource.renderWidget(widget, data, widgetSize);

      // Add update indicator for large widgets
      if (widgetSize === "large") {
        this.addFooter(widget, sizes);
      }

      return widget;
    } catch (error) {
      console.error("Data fetch error:", error);
      return this.createErrorWidget(error.message);
    }
  }

  createErrorWidget(message) {
    const widget = new ListWidget();
    const sizes = CONFIG.sizing["medium"];

    widget.setPadding(
      sizes.padding,
      sizes.padding,
      sizes.padding,
      sizes.padding
    );

    const stack = widget.addStack();
    stack.layoutVertically();
    stack.centerAlignContent();

    const icon = stack.addImage(
      SFSymbol.named("exclamationmark.triangle.fill").image
    );
    icon.imageSize = new Size(32, 32);
    icon.tintColor = CONFIG.colors.warning;

    stack.addSpacer(8);

    const errorText = stack.addText("Error");
    errorText.font = Font.boldSystemFont(14);
    errorText.textColor = CONFIG.colors.primary;
    errorText.centerAlignText();

    stack.addSpacer(4);

    const messageText = stack.addText(message);
    messageText.font = Font.systemFont(11);
    messageText.textColor = CONFIG.colors.secondary;
    messageText.centerAlignText();

    return widget;
  }

  addFooter(widget, sizes) {
    widget.addSpacer();

    const footer = widget.addStack();
    footer.layoutHorizontally();
    footer.addSpacer();

    const updateTime = new Date();
    const timeString = `Updated ${updateTime
      .getHours()
      .toString()
      .padStart(2, "0")}:${updateTime
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    const timeText = footer.addText(timeString);
    timeText.font = Font.systemFont(sizes.fontSize.tertiary);
    timeText.textColor = CONFIG.colors.tertiary;
    timeText.rightAlignText();
  }

  async presentWidget(widget, widgetSize) {
    const presentMap = {
      small: () => widget.presentSmall(),
      medium: () => widget.presentMedium(),
      large: () => widget.presentLarge(),
    };

    const presentFunc = presentMap[widgetSize];
    if (presentFunc) {
      await presentFunc();
    }
  }
}

// ============================================================================
// EXECUTION
// ============================================================================

const widget = new UniversalWidget();
await widget.run();
