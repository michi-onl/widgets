// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: signal;

/*
Stats.fm Widget (Top 3 Albums & Tracks)
Author: Michael Wagner, michi.onl

GitHub: https://github.com/michi-onl/widgets

This Scriptable widget displays top tracks and albums from a Spotify user based on data from Stats.fm.
 */

// Configuration
const CONFIG = {
  SPOTIFY_USERNAME: "",
  REFRESH_HOURS: 24,
  API_BASE_URL: "https://api.stats.fm/api/v1",
  SPOTIFY_LOGO_URL:
    "https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png",
  MAX_ITEMS: 3,
  WIDGET_SIZES: {
    small: { name: [9, 8], spacer: 5 },
    medium: { name: [12, 10], spacer: 10 },
    large: { name: [14, 12], spacer: 10 },
  },
};

// Main execution
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

/**
 * Creates the main widget
 * @param {string} widgetSize - The size of the widget (small, medium, large)
 * @returns {Promise<ListWidget>} The configured widget
 */
async function createWidget(widgetSize) {
  const widget = new ListWidget();
  widget.refreshAfterDate = new Date(
    Date.now() + CONFIG.REFRESH_HOURS * 60 * 60 * 1000
  );

  try {
    const data = await fetchAndProcessData(widgetSize);

    if (!data || (!data.track && !data.album)) {
      return createErrorWidget("Found no data.");
    }

    await buildWidgetContent(widget, data, widgetSize);

    if (widgetSize === "large") {
      addFooter(widget);
    }

    return widget;
  } catch (error) {
    console.error("Error creating widget:", error);
    return createErrorWidget("Error loading data.");
  }
}

/**
 * Fetches and processes data from Stats.fm API
 * @param {string} widgetSize - The widget size to determine data requirements
 * @returns {Promise<Object>} Processed data object
 */
async function fetchAndProcessData(widgetSize) {
  const dataPromises = {
    track: fetchChartData("track"),
  };

  // Only fetch album data for medium and large widgets
  if (widgetSize !== "small") {
    dataPromises.album = fetchChartData("album");
  }

  const resolvedData = await Promise.allSettled(Object.values(dataPromises));
  const data = {};

  // Process track data
  if (resolvedData[0].status === "fulfilled" && resolvedData[0].value) {
    data.track = await preloadImages(resolvedData[0].value);
  }

  // Process album data if available
  if (
    resolvedData[1] &&
    resolvedData[1].status === "fulfilled" &&
    resolvedData[1].value
  ) {
    data.album = await preloadImages(resolvedData[1].value);
  }

  return data;
}

/**
 * Builds the main content of the widget
 * @param {ListWidget} widget - The widget to populate
 * @param {Object} data - The processed data
 * @param {string} widgetSize - The widget size
 */
async function buildWidgetContent(widget, data, widgetSize) {
  const mainStack = widget.addStack();
  mainStack.layoutHorizontally();

  const contentTypes = ["track", "album"];
  let addedColumns = 0;

  for (const type of contentTypes) {
    if (data[type] && data[type].length > 0) {
      if (addedColumns > 0) {
        mainStack.addSpacer(CONFIG.WIDGET_SIZES[widgetSize].spacer);
      }

      const column = mainStack.addStack();
      column.layoutVertically();

      for (const item of data[type]) {
        addItemToColumn(column, item, widgetSize);
      }

      addedColumns++;
    }
  }

  mainStack.addSpacer();
  await addSpotifyIcon(mainStack);
}

/**
 * Adds an item (track/album) to a column
 * @param {WidgetStack} column - The column stack to add to
 * @param {Object} item - The item data
 * @param {string} widgetSize - The widget size
 */
function addItemToColumn(column, item, widgetSize) {
  const itemStack = column.addStack();
  itemStack.layoutHorizontally();
  itemStack.setPadding(5, 0, 5, 0);

  if (item.img) {
    addItemImage(itemStack, item.img);
    itemStack.addSpacer(10);
  }

  addItemText(itemStack, item, widgetSize);
}

/**
 * Adds an image to an item stack
 * @param {WidgetStack} stack - The stack to add the image to
 * @param {Image} image - The image to add
 */
function addItemImage(stack, image) {
  const imageStack = stack.addStack();
  const imageElement = imageStack.addImage(image);
  imageElement.cornerRadius = 8;
  imageStack.centerAlignContent();
}

/**
 * Adds text content to an item stack
 * @param {WidgetStack} stack - The stack to add text to
 * @param {Object} item - The item data
 * @param {string} widgetSize - The widget size
 */
function addItemText(stack, item, widgetSize) {
  const textStack = stack.addStack();
  textStack.layoutVertically();

  const cleanedName = cleanTitle(item.name);
  const nameText = textStack.addText(cleanedName);
  const subText = textStack.addText(item.sub);

  const fontSizes = CONFIG.WIDGET_SIZES[widgetSize].name;
  nameText.font = Font.systemFont(fontSizes[0]);
  subText.font = Font.systemFont(fontSizes[1]);
  subText.textColor = Color.gray();
}

