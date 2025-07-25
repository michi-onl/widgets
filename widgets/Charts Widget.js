// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: gray; icon-glyph: chart-bar;

/*
Universal Chart Widget
Author: Michael Wagner, michi.onl

GitHub: https://github.com/michi-onl/widgets

This Scriptable widget can display charts from multiple data sources.
Configure the source using widget parameters or the CONFIG object.
*/

const CONFIG = {
  defaultChartSource: "statsfm", // Default source if no parameter is provided
  refreshHours: 24,
  maxItems: 3,
  widgetSizes: {
    small: { name: [9, 8], spacer: 4 },
    medium: { name: [12, 10], spacer: 8 },
    large: { name: [14, 12], spacer: 8 },
  },
  colors: {
    subtitle: Color.gray(),
    error: Color.red(),
    new: Color.orange(),
    up: Color.green(),
    down: Color.red(),
    same: Color.gray(),
    star: Color.yellow(),
  },
};

const DATA_SOURCES = {
  statsfm: {
    name: "Stats.fm",
    userId: "", // Change this to your Stats.fm user ID
    apiBaseUrl: "https://api.stats.fm/api/v1",
    logoUrl:
      "https://cdn.brandfetch.io/idOZib4c5s/w/180/h/180/theme/dark/logo.png?c=1dxbfHSJFAPEGdCLU4o5B",
    urlScheme: "statsfm://",
    footerText: "© stats.fm",
    refreshHours: 24,
  },
  steam: {
    name: "Steam",
    username: "", // Change this to your Steam username
    apiEndpoint: "https://api.michi.onl/api/charts/steam/recent-activity",
    logoUrl:
      "https://cdn.brandfetch.io/idMpZmhn_O/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
    urlScheme: "steam://",
    footerText: "Steam Activity",
    refreshHours: 24,
  },
  imdb: {
    name: "IMDB",
    apiUrl: "https://api.michi.onl/api/charts/imdb/tv-movie",
    footerText: "© IMDB",
    refreshHours: 24,
  },
  billboard: {
    name: "Billboard",
    apiUrl: "https://api.michi.onl/api/charts/billboard/billboard-200",
    footerText: "© Billboard",
    refreshHours: 24,
  },
};

class DataSource {
  constructor(config) {
    this.config = config;
  }

  async fetchData(widgetSize) {
    throw new Error("fetchData must be implemented by subclass");
  }

  buildContent(widget, data, widgetSize) {
    throw new Error("buildContent must be implemented by subclass");
  }

  isEmpty(data) {
    throw new Error("isEmpty must be implemented by subclass");
  }
}

// Stats.fm data source
class StatsfmDataSource extends DataSource {
  async fetchData(widgetSize) {
    const dataPromises = { track: this.fetchChartData("track") };

    if (widgetSize !== "small") {
      dataPromises.album = this.fetchChartData("album");
    }

    const resolvedData = await Promise.allSettled(Object.values(dataPromises));
    const data = {};

    if (resolvedData[0].status === "fulfilled" && resolvedData[0].value) {
      data.track = await this.preloadImages(resolvedData[0].value);
    }

    if (resolvedData[1]?.status === "fulfilled" && resolvedData[1].value) {
      data.album = await this.preloadImages(resolvedData[1].value);
    }

    return data;
  }

  async fetchChartData(type) {
    const url = `${this.config.apiBaseUrl}/users/${this.config.userId}/top/${type}s?range=weeks`;

    try {
      const request = new Request(url);
      const response = await request.loadJSON();

      if (!response?.items || !Array.isArray(response.items)) {
        console.warn(`Invalid response structure for ${type} data`);
        return null;
      }

      return response.items
        .slice(0, CONFIG.maxItems)
        .map((item, index) => this.formatItem(item, type, index));
    } catch (error) {
      console.error(`Error fetching ${type} data:`, error);
      return null;
    }
  }

