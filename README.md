# StreamTracker

A modern TV show tracking application with Firebase authentication and real-time database synchronization. Browse shows from multiple streaming services, track your favorites, and mark episodes as watched.

## Features

- **Multi-Service Browse**: Search and filter shows across Netflix, Max, Hulu, Apple TV+, Disney+, Paramount+, and Prime Video
- **Show Tracking**: Add shows to your personal tracking list
- **Episode Progress**: Mark episodes as watched and track your progress per show
- **Calendar View**: See upcoming episodes for shows you're tracking
- **Firebase Authentication**: Secure sign-up and sign-in with email/password
- **Real-time Sync**: Your data syncs across devices via Firebase Realtime Database
- **Offline Support**: Falls back to localStorage when offline
- **TVMaze API**: Real show data from the TVMaze API (free, no API key required)
- **Mobile Responsive**: Beautiful glassmorphism UI that works on all devices

## Tech Stack

- **React 18** - UI framework
- **Firebase** - Authentication & Realtime Database
- **Lucide React** - Icon library
- **TVMaze API** - Show data
- **Tailwind CSS** - Styling (via inline styles)

## Project Structure

```
TV_StreamTracker/
├── public/
│   └── index.html          # HTML template
├── src/
│   ├── App.js              # Main application component
│   ├── App.css             # Global styles
│   ├── firebase.js         # Firebase configuration & utilities
│   └── index.js            # React entry point
├── package.json            # Dependencies & scripts
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## Prerequisites

Before you begin, ensure you have installed:

- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**

Check your installation:
```bash
node --version
npm --version
```

## Quick Start

### The Easiest Way (In VS Code)

**You're already here! Just use VS Code:**

1. **Look for "NPM SCRIPTS"** in the Explorer sidebar (bottom left)
2. **Click ▶️** next to "start"
3. **Wait** for "Compiled successfully!" (~20 seconds)
4. **Ctrl+Click** the localhost:3000 link in the terminal
5. **Done!** 🎉

**Alternative:** Press `` Ctrl + ` `` → Type `npm start` → Press Enter

### First Time Setup

Only need to do this once:

```bash
npm install
```

This installs all dependencies. After this, just use `npm start` every time.

### Manual Setup (If Needed)

#### Step 1: Install Dependencies

```bash
npm install
```

This installs:
- react & react-dom
- react-scripts (Create React App build tools)
- firebase (v10.7.1+)
- lucide-react (icons)

#### Step 2: Start Development Server

```bash
npm start
```

