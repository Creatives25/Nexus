import React from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, addDoc, query, where, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { motion } from 'motion/react';
import { Book, Download, Search, Filter, CheckCircle, Loader2 } from 'lucide-react';

interface BookData {
  id: string;
  title: string;
  author: string;
  description: string;
  coverURL: string;
  downloadURL: string;
  category: string;
}

export default function Library() {
  const [user] = useAuthState(auth);
  const [books, setBooks] = React.useState<BookData[]>([]);
  const [userBookIds, setUserBookIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('All');
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const categories = ['All', 'Mathematics', 'Science', 'Literature', 'History', 'Technology', 'Languages'];

  const seedBooks = async () => {
    const initialBooks = [
      {
        title: "Calculus: Early Transcendentals",
        author: "James Stewart",
        description: "A comprehensive guide to calculus for science and engineering students.",
        coverURL: "https://picsum.photos/seed/calc/400/600",
        downloadURL: "#",
        category: "Mathematics"
      },
      {
        title: "The Great Gatsby",
        author: "F. Scott Fitzgerald",
        description: "A classic novel set in the Roaring Twenties.",
        coverURL: "https://picsum.photos/seed/gatsby/400/600",
        downloadURL: "#",
        category: "Literature"
      },
      {
        title: "A Brief History of Time",
        author: "Stephen Hawking",
        description: "Explaining the universe from the Big Bang to black holes.",
        coverURL: "https://picsum.photos/seed/time/400/600",
        downloadURL: "#",
        category: "Science"
      },
      {
        title: "Clean Code",
        author: "Robert C. Martin",
        description: "A handbook of agile software craftsmanship.",
        coverURL: "https://picsum.photos/seed/code/400/600",
        downloadURL: "#",
        category: "Technology"
      }
    ];

    for (const book of initialBooks) {
      await addDoc(collection(db, 'books'), book);
    }
  };

  React.useEffect(() => {
    const fetchBooks = async () => {
      setLoading(true);
      try {
        const booksSnap = await getDocs(collection(db, 'books'));
        
        // Fetch user's books if logged in
        if (user) {
          const userBooksSnap = await getDocs(query(collection(db, 'userBooks'), where('userId', '==', user.uid)));
          setUserBookIds(userBooksSnap.docs.map(d => d.data().bookId));

          // Seed if empty AND user is admin
          if (booksSnap.empty) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();
            const isAdmin = userData?.role === 'school_admin' || user.email === 'pneumasleuth@gmail.com';
            
            if (isAdmin) {
              await seedBooks();
              const newSnap = await getDocs(collection(db, 'books'));
              setBooks(newSnap.docs.map(d => ({ id: d.id, ...d.data() } as BookData)));
            } else {
              setBooks([]);
            }
          } else {
            setBooks(booksSnap.docs.map(d => ({ id: d.id, ...d.data() } as BookData)));
          }
        } else {
          setBooks(booksSnap.docs.map(d => ({ id: d.id, ...d.data() } as BookData)));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, [user]);

  const handleDownload = async (bookId: string) => {
    if (!user) {
      alert("Please sign in to download books.");
      return;
    }

    setDownloadingId(bookId);
    try {
      await addDoc(collection(db, 'userBooks'), {
        userId: user.uid,
        bookId: bookId,
        downloadedAt: serverTimestamp()
      });
      setUserBookIds(prev => [...prev, bookId]);
    } catch (err) {
      console.error(err);
      alert("Failed to add book to your library.");
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         book.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || book.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div className="space-y-4 flex-1">
          <h1 className="text-4xl font-bold tracking-tight">EduNexus Library</h1>
          <p className="text-stone-500 max-w-2xl">
            Access a vast collection of e-books, research papers, and study materials to support your learning.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-stone-200 shadow-sm w-full md:w-auto">
          <div className="flex items-center gap-2 px-4 border-r border-stone-100">
            <Search size={20} className="text-stone-400" />
            <input 
              type="text" 
              placeholder="Search books..." 
              className="bg-transparent border-none outline-none text-sm w-full md:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 px-4">
            <Filter size={20} className="text-stone-400" />
            <select 
              className="bg-transparent border-none outline-none text-sm font-medium"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse space-y-4">
              <div className="aspect-[2/3] bg-stone-100 rounded-2xl" />
              <div className="h-4 w-3/4 bg-stone-100 rounded" />
              <div className="h-3 w-1/2 bg-stone-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {filteredBooks.map((book, idx) => (
            <motion.div 
              key={book.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="group"
            >
              <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-md group-hover:shadow-xl transition-all mb-4">
                <img 
                  src={book.coverURL} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  alt={book.title}
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-6 text-center">
                  <p className="text-white text-xs leading-relaxed line-clamp-6">{book.description}</p>
                </div>
                <div className="absolute top-3 right-3">
                  <span className="bg-white/90 backdrop-blur-md text-stone-900 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                    {book.category}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-stone-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">{book.title}</h3>
                <p className="text-sm text-stone-500">{book.author}</p>
              </div>
              <div className="mt-4">
                {userBookIds.includes(book.id) ? (
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 py-2 px-4 rounded-xl justify-center">
                    <CheckCircle size={16} />
                    In Library
                  </div>
                ) : (
                  <button 
                    onClick={() => handleDownload(book.id)}
                    disabled={downloadingId === book.id}
                    className="w-full bg-stone-900 text-white py-2 rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {downloadingId === book.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    Add to Library
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
