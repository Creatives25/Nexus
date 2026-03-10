import React from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, limit, deleteDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, Video, BookOpen, Star, Settings, Plus, CheckCircle, AlertCircle, ChevronRight, User, Sparkles, X, Trash2, Eye, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
          <img 
            src={profile?.photoURL} 
            className="w-20 h-20 rounded-3xl object-cover border-4 border-white shadow-lg"
            referrerPolicy="no-referrer"
            alt={profile?.name}
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Hello, {profile?.name}!</h1>
            <p className="text-stone-500 font-medium">
              {profile?.role === 'teacher' ? 'Teacher Dashboard' : 
               profile?.role === 'school_admin' ? 'School Admin Dashboard' : 'Student Dashboard'}
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          {profile?.role === 'teacher' && (
            <button 
              onClick={() => setIsEditingTutor(!isEditingTutor)}
              className="bg-white border-2 border-stone-200 text-stone-700 px-6 py-3 rounded-xl font-bold hover:border-emerald-600 transition-all flex items-center gap-2"
            >
              <Settings size={20} />
              Edit Profile
            </button>
          )}
          <Link 
            to="/marketplace" 
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
          >
            <Plus size={20} />
            {profile?.role === 'teacher' ? 'New Availability' : 'Book a Class'}
          </Link>
        </div>
      </header>

      {isEditingTutor && profile?.role === 'teacher' && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-xl"
        >
          <h2 className="text-2xl font-bold mb-6">Tutor Profile Settings</h2>
          <form onSubmit={handleUpdateTutor} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-500 uppercase tracking-wider">Subjects (comma separated)</label>
              <input 
                type="text" 
                value={tutorData.subjects}
                onChange={(e) => setTutorData({...tutorData, subjects: e.target.value})}
                className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors"
                placeholder="Math, Physics, English"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-500 uppercase tracking-wider">Hourly Rate ($)</label>
              <input 
                type="number" 
                value={tutorData.hourlyRate}
                onChange={(e) => setTutorData({...tutorData, hourlyRate: Number(e.target.value)})}
                className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-bold text-stone-500 uppercase tracking-wider">Bio</label>
              <textarea 
                value={tutorData.bio}
                onChange={(e) => setTutorData({...tutorData, bio: e.target.value})}
                className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors h-32"
                placeholder="Tell students about yourself..."
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-bold text-stone-500 uppercase tracking-wider">Experience</label>
              <textarea 
                value={tutorData.experience}
                onChange={(e) => setTutorData({...tutorData, experience: e.target.value})}
                className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors h-32"
                placeholder="Describe your teaching experience..."
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-4">
              <button 
                type="button"
                onClick={() => setIsEditingTutor(false)}
                className="px-8 py-3 rounded-xl font-bold text-stone-500 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
              >
                Save Changes
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-12">
          {profile?.role === 'school_admin' ? (
            <div className="space-y-12">
              {/* School Admin Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
                  <p className="text-stone-500 text-sm font-bold uppercase tracking-wider mb-1">Total Students</p>
                  <p className="text-3xl font-bold">1,240</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
                  <p className="text-stone-500 text-sm font-bold uppercase tracking-wider mb-1">Active Teachers</p>
                  <p className="text-3xl font-bold">48</p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
                  <p className="text-stone-500 text-sm font-bold uppercase tracking-wider mb-1">Library Books</p>
                  <p className="text-3xl font-bold">350</p>
                </div>
              </div>

              {/* School Library Management */}
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">School Library</h2>
                  <Link to="/admin/library" className="text-emerald-600 font-bold text-sm hover:underline">Manage All Books</Link>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold">Recently Added Books</h3>
                    <Link to="/admin/library" className="text-stone-400 hover:text-emerald-600 transition-colors">
                      <Plus size={20} />
                    </Link>
                  </div>
                  <div className="space-y-4">
                    {libraryBooks.map((book) => (
                      <div key={book.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <img src={book.coverURL} className="w-10 h-14 object-cover rounded-lg" alt={book.title} referrerPolicy="no-referrer" />
                          <div>
                            <p className="font-bold text-sm">{book.title}</p>
                            <p className="text-xs text-stone-500">{book.author}</p>
                          </div>
                        </div>
                        <button className="text-stone-400 hover:text-red-600 transition-colors">
                          <AlertCircle size={18} />
                        </button>
                      </div>
                    ))}
                    {libraryBooks.length === 0 && (
                      <p className="text-center text-stone-400 py-4 italic">No books in the library yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Upcoming Classes */}
              <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Upcoming Classes</h2>
              <Link to="/dashboard" className="text-emerald-600 font-bold text-sm hover:underline">View All</Link>
            </div>

            {classes.length > 0 ? (
              <div className="space-y-4">
                {classes.map((c) => (
                  <motion.div 
                    key={c.id}
                    whileHover={{ x: 5 }}
                    className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                        <Calendar size={28} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{c.subject}</h3>
                        <div className="flex items-center gap-4 text-stone-500 text-sm mt-1">
                          <div className="flex items-center gap-1">
                            <Clock size={14} />
                            {c.duration} min
                          </div>
                          <div className="flex items-center gap-1">
                            <User size={14} />
                            {profile?.role === 'teacher' ? `Student: ${c.studentName || 'Pending'}` : `Tutor: ${c.tutorName || 'Unknown'}`}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div className="text-right hidden md:block">
                        <p className="font-bold">Today</p>
                        <p className="text-xs text-stone-400">4:00 PM</p>
                      </div>
                      <Link 
                        to={`/classroom/${c.id}`}
                        className="flex-1 md:flex-none bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-sm shadow-emerald-100"
                      >
                        <Video size={18} />
                        Join Class
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-white p-12 rounded-[2.5rem] border border-stone-100 text-center space-y-4">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto text-stone-300">
                  <Calendar size={32} />
                </div>
                <h3 className="text-xl font-bold">No upcoming classes</h3>
                <p className="text-stone-500">
                  {profile?.role === 'teacher' ? 'Wait for students to book your sessions.' : 'Start your learning journey by booking a class.'}
                </p>
                <Link 
                  to="/marketplace" 
                  className="inline-block text-emerald-600 font-bold hover:underline"
                >
                  {profile?.role === 'teacher' ? 'Update your availability' : 'Browse Tutors'}
                </Link>
              </div>
            )}
          </div>

          {/* My Library Section */}
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">My Library</h2>
              <Link to="/library" className="text-emerald-600 font-bold text-sm hover:underline">Browse Library</Link>
            </div>

            {userBooks.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                {userBooks.map((book) => (
                  <motion.div 
                    key={book.id}
                    whileHover={{ y: -5 }}
                    className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm group relative"
                  >
                    <div className="aspect-[2/3] rounded-xl overflow-hidden mb-3 relative">
                      <img 
                        src={book.coverURL} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                        alt={book.title}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button 
                          onClick={() => setSelectedBook(book)}
                          className="p-2 bg-white rounded-full text-stone-900 hover:bg-emerald-600 hover:text-white transition-all"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => handleRemoveBook(book.id)}
                          className="p-2 bg-white rounded-full text-red-600 hover:bg-red-600 hover:text-white transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <h4 className="text-sm font-bold line-clamp-1">{book.title}</h4>
                    <p className="text-xs text-stone-500 mb-2">{book.author}</p>
                    {book.downloadedAt && (
                      <p className="text-[10px] text-stone-400 font-medium">
                        Added {book.downloadedAt.toDate ? format(book.downloadedAt.toDate(), 'MMM d, yyyy') : 'recently'}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-stone-50 p-12 rounded-[2.5rem] border border-dashed border-stone-200 text-center space-y-4">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto text-stone-300">
                  <BookOpen size={32} />
                </div>
                <h3 className="text-xl font-bold">Your library is empty</h3>
                <p className="text-stone-500">Explore our general library and add books to your personal collection.</p>
                <Link 
                  to="/library" 
                  className="inline-block bg-stone-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-stone-800 transition-all"
                >
                  Explore Library
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>

        {/* Sidebar: Stats & AI */}
        <div className="space-y-8">
          <div className="bg-emerald-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
            <div className="relative z-10 space-y-6">
              <h3 className="text-xl font-bold">Learning Progress</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                  <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">XP Points</p>
                  <p className="text-2xl font-bold">1,250</p>
                </div>
                <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
                  <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">Level</p>
                  <p className="text-2xl font-bold">4</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Next Level</span>
                  <span>75%</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 w-3/4" />
                </div>
              </div>
            </div>
            <BookOpen size={120} className="absolute -bottom-6 -right-6 text-white/5" />
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Subject Forums</h3>
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                <MessageSquare size={18} />
              </div>
            </div>
            <p className="text-stone-500 text-sm leading-relaxed">
              Join subject-specific groups to discuss ideas and solutions with your peers.
            </p>
            <Link to="/forums" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
              Browse Forums
              <ChevronRight size={18} />
            </Link>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">AI Study Buddy</h3>
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                <Sparkles size={18} />
              </div>
            </div>
            <p className="text-stone-500 text-sm leading-relaxed">
              Need help with your homework or a quick summary of your last lesson?
            </p>
            <button className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2">
              Start AI Chat
              <ChevronRight size={18} />
            </button>
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