  formatItem(item, type, index) {
    const itemData = item[type];
    return {
      imgSrc: this.getImageUrl(itemData, type),
      name: itemData?.name || `Unknown ${type} ${index + 1}`,
      sub: `${this.formatNumber(item.streams || 0)} Streams`,
    };
  }

  getImageUrl(itemData, type) {
    if (!itemData) return null;
    if (itemData.image) return itemData.image;
    if (type === "track" && itemData.albums?.[0]?.image) {
      return itemData.albums[0].image;
    }
    return null;
  }

  async preloadImages(items) {
    if (!items || !Array.isArray(items)) return null;

    const imagePromises = items.map(async (item) => {
      if (item.imgSrc) {
        try {
          item.img = await this.loadImage(item.imgSrc);
        } catch (error) {
          console.warn(`Failed to load image for ${item.name}:`, error);
          item.img = null;
        }
      }
      return item;
    });

    return await Promise.all(imagePromises);
  }

  async loadImage(url) {
    if (!url) return null;
    try {
      const request = new Request(url);
      return await request.loadImage();
    } catch (error) {
      console.error(`Error loading image from ${url}:`, error);
      return null;
    }
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  }

  buildContent(widget, data, widgetSize) {
    const mainStack = widget.addStack();
    mainStack.layoutHorizontally();

    const contentTypes = ["track", "album"];
    const columnTitles = { track: "Songs", album: "Albums" };
    let addedColumns = 0;

    for (const type of contentTypes) {
      if (data[type]?.length > 0) {
        if (addedColumns > 0) {
          mainStack.addSpacer(CONFIG.widgetSizes[widgetSize].spacer);
        }

        const column = mainStack.addStack();
        column.layoutVertically();

        this.addColumnTitle(column, columnTitles[type]);

        for (const item of data[type]) {
          this.addItem(column, item, widgetSize);
        }

        addedColumns++;
      }
    }

    mainStack.addSpacer();
    return mainStack;
  }

  addColumnTitle(column, title) {
    const titleText = column.addText(title);
    titleText.font = Font.boldSystemFont(11);
    titleText.textColor = CONFIG.colors.subtitle;
    titleText.leftAlignText();
    column.addSpacer(4);
  }

  addItem(column, item, widgetSize) {
    const itemStack = column.addStack();
    itemStack.layoutHorizontally();
    itemStack.setPadding(4, 0, 4, 0);

    if (item.img) {
      this.addItemImage(itemStack, item.img);
      itemStack.addSpacer(8);
    }

    this.addItemText(itemStack, item, widgetSize);
  }

  addItemImage(stack, image) {
    const imageStack = stack.addStack();
    const imageElement = imageStack.addImage(image);
    imageElement.cornerRadius = 8;
    imageStack.centerAlignContent();
  }

  addItemText(stack, item, widgetSize) {
    const textStack = stack.addStack();
    textStack.layoutVertically();

    const cleanedName = this.cleanTitle(item.name);
    const nameText = textStack.addText(cleanedName);
    const subText = textStack.addText(item.sub);

    const fontSizes = CONFIG.widgetSizes[widgetSize].name;
    nameText.font = Font.systemFont(fontSizes[0]);
    subText.font = Font.systemFont(fontSizes[1]);
    subText.textColor = CONFIG.colors.subtitle;
  }

  cleanTitle(title) {
    if (!title || typeof title !== "string") return "";
    return title
      .replace(/$feat\. .*?$/gi, "")
      .replace(/$.*?$/gi, "")
      .trim();
  }

  isEmpty(data) {
    return !data || (!data.track && !data.album);
  }
}

// Steam data source
class SteamDataSource extends DataSource {
  async fetchData() {
    try {
      const url = `${this.config.apiEndpoint}?profiles=${this.config.username}`;
      const request = new Request(url);
      const response = await request.loadJSON();

      const userData = response[this.config.username];
      if (!userData) throw new Error("User data not found");

      const recentGames = userData.recentGames.map((game) => ({
        name: game.name,
        hoursPlayed: game.hoursPlayed,
        hoursPlayedNumeric: game.hoursPlayedNumeric,
        lastPlayedShort: game.lastPlayedShort,
        imgSrc: game.iconUrl,
        appId: game.appId,
      }));

      const gamesWithImages = await this.preloadImages(recentGames);

      return {
        profileName: userData.profileName,
        totalGames: userData.totalGames,
        recentGames: gamesWithImages,
      };
    } catch (error) {
      console.error("Error fetching Steam data:", error);
      throw error;
    }
  }

