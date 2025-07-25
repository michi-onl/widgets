// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-brown; icon-glyph: book-open;
/*
Currently Reading Widget
Author: Michael Wagner, michi.onl

GitHub für Updates:
https://github.com/michi-onl/widgets

The Scriptable widget presents data of a book, which is defined by the ISBN-10 number specified in the widget’s settings.
*/

const CONFIG = {
  defaultIsbn: 9780099518471,
  refreshHours: 24,
  apiUrl: "https://www.googleapis.com/books/v1/volumes?q=isbn:",
  goodreadsIconUrl:
    "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/42/d8/cd/42d8cdbf-48df-d1b6-ade9-d972bac7f371/PolarisAppIcon-0-0-1x_U007epad-0-1-0-85-220.png/1024x1024bb.jpg",
};

const COLORS = {
  gray: Color.gray(),
  lightGray: Color.lightGray(),
  socketLeft: new Color("#a0a0a0", 0.6),
  socketRight: new Color("#b0b0b0", 0.6),
  socketText: new Color("#efefef"),
};

const FONTS = {
  title: Font.boldSystemFont(14),
  authors: Font.mediumSystemFont(12),
  info: Font.regularSystemFont(10),
  socket: Font.mediumSystemFont(9),
  error: Font.italicSystemFont(10),
};

const LANGUAGE_MAP = {
  es: "Spanish 🇪🇸",
  en: "English 🇺🇸",
  de: "German 🇩🇪",
};

const MATURITY_MAP = {
  NOT_MATURE: "4+",
  MATURE: "18+",
};

class BookWidget {
  constructor() {
    this.widgetSize = config.widgetFamily || "medium";
    this.isbn = args.widgetParameter || CONFIG.defaultIsbn;
  }

  async run() {
    const widget = await this.createWidget();

    if (!config.runInWidget) {
      await this.presentWidget(widget);
    }

    Script.setWidget(widget);
    Script.complete();
  }

  async presentWidget(widget) {
    const presentMethods = {
      small: () => widget.presentSmall(),
      medium: () => widget.presentMedium(),
      large: () => widget.presentLarge(),
    };

    await presentMethods[this.widgetSize]();
  }

  async createWidget() {
    const list = new ListWidget();
    this.setRefreshDate(list);

    const bookData = await this.getBookData(this.isbn);

    if (!bookData) {
      return this.createErrorWidget(list, "Keine ISBN Daten gefunden.");
    }

    if (bookData === false) {
      return this.createErrorWidget(list, "Fehler beim Laden der ISBN Daten.");
    }

    return this.createBookWidget(list, bookData);
  }

  setRefreshDate(widget) {
    const nextRefresh = Date.now() + 1000 * 60 * 60 * CONFIG.refreshHours;
    widget.refreshAfterDate = new Date(nextRefresh);
  }

  createErrorWidget(list, message) {
    const errorMessage = list.addText(message);
    errorMessage.font = FONTS.error;
    return list;
  }

  async createBookWidget(list, bookData) {
    const body = list.addStack();
    body.layoutHorizontally();

    const columns = this.createColumns(body);
    await this.addGoodreadsIcon(body);
    await this.addBookCover(columns, bookData);
    this.addBookInfo(columns, bookData);

    if (this.widgetSize === "large") {
      this.addFooter(list);
    }

    return list;
  }

  createColumns(body) {
    const columns = [];
    columns[0] = body.addStack();
    columns[0].layoutVertically();

    const spacerSize = this.widgetSize === "small" ? null : 15;
    body.addSpacer(spacerSize);

    columns[1] = body.addStack();
    columns[1].layoutVertically();

    return columns;
  }

  async addGoodreadsIcon(body) {
    body.addSpacer();

    const goodreadsImage = await this.loadImage(CONFIG.goodreadsIconUrl);
    if (goodreadsImage) {
      const iconStack = body.addStack();
      const icon = iconStack.addImage(goodreadsImage);

      icon.cornerRadius = 8;
      icon.centerAlignImage();
      icon.imageSize = new Size(25, 25);
      icon.url = "goodreads://";
      iconStack.centerAlignContent();
    }
  }

