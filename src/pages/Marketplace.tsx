import React from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Search, Star, MapPin, DollarSign, Filter, ChevronRight } from 'lucide-react';

interface Tutor {
  userId: string;
  name: string;
  photoURL: string;
  subjects: string[];
  hourlyRate: number;
  rating: number;
  reviewCount: number;
  bio: string;
  country: string;
}

export default function Marketplace() {
  const [tutors, setTutors] = React.useState<Tutor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedSubject, setSelectedSubject] = React.useState('All');

  const subjects = ['All', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science', 'History', 'Music'];

  React.useEffect(() => {
    const fetchTutors = async () => {
      setLoading(true);
      try {
        const tutorsSnap = await getDocs(collection(db, 'tutors'));
        const tutorsData: Tutor[] = [];
        
        for (const tutorDoc of tutorsSnap.docs) {
          const tutor = tutorDoc.data();
          const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', tutor.userId)));
          const userData = userDoc.docs[0]?.data();
          
          if (userData) {
            tutorsData.push({
              userId: tutor.userId,
              name: userData.name,
              photoURL: userData.photoURL,
              subjects: tutor.subjects,
              hourlyRate: tutor.hourlyRate,
              rating: tutor.rating || 0,
              reviewCount: tutor.reviewCount || 0,
              bio: tutor.bio,
              country: userData.country || 'Global'
            });
          }
        }
        setTutors(tutorsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTutors();
  }, []);

  const filteredTutors = tutors.filter(tutor => {
    const matchesSearch = tutor.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         tutor.subjects.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSubject = selectedSubject === 'All' || tutor.subjects.includes(selectedSubject);
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div className="space-y-4 flex-1">
          <h1 className="text-4xl font-bold tracking-tight">Find Your Perfect Tutor</h1>
          <p className="text-stone-500 max-w-2xl">
            Browse our global network of expert tutors and find the one that matches your learning style and goals.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-stone-200 shadow-sm w-full md:w-auto">
          <div className="flex items-center gap-2 px-4 border-r border-stone-100">
            <Search size={20} className="text-stone-400" />
            <input 
              type="text" 
              placeholder="Search by name or subject..." 
              className="bg-transparent border-none outline-none text-sm w-full md:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 px-4">
            <Filter size={20} className="text-stone-400" />
            <select 
              className="bg-transparent border-none outline-none text-sm font-medium"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white rounded-3xl p-6 border border-stone-100 animate-pulse space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-stone-100 rounded-2xl" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-stone-100 rounded" />
                  <div className="h-3 w-24 bg-stone-100 rounded" />
                </div>
              </div>
              <div className="h-20 bg-stone-100 rounded-xl" />
              <div className="h-10 bg-stone-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : filteredTutors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredTutors.map((tutor, idx) => (
            <motion.div 
              key={tutor.userId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <img 
                    src={tutor.photoURL} 
                    className="w-16 h-16 rounded-2xl object-cover shadow-sm"
                    referrerPolicy="no-referrer"
                    alt={tutor.name}
                  />
                  <div>
                    <h3 className="text-lg font-bold group-hover:text-emerald-600 transition-colors">{tutor.name}</h3>
                    <div className="flex items-center gap-1 text-stone-400 text-sm">
                      <MapPin size={14} />
                      {tutor.country}
                    </div>
                  </div>
                </div>
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  <Star size={14} fill="currentColor" />
                  {tutor.rating.toFixed(1)}
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex flex-wrap gap-2">
                  {tutor.subjects.map(subject => (
                    <span key={subject} className="bg-stone-50 text-stone-600 px-3 py-1 rounded-lg text-xs font-medium">
                      {subject}
                    </span>
                  ))}
                </div>
                <p className="text-stone-500 text-sm line-clamp-3 leading-relaxed">
                  {tutor.bio || "No bio available."}
                </p>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-stone-50">
                <div className="flex flex-col">
                  <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Hourly Rate</span>
                  <div className="flex items-center text-xl font-bold text-stone-900">
                    <DollarSign size={18} className="text-emerald-600" />
                    {tutor.hourlyRate}
                  </div>
                </div>
                <Link 
                  to={`/tutor/${tutor.userId}`}
                  className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm shadow-emerald-100"
                >
                  View Profile
                  <ChevronRight size={18} />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-stone-100">
          <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6 text-stone-300">
            <Search size={40} />
          </div>
          <h3 className="text-2xl font-bold mb-2">No Tutors Found</h3>
          <p className="text-stone-500">Try adjusting your search or filters to find what you're looking for.</p>
        </div>
      )}
    </div>
  );
}
