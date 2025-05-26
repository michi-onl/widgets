// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: video;

/************************************************
Top 3 Movies & TV Shows (IMDB)
Updated for Next.js API endpoint
v2.0.0

This Scriptable widget displays the top 3 movies and TV shows 
from IMDB's most popular charts.

Installation:
1. Long press on an app on the home screen
2. Select "Edit Home Screen"
3. Tap the "+" at the top
4. Scroll down to find "Scriptable"
5. Select desired widget size
6. Tap the new widget
7. Select this script
8. Configure parameters if needed
************************************************/

// Configuration
const CONFIG = {
  // Your API endpoint URL - UPDATE THIS TO YOUR DOMAIN
  API_URL: "https://api.michi.onl/api/v1/imdb",

  // Refresh interval in hours
  REFRESH_HOURS: 24,

  // Widget appearance
  COLORS: {
    background: null, // Use system default
    text: Color.white(),
    subtitle: Color.gray(),
    star: Color.yellow(),
    error: Color.red(),
  },
};

// Font sizes for different widget sizes
const FONT_SIZES = {
  small: { title: 9, subtitle: 8, rating: 9, star: 9 },
  medium: { title: 12, subtitle: 10, rating: 12, star: 12 },
  large: { title: 14, subtitle: 12, rating: 14, star: 14 },
};

// Main execution
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

/**
 * Creates and configures the main widget
 */
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

/**
 * Fetches data from the IMDB API endpoint
 */
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

/**
 * Builds the main widget content
 */
function buildWidgetContent(widget, data) {
  const body = widget.addStack();
  body.layoutHorizontally();

  // Add movies column
  if (data.movies.length > 0) {
    const moviesColumn = body.addStack();
    moviesColumn.layoutVertically();
    data.movies.forEach((movie) => addMediaItem(moviesColumn, movie));
  }

  // Add TV shows column (medium and large widgets only)
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

/**
 * Adds a logo to the specified stack
 */
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

/**
 * Adds a media item (movie or TV show) to the widget
 */
function addMediaItem(column, item) {
  const stack = column.addStack();
  stack.layoutHorizontally();
  stack.setPadding(4, 0, 4, 0);
  stack.centerAlignContent();

  // Set click URL if href is available
  if (item.href && item.href !== "N/A") {
    stack.url = `imdb://m.imdb.com${item.href}`;
  }

  // Text content
  const textContainer = stack.addStack();
  const textStack = textContainer.addStack();
  textStack.layoutVertically();
  textContainer.addSpacer();

  // Title
  const titleText = textStack.addText(item.title || "Unknown Title");
  titleText.font = Font.systemFont(FONT_SIZES[widgetSize].title);

  // Subtitle (year, length, age rating)
  const subtitleParts = [
    item.year || "Unknown Year",
    item.length || "N/A",
    item.age || "N/A",
  ].filter((part) => part !== "N/A");

  const subtitleText = textStack.addText(subtitleParts.join(", "));
  subtitleText.font = Font.systemFont(FONT_SIZES[widgetSize].subtitle);
  subtitleText.textColor = CONFIG.COLORS.subtitle;

  stack.addSpacer();

  // Rating with star
  if (item.rating && item.rating !== "N/A") {
    addRatingSection(stack, item.rating);
  }
}

/**
 * Adds the rating section with star icon
 */
function addRatingSection(stack, rating) {
  const ratingStack = stack.addStack();
  ratingStack.centerAlignContent();

  // Star icon
  const star = ratingStack.addImage(SFSymbol.named("star.fill").image);
  star.tintColor = CONFIG.COLORS.star;
  star.imageSize = new Size(
    FONT_SIZES[widgetSize].star,
    FONT_SIZES[widgetSize].star
  );

  ratingStack.addSpacer(2);

  // Rating number
  const ratingText = ratingStack.addText(rating);
  ratingText.font = Font.boldSystemFont(FONT_SIZES[widgetSize].rating);
}

/**
 * Adds footer to large widgets
 */
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

/**
 * Creates an error widget with the specified message
 */
function createErrorWidget(widget, message) {
  const errorText = widget.addText(message);
  errorText.font = Font.italicSystemFont(12);
  errorText.textColor = CONFIG.COLORS.error;
  return widget;
}

/**
 * Loads an image from URL with error handling
 */
async function loadImage(url) {
  try {
    const request = new Request(url);
    return await request.loadImage();
  } catch (error) {
    console.error(`Failed to load image from ${url}:`, error);
    return null;
  }
}
