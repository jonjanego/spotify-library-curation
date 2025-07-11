require('dotenv').config();
const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const port = process.env.PORT || 3000;

// Spotify API setup
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI
});

// Cache configuration
const CACHE_DIR = path.join(__dirname, '..', 'cache');
const LIKED_SONGS_CACHE_FILE = path.join(CACHE_DIR, 'liked-songs.json');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating cache directory:', error);
  }
}

// Initialize cache directory
ensureCacheDir();

// File-based cache for liked songs
async function getCachedLikedSongs() {
  try {
    const stats = await fs.stat(LIKED_SONGS_CACHE_FILE);
    const now = Date.now();
    const fileAge = now - stats.mtime.getTime();
    
    // Check if cache is still valid (less than 24 hours old)
    if (fileAge < CACHE_DURATION) {
      const cacheData = await fs.readFile(LIKED_SONGS_CACHE_FILE, 'utf8');
      const parsed = JSON.parse(cacheData);
      console.log(`Using cached liked songs (${parsed.length} tracks, cached ${Math.round(fileAge / (1000 * 60 * 60))} hours ago)`);
      return parsed;
    } else {
      console.log(`Cache expired (${Math.round(fileAge / (1000 * 60 * 60))} hours old), will refresh`);
      return null;
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No cache file found, will fetch fresh data');
    } else {
      console.error('Error reading cache:', error);
    }
    return null;
  }
}

