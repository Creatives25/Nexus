import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, 
  Mic, 
  MicOff, 
  VideoOff, 
  PhoneOff, 
  MessageSquare, 
  Users, 
  Sparkles, 
  ArrowLeft,
  Settings,
  Maximize2,
  Layout,
  BrainCircuit,
  ShieldCheck,
  Activity,
  Loader2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface Classroom {
  id: string;
  name: string;
  subject: string;
}

export default function VirtualClassroom() {
  const { id } = useParams<{ id: string }>();
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  
  const [classroom, setClassroom] = React.useState<Classroom | null>(null);
  const [isJoined, setIsJoined] = React.useState(false);
  const [micOn, setMicOn] = React.useState(true);
  const [videoOn, setVideoOn] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'chat' | 'shadow' | 'buddy' | 'participants'>('shadow');
  
  const [shadowInsights, setShadowInsights] = React.useState<{ text: string; time: string }[]>([]);
  const [transcription, setTranscription] = React.useState<string[]>([]);
  const [buddyMessages, setBuddyMessages] = React.useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [buddyInput, setBuddyInput] = React.useState('');
  const [isBuddyTyping, setIsBuddyTyping] = React.useState(false);
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  React.useEffect(() => {
    if (!id || !user) return;

    const fetchClassroom = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'classrooms', id));
        if (docSnap.exists()) {
          setClassroom({ id: docSnap.id, ...docSnap.data() } as Classroom);
        } else {
          navigate('/dashboard');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'classrooms');
      }
    };

    fetchClassroom();
  }, [id, user, navigate]);

  // Simulate transcription and AI Shadow duties
  React.useEffect(() => {
    if (!isJoined) return;

    const phrases = [
      "Welcome everyone to today's Physics session.",
      "Today we are exploring the laws of thermodynamics.",
      "Does anyone have questions about the first law?",
      "Energy cannot be created or destroyed, only transformed.",
      "Let's look at this diagram on the screen.",
      "Notice how the heat flows from the warmer body to the cooler one."
    ];

    let index = 0;
    const interval = setInterval(async () => {
      if (index < phrases.length) {
        const text = phrases[index];
        setTranscription(prev => [...prev, text].slice(-5));
        
        // AI Shadow Duty: Analyze and provide insight
        if (index % 2 === 1) {
          try {
            const response = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: `As an AI Classroom Shadow, provide a brief, helpful insight or context for this statement in a Physics class: "${text}". Keep it under 20 words.`,
              config: {
                systemInstruction: "You are an AI Shadow assistant in a virtual classroom. Your duty is to provide real-time insights, clarify concepts, and monitor student engagement silently."
              }
            });
            
            setShadowInsights(prev => [
              { text: response.text || "Analyzing concept...", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
              ...prev
            ].slice(0, 10));
          } catch (e) {
            console.error("Shadow AI error:", e);
          }
        }
        
        index++;
      } else {
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isJoined]);

  const handleBuddySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buddyInput.trim() || isBuddyTyping) return;

    const userMsg = buddyInput.trim();
    setBuddyMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setBuddyInput('');
    setIsBuddyTyping(true);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Context from current lesson: ${transcription.join(' ')}. Student Question: ${userMsg}`,
        config: {
          systemInstruction: "You are the AI Study Buddy in a virtual classroom. Your goal is to help students understand the current lesson by providing clear, simple explanations and summaries. Use the provided transcription context to answer questions accurately."
        }
      });
      setBuddyMessages(prev => [...prev, { role: 'assistant', content: response.text || "I'm sorry, I couldn't process that." }]);
    } catch (error) {
      console.error("Study Buddy error:", error);
      setBuddyMessages(prev => [...prev, { role: 'assistant', content: "I'm having a bit of trouble connecting right now." }]);
    } finally {
      setIsBuddyTyping(false);
    }
  };

  const handleSummarizeLesson = async () => {
    if (isBuddyTyping) return;
    setIsBuddyTyping(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Summarize the key points of this lesson so far based on this transcription: ${transcription.join(' ')}`,
        config: {
          systemInstruction: "You are the AI Study Buddy. Provide a concise, bulleted summary of the lesson content provided."
        }
      });
      setBuddyMessages(prev => [...prev, { role: 'assistant', content: response.text || "No content to summarize yet." }]);
    } catch (error) {
      console.error("Summary error:", error);
    } finally {
      setIsBuddyTyping(false);
    }
  };

  if (!classroom) return null;

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <button 
              onClick={() => navigate(`/digital-classroom/${id}`)}
              className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors font-bold text-sm uppercase tracking-widest"
            >
              <ArrowLeft size={16} />
              Back to Classroom
            </button>
            
            <div className="space-y-4">
              <h1 className="text-5xl font-bold text-white tracking-tighter">Ready to join?</h1>
              <p className="text-stone-400 text-lg">
                {classroom.name} • {classroom.subject}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <p className="text-white font-bold">AI Shadow Active</p>
                  <p className="text-stone-500 text-xs">Your personal learning assistant is ready.</p>
                </div>
              </div>
              
              <button 
                onClick={() => setIsJoined(true)}
                className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-bold text-xl hover:bg-emerald-500 transition-all shadow-2xl shadow-emerald-900/20"
              >
                Join Now
              </button>
            </div>
          </div>

          <div className="relative aspect-video bg-stone-800 rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl group">
            {videoOn ? (
              <img 
                src={`https://picsum.photos/seed/${user?.uid}/800/450`} 
                className="w-full h-full object-cover opacity-50"
                alt="Camera Preview"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 bg-stone-700 rounded-full flex items-center justify-center text-stone-500">
                  <VideoOff size={48} />
                </div>
              </div>
            )}
            
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
              <button 
                onClick={() => setMicOn(!micOn)}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${micOn ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white'}`}
              >
                {micOn ? <Mic size={24} /> : <MicOff size={24} />}
              </button>
              <button 
                onClick={() => setVideoOn(!videoOn)}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${videoOn ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white'}`}
              >
                {videoOn ? <Video size={24} /> : <VideoOff size={24} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col">
      {/* Top Bar */}
      <div className="h-16 border-b border-white/5 px-6 flex items-center justify-between bg-stone-900/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
            <Video size={18} />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">{classroom.name}</h2>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Live Session</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-stone-900 bg-stone-800 overflow-hidden">
                <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="User" referrerPolicy="no-referrer" />
              </div>
            ))}
            <div className="w-8 h-8 rounded-full border-2 border-stone-900 bg-stone-800 flex items-center justify-center text-[10px] font-bold text-stone-400">
              +12
            </div>
          </div>
          <button className="text-stone-400 hover:text-white transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
          <div className="flex-1 relative bg-stone-900 rounded-[3rem] overflow-hidden border border-white/5 shadow-2xl">
            {/* Teacher Stream (Simulated) */}
            <img 
              src="https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=1920" 
              className="w-full h-full object-cover"
              alt="Teacher Stream"
              referrerPolicy="no-referrer"
            />
            
            {/* Overlay Info */}
            <div className="absolute top-8 left-8 flex items-center gap-3">
              <div className="px-4 py-2 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 text-white text-xs font-bold flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                Dr. John Smith (Teacher)
              </div>
            </div>

            {/* Subtitles / Transcription */}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6">
              <div className="bg-black/60 backdrop-blur-xl p-6 rounded-3xl border border-white/10 text-center">
                <AnimatePresence mode="wait">
                  <motion.p 
                    key={transcription[transcription.length - 1]}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-white text-xl font-medium leading-relaxed"
                  >
                    {transcription[transcription.length - 1] || "Waiting for audio..."}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            {/* Self View */}
            <div className="absolute bottom-8 right-8 w-48 aspect-video bg-stone-800 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl">
              {videoOn ? (
                <img 
                  src={`https://picsum.photos/seed/${user?.uid}/300/200`} 
                  className="w-full h-full object-cover"
                  alt="Self View"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-600">
                  <VideoOff size={24} />
                </div>
              )}
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/40 rounded-md text-[10px] text-white font-bold">
                You
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="h-20 flex items-center justify-center gap-4">
            <button 
              onClick={() => setMicOn(!micOn)}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${micOn ? 'bg-stone-800 text-white hover:bg-stone-700' : 'bg-red-500 text-white'}`}
            >
              {micOn ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            <button 
              onClick={() => setVideoOn(!videoOn)}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${videoOn ? 'bg-stone-800 text-white hover:bg-stone-700' : 'bg-red-500 text-white'}`}
            >
              {videoOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
            <div className="w-px h-8 bg-white/10 mx-2" />
            <button className="w-14 h-14 bg-stone-800 text-white rounded-2xl flex items-center justify-center hover:bg-stone-700 transition-all">
              <MessageSquare size={24} />
            </button>
            <button className="w-14 h-14 bg-stone-800 text-white rounded-2xl flex items-center justify-center hover:bg-stone-700 transition-all">
              <Users size={24} />
            </button>
            <button className="w-14 h-14 bg-stone-800 text-white rounded-2xl flex items-center justify-center hover:bg-stone-700 transition-all">
              <Maximize2 size={24} />
            </button>
            <div className="w-px h-8 bg-white/10 mx-2" />
            <button 
              onClick={() => setIsJoined(false)}
              className="px-8 h-14 bg-red-500 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-red-600 transition-all"
            >
              <PhoneOff size={20} />
              Leave
            </button>
          </div>
        </div>

        {/* Sidebar: AI Shadow & Chat */}
        <div className="w-[400px] border-l border-white/5 flex flex-col bg-stone-900/30 backdrop-blur-sm">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex gap-1 p-1 bg-stone-800 rounded-xl">
              <button 
                onClick={() => setActiveTab('shadow')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'shadow' ? 'bg-emerald-600 text-white shadow-lg' : 'text-stone-400 hover:text-white'}`}
              >
                <Sparkles size={14} />
                AI Shadow
              </button>
              <button 
                onClick={() => setActiveTab('buddy')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'buddy' ? 'bg-emerald-600 text-white shadow-lg' : 'text-stone-400 hover:text-white'}`}
              >
                <BrainCircuit size={14} />
                Study Buddy
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'chat' ? 'bg-emerald-600 text-white shadow-lg' : 'text-stone-400 hover:text-white'}`}
              >
                <MessageSquare size={14} />
                Chat
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'shadow' ? (
              <div className="space-y-6">
                <div className="p-6 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 space-y-4">
                  <div className="flex items-center gap-3 text-emerald-400">
                    <BrainCircuit size={24} />
                    <h3 className="font-bold">Shadowing Active</h3>
                  </div>
                  <p className="text-stone-400 text-sm leading-relaxed">
                    I am monitoring the session to provide real-time insights and capture key learning points.
                  </p>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                    <Activity size={12} className="animate-pulse" />
                    Listening for concepts...
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-stone-500 uppercase tracking-[0.2em] ml-2">Recent Insights</h4>
                  <AnimatePresence initial={false}>
                    {shadowInsights.map((insight, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Concept Note</span>
                          <span className="text-[10px] text-stone-600 font-bold">{insight.time}</span>
                        </div>
                        <p className="text-stone-300 text-sm leading-relaxed italic">
                          "{insight.text}"
                        </p>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {shadowInsights.length === 0 && (
                    <div className="py-20 text-center space-y-4">
                      <div className="w-12 h-12 bg-stone-800 rounded-full flex items-center justify-center mx-auto text-stone-600">
                        <Sparkles size={24} />
                      </div>
                      <p className="text-stone-500 text-sm italic">Waiting for key concepts to emerge...</p>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'buddy' ? (
              <div className="h-full flex flex-col space-y-6">
                <div className="p-6 bg-blue-500/10 rounded-3xl border border-blue-500/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-blue-400">
                      <BrainCircuit size={24} />
                      <h3 className="font-bold">Study Buddy</h3>
                    </div>
                    <button 
                      onClick={handleSummarizeLesson}
                      className="px-3 py-1 bg-blue-500 text-white text-[10px] font-bold rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Summarize
                    </button>
                  </div>
                  <p className="text-stone-400 text-sm leading-relaxed">
                    Ask me anything about the current lesson. I'm here to help you understand!
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {buddyMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                        msg.role === 'user' 
                          ? 'bg-emerald-600 text-white rounded-tr-none' 
                          : 'bg-white/5 text-stone-300 border border-white/10 rounded-tl-none'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isBuddyTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/10">
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleBuddySubmit} className="relative">
                  <input 
                    type="text" 
                    value={buddyInput}
                    onChange={(e) => setBuddyInput(e.target.value)}
                    placeholder="Ask Study Buddy..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-stone-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </form>
              </div>
            ) : (
              <div className="h-full flex flex-col justify-end space-y-4">
                <div className="flex-1 flex flex-col justify-center items-center text-center space-y-4 opacity-50">
                  <MessageSquare size={48} className="text-stone-700" />
                  <p className="text-stone-500 text-sm">Chat is empty. Start the conversation!</p>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Type a message..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-stone-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