/**
 * Adds the Spotify icon to the widget
 * @param {WidgetStack} stack - The stack to add the icon to
 */
async function addSpotifyIcon(stack) {
  try {
    const spotifyImage = await loadImage(CONFIG.SPOTIFY_LOGO_URL);
    if (spotifyImage) {
      const iconStack = stack.addStack();
      const icon = iconStack.addImage(spotifyImage);
      icon.centerAlignImage();
      icon.imageSize = new Size(25, 25);
      icon.url = "spotify://";
      iconStack.centerAlignContent();
    }
  } catch (error) {
    console.error("Failed to load Spotify icon:", error);
  }
}

/**
 * Adds a footer to the widget
 * @param {ListWidget} widget - The widget to add the footer to
 */
function addFooter(widget) {
  const footer = widget.addStack();
  footer.layoutHorizontally();
  footer.addSpacer();

  const footerTextStack = footer.addStack();
  footerTextStack.backgroundColor = new Color("#b0b0b0", 0.6);
  footerTextStack.cornerRadius = 3;
  footerTextStack.setPadding(2, 4, 2, 4);

  const text = footerTextStack.addText("© stats.fm");
  text.font = Font.mediumSystemFont(9);
  text.color = new Color("#efefef");
  text.rightAlignText();
}

/**
 * Fetches chart data from Stats.fm API
 * @param {string} type - The type of data to fetch (track or album)
 * @returns {Promise<Array|null>} Array of chart items or null on error
 */
async function fetchChartData(type) {
  const url = `${CONFIG.API_BASE_URL}/users/${CONFIG.SPOTIFY_USERNAME}/top/${type}s?range=weeks`;

  try {
    const request = new Request(url);
    const response = await request.loadJSON();

    if (!response || !response.items || !Array.isArray(response.items)) {
      console.warn(`Invalid response structure for ${type} data`);
      return null;
    }

    return response.items
      .slice(0, CONFIG.MAX_ITEMS)
      .map((item, index) => formatChartItem(item, type, index));
  } catch (error) {
    console.error(`Error fetching ${type} data:`, error);
    return null;
  }
}

/**
 * Formats a chart item for display
 * @param {Object} item - The raw API item
 * @param {string} type - The item type (track or album)
 * @param {number} index - The item index
 * @returns {Object} Formatted item
 */
function formatChartItem(item, type, index) {
  const itemData = item[type];

  return {
    imgSrc: getImageUrl(itemData, type),
    name: itemData?.name || `Unknown ${type} ${index + 1}`,
    sub: `${formatNumber(item.streams || 0)} Streams`,
  };
}

/**
 * Gets the image URL for an item
 * @param {Object} itemData - The item data
 * @param {string} type - The item type
 * @returns {string|null} The image URL or null
 */
function getImageUrl(itemData, type) {
  if (!itemData) return null;

  // Direct image property
  if (itemData.image) return itemData.image;

  // Album images for tracks
  if (type === "track" && itemData.albums?.[0]?.image) {
    return itemData.albums[0].image;
  }

  return null;
}

/**
 * Preloads images for chart items
 * @param {Array} items - Array of items with imgSrc properties
 * @returns {Promise<Array>} Items with loaded images
 */
async function preloadImages(items) {
  if (!items || !Array.isArray(items)) return null;

  const imagePromises = items.map(async (item) => {
    if (item.imgSrc) {
      try {
        item.img = await loadImage(item.imgSrc);
      } catch (error) {
        console.warn(`Failed to load image for ${item.name}:`, error);
        item.img = null;
      }
    }
    return item;
  });

  return await Promise.all(imagePromises);
}

/**
 * Loads an image from a URL
 * @param {string} url - The image URL
 * @returns {Promise<Image|null>} The loaded image or null on error
 */
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

/**
 * Creates an error widget
 * @param {string} message - The error message to display
 * @returns {ListWidget} The error widget
 */
function createErrorWidget(message) {
  const widget = new ListWidget();
  const errorText = widget.addText(message);
  errorText.font = Font.italicSystemFont(10);
  errorText.textColor = Color.red();
  return widget;
}

/**
 * Capitalizes the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} The capitalized string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Cleans track/album titles by removing feature annotations
 * @param {string} title - The title to clean
 * @returns {string} The cleaned title
 */
function cleanTitle(title) {
  if (!title || typeof title !== "string") return "";
  return title.replace(/\(feat\. .*?\)/gi, "").trim();
}

/**
 * Formats numbers with appropriate suffixes
 * @param {number} num - The number to format
 * @returns {string} The formatted number
 */
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

// Execute main function
await main();
