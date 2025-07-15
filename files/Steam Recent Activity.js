// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: gamepad;

/*
Steam Recent Activity Widget
Author: Michael Wagner, michi.onl

GitHub: https://github.com/michi-onl/widgets

This Scriptable widget displays recent Steam games and activity.
 */

const CONFIG = {
  API_ENDPOINT: "https://api.michi.onl/api/charts/steam/recent-activity",
  USERNAME: "michilikesmilk", // Change this to your Steam username
  STEAM_LOGO_URL:
    "https://cdn.brandfetch.io/idMpZmhn_O/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B",
  REFRESH_HOURS: 1,
  WIDGET_SIZES: {
    small: { name: [9, 8], spacer: 4 },
    medium: { name: [12, 10], spacer: 8 },
    large: { name: [14, 12], spacer: 8 },
  },
};

async function main() {
  try {
    const widgetSize = config.widgetFamily || "medium";
    const widget = await createWidget(widgetSize);

    if (!config.runInWidget) {
      const presentMethod = `present${capitalize(widgetSize)}`;
      await widget[presentMethod]();
    }

    Script.setWidget(widget);
    Script.complete();
  } catch (error) {
    console.error("Widget creation failed:", error);
    const errorWidget = createErrorWidget(error.message);
    Script.setWidget(errorWidget);
    Script.complete();
  }
}

async function createWidget(widgetSize) {
  const widget = new ListWidget();
  widget.refreshAfterDate = new Date(
    Date.now() + CONFIG.REFRESH_HOURS * 60 * 60 * 1000
  );

  try {
    const data = await fetchAndProcessData();

    if (!data || !data.recentGames || data.recentGames.length === 0) {
      return createErrorWidget("No recent games found.");
    }

    await buildWidgetContent(widget, data, widgetSize);

    if (widgetSize === "large") {
      addFooter(widget);
    }

    return widget;
  } catch (error) {
    console.error("Error creating widget:", error);
    return createErrorWidget("Error loading Steam data.");
  }
}

async function fetchAndProcessData() {
  try {
    const url = `${CONFIG.API_ENDPOINT}?profiles=${CONFIG.USERNAME}`;
    const request = new Request(url);
    const response = await request.loadJSON();

    const userData = response[CONFIG.USERNAME];
    if (!userData) {
      throw new Error("User data not found");
    }

    // Process and preload images for recent games
    const recentGames = userData.recentGames.map((game, index) => ({
      name: game.name,
      hoursPlayed: game.hoursPlayed,
      hoursPlayedNumeric: game.hoursPlayedNumeric,
      lastPlayedShort: game.lastPlayedShort,
      iconUrl: game.iconUrl,
      appId: game.appId,
    }));

    // Preload game images
    const gamesWithImages = await preloadImages(recentGames);

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

async function buildWidgetContent(widget, data, widgetSize) {
  const mainStack = widget.addStack();
  mainStack.layoutHorizontally();

  // Games column
  const gamesColumn = mainStack.addStack();
  gamesColumn.layoutVertically();

  // Header
  const headerStack = gamesColumn.addStack();
  headerStack.layoutHorizontally();
  headerStack.centerAlignContent();

  const titleText = headerStack.addText("Recent Games");
  titleText.font = Font.boldSystemFont(11);
  titleText.textColor = Color.gray();
  titleText.leftAlignText();

  gamesColumn.addSpacer(4);

  // Games list
  for (let i = 0; i < data.recentGames.length; i++) {
    const game = data.recentGames[i];
    addGameToColumn(gamesColumn, game, widgetSize);

    if (i < data.recentGames.length - 1) {
      gamesColumn.addSpacer(2);
    }
  }

  mainStack.addSpacer();
  if (widgetSize !== "small") {
    await addSteamIcon(mainStack, data.totalGames);
  }
}

function addGameToColumn(column, game, widgetSize) {
  const gameStack = column.addStack();
  gameStack.layoutHorizontally();
  gameStack.setPadding(4, 0, 4, 0);

  if (game.img) {
    addGameImage(gameStack, game.img);
    gameStack.addSpacer(8);
  }

  addGameText(gameStack, game, widgetSize);
}

function addGameImage(stack, image) {
  const imageStack = stack.addStack();
  const imageElement = imageStack.addImage(image);
  imageElement.cornerRadius = 8;
  imageStack.centerAlignContent();
}

function addGameText(stack, game, widgetSize) {
  const textStack = stack.addStack();
  textStack.layoutVertically();

  const cleanedName = cleanTitle(game.name);
  const nameText = textStack.addText(cleanedName);

  const detailsStack = textStack.addStack();
  detailsStack.layoutHorizontally();

  const hoursText = detailsStack.addText(formatHours(game.hoursPlayedNumeric));
  detailsStack.addSpacer(8);
  const lastPlayedText = detailsStack.addText(game.lastPlayedShort);

  const fontSizes = CONFIG.WIDGET_SIZES[widgetSize].name;
  nameText.font = Font.systemFont(fontSizes[0]);
  nameText.lineLimit = 1;

  hoursText.font = Font.systemFont(fontSizes[1]);
  hoursText.textColor = new Color("#8f98a0"); // Steam gray

  lastPlayedText.font = Font.systemFont(fontSizes[1]);
  lastPlayedText.textColor = new Color("#66c0f4"); // Steam blue
}

async function addSteamIcon(stack) {
  try {
    const steamImage = await loadImage(CONFIG.STEAM_LOGO_URL);
    if (steamImage) {
      const iconStack = stack.addStack();
      iconStack.layoutVertically();
      iconStack.centerAlignContent();
      const icon = iconStack.addImage(steamImage);
      icon.centerAlignImage();
      icon.cornerRadius = 8;
      icon.imageSize = new Size(25, 25);
      icon.url = "steam://";
      iconStack.centerAlignContent();
    }
  } catch (error) {
    console.error("Failed to load Steam icon:", error);
  }
}

function addFooter(widget) {
  const footer = widget.addStack();
  footer.layoutHorizontally();
  footer.addSpacer();

  const footerTextStack = footer.addStack();
  footerTextStack.backgroundColor = new Color("#b0b0b0", 0.6);
  footerTextStack.cornerRadius = 3;
  footerTextStack.setPadding(2, 4, 2, 4);

  const text = footerTextStack.addText("Steam Activity");
  text.font = Font.mediumSystemFont(9);
  text.color = new Color("#efefef");
  text.rightAlignText();
}

async function preloadImages(games) {
  if (!games || !Array.isArray(games)) return null;

  const imagePromises = games.map(async (game) => {
    if (game.iconUrl) {
      try {
        game.img = await loadImage(game.iconUrl);
      } catch (error) {
        console.warn(`Failed to load image for ${game.name}:`, error);
        game.img = null;
      }
    }
    return game;
  });

  return await Promise.all(imagePromises);
}

async function loadImage(url) {
  if (!url) return null;

  try {
    const request = new Request(url);
    return await request.loadImage();
  } catch (error) {
    console.error(`Error loading image from ${url}:`, error);
    return null;
  }
}

function createErrorWidget(message) {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#1b2838");
  const errorText = widget.addText(`❌ ${message}`);
  errorText.font = Font.italicSystemFont(12);
  errorText.textColor = Color.red();
  return widget;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function cleanTitle(title) {
  if (!title || typeof title !== "string") return "";
  return title.replace(/\(.*?\)/gi, "").trim();
}

function formatHours(hours) {
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

await main();