  async preloadImages(items) {
    if (!items || !Array.isArray(items)) return null;

    const imagePromises = items.map(async (item) => {
      if (item.imgSrc) {
        try {
          item.img = await this.loadImage(item.imgSrc);
        } catch (error) {
          console.warn(`Failed to load image for ${item.name}:`, error);
          item.img = null;
        }
      }
      return item;
    });

    return await Promise.all(imagePromises);
  }

  async loadImage(url) {
    if (!url) return null;
    try {
      const request = new Request(url);
      return await request.loadImage();
    } catch (error) {
      console.error(`Error loading image from ${url}:`, error);
      return null;
    }
  }

  buildContent(widget, data, widgetSize) {
    const mainStack = widget.addStack();
    mainStack.layoutHorizontally();

    const gamesColumn = mainStack.addStack();
    gamesColumn.layoutVertically();

    const titleText = gamesColumn.addText("Recent Games");
    titleText.font = Font.boldSystemFont(11);
    titleText.textColor = CONFIG.colors.subtitle;
    titleText.leftAlignText();

    gamesColumn.addSpacer(4);

    for (let i = 0; i < data.recentGames.length; i++) {
      const game = data.recentGames[i];
      this.addGame(gamesColumn, game, widgetSize);

      if (i < data.recentGames.length - 1) {
        gamesColumn.addSpacer(2);
      }
    }

    mainStack.addSpacer();
    return mainStack;
  }

  addGame(column, game, widgetSize) {
    const gameStack = column.addStack();
    gameStack.layoutHorizontally();
    gameStack.setPadding(4, 0, 4, 0);

    if (game.img) {
      this.addItemImage(gameStack, game.img);
      gameStack.addSpacer(8);
    }

    this.addGameText(gameStack, game, widgetSize);
  }

  addItemImage(stack, image) {
    const imageStack = stack.addStack();
    const imageElement = imageStack.addImage(image);
    imageElement.cornerRadius = 8;
    imageStack.centerAlignContent();
  }

  addGameText(stack, game, widgetSize) {
    const textStack = stack.addStack();
    textStack.layoutVertically();

    const cleanedName = this.cleanTitle(game.name);
    const nameText = textStack.addText(cleanedName);

    const detailsStack = textStack.addStack();
    detailsStack.layoutHorizontally();

    const hoursText = detailsStack.addText(
      this.formatHours(game.hoursPlayedNumeric)
    );
    detailsStack.addSpacer(8);
    const lastPlayedText = detailsStack.addText(game.lastPlayedShort);

    const fontSizes = CONFIG.widgetSizes[widgetSize].name;
    nameText.font = Font.systemFont(fontSizes[0]);
    nameText.lineLimit = 1;

    hoursText.font = Font.systemFont(fontSizes[1]);
    hoursText.textColor = CONFIG.colors.subtitle;

    lastPlayedText.font = Font.systemFont(fontSizes[1]);
    lastPlayedText.textColor = new Color("#66c0f4");
  }

  cleanTitle(title) {
    if (!title || typeof title !== "string") return "";
    return title
      .replace(/$feat\. .*?$/gi, "")
      .replace(/$.*?$/gi, "")
      .trim();
  }

  formatHours(hours) {
    if (hours >= 1000) return `${(hours / 1000).toFixed(1)}K hrs`;
    if (hours >= 100) return `${hours.toFixed(0)} hrs`;
    if (hours >= 10) return `${hours.toFixed(1)} hrs`;
    return `${hours.toFixed(1)} hrs`;
  }

