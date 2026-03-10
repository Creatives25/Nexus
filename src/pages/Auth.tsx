import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider, signInWithPopup, db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { BookOpen, LogIn, UserPlus } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = React.useState(true);
  const [role, setRole] = React.useState<'student' | 'teacher'>('student');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        // Create new user profile
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          role: role,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
        });

        // If teacher, create tutor profile
        if (role === 'teacher') {
          await setDoc(doc(db, 'tutors', user.uid), {
            userId: user.uid,
            subjects: [],
            hourlyRate: 25,
            experience: '',
            bio: '',
            rating: 0,
            reviewCount: 0
          });
        }
      }

      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError('Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-stone-100 w-full max-w-md"
      >
        <div className="text-center space-y-4 mb-10">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-emerald-100">
            <BookOpen size={32} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">
            {isLogin ? 'Welcome Back' : 'Join EduNexus'}
          </h2>
          <p className="text-stone-500">
            {isLogin ? 'Sign in to continue your learning journey' : 'Create an account to start learning or teaching'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6 border border-red-100">
            {error}
          </div>
        )}

        {!isLogin && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => setRole('student')}
              className={`py-3 rounded-xl font-bold transition-all border-2 ${
                role === 'student' 
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-700' 
                  : 'bg-white border-stone-100 text-stone-500 hover:border-stone-200'
              }`}
            >
              I'm a Student
            </button>
            <button
              onClick={() => setRole('teacher')}
              className={`py-3 rounded-xl font-bold transition-all border-2 ${
                role === 'teacher' 
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-700' 
                  : 'bg-white border-stone-100 text-stone-500 hover:border-stone-200'
              }`}
            >
              I'm a Teacher
            </button>
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white border-2 border-stone-200 text-stone-700 py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:border-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-8"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-stone-700"></div>
          ) : (
            <>
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Continue with Google
            </>
          )}
        </button>

        <div className="text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-emerald-600 font-bold hover:underline"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
