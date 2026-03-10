import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Video, Mic, MicOff, VideoOff, Monitor, MessageSquare, Users, X, Send, Sparkles, BookOpen, FileText, HelpCircle } from 'lucide-react';
import { generateAIResponse } from '../services/aiService';
import ReactMarkdown from 'react-markdown';

export default function Classroom() {
  const { id } = useParams();
  const [user] = useAuthState(auth);
  const [session, setSession] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [isVideoOn, setIsVideoOn] = React.useState(true);
  const [isMicOn, setIsMicOn] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'chat' | 'ai' | 'notes'>('chat');
  const [chatMessage, setChatMessage] = React.useState('');
  const [aiPrompt, setAiPrompt] = React.useState('');
  const [aiResponse, setAiResponse] = React.useState('');
  const [aiLoading, setAiLoading] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const fetchSession = async () => {
      if (!id) return;
      try {
        const docSnap = await getDoc(doc(db, 'classes', id));
        if (docSnap.exists()) {
          setSession(docSnap.data());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [id]);

  const handleAiAsk = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const response = await generateAIResponse(`As an AI Study Buddy in a live classroom for ${session?.subject}, help the student with: ${aiPrompt}`);
      setAiResponse(response);
    } catch (err) {
      console.error(err);
      setAiResponse("Sorry, I couldn't process that right now.");
    } finally {
      setAiLoading(false);
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
    <div className="h-[calc(100vh-160px)] flex flex-col lg:flex-row gap-6">
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="flex-1 bg-stone-900 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
          {/* Main Video (Mock) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img 
              src="https://picsum.photos/seed/tutor-video/1200/800"
              className="w-full h-full object-cover opacity-80"
              referrerPolicy="no-referrer"
              alt="Tutor Video"
            />
            <div className="absolute bottom-6 left-6 flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl text-white">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm font-bold">Dr. Sarah Johnson (Tutor)</span>
            </div>
          </div>

          {/* Self Video (Mock) */}
          <div className="absolute top-6 right-6 w-48 h-32 bg-stone-800 rounded-2xl border-2 border-white/20 overflow-hidden shadow-xl">
            {isVideoOn ? (
              <img 
                src={user?.photoURL || ''} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                alt="Self"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40">
                <VideoOff size={32} />
              </div>
            )}
            <div className="absolute bottom-2 left-2 text-[10px] font-bold text-white bg-black/40 px-2 py-0.5 rounded-md">
              You
            </div>
          </div>

          {/* Controls */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/10 backdrop-blur-xl p-3 rounded-3xl border border-white/20">
            <button 
              onClick={() => setIsMicOn(!isMicOn)}
              className={`p-4 rounded-2xl transition-all ${isMicOn ? 'bg-white text-stone-900' : 'bg-red-500 text-white'}`}
            >
              {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            <button 
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`p-4 rounded-2xl transition-all ${isVideoOn ? 'bg-white text-stone-900' : 'bg-red-500 text-white'}`}
            >
              {isVideoOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
            <button className="p-4 rounded-2xl bg-white/20 text-white hover:bg-white/30 transition-all">
              <Monitor size={24} />
            </button>
            <div className="w-px h-8 bg-white/20 mx-2" />
            <button 
              onClick={() => navigate('/dashboard')}
              className="bg-red-500 text-white px-8 py-4 rounded-2xl font-bold hover:bg-red-600 transition-all"
            >
              Leave Class
            </button>
          </div>
        </div>

        {/* Info Bar */}
        <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <BookOpen size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{session?.subject}</h2>
              <p className="text-stone-500 text-sm">Live Session • 60 Minutes</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[1, 2].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-stone-200" />
              ))}
            </div>
            <span className="text-sm font-bold text-stone-400">2 Participants</span>
          </div>
        </div>
      </div>

      {/* Sidebar Area */}
      <div className="w-full lg:w-96 bg-white rounded-[2.5rem] border border-stone-100 shadow-xl flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex p-2 bg-stone-50 m-4 rounded-2xl">
          {[
            { id: 'chat', icon: <MessageSquare size={18} />, label: 'Chat' },
            { id: 'ai', icon: <Sparkles size={18} />, label: 'AI Buddy' },
            { id: 'notes', icon: <FileText size={18} />, label: 'Notes' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id ? 'bg-white text-emerald-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="bg-stone-50 p-4 rounded-2xl">
                  <p className="text-xs font-bold text-emerald-600 mb-1">Dr. Sarah Johnson</p>
                  <p className="text-sm text-stone-700">Welcome everyone! Today we'll be discussing the core concepts of {session?.subject}.</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-2xl ml-8">
                  <p className="text-xs font-bold text-emerald-700 mb-1">You</p>
                  <p className="text-sm text-stone-700">Looking forward to it!</p>
                </div>
              </motion.div>
            )}

            {activeTab === 'ai' && (
              <motion.div 
                key="ai"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="bg-emerald-900 text-white p-6 rounded-3xl space-y-3 relative overflow-hidden">
                  <Sparkles size={48} className="absolute -top-4 -right-4 text-white/10" />
                  <h3 className="text-lg font-bold relative z-10">AI Study Buddy</h3>
                  <p className="text-xs text-emerald-100 relative z-10">Ask me anything about the current lesson, or request a summary.</p>
                </div>

                {aiResponse && (
                  <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100">
                    <div className="flex items-center gap-2 text-emerald-600 mb-3">
                      <Sparkles size={16} />
                      <span className="text-xs font-bold uppercase tracking-wider">AI Response</span>
                    </div>
                    <div className="text-sm text-stone-700 prose prose-sm max-w-none">
                      <ReactMarkdown>{aiResponse}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {aiLoading && (
                  <div className="flex items-center gap-3 p-4 bg-stone-50 rounded-2xl animate-pulse">
                    <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce delay-75" />
                    <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce delay-150" />
                    <span className="text-xs font-bold text-stone-400">AI is thinking...</span>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'notes' && (
              <motion.div 
                key="notes"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <textarea 
                  className="w-full h-64 p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors text-sm"
                  placeholder="Take your notes here..."
                />
                <button className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                  <FileText size={18} />
                  Save Notes
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-stone-100">
          {activeTab === 'chat' && (
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Type a message..."
                className="flex-1 bg-stone-50 p-4 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors text-sm"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
              />
              <button className="bg-emerald-600 text-white p-4 rounded-2xl hover:bg-emerald-700 transition-all">
                <Send size={20} />
              </button>
            </div>
          )}
          {activeTab === 'ai' && (
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Ask AI Buddy..."
                className="flex-1 bg-stone-50 p-4 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors text-sm"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAiAsk()}
              />
              <button 
                onClick={handleAiAsk}
                disabled={aiLoading}
                className="bg-stone-900 text-white p-4 rounded-2xl hover:bg-stone-800 transition-all disabled:opacity-50"
              >
                <Sparkles size={20} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