  isEmpty(data) {
    return !data || !data.recentGames || data.recentGames.length === 0;
  }
}

// IMDB data source
class ImdbDataSource extends DataSource {
  async fetchData() {
    try {
      const request = new Request(this.config.apiUrl);
      const response = await request.loadJSON();

      return {
        movies: response.movies?.data?.slice(0, 3) || [],
        tvShows: response.tv_shows?.data?.slice(0, 3) || [],
      };
    } catch (error) {
      console.error("API fetch error:", error);
      return null;
    }
  }

  buildContent(widget, data, widgetSize) {
    const body = widget.addStack();
    body.layoutHorizontally();

    if (data.movies.length > 0) {
      const moviesColumn = body.addStack();
      moviesColumn.layoutVertically();
      this.addColumnTitle(moviesColumn, "Movies");
      data.movies.forEach((movie) =>
        this.addItem(moviesColumn, movie, widgetSize)
      );
    }

    if (data.tvShows.length > 0 && widgetSize !== "small") {
      body.addSpacer(10);
      const tvColumn = body.addStack();
      tvColumn.layoutVertically();
      this.addColumnTitle(tvColumn, "Shows");
      data.tvShows.forEach((show) => this.addItem(tvColumn, show, widgetSize));
    }

    return body;
  }

  addColumnTitle(column, title) {
    const chartTitle = column.addText(title);
    chartTitle.font = Font.boldSystemFont(11);
    chartTitle.textColor = CONFIG.colors.subtitle;
    column.addSpacer(2);
  }

  addItem(column, item, widgetSize) {
    const stack = column.addStack();
    stack.layoutHorizontally();
    stack.setPadding(4, 0, 4, 0);
    stack.centerAlignContent();

    if (item.href && item.href !== "N/A") {
      stack.url = `imdb://m.imdb.com${item.href}`;
    }

    const textContainer = stack.addStack();
    const textStack = textContainer.addStack();
    textStack.layoutVertically();
    textContainer.addSpacer();

    const titleText = textStack.addText(item.title || "Unknown Title");
    titleText.font = Font.systemFont(CONFIG.widgetSizes[widgetSize].name[0]);

    const subtitleParts = [
      item.year || "Unknown Year",
      item.length || "N/A",
      item.age || "N/A",
    ].filter((part) => part !== "N/A");

    const subtitleText = textStack.addText(subtitleParts.join(", "));
    subtitleText.font = Font.systemFont(CONFIG.widgetSizes[widgetSize].name[1]);
    subtitleText.textColor = CONFIG.colors.subtitle;

    stack.addSpacer();

    if (item.rating && item.rating !== "N/A") {
      this.addRatingSection(stack, item.rating, widgetSize);
    }
  }

  addRatingSection(stack, rating, widgetSize) {
    const ratingStack = stack.addStack();
    ratingStack.centerAlignContent();

    const star = ratingStack.addImage(SFSymbol.named("star.fill").image);
    star.tintColor = CONFIG.colors.star;
    star.imageSize = new Size(
      CONFIG.widgetSizes[widgetSize].name[0],
      CONFIG.widgetSizes[widgetSize].name[0]
    );

    ratingStack.addSpacer(2);

    const ratingText = ratingStack.addText(rating);
    ratingText.font = Font.boldSystemFont(
      CONFIG.widgetSizes[widgetSize].name[0]
    );
  }

  isEmpty(data) {
    return (
      !data ||
      ((!data.movies || data.movies.length === 0) &&
        (!data.tvShows || data.tvShows.length === 0))
    );
  }
}

// Billboard data source
class BillboardDataSource extends DataSource {
  async fetchData() {
    try {
      const request = new Request(this.config.apiUrl);
      request.timeoutInterval = 10;
      const response = await request.loadJSON();

      return {
        albums: response.music?.data || response.data || response.albums || [],
      };
    } catch (error) {
      console.error("API fetch error:", error);
      return null;
    }
  }