  async addBookCover(columns, bookData) {
    if (!bookData.thumbnail) return;

    const columnIndex = this.widgetSize === "small" ? 1 : 0;
    const coverImage = await this.loadImage(bookData.thumbnail);

    if (coverImage) {
      const coverStack = columns[columnIndex].addStack();
      const cover = coverStack.addImage(coverImage);

      cover.cornerRadius = 8;
      cover.centerAlignImage();
      coverStack.centerAlignContent();

      if (this.widgetSize === "large") {
        cover.imageSize = new Size(80, 120);
      }
    }
  }

  addBookInfo(columns, bookData) {
    this.addTitle(columns[1], bookData.title);
    this.addAuthors(columns[1], bookData.authors);

    if (this.widgetSize !== "small") {
      this.addPublisherInfo(columns[1], bookData);
      this.addPageInfo(columns[1], bookData);
    }
  }

  addTitle(column, title) {
    const titleText = column.addText(title);
    titleText.font = FONTS.title;
  }

  addAuthors(column, authors) {
    if (!authors) return;

    const authorsText = column.addText(authors);
    authorsText.font = FONTS.authors;
    authorsText.textColor = COLORS.gray;
  }

  addPublisherInfo(column, bookData) {
    const publisherInfo = column.addText(
      `${bookData.publisher}, ${
        bookData.publishedDate
      }, ${this.getLanguageDisplay(bookData.language)}`
    );
    publisherInfo.font = FONTS.info;
    publisherInfo.textColor = COLORS.lightGray;
  }

  addPageInfo(column, bookData) {
    const pageInfo = column.addText(
      `${bookData.pageCount} Pages, ${
        bookData.categories
      }, ${this.getMaturityRating(bookData.maturityRating)}`
    );
    pageInfo.font = FONTS.info;
    pageInfo.textColor = COLORS.lightGray;
  }

  addFooter(list) {
    const socket = list.addStack();
    socket.layoutHorizontally();

    this.addFooterButton(
      socket,
      "Goodreads öffnen",
      "goodreads://",
      COLORS.socketLeft
    );
    socket.addSpacer();
    this.addFooterButton(
      socket,
      "Daten von Google Books",
      "https://books.google.com/",
      COLORS.socketRight,
      true
    );
  }

  addFooterButton(container, text, url, backgroundColor, rightAlign = false) {
    const buttonStack = container.addStack();
    buttonStack.backgroundColor = backgroundColor;
    buttonStack.cornerRadius = 3;
    buttonStack.setPadding(2, 4, 2, 4);

    const buttonText = buttonStack.addText(text);
    buttonText.url = url;
    buttonText.font = FONTS.socket;
    buttonText.color = COLORS.socketText;

    if (rightAlign) {
      buttonText.rightAlignText();
    }
  }

  async getBookData(isbn) {
    const url = `${CONFIG.apiUrl}${isbn}`;

    try {
      const request = new Request(url);
      const response = await request.loadJSON();

      if (!response || response.totalItems === 0) {
        return null;
      }

      return this.parseBookData(response.items[0].volumeInfo);
    } catch (error) {
      console.error(`Error fetching book data: ${error}`);
      return false;
    }
  }

  parseBookData(book) {
    return {
      title: book.title || "Unknown Title",
      authors: book.authors ? book.authors.join(", ") : "Unknown Author",
      publisher: book.publisher || "Unknown Publisher",
      publishedDate: book.publishedDate || "Unknown Date",
      pageCount: book.pageCount || "Unknown",
      categories: book.categories
        ? book.categories.join(", ")
        : "Uncategorized",
      maturityRating: book.maturityRating || "Uncategorized",
      language: book.language || "Unknown Language",
      thumbnail: book.imageLinks ? book.imageLinks.thumbnail : null,
    };
  }

  getLanguageDisplay(languageCode) {
    return ` ${LANGUAGE_MAP[languageCode] || languageCode}`;
  }

  getMaturityRating(maturityRating) {
    return MATURITY_MAP[maturityRating] || maturityRating;
  }

  async loadImage(url) {
    try {
      const request = new Request(url);
      return await request.loadImage();
    } catch (error) {
      console.error(`Error loading image: ${error}`);
      return null;
    }
  }
}

const bookWidget = new BookWidget();
await bookWidget.run();
