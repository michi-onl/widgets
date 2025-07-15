// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: signal;

/*
Stats.fm Widget (Top 3 Albums & Tracks)
Author: Michael Wagner, michi.onl

GitHub: https://github.com/michi-onl/widgets

This Scriptable widget displays the top three tracks and albums from a Stats.fm user account, based on Spotify and Apple Music data gathered from Stats.fm.
 */

const CONFIG = {
  USER_ID: "31mckhdwyvws5yaem2j3jhku636y",
  API_BASE_URL: "https://api.stats.fm/api/v1",
  STATSFM_LOGO_URL:
    "https://cdn.brandfetch.io/idOZib4c5s/w/180/h/180/theme/dark/logo.png?c=1dxbfHSJFAPEGdCLU4o5B",
  REFRESH_HOURS: 24,
  MAX_ITEMS: 3,
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

async function fetchAndProcessData(widgetSize) {
  const dataPromises = {
    track: fetchChartData("track"),
  };

  if (widgetSize !== "small") {
    dataPromises.album = fetchChartData("album");
  }

  const resolvedData = await Promise.allSettled(Object.values(dataPromises));
  const data = {};

  if (resolvedData[0].status === "fulfilled" && resolvedData[0].value) {
    data.track = await preloadImages(resolvedData[0].value);
  }

  if (
    resolvedData[1] &&
    resolvedData[1].status === "fulfilled" &&
    resolvedData[1].value
  ) {
    data.album = await preloadImages(resolvedData[1].value);
  }

  return data;
}

async function buildWidgetContent(widget, data, widgetSize) {
  const mainStack = widget.addStack();
  mainStack.layoutHorizontally();

  const contentTypes = ["track", "album"];
  const columnTitles = { track: "Songs", album: "Albums" };
  let addedColumns = 0;

  for (const type of contentTypes) {
    if (data[type] && data[type].length > 0) {
      if (addedColumns > 0) {
        mainStack.addSpacer(CONFIG.WIDGET_SIZES[widgetSize].spacer);
      }

      const column = mainStack.addStack();
      column.layoutVertically();

      const titleText = column.addText(columnTitles[type]);
      titleText.font = Font.boldSystemFont(11);
      titleText.textColor = Color.gray();
      titleText.leftAlignText();
      column.addSpacer(4);

      for (const item of data[type]) {
        addItemToColumn(column, item, widgetSize);
      }

      addedColumns++;
    }
  }

  mainStack.addSpacer();
  await addStatsfmIcon(mainStack);
}

function addItemToColumn(column, item, widgetSize) {
  const itemStack = column.addStack();
  itemStack.layoutHorizontally();
  itemStack.setPadding(4, 0, 4, 0);

  if (item.img) {
    addItemImage(itemStack, item.img);
    itemStack.addSpacer(8);
  }

  addItemText(itemStack, item, widgetSize);
}

function addItemImage(stack, image) {
  const imageStack = stack.addStack();
  const imageElement = imageStack.addImage(image);
  imageElement.cornerRadius = 8;
  imageStack.centerAlignContent();
}

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

async function addStatsfmIcon(stack) {
  try {
    const statsfmImage = await loadImage(CONFIG.STATSFM_LOGO_URL);
    if (statsfmImage) {
      const iconStack = stack.addStack();
      const icon = iconStack.addImage(statsfmImage);
      icon.centerAlignImage();
      icon.imageSize = new Size(25, 25);
      icon.url = "statsfm://";
      iconStack.centerAlignContent();
    }
  } catch (error) {
    console.error("Failed to load Statsfm icon:", error);
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

  const text = footerTextStack.addText("© stats.fm");
  text.font = Font.mediumSystemFont(9);
  text.color = new Color("#efefef");
  text.rightAlignText();
}

async function fetchChartData(type) {
  const url = `${CONFIG.API_BASE_URL}/users/${CONFIG.USER_ID}/top/${type}s?range=weeks`;

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

function formatChartItem(item, type, index) {
  const itemData = item[type];

  return {
    imgSrc: getImageUrl(itemData, type),
    name: itemData?.name || `Unknown ${type} ${index + 1}`,
    sub: `${formatNumber(item.streams || 0)} Streams`,
  };
}

function getImageUrl(itemData, type) {
  if (!itemData) return null;

  if (itemData.image) return itemData.image;

  if (type === "track" && itemData.albums?.[0]?.image) {
    return itemData.albums[0].image;
  }

  return null;
}

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
  const errorText = widget.addText(message);
  errorText.font = Font.italicSystemFont(10);
  errorText.textColor = Color.red();
  return widget;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function cleanTitle(title) {
  if (!title || typeof title !== "string") return "";
  return title.replace(/\(feat\. .*?\)/gi, "").trim();
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

await main();
