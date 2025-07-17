# Spotify Library Curation

I created this tool because I had a problem that is probably common to many people who've been using Spotify for a long time - their "Liked" songs playlist has gotten too big to be useful. In particular, as Spotify has evolved, its approach to album management has changed - at one point, instead of "adding an album to your library", it just added all tracks from it to your liked songs list. After over a decade, my "Liked songs" playlist had over 9000 tracks in it, including duplicates from different releases of albums - it was getting crazy!

So I used Copilot in agent mode (using Claude Sonnet 4) to help put this together. It doesn't do all the work for you - you still need to make your decisions about how you want to manage this playlist - but it really helps with the trudgery of cleaning up a massive playlist.

My "Liked songs" now has a svelte 1600, helping ensure that when I shuffle it, it'll be songs I _actually_ like, rather than songs from albums I wanted to try out once and then forgot about.

## ✨ Features

### 🔍 **Duplicate Detection**
- Find duplicate tracks in your Liked Songs with smart matching
- Remove duplicates while keeping the most recently added version
- Bulk cleanup with safety confirmations

### 💿 **Advanced Album Analysis**
- Identify albums where most/all tracks are in your Liked Songs
- **Smart Library Integration**: Distinguishes between albums in your library vs. individual liked tracks
- **Filtering System**: Filter by percentage of tracks liked (e.g., 75%+ complete albums)
- **Library Status Filtering**: Show only albums in library, not in library, or both

### 📚 **Intelligent Album Management**
- **Add to Library**: Automatically add albums to your library
- **Smart Removal**: Remove individual tracks while preserving full albums in library
- **Bulk Operations**: Process multiple albums with different strategies:
  - Add selected albums to library only
  - Remove from liked songs with library addition
  - Remove from liked songs without library addition
  - Add to library then remove from liked songs

### 📅 **Year-based Organization**
- Analyze tracks by when they were added to Liked Songs
- Create year-based playlists automatically
- See trends in your music discovery over time

### ⚡ **Performance & Caching**
- **24-hour file-based cache** for liked songs data
- **Manual cache refresh** when you've made changes
- Handles large libraries efficiently (tested with 9,000+ tracks)
- Network resilience with exponential backoff and retry logic

### 🎯 **Smart Filtering & Bulk Actions**
- **Advanced filtering**: Filter albums by completion percentage and library status
- **Selective operations**: Use checkboxes to process specific albums
- **Confirmation dialogs**: See exactly what will happen before taking action
- **Progress feedback**: Real-time status updates during operations

## 🚀 Setup

### Prerequisites
- Node.js (v18 or higher)
- A Spotify account
- Spotify Developer App credentials

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a Spotify App:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new app
   - Add `http://127.0.0.1:3000/callback` to the redirect URIs
   - Note: You'll need the following scopes:
     - `user-library-read` - Read your saved albums and tracks
     - `user-library-modify` - Add/remove albums from your library
     - `playlist-modify-public` - Create year-based playlists
     - `playlist-modify-private` - Create private playlists

4. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your Spotify credentials:
   ```
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   REDIRECT_URI=http://localhost:3000/callback
   ```

5. Run the application:
   ```bash
   npm start
   ```

## 📖 Usage Guide

### Getting Started
1. Run the app and authenticate with Spotify
2. Your liked songs will be cached for 24 hours for faster subsequent analysis
3. Choose your analysis type from the dashboard

### 🔍 Duplicate Analysis
- Click "Scan for Duplicates" to find duplicate tracks
- Review results showing duplicate groups with track details
- Use "Remove Duplicates (Keep Most Recent)" for automatic cleanup
- Manually review and remove specific duplicates as needed

### 💿 Album Analysis Workflow

#### Step 1: Run Analysis
- Click "Analyze Albums" to find albums with multiple liked tracks
- Excludes two-track releases automatically (to avoid singles and small EPs)

#### Step 2: Use Advanced Filtering
- **Set percentage threshold**: e.g., 100% for complete albums, 75% for mostly complete
- **Choose library filter**:
  - "Show All Albums" - See everything
  - "📂 Not in Library Only" - Find albums to add to your library
  - "📚 In Library Only" - Find albums already saved

#### Step 3: Take Action
Choose from several bulk actions:

**📚 Add Albums to Library** (for albums not in library)
- Adds full albums to your Spotify library
- Keeps individual tracks in liked songs

**🗑️ Remove Albums (Add to Library First)** ⭐ *Recommended*
- Adds albums to library, then removes individual tracks
- Result: Clean liked songs + full albums in library

**🗑️ Remove Albums (No Library Addition)**
- Only removes tracks from liked songs
- Use when you don't want the full album

**Individual Album Actions:**
- ➕ Add to Library - Add single albums
- 🗑️ Smart Remove - Context-aware removal
- 🚫 Remove Only - Remove without adding to library

#### Step 4: Selective Processing
- Use checkboxes to select specific albums
- "🎯 Remove Selected Albums" - Basic removal
- "📚🗑️ Add to Library & Remove Selected Albums" - Smart workflow

### 📅 Year Analysis
- Click "Analyze by Year" to see when tracks were added
- Create year-based playlists directly from the interface
- Great for nostalgic listening and understanding your music journey

### ⚡ Cache Management
- Cache is automatically created and lasts 24 hours
- Use "Clear Cache & Refresh Data" if you've recently:
  - Added/removed many liked songs
  - Want to ensure latest data
  - Experiencing outdated results

## 🛠 Project Structure

```
├── src/
│   └── index.js           # Main server with all API endpoints
├── public/
│   ├── index.html         # Landing page
│   └── dashboard.html     # Main application interface
├── cache/                 # File-based cache (auto-created)
├── package.json
└── README.md
```

## 💡 Pro Tips

1. **Start with Album Analysis**: Most users find this the most useful feature
2. **Use 100% filter first**: Find complete albums that should be in your library
3. **Smart workflow**: Filter → Review → Add to Library & Remove from Liked Songs
4. **Regular maintenance**: Run monthly to keep your library organized
5. **Cache refresh**: Clear cache after major library changes

## 🤝 Contributing

Feel free to submit issues and enhancement requests!
