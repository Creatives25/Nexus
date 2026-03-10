import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  db, 
  handleFirestoreError, 
  OperationType,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { BookOpen, LogIn, UserPlus, Mail, Lock, User, AtSign, School, ShieldCheck } from 'lucide-react';

type UserRole = 'student' | 'teacher' | 'school_admin';

export default function Auth() {
  const [isLogin, setIsLogin] = React.useState(true);
  const [role, setRole] = React.useState<UserRole>('student');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  
  // Form fields
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [schoolName, setSchoolName] = React.useState('');

  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    const initialRole = params.get('role');
    
    if (mode === 'signup') setIsLogin(false);
    if (initialRole === 'teacher' || initialRole === 'student' || initialRole === 'school_admin') {
      setRole(initialRole as UserRole);
    }
  }, [location]);

  const saveUserProfile = async (user: any, userData: any) => {
    const userDocRef = doc(db, 'users', user.uid);
    try {
      await setDoc(userDocRef, userData);
      
      // Role-specific profile creation
      if (userData.role === 'teacher') {
        await setDoc(doc(db, 'tutors', user.uid), {
          userId: user.uid,
          subjects: [],
          hourlyRate: 25,
          experience: '',
          bio: '',
          rating: 0,
          reviewCount: 0
        });
      } else if (userData.role === 'school_admin') {
        await setDoc(doc(db, 'schools', user.uid), {
          userId: user.uid,
          schoolName: schoolName || 'My Academy',
          verified: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Validation
        if (!fullName || !username) {
          throw new Error('Please fill in all required fields.');
        }

        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;

        await updateProfile(user, { displayName: fullName });

        const userData = {
          uid: user.uid,
          name: fullName,
          username: username.toLowerCase(),
          email: user.email || '',
          role: role,
          photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
          createdAt: serverTimestamp(),
        };

        await saveUserProfile(user, userData);
      }
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Auth Error:', err);
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        const userData = {
          uid: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'Anonymous User',
          username: (user.email?.split('@')[0] || user.uid.slice(0, 8)).toLowerCase(),
          email: user.email || '',
          role: role,
          photoURL: user.photoURL || '',
          createdAt: serverTimestamp(),
        };
        await saveUserProfile(user, userData);
      }

      navigate('/dashboard');
    } catch (err: any) {
      console.error('Auth Error:', err);
      setError('Google Sign-In failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border border-stone-100 w-full max-w-xl"
      >
        <div className="text-center space-y-4 mb-10">
          <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-emerald-100 transform -rotate-6">
            <BookOpen size={40} />
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-stone-900">
            {isLogin ? 'Welcome Back' : 'Join EduNexus'}
          </h2>
          <p className="text-stone-500 font-medium">
            {isLogin ? 'Sign in to continue your learning journey' : 'Create an account to start learning or teaching'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm mb-8 border border-red-100 flex items-center gap-3">
            <ShieldCheck size={20} className="shrink-0" />
            {error}
          </div>
        )}

        {!isLogin && (
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {[
              { id: 'student', label: 'Student', icon: <User size={18} /> },
              { id: 'teacher', label: 'Tutor', icon: <BookOpen size={18} /> },
              { id: 'school_admin', label: 'School', icon: <School size={18} /> }
            ].map((r) => (
              <button
                key={r.id}
                onClick={() => setRole(r.id as UserRole)}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all border-2 ${
                  role === r.id 
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100 scale-105' 
                    : 'bg-white border-stone-100 text-stone-500 hover:border-stone-200'
                }`}
              >
                {r.icon}
                {r.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-5 mb-8">
          {!isLogin && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-stone-50 border-2 border-transparent rounded-2xl focus:border-emerald-600 focus:bg-white outline-none transition-all font-medium"
                />
              </div>
              <div className="relative">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <input
                  type="text"
                  placeholder="Username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-stone-50 border-2 border-transparent rounded-2xl focus:border-emerald-600 focus:bg-white outline-none transition-all font-medium"
                />
              </div>
            </div>
          )}

          {role === 'school_admin' && !isLogin && (
            <div className="relative">
              <School className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
              <input
                type="text"
                placeholder="School/Academy Name"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-stone-50 border-2 border-transparent rounded-2xl focus:border-emerald-600 focus:bg-white outline-none transition-all font-medium"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input
              type="email"
              placeholder="Email Address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-stone-50 border-2 border-transparent rounded-2xl focus:border-emerald-600 focus:bg-white outline-none transition-all font-medium"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-stone-50 border-2 border-transparent rounded-2xl focus:border-emerald-600 focus:bg-white outline-none transition-all font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
                {isLogin ? 'Sign In' : 'Create Account'}
              </>
            )}
          </button>
        </form>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
            <span className="bg-white px-4 text-stone-400">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white border-2 border-stone-100 text-stone-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:border-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-50 mb-8"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Google Account
        </button>

        <div className="text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-stone-500 font-bold hover:text-emerald-600 transition-colors"
          >
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span className="text-emerald-600">
              {isLogin ? 'Sign Up' : 'Sign In'}
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
