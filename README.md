# Spotify Library Curation

A tool to help manage and curate your Spotify music library, starting with duplicate detection in your Liked Songs.

## Features

- 🔍 **Duplicate Detection**: Find duplicate tracks in your Liked Songs
- 💿 **Album Analysis**: Identify albums where most/all tracks are in your Liked Songs (catches Spotify bugs that add entire albums)
- 📅 **Year-based Organization**: Analyze and create playlists based on when songs were added to Liked Songs
- 🎵 **Track Analysis**: Identify duplicates by title, artist, and album
- 📊 **Reports**: Generate detailed reports with options to take action
- 🎯 **Playlist Creation**: Automatically create year-based playlists from your analysis

## Setup

### Prerequisites
- Node.js (v16 or higher)
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
   - Add `http://localhost:3000/callback` to the redirect URIs
   - Copy your Client ID and Client Secret

4. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your Spotify credentials.

5. Run the application:
   ```bash
   npm start
   ```

## Usage

1. Run the app and authenticate with Spotify
2. Choose your analysis type:
   - **Duplicates**: Find duplicate tracks
   - **Albums**: Find albums where most tracks are liked (useful for detecting Spotify bugs)
   - **Years**: Organize tracks by when they were added
3. Review the results
4. For year analysis, create playlists directly from the interface
5. For duplicates and albums, manually review and clean up as needed

## Project Structure

```
├── src/
│   ├── auth/          # Spotify authentication
│   ├── api/           # Spotify API interactions
│   ├── duplicates/    # Duplicate detection logic
│   └── utils/         # Helper functions
├── public/            # Static files for web interface
└── README.md
```
