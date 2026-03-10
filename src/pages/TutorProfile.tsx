import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { motion } from 'motion/react';
import { Star, MapPin, DollarSign, Calendar, Clock, ShieldCheck, MessageCircle, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';

interface TutorProfileData {
  userId: string;
  name: string;
  photoURL: string;
  subjects: string[];
  hourlyRate: number;
  rating: number;
  reviewCount: number;
  bio: string;
  experience: string;
  country: string;
}

export default function TutorProfile() {
  const { id } = useParams();
  const [user] = useAuthState(auth);
  const [tutor, setTutor] = React.useState<TutorProfileData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [bookingLoading, setBookingLoading] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const fetchTutor = async () => {
      if (!id) return;
      try {
        const tutorDoc = await getDoc(doc(db, 'tutors', id));
        const userDoc = await getDoc(doc(db, 'users', id));
        
        if (tutorDoc.exists() && userDoc.exists()) {
          const t = tutorDoc.data();
          const u = userDoc.data();
          setTutor({
            userId: id,
            name: u.name,
            photoURL: u.photoURL,
            subjects: t.subjects,
            hourlyRate: t.hourlyRate,
            rating: t.rating || 0,
            reviewCount: t.reviewCount || 0,
            bio: t.bio,
            experience: t.experience,
            country: u.country || 'Global'
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTutor();
  }, [id]);

  const handleBook = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!tutor) return;

    setBookingLoading(true);
    try {
      // Create a class session
      const classRef = await addDoc(collection(db, 'classes'), {
        tutorId: tutor.userId,
        subject: tutor.subjects[0] || 'General',
        scheduledTime: serverTimestamp(), // In real app, user would pick a time
        duration: 60,
        status: 'scheduled',
        videoSessionLink: `https://meet.jit.si/EduNexus-${Math.random().toString(36).substring(7)}`
      });

      // Create a booking
      await addDoc(collection(db, 'bookings'), {
        studentId: user.uid,
        tutorId: tutor.userId,
        classId: classRef.id,
        paymentStatus: 'paid',
        createdAt: serverTimestamp()
      });

      alert('Booking successful! You can find your class in the dashboard.');
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      alert('Failed to book class. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!tutor) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Tutor not found</h2>
        <button onClick={() => navigate('/marketplace')} className="mt-4 text-emerald-600 font-bold underline">
          Back to Marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <button 
        onClick={() => navigate('/marketplace')}
        className="flex items-center gap-2 text-stone-500 hover:text-emerald-600 font-bold transition-colors"
      >
        <ChevronLeft size={20} />
        Back to Marketplace
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column: Info */}
        <div className="lg:col-span-2 space-y-12">
          <section className="flex flex-col md:flex-row gap-8 items-start">
            <img 
              src={tutor.photoURL} 
              className="w-40 h-40 rounded-3xl object-cover shadow-xl border-4 border-white"
              referrerPolicy="no-referrer"
              alt={tutor.name}
            />
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold tracking-tight">{tutor.name}</h1>
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  <Star size={16} fill="currentColor" />
                  {tutor.rating.toFixed(1)}
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-stone-500">
                <div className="flex items-center gap-1.5">
                  <MapPin size={18} className="text-emerald-600" />
                  {tutor.country}
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={18} className="text-emerald-600" />
                  Verified Tutor
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageCircle size={18} className="text-emerald-600" />
                  {tutor.reviewCount} Reviews
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {tutor.subjects.map(subject => (
                  <span key={subject} className="bg-white border border-stone-200 text-stone-700 px-4 py-1.5 rounded-xl text-sm font-bold">
                    {subject}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-bold">About Me</h2>
            <p className="text-stone-600 leading-relaxed text-lg">
              {tutor.bio || "No bio available."}
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-bold">Teaching Experience</h2>
            <p className="text-stone-600 leading-relaxed text-lg">
              {tutor.experience || "No experience details provided."}
            </p>
          </section>
        </div>

        {/* Right Column: Booking Card */}
        <div className="lg:col-span-1">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-xl sticky top-24"
          >
            <div className="flex items-end justify-between mb-8">
              <div className="flex flex-col">
                <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Hourly Rate</span>
                <div className="flex items-center text-3xl font-bold text-stone-900">
                  <DollarSign size={24} className="text-emerald-600" />
                  {tutor.hourlyRate}
                </div>
              </div>
              <div className="text-stone-400 text-sm font-medium">60 min lesson</div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                <Calendar size={20} className="text-emerald-600" />
                <div>
                  <p className="text-sm font-bold">Next Available</p>
                  <p className="text-xs text-stone-500">Today, 4:00 PM</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                <Clock size={20} className="text-emerald-600" />
                <div>
                  <p className="text-sm font-bold">Lesson Duration</p>
                  <p className="text-xs text-stone-500">60 Minutes</p>
                </div>
              </div>
            </div>

            <button 
              onClick={handleBook}
              disabled={bookingLoading}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {bookingLoading ? 'Processing...' : 'Book a Lesson'}
            </button>
            <p className="text-center text-stone-400 text-xs mt-4">
              No charges until the tutor accepts your booking.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