  buildContent(widget, data, widgetSize) {
    const body = widget.addStack();
    body.layoutVertically();

    const chartTitle = body.addText("Albums");
    chartTitle.font = Font.boldSystemFont(11);
    chartTitle.textColor = CONFIG.colors.subtitle;
    body.addSpacer(2);

    const container = body.addStack();
    container.layoutHorizontally();

    if (data.albums.length > 0) {
      const firstColumn = container.addStack();
      firstColumn.layoutVertically();

      const firstThreeAlbums = data.albums.slice(0, 3);
      firstThreeAlbums.forEach((album, index) =>
        this.addItem(firstColumn, album, index, widgetSize)
      );
    }

    if (data.albums.length > 3 && widgetSize !== "small") {
      container.addSpacer(10);
      const secondColumn = container.addStack();
      secondColumn.layoutVertically();

      const nextThreeAlbums = data.albums.slice(3, 6);
      nextThreeAlbums.forEach((album, index) =>
        this.addItem(secondColumn, album, index + 3, widgetSize)
      );
    }

    return body;
  }

  addItem(column, item, currentIndex, widgetSize) {
    const stack = column.addStack();
    stack.layoutHorizontally();
    stack.setPadding(4, 0, 4, 0);
    stack.centerAlignContent();

    const textContainer = stack.addStack();
    const textStack = textContainer.addStack();
    textStack.layoutVertically();
    textContainer.addSpacer();

    const titleRow = textStack.addStack();
    titleRow.layoutHorizontally();
    titleRow.centerAlignContent();

    const iconSymbol = item.peak === 1 ? "star" : "circle.dotted";
    const iconColor = CONFIG.colors.subtitle;

    const titleIcon = titleRow.addImage(SFSymbol.named(iconSymbol).image);
    titleIcon.tintColor = iconColor;
    titleIcon.imageSize = new Size(
      CONFIG.widgetSizes[widgetSize].name[0],
      CONFIG.widgetSizes[widgetSize].name[0]
    );

    titleRow.addSpacer(4);

    const titleText = titleRow.addText(
      item.title || item.name || "Unknown Title"
    );
    titleText.font = Font.systemFont(CONFIG.widgetSizes[widgetSize].name[0]);

    const subtitleParts = [
      item.artist || "Unknown Artist",
      item.weeks ? `${item.weeks} wks` : null,
    ].filter((part) => part !== null);

    const subtitleText = textStack.addText(subtitleParts.join(" • "));
    subtitleText.font = Font.systemFont(CONFIG.widgetSizes[widgetSize].name[1]);
    subtitleText.textColor = CONFIG.colors.subtitle;

    stack.addSpacer();

    if (item.before !== undefined) {
      this.addPositionChangeSection(
        stack,
        item.before,
        currentIndex,
        widgetSize
      );
    }
  }

  addPositionChangeSection(stack, beforePosition, currentIndex, widgetSize) {
    const changeStack = stack.addStack();
    changeStack.centerAlignContent();

    let symbol, color;

    if (beforePosition === 0) {
      symbol = "plus.circle";
      color = CONFIG.colors.new;
    } else {
      const currentPosition = currentIndex + 1;
      if (currentPosition < beforePosition) {
        symbol = "arrow.up.circle";
        color = CONFIG.colors.up;
      } else if (currentPosition > beforePosition) {
        symbol = "arrow.down.circle";
        color = CONFIG.colors.down;
      } else {
        symbol = "minus.circle";
        color = CONFIG.colors.same;
      }
    }

    const changeIcon = changeStack.addImage(SFSymbol.named(symbol).image);
    changeIcon.tintColor = color;
    changeIcon.imageSize = new Size(
      CONFIG.widgetSizes[widgetSize].name[0],
      CONFIG.widgetSizes[widgetSize].name[0]
    );
  }

  isEmpty(data) {
    return !data || !data.albums || data.albums.length === 0;
  }
}

