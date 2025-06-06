# iOS Widgets for Scriptable

This repository contains custom widgets for the [Scriptable](https://scriptable.app/) app, designed to enhance your iOS home screen with dynamic content. Both widgets are fully customizable and fetch data from external APIs to display relevant information.

---

## Widgets

### 1. Spotify Month Widget

**Description**:  
Displays the top 3 tracks and albums from your Spotify account, powered by data from [Stats.fm](https://stats.fm/).

**Features**:

- Shows top tracks and albums with album art.
- Displays the number of streams for each item.
- Automatically refreshes every 24 hours.
- Includes a Spotify logo with a direct link to the Spotify app.

**Configuration**:

- Update the `SPOTIFY_USERNAME` in the `CONFIG` object with your Spotify Username.

### 2. Movie & TV Widget

**Description**:  
Displays the top 3 movies and TV shows from IMDB's most popular charts.

**Features**:

- Shows movie and TV show titles, release years, and ratings.
- Automatically refreshes every 24 hours.
- Displays star ratings with a visual star icon.
- Includes clickable links to open items in the IMDB app.

### 3. Currently Reading Widget

**Description**:  
Presents data of a book, which is defined by the ISBN number specified in the widget’s settings.

**Features**:

- Shows cover and metadata of the provided ISBN-10 number.

**Configuration**:

- Update the Parameter of the widget following steps 6. to 8. in the Installation below to update the widget with your ISBN-10 number.

### 4. Billboard 200 Widget

**Description**:  
Displays the top 6 albums from the Billboard 200 album chart.

**Features**:

- Responsive to Widget Size
- Colored Position Change Tracking
- Automatic Data Refresh

---

## Requirements

- [Scriptable](https://scriptable.app/) app installed on your iOS device.
- Spotify Username and Stats.fm account (via Stats.fm) and IMDB data.

## Installation

### Setup in Scriptable:

1. Copy one of the `.js` files from `/files` into Scriptable.

### Place it on the Home Screen

1. Long press on an app on the home screen
2. Select "Edit Home Screen"
3. Tap the "+" at the top
4. Scroll down to find "Scriptable"
5. Select desired widget size
6. Tap the new widget
7. Select this script
8. Configure parameters if needed

Note: **Several widgets can be placed** on the home screen
and configured individually!

---

## License

The widgets are licensed under the Unlicense.