async function saveLikedSongsCache(data) {
  try {
    await fs.writeFile(LIKED_SONGS_CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Saved ${data.length} liked songs to cache`);
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

async function clearLikedSongsCache() {
  try {
    await fs.unlink(LIKED_SONGS_CACHE_FILE);
    console.log('Cache cleared');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error clearing cache:', error);
    }
  }
}

// Clear cache endpoint
app.post('/api/clear-cache', async (req, res) => {
  try {
    await clearLikedSongsCache();
    // Also clear in-memory cache
    getAllLikedSongs._cache = null;
    res.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).send(error.message);
  }
});

// Store for access tokens (in production, use a proper database)
let accessToken = null;

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Spotify authentication
app.get('/auth', (req, res) => {
  const scopes = ['user-library-read', 'user-library-modify', 'playlist-modify-public', 'playlist-modify-private'];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
  res.redirect(authorizeURL);
});

// Callback route
app.get('/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    accessToken = data.body['access_token'];
    const refreshToken = data.body['refresh_token'];
    
    spotifyApi.setAccessToken(accessToken);
    spotifyApi.setRefreshToken(refreshToken);
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.send('Authentication failed');
  }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
  if (!accessToken) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// API route to get liked songs and find duplicates
app.get('/api/duplicates', async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const duplicates = await findDuplicatesInLikedSongs();
    res.json({ duplicates });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    res.status(500).json({ error: 'Failed to find duplicates' });
  }
});

// API route to analyze albums in liked songs
app.get('/api/album-analysis', async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const albumAnalysis = await analyzeAlbumsInLikedSongs();
    res.json({ albumAnalysis });
  } catch (error) {
    console.error('Error analyzing albums:', error);
    res.status(500).json({ error: 'Failed to analyze albums' });
  }
});

// API route to analyze songs by year added
app.get('/api/year-analysis', async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const yearAnalysis = await analyzeSongsByYear();
    res.json({ yearAnalysis });
  } catch (error) {
    console.error('Error analyzing by year:', error);
    res.status(500).json({ error: 'Failed to analyze by year' });
  }
});

// API route to create year-based playlists
app.post('/api/create-year-playlists', async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { years } = req.body;
    const results = await createYearBasedPlaylists(years);
    res.json({ results });
  } catch (error) {
    console.error('Error creating year playlists:', error);
    res.status(500).json({ error: 'Failed to create year playlists' });
  }
});

// API route to remove duplicate songs (keeping most recent)
app.post('/api/remove-duplicates', async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const results = await removeDuplicateTracks();
    res.json({ results });
  } catch (error) {
    console.error('Error removing duplicates:', error);
    res.status(500).json({ error: 'Failed to remove duplicates' });
  }
});

// API route to remove entire albums from liked songs
app.post('/api/remove-albums', async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { albumIds, removeAll, addToLibrary } = req.body;
    const results = await removeAlbumsFromLiked(albumIds, removeAll, addToLibrary);
    res.json({ results });
  } catch (error) {
    console.error('Error removing albums:', error);
    res.status(500).json({ error: 'Failed to remove albums' });
  }
});

// Add album to library
app.post('/api/add-album-to-library', async (req, res) => {
  try {
    if (!spotifyApi.getAccessToken()) {
      return res.status(401).send('Not authenticated');
    }

    const { albumId } = req.body;
    
    if (!albumId) {
      return res.status(400).send('Album ID is required');
    }

    console.log(`Adding album to library: ${albumId}`);
    
    // Use the spotify-web-api-node method with proper error handling
    const result = await spotifyApi.addToMySavedAlbums([albumId]);
    console.log(`Successfully added album ${albumId} to library`, result);
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error adding album to library:', error);
    
    // Provide more detailed error information
    if (error.body) {
      console.error('Spotify API error body:', error.body);
      res.status(error.statusCode || 500).send(error.body.error?.message || error.message);
    } else {
      res.status(500).send(error.message);
    }
  }
});

async function findDuplicatesInLikedSongs() {
  console.log('Finding duplicates in liked songs...');
  const allTracks = await getAllLikedSongs();
  
  // Find duplicates
  const duplicates = findDuplicates(allTracks);
  console.log(`Found ${duplicates.length} duplicate groups`);
  
  return duplicates;
}

function findDuplicates(tracks, includeAlbum = true) {
  const trackMap = new Map();
  const duplicates = [];

  tracks.forEach((item, index) => {
    const track = item.track;
    if (!track) return;

    // Create a normalized key for comparison
    const key = normalizeTrackKey(track, includeAlbum);
    
    if (trackMap.has(key)) {
      const existingGroup = trackMap.get(key);
      existingGroup.push({
        index,
        track: track,
        addedAt: item.added_at
      });
    } else {
      trackMap.set(key, [{
        index,
        track: track,
        addedAt: item.added_at
      }]);
    }
  });

  // Filter out groups with only one track (no duplicates)
  trackMap.forEach((group, key) => {
    if (group.length > 1) {
      duplicates.push({
        key,
        tracks: group,
        count: group.length
      });
    }
  });

  return duplicates;
}

function normalizeTrackKey(track, includeAlbum = true) {
  // Normalize track name and artist for comparison
  const trackName = track.name.toLowerCase().trim();
  const artistNames = track.artists.map(artist => artist.name.toLowerCase().trim()).sort().join(',');
  
  if (includeAlbum) {
    const albumName = track.album.name.toLowerCase().trim();
    // Include album name in the key to distinguish between different versions
    // This prevents compilations, live albums, etc. from being marked as duplicates
    return `${trackName}::${artistNames}::${albumName}`;
  } else {
    // Looser matching - only track name and artist (for finding ALL versions)
    return `${trackName}::${artistNames}`;
  }
}

async function analyzeAlbumsInLikedSongs() {
  console.log('Fetching liked songs for album analysis...');
  const allTracks = await getAllLikedSongs();
  
  // Group tracks by album
  const albumMap = new Map();
  
  allTracks.forEach((item, index) => {
    const track = item.track;
    if (!track || !track.album) return;
    
    const albumKey = `${track.album.id}::${track.album.name}`;
    
    if (!albumMap.has(albumKey)) {
      albumMap.set(albumKey, {
        album: track.album,
        tracks: [],
        totalTracks: track.album.total_tracks
      });
    }
    
    albumMap.get(albumKey).tracks.push({
      track,
      addedAt: item.added_at,
      index
    });
  });
  
  // Get unique album IDs for library checking
  const albumIds = Array.from(albumMap.values()).map(albumData => albumData.album.id);
  
  // Check which albums are in the user's library (in batches of 20)
  const albumLibraryStatus = new Map();
  const batchSize = 20;
  
  console.log(`Checking library status for ${albumIds.length} albums...`);
  
  for (let i = 0; i < albumIds.length; i += batchSize) {
    const batch = albumIds.slice(i, i + batchSize);
    try {
      const response = await spotifyApi.containsMySavedAlbums(batch);
      batch.forEach((albumId, index) => {
        albumLibraryStatus.set(albumId, response.body[index]);
      });
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error checking album library status for batch ${i}:`, error);
      // If we can't check, assume not in library
      batch.forEach(albumId => {
        albumLibraryStatus.set(albumId, false);
      });
    }
  }
  
  // Find albums that are mostly or completely in liked songs
  const suspiciousAlbums = [];
  
  albumMap.forEach((albumData, albumKey) => {
    const { album, tracks, totalTracks } = albumData;
    const likedCount = tracks.length;
    const percentage = (likedCount / totalTracks) * 100;
    const isInLibrary = albumLibraryStatus.get(album.id) || false;
    
    // Filter criteria:
    // 1. More than 1 track (ignore single tracks)
    // 2. >70% of tracks are liked, OR >5 tracks from same album with >50%
    if (totalTracks > 1 && (percentage > 70 || (likedCount > 5 && percentage > 50))) {
      suspiciousAlbums.push({
        album,
        likedCount,
        totalTracks,
        percentage: Math.round(percentage),
        isInLibrary,
        tracks: tracks.sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt))
      });
    }
  });
  
  // Sort by percentage descending
  suspiciousAlbums.sort((a, b) => b.percentage - a.percentage);
  
  console.log(`Found ${suspiciousAlbums.length} albums with high liked song concentration (excluding singles)`);
  return suspiciousAlbums;
}

