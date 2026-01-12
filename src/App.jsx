import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';

// Firebase config
const FIREBASE_URL = 'https://babymonitor-19eba-default-rtdb.firebaseio.com';
const FIREBASE_API_KEY = 'AIzaSyDGas0vg_7l5XXfvxJLsASoV81MqBQxCzk';

// Auth endpoints
const AUTH_SIGNUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`;
const AUTH_LOGIN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
const AUTH_REFRESH_URL = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;

export default function BabyMonitor() {
  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // App state
  const [activeTab, setActiveTab] = useState('feeds');
  const [feeds, setFeeds] = useState([]);
  const [diapers, setDiapers] = useState([]);
  const [selectedHour, setSelectedHour] = useState(new Date().getHours());
  const [selectedMinute, setSelectedMinute] = useState(new Date().getMinutes());
  const [selectedOunces, setSelectedOunces] = useState(4);
  const [selectedDiaperType, setSelectedDiaperType] = useState('wet');
  const [editingId, setEditingId] = useState(null);
  const [editingDiaperId, setEditingDiaperId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session
  useEffect(() => {
    const savedAuth = localStorage.getItem('babyMonitorAuth');
    if (savedAuth) {
      try {
        const authData = JSON.parse(savedAuth);
        if (authData.expiresAt > Date.now()) {
          setUser(authData);
        } else {
          refreshToken(authData.refreshToken);
          return;
        }
      } catch (e) {
        localStorage.removeItem('babyMonitorAuth');
      }
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      fetchFeeds();
      fetchDiapers();
    }
  }, [user]);

  const refreshToken = async (token) => {
    try {
      const response = await fetch(AUTH_REFRESH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: token
        })
      });
      const data = await response.json();
      if (data.id_token) {
        const authData = {
          idToken: data.id_token,
          refreshToken: data.refresh_token,
          localId: data.user_id,
          email: user?.email || '',
          expiresAt: Date.now() + (parseInt(data.expires_in) * 1000)
        };
        localStorage.setItem('babyMonitorAuth', JSON.stringify(authData));
        setUser(authData);
      } else {
        localStorage.removeItem('babyMonitorAuth');
      }
    } catch (error) {
      localStorage.removeItem('babyMonitorAuth');
    }
    setAuthLoading(false);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);

    if (authMode === 'signup' && password !== confirmPassword) {
      setAuthError('Passwords do not match');
      setAuthSubmitting(false);
      return;
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters');
      setAuthSubmitting(false);
      return;
    }

    const url = authMode === 'signup' ? AUTH_SIGNUP_URL : AUTH_LOGIN_URL;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true
        })
      });

      const data = await response.json();

      if (data.error) {
        const errorMessages = {
          'EMAIL_EXISTS': 'An account with this email already exists',
          'EMAIL_NOT_FOUND': 'No account found with this email',
          'INVALID_PASSWORD': 'Incorrect password',
          'INVALID_EMAIL': 'Please enter a valid email address',
          'WEAK_PASSWORD': 'Password must be at least 6 characters',
          'INVALID_LOGIN_CREDENTIALS': 'Invalid email or password',
          'TOO_MANY_ATTEMPTS_TRY_LATER': 'Too many attempts. Please try again later'
        };
        setAuthError(errorMessages[data.error.message] || data.error.message);
        setAuthSubmitting(false);
        return;
      }

      const authData = {
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        localId: data.localId,
        email: data.email,
        expiresAt: Date.now() + (parseInt(data.expiresIn) * 1000)
      };

      localStorage.setItem('babyMonitorAuth', JSON.stringify(authData));
      setUser(authData);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setAuthError('Network error. Please try again.');
    }
    setAuthSubmitting(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('babyMonitorAuth');
    setUser(null);
    setFeeds([]);
    setDiapers([]);
  };

  // Feeds functions
  const fetchFeeds = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(
        `${FIREBASE_URL}/users/${user.localId}/feeds.json?auth=${user.idToken}`
      );
      const data = await response.json();
      if (data && !data.error) {
        const feedsArray = Object.entries(data).map(([id, feed]) => ({
          id,
          ...feed
        })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setFeeds(feedsArray);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching feeds:', error);
      setLoading(false);
    }
  };

  const saveFeed = async () => {
    if (!user) return;

    const now = new Date();
    const feedTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), selectedHour, selectedMinute);
    
    const feedData = {
      timestamp: feedTime.toISOString(),
      ounces: selectedOunces,
      createdAt: now.toISOString()
    };

    try {
      if (editingId) {
        await fetch(
          `${FIREBASE_URL}/users/${user.localId}/feeds/${editingId}.json?auth=${user.idToken}`,
          {
            method: 'PUT',
            body: JSON.stringify(feedData)
          }
        );
        setEditingId(null);
      } else {
        await fetch(
          `${FIREBASE_URL}/users/${user.localId}/feeds.json?auth=${user.idToken}`,
          {
            method: 'POST',
            body: JSON.stringify(feedData)
          }
        );
      }
      fetchFeeds();
      resetToCurrentTime();
    } catch (error) {
      console.error('Error saving feed:', error);
    }
  };

  const deleteFeed = async (id) => {
    if (!user) return;

    try {
      await fetch(
        `${FIREBASE_URL}/users/${user.localId}/feeds/${id}.json?auth=${user.idToken}`,
        {
          method: 'DELETE'
        }
      );
      fetchFeeds();
    } catch (error) {
      console.error('Error deleting feed:', error);
    }
  };

  const editFeed = (feed) => {
    const feedDate = new Date(feed.timestamp);
    setSelectedHour(feedDate.getHours());
    setSelectedMinute(feedDate.getMinutes());
    setSelectedOunces(feed.ounces);
    setEditingId(feed.id);
  };

  // Diaper functions
  const fetchDiapers = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(
        `${FIREBASE_URL}/users/${user.localId}/diapers.json?auth=${user.idToken}`
      );
      const data = await response.json();
      if (data && !data.error) {
        const diapersArray = Object.entries(data).map(([id, diaper]) => ({
          id,
          ...diaper
        })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setDiapers(diapersArray);
      }
    } catch (error) {
      console.error('Error fetching diapers:', error);
    }
  };

  const saveDiaper = async () => {
    if (!user) return;

    const now = new Date();
    const diaperTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), selectedHour, selectedMinute);
    
    const diaperData = {
      timestamp: diaperTime.toISOString(),
      type: selectedDiaperType,
      createdAt: now.toISOString()
    };

    try {
      if (editingDiaperId) {
        await fetch(
          `${FIREBASE_URL}/users/${user.localId}/diapers/${editingDiaperId}.json?auth=${user.idToken}`,
          {
            method: 'PUT',
            body: JSON.stringify(diaperData)
          }
        );
        setEditingDiaperId(null);
      } else {
        await fetch(
          `${FIREBASE_URL}/users/${user.localId}/diapers.json?auth=${user.idToken}`,
          {
            method: 'POST',
            body: JSON.stringify(diaperData)
          }
        );
      }
      fetchDiapers();
      resetToCurrentTime();
      setSelectedDiaperType('wet');
    } catch (error) {
      console.error('Error saving diaper:', error);
    }
  };

  const deleteDiaper = async (id) => {
    if (!user) return;

    try {
      await fetch(
        `${FIREBASE_URL}/users/${user.localId}/diapers/${id}.json?auth=${user.idToken}`,
        {
          method: 'DELETE'
        }
      );
      fetchDiapers();
    } catch (error) {
      console.error('Error deleting diaper:', error);
    }
  };

  const editDiaper = (diaper) => {
    const diaperDate = new Date(diaper.timestamp);
    setSelectedHour(diaperDate.getHours());
    setSelectedMinute(diaperDate.getMinutes());
    setSelectedDiaperType(diaper.type);
    setEditingDiaperId(diaper.id);
  };

  const resetToCurrentTime = () => {
    const now = new Date();
    setSelectedHour(now.getHours());
    setSelectedMinute(now.getMinutes());
    setSelectedOunces(4);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingDiaperId(null);
    resetToCurrentTime();
    setSelectedDiaperType('wet');
  };

  // Feed Analytics
  const getLast14DaysFeedData = () => {
    const days = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const dayFeeds = feeds.filter(feed => {
        const feedDate = new Date(feed.timestamp);
        return feedDate >= dayStart && feedDate < dayEnd;
      });
      
      const totalOz = dayFeeds.reduce((sum, feed) => sum + feed.ounces, 0);
      
      days.push({
        shortDate: dayStart.toLocaleDateString('en-US', { day: 'numeric' }),
        ounces: totalOz,
        isToday: i === 0
      });
    }
    return days;
  };

  const getTodayFeedStats = () => {
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayFeeds = feeds.filter(feed => new Date(feed.timestamp) >= dayStart);
    const totalOz = todayFeeds.reduce((sum, feed) => sum + feed.ounces, 0);
    
    const lastFeed = todayFeeds.length > 0 
      ? new Date(Math.max(...todayFeeds.map(f => new Date(f.timestamp))))
      : null;
    
    return {
      totalOz,
      feedCount: todayFeeds.length,
      lastFeed,
      avgPerFeed: todayFeeds.length > 0 ? (totalOz / todayFeeds.length).toFixed(1) : 0
    };
  };

  // Diaper Analytics
  const getLast14DaysDiaperData = () => {
    const days = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const dayDiapers = diapers.filter(diaper => {
        const diaperDate = new Date(diaper.timestamp);
        return diaperDate >= dayStart && diaperDate < dayEnd;
      });
      
      const wetCount = dayDiapers.filter(d => d.type === 'wet').length;
      const dirtyCount = dayDiapers.filter(d => d.type === 'dirty').length;
      const bothCount = dayDiapers.filter(d => d.type === 'both').length;
      
      days.push({
        shortDate: dayStart.toLocaleDateString('en-US', { day: 'numeric' }),
        wet: wetCount,
        dirty: dirtyCount + bothCount,
        total: dayDiapers.length,
        isToday: i === 0
      });
    }
    return days;
  };

  const getTodayDiaperStats = () => {
    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayDiapers = diapers.filter(diaper => new Date(diaper.timestamp) >= dayStart);
    
    const wetCount = todayDiapers.filter(d => d.type === 'wet').length;
    const dirtyCount = todayDiapers.filter(d => d.type === 'dirty').length;
    const bothCount = todayDiapers.filter(d => d.type === 'both').length;
    
    const lastDiaper = todayDiapers.length > 0 
      ? new Date(Math.max(...todayDiapers.map(d => new Date(d.timestamp))))
      : null;
    
    return {
      total: todayDiapers.length,
      wet: wetCount + bothCount,
      dirty: dirtyCount + bothCount,
      lastDiaper
    };
  };

  const feedChartData = getLast14DaysFeedData();
  const todayFeedStats = getTodayFeedStats();
  const maxOz = Math.max(...feedChartData.map(d => d.ounces), 20);

  const diaperChartData = getLast14DaysDiaperData();
  const todayDiaperStats = getTodayDiaperStats();
  const maxDiapers = Math.max(...diaperChartData.map(d => d.total), 10);

  // Scroll Wheel Component
  const ScrollWheel = ({ values, selected, onChange, label, width = 80 }) => {
    const containerRef = useRef(null);
    const itemHeight = 44;
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(0);
    const startScroll = useRef(0);

    useEffect(() => {
      if (containerRef.current && !isDragging) {
        const index = values.indexOf(selected);
        containerRef.current.scrollTop = index * itemHeight;
      }
    }, [selected, values, isDragging]);

    const handleScroll = () => {
      if (containerRef.current) {
        const index = Math.round(containerRef.current.scrollTop / itemHeight);
        const clampedIndex = Math.max(0, Math.min(index, values.length - 1));
        if (values[clampedIndex] !== selected) {
          onChange(values[clampedIndex]);
        }
      }
    };

    const handleTouchStart = (e) => {
      setIsDragging(true);
      startY.current = e.touches[0].clientY;
      startScroll.current = containerRef.current.scrollTop;
    };

    const handleTouchMove = (e) => {
      if (!isDragging) return;
      const deltaY = startY.current - e.touches[0].clientY;
      containerRef.current.scrollTop = startScroll.current + deltaY;
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      if (containerRef.current) {
        const index = Math.round(containerRef.current.scrollTop / itemHeight);
        const clampedIndex = Math.max(0, Math.min(index, values.length - 1));
        containerRef.current.scrollTo({
          top: clampedIndex * itemHeight,
          behavior: 'smooth'
        });
        onChange(values[clampedIndex]);
      }
    };

    return (
      <div className="flex flex-col items-center">
        <span className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">{label}</span>
        <div className="relative" style={{ height: itemHeight * 3, width }}>
          <div className="absolute inset-x-0 top-0 h-11 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none rounded-t-xl" />
          <div className="absolute inset-x-0 bottom-0 h-11 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none rounded-b-xl" />
          <div 
            className="absolute inset-x-0 bg-blue-50 border-y-2 border-blue-200 z-0"
            style={{ top: itemHeight, height: itemHeight }}
          />
          <div
            ref={containerRef}
            className="h-full overflow-y-scroll scrollbar-hide relative z-5"
            style={{ 
              scrollSnapType: 'y mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
            onScroll={handleScroll}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div style={{ height: itemHeight }} />
            {values.map((value, index) => (
              <div
                key={index}
                className={`flex items-center justify-center font-semibold transition-all duration-150 ${
                  value === selected 
                    ? 'text-blue-600 text-2xl' 
                    : 'text-slate-300 text-lg'
                }`}
                style={{ 
                  height: itemHeight,
                  scrollSnapAlign: 'center'
                }}
                onClick={() => {
                  onChange(value);
                  containerRef.current?.scrollTo({
                    top: index * itemHeight,
                    behavior: 'smooth'
                  });
                }}
              >
                {typeof value === 'number' ? value.toString().padStart(2, '0') : value}
              </div>
            ))}
            <div style={{ height: itemHeight }} />
          </div>
        </div>
      </div>
    );
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);
  const ounces = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getTimeSince = (timestamp) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m ago`;
    return `${mins}m ago`;
  };

  const getDiaperEmoji = (type) => {
    switch(type) {
      case 'wet': return '💧';
      case 'dirty': return '💩';
      case 'both': return '💧💩';
      default: return '👶';
    }
  };

  const getDiaperLabel = (type) => {
    switch(type) {
      case 'wet': return 'Wet';
      case 'dirty': return 'Dirty';
      case 'both': return 'Both';
      default: return type;
    }
  };

  // Auth Loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🍼</div>
          <div className="text-blue-500 text-lg font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  // Login/Signup Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-50 flex items-center justify-center px-4">
        <style>{`
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
        
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-6xl mb-3">👶</div>
            <h1 className="text-2xl font-bold text-slate-800">Baby Tracker</h1>
            <p className="text-slate-500 mt-1">Track feeds & diapers</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-6">
            <div className="flex mb-6 bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                  authMode === 'login'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Log In
              </button>
              <button
                onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                  authMode === 'signup'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign Up
              </button>
            </div>

            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {authError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700"
                />
              </div>

              {authMode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-700"
                  />
                </div>
              )}

              <button
                onClick={handleAuth}
                disabled={authSubmitting || !email || !password}
                className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {authSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  authMode === 'login' ? 'Log In' : 'Create Account'
                )}
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-slate-400 mt-6">
            Your data is securely stored and synced across devices
          </p>
        </div>
      </div>
    );
  }

  // Loading feeds
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-blue-500 text-lg font-medium">Loading...</div>
      </div>
    );
  }

  // Main App
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-50 pb-20">
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-5 shadow-lg">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span>👶</span> Baby Tracker
            </h1>
            <p className="text-blue-100 text-xs mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex bg-white rounded-xl p-1 shadow-sm border border-blue-100">
          <button
            onClick={() => setActiveTab('feeds')}
            className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              activeTab === 'feeds'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>🍼</span> Feeds
          </button>
          <button
            onClick={() => setActiveTab('diapers')}
            className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              activeTab === 'diapers'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>🧷</span> Diapers
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        
        {/* FEEDS TAB */}
        {activeTab === 'feeds' && (
          <>
            {/* Today's Feed Stats */}
            <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Today's Feeds</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{todayFeedStats.totalOz}</div>
                  <div className="text-xs text-slate-400 mt-1">Total oz</div>
                </div>
                <div className="text-center border-x border-slate-100">
                  <div className="text-3xl font-bold text-blue-600">{todayFeedStats.feedCount}</div>
                  <div className="text-xs text-slate-400 mt-1">Feeds</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{todayFeedStats.avgPerFeed}</div>
                  <div className="text-xs text-slate-400 mt-1">Avg oz</div>
                </div>
              </div>
              {todayFeedStats.lastFeed && (
                <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                  <span className="text-slate-400 text-sm">Last feed: </span>
                  <span className="text-blue-600 font-semibold">{getTimeSince(todayFeedStats.lastFeed)}</span>
                </div>
              )}
            </div>

            {/* 14-Day Feed Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Last 14 Days</h2>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={feedChartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <XAxis 
                      dataKey="shortDate" 
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      domain={[0, maxOz]}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Bar dataKey="ounces" radius={[4, 4, 0, 0]}>
                      {feedChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.isToday ? '#3b82f6' : '#bfdbfe'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Add/Edit Feed */}
            <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                  {editingId ? 'Edit Feed' : 'Log Feed'}
                </h2>
                {!editingId && (
                  <button 
                    onClick={resetToCurrentTime}
                    className="text-xs text-blue-500 font-medium hover:text-blue-600"
                  >
                    Reset to Now
                  </button>
                )}
              </div>

              <div className="flex justify-center items-center gap-2 mb-6">
                <ScrollWheel 
                  values={hours} 
                  selected={selectedHour} 
                  onChange={setSelectedHour}
                  label="Hour"
                  width={70}
                />
                <div className="text-3xl font-bold text-slate-300 mt-5">:</div>
                <ScrollWheel 
                  values={minutes} 
                  selected={selectedMinute} 
                  onChange={setSelectedMinute}
                  label="Min"
                  width={70}
                />
                <div className="w-4" />
                <ScrollWheel 
                  values={ounces} 
                  selected={selectedOunces} 
                  onChange={setSelectedOunces}
                  label="Ounces"
                  width={70}
                />
              </div>

              <div className="flex gap-3">
                {editingId && (
                  <button
                    onClick={cancelEdit}
                    className="flex-1 py-3 rounded-xl font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={saveFeed}
                  className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-200 transition-all"
                >
                  {editingId ? 'Update' : 'Log Feed'}
                </button>
              </div>
            </div>

            {/* Recent Feeds */}
            <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Recent Feeds</h2>
              
              {feeds.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <div className="text-4xl mb-2">🍼</div>
                  <p>No feeds logged yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {feeds.slice(0, 15).map((feed, index) => {
                    const showDateHeader = index === 0 || 
                      formatDate(feed.timestamp) !== formatDate(feeds[index - 1].timestamp);
                    
                    return (
                      <div key={feed.id}>
                        {showDateHeader && (
                          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-4 mb-2 first:mt-0">
                            {formatDate(feed.timestamp)}
                          </div>
                        )}
                        <div 
                          className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                            editingId === feed.id 
                              ? 'bg-blue-50 border-2 border-blue-200' 
                              : 'bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-lg">🍼</span>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-700">{feed.ounces} oz</div>
                              <div className="text-sm text-slate-400">{formatTime(feed.timestamp)}</div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => editFeed(feed)}
                              className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteFeed(feed.id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* DIAPERS TAB */}
        {activeTab === 'diapers' && (
          <>
            {/* Today's Diaper Stats */}
            <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Today's Diapers</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{todayDiaperStats.total}</div>
                  <div className="text-xs text-slate-400 mt-1">Total</div>
                </div>
                <div className="text-center border-x border-slate-100">
                  <div className="text-3xl font-bold text-cyan-500">{todayDiaperStats.wet}</div>
                  <div className="text-xs text-slate-400 mt-1">💧 Wet</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-amber-500">{todayDiaperStats.dirty}</div>
                  <div className="text-xs text-slate-400 mt-1">💩 Dirty</div>
                </div>
              </div>
              {todayDiaperStats.lastDiaper && (
                <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                  <span className="text-slate-400 text-sm">Last change: </span>
                  <span className="text-blue-600 font-semibold">{getTimeSince(todayDiaperStats.lastDiaper)}</span>
                </div>
              )}
            </div>

            {/* 14-Day Diaper Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Last 14 Days</h2>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={diaperChartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <XAxis 
                      dataKey="shortDate" 
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      domain={[0, maxDiapers]}
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Bar dataKey="wet" stackId="a" fill="#06b6d4" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="dirty" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-3 h-3 rounded bg-cyan-500"></div>
                  <span>Wet</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-3 h-3 rounded bg-amber-500"></div>
                  <span>Dirty</span>
                </div>
              </div>
            </div>

            {/* Add/Edit Diaper */}
            <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                  {editingDiaperId ? 'Edit Diaper' : 'Log Diaper'}
                </h2>
                {!editingDiaperId && (
                  <button 
                    onClick={resetToCurrentTime}
                    className="text-xs text-blue-500 font-medium hover:text-blue-600"
                  >
                    Reset to Now
                  </button>
                )}
              </div>

              {/* Type Selection */}
              <div className="mb-5">
                <div className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide text-center">Type</div>
                <div className="flex gap-2">
                  {['wet', 'dirty', 'both'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedDiaperType(type)}
                      className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                        selectedDiaperType === type
                          ? type === 'wet' 
                            ? 'bg-cyan-100 text-cyan-700 border-2 border-cyan-300'
                            : type === 'dirty'
                            ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                            : 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                          : 'bg-slate-100 text-slate-500 border-2 border-transparent'
                      }`}
                    >
                      <span>{getDiaperEmoji(type)}</span>
                      <span>{getDiaperLabel(type)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Selection */}
              <div className="flex justify-center items-center gap-2 mb-6">
                <ScrollWheel 
                  values={hours} 
                  selected={selectedHour} 
                  onChange={setSelectedHour}
                  label="Hour"
                  width={80}
                />
                <div className="text-3xl font-bold text-slate-300 mt-5">:</div>
                <ScrollWheel 
                  values={minutes} 
                  selected={selectedMinute} 
                  onChange={setSelectedMinute}
                  label="Min"
                  width={80}
                />
              </div>

              <div className="flex gap-3">
                {editingDiaperId && (
                  <button
                    onClick={cancelEdit}
                    className="flex-1 py-3 rounded-xl font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={saveDiaper}
                  className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-200 transition-all"
                >
                  {editingDiaperId ? 'Update' : 'Log Diaper'}
                </button>
              </div>
            </div>

            {/* Recent Diapers */}
            <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-5">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Recent Diapers</h2>
              
              {diapers.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <div className="text-4xl mb-2">🧷</div>
                  <p>No diapers logged yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {diapers.slice(0, 15).map((diaper, index) => {
                    const showDateHeader = index === 0 || 
                      formatDate(diaper.timestamp) !== formatDate(diapers[index - 1].timestamp);
                    
                    return (
                      <div key={diaper.id}>
                        {showDateHeader && (
                          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-4 mb-2 first:mt-0">
                            {formatDate(diaper.timestamp)}
                          </div>
                        )}
                        <div 
                          className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                            editingDiaperId === diaper.id 
                              ? 'bg-blue-50 border-2 border-blue-200' 
                              : 'bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              diaper.type === 'wet' 
                                ? 'bg-cyan-100' 
                                : diaper.type === 'dirty' 
                                ? 'bg-amber-100' 
                                : 'bg-purple-100'
                            }`}>
                              <span className="text-lg">{getDiaperEmoji(diaper.type)}</span>
                            </div>
                            <div>
                              <div className="font-semibold text-slate-700">{getDiaperLabel(diaper.type)}</div>
                              <div className="text-sm text-slate-400">{formatTime(diaper.timestamp)}</div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => editDiaper(diaper)}
                              className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteDiaper(diaper.id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 pb-6">
          Data synced with Firebase in real-time
        </div>
      </div>
    </div>
  );
}
