# iOS Widgets for Scriptable

Customizable widgets for the [Scriptable](https://scriptable.app/) app that display data from various services on your iOS home screen.

![Screenshot of widgets on MacOS](images/desktop.png)

## Available Widgets

**Stats.fm Widget** - Shows your top 3 tracks and albums from Spotify/Apple Music  
**Movie & TV Widget** - Displays IMDB's most popular movies and TV shows  
**Billboard 200 Widget** - Lists the top 6 albums from Billboard 200  
**Steam Widget** - Shows your recent Steam gaming activity  
**Currently Reading Widget** - Displays book information using ISBN lookup

## Quick Setup

### 1. Install Scriptable

Download [Scriptable](https://scriptable.app/) from the App Store (free)

### 2. Add the Widget

1. Copy the `.js` file you want into Scriptable
2. Long press your home screen → **Edit**
3. Tap **Add Widget** → Find **Scriptable** → Choose widget size
4. Tap the new widget → Select your script

### 3. Configure (Optional)

For personalized widgets, edit these values in the script:

- **Stats.fm**: Change `userId` to your Stats.fm user ID
- **Steam**: Change `username` to your Steam username
- **Currently Reading**: Add your book's ISBN-10 as widget parameter

## License

Released under the Unlicense - use and modify as needed.

## Notes

These widgets call external APIs and display the returned data, but can break at any time.