async function analyzeSongsByYear() {
  console.log('Analyzing songs by year added...');
  const allTracks = await getAllLikedSongs();
  
  const yearMap = new Map();
  
  allTracks.forEach((item) => {
    const addedDate = new Date(item.added_at);
    const year = addedDate.getFullYear();
    
    if (!yearMap.has(year)) {
      yearMap.set(year, []);
    }
    
    yearMap.get(year).push({
      track: item.track,
      addedAt: item.added_at
    });
  });
  
  // Convert to array and sort by year
  const yearData = Array.from(yearMap.entries()).map(([year, tracks]) => ({
    year,
    count: tracks.length,
    tracks: tracks.sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt))
  })).sort((a, b) => b.year - a.year);
  
  console.log(`Found songs across ${yearData.length} different years`);
  return yearData;
}

async function getAllLikedSongs() {
  // Check file-based cache first
  const cachedData = await getCachedLikedSongs();
  if (cachedData) {
    // Also set in-memory cache for immediate subsequent calls
    getAllLikedSongs._cache = cachedData;
    return cachedData;
  }
  
  // Check if we already have the data cached (simple in-memory cache)
  if (getAllLikedSongs._cache) {
    console.log('Using in-memory cached liked songs data');
    return getAllLikedSongs._cache;
  }
  
  console.log('Fetching all liked songs from Spotify API...');
  const allTracks = [];
  let offset = 0;
  const limit = 50;
  let retryCount = 0;
  const maxRetries = 3;

  try {
    while (true) {
      try {
        console.log(`Fetching tracks ${offset} to ${offset + limit}...`);
        
        const data = await spotifyApi.getMySavedTracks({ limit, offset });
        const tracks = data.body.items;
        
        if (tracks.length === 0) break;
        
        allTracks.push(...tracks);
        offset += limit;
        retryCount = 0; // Reset retry count on successful request
        
        console.log(`Fetched ${allTracks.length} tracks so far...`);
        
        // More conservative rate limiting - Spotify allows 100 requests per minute
        // Wait longer between requests to avoid timeouts
        await new Promise(resolve => setTimeout(resolve, 800)); // 800ms delay
        
      } catch (error) {
        console.error(`Error fetching batch at offset ${offset}:`, error.message);
        
        if (retryCount < maxRetries) {
          retryCount++;
          const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
          console.log(`Retrying in ${backoffDelay}ms... (attempt ${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue; // Retry the same offset
        } else {
          // If we've retried too many times, check if we have some data to work with
          if (allTracks.length > 0) {
            console.log(`Failed to fetch all tracks, but got ${allTracks.length} tracks to work with`);
            break;
          } else {
            throw error; // Re-throw if we have no data at all
          }
        }
      }
    }

    console.log(`Total tracks fetched: ${allTracks.length}`);
    
    // Save to file-based cache (24 hours)
    await saveLikedSongsCache(allTracks);
    
    // Cache the results in memory for immediate subsequent calls
    getAllLikedSongs._cache = allTracks;
    setTimeout(() => {
      getAllLikedSongs._cache = null;
      console.log('In-memory cache expired');
    }, 10 * 60 * 1000); // Keep in memory for 10 minutes
    
    return allTracks;
  } catch (error) {
    console.error('Error fetching liked songs:', error);
    
    // Provide more helpful error messages
    if (error.code === 'ETIMEDOUT') {
      throw new Error('Network timeout while fetching songs. Please check your internet connection and try again.');
    } else if (error.statusCode === 429) {
      throw new Error('Spotify API rate limit exceeded. Please wait a few minutes and try again.');
    } else if (error.statusCode === 401) {
      throw new Error('Authentication expired. Please refresh the page and log in again.');
    } else {
      throw new Error(`Failed to fetch songs: ${error.message}`);
    }
  }
}

async function createYearBasedPlaylists(selectedYears) {
  console.log('Creating year-based playlists for years:', selectedYears);
  
  const yearAnalysis = await analyzeSongsByYear();
  const results = [];
  
  try {
    // Get user profile for playlist creation
    const userProfile = await spotifyApi.getMe();
    const userId = userProfile.body.id;
    
    for (const year of selectedYears) {
      const yearData = yearAnalysis.find(y => y.year === year);
      if (!yearData || yearData.tracks.length === 0) {
        results.push({
          year,
          success: false,
          error: 'No tracks found for this year'
        });
        continue;
      }
      
      try {
        // Create the playlist
        const playlistName = `Liked Songs ${year}`;
        const playlistDescription = `Songs added to Liked Songs during ${year}`;
        
        console.log(`Creating playlist: ${playlistName}`);
        console.log('Playlist options:', {
          description: playlistDescription,
          public: false,
          collaborative: false
        });
        
        const playlist = await spotifyApi.createPlaylist(playlistName, {
          description: playlistDescription,
          public: false,
          collaborative: false
        });
        
        console.log('Created playlist response:', {
          id: playlist.body.id,
          name: playlist.body.name,
          public: playlist.body.public,
          collaborative: playlist.body.collaborative
        });
        
        const playlistId = playlist.body.id;
        
        // Double-check: Explicitly update playlist to be private
        // This is a workaround for Spotify API inconsistencies
        try {
          await spotifyApi.changePlaylistDetails(playlistId, {
            public: false,
            collaborative: false
          });
          console.log('Explicitly set playlist to private');
        } catch (updateError) {
          console.warn('Failed to update playlist privacy, but playlist was created:', updateError.message);
        }
        
        // Add tracks to playlist in batches (Spotify allows max 100 tracks per request)
        const trackUris = yearData.tracks.map(item => item.track.uri);
        const batchSize = 100;
        
        console.log(`Adding ${trackUris.length} tracks to playlist in batches of ${batchSize}`);
        
        for (let i = 0; i < trackUris.length; i += batchSize) {
          const batch = trackUris.slice(i, i + batchSize);
          console.log(`Adding batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(trackUris.length/batchSize)}`);
          
          let retryCount = 0;
          const maxRetries = 3;
          
          while (retryCount < maxRetries) {
            try {
              await spotifyApi.addTracksToPlaylist(playlistId, batch);
              break; // Success, move to next batch
            } catch (error) {
              retryCount++;
              if (retryCount >= maxRetries) {
                throw error;
              }
              const delay = 1000 * retryCount; // Increasing delay
              console.log(`Batch failed, retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
          
          // Rate limiting between batches
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        results.push({
          year,
          success: true,
          playlistId,
          playlistName,
          trackCount: yearData.tracks.length,
          playlistUrl: `https://open.spotify.com/playlist/${playlistId}`
        });
        
        console.log(`Successfully created playlist "${playlistName}" with ${yearData.tracks.length} tracks`);
        
      } catch (error) {
        console.error(`Error creating playlist for ${year}:`, error);
        let errorMessage = error.message;
        
        if (error.statusCode === 429) {
          errorMessage = 'Rate limit exceeded. Please wait and try again.';
        } else if (error.statusCode === 401) {
          errorMessage = 'Authentication expired. Please refresh and log in again.';
        } else if (error.code === 'ETIMEDOUT') {
          errorMessage = 'Network timeout. Please check your connection and try again.';
        }
        
        results.push({
          year,
          success: false,
          error: errorMessage
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw new Error('Failed to get user profile for playlist creation');
  }
}

async function removeDuplicateTracks() {
  console.log('Starting duplicate removal process...');
  
  // Get duplicates first
  const duplicates = await findDuplicatesInLikedSongs();
  
  if (duplicates.length === 0) {
    return {
      success: true,
      message: 'No duplicates found to remove',
      removedCount: 0
    };
  }
  
  const tracksToRemove = [];
  let totalDuplicates = 0;
  
  // For each duplicate group, keep the most recent (last added) and mark others for removal
  duplicates.forEach(group => {
    // Sort by added date (newest first, so index 0 is the most recent)
    const sortedTracks = group.tracks.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    
    // Keep the first one (most recent) and remove all others
    const toRemove = sortedTracks.slice(1);
    toRemove.forEach(item => {
      tracksToRemove.push(item.track.id);
      totalDuplicates++;
    });
    
    console.log(`Group "${group.tracks[0].track.name}" from "${group.tracks[0].track.album.name}": keeping most recent (${sortedTracks[0].addedAt}), removing ${toRemove.length} older copies`);
  });
  
  console.log(`Found ${totalDuplicates} duplicate tracks to remove`);
  
  // Remove tracks in batches (Spotify allows max 50 tracks per request for removal)
  const batchSize = 50;
  const results = {
    success: true,
    removedCount: 0,
    errors: []
  };
  
  for (let i = 0; i < tracksToRemove.length; i += batchSize) {
    const batch = tracksToRemove.slice(i, i + batchSize);
    
    try {
      console.log(`Removing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(tracksToRemove.length/batchSize)} (${batch.length} tracks)`);
      
      await spotifyApi.removeFromMySavedTracks(batch);
      results.removedCount += batch.length;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Error removing batch ${Math.floor(i/batchSize) + 1}:`, error);
      results.errors.push(`Failed to remove batch starting at track ${i + 1}: ${error.message}`);
    }
  }
  
  // Clear cache so next analysis gets fresh data
  getAllLikedSongs._cache = null;
  
  console.log(`Successfully removed ${results.removedCount} duplicate tracks`);
  
  return {
    success: results.errors.length === 0,
    removedCount: results.removedCount,
    totalDuplicates,
    errors: results.errors,
    message: `Removed ${results.removedCount} out of ${totalDuplicates} duplicate tracks`
  };
}

async function removeAlbumsFromLiked(albumIds, removeAll = false, addToLibrary = false) {
  console.log('Starting album removal process...');
  
  // Get album analysis
  const albumAnalysis = await analyzeAlbumsInLikedSongs();
  
  let albumsToProcess;
  
  if (removeAll) {
    albumsToProcess = albumAnalysis;
    console.log(`Removing ALL ${albumAnalysis.length} albums from liked songs`);
  } else {
    albumsToProcess = albumAnalysis.filter(album => albumIds.includes(album.album.id));
    console.log(`Removing ${albumsToProcess.length} selected albums from liked songs`);
  }
  
  if (albumsToProcess.length === 0) {
    return {
      success: true,
      message: 'No albums found to remove',
      removedAlbums: 0,
      removedTracks: 0
    };
  }
  
  const results = {
    success: true,
    removedAlbums: 0,
    removedTracks: 0,
    addedToLibrary: 0,
    errors: [],
    details: []
  };
  
  for (const albumData of albumsToProcess) {
    try {
      const trackIds = albumData.tracks.map(item => item.track.id);
      
      console.log(`Processing album "${albumData.album.name}" (${trackIds.length} tracks, in library: ${albumData.isInLibrary})`);
      
      let albumAddedToLibrary = false;
      
      // If album is not in library and we should add it (or auto-add for non-library albums)
      if (!albumData.isInLibrary && (addToLibrary || removeAll)) {
        try {
          console.log(`Adding album "${albumData.album.name}" to library before removing individual tracks`);
          await spotifyApi.addToMySavedAlbums([albumData.album.id]);
          albumAddedToLibrary = true;
          results.addedToLibrary++;
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (addError) {
          console.error(`Failed to add album "${albumData.album.name}" to library:`, addError);
          results.errors.push(`Failed to add "${albumData.album.name}" to library: ${addError.message}`);
        }
      }
      
      // Remove tracks in batches
      const batchSize = 50;
      let albumRemovedCount = 0;
      
      for (let i = 0; i < trackIds.length; i += batchSize) {
        const batch = trackIds.slice(i, i + batchSize);
        
        try {
          await spotifyApi.removeFromMySavedTracks(batch);
          albumRemovedCount += batch.length;
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (error) {
          console.error(`Error removing batch from album "${albumData.album.name}":`, error);
          results.errors.push(`Failed to remove some tracks from "${albumData.album.name}": ${error.message}`);
        }
      }
      
      results.removedAlbums++;
      results.removedTracks += albumRemovedCount;
      
      results.details.push({
        albumName: albumData.album.name,
        artistName: albumData.album.artists.map(a => a.name).join(', '),
        tracksRemoved: albumRemovedCount,
        totalTracks: trackIds.length,
        wasInLibrary: albumData.isInLibrary,
        addedToLibrary: albumAddedToLibrary,
        success: albumRemovedCount === trackIds.length
      });
      
      const libraryAction = albumAddedToLibrary ? ' (added to library)' : 
                           albumData.isInLibrary ? ' (was already in library)' : 
                           ' (not added to library)';
      
      console.log(`Successfully processed "${albumData.album.name}": removed ${albumRemovedCount}/${trackIds.length} tracks${libraryAction}`);
      
    } catch (error) {
      console.error(`Error processing album "${albumData.album.name}":`, error);
      results.errors.push(`Failed to process album "${albumData.album.name}": ${error.message}`);
    }
  }
  
  // Clear cache so next analysis gets fresh data
  getAllLikedSongs._cache = null;
  
  console.log(`Album removal complete: ${results.removedAlbums} albums, ${results.removedTracks} tracks, ${results.addedToLibrary} albums added to library`);
  
  return {
    success: results.errors.length === 0,
    removedAlbums: results.removedAlbums,
    removedTracks: results.removedTracks,
    addedToLibrary: results.addedToLibrary,
    errors: results.errors,
    details: results.details,
    message: `Removed ${results.removedTracks} tracks from ${results.removedAlbums} albums${results.addedToLibrary > 0 ? `, added ${results.addedToLibrary} albums to library` : ''}`
  };
}

// Start the server
app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log('Opening browser...');
  
  try {
    const open = await import('open');
    await open.default(`http://localhost:${port}`);
  } catch (error) {
    console.log('Could not automatically open browser. Please navigate to http://localhost:' + port);
  }
});