The app will open automatically at [http://localhost:3000](http://localhost:3000)

## Available Scripts

### `npm start`
Runs the app in development mode at [http://localhost:3000](http://localhost:3000)

The page will reload when you make changes. You may also see lint errors in the console.

### `npm run build`
Builds the app for production to the `build` folder.

The build is minified and optimized for best performance. Your app is ready to be deployed!

### `npm test`
Launches the test runner in interactive watch mode.

## Firebase Setup

The app is already configured with Firebase credentials. Your Firebase project includes:

### Authentication
- **Provider**: Email/Password authentication
- **Security**: Passwords must be at least 6 characters

### Realtime Database
- **Structure**:
  ```
  users/
    {userId}/
      email: string
      displayName: string
      trackedShows: [showId1, showId2, ...]
      watchedEpisodes: {
        "showId-season-episode": true,
        ...
      }
      preferences: {
        notifications: boolean,
        autoMarkWatched: boolean,
        defaultService: string
      }
      createdAt: timestamp
  ```

- **Security Rules**: Already configured to allow users to read/write only their own data

### Offline Support
The app automatically falls back to localStorage when:
- Firebase is unreachable
- User is offline
- Firebase quota is exceeded

Data syncs to Firebase when connectivity is restored.

## TVMaze API Integration

The app uses the free TVMaze API for show data:
- **No API key required**
- **Endpoints used**:
  - `/schedule?country=US` - Today's airing shows
  - `/shows/{id}?embed[]=episodes&embed[]=nextepisode` - Show details
  - `/search/shows?q={query}` - Search shows
  - `/singlesearch/shows?q={name}` - Find specific show

**Rate Limits**: The API has no strict rate limits but please be respectful with requests.

## Deployment

### Deploy to Vercel

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   npm run build
   vercel --prod
   ```

### Deploy to Netlify

1. Build the app:
   ```bash
   npm run build
   ```

2. Deploy the `build` folder:
   - Drag and drop to [Netlify Drop](https://app.netlify.com/drop)
   - Or use Netlify CLI:
     ```bash
     npm i -g netlify-cli
     netlify deploy --prod --dir=build
     ```

### Deploy to Firebase Hosting

1. Install Firebase CLI:
   ```bash
   npm i -g firebase-tools
   ```

2. Login and initialize:
   ```bash
   firebase login
   firebase init hosting
   ```

3. Build and deploy:
   ```bash
   npm run build
   firebase deploy
   ```

## Troubleshooting

### Port 3000 Already in Use

If you see "Port 3000 is already in use":

**Windows**:
```bash
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Mac/Linux**:
```bash
lsof -ti:3000 | xargs kill -9
```

Or set a different port:
```bash
set PORT=3001 && npm start   # Windows
PORT=3001 npm start          # Mac/Linux
```

### Firebase Connection Issues

If Firebase fails to connect:
- Check your internet connection
- Verify Firebase credentials in `src/firebase.js`
- Check Firebase console for project status
- The app will fallback to localStorage automatically

### TVMaze API Issues

If shows don't load:
- Check your internet connection
- TVMaze API may be temporarily down (rare)
- CORS errors: TVMaze allows CORS by default, but some browsers may block it
- Try searching for a specific show name

### Build Errors

If you encounter build errors:

1. Clear node_modules and reinstall:
   ```bash
   rmdir /s node_modules  # Windows
   rm -rf node_modules    # Mac/Linux
   npm install
   ```

2. Clear npm cache:
   ```bash
   npm cache clean --force
   npm install
   ```

3. Check Node.js version (must be v14+):
   ```bash
   node --version
   ```

### CSS Not Loading

If styles don't appear correctly:
- Ensure `src/App.css` is imported in `src/index.js`
- Try clearing browser cache (Ctrl+F5)
- Check browser console for errors

## Usage Guide

### Creating an Account

1. Click "Sign In" in the top right
2. Click "Don't have an account? Sign up"
3. Enter your email, password (6+ characters), and display name
4. Click "Sign Up"

### Tracking Shows

1. Browse shows in the "Browse" tab
2. Click on a show to view details
3. Click "Track Show" to add it to your tracking list
4. View tracked shows in the "Tracking" tab

### Marking Episodes Watched

1. Go to "Tracking" tab
2. Click on a tracked show
3. Scroll to "Episodes" section
4. Click episode numbers to toggle watched status
5. Progress bar updates automatically

### Calendar View

1. Go to "Calendar" tab
2. See upcoming episodes for your tracked shows
3. Sorted by air date
4. Click a show to view details

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

Requires a modern browser with ES6+ support.

## Performance Tips

- The app loads 20-30 shows initially for better performance
- Search results are limited to 50 shows
- Images are lazy-loaded
- Firebase data is cached locally

## Security Notes

- **Never commit credentials**: `.gitignore` excludes sensitive files
- **Firebase security rules**: Users can only access their own data
- **Client-side only**: No backend server required
- **HTTPS recommended**: Use HTTPS in production for Firebase auth

## Contributing

This is a personal project, but suggestions are welcome!

## License

MIT License - feel free to use this project for learning or personal use.

## Acknowledgments

- **TVMaze** for providing free TV show data
- **Firebase** for authentication and database services
- **Lucide** for beautiful icons
- **React team** for an amazing framework

## Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Review the browser console for errors
3. Ensure Firebase credentials are correct
4. Verify internet connectivity

## Roadmap

Potential future features:
- [ ] Push notifications for new episodes
- [ ] User ratings and reviews
- [ ] Social features (share tracking with friends)
- [ ] Custom watchlists
- [ ] Dark/light theme toggle
- [ ] Export watch history
- [ ] Integration with more streaming services

---

**Enjoy tracking your shows!** 🎬✨
