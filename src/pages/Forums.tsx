import React from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, addDoc, query, where, serverTimestamp, doc, getDoc, deleteDoc, setDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Users, Plus, Send, ChevronRight, X, Hash, Sparkles, Loader2, User, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface Forum {
  id: string;
  name: string;
  description: string;
  category: string;
  createdAt: any;
  createdBy: string;
}

interface ForumPost {
  id: string;
  forumId: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  createdAt: any;
}

export default function Forums() {
  const [user] = useAuthState(auth);
  const [forums, setForums] = React.useState<Forum[]>([]);
  const [joinedForumIds, setJoinedForumIds] = React.useState<string[]>([]);
  const [selectedForum, setSelectedForum] = React.useState<Forum | null>(null);
  const [posts, setPosts] = React.useState<ForumPost[]>([]);
  const [newPost, setNewPost] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [profile, setProfile] = React.useState<any>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [forumData, setForumData] = React.useState({
    name: '',
    description: '',
    category: 'Mathematics'
  });

  const categories = ['Mathematics', 'Science', 'Literature', 'History', 'Technology', 'Languages'];

  React.useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Fetch user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data());
        }

        // Fetch forums
        const forumsSnap = await getDocs(collection(db, 'forums'));
        const forumsData = forumsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Forum));
        setForums(forumsData);

        // Fetch joined forums
        const membersSnap = await getDocs(query(collection(db, 'forumMembers'), where('userId', '==', user.uid)));
        setJoinedForumIds(membersSnap.docs.map(d => d.data().forumId));

        // Seed if empty and admin
        if (forumsSnap.empty && (user.email === 'pneumasleuth@gmail.com' || userDoc.data()?.role === 'school_admin')) {
          const initialForums = [
            { name: 'Mathematics Hub', description: 'Discuss calculus, algebra, and more.', category: 'Mathematics' },
            { name: 'Science Explorers', description: 'Physics, Chemistry, and Biology discussions.', category: 'Science' },
            { name: 'Tech Talk', description: 'Coding, AI, and latest technology trends.', category: 'Technology' }
          ];
          for (const f of initialForums) {
            await addDoc(collection(db, 'forums'), {
              ...f,
              createdAt: serverTimestamp(),
              createdBy: user.uid
            });
          }
          const newSnap = await getDocs(collection(db, 'forums'));
          setForums(newSnap.docs.map(d => ({ id: d.id, ...d.data() } as Forum)));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  React.useEffect(() => {
    if (!selectedForum) {
      setPosts([]);
      return;
    }

    const q = query(
      collection(db, 'forumPosts'),
      where('forumId', '==', selectedForum.id),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ForumPost)));
    }, (error) => {
      console.error("Firestore Error: ", error);
    });

    return () => unsubscribe();
  }, [selectedForum]);

  const handleJoinForum = async (forumId: string) => {
    if (!user) return;
    try {
      const memberId = `${forumId}_${user.uid}`;
      await setDoc(doc(db, 'forumMembers', memberId), {
        forumId,
        userId: user.uid,
        joinedAt: serverTimestamp()
      });
      setJoinedForumIds(prev => [...prev, forumId]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveForum = async (forumId: string) => {
    if (!user) return;
    try {
      const memberId = `${forumId}_${user.uid}`;
      await deleteDoc(doc(db, 'forumMembers', memberId));
      setJoinedForumIds(prev => prev.filter(id => id !== forumId));
      if (selectedForum?.id === forumId) setSelectedForum(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateForum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || profile.role !== 'school_admin' && user.email !== 'pneumasleuth@gmail.com') return;
    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'forums'), {
        ...forumData,
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });
      setForums(prev => [...prev, { id: docRef.id, ...forumData, createdAt: new Date(), createdBy: user.uid } as Forum]);
      setIsCreateModalOpen(false);
      setForumData({ name: '', description: '', category: 'Mathematics' });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedForum || !newPost.trim()) return;
    try {
      await addDoc(collection(db, 'forumPosts'), {
        forumId: selectedForum.id,
        authorId: user.uid,
        authorName: profile?.name || user.displayName || 'Anonymous',
        authorPhoto: profile?.photoURL || user.photoURL || '',
        content: newPost,
        createdAt: serverTimestamp()
      });
      setNewPost('');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col md:flex-row gap-8">
      {/* Sidebar: Forums List */}
      <div className="w-full md:w-80 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Subject Forums</h1>
          {(profile?.role === 'school_admin' || user?.email === 'pneumasleuth@gmail.com') && (
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
            >
              <Plus size={20} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {forums.map((forum) => {
            const isJoined = joinedForumIds.includes(forum.id);
            const isSelected = selectedForum?.id === forum.id;

            return (
              <div 
                key={forum.id}
                onClick={() => isJoined && setSelectedForum(forum)}
                className={`relative p-4 rounded-2xl border transition-all cursor-pointer group ${
                  isSelected 
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' 
                    : 'bg-white border-stone-100 hover:border-emerald-200'
                }`}
              >
                {/* Selected Indicator Bar */}
                {isSelected && (
                  <motion.div 
                    layoutId="selected-bar"
                    className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-white rounded-r-full"
                  />
                )}

                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
                    }`}>
                      {forum.category}
                    </span>
                    {isJoined && (
                      <span className={`flex items-center gap-1 text-[10px] font-bold uppercase ${
                        isSelected ? 'text-white/70' : 'text-emerald-600'
                      }`}>
                        <CheckCircle2 size={10} />
                        Joined
                      </span>
                    )}
                  </div>
                  {isJoined ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleLeaveForum(forum.id); }}
                      className={`text-[10px] font-bold uppercase hover:underline ${
                        isSelected ? 'text-white/70' : 'text-red-500'
                      }`}
                    >
                      Leave
                    </button>
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleJoinForum(forum.id); }}
                      className="text-[10px] font-bold uppercase text-emerald-600 hover:underline"
                    >
                      Join
                    </button>
                  )}
                </div>
                <h3 className="font-bold leading-tight mb-1">{forum.name}</h3>
                <p className={`text-xs line-clamp-2 ${
                  isSelected ? 'text-white/80' : 'text-stone-500'
                }`}>
                  {forum.description}
                </p>
                {!isJoined && (
                  <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <Users size={12} />
                    Join to participate
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content: Chat Area */}
      <div className="flex-1 bg-white rounded-[2.5rem] border border-stone-100 shadow-sm flex flex-col overflow-hidden">
        {selectedForum ? (
          <>
            {/* Forum Header */}
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                  <Hash size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selectedForum.name}</h2>
                  <p className="text-sm text-stone-500">{selectedForum.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-stone-400">
                <Users size={18} />
                <span className="text-sm font-medium">Active Community</span>
              </div>
            </div>

            {/* Posts Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {posts.map((post) => (
                <div key={post.id} className={`flex gap-4 ${post.authorId === user?.uid ? 'flex-row-reverse' : ''}`}>
                  <div className="flex-shrink-0">
                    {post.authorPhoto ? (
                      <img src={post.authorPhoto} className="w-10 h-10 rounded-xl object-cover" alt={post.authorName} referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-400">
                        <User size={20} />
                      </div>
                    )}
                  </div>
                  <div className={`max-w-[80%] space-y-1 ${post.authorId === user?.uid ? 'items-end' : ''}`}>
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs font-bold text-stone-900">{post.authorName}</span>
                      <span className="text-[10px] text-stone-400">
                        {post.createdAt?.toDate ? format(post.createdAt.toDate(), 'HH:mm') : 'Just now'}
                      </span>
                    </div>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      post.authorId === user?.uid 
                        ? 'bg-emerald-600 text-white rounded-tr-none' 
                        : 'bg-stone-50 text-stone-700 rounded-tl-none border border-stone-100'
                    }`}>
                      {post.content}
                    </div>
                  </div>
                </div>
              ))}
              {posts.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                  <MessageSquare size={48} />
                  <p className="font-medium">No discussions yet. Be the first to post!</p>
                </div>
              )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendPost} className="p-6 border-t border-stone-100 bg-stone-50/50">
              <div className="relative flex items-center gap-4">
                <input 
                  type="text" 
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder={`Message #${selectedForum.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="flex-1 p-4 pr-14 bg-white rounded-2xl border border-stone-200 outline-none focus:border-emerald-600 transition-all shadow-sm"
                />
                <button 
                  type="submit"
                  disabled={!newPost.trim()}
                  className="absolute right-2 p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:hover:bg-emerald-600"
                >
                  <Send size={20} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
            <div className="w-24 h-24 bg-emerald-50 rounded-[2rem] flex items-center justify-center text-emerald-600">
              <Sparkles size={48} />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-2xl font-bold">Welcome to Subject Forums</h2>
              <p className="text-stone-500">
                Select a forum from the sidebar to start discussing ideas, solving problems, and collaborating with your peers.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 text-left">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-emerald-600 mb-3 shadow-sm">
                  <Users size={16} />
                </div>
                <p className="text-xs font-bold text-stone-900 mb-1">Collaborate</p>
                <p className="text-[10px] text-stone-500">Work together on complex topics</p>
              </div>
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 text-left">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-emerald-600 mb-3 shadow-sm">
                  <MessageSquare size={16} />
                </div>
                <p className="text-xs font-bold text-stone-900 mb-1">Discuss</p>
                <p className="text-[10px] text-stone-500">Share ideas and insights</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Forum Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-stone-100 flex items-center justify-between">
                <h2 className="text-2xl font-bold">Create New Forum</h2>
                <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleCreateForum} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Forum Name</label>
                  <input 
                    required
                    type="text" 
                    value={forumData.name}
                    onChange={(e) => setForumData({...forumData, name: e.target.value})}
                    className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors"
                    placeholder="e.g. Advanced Calculus"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Category</label>
                  <select 
                    value={forumData.category}
                    onChange={(e) => setForumData({...forumData, category: e.target.value})}
                    className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Description</label>
                  <textarea 
                    required
                    value={forumData.description}
                    onChange={(e) => setForumData({...forumData, description: e.target.value})}
                    className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors h-32"
                    placeholder="What is this forum for?"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                  Create Forum
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
