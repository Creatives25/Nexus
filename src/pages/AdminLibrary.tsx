import React from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Edit2, X, Save, Search, Filter, Book, Upload, Loader2, AlertCircle } from 'lucide-react';

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

interface BookData {
  id: string;
  title: string;
  author: string;
  description: string;
  coverURL: string;
  downloadURL: string;
  category: string;
}

export default function AdminLibrary() {
  const [user] = useAuthState(auth);
  const [books, setBooks] = React.useState<BookData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingBook, setEditingBook] = React.useState<BookData | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('All');
  const [submitting, setSubmitting] = React.useState(false);

  const [formData, setFormData] = React.useState({
    title: '',
    author: '',
    description: '',
    coverURL: '',
    downloadURL: '',
    category: 'Mathematics'
  });

  const categories = ['Mathematics', 'Science', 'Literature', 'History', 'Technology', 'Languages'];

  React.useEffect(() => {
    const checkAdminAndFetch = async () => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        const adminStatus = userData?.role === 'school_admin' || user.email === 'pneumasleuth@gmail.com';
        setIsAdmin(adminStatus);

        if (adminStatus) {
          const booksSnap = await getDocs(collection(db, 'books'));
          setBooks(booksSnap.docs.map(d => ({ id: d.id, ...d.data() } as BookData)));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'users/books');
      } finally {
        setLoading(false);
      }
    };

    checkAdminAndFetch();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSubmitting(true);

    try {
      if (editingBook) {
        await updateDoc(doc(db, 'books', editingBook.id), formData);
        setBooks(prev => prev.map(b => b.id === editingBook.id ? { ...b, ...formData } : b));
      } else {
        const docRef = await addDoc(collection(db, 'books'), formData);
        setBooks(prev => [...prev, { id: docRef.id, ...formData }]);
      }
      setIsModalOpen(false);
      setEditingBook(null);
      setFormData({
        title: '',
        author: '',
        description: '',
        coverURL: '',
        downloadURL: '',
        category: 'Mathematics'
      });
    } catch (err) {
      handleFirestoreError(err, editingBook ? OperationType.UPDATE : OperationType.CREATE, 'books');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this book?')) return;
    try {
      await deleteDoc(doc(db, 'books', id));
      setBooks(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `books/${id}`);
    }
  };

  const openEditModal = (book: BookData) => {
    setEditingBook(book);
    setFormData({
      title: book.title,
      author: book.author,
      description: book.description,
      coverURL: book.coverURL,
      downloadURL: book.downloadURL,
      category: book.category
    });
    setIsModalOpen(true);
  };

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         book.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || book.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-6">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-600">
          <AlertCircle size={40} />
        </div>
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-stone-500">Only school administrators can manage the library.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Library Management</h1>
          <p className="text-stone-500">Upload, categorize, and manage e-books for your school.</p>
        </div>
        <button 
          onClick={() => {
            setEditingBook(null);
            setFormData({
              title: '',
              author: '',
              description: '',
              coverURL: '',
              downloadURL: '',
              category: 'Mathematics'
            });
            setIsModalOpen(true);
          }}
          className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
        >
          <Plus size={20} />
          Add New Book
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-3xl border border-stone-100 shadow-sm">
        <div className="flex-1 flex items-center gap-3 px-4 bg-stone-50 rounded-2xl border border-stone-100">
          <Search size={20} className="text-stone-400" />
          <input 
            type="text" 
            placeholder="Search by title or author..." 
            className="w-full py-4 bg-transparent outline-none text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 px-4 bg-stone-50 rounded-2xl border border-stone-100">
          <Filter size={20} className="text-stone-400" />
          <select 
            className="py-4 bg-transparent outline-none text-sm font-medium"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-100">
              <th className="p-6 text-xs font-bold text-stone-500 uppercase tracking-wider">Book</th>
              <th className="p-6 text-xs font-bold text-stone-500 uppercase tracking-wider">Category</th>
              <th className="p-6 text-xs font-bold text-stone-500 uppercase tracking-wider">Author</th>
              <th className="p-6 text-xs font-bold text-stone-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {filteredBooks.map((book) => (
              <tr key={book.id} className="hover:bg-stone-50/50 transition-colors">
                <td className="p-6">
                  <div className="flex items-center gap-4">
                    <img src={book.coverURL} className="w-12 h-16 object-cover rounded-lg shadow-sm" alt={book.title} referrerPolicy="no-referrer" />
                    <div>
                      <p className="font-bold text-stone-900">{book.title}</p>
                      <p className="text-xs text-stone-500 line-clamp-1 max-w-xs">{book.description}</p>
                    </div>
                  </div>
                </td>
                <td className="p-6">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold">
                    {book.category}
                  </span>
                </td>
                <td className="p-6 text-sm text-stone-600">{book.author}</td>
                <td className="p-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => openEditModal(book)}
                      className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(book.id)}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredBooks.length === 0 && (
              <tr>
                <td colSpan={4} className="p-20 text-center text-stone-400 italic">
                  No books found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                    <Upload size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{editingBook ? 'Edit Book' : 'Add New Book'}</h2>
                    <p className="text-stone-500 text-sm">Fill in the details below to update the library.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Book Title</label>
                    <input 
                      required
                      type="text" 
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors"
                      placeholder="e.g. Advanced Mathematics"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Author</label>
                    <input 
                      required
                      type="text" 
                      value={formData.author}
                      onChange={(e) => setFormData({...formData, author: e.target.value})}
                      className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors"
                      placeholder="e.g. Dr. Jane Smith"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Category</label>
                  <select 
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Description</label>
                  <textarea 
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors h-32"
                    placeholder="Provide a brief summary of the book..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Cover Image URL</label>
                    <input 
                      required
                      type="url" 
                      value={formData.coverURL}
                      onChange={(e) => setFormData({...formData, coverURL: e.target.value})}
                      className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors"
                      placeholder="https://example.com/cover.jpg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Download URL</label>
                    <input 
                      required
                      type="text" 
                      value={formData.downloadURL}
                      onChange={(e) => setFormData({...formData, downloadURL: e.target.value})}
                      className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-emerald-600 transition-colors"
                      placeholder="#"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 py-4 rounded-2xl font-bold text-stone-500 hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="bg-emerald-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100 flex items-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    {editingBook ? 'Update Book' : 'Add Book'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
