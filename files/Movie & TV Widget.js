// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: video;

/*
IMDB Widget (Top 3 TV & Movie)
Author: Michael Wagner, michi.onl
 
GitHub: https://github.com/michi-onl/widgets

This Scriptable widget displays the top 3 movies and TV shows from IMDB's charts.
*/

const CONFIG = {
  API_URL: "https://api.michi.onl/api/charts/imdb/tv-movie",
  REFRESH_HOURS: 24,
  COLORS: {
    subtitle: Color.gray(),
    star: Color.yellow(),
    error: Color.red(),
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
    const data = await fetchImdbData();

    if (!data) {
      return createErrorWidget(widget, "No IMDB data available");
    }

    buildWidgetContent(widget, data);
  } catch (error) {
    console.error("Widget creation error:", error);
    return createErrorWidget(widget, "Failed to load IMDB data");
  }

  return widget;
}

async function fetchImdbData() {
  try {
    const request = new Request(CONFIG.API_URL);
    const response = await request.loadJSON();

    return {
      movies: response.movies?.data?.slice(0, 3) || [],
      tvShows:
        widgetSize !== "small"
          ? response.tv_shows?.data?.slice(0, 3) || []
          : [],
    };
  } catch (error) {
    console.error("API fetch error:", error);
    return null;
  }
}

function buildWidgetContent(widget, data) {
  const body = widget.addStack();
  body.layoutHorizontally();

  if (data.movies.length > 0) {
    const moviesColumn = body.addStack();
    moviesColumn.layoutVertically();
    data.movies.forEach((movie) => addMediaItem(moviesColumn, movie));
  }

  if (data.tvShows.length > 0 && widgetSize !== "small") {
    body.addSpacer(10);
    const tvColumn = body.addStack();
    tvColumn.layoutVertically();
    data.tvShows.forEach((show) => addMediaItem(tvColumn, show));
  }

  if (widgetSize === "large") {
    widget.addSpacer();
    addFooter(widget);
  }
}

async function addLogo(stack, imageUrl, size, appUrl, cornerRadius = 0) {
  try {
    const image = await loadImage(imageUrl);
    if (image) {
      const iconStack = stack.addStack();
      iconStack.centerAlignContent();

      const icon = iconStack.addImage(image);
      icon.imageSize = size;
      icon.centerAlignImage();
      icon.url = appUrl;

      if (cornerRadius > 0) {
        icon.cornerRadius = cornerRadius;
      }
    }
  } catch (error) {
    console.error("Logo loading error:", error);
  }
}

function addMediaItem(column, item) {
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
  titleText.font = Font.systemFont(FONT_SIZES[widgetSize].title);

  const subtitleParts = [
    item.year || "Unknown Year",
    item.length || "N/A",
    item.age || "N/A",
  ].filter((part) => part !== "N/A");

  const subtitleText = textStack.addText(subtitleParts.join(", "));
  subtitleText.font = Font.systemFont(FONT_SIZES[widgetSize].subtitle);
  subtitleText.textColor = CONFIG.COLORS.subtitle;

  stack.addSpacer();

  if (item.rating && item.rating !== "N/A") {
    addRatingSection(stack, item.rating);
  }
}

function addRatingSection(stack, rating) {
  const ratingStack = stack.addStack();
  ratingStack.centerAlignContent();

  const star = ratingStack.addImage(SFSymbol.named("star.fill").image);
  star.tintColor = CONFIG.COLORS.star;
  star.imageSize = new Size(
    FONT_SIZES[widgetSize].star,
    FONT_SIZES[widgetSize].star
  );

  ratingStack.addSpacer(2);

  const ratingText = ratingStack.addText(rating);
  ratingText.font = Font.boldSystemFont(FONT_SIZES[widgetSize].rating);
}

function addFooter(widget) {
  const footer = widget.addStack();
  footer.layoutHorizontally();
  footer.addSpacer();

  const footerContainer = footer.addStack();
  footerContainer.backgroundColor = new Color("#b0b0b0", 0.6);
  footerContainer.cornerRadius = 3;
  footerContainer.setPadding(2, 4, 2, 4);

  const footerText = footerContainer.addText("© IMDB");
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
