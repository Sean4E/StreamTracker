import React, { useState, useEffect, useMemo } from 'react';
import { Search, Calendar, Star, PlayCircle, Check, Plus, X, Bell, Home, Bookmark, Loader, Tv } from 'lucide-react';
import { auth, signIn, signUp, signInWithGoogle, signOut, writeUserData, readUserData, listenToUserData } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

const StreamTracker = () => {
  // Auth & User State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Navigation State
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedShow, setSelectedShow] = useState(null);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showSubscriptionsModal, setShowSubscriptionsModal] = useState(false);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState('all');

  // Data State
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // User Data (synced with Firebase)
  const [trackedShows, setTrackedShows] = useState([]);
  const [watchedEpisodes, setWatchedEpisodes] = useState({});
  const [favoriteShows, setFavoriteShows] = useState([]); // Shows user loves
  const [watchlistShows, setWatchlistShows] = useState([]); // Shows user wants to watch
  const [completedShows, setCompletedShows] = useState([]); // Shows user finished
  const [notifications, setNotifications] = useState([]);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [userPreferences, setUserPreferences] = useState({
    notifications: {
      enabled: true,
      newEpisodes: true,
      dayBefore: true,
      weekBefore: false,
      seriesStatus: true,
      serviceRecommendations: true
    },
    autoMarkWatched: false,
    defaultService: 'all',
    subscriptions: ['Netflix', 'Max', 'Hulu', 'Apple TV+', 'Paramount+', 'Disney+', 'Prime Video'], // Default: all services
    displayMode: 'popular' // 'myServices', 'today', 'popular', 'all'
  });

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0]
        });
        setIsAuthenticated(true);
        loadUserData(user.uid);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setTrackedShows([]);
        setWatchedEpisodes({});
      }
    });

    return () => unsubscribe();
  }, []);

  // Load user data from Firebase
  const loadUserData = async (uid) => {
    try {
      const snapshot = await readUserData(uid, '');
      if (snapshot.exists()) {
        const data = snapshot.val();
        setTrackedShows(data.trackedShows || []);
        setWatchedEpisodes(data.watchedEpisodes || {});
        setFavoriteShows(data.favoriteShows || []);
        setWatchlistShows(data.watchlistShows || []);
        setCompletedShows(data.completedShows || []);
        setNotifications(data.notifications || []);
        setUserPreferences(data.preferences || userPreferences);
      } else {
        // Initialize user data if it doesn't exist
        await writeUserData(uid, '', {
          email: currentUser?.email,
          displayName: currentUser?.displayName,
          trackedShows: [],
          watchedEpisodes: {},
          favoriteShows: [],
          watchlistShows: [],
          completedShows: [],
          notifications: [],
          preferences: userPreferences,
          createdAt: Date.now()
        });
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      // Fallback to localStorage
      const localData = localStorage.getItem(`userData_${uid}`);
      if (localData) {
        const parsed = JSON.parse(localData);
        setTrackedShows(parsed.trackedShows || []);
        setWatchedEpisodes(parsed.watchedEpisodes || {});
      }
    }
  };

  // Update Firebase with user data
  const updateFirebase = async (path, data) => {
    if (!currentUser) return;
    try {
      await writeUserData(currentUser.uid, path, data);
      // Also backup to localStorage
      const userData = {
        trackedShows: path === 'trackedShows' ? data : trackedShows,
        watchedEpisodes: path === 'watchedEpisodes' ? data : watchedEpisodes,
        preferences: path === 'preferences' ? data : userPreferences
      };
      localStorage.setItem(`userData_${currentUser.uid}`, JSON.stringify(userData));
    } catch (err) {
      console.error('Error updating Firebase:', err);
    }
  };

  // Authentication handlers
  const handleSignIn = async (email, password) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      await signIn(email, password);
      setShowAuthModal(false);
    } catch (err) {
      setAuthError(err.message || 'Sign in failed. Please check your credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async (email, password, displayName) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const userCredential = await signUp(email, password);
      const uid = userCredential.user.uid;

      // Create initial user data
      await writeUserData(uid, '', {
        email,
        displayName: displayName || email.split('@')[0],
        trackedShows: [],
        watchedEpisodes: {},
        preferences: userPreferences,
        createdAt: Date.now()
      });

      setShowAuthModal(false);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setAuthError('Email already in use. Please sign in instead.');
      } else {
        setAuthError(err.message || 'Sign up failed. Please try again.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const userCredential = await signInWithGoogle();
      const user = userCredential.user;

      // Check if user data exists, if not create it
      const snapshot = await readUserData(user.uid, '');
      if (!snapshot.exists()) {
        await writeUserData(user.uid, '', {
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          trackedShows: [],
          watchedEpisodes: {},
          preferences: userPreferences,
          createdAt: Date.now()
        });
      }

      setShowAuthModal(false);
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign in cancelled');
      } else if (err.code === 'auth/popup-blocked') {
        setAuthError('Popup blocked. Please allow popups for this site.');
      } else {
        setAuthError(err.message || 'Google sign in failed. Please try again.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Notification Functions
  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      console.log('Notifications not supported in this browser');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission === 'granted';
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return false;
    }
  };

  const sendBrowserNotification = (title, options = {}) => {
    if (notificationPermission !== 'granted' || !userPreferences.notifications?.enabled) {
      return;
    }

    try {
      const notification = new Notification(title, {
        icon: '/streamtracker.ico',
        badge: '/streamtracker.ico',
        ...options
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000);
    } catch (err) {
      console.error('Error sending notification:', err);
    }
  };

  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now(),
      timestamp: new Date(),
      read: false,
      ...notification
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 50)); // Keep last 50

    // Send browser notification
    if (notification.browserNotification && userPreferences.notifications?.enabled) {
      sendBrowserNotification(notification.title, {
        body: notification.message,
        tag: notification.type
      });
    }

    // Save to Firebase
    if (isAuthenticated) {
      writeUserData(currentUser.uid, 'notifications', [newNotification, ...notifications].slice(0, 50));
    }
  };

  const markNotificationAsRead = (notificationId) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    if (isAuthenticated) {
      const updated = notifications.map(n => n.id === notificationId ? { ...n, read: true } : n);
      writeUserData(currentUser.uid, 'notifications', updated);
    }
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (isAuthenticated) {
      writeUserData(currentUser.uid, 'notifications', notifications.map(n => ({ ...n, read: true })));
    }
  };

  // API Integration
  const TVMAZE_BASE_URL = 'https://api.tvmaze.com';
  const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
  const TMDB_API_KEY = 'YOUR_TMDB_API_KEY'; // User will need to get their own free API key from themoviedb.org
  const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

  // Pagination state for browsing all shows
  const [currentPage, setCurrentPage] = useState(0);

  // Content type state (TV shows vs Movies)
  const [contentType, setContentType] = useState('tv'); // 'tv' or 'movie'
  const [movies, setMovies] = useState([]);

  const fetchTodaysShows = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch show schedule for today
      const today = new Date().toISOString().split('T')[0];
      const scheduleResponse = await fetch(`${TVMAZE_BASE_URL}/schedule?country=US&date=${today}`);
      const schedule = await scheduleResponse.json();

      // Get unique shows from schedule
      const showIds = [...new Set(schedule.map(ep => ep.show.id))];

      // Fetch detailed info for each show
      const showPromises = showIds.map(id =>
        fetch(`${TVMAZE_BASE_URL}/shows/${id}?embed[]=episodes&embed[]=nextepisode`)
          .then(r => r.json())
          .catch(() => null)
      );

      const showsData = (await Promise.all(showPromises)).filter(Boolean);
      const transformedShows = showsData.map(transformTVMazeShow);

      setShows(transformedShows);
    } catch (err) {
      console.error('Error fetching today\'s shows:', err);
      setError('Failed to load today\'s shows. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPopularShows = async () => {
    try {
      setLoading(true);
      setError(null);

      // Comprehensive list of popular shows across all streaming services
      const popularShowsByService = {
        netflix: [
          'Stranger Things', 'Wednesday', 'The Crown', 'Bridgerton',
          'Ozark', 'The Witcher', 'Squid Game', 'You', 'Dark',
          'Narcos', 'Black Mirror', 'Money Heist', 'Arcane'
        ],
        hbo: [
          'Game of Thrones', 'House of the Dragon', 'The Last of Us',
          'Succession', 'Euphoria', 'The White Lotus', 'True Detective',
          'Westworld', 'Chernobyl', 'The Sopranos', 'The Wire'
        ],
        hulu: [
          'The Handmaids Tale', 'Only Murders in the Building', 'The Bear',
          'Castle Rock', 'Little Fires Everywhere', 'Dopesick'
        ],
        apple: [
          'Ted Lasso', 'Severance', 'The Morning Show', 'Foundation',
          'For All Mankind', 'Silo', 'See'
        ],
        paramount: [
          'Star Trek Discovery', 'Yellowstone', '1923', 'Halo',
          'Evil', 'The Good Fight'
        ],
        disney: [
          'The Mandalorian', 'Loki', 'WandaVision', 'Andor',
          'Ahsoka', 'The Falcon and the Winter Soldier', 'Obi-Wan Kenobi'
        ],
        prime: [
          'The Boys', 'The Rings of Power', 'Reacher', 'Jack Ryan',
          'The Marvelous Mrs Maisel', 'The Expanse', 'Invincible'
        ],
        network: [
          'Breaking Bad', 'Better Call Saul', 'The Office', 'Friends',
          'Lost', 'The Walking Dead', 'Supernatural', 'Greys Anatomy'
        ]
      };

      // Flatten all show names
      const allPopularShows = Object.values(popularShowsByService).flat();

      // Fetch all shows in parallel
      const searchPromises = allPopularShows.map(name =>
        fetch(`${TVMAZE_BASE_URL}/singlesearch/shows?q=${encodeURIComponent(name)}&embed[]=episodes&embed[]=nextepisode`)
          .then(r => r.json())
          .catch(() => null)
      );

      const fetchedShows = (await Promise.all(searchPromises)).filter(Boolean);

      // Remove duplicates and transform data
      const uniqueShows = fetchedShows
        .filter((show, index, self) =>
          index === self.findIndex(s => s.id === show.id)
        )
        .map(transformTVMazeShow);

      setShows(uniqueShows);
    } catch (err) {
      console.error('Error fetching shows:', err);
      setError('Failed to load shows. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch top-rated shows from TVMaze
  const fetchTopRatedShows = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch shows page by page (TVMaze returns 250 shows per page, sorted by ID)
      // We'll fetch page 0 and filter by rating
      const response = await fetch(`${TVMAZE_BASE_URL}/shows?page=0`);
      const allShows = await response.json();

      // Sort by rating and take top 50
      const topRated = allShows
        .filter(show => show.rating && show.rating.average)
        .sort((a, b) => (b.rating.average || 0) - (a.rating.average || 0))
        .slice(0, 50);

      // Fetch full details with episodes for top shows
      const showPromises = topRated.map(show =>
        fetch(`${TVMAZE_BASE_URL}/shows/${show.id}?embed[]=episodes&embed[]=nextepisode`)
          .then(r => r.json())
          .catch(() => null)
      );

      const fetchedShows = (await Promise.all(showPromises)).filter(Boolean);
      const transformedShows = fetchedShows.map(transformTVMazeShow);

      setShows(transformedShows);
    } catch (err) {
      console.error('Error fetching top-rated shows:', err);
      setError('Failed to load top-rated shows. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch recently updated shows
  const fetchRecentlyUpdatedShows = async () => {
    try {
      setLoading(true);
      setError(null);

      // TVMaze updates endpoint shows recently updated shows
      const response = await fetch(`${TVMAZE_BASE_URL}/updates/shows`);
      const updates = await response.json();

      // Get the most recently updated show IDs (limit to 50)
      const recentShowIds = Object.keys(updates)
        .sort((a, b) => updates[b] - updates[a])
        .slice(0, 50);

      // Fetch show details
      const showPromises = recentShowIds.map(id =>
        fetch(`${TVMAZE_BASE_URL}/shows/${id}?embed[]=episodes&embed[]=nextepisode`)
          .then(r => r.json())
          .catch(() => null)
      );

      const fetchedShows = (await Promise.all(showPromises)).filter(Boolean);
      const transformedShows = fetchedShows.map(transformTVMazeShow);

      setShows(transformedShows);
    } catch (err) {
      console.error('Error fetching recently updated shows:', err);
      setError('Failed to load recently updated shows. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Browse all shows with pagination
  const fetchAllShowsPaginated = async (page = 0) => {
    try {
      setLoading(true);
      setError(null);
      setCurrentPage(page);

      // TVMaze returns 250 shows per page
      const response = await fetch(`${TVMAZE_BASE_URL}/shows?page=${page}`);
      const pageShows = await response.json();

      // Fetch details with episodes for this page (limit to first 50 to avoid overwhelming)
      const limitedShows = pageShows.slice(0, 50);
      const showPromises = limitedShows.map(show =>
        fetch(`${TVMAZE_BASE_URL}/shows/${show.id}?embed[]=episodes&embed[]=nextepisode`)
          .then(r => r.json())
          .catch(() => null)
      );

      const fetchedShows = (await Promise.all(showPromises)).filter(Boolean);
      const transformedShows = fetchedShows.map(transformTVMazeShow);

      setShows(transformedShows);
    } catch (err) {
      console.error('Error fetching paginated shows:', err);
      setError('Failed to load shows. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const transformTVMazeShow = (show) => {
    // Map streaming network to service names
    const getService = (network) => {
      if (!network) return 'Other';
      const name = network.name?.toLowerCase() || '';
      if (name.includes('netflix')) return 'Netflix';
      if (name.includes('hbo') || name.includes('max')) return 'Max';
      if (name.includes('hulu')) return 'Hulu';
      if (name.includes('apple')) return 'Apple TV+';
      if (name.includes('paramount')) return 'Paramount+';
      if (name.includes('disney')) return 'Disney+';
      if (name.includes('amazon') || name.includes('prime')) return 'Prime Video';
      return network.name || 'Other';
    };

    const getDetailedStatus = (status) => {
      // Map TVMaze status to user-friendly status
      const statusMap = {
        'Running': 'Returning Series',
        'Ended': 'Ended',
        'To Be Determined': 'TBD',
        'In Development': 'In Development'
      };
      return statusMap[status] || status || 'Unknown';
    };

    // Get schedule information
    const getSchedule = () => {
      if (!show.schedule) return null;
      const days = show.schedule.days || [];
      const time = show.schedule.time || null;

      if (days.length === 0 && !time) return null;

      return {
        days: days,
        time: time,
        timezone: show.network?.country?.timezone || show.webChannel?.country?.timezone || 'Unknown'
      };
    };

    // Calculate days until next episode
    const getDaysUntilNext = (airdate) => {
      if (!airdate) return null;
      const today = new Date();
      const nextDate = new Date(airdate);
      const diffTime = nextDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    };

    const nextEp = show._embedded?.nextepisode;
    const nextEpisode = nextEp ? {
      season: nextEp.season,
      episode: nextEp.number,
      date: nextEp.airdate,
      time: nextEp.airtime,
      title: nextEp.name || 'TBA',
      daysUntil: getDaysUntilNext(nextEp.airdate),
      runtime: nextEp.runtime || show.runtime || null
    } : null;

    return {
      id: show.id,
      title: show.name,
      poster: show.image?.medium || show.image?.original || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=300&h=450&fit=crop',
      rating: show.rating?.average || 0,
      year: show.premiered ? new Date(show.premiered).getFullYear() : 'TBA',
      premiered: show.premiered || null,
      ended: show.ended || null,
      status: getDetailedStatus(show.status),
      originalStatus: show.status, // Keep original for filtering
      service: getService(show.network || show.webChannel),
      networkName: show.network?.name || show.webChannel?.name || 'Unknown',
      genre: show.genres || [],
      language: show.language || 'English',
      runtime: show.runtime || show.averageRuntime || null,
      schedule: getSchedule(),
      nextEpisode: nextEpisode,
      totalSeasons: show._embedded?.episodes ?
        Math.max(...show._embedded.episodes.map(ep => ep.season || 1)) :
        1,
      synopsis: show.summary?.replace(/<[^>]*>/g, '') || 'No synopsis available.',
      officialSite: show.officialSite || null,
      episodes: show._embedded?.episodes?.map(ep => ({
        id: ep.id,
        season: ep.season,
        number: ep.number,
        name: ep.name,
        airdate: ep.airdate,
        runtime: ep.runtime,
        image: ep.image?.medium || ep.image?.original || null,
        summary: ep.summary?.replace(/<[^>]*>/g, '') || null
      })) || []
    };
  };

  const searchShows = async (query) => {
    if (!query.trim()) {
      fetchPopularShows();
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${TVMAZE_BASE_URL}/search/shows?q=${encodeURIComponent(query)}`);
      const results = await response.json();

      const transformedShows = results
        .map(result => transformTVMazeShow(result.show))
        .slice(0, 50); // Limit results

      setShows(transformedShows);
    } catch (err) {
      console.error('Error searching shows:', err);
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch shows by genre
  const fetchShowsByGenre = async (genre) => {
    try {
      setLoading(true);
      setError(null);

      // Search for shows with the selected genre
      const response = await fetch(`${TVMAZE_BASE_URL}/search/shows?q=${encodeURIComponent(genre)}`);
      const results = await response.json();

      const transformedShows = results
        .map(result => transformTVMazeShow(result.show))
        .filter(show => show.genre.includes(genre))
        .slice(0, 100); // Get more results for genre searches

      setShows(transformedShows);
    } catch (err) {
      console.error('Error fetching shows by genre:', err);
      setError('Failed to load shows. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch tracked shows from TVMaze API
  const fetchTrackedShows = async () => {
    if (trackedShows.length === 0) {
      setShows([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const showPromises = trackedShows.map(id =>
        fetch(`${TVMAZE_BASE_URL}/shows/${id}?embed[]=episodes&embed[]=nextepisode`)
          .then(r => r.json())
          .catch(() => null)
      );

      const showsData = (await Promise.all(showPromises)).filter(Boolean);
      const transformedShows = showsData.map(transformTVMazeShow);

      setShows(transformedShows);
    } catch (err) {
      console.error('Error fetching tracked shows:', err);
      setError('Failed to load tracked shows. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchShows(searchQuery);
      } else if (selectedGenre !== 'all' && activeTab === 'browse') {
        fetchShowsByGenre(selectedGenre);
      } else if (activeTab === 'browse') {
        fetchPopularShows();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter changes - fetch new shows when genre changes
  useEffect(() => {
    if (activeTab === 'browse' && !searchQuery) {
      if (selectedGenre !== 'all') {
        fetchShowsByGenre(selectedGenre);
      } else {
        fetchPopularShows();
      }
    }
  }, [selectedGenre]);

  // Helper function to load shows based on display mode
  const loadShowsByDisplayMode = (mode) => {
    switch(mode) {
      case 'today':
        fetchTodaysShows();
        break;
      case 'topRated':
        fetchTopRatedShows();
        break;
      case 'recentlyUpdated':
        fetchRecentlyUpdatedShows();
        break;
      case 'browseAll':
        fetchAllShowsPaginated(currentPage);
        break;
      case 'popular':
      default:
        fetchPopularShows();
        break;
    }
  };

  // Initial load based on display mode
  useEffect(() => {
    const mode = userPreferences.displayMode || 'popular';
    loadShowsByDisplayMode(mode);
  }, []);

  // Handle display mode changes
  useEffect(() => {
    if (activeTab === 'browse' && !searchQuery && selectedGenre === 'all') {
      const mode = userPreferences.displayMode || 'popular';
      loadShowsByDisplayMode(mode);
    }
  }, [userPreferences.displayMode]);

  // Load tracked shows when switching to tracking tab
  useEffect(() => {
    if (activeTab === 'tracking') {
      fetchTrackedShows();
    } else if (!searchQuery && selectedGenre === 'all') {
      fetchPopularShows();
    } else if (!searchQuery && selectedGenre !== 'all') {
      fetchShowsByGenre(selectedGenre);
    }
  }, [activeTab, trackedShows]);

  const services = [
    { id: 'all', name: 'All Services' },
    { id: 'Netflix', name: 'Netflix' },
    { id: 'Max', name: 'Max' },
    { id: 'Hulu', name: 'Hulu' },
    { id: 'Apple TV+', name: 'Apple TV+' },
    { id: 'Paramount+', name: 'Paramount+' },
    { id: 'Disney+', name: 'Disney+' },
    { id: 'Prime Video', name: 'Prime Video' }
  ];

  const statuses = [
    { id: 'all', name: 'All Status' },
    { id: 'Returning Series', name: 'Returning Series' },
    { id: 'Ended', name: 'Ended' },
    { id: 'In Development', name: 'In Development' },
    { id: 'TBD', name: 'To Be Determined' }
  ];

  const genres = [
    { id: 'all', name: 'All Genres' },
    { id: 'Drama', name: 'Drama' },
    { id: 'Comedy', name: 'Comedy' },
    { id: 'Action', name: 'Action' },
    { id: 'Science-Fiction', name: 'Sci-Fi' },
    { id: 'Thriller', name: 'Thriller' },
    { id: 'Crime', name: 'Crime' },
    { id: 'Fantasy', name: 'Fantasy' },
    { id: 'Horror', name: 'Horror' },
    { id: 'Romance', name: 'Romance' },
    { id: 'Mystery', name: 'Mystery' }
  ];

  // Smart Notification Triggers - Check for upcoming episodes
  useEffect(() => {
    if (!userPreferences.notifications?.enabled || !isAuthenticated) return;

    const checkUpcomingEpisodes = () => {
      const trackedShowsData = shows.filter(show => trackedShows.includes(show.id));
      const now = new Date();

      trackedShowsData.forEach(show => {
        if (!show.nextEpisode || !show.nextEpisode.date) return;

        const airDate = new Date(show.nextEpisode.date);
        const hoursUntil = (airDate - now) / (1000 * 60 * 60);

        // New Episode - airs in less than 2 hours
        if (userPreferences.notifications.newEpisodes && hoursUntil > 0 && hoursUntil <= 2) {
          addNotification({
            type: 'newEpisode',
            title: `${show.title} - New Episode!`,
            message: `S${show.nextEpisode.season}E${show.nextEpisode.episode}: ${show.nextEpisode.title} airs in ${Math.round(hoursUntil)} hour${Math.round(hoursUntil) !== 1 ? 's' : ''}`,
            show: show,
            browserNotification: true
          });
        }

        // Day Before Reminder - airs in 23-25 hours
        if (userPreferences.notifications.dayBefore && hoursUntil > 23 && hoursUntil <= 25) {
          addNotification({
            type: 'dayBefore',
            title: `Tomorrow: ${show.title}`,
            message: `S${show.nextEpisode.season}E${show.nextEpisode.episode}: ${show.nextEpisode.title} airs tomorrow!`,
            show: show,
            browserNotification: true
          });
        }

        // Week Before Reminder - airs in 167-169 hours (7 days)
        if (userPreferences.notifications.weekBefore && hoursUntil > 167 && hoursUntil <= 169) {
          addNotification({
            type: 'weekBefore',
            title: `Next Week: ${show.title}`,
            message: `S${show.nextEpisode.season}E${show.nextEpisode.episode}: ${show.nextEpisode.title} airs in 7 days`,
            show: show,
            browserNotification: true
          });
        }
      });
    };

    // Check immediately and then every hour
    checkUpcomingEpisodes();
    const interval = setInterval(checkUpcomingEpisodes, 60 * 60 * 1000); // Every hour

    return () => clearInterval(interval);
  }, [shows, trackedShows, userPreferences.notifications, isAuthenticated]);

  const filteredShows = useMemo(() => {
    return shows.filter(show => {
      const matchesSearch = show.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           show.genre.some(g => g.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesService = selectedService === 'all' || show.service === selectedService;
      const matchesStatus = selectedStatus === 'all' || show.status === selectedStatus;
      const matchesGenre = selectedGenre === 'all' || show.genre.includes(selectedGenre);
      const matchesTab = activeTab === 'browse' ||
                        (activeTab === 'tracking' && trackedShows.includes(show.id)) ||
                        (activeTab === 'calendar' && show.nextEpisode);

      // Filter by user subscriptions if in "myServices" mode
      const matchesSubscription = userPreferences.displayMode !== 'myServices' ||
                                  userPreferences.subscriptions?.includes(show.service) ||
                                  show.service === 'Other';

      return matchesSearch && matchesService && matchesStatus && matchesGenre && matchesTab && matchesSubscription;
    });
  }, [shows, searchQuery, selectedService, selectedStatus, selectedGenre, activeTab, trackedShows, userPreferences.displayMode, userPreferences.subscriptions]);

  const toggleTracking = (showId) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    const newTrackedShows = trackedShows.includes(showId)
      ? trackedShows.filter(id => id !== showId)
      : [...trackedShows, showId];
    setTrackedShows(newTrackedShows);
    updateFirebase('trackedShows', newTrackedShows);
  };

  const toggleEpisode = (showId, seasonNum, episodeNum) => {
    const key = `${showId}-${seasonNum}-${episodeNum}`;
    const newWatchedEpisodes = {
      ...watchedEpisodes,
      [key]: !watchedEpisodes[key]
    };
    setWatchedEpisodes(newWatchedEpisodes);
    updateFirebase('watchedEpisodes', newWatchedEpisodes);
  };

  const getShowProgress = (showId) => {
    const show = shows.find(s => s.id === showId);
    if (!show || !show.episodes.length) return 0;

    const totalEpisodes = show.episodes.length;
    const watchedCount = show.episodes.filter(ep =>
      watchedEpisodes[`${showId}-${ep.season}-${ep.number}`]
    ).length;

    return Math.round((watchedCount / totalEpisodes) * 100);
  };

  // Calculate service usage analytics
  const getServiceUsage = () => {
    const serviceStats = {};
    const subscribedServices = userPreferences.subscriptions || [];
    const now = new Date();

    trackedShows.forEach(showId => {
      const show = shows.find(s => s.id === showId);
      if (show) {
        // Only include services the user subscribes to
        if (!subscribedServices.includes(show.service)) return;

        if (!serviceStats[show.service]) {
          serviceStats[show.service] = {
            total: 0,
            active: 0,
            ended: 0,
            upcoming: 0,
            onHiatus: 0
          };
        }
        serviceStats[show.service].total++;

        // More robust "active" detection
        if (show.status === 'Ended') {
          serviceStats[show.service].ended++;
        } else if (show.nextEpisode && show.nextEpisode.date) {
          const nextEpisodeDate = new Date(show.nextEpisode.date);
          const daysUntil = Math.ceil((nextEpisodeDate - now) / (1000 * 60 * 60 * 24));

          // Active = currently airing season (within last 7 days or next 60 days)
          if (daysUntil >= -7 && daysUntil <= 60) {
            serviceStats[show.service].active++;

            // Upcoming = airs within 30 days
            if (daysUntil > 0 && daysUntil <= 30) {
              serviceStats[show.service].upcoming++;
            }
          }
        } else if (show.status === 'Returning Series' || show.status === 'In Development') {
          // Show is confirmed returning but no episode date yet
          serviceStats[show.service].onHiatus++;
        }
      }
    });

    // Add subscribed services with zero shows
    subscribedServices.forEach(service => {
      if (!serviceStats[service]) {
        serviceStats[service] = {
          total: 0,
          active: 0,
          ended: 0,
          upcoming: 0,
          onHiatus: 0
        };
      }
    });

    return serviceStats;
  };

  // Get service recommendations
  const getServiceRecommendations = () => {
    const serviceUsage = getServiceUsage();
    const recommendations = [];

    Object.entries(serviceUsage).forEach(([service, stats]) => {
      // If subscribed but no tracked shows at all
      if (stats.total === 0) {
        recommendations.push({
          type: 'unused',
          service: service,
          message: `You're subscribed to ${service} but aren't tracking any shows. Consider canceling or finding shows to watch!`,
          showCount: 0
        });
      }
      // If all shows on a service have ended or no upcoming episodes
      else if (stats.total > 0 && stats.active === 0 && stats.upcoming === 0) {
        recommendations.push({
          type: 'pause',
          service: service,
          message: `No active shows on ${service}. Consider pausing your subscription until your shows return.`,
          showCount: stats.total
        });
      }
      // If shows are about to start
      else if (stats.upcoming > 0 && stats.active === 0) {
        recommendations.push({
          type: 'resume',
          service: service,
          message: `${stats.upcoming} show(s) returning soon on ${service}! Good time to reactivate if paused.`,
          showCount: stats.upcoming
        });
      }
      // If lots of active content
      else if (stats.active >= 3) {
        recommendations.push({
          type: 'value',
          service: service,
          message: `Great value on ${service}! You have ${stats.active} active shows to watch.`,
          showCount: stats.active
        });
      }
    });

    return recommendations;
  };

  // Get personalized show suggestions based on viewing history
  const getShowSuggestions = () => {
    if (!shows.length) return [];

    // Get favorite and completed shows for analysis
    const favoriteShowsData = shows.filter(s => favoriteShows.includes(s.id));
    const completedShowsData = shows.filter(s => completedShows.includes(s.id));
    const allWatchedShows = [...favoriteShowsData, ...completedShowsData];

    if (allWatchedShows.length === 0) return [];

    // Analyze user preferences
    const genreCount = {};
    const serviceCount = {};
    allWatchedShows.forEach(show => {
      show.genre.forEach(genre => {
        genreCount[genre] = (genreCount[genre] || 0) + 1;
      });
      serviceCount[show.service] = (serviceCount[show.service] || 0) + 1;
    });

    // Find top genres and services
    const topGenres = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre);

    const topServices = Object.entries(serviceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([service]) => service);

    // Find unwatched shows matching user preferences
    const suggestions = shows
      .filter(show =>
        !trackedShows.includes(show.id) &&
        !favoriteShows.includes(show.id) &&
        !completedShows.includes(show.id) &&
        !watchlistShows.includes(show.id) &&
        show.rating >= 7.0 && // Only suggest highly rated shows
        (topGenres.some(genre => show.genre.includes(genre)) ||
         topServices.includes(show.service))
      )
      .map(show => ({
        ...show,
        matchScore: (
          (topGenres.filter(genre => show.genre.includes(genre)).length * 2) +
          (topServices.includes(show.service) ? 1 : 0) +
          (show.rating / 10)
        )
      }))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);

    return suggestions;
  };

  // Notifications Modal Component
  const NotificationsModal = () => {
    const serviceRecommendations = getServiceRecommendations();
    const serviceUsage = getServiceUsage();
    const showSuggestions = getShowSuggestions();
    const unreadNotifications = notifications.filter(n => !n.read);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowNotificationsModal(false)}>
        <div
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-2xl p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Notifications & Insights</h2>
              {unreadNotifications.length > 0 && (
                <p className="text-sm text-purple-400 mt-1">{unreadNotifications.length} unread notification{unreadNotifications.length !== 1 ? 's' : ''}</p>
              )}
            </div>
            <button
              onClick={() => setShowNotificationsModal(false)}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Browser Notification Permission */}
          {notificationPermission !== 'granted' && (
            <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-medium text-sm text-blue-300 mb-1">Enable Browser Notifications</p>
                  <p className="text-xs text-gray-400">
                    Get real-time alerts when your favorite shows air, even when the app is in the background.
                  </p>
                </div>
                <button
                  onClick={requestNotificationPermission}
                  className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Enable
                </button>
              </div>
            </div>
          )}

          {/* Recent Notifications */}
          {notifications.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Bell className="w-5 h-5 text-purple-400" />
                  Recent Notifications
                </h3>
                {unreadNotifications.length > 0 && (
                  <button
                    onClick={markAllNotificationsAsRead}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notifications.slice(0, 10).map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => !notif.read && markNotificationAsRead(notif.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      notif.read
                        ? 'bg-white/5 border-white/10'
                        : 'bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!notif.read && (
                        <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 mt-1.5"></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium mb-1">{notif.title}</p>
                        <p className="text-xs text-gray-400">{notif.message}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notif.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Service Recommendations */}
          {serviceRecommendations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Tv className="w-5 h-5 text-purple-400" />
                Service Recommendations
              </h3>
              <div className="space-y-3">
                {serviceRecommendations.map((rec, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border ${
                      rec.type === 'pause'
                        ? 'bg-orange-500/10 border-orange-500/30'
                        : rec.type === 'unused'
                        ? 'bg-red-500/10 border-red-500/30'
                        : rec.type === 'resume'
                        ? 'bg-blue-500/10 border-blue-500/30'
                        : 'bg-green-500/10 border-green-500/30'
                    }`}
                  >
                    <p className="text-sm font-medium mb-1">{rec.message}</p>
                    <p className="text-xs text-gray-400">
                      {rec.showCount} show{rec.showCount !== 1 ? 's' : ''} {rec.showCount === 0 ? 'tracked' : 'tracked'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Service Usage Stats */}
          {Object.keys(serviceUsage).length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Your Streaming Services</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(serviceUsage).map(([service, stats]) => (
                  <div key={service} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="font-medium text-sm mb-2">{service}</p>
                    <div className="space-y-1 text-xs text-gray-400">
                      <p>{stats.total} show{stats.total !== 1 ? 's' : ''} tracked</p>
                      <p className={stats.active > 0 ? 'text-green-400' : 'text-gray-500'}>
                        {stats.active} active
                      </p>
                      {stats.upcoming > 0 && (
                        <p className="text-purple-400">{stats.upcoming} upcoming</p>
                      )}
                      {stats.onHiatus > 0 && (
                        <p className="text-blue-400">{stats.onHiatus} on hiatus</p>
                      )}
                      {stats.ended > 0 && (
                        <p className="text-orange-400">{stats.ended} ended</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Personalized Show Suggestions */}
          {showSuggestions.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                Recommended For You
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                Based on your favorites and viewing history
              </p>
              <div className="space-y-2">
                {showSuggestions.map(show => (
                  <div
                    key={show.id}
                    className="p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 cursor-pointer transition-all"
                    onClick={() => {
                      setSelectedShow(show);
                      setShowNotificationsModal(false);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={show.poster}
                        alt={show.title}
                        className="w-12 h-16 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm mb-1 truncate">{show.title}</p>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-yellow-400">★ {show.rating.toFixed(1)}</span>
                          <span className="text-xs text-gray-400">{show.service}</span>
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-2">{show.synopsis}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notification Preferences */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Notification Preferences</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                <div>
                  <p className="font-medium text-sm">Enable Notifications</p>
                  <p className="text-xs text-gray-400">Receive all notifications</p>
                </div>
                <input
                  type="checkbox"
                  checked={userPreferences.notifications?.enabled || false}
                  onChange={(e) => {
                    const newPrefs = {
                      ...userPreferences,
                      notifications: {
                        ...userPreferences.notifications,
                        enabled: e.target.checked
                      }
                    };
                    setUserPreferences(newPrefs);
                    updateFirebase('preferences', newPrefs);
                  }}
                  className="w-5 h-5 rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                <div>
                  <p className="font-medium text-sm">New Episodes</p>
                  <p className="text-xs text-gray-400">When a new episode airs</p>
                </div>
                <input
                  type="checkbox"
                  checked={userPreferences.notifications?.newEpisodes || false}
                  onChange={(e) => {
                    const newPrefs = {
                      ...userPreferences,
                      notifications: {
                        ...userPreferences.notifications,
                        newEpisodes: e.target.checked
                      }
                    };
                    setUserPreferences(newPrefs);
                    updateFirebase('preferences', newPrefs);
                  }}
                  className="w-5 h-5 rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                <div>
                  <p className="font-medium text-sm">Day Before Reminder</p>
                  <p className="text-xs text-gray-400">24 hours before episode airs</p>
                </div>
                <input
                  type="checkbox"
                  checked={userPreferences.notifications?.dayBefore || false}
                  onChange={(e) => {
                    const newPrefs = {
                      ...userPreferences,
                      notifications: {
                        ...userPreferences.notifications,
                        dayBefore: e.target.checked
                      }
                    };
                    setUserPreferences(newPrefs);
                    updateFirebase('preferences', newPrefs);
                  }}
                  className="w-5 h-5 rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                <div>
                  <p className="font-medium text-sm">Week Before Reminder</p>
                  <p className="text-xs text-gray-400">7 days before episode airs</p>
                </div>
                <input
                  type="checkbox"
                  checked={userPreferences.notifications?.weekBefore || false}
                  onChange={(e) => {
                    const newPrefs = {
                      ...userPreferences,
                      notifications: {
                        ...userPreferences.notifications,
                        weekBefore: e.target.checked
                      }
                    };
                    setUserPreferences(newPrefs);
                    updateFirebase('preferences', newPrefs);
                  }}
                  className="w-5 h-5 rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                <div>
                  <p className="font-medium text-sm">Series Status Updates</p>
                  <p className="text-xs text-gray-400">Renewals, cancellations, etc.</p>
                </div>
                <input
                  type="checkbox"
                  checked={userPreferences.notifications?.seriesStatus || false}
                  onChange={(e) => {
                    const newPrefs = {
                      ...userPreferences,
                      notifications: {
                        ...userPreferences.notifications,
                        seriesStatus: e.target.checked
                      }
                    };
                    setUserPreferences(newPrefs);
                    updateFirebase('preferences', newPrefs);
                  }}
                  className="w-5 h-5 rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                <div>
                  <p className="font-medium text-sm">Service Recommendations</p>
                  <p className="text-xs text-gray-400">Tips on pausing/resuming services</p>
                </div>
                <input
                  type="checkbox"
                  checked={userPreferences.notifications?.serviceRecommendations || false}
                  onChange={(e) => {
                    const newPrefs = {
                      ...userPreferences,
                      notifications: {
                        ...userPreferences.notifications,
                        serviceRecommendations: e.target.checked
                      }
                    };
                    setUserPreferences(newPrefs);
                    updateFirebase('preferences', newPrefs);
                  }}
                  className="w-5 h-5 rounded bg-white/10 border-white/20 text-purple-500 focus:ring-purple-500"
                />
              </label>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-blue-300">
              💡 Tip: Notifications help you save money by knowing when to pause services with no active shows!
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Subscriptions Modal Component
  const SubscriptionsModal = () => {
    const availableServices = [
      { id: 'Netflix', name: 'Netflix', color: 'from-red-600 to-red-700', price: 15.49 },
      { id: 'Max', name: 'Max (HBO)', color: 'from-purple-600 to-blue-600', price: 16.99 },
      { id: 'Hulu', name: 'Hulu', color: 'from-green-500 to-green-600', price: 17.99 },
      { id: 'Apple TV+', name: 'Apple TV+', color: 'from-gray-700 to-gray-800', price: 9.99 },
      { id: 'Paramount+', name: 'Paramount+', color: 'from-blue-500 to-blue-600', price: 11.99 },
      { id: 'Disney+', name: 'Disney+', color: 'from-blue-400 to-purple-500', price: 13.99 },
      { id: 'Prime Video', name: 'Prime Video', color: 'from-cyan-500 to-blue-500', price: 8.99 }
    ];

    // Calculate total monthly cost
    const totalMonthlyCost = availableServices
      .filter(service => userPreferences.subscriptions?.includes(service.id))
      .reduce((sum, service) => sum + service.price, 0);

    const toggleSubscription = (serviceId) => {
      const currentSubs = userPreferences.subscriptions || [];
      const newSubs = currentSubs.includes(serviceId)
        ? currentSubs.filter(s => s !== serviceId)
        : [...currentSubs, serviceId];

      const newPrefs = { ...userPreferences, subscriptions: newSubs };
      setUserPreferences(newPrefs);
      if (isAuthenticated) {
        writeUserData(currentUser.uid, 'preferences', newPrefs);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowSubscriptionsModal(false)}>
        <div
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-2xl p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">My Subscriptions</h2>
              <p className="text-sm text-gray-400 mt-1">Select the streaming services you subscribe to</p>
            </div>
            <button
              onClick={() => setShowSubscriptionsModal(false)}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            {availableServices.map(service => {
              const isSubscribed = userPreferences.subscriptions?.includes(service.id);
              return (
                <button
                  key={service.id}
                  onClick={() => toggleSubscription(service.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all ${
                    isSubscribed
                      ? 'border-purple-500 bg-white/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${service.color} flex items-center justify-center text-white font-bold text-sm`}>
                        {service.name.slice(0, 1)}
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-semibold">{service.name}</p>
                        <p className="text-xs text-gray-400">
                          ${service.price.toFixed(2)}/month
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSubscribed && (
                        <span className="text-sm font-medium text-purple-400">
                          ${service.price.toFixed(2)}
                        </span>
                      )}
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSubscribed
                          ? 'border-purple-500 bg-purple-500'
                          : 'border-white/30'
                      }`}>
                        {isSubscribed && <Check className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Total Cost Summary */}
          {totalMonthlyCost > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-300">Monthly Total</p>
                <p className="text-2xl font-bold text-white">
                  ${totalMonthlyCost.toFixed(2)}
                </p>
              </div>
              <p className="text-xs text-gray-400">
                ${(totalMonthlyCost * 12).toFixed(2)}/year • {userPreferences.subscriptions?.length || 0} {(userPreferences.subscriptions?.length || 0) === 1 ? 'service' : 'services'}
              </p>
            </div>
          )}

          <div className="mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
            <p className="text-sm text-purple-200">
              <strong>Tip:</strong> When you select "My Services" mode, only shows from your subscribed services will be displayed.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Auth Modal Component
  const AuthModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowAuthModal(false)}>
      <div
        className="w-full max-w-md rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            {authMode === 'signin' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <button onClick={() => setShowAuthModal(false)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {authError && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm">
            {authError}
          </div>
        )}

        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          if (authMode === 'signin') {
            handleSignIn(
              formData.get('email'),
              formData.get('password')
            );
          } else {
            handleSignUp(
              formData.get('email'),
              formData.get('password'),
              formData.get('displayName')
            );
          }
        }}>
          {authMode === 'signup' && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Display Name</label>
              <input
                type="text"
                name="displayName"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                placeholder="Your name"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              name="password"
              required
              minLength="6"
              className="w-full px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {authLoading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                {authMode === 'signin' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : (
              authMode === 'signin' ? 'Sign In' : 'Sign Up'
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/20"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-slate-900/95 text-gray-400">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={authLoading}
          className="w-full py-3 rounded-xl bg-white text-gray-700 font-medium hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border border-white/20"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {authLoading ? 'Signing in...' : 'Sign in with Google'}
        </button>

        <div className="mt-4 text-center text-sm">
          <button
            onClick={() => {
              setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
              setAuthError('');
            }}
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            {authMode === 'signin'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-900/70 border-b border-white/10">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <PlayCircle className="w-5 h-5" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                StreamTracker
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => setShowNotificationsModal(true)}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors relative"
                    title="Notifications"
                  >
                    <Bell className="w-4 h-4" />
                    {notifications.filter(n => !n.read).length > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-purple-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {notifications.filter(n => !n.read).length}
                      </span>
                    )}
                  </button>
                  <div
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                    title={currentUser?.displayName || currentUser?.email}
                  >
                    {currentUser?.displayName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ||
                     currentUser?.email?.slice(0, 2).toUpperCase() || 'U'}
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium text-sm hover:shadow-lg transition-all"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mt-3 flex gap-2 items-center justify-between">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {[
                { id: 'browse', label: 'Browse', icon: Home },
                { id: 'tracking', label: `Tracking${trackedShows.length > 0 ? ` (${trackedShows.length})` : ''}`, icon: Bookmark },
                { id: 'calendar', label: 'Calendar', icon: Calendar }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-white/20 backdrop-blur-sm text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="text-sm">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Display Mode & Subscriptions - Compact */}
            {activeTab === 'browse' && (
              <div className="flex gap-1 items-center ml-2">
                <select
                  value={userPreferences.displayMode || 'popular'}
                  onChange={(e) => {
                    const newPrefs = { ...userPreferences, displayMode: e.target.value };
                    setUserPreferences(newPrefs);
                    if (isAuthenticated) {
                      writeUserData(currentUser.uid, 'preferences', newPrefs);
                    }
                  }}
                  className="px-2 py-1.5 text-xs rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 focus:border-purple-500 focus:outline-none transition-all cursor-pointer"
                  title="Display Mode"
                >
                  <option value="popular" className="bg-slate-800">Popular</option>
                  <option value="topRated" className="bg-slate-800">Top Rated</option>
                  <option value="recentlyUpdated" className="bg-slate-800">Recently Updated</option>
                  <option value="today" className="bg-slate-800">Today</option>
                  <option value="myServices" className="bg-slate-800">My Services</option>
                  <option value="browseAll" className="bg-slate-800">Browse All</option>
                </select>
                <button
                  onClick={() => setShowSubscriptionsModal(true)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-all"
                  title="Manage Subscriptions"
                >
                  <Tv className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Search and Filter - Single Row */}
          <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search shows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 focus:border-purple-500 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="px-2 py-2 text-xs rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 focus:border-purple-500 focus:outline-none transition-all cursor-pointer whitespace-nowrap"
              title="Filter by Service"
            >
              {services.map(service => (
                <option key={service.id} value={service.id} className="bg-slate-800">
                  {service.name}
                </option>
              ))}
            </select>
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="px-2 py-2 text-xs rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 focus:border-purple-500 focus:outline-none transition-all cursor-pointer whitespace-nowrap"
              title="Filter by Genre"
            >
              {genres.map(genre => (
                <option key={genre.id} value={genre.id} className="bg-slate-800">
                  {genre.name}
                </option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2 py-2 text-xs rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 focus:border-purple-500 focus:outline-none transition-all cursor-pointer whitespace-nowrap"
              title="Filter by Status"
            >
              {statuses.map(status => (
                <option key={status.id} value={status.id} className="bg-slate-800">
                  {status.name}
                </option>
              ))}
            </select>
            {(selectedService !== 'all' || selectedStatus !== 'all' || selectedGenre !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedService('all');
                  setSelectedStatus('all');
                  setSelectedGenre('all');
                  setSearchQuery('');
                }}
                className="px-3 py-2 text-xs rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 transition-all whitespace-nowrap"
                title="Clear all filters"
              >
                Clear
              </button>
            )}

            {/* Pagination Controls for Browse All mode */}
            {activeTab === 'browse' && userPreferences.displayMode === 'browseAll' && (
              <div className="flex gap-1 items-center ml-auto">
                <button
                  onClick={() => fetchAllShowsPaginated(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="px-2 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Previous page"
                >
                  ←
                </button>
                <span className="text-xs text-gray-400 px-2">
                  Page {currentPage + 1}
                </span>
                <button
                  onClick={() => fetchAllShowsPaginated(currentPage + 1)}
                  className="px-2 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-all"
                  title="Next page"
                >
                  →
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 pb-20">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        )}

        {error && (
          <div className="max-w-2xl mx-auto p-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300">
            <p className="text-center">{error}</p>
            <button
              onClick={fetchPopularShows}
              className="mt-3 mx-auto block px-4 py-2 rounded-lg bg-red-500/30 hover:bg-red-500/40 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && activeTab === 'calendar' ? (
          <div className="max-w-4xl mx-auto space-y-3">
            {filteredShows
              .filter(show => show.nextEpisode)
              .sort((a, b) => new Date(a.nextEpisode.date) - new Date(b.nextEpisode.date))
              .map(show => (
                <div
                  key={show.id}
                  className="p-4 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                  onClick={() => setSelectedShow(show)}
                >
                  <div className="flex gap-3">
                    <img
                      src={show.poster}
                      alt={show.title}
                      className="w-16 h-24 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold mb-1 truncate">{show.title}</h3>
                      <p className="text-sm text-gray-400 mb-2 truncate">
                        S{show.nextEpisode.season}E{show.nextEpisode.episode} - {show.nextEpisode.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="flex items-center gap-1 text-purple-400">
                          <Calendar className="w-3 h-3" />
                          {new Date(show.nextEpisode.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300">
                          {show.service}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTracking(show.id);
                      }}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                        trackedShows.includes(show.id)
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                          : 'bg-white/10 text-gray-300'
                      }`}
                    >
                      {trackedShows.includes(show.id) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
              {filteredShows.filter(show => show.nextEpisode).length === 0 && (
                <div className="text-center py-16">
                  <Tv className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                  <p className="text-gray-400">No upcoming episodes</p>
                </div>
              )}
          </div>
        ) : !loading && !error ? (
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {filteredShows.map(show => (
                <div
                  key={show.id}
                  className="group relative cursor-pointer"
                  onClick={() => setSelectedShow(show)}
                >
                  <div className="relative overflow-hidden rounded-xl">
                    <img
                      src={show.poster}
                      alt={show.title}
                      className="w-full aspect-[2/3] object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <div className="flex items-center gap-1 mb-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          <span className="text-xs font-medium">{show.rating || 'N/A'}</span>
                        </div>
                        <p className="text-xs text-gray-300 line-clamp-2">{show.synopsis}</p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-2 left-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        show.status === 'Returning Series' ? 'bg-green-500/90 text-white' :
                        show.status === 'Ended' ? 'bg-gray-500/90 text-white' :
                        show.status === 'TBD' ? 'bg-yellow-500/90 text-white' :
                        show.status === 'In Development' ? 'bg-blue-500/90 text-white' :
                        'bg-gray-500/90 text-white'
                      }`}>
                        {show.status === 'Returning Series' ? '✓ Renewed' :
                         show.status === 'Ended' ? 'Ended' :
                         show.status === 'TBD' ? 'TBD' :
                         show.status}
                      </span>
                    </div>

                    {trackedShows.includes(show.id) && (
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="mt-2">
                    <h3 className="font-semibold text-sm line-clamp-1">{show.title}</h3>
                    <p className="text-xs text-gray-400">
                      {show.year} • {show.service}
                      {show.status === 'Returning Series' && show.nextEpisode && (
                        <span className="ml-1 text-green-400">• New episode soon</span>
                      )}
                    </p>
                    {trackedShows.includes(show.id) && activeTab === 'tracking' && (
                      <div className="mt-2">
                        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                            style={{ width: `${getShowProgress(show.id)}%` }}
                          />
                        </div>
                        <p className="text-xs text-purple-400 mt-1">{getShowProgress(show.id)}% watched</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {filteredShows.length === 0 && (
              <div className="text-center py-16">
                <Search className="w-16 h-16 mx-auto mb-4 text-gray-500" />
                <h3 className="text-lg font-semibold mb-2">No shows found</h3>
                <p className="text-sm text-gray-400">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        ) : null}
      </main>

      {/* Show Detail Modal */}
      {selectedShow && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm" onClick={() => setSelectedShow(null)}>
          <div className="min-h-screen px-4 py-8">
            <div
              className="max-w-2xl mx-auto rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <img
                  src={selectedShow.poster}
                  alt={selectedShow.title}
                  className="w-full h-48 object-cover opacity-30"
                />
                <button
                  onClick={() => setSelectedShow(null)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900">
                  <div className="flex gap-3">
                    <img
                      src={selectedShow.poster}
                      alt={selectedShow.title}
                      className="w-20 h-30 rounded-lg object-cover shadow-xl flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold mb-2">{selectedShow.title}</h2>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {selectedShow.rating > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            {selectedShow.rating}
                          </span>
                        )}
                        <span>{selectedShow.year}</span>
                        <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300">
                          {selectedShow.service}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          selectedShow.status === 'Returning Series' ? 'bg-green-500/20 text-green-300' :
                          selectedShow.status === 'Ended' ? 'bg-gray-500/20 text-gray-300' :
                          selectedShow.status === 'TBD' ? 'bg-yellow-500/20 text-yellow-300' :
                          selectedShow.status === 'In Development' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-orange-500/20 text-orange-300'
                        }`}>
                          {selectedShow.status === 'Returning Series' ? '✓ Renewed' :
                           selectedShow.status === 'Ended' ? 'Ended' :
                           selectedShow.status === 'TBD' ? 'Status TBD' :
                           selectedShow.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <button
                  onClick={() => toggleTracking(selectedShow.id)}
                  className={`w-full py-3 rounded-xl font-medium mb-4 transition-all ${
                    trackedShows.includes(selectedShow.id)
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  {trackedShows.includes(selectedShow.id) ? (
                    <span className="flex items-center justify-center gap-2">
                      <Check className="w-5 h-5" />
                      Tracking
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Plus className="w-5 h-5" />
                      Track Show
                    </span>
                  )}
                </button>

                {/* Status Information Banner */}
                {selectedShow.status === 'Returning Series' && (
                  <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30">
                    <p className="text-sm text-green-300">
                      <strong>✓ Good News!</strong> This show has been renewed and will return with new episodes.
                    </p>
                  </div>
                )}
                {selectedShow.status === 'Ended' && (
                  <div className="mb-4 p-3 rounded-xl bg-gray-500/10 border border-gray-500/30">
                    <p className="text-sm text-gray-300">
                      <strong>Series Finale:</strong> This show has ended. No new episodes will be released.
                    </p>
                  </div>
                )}
                {selectedShow.status === 'TBD' && (
                  <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                    <p className="text-sm text-yellow-300">
                      <strong>Status Unknown:</strong> The network hasn't announced if this show will be renewed or canceled.
                    </p>
                  </div>
                )}
                {selectedShow.status === 'In Development' && (
                  <div className="mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
                    <p className="text-sm text-blue-300">
                      <strong>Coming Soon:</strong> This show is currently in development and will premiere soon.
                    </p>
                  </div>
                )}

                {/* Show Info Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Network</p>
                    <p className="text-sm font-medium">{selectedShow.networkName}</p>
                  </div>
                  {selectedShow.runtime && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-gray-400 mb-1">Runtime</p>
                      <p className="text-sm font-medium">{selectedShow.runtime} min</p>
                    </div>
                  )}
                  {selectedShow.premiered && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-gray-400 mb-1">Premiered</p>
                      <p className="text-sm font-medium">{new Date(selectedShow.premiered).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  )}
                  {selectedShow.ended && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-gray-400 mb-1">Ended</p>
                      <p className="text-sm font-medium">{new Date(selectedShow.ended).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  )}
                </div>

                {/* Regular Schedule */}
                {selectedShow.schedule && selectedShow.schedule.days.length > 0 && (
                  <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                    <h3 className="font-semibold mb-2 text-sm">Regular Schedule</h3>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedShow.schedule.days.map(day => (
                        <span key={day} className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium">
                          {day}s
                        </span>
                      ))}
                    </div>
                    {selectedShow.schedule.time && (
                      <p className="text-xs text-gray-300">
                        at {selectedShow.schedule.time} ({selectedShow.schedule.timezone})
                      </p>
                    )}
                  </div>
                )}

                {/* Next Episode with Countdown */}
                {selectedShow.nextEpisode && (
                  <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm">Next Episode</h3>
                      {selectedShow.nextEpisode.daysUntil !== null && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          selectedShow.nextEpisode.daysUntil === 0 ? 'bg-green-500/20 text-green-300' :
                          selectedShow.nextEpisode.daysUntil === 1 ? 'bg-yellow-500/20 text-yellow-300' :
                          selectedShow.nextEpisode.daysUntil < 7 ? 'bg-purple-500/20 text-purple-300' :
                          'bg-gray-500/20 text-gray-300'
                        }`}>
                          {selectedShow.nextEpisode.daysUntil === 0 ? 'Today!' :
                           selectedShow.nextEpisode.daysUntil === 1 ? 'Tomorrow' :
                           selectedShow.nextEpisode.daysUntil < 0 ? 'Aired' :
                           `in ${selectedShow.nextEpisode.daysUntil} days`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-200 mb-1">
                      S{selectedShow.nextEpisode.season}E{selectedShow.nextEpisode.episode} - {selectedShow.nextEpisode.title}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(selectedShow.nextEpisode.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                      {selectedShow.nextEpisode.time && (
                        <span>{selectedShow.nextEpisode.time}</span>
                      )}
                      {selectedShow.nextEpisode.runtime && (
                        <span>{selectedShow.nextEpisode.runtime} min</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="font-semibold mb-2 text-sm">Synopsis</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">{selectedShow.synopsis}</p>
                </div>

                {selectedShow.genre.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {selectedShow.genre.map(genre => (
                      <span key={genre} className="px-2.5 py-1 rounded-full bg-white/10 text-xs">
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                {selectedShow.officialSite && (
                  <a
                    href={selectedShow.officialSite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
                  >
                    <Tv className="w-4 h-4" />
                    Visit Official Site
                  </a>
                )}

                {trackedShows.includes(selectedShow.id) && selectedShow.episodes.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 text-sm">Episodes</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {[...new Set(selectedShow.episodes.map(ep => ep.season))].map(seasonNum => {
                        const seasonEpisodes = selectedShow.episodes.filter(ep => ep.season === seasonNum);
                        return (
                          <div key={seasonNum} className="p-3 rounded-xl bg-white/5 border border-white/10">
                            <h4 className="font-medium mb-2 text-sm">Season {seasonNum}</h4>
                            <div className="space-y-2">
                              {seasonEpisodes.map(ep => {
                                const key = `${selectedShow.id}-${ep.season}-${ep.number}`;
                                const isWatched = watchedEpisodes[key];

                                // Check if episode has aired
                                const hasAired = ep.airdate ? new Date(ep.airdate) <= new Date() : true;
                                const isFuture = !hasAired;

                                return (
                                  <div
                                    key={ep.id}
                                    className="group relative"
                                  >
                                    <button
                                      onClick={() => {
                                        if (!isFuture) {
                                          toggleEpisode(selectedShow.id, ep.season, ep.number);
                                        }
                                      }}
                                      disabled={isFuture}
                                      className={`w-full flex gap-3 p-2 rounded-lg transition-all ${
                                        isFuture
                                          ? 'bg-slate-800/50 border-2 border-slate-700/50 opacity-60 cursor-not-allowed'
                                          : isWatched
                                          ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 border-2 border-purple-500/50'
                                          : 'bg-white/5 hover:bg-white/10 border-2 border-transparent hover:border-white/20'
                                      }`}
                                      title={isFuture ? `Airs ${new Date(ep.airdate).toLocaleDateString()}` : isWatched ? 'Click to unmark' : 'Click to mark as watched'}
                                    >
                                      {/* Episode Thumbnail */}
                                      <div className="relative w-24 h-14 flex-shrink-0 rounded overflow-hidden bg-slate-800">
                                        {ep.image ? (
                                          <img
                                            src={ep.image}
                                            alt={ep.name}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-gray-500">
                                            <PlayCircle className="w-6 h-6" />
                                          </div>
                                        )}
                                        {/* Watched Checkmark Overlay */}
                                        {isWatched && (
                                          <div className="absolute inset-0 bg-purple-500/40 flex items-center justify-center">
                                            <Check className="w-6 h-6 text-white" />
                                          </div>
                                        )}
                                        {/* Future Episode Overlay */}
                                        {isFuture && (
                                          <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
                                            <span className="text-xs font-bold text-gray-400">Soon</span>
                                          </div>
                                        )}
                                        {/* Episode Number Badge */}
                                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs font-bold">
                                          E{ep.number}
                                        </div>
                                      </div>

                                      {/* Episode Info */}
                                      <div className="flex-1 min-w-0 text-left">
                                        <h5 className="text-sm font-medium text-gray-200 truncate mb-1">
                                          {ep.name}
                                        </h5>
                                        {ep.summary && (
                                          <p className="text-xs text-gray-400 line-clamp-2">
                                            {ep.summary}
                                          </p>
                                        )}
                                        {ep.airdate && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            {new Date(ep.airdate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                          </p>
                                        )}
                                      </div>

                                      {/* Click to mark indicator or future episode indicator */}
                                      {isFuture ? (
                                        <div className="flex-shrink-0 flex items-center">
                                          <span className="text-xs text-orange-400 font-medium">Coming Soon</span>
                                        </div>
                                      ) : !isWatched && (
                                        <div className="flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <span className="text-xs text-gray-400 mr-2">Click to mark watched</span>
                                          <div className="w-5 h-5 rounded border-2 border-gray-400"></div>
                                        </div>
                                      )}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Modal */}
      {showNotificationsModal && <NotificationsModal />}

      {/* Subscriptions Modal */}
      {showSubscriptionsModal && <SubscriptionsModal />}

      {/* Auth Modal */}
      {showAuthModal && <AuthModal />}

      {/* Welcome Overlay */}
      {!isAuthenticated && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 p-4 rounded-xl bg-gradient-to-r from-purple-500/90 to-pink-500/90 backdrop-blur-sm text-white shadow-2xl z-30">
          <p className="text-sm font-medium mb-2">Welcome to StreamTracker!</p>
          <p className="text-xs opacity-90 mb-3">Sign in to track shows, mark episodes, and sync across devices.</p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="w-full py-2 rounded-lg bg-white text-purple-600 font-medium text-sm hover:bg-gray-100 transition-colors"
          >
            Get Started
          </button>
        </div>
      )}
    </div>
  );
};

export default StreamTracker;
