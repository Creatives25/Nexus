import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  FileText, 
  Plus, 
  Settings,
  ArrowLeft, 
  ChevronRight, 
  Download, 
  ExternalLink,
  MessageSquare,
  Video,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { GoogleGenAI } from "@google/genai";

interface Classroom {
  id: string;
  name: string;
  subject: string;
  teacherId: string;
  schoolId: string;
  description?: string;
}

interface Activity {
  id: string;
  title: string;
  description: string;
  weekNumber: number;
  type: 'assignment' | 'reading' | 'video' | 'quiz';
  dueDate?: any;
  createdAt: any;
  resources?: { title: string; url: string }[];
}

export default function ClassroomView() {
  const { id } = useParams<{ id: string }>();
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  
  const [classroom, setClassroom] = React.useState<Classroom | null>(null);
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [userRole, setUserRole] = React.useState<string | null>(null);
  
  const [isAddingActivity, setIsAddingActivity] = React.useState(false);
  const [newActivity, setNewActivity] = React.useState({
    title: '',
    description: '',
    weekNumber: 1,
    type: 'assignment' as Activity['type'],
    dueDate: ''
  });
  const [submitting, setSubmitting] = React.useState(false);

  // Study Buddy State
  const [isBuddyOpen, setIsBuddyOpen] = React.useState(false);
  const [buddyMessages, setBuddyMessages] = React.useState<{ role: 'user' | 'assistant', content: string }[]>([
    { role: 'assistant', content: "Hi! I'm your AI Study Buddy. I can help you understand the lesson materials, summarize activities, or answer questions about this classroom. What's on your mind?" }
  ]);
  const [buddyInput, setBuddyInput] = React.useState('');
  const [isBuddyTyping, setIsBuddyTyping] = React.useState(false);

  const handleBuddySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buddyInput.trim() || isBuddyTyping) return;

    const userMessage = buddyInput.trim();
    setBuddyInput('');
    setBuddyMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsBuddyTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [{ text: `You are a helpful AI Study Buddy for a classroom named "${classroom?.name}" (${classroom?.subject}).
            
Context about the classroom:
Description: ${classroom?.description || 'No description provided.'}
Recent Activities: ${activities.map(a => `${a.title} (Week ${a.weekNumber}): ${a.description}`).join('; ')}

Student Question: ${userMessage}` }]
          }
        ],
        config: {
          systemInstruction: "You are an encouraging and knowledgeable AI Study Buddy. Your goal is to help students succeed in their studies. Use the provided classroom context to give relevant answers. Keep explanations clear and concise. If you don't know something specific about the classroom that isn't in the context, be honest but helpful."
        }
      });

      const response = await model;
      const text = response.text || "I'm sorry, I couldn't generate a response.";
      
      setBuddyMessages(prev => [...prev, { role: 'assistant', content: text }]);
    } catch (error) {
      console.error('Study Buddy Error:', error);
      setBuddyMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error. Please try again later." }]);
    } finally {
      setIsBuddyTyping(false);
    }
  };

  React.useEffect(() => {
    if (!id || !user) return;

    const fetchData = async () => {
      try {
        // Fetch user role
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }

        // Fetch classroom
        const classroomDoc = await getDoc(doc(db, 'classrooms', id));
        if (classroomDoc.exists()) {
          setClassroom({ id: classroomDoc.id, ...classroomDoc.data() } as Classroom);
        } else {
          navigate('/dashboard');
          return;
        }

        // Subscribe to activities
        const activitiesQuery = query(
          collection(db, 'activities'),
          where('classroomId', '==', id),
          orderBy('weekNumber', 'desc'),
          orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
          setActivities(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Activity)));
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'activities');
          setLoading(false);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error fetching classroom data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user, navigate]);

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user || !classroom) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'activities'), {
        classroomId: id,
        teacherId: user.uid,
        schoolId: classroom.schoolId,
        ...newActivity,
        createdAt: serverTimestamp()
      });
      setIsAddingActivity(false);
      setNewActivity({
        title: '',
        description: '',
        weekNumber: 1,
        type: 'assignment',
        dueDate: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'activities');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mx-auto" />
          <p className="text-stone-500 font-medium">Entering classroom...</p>
        </div>
      </div>
    );
  }

  if (!classroom) return null;

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-stone-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-stone-50 rounded-xl transition-colors text-stone-400 hover:text-stone-900"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-stone-900">{classroom.name}</h1>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-widest rounded-full">
                  {classroom.subject}
                </span>
              </div>
              <p className="text-stone-400 text-sm font-medium">Digital Classroom</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {userRole === 'teacher' && (
              <button
                onClick={() => setIsAddingActivity(true)}
                className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100"
              >
                <Plus size={20} />
                Add Activity
              </button>
            )}
            <button className="p-3 bg-stone-50 text-stone-600 rounded-xl hover:bg-stone-100 transition-colors">
              <Settings size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main Content: Activities */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-stone-900">Weekly Activities</h2>
            <div className="flex items-center gap-2 text-stone-400 text-sm font-bold uppercase tracking-wider">
              <Calendar size={16} />
              <span>Term 1, 2024</span>
            </div>
          </div>

          {activities.length > 0 ? (
            <div className="space-y-6">
              {activities.map((activity) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden group"
                >
                  <div className="p-8">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                          activity.type === 'assignment' ? 'bg-blue-50 text-blue-600' :
                          activity.type === 'reading' ? 'bg-amber-50 text-amber-600' :
                          activity.type === 'video' ? 'bg-red-50 text-red-600' :
                          'bg-purple-50 text-purple-600'
                        }`}>
                          {activity.type === 'assignment' ? <FileText size={28} /> :
                           activity.type === 'reading' ? <BookOpen size={28} /> :
                           activity.type === 'video' ? <Video size={28} /> :
                           <CheckCircle2 size={28} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-emerald-600 font-bold text-sm">Week {activity.weekNumber}</span>
                            <h3 className="text-xl font-bold text-stone-900">{activity.title}</h3>
                          </div>
                          <p className="text-stone-400 text-sm font-medium uppercase tracking-wider">
                            {activity.type} • Posted {activity.createdAt?.toDate ? format(activity.createdAt.toDate(), 'MMM d, yyyy') : 'Just now'}
                          </p>
                        </div>
                      </div>
                      {activity.dueDate && (
                        <div className="text-right">
                          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Due Date</p>
                          <p className="text-stone-900 font-bold">{format(new Date(activity.dueDate), 'MMM d')}</p>
                        </div>
                      )}
                    </div>

                    <p className="text-stone-600 leading-relaxed mb-8">
                      {activity.description}
                    </p>

                    <div className="flex items-center justify-between pt-6 border-t border-stone-50">
                      <div className="flex items-center gap-4">
                        <button className="flex items-center gap-2 text-stone-400 hover:text-emerald-600 transition-colors font-bold text-sm">
                          <MessageSquare size={18} />
                          <span>12 Comments</span>
                        </button>
                      </div>
                      <button className="bg-stone-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center gap-2">
                        View Details
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-20 rounded-[3rem] border border-stone-100 text-center space-y-6 shadow-sm">
              <div className="w-24 h-24 bg-stone-50 rounded-[2rem] flex items-center justify-center mx-auto text-stone-200">
                <BookOpen size={48} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-stone-900">No activities yet</h3>
                <p className="text-stone-500 max-w-xs mx-auto">
                  {userRole === 'teacher' ? 'Start by adding your first weekly activity for the students.' : 'Your teacher hasn\'t posted any activities for this week yet.'}
                </p>
              </div>
              {userRole === 'teacher' && (
                <button 
                  onClick={() => setIsAddingActivity(true)}
                  className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  <Plus size={20} />
                  Add First Activity
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: Classroom Info & Resources */}
        <div className="space-y-8">
          {/* Classroom Card */}
          <div className="bg-stone-900 rounded-[2.5rem] p-8 text-white space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />
            <div className="relative space-y-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Classroom Info</h3>
                <p className="text-stone-400 text-sm leading-relaxed">
                  {classroom.description || 'Welcome to our digital learning space. Here you\'ll find all resources and activities for the term.'}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <Users size={20} className="text-emerald-400" />
                    <span className="font-bold">Students</span>
                  </div>
                  <span className="text-emerald-400 font-bold">24</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <Video size={20} className="text-emerald-400" />
                    <span className="font-bold">Live Sessions</span>
                  </div>
                  <span className="text-emerald-400 font-bold">Mon, Wed</span>
                </div>
              </div>

              <button 
                onClick={() => navigate(`/virtual-classroom/${id}`)}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-500 transition-all flex items-center justify-center gap-2"
              >
                Join Live Session
                <ExternalLink size={18} />
              </button>
            </div>
          </div>

          {/* Resources Card */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-stone-100 shadow-sm space-y-6">
            <h3 className="text-xl font-bold text-stone-900">General Resources</h3>
            <div className="space-y-4">
              {[
                { title: 'Syllabus 2024', type: 'PDF', size: '2.4 MB' },
                { title: 'Reading List', type: 'DOC', size: '1.1 MB' },
                { title: 'Project Guidelines', type: 'PDF', size: '3.8 MB' }
              ].map((resource, i) => (
                <div key={i} className="flex items-center justify-between p-4 hover:bg-stone-50 rounded-2xl transition-colors group cursor-pointer border border-transparent hover:border-stone-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-stone-900 text-sm">{resource.title}</p>
                      <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">{resource.type} • {resource.size}</p>
                    </div>
                  </div>
                  <Download size={18} className="text-stone-300 group-hover:text-emerald-600 transition-colors" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Activity Modal */}
      <AnimatePresence>
        {isAddingActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingActivity(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h2 className="text-3xl font-bold text-stone-900">Add Activity</h2>
                    <p className="text-stone-500 font-medium">Create a new weekly task for your students</p>
                  </div>
                  <button 
                    onClick={() => setIsAddingActivity(false)}
                    className="p-3 hover:bg-stone-50 rounded-2xl transition-colors text-stone-400"
                  >
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>

                <form onSubmit={handleAddActivity} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-widest ml-1">Activity Title</label>
                      <input
                        required
                        type="text"
                        value={newActivity.title}
                        onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                        placeholder="e.g., Introduction to Algebra"
                        className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-widest ml-1">Activity Type</label>
                      <select
                        value={newActivity.type}
                        onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value as any })}
                        className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                      >
                        <option value="assignment">Assignment</option>
                        <option value="reading">Reading Material</option>
                        <option value="video">Video Lesson</option>
                        <option value="quiz">Quiz</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-widest ml-1">Week Number</label>
                      <input
                        required
                        type="number"
                        min="1"
                        max="52"
                        value={newActivity.weekNumber}
                        onChange={(e) => setNewActivity({ ...newActivity, weekNumber: parseInt(e.target.value) })}
                        className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-widest ml-1">Due Date (Optional)</label>
                      <input
                        type="date"
                        value={newActivity.dueDate}
                        onChange={(e) => setNewActivity({ ...newActivity, dueDate: e.target.value })}
                        className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest ml-1">Description</label>
                    <textarea
                      required
                      rows={4}
                      value={newActivity.description}
                      onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                      placeholder="Describe the activity and what students need to do..."
                      className="w-full bg-stone-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-emerald-500 transition-all font-medium resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsAddingActivity(false)}
                      className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-2xl font-bold hover:bg-stone-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-[2] bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Posting...
                        </>
                      ) : (
                        'Post Activity'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Study Buddy Floating Button & Chat */}
      <div className="fixed bottom-8 right-8 z-40">
        <AnimatePresence>
          {isBuddyOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="absolute bottom-20 right-0 w-[400px] h-[500px] bg-white rounded-[2rem] shadow-2xl border border-stone-100 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 bg-emerald-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold">Study Buddy</h3>
                    <p className="text-xs text-emerald-100">Always here to help</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsBuddyOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-stone-50/50">
                {buddyMessages.map((msg, idx) => (
                  <div 
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium ${
                      msg.role === 'user' 
                        ? 'bg-emerald-600 text-white rounded-tr-none' 
                        : 'bg-white text-stone-700 shadow-sm border border-stone-100 rounded-tl-none'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isBuddyTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-stone-100">
                      <Loader2 size={16} className="animate-spin text-emerald-600" />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <form onSubmit={handleBuddySubmit} className="p-4 bg-white border-t border-stone-100">
                <div className="relative">
                  <input
                    type="text"
                    value={buddyInput}
                    onChange={(e) => setBuddyInput(e.target.value)}
                    placeholder="Ask your study buddy..."
                    className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 pr-12 text-sm focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                  <button 
                    type="submit"
                    disabled={!buddyInput.trim() || isBuddyTyping}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <MessageSquare size={18} />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsBuddyOpen(!isBuddyOpen)}
          className={`w-16 h-16 rounded-2xl shadow-xl flex items-center justify-center transition-all ${
            isBuddyOpen ? 'bg-stone-900 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {isBuddyOpen ? <Plus size={28} className="rotate-45" /> : <BookOpen size={28} />}
        </motion.button>
      </div>
    </div>
  );
}
