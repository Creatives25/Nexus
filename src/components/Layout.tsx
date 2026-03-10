import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, signOut } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { BookOpen, Search, User, LogOut, Menu, X, Library as LibraryIcon, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [user] = useAuthState(auth);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white group-hover:bg-emerald-700 transition-colors">
                  <BookOpen size={24} />
                </div>
                <span className="text-xl font-bold tracking-tight">EduNexus</span>
              </Link>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <Link to="/marketplace" className="text-stone-600 hover:text-emerald-600 font-medium transition-colors flex items-center gap-2">
                <Search size={18} />
                Find Tutors
              </Link>
              <Link to="/library" className="text-stone-600 hover:text-emerald-600 font-medium transition-colors flex items-center gap-2">
                <LibraryIcon size={18} />
                Library
              </Link>
              {user && (
                <Link to="/forums" className="text-stone-600 hover:text-emerald-600 font-medium transition-colors flex items-center gap-2">
                  <MessageSquare size={18} />
                  Forums
                </Link>
              )}
              {user ? (
                <>
                  <Link to="/dashboard" className="text-stone-600 hover:text-emerald-600 font-medium transition-colors flex items-center gap-2">
                    <User size={18} />
                    Dashboard
                  </Link>
                  <button 
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-stone-600 hover:text-red-600 font-medium transition-colors"
                  >
                    <LogOut size={18} />
                    Sign Out
                  </button>
                </>
              ) : (
                <Link 
                  to="/auth" 
                  className="bg-emerald-600 text-white px-6 py-2 rounded-full font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  Get Started
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-b border-stone-200 overflow-hidden"
            >
              <div className="px-4 pt-2 pb-6 space-y-4">
                <Link 
                  to="/marketplace" 
                  onClick={() => setIsMenuOpen(false)}
                  className="block text-lg font-medium text-stone-600 hover:text-emerald-600"
                >
                  Find Tutors
                </Link>
                <Link 
                  to="/library" 
                  onClick={() => setIsMenuOpen(false)}
                  className="block text-lg font-medium text-stone-600 hover:text-emerald-600"
                >
                  Library
                </Link>
                {user && (
                  <Link 
                    to="/forums" 
                    onClick={() => setIsMenuOpen(false)}
                    className="block text-lg font-medium text-stone-600 hover:text-emerald-600"
                  >
                    Forums
                  </Link>
                )}
                {user ? (
                  <>
                    <Link 
                      to="/dashboard" 
                      onClick={() => setIsMenuOpen(false)}
                      className="block text-lg font-medium text-stone-600 hover:text-emerald-600"
                    >
                      Dashboard
                    </Link>
                    <button 
                      onClick={() => { handleSignOut(); setIsMenuOpen(false); }}
                      className="block w-full text-left text-lg font-medium text-stone-600 hover:text-red-600"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <Link 
                    to="/auth" 
                    onClick={() => setIsMenuOpen(false)}
                    className="block text-center bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium"
                  >
                    Get Started
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-stone-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
                  <BookOpen size={18} />
                </div>
                <span className="text-lg font-bold tracking-tight">EduNexus</span>
              </div>
              <p className="text-stone-500 max-w-sm">
                Empowering the next generation of learners through AI-enhanced global education.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Platform</h4>
              <ul className="space-y-2 text-stone-500">
                <li><Link to="/marketplace" className="hover:text-emerald-600 transition-colors">Find Tutors</Link></li>
                <li><Link to="/auth" className="hover:text-emerald-600 transition-colors">Become a Tutor</Link></li>
                <li><Link to="/" className="hover:text-emerald-600 transition-colors">Schools</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-stone-500">
                <li><Link to="/" className="hover:text-emerald-600 transition-colors">Help Center</Link></li>
                <li><Link to="/" className="hover:text-emerald-600 transition-colors">Privacy Policy</Link></li>
                <li><Link to="/" className="hover:text-emerald-600 transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-stone-100 text-center text-stone-400 text-sm">
            © {new Date().getFullYear()} EduNexus. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
