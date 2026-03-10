import React from 'react';
import { Link } from 'react-router-dom';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, limit, deleteDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, Video, BookOpen, Star, Settings, Plus, CheckCircle, AlertCircle, ChevronRight, User, Sparkles, X, Trash2, Eye, MessageSquare, ArrowRight, Cpu } from 'lucide-react';
import { format } from 'date-fns';

interface UserProfile {
  name: string;
  role: 'student' | 'teacher' | 'parent' | 'school_admin';
  photoURL: string;
}

interface ClassSession {
  id: string;
  subject: string;
  scheduledTime: any;
  duration: number;
  status: string;
  videoSessionLink: string;
  tutorId: string;
  studentId?: string;
  tutorName?: string;
  studentName?: string;
}

interface UserBook {
  id: string;
  bookId: string;
  title: string;
  author: string;
  coverURL: string;
  downloadedAt?: any;
}

interface Book {
  id: string;
  title: string;
  author: string;
  coverURL: string;
}

export default function Dashboard() {
  const [user] = useAuthState(auth);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [classes, setClasses] = React.useState<ClassSession[]>([]);
  const [userBooks, setUserBooks] = React.useState<UserBook[]>([]);
  const [libraryBooks, setLibraryBooks] = React.useState<Book[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedBook, setSelectedBook] = React.useState<UserBook | null>(null);
  const [isEditingTutor, setIsEditingTutor] = React.useState(false);
  const [tutorData, setTutorData] = React.useState({
    subjects: '',
    hourlyRate: 25,
    bio: '',
    experience: ''
  });

  React.useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Fetch user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const u = userDoc.data() as UserProfile;
          setProfile(u);

          // Fetch user's books
          const userBooksSnap = await getDocs(query(collection(db, 'userBooks'), where('userId', '==', user.uid)));
          const userBooksData: UserBook[] = [];
          for (const ubDoc of userBooksSnap.docs) {
            const ub = ubDoc.data();
            const bookDoc = await getDoc(doc(db, 'books', ub.bookId));
            if (bookDoc.exists()) {
              const b = bookDoc.data();
              userBooksData.push({
                id: ubDoc.id,
                bookId: ub.bookId,
                title: b.title,
                author: b.author,
                coverURL: b.coverURL,
                downloadedAt: ub.downloadedAt
              });
            }
          }
          setUserBooks(userBooksData);

          // If school admin, fetch library books
          if (u.role === 'school_admin') {
            const booksSnap = await getDocs(query(collection(db, 'books'), limit(5)));
            setLibraryBooks(booksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Book)));
          }

          // Fetch classes based on role
          let q;
          if (u.role === 'teacher') {
            q = query(collection(db, 'classes'), where('tutorId', '==', user.uid));
            
            // Also fetch tutor profile for editing
            const tutorDoc = await getDoc(doc(db, 'tutors', user.uid));
            if (tutorDoc.exists()) {
              const t = tutorDoc.data();
              setTutorData({
                subjects: t.subjects.join(', '),
                hourlyRate: t.hourlyRate,
                bio: t.bio || '',
                experience: t.experience || ''
              });
            }
          } else {
            // For students, we need to fetch bookings first to find class IDs
            const bookingsSnap = await getDocs(query(collection(db, 'bookings'), where('studentId', '==', user.uid)));
            const classIds = bookingsSnap.docs.map(d => d.data().classId);
            
            if (classIds.length > 0) {
              // Firestore 'in' query limited to 10 items, for MVP we just fetch all and filter
              const classesSnap = await getDocs(collection(db, 'classes'));
              const filteredClasses = classesSnap.docs
                .filter(d => classIds.includes(d.id))
                .map(d => ({ id: d.id, ...d.data() as any } as ClassSession));
              
              // Fetch tutor names
              for (const c of filteredClasses) {
                const tutorUserDoc = await getDoc(doc(db, 'users', c.tutorId));
                if (tutorUserDoc.exists()) {
                  c.tutorName = tutorUserDoc.data().name;
                }
              }
              setClasses(filteredClasses);
              setLoading(false);
              return;
            }
            setClasses([]);
            setLoading(false);
            return;
          }

          const classesSnap = await getDocs(q);
          const classesData = classesSnap.docs.map(d => ({ id: d.id, ...d.data() as any } as ClassSession));
          
          // Fetch student names for teachers
          if (u.role === 'teacher') {
            for (const c of classesData) {
              const bookingSnap = await getDocs(query(collection(db, 'bookings'), where('classId', '==', c.id)));
              if (!bookingSnap.empty) {
                const studentId = bookingSnap.docs[0].data().studentId;
                const studentUserDoc = await getDoc(doc(db, 'users', studentId));
                if (studentUserDoc.exists()) {
                  c.studentName = studentUserDoc.data().name;
                }
              }
            }
          }

          setClasses(classesData);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'dashboard_data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const handleUpdateTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await updateDoc(doc(db, 'tutors', user.uid), {
        subjects: tutorData.subjects.split(',').map(s => s.trim()),
        hourlyRate: Number(tutorData.hourlyRate),
        bio: tutorData.bio,
        experience: tutorData.experience
      });
      setIsEditingTutor(false);
      alert('Profile updated successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tutors/${user.uid}`);
      alert('Failed to update profile.');
    }
  };

  const handleRemoveBook = async (userBookId: string) => {
    if (!window.confirm('Are you sure you want to remove this book from your library?')) return;
    
    try {
      await deleteDoc(doc(db, 'userBooks', userBookId));
      setUserBooks(prev => prev.filter(b => b.id !== userBookId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `userBooks/${userBookId}`);
      alert('Failed to remove book.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!profile && !loading) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-8">
        <div className="w-20 h-20 bg-stone-100 rounded-3xl flex items-center justify-center mx-auto text-stone-400">
          <User size={40} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Profile Not Found</h2>
          <p className="text-stone-500">We couldn't find your profile. This might happen if your account setup was interrupted.</p>
        </div>
        <button 
          onClick={async () => {
            await auth.signOut();
            window.location.href = '/auth?mode=signup';
          }}
          className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all"
        >
          Restart Account Setup
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Header & Quick Actions */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
        <div className="flex items-center gap-6">
          <div className="relative">
            <img 
              src={profile?.photoURL} 
              className="w-20 h-20 rounded-[2rem] object-cover shadow-xl border-4 border-white"
              referrerPolicy="no-referrer"
              alt={profile?.name}
            />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 border-4 border-white rounded-full flex items-center justify-center text-white">
              <Star size={12} fill="currentColor" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-[0.2em]">
              <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse" />
              {profile?.role.replace('_', ' ')}
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-stone-900">
              Welcome back, <span className="text-emerald-600">{profile?.name.split(' ')[0]}</span>
            </h1>
            <p className="text-stone-500 font-medium">
              {profile?.role === 'teacher' ? 'Ready to inspire your students today?' : 
               profile?.role === 'school_admin' ? 'Managing EduNexus Academy' : 'You have 3 classes scheduled for today.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto">
          {profile?.role === 'teacher' && (
            <button 
              onClick={() => setIsEditingTutor(!isEditingTutor)}
              className="flex-1 lg:flex-none bg-white border border-stone-200 text-stone-700 px-6 py-3.5 rounded-2xl font-bold hover:border-emerald-600 hover:bg-stone-50 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Settings size={20} />
              Settings
            </button>
          )}
          <Link 
            to="/marketplace" 
            className="flex-1 lg:flex-none bg-stone-900 text-white px-8 py-3.5 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            {profile?.role === 'teacher' ? 'Add Availability' : 'Book Class'}
          </Link>
        </div>
      </header>

      {/* Summary Stats Bar */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'XP Points', value: '1,250', icon: <Sparkles size={24} />, color: 'bg-amber-50 text-amber-600', border: 'border-amber-100' },
          { label: 'Current Level', value: '4', icon: <Star size={24} />, color: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-100' },
          { label: 'Total Classes', value: classes.length.toString(), icon: <Video size={24} />, color: 'bg-blue-50 text-blue-600', border: 'border-blue-100' },
          { label: 'Library Books', value: userBooks.length.toString(), icon: <BookOpen size={24} />, color: 'bg-purple-50 text-purple-600', border: 'border-purple-100' },
        ].map((stat, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`bg-white p-6 rounded-[2rem] border ${stat.border} shadow-sm flex items-center gap-5 hover:shadow-md transition-all cursor-default`}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.15em] mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-stone-900 tracking-tight">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </section>

      {isEditingTutor && profile?.role === 'teacher' && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-xl"
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Tutor Profile Settings</h2>
            <button onClick={() => setIsEditingTutor(false)} className="text-stone-400 hover:text-stone-600">
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleUpdateTutor} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Subjects (comma separated)</label>
              <input 
                type="text" 
                value={tutorData.subjects}
                onChange={(e) => setTutorData({...tutorData, subjects: e.target.value})}
                className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                placeholder="Math, Physics, English"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Hourly Rate ($)</label>
              <input 
                type="number" 
                value={tutorData.hourlyRate}
                onChange={(e) => setTutorData({...tutorData, hourlyRate: Number(e.target.value)})}
                className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Bio</label>
              <textarea 
                value={tutorData.bio}
                onChange={(e) => setTutorData({...tutorData, bio: e.target.value})}
                className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all h-32 resize-none"
                placeholder="Tell students about yourself..."
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Experience</label>
              <textarea 
                value={tutorData.experience}
                onChange={(e) => setTutorData({...tutorData, experience: e.target.value})}
                className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all h-32 resize-none"
                placeholder="Describe your teaching experience..."
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-4 pt-4">
              <button 
                type="button"
                onClick={() => setIsEditingTutor(false)}
                className="px-8 py-3.5 rounded-2xl font-bold text-stone-500 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="bg-emerald-600 text-white px-10 py-3.5 rounded-2xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
              >
                Save Profile
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Active Learning */}
        <div className="lg:col-span-8 space-y-10">
          {profile?.role === 'school_admin' ? (
            <div className="space-y-10">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-stone-900">School Library</h2>
                <Link to="/admin/library" className="text-emerald-600 font-bold text-sm hover:underline flex items-center gap-1">
                  Manage All <ChevronRight size={16} />
                </Link>
              </div>
              <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-stone-50 flex items-center justify-between">
                  <h3 className="text-lg font-bold">Recently Added Books</h3>
                  <Link to="/admin/library" className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400 hover:text-emerald-600 transition-colors">
                    <Plus size={20} />
                  </Link>
                </div>
                <div className="divide-y divide-stone-50">
                  {libraryBooks.map((book) => (
                    <div key={book.id} className="flex items-center justify-between p-6 hover:bg-stone-50 transition-colors group">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-16 rounded-lg overflow-hidden shadow-sm">
                          <img src={book.coverURL} className="w-full h-full object-cover" alt={book.title} referrerPolicy="no-referrer" />
                        </div>
                        <div>
                          <p className="font-bold text-stone-900 group-hover:text-emerald-600 transition-colors">{book.title}</p>
                          <p className="text-sm text-stone-400">{book.author}</p>
                        </div>
                      </div>
                      <button className="w-10 h-10 rounded-xl flex items-center justify-center text-stone-300 hover:text-red-500 hover:bg-red-50 transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  {libraryBooks.length === 0 && (
                    <div className="p-12 text-center text-stone-400 italic">No books in the library yet.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-stone-900">Upcoming Classes</h2>
                  <Link to="/dashboard" className="text-stone-400 font-bold text-sm hover:text-emerald-600 transition-colors">View Schedule</Link>
                </div>

                {classes.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6">
                    {classes.map((c) => (
                      <motion.div 
                        key={c.id}
                        whileHover={{ y: -4 }}
                        className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 group"
                      >
                        <div className="flex items-center gap-8">
                          <div className="w-20 h-20 bg-emerald-50 rounded-[1.5rem] flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500">
                            <Video size={32} />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-widest rounded-full">Live Session</span>
                              <h3 className="text-2xl font-bold text-stone-900">{c.subject}</h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-6 text-stone-400 text-sm">
                              <div className="flex items-center gap-2">
                                <Clock size={16} className="text-emerald-500" />
                                <span className="font-semibold text-stone-600">{c.duration} min</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <User size={16} className="text-emerald-500" />
                                <span className="font-semibold text-stone-600">
                                  {profile?.role === 'teacher' ? `Student: ${c.studentName || 'Pending'}` : `Tutor: ${c.tutorName || 'Unknown'}`}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-8 w-full md:w-auto border-t md:border-t-0 pt-6 md:pt-0">
                          <div className="text-right hidden md:block">
                            <p className="font-bold text-stone-900 text-lg">Today</p>
                            <p className="text-sm text-stone-400 font-bold uppercase tracking-wider">4:00 PM - 4:45 PM</p>
                          </div>
                          <Link 
                            to={`/classroom/${c.id}`}
                            className="flex-1 md:flex-none bg-emerald-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                          >
                            Join Now
                            <ChevronRight size={20} />
                          </Link>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white p-16 rounded-[3rem] border border-stone-100 text-center space-y-6 shadow-sm">
                    <div className="w-20 h-20 bg-stone-50 rounded-3xl flex items-center justify-center mx-auto text-stone-200">
                      <Calendar size={40} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-stone-900">No classes scheduled</h3>
                      <p className="text-stone-500 max-w-xs mx-auto">
                        {profile?.role === 'teacher' ? 'Your calendar is currently clear. Update your availability to get more bookings.' : 'You haven\'t booked any classes yet. Start your learning journey today!'}
                      </p>
                    </div>
                    <Link 
                      to="/marketplace" 
                      className="inline-flex items-center gap-2 bg-stone-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all"
                    >
                      {profile?.role === 'teacher' ? 'Update Availability' : 'Browse Tutors'}
                      <ArrowRight size={18} />
                    </Link>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-stone-900">My Library</h2>
                  <Link to="/library" className="text-stone-400 font-bold text-sm hover:text-emerald-600 transition-colors">Explore All</Link>
                </div>

                {userBooks.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8">
                    {userBooks.map((book) => (
                      <motion.div 
                        key={book.id}
                        whileHover={{ y: -8 }}
                        className="group relative"
                      >
                        <div className="aspect-[3/4] rounded-[1.5rem] overflow-hidden mb-4 relative shadow-lg">
                          <img 
                            src={book.coverURL} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            referrerPolicy="no-referrer"
                            alt={book.title}
                          />
                          <div className="absolute inset-0 bg-stone-900/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3 backdrop-blur-[2px]">
                            <button 
                              onClick={() => setSelectedBook(book)}
                              className="w-12 h-12 bg-white rounded-2xl text-stone-900 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-lg"
                            >
                              <Eye size={22} />
                            </button>
                            <button 
                              onClick={() => handleRemoveBook(book.id)}
                              className="w-12 h-12 bg-white rounded-2xl text-red-600 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center shadow-lg"
                            >
                              <Trash2 size={22} />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-bold text-stone-900 line-clamp-1 mb-1 group-hover:text-emerald-600 transition-colors">{book.title}</h4>
                        <p className="text-xs text-stone-400 font-bold uppercase tracking-wider mb-3">{book.author}</p>
                        <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '33%' }}
                            className="h-full bg-emerald-500" 
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-stone-50 p-12 rounded-[3rem] border-2 border-dashed border-stone-200 text-center space-y-6">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto text-stone-300 shadow-sm">
                      <BookOpen size={32} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-stone-900">Your library is empty</h3>
                      <p className="text-stone-500 text-sm">Download books from our digital library to build your personal collection.</p>
                    </div>
                    <Link 
                      to="/library" 
                      className="inline-block bg-white border border-stone-200 text-stone-900 px-8 py-3 rounded-xl font-bold hover:border-emerald-600 transition-all shadow-sm"
                    >
                      Browse Library
                    </Link>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Column: Insights & Tools */}
        <div className="lg:col-span-4 space-y-10">
          {/* Progress Widget */}
          <div className="bg-stone-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
            <div className="relative z-10 space-y-10">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold tracking-tight">Weekly Goal</h3>
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-emerald-400">
                  <Clock size={24} />
                </div>
              </div>
              
              <div className="flex items-end gap-3">
                <span className="text-6xl font-bold tracking-tighter">12.5</span>
                <span className="text-stone-400 font-bold mb-2 uppercase text-xs tracking-[0.2em]">Hours Studied</span>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-xs font-bold uppercase tracking-[0.2em] text-stone-400">
                  <span>Progress</span>
                  <span className="text-emerald-400">82%</span>
                </div>
                <div className="h-4 bg-white/10 rounded-full overflow-hidden p-1">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '82%' }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full shadow-[0_0_20px_rgba(52,211,153,0.5)]" 
                  />
                </div>
                <p className="text-xs text-stone-500 font-medium leading-relaxed">You're 2.5 hours away from your weekly target! Keep pushing.</p>
              </div>
            </div>
            <Sparkles size={200} className="absolute -bottom-20 -right-20 text-white/5 group-hover:scale-110 transition-transform duration-1000" />
          </div>

          {/* AI Study Buddy */}
          <div className="bg-white p-10 rounded-[3rem] border border-stone-100 shadow-sm space-y-8 group hover:border-emerald-200 transition-all">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500">
                <Sparkles size={28} />
              </div>
              <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-widest rounded-full">Pro Feature</span>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-bold text-stone-900 tracking-tight">AI Study Buddy</h3>
              <p className="text-stone-500 leading-relaxed">
                Get instant help with complex topics, summarize long lessons, or generate practice quizzes in seconds.
              </p>
            </div>
            <button className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg flex items-center justify-center gap-2">
              <Cpu size={20} />
              Launch Assistant
            </button>
          </div>

          {/* Community Feed */}
          <div className="bg-white p-10 rounded-[3rem] border border-stone-100 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight">Community</h3>
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                <MessageSquare size={20} />
              </div>
            </div>
            <div className="space-y-4">
              {[
                { title: 'Calculus Help Needed', replies: 12, time: '2h ago' },
                { title: 'Best resources for SAT?', replies: 45, time: '5h ago' },
              ].map((topic, i) => (
                <div key={i} className="p-5 bg-stone-50 rounded-2xl hover:bg-stone-100 transition-all cursor-pointer group">
                  <h4 className="font-bold text-stone-900 mb-2 group-hover:text-emerald-600 transition-colors">{topic.title}</h4>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1"><MessageSquare size={10} /> {topic.replies} Replies</span>
                    <span>•</span>
                    <span>{topic.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/forums" className="block text-center text-stone-500 font-bold text-sm hover:text-stone-900 transition-colors pt-2">
              Explore All Discussions
            </Link>
          </div>
        </div>
      </div>

      {/* Book Reader Modal */}
      <AnimatePresence>
        {selectedBook && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBook(null)}
              className="absolute inset-0 bg-stone-900/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl h-full max-h-[90vh] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold">{selectedBook.title}</h3>
                    <p className="text-xs text-stone-500">{selectedBook.author}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedBook(null)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 md:p-12">
                <div className="max-w-2xl mx-auto space-y-8">
                  <div className="aspect-[2/3] w-48 mx-auto rounded-xl overflow-hidden shadow-xl">
                    <img src={selectedBook.coverURL} className="w-full h-full object-cover" alt={selectedBook.title} referrerPolicy="no-referrer" />
                  </div>
                  <div className="prose prose-stone max-w-none">
                    <h2 className="text-3xl font-bold text-center mb-8">Chapter 1: The Beginning</h2>
                    <p className="text-lg leading-relaxed text-stone-700">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                    </p>
                    <p className="text-lg leading-relaxed text-stone-700">
                      Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris.
                    </p>
                    <p className="text-lg leading-relaxed text-stone-700">
                      Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula eu tempor congue, eros est euismod turpis, id tincidunt sapien risus a quam. Maecenas fermentum consequat mi. Donec fermentum. Pellentesque malesuada nulla a mi. Duis sapien sem, aliquet nec, commodo eget, consequat quis, neque. Aliquam faucibus, elit ut dictum aliquet, felis nisl adipiscing sapien, sed malesuada diam lacus eget erat. Cras mollis scelerisque nunc. Nullam arcu. Aliquam consequat. Curabitur augue lorem, dapibus quis, laoreet et, pretium ac, nisi. Aenean magna nisl, mollis quis, molestie eu, feugiat in, orci. In hac habitasse platea dictumst.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-stone-100 bg-stone-50 flex justify-between items-center">
                <button className="text-sm font-bold text-stone-500 hover:text-stone-900 transition-colors">Previous Page</button>
                <div className="text-sm font-medium text-stone-400">Page 1 of 240</div>
                <button className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors">Next Page</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
