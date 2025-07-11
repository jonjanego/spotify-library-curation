require('dotenv').config();
const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Spotify API setup
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI
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
  const scopes = ['user-library-read', 'playlist-modify-public', 'playlist-modify-private'];
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

async function findDuplicatesInLikedSongs() {
  console.log('Finding duplicates in liked songs...');
  const allTracks = await getAllLikedSongs();
  
  // Find duplicates
  const duplicates = findDuplicates(allTracks);
  console.log(`Found ${duplicates.length} duplicate groups`);
  
  return duplicates;
}

function findDuplicates(tracks) {
  const trackMap = new Map();
  const duplicates = [];

  tracks.forEach((item, index) => {
    const track = item.track;
    if (!track) return;

    // Create a normalized key for comparison
    const key = normalizeTrackKey(track);
    
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

function normalizeTrackKey(track) {
  // Normalize track name and artist for comparison
  const trackName = track.name.toLowerCase().trim();
  const artistNames = track.artists.map(artist => artist.name.toLowerCase().trim()).sort().join(',');
  
  // You can adjust this logic based on how strict you want the duplicate detection to be
  return `${trackName}::${artistNames}`;
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
  
  // Find albums that are mostly or completely in liked songs
  const suspiciousAlbums = [];
  
  albumMap.forEach((albumData, albumKey) => {
    const { album, tracks, totalTracks } = albumData;
    const likedCount = tracks.length;
    const percentage = (likedCount / totalTracks) * 100;
    
    // Flag albums where >70% of tracks are liked, or >5 tracks from same album
    if (percentage > 70 || (likedCount > 5 && percentage > 50)) {
      suspiciousAlbums.push({
        album,
        likedCount,
        totalTracks,
        percentage: Math.round(percentage),
        tracks: tracks.sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt))
      });
    }
  });
  
  // Sort by percentage descending
  suspiciousAlbums.sort((a, b) => b.percentage - a.percentage);
  
  console.log(`Found ${suspiciousAlbums.length} albums with high liked song concentration`);
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
  // Check if we already have the data cached (simple in-memory cache)
  if (getAllLikedSongs._cache) {
    console.log('Using cached liked songs data');
    return getAllLikedSongs._cache;
  }
  
  console.log('Fetching all liked songs...');
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
    
    // Cache the results for 10 minutes (longer cache since fetching is expensive)
    getAllLikedSongs._cache = allTracks;
    setTimeout(() => {
      getAllLikedSongs._cache = null;
      console.log('Cache expired - will refetch on next analysis');
    }, 10 * 60 * 1000);
    
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
        const playlistDescription = `Songs added to Liked Songs during ${year} (${yearData.tracks.length} tracks)`;
        
        console.log(`Creating playlist: ${playlistName}`);
        const playlist = await spotifyApi.createPlaylist(userId, {
          name: playlistName,
          description: playlistDescription,
          public: false
        });
        
        const playlistId = playlist.body.id;
        
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