// Data source factory
class DataSourceFactory {
  static create(chartSource) {
    const config = DATA_SOURCES[chartSource];
    if (!config) {
      throw new Error(`Unknown chart source: ${chartSource}`);
    }

    switch (chartSource) {
      case "statsfm":
        return new StatsfmDataSource(config);
      case "steam":
        return new SteamDataSource(config);
      case "imdb":
        return new ImdbDataSource(config);
      case "billboard":
        return new BillboardDataSource(config);
      default:
        throw new Error(`Unsupported chart source: ${chartSource}`);
    }
  }
}

// Main widget class
class UniversalWidget {
  constructor() {
    this.chartSource = args.widgetParameter || CONFIG.defaultChartSource;
    this.dataSource = DataSourceFactory.create(this.chartSource);
    this.sourceConfig = DATA_SOURCES[this.chartSource];
  }

  async main() {
    try {
      const widgetSize = config.widgetFamily || "medium";
      const widget = await this.createWidget(widgetSize);

      if (!config.runInWidget) {
        const presentMethod = `present${this.capitalize(widgetSize)}`;
        await widget[presentMethod]();
      }

      Script.setWidget(widget);
      Script.complete();
    } catch (error) {
      console.error("Widget creation failed:", error);
      const errorWidget = this.createErrorWidget(error.message);
      Script.setWidget(errorWidget);
      Script.complete();
    }
  }

  async createWidget(widgetSize) {
    const widget = new ListWidget();

    const refreshHours = this.sourceConfig.refreshHours || CONFIG.refreshHours;
    widget.refreshAfterDate = new Date(
      Date.now() + refreshHours * 60 * 60 * 1000
    );

    try {
      const data = await this.dataSource.fetchData(widgetSize);

      if (!data || this.dataSource.isEmpty(data)) {
        return this.createErrorWidget("No data found.");
      }

      const mainStack = this.dataSource.buildContent(widget, data, widgetSize);

      if (this.sourceConfig.logoUrl) {
        await this.addSourceIcon(mainStack);
      }

      if (widgetSize === "large") {
        this.addFooter(widget);
      }

      return widget;
    } catch (error) {
      console.error("Error creating widget:", error);
      return this.createErrorWidget("Error loading data.");
    }
  }

  async addSourceIcon(stack) {
    try {
      if (this.sourceConfig.logoUrl) {
        const sourceImage = await this.loadImage(this.sourceConfig.logoUrl);
        if (sourceImage) {
          const iconStack = stack.addStack();
          iconStack.layoutVertically();
          iconStack.centerAlignContent();
          const icon = iconStack.addImage(sourceImage);
          icon.centerAlignImage();
          icon.cornerRadius = 8;
          icon.imageSize = new Size(25, 25);
          if (this.sourceConfig.urlScheme) {
            icon.url = this.sourceConfig.urlScheme;
          }
          iconStack.centerAlignContent();
        }
      }
    } catch (error) {
      console.error(`Failed to load ${this.sourceConfig.name} icon:`, error);
    }
  }

  addFooter(widget) {
    const footer = widget.addStack();
    footer.layoutHorizontally();
    footer.addSpacer();

    const footerTextStack = footer.addStack();
    footerTextStack.backgroundColor = new Color("#b0b0b0", 0.6);
    footerTextStack.cornerRadius = 3;
    footerTextStack.setPadding(2, 4, 2, 4);

    const text = footerTextStack.addText(this.sourceConfig.footerText);
    text.font = Font.mediumSystemFont(9);
    text.color = new Color("#efefef");
    text.rightAlignText();
  }

  async loadImage(url) {
    if (!url) return null;
    try {
      const request = new Request(url);
      return await request.loadImage();
    } catch (error) {
      console.error(`Error loading image from ${url}:`, error);
      return null;
    }
  }

  createErrorWidget(message) {
    const widget = new ListWidget();
    const errorText = widget.addText(`⚠ ${message}`);
    errorText.font = Font.italicSystemFont(12);
    errorText.textColor = CONFIG.colors.error;
    return widget;
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Initialize and run the widget
const universalWidget = new UniversalWidget();
await universalWidget.main();
