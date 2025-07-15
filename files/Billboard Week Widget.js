// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: pink; icon-glyph: music;

/*
Billboard Widget (Top 6 Albums USA)
Author: Michael Wagner, michi.onl
 
GitHub: https://github.com/michi-onl/widgets

This Scriptable widget displays the top 6 albums from Billboard's 200 albums charts.
*/

const CONFIG = {
  API_URL: "https://api.michi.onl/api/charts/billboard/billboard-200",
  REFRESH_HOURS: 24,
  COLORS: {
    subtitle: Color.gray(),
    error: Color.red(),
    new: Color.orange(),
    up: Color.green(),
    down: Color.red(),
    same: Color.gray(),
  },
};

const FONT_SIZES = {
  small: { title: 9, subtitle: 8, rating: 9, star: 9 },
  medium: { title: 12, subtitle: 10, rating: 12, star: 12 },
  large: { title: 14, subtitle: 12, rating: 14, star: 14 },
};

const widgetSize = config.widgetFamily || "medium";
const widget = await createWidget();

if (!config.runInWidget) {
  const presentMethod = `present${
    widgetSize.charAt(0).toUpperCase() + widgetSize.slice(1)
  }`;
  await widget[presentMethod]();
}

Script.setWidget(widget);
Script.complete();

async function createWidget() {
  const widget = new ListWidget();
  widget.refreshAfterDate = new Date(
    Date.now() + 1000 * 60 * 60 * CONFIG.REFRESH_HOURS
  );

  try {
    const data = await fetchBillboardData();

    if (!data || !data.albums || data.albums.length === 0) {
      return createErrorWidget(widget, "No Billboard data available");
    }

    buildWidgetContent(widget, data);
  } catch (error) {
    console.error("Widget creation error:", error);
    return createErrorWidget(widget, "Failed to load Billboard data");
  }

  return widget;
}

async function fetchBillboardData() {
  try {
    console.log("Fetching data from:", CONFIG.API_URL);
    const request = new Request(CONFIG.API_URL);
    request.timeoutInterval = 10;
    const response = await request.loadJSON();

    console.log("API Response:", JSON.stringify(response, null, 2));

    return {
      albums: response.music?.data || response.data || response.albums || [],
    };
  } catch (error) {
    console.error("API fetch error:", error);
    return null;
  }
}

function buildWidgetContent(widget, data) {
  const body = widget.addStack();
  body.layoutVertically();

  const chartTitle = body.addText("Albums");
  chartTitle.font = Font.boldSystemFont(11);
  chartTitle.textColor = Color.gray();
  body.addSpacer(2);

  const container = body.addStack();
  container.layoutHorizontally();

  if (data.albums.length > 0) {
    const firstColumn = container.addStack();
    firstColumn.layoutVertically();

    const firstThreeAlbums = data.albums.slice(0, 3);
    firstThreeAlbums.forEach((album, index) =>
      addMediaItem(firstColumn, album, index)
    );
  }

  if (data.albums.length > 3 && widgetSize !== "small") {
    container.addSpacer(10);
    const secondColumn = container.addStack();
    secondColumn.layoutVertically();

    const nextThreeAlbums = data.albums.slice(3, 6);
    nextThreeAlbums.forEach((album, index) =>
      addMediaItem(secondColumn, album, index + 3)
    );
  }

  if (widgetSize === "large") {
    widget.addSpacer();
    addFooter(widget);
  }
}

function addMediaItem(column, item, currentIndex) {
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
  const iconColor = Color.gray();

  const titleIcon = titleRow.addImage(SFSymbol.named(iconSymbol).image);
  titleIcon.tintColor = iconColor;
  titleIcon.imageSize = new Size(
    FONT_SIZES[widgetSize].title,
    FONT_SIZES[widgetSize].title
  );

  titleRow.addSpacer(4);

  const titleText = titleRow.addText(
    item.title || item.name || "Unknown Title"
  );
  titleText.font = Font.systemFont(FONT_SIZES[widgetSize].title);

  const subtitleParts = [
    item.artist || "Unknown Artist",
    item.weeks ? `${item.weeks} wks` : null,
  ].filter((part) => part !== null);

  const subtitleText = textStack.addText(subtitleParts.join(" • "));
  subtitleText.font = Font.systemFont(FONT_SIZES[widgetSize].subtitle);
  subtitleText.textColor = CONFIG.COLORS.subtitle;

  stack.addSpacer();

  if (item.before !== undefined) {
    addPositionChangeSection(stack, item.before, currentIndex);
  }
}

function addPositionChangeSection(stack, beforePosition, currentIndex) {
  const changeStack = stack.addStack();
  changeStack.centerAlignContent();

  let symbol, color;

  if (beforePosition === 0) {
    symbol = "plus.circle";
    color = CONFIG.COLORS.new;
  } else {
    const currentPosition = currentIndex + 1;
    if (currentPosition < beforePosition) {
      symbol = "arrow.up.circle";
      color = CONFIG.COLORS.up;
    } else if (currentPosition > beforePosition) {
      symbol = "arrow.down.circle";
      color = CONFIG.COLORS.down;
    } else {
      symbol = "minus.circle";
      color = CONFIG.COLORS.same;
    }
  }

  const changeIcon = changeStack.addImage(SFSymbol.named(symbol).image);
  changeIcon.tintColor = color;
  changeIcon.imageSize = new Size(
    FONT_SIZES[widgetSize].star,
    FONT_SIZES[widgetSize].star
  );
}

function addFooter(widget) {
  const footer = widget.addStack();
  footer.layoutHorizontally();
  footer.addSpacer();

  const footerContainer = footer.addStack();
  footerContainer.backgroundColor = new Color("#b0b0b0", 0.6);
  footerContainer.cornerRadius = 3;
  footerContainer.setPadding(2, 4, 2, 4);

  const footerText = footerContainer.addText("© Billboard");
  footerText.font = Font.mediumSystemFont(9);
  footerText.color = new Color("#efefef");
}

function createErrorWidget(widget, message) {
  const errorText = widget.addText(message);
  errorText.font = Font.italicSystemFont(12);
  errorText.textColor = CONFIG.COLORS.error;
  return widget;
}

async function loadImage(url) {
  try {
    const request = new Request(url);
    return await request.loadImage();
  } catch (error) {
    console.error(`Failed to load image from ${url}:`, error);
    return null;
  }
}
