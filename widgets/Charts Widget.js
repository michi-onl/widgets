// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: chart-bar;

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

// Data source configurations
const DATA_SOURCES = {
  statsfm: {
    name: "Stats.fm",
    userId: "31mckhdwyvws5yaem2j3jhku636y", // Change this to your Stats.fm user ID
    apiBaseUrl: "https://api.stats.fm/api/v1",
    logoUrl:
      "https://cdn.brandfetch.io/idOZib4c5s/w/180/h/180/theme/dark/logo.png?c=1dxbfHSJFAPEGdCLU4o5B",
    urlScheme: "statsfm://",
    footerText: "© stats.fm",
    refreshHours: 24,
  },
  steam: {
    name: "Steam",
    username: "michilikesmilk", // Change this to your Steam username
    apiEndpoint: "https://api.michi.onl/api/charts/steam/recent-activity",
    logoUrl:
      "https://cdn.brandfetch.io/idMpZmhn_O/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
    urlScheme: "steam://",
    footerText: "Steam Activity",
    refreshHours: 1,
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

class UniversalWidget {
  constructor() {
    this.chartSource = args.widgetParameter || CONFIG.defaultChartSource;
    this.sourceConfig = DATA_SOURCES[this.chartSource];

    if (!this.sourceConfig) {
      throw new Error(`Unknown chart source: ${this.chartSource}`);
    }
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
      const data = await this.fetchAndProcessData(widgetSize);

      if (!data || this.isDataEmpty(data)) {
        return this.createErrorWidget("No data found.");
      }

      await this.buildWidgetContent(widget, data, widgetSize);

      if (widgetSize === "large") {
        this.addFooter(widget);
      }

      return widget;
    } catch (error) {
      console.error("Error creating widget:", error);
      return this.createErrorWidget("Error loading data.");
    }
  }

  async fetchAndProcessData(widgetSize) {
    switch (this.chartSource) {
      case "statsfm":
        return await this.fetchStatsfmData(widgetSize);
      case "steam":
        return await this.fetchSteamData();
      case "imdb":
        return await this.fetchImdbData();
      case "billboard":
        return await this.fetchBillboardData();
      default:
        throw new Error(`Unsupported chart source: ${this.chartSource}`);
    }
  }

  async fetchStatsfmData(widgetSize) {
    const dataPromises = {
      track: this.fetchChartData("track"),
    };

    if (widgetSize !== "small") {
      dataPromises.album = this.fetchChartData("album");
    }

    const resolvedData = await Promise.allSettled(Object.values(dataPromises));
    const data = {};

    if (resolvedData[0].status === "fulfilled" && resolvedData[0].value) {
      data.track = await this.preloadImages(resolvedData[0].value);
    }

    if (
      resolvedData[1] &&
      resolvedData[1].status === "fulfilled" &&
      resolvedData[1].value
    ) {
      data.album = await this.preloadImages(resolvedData[1].value);
    }

    return data;
  }

  async fetchChartData(type) {
    const url = `${this.sourceConfig.apiBaseUrl}/users/${this.sourceConfig.userId}/top/${type}s?range=weeks`;

    try {
      const request = new Request(url);
      const response = await request.loadJSON();

      if (!response || !response.items || !Array.isArray(response.items)) {
        console.warn(`Invalid response structure for ${type} data`);
        return null;
      }

      return response.items
        .slice(0, CONFIG.maxItems)
        .map((item, index) => this.formatStatsfmItem(item, type, index));
    } catch (error) {
      console.error(`Error fetching ${type} data:`, error);
      return null;
    }
  }

  formatStatsfmItem(item, type, index) {
    const itemData = item[type];

    return {
      imgSrc: this.getImageUrl(itemData, type),
      name: itemData?.name || `Unknown ${type} ${index + 1}`,
      sub: `${this.formatNumber(item.streams || 0)} Streams`,
    };
  }

  async fetchSteamData() {
    try {
      const url = `${this.sourceConfig.apiEndpoint}?profiles=${this.sourceConfig.username}`;
      const request = new Request(url);
      const response = await request.loadJSON();

      const userData = response[this.sourceConfig.username];
      if (!userData) {
        throw new Error("User data not found");
      }

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

  async fetchImdbData() {
    try {
      const request = new Request(this.sourceConfig.apiUrl);
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

  async fetchBillboardData() {
    try {
      const request = new Request(this.sourceConfig.apiUrl);
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

  async buildWidgetContent(widget, data, widgetSize) {
    switch (this.chartSource) {
      case "statsfm":
        await this.buildStatsfmContent(widget, data, widgetSize);
        break;
      case "steam":
        await this.buildSteamContent(widget, data, widgetSize);
        break;
      case "imdb":
        this.buildImdbContent(widget, data, widgetSize);
        break;
      case "billboard":
        this.buildBillboardContent(widget, data, widgetSize);
        break;
    }
  }

  async buildStatsfmContent(widget, data, widgetSize) {
    const mainStack = widget.addStack();
    mainStack.layoutHorizontally();

    const contentTypes = ["track", "album"];
    const columnTitles = { track: "Songs", album: "Albums" };
    let addedColumns = 0;

    for (const type of contentTypes) {
      if (data[type] && data[type].length > 0) {
        if (addedColumns > 0) {
          mainStack.addSpacer(CONFIG.widgetSizes[widgetSize].spacer);
        }

        const column = mainStack.addStack();
        column.layoutVertically();

        const titleText = column.addText(columnTitles[type]);
        titleText.font = Font.boldSystemFont(11);
        titleText.textColor = CONFIG.colors.subtitle;
        titleText.leftAlignText();
        column.addSpacer(4);

        for (const item of data[type]) {
          this.addStatsfmItem(column, item, widgetSize);
        }

        addedColumns++;
      }
    }

    mainStack.addSpacer();
    await this.addSourceIcon(mainStack);
  }

  async buildSteamContent(widget, data, widgetSize) {
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
      this.addSteamGame(gamesColumn, game, widgetSize);

      if (i < data.recentGames.length - 1) {
        gamesColumn.addSpacer(2);
      }
    }

    mainStack.addSpacer();
    if (widgetSize !== "small") {
      await this.addSourceIcon(mainStack);
    }
  }

  buildImdbContent(widget, data, widgetSize) {
    const body = widget.addStack();
    body.layoutHorizontally();

    if (data.movies.length > 0) {
      const moviesColumn = body.addStack();
      moviesColumn.layoutVertically();
      const chartTitle = moviesColumn.addText("Movies");
      chartTitle.font = Font.boldSystemFont(11);
      chartTitle.textColor = CONFIG.colors.subtitle;
      moviesColumn.addSpacer(2);
      data.movies.forEach((movie) =>
        this.addImdbItem(moviesColumn, movie, widgetSize)
      );
    }

    if (data.tvShows.length > 0 && widgetSize !== "small") {
      body.addSpacer(10);
      const tvColumn = body.addStack();
      tvColumn.layoutVertically();
      const chartTitle = tvColumn.addText("Shows");
      chartTitle.font = Font.boldSystemFont(11);
      chartTitle.textColor = CONFIG.colors.subtitle;
      tvColumn.addSpacer(2);
      data.tvShows.forEach((show) =>
        this.addImdbItem(tvColumn, show, widgetSize)
      );
    }
  }

  buildBillboardContent(widget, data, widgetSize) {
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
        this.addBillboardItem(firstColumn, album, index, widgetSize)
      );
    }

    if (data.albums.length > 3 && widgetSize !== "small") {
      container.addSpacer(10);
      const secondColumn = container.addStack();
      secondColumn.layoutVertically();

      const nextThreeAlbums = data.albums.slice(3, 6);
      nextThreeAlbums.forEach((album, index) =>
        this.addBillboardItem(secondColumn, album, index + 3, widgetSize)
      );
    }
  }

  addStatsfmItem(column, item, widgetSize) {
    const itemStack = column.addStack();
    itemStack.layoutHorizontally();
    itemStack.setPadding(4, 0, 4, 0);

    if (item.img) {
      this.addItemImage(itemStack, item.img);
      itemStack.addSpacer(8);
    }

    this.addItemText(itemStack, item, widgetSize);
  }

  addSteamGame(column, game, widgetSize) {
    const gameStack = column.addStack();
    gameStack.layoutHorizontally();
    gameStack.setPadding(4, 0, 4, 0);

    if (game.img) {
      this.addItemImage(gameStack, game.img);
      gameStack.addSpacer(8);
    }

    this.addSteamGameText(gameStack, game, widgetSize);
  }

  addSteamGameText(stack, game, widgetSize) {
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

  addImdbItem(column, item, widgetSize) {
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

  addBillboardItem(column, item, currentIndex, widgetSize) {
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

  getImageUrl(itemData, type) {
    if (!itemData) return null;

    if (itemData.image) return itemData.image;

    if (type === "track" && itemData.albums?.[0]?.image) {
      return itemData.albums[0].image;
    }

    return null;
  }

  isDataEmpty(data) {
    switch (this.chartSource) {
      case "statsfm":
        return !data || (!data.track && !data.album);
      case "steam":
        return !data || !data.recentGames || data.recentGames.length === 0;
      case "imdb":
        return (
          !data ||
          ((!data.movies || data.movies.length === 0) &&
            (!data.tvShows || data.tvShows.length === 0))
        );
      case "billboard":
        return !data || !data.albums || data.albums.length === 0;
      default:
        return true;
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

  cleanTitle(title) {
    if (!title || typeof title !== "string") return "";
    return title
      .replace(/\(feat\. .*?\)/gi, "")
      .replace(/\(.*?\)/gi, "")
      .trim();
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  }

  formatHours(hours) {
    if (hours >= 1000) {
      return `${(hours / 1000).toFixed(1)}K hrs`;
    } else if (hours >= 100) {
      return `${hours.toFixed(0)} hrs`;
    } else if (hours >= 10) {
      return `${hours.toFixed(1)} hrs`;
    } else {
      return `${hours.toFixed(1)} hrs`;
    }
  }
}

// Initialize and run the widget
const universalWidget = new UniversalWidget();
await universalWidget.main();
