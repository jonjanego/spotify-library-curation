# Getting Started with Spotify Library Curation

## Step 1: Set up Spotify Developer App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create an App"
3. Fill in the details:
   - App name: "Spotify Library Curation" (or any name you prefer)
   - App description: "Tool to find duplicates in my music library"
   - Redirect URI: `http://localhost:3000/callback`
4. Copy your **Client ID** and **Client Secret**

## Step 2: Configure Environment Variables

Edit the `.env` file in this project and replace the placeholder values:

```bash
SPOTIFY_CLIENT_ID=your_actual_client_id_here
SPOTIFY_CLIENT_SECRET=your_actual_client_secret_here
REDIRECT_URI=http://localhost:3000/callback
PORT=3000
```

## Step 3: Run the Application

```bash
npm start
```

The app will automatically open in your browser at `http://localhost:3000`

## Step 4: Use the App

1. Click "Connect to Spotify" on the homepage
2. Log in to your Spotify account and authorize the app
3. Click "Scan for Duplicates" on the dashboard
4. Wait for the scan to complete (this may take a few minutes for large libraries)
5. Review the duplicate results

## What the App Does

- **Fetches all your Liked Songs**: Uses Spotify's API to get your entire Liked Songs playlist
- **Finds Duplicates**: Compares tracks by name and artist to identify duplicates
- **Shows Results**: Displays groups of duplicate tracks with album art and details
- **Respects Rate Limits**: Includes delays to stay within Spotify's API limits

## Next Steps

Once you've identified duplicates, you can manually remove them from your Spotify Liked Songs. Future versions could include automatic removal features.

## Security Note

This app only reads your Liked Songs and doesn't modify anything without your permission. Your Spotify credentials are stored locally in the `.env` file and are never shared.
