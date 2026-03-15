import React from 'react';
import { Link } from 'react-router-dom';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Users, BookOpen, Plus, Search, Trash2, ChevronRight, Layout, Activity, UserPlus, X, CheckCircle, ArrowRight, BarChart3, GraduationCap, ClipboardCheck } from 'lucide-react';

interface Classroom {
  id: string;
  name: string;
  subject: string;
  teacherId: string;
  teacherName?: string;
  studentCount: number;
}

interface Student {
  uid: string;
  name: string;
  email: string;
  username: string;
}

interface StudentProgress {
  studentId: string;
  studentName: string;
  studentEmail: string;
  completedCount: number;
  totalCount: number;
  averageGrade: string;
}

interface Teacher {
  uid: string;
  name: string;
  email: string;
}

export default function SchoolDashboard() {
  const [user] = useAuthState(auth);
  const [classrooms, setClassrooms] = React.useState<Classroom[]>([]);
  const [students, setStudents] = React.useState<Student[]>([]);
  const [teachers, setTeachers] = React.useState<Teacher[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isCreatingClass, setIsCreatingClass] = React.useState(false);
  const [isEnrollingStudent, setIsEnrollingStudent] = React.useState<string | null>(null);
  const [newClass, setNewClass] = React.useState({ name: '', subject: '', teacherId: '', description: '' });
  const [searchQuery, setSearchQuery] = React.useState('');
  const [viewingProgress, setViewingProgress] = React.useState<string | null>(null);
  const [classroomProgress, setClassroomProgress] = React.useState<StudentProgress[]>([]);
  const [loadingProgress, setLoadingProgress] = React.useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch classrooms
      const classroomsSnap = await getDocs(query(collection(db, 'classrooms'), where('schoolId', '==', user.uid)));
      const classroomsData: Classroom[] = [];
      
      for (const cDoc of classroomsSnap.docs) {
        const c = cDoc.data();
        const teacherDoc = await getDoc(doc(db, 'users', c.teacherId));
        const enrollmentsSnap = await getDocs(query(collection(db, 'enrollments'), where('classroomId', '==', cDoc.id)));
        
        classroomsData.push({
          id: cDoc.id,
          name: c.name,
          subject: c.subject,
          teacherId: c.teacherId,
          teacherName: teacherDoc.exists() ? teacherDoc.data().name : 'Unknown',
          studentCount: enrollmentsSnap.size
        });
      }
      setClassrooms(classroomsData);

      // Fetch all students (simplified for MVP - in real app would filter by school)
      const studentsSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      setStudents(studentsSnap.docs.map(d => ({ uid: d.id, ...d.data() } as Student)));

      // Fetch all teachers
      const teachersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'teacher')));
      setTeachers(teachersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as Teacher)));

    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'school_dashboard');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [user]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'classrooms'), {
        ...newClass,
        schoolId: user.uid,
        createdAt: serverTimestamp()
      });
      setIsCreatingClass(false);
      setNewClass({ name: '', subject: '', teacherId: '', description: '' });
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'classrooms');
    }
  };

  const handleEnrollStudent = async (studentId: string) => {
    if (!isEnrollingStudent || !user) return;
    try {
      // Check if already enrolled
      const existing = await getDocs(query(
        collection(db, 'enrollments'), 
        where('classroomId', '==', isEnrollingStudent),
        where('studentId', '==', studentId)
      ));
      
      if (!existing.empty) {
        alert('Student already enrolled in this class.');
        return;
      }

      await addDoc(collection(db, 'enrollments'), {
        classroomId: isEnrollingStudent,
        studentId,
        schoolId: user.uid,
        enrolledAt: serverTimestamp()
      });
      
      fetchData();
      alert('Student enrolled successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'enrollments');
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this classroom?')) return;
    try {
      await deleteDoc(doc(db, 'classrooms', id));
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `classrooms/${id}`);
    }
  };

  const fetchClassroomProgress = async (classroomId: string) => {
    setLoadingProgress(true);
    setViewingProgress(classroomId);
    try {
      // Get all activities for this classroom
      const activitiesSnap = await getDocs(query(collection(db, 'activities'), where('classroomId', '==', classroomId)));
      const totalActivities = activitiesSnap.size;

      // Get all enrollments for this classroom
      const enrollmentsSnap = await getDocs(query(collection(db, 'enrollments'), where('classroomId', '==', classroomId)));
      
      const progressData: StudentProgress[] = [];

      for (const eDoc of enrollmentsSnap.docs) {
        const enrollment = eDoc.data();
        const studentDoc = await getDoc(doc(db, 'users', enrollment.studentId));
        const studentData = studentDoc.data();

        // Get assignments (submissions) for this student in this classroom
        const assignmentsSnap = await getDocs(query(
          collection(db, 'assignments'), 
          where('classId', '==', classroomId),
          where('studentId', '==', enrollment.studentId)
        ));

        let totalGradePoints = 0;
        let gradedCount = 0;

        assignmentsSnap.docs.forEach(aDoc => {
          const a = aDoc.data();
          if (a.grade) {
            const numericGrade = parseFloat(a.grade);
            if (!isNaN(numericGrade)) {
              totalGradePoints += numericGrade;
              gradedCount++;
            }
          }
        });

        const avgGrade = gradedCount > 0 ? (totalGradePoints / gradedCount).toFixed(1) : 'N/A';

        progressData.push({
          studentId: enrollment.studentId,
          studentName: studentData?.name || 'Unknown',
          studentEmail: studentData?.email || 'Unknown',
          completedCount: assignmentsSnap.size,
          totalCount: totalActivities,
          averageGrade: avgGrade
        });
      }

      setClassroomProgress(progressData);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'classroom_progress');
    } finally {
      setLoadingProgress(false);
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
    <div className="space-y-10 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">School Administration</h1>
          <p className="text-stone-500">Manage your digital classrooms, teachers, and student enrollments.</p>
        </div>
        <button 
          onClick={() => setIsCreatingClass(true)}
          className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
        >
          <Plus size={20} />
          Create Classroom
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Classrooms List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Layout className="text-emerald-600" size={24} />
              Active Classrooms
            </h2>
            <span className="text-sm text-stone-400 font-bold uppercase tracking-wider">{classrooms.length} Total</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {classrooms.map((c) => (
              <motion.div 
                key={c.id}
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm space-y-6 group"
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <BookOpen size={24} />
                  </div>
                  <button 
                    onClick={() => handleDeleteClass(c.id)}
                    className="text-stone-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                
                <div>
                  <h3 className="text-xl font-bold text-stone-900 group-hover:text-emerald-600 transition-colors">{c.name}</h3>
                  <p className="text-sm text-stone-500 font-medium">{c.subject}</p>
                </div>

                  <div className="flex items-center justify-between pt-4 border-t border-stone-50">
                    <Link 
                      to={`/digital-classroom/${c.id}`}
                      className="text-emerald-600 text-sm font-bold hover:underline flex items-center gap-1"
                    >
                      View Activities <ArrowRight size={16} />
                    </Link>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => fetchClassroomProgress(c.id)}
                        className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-1"
                      >
                        Progress <BarChart3 size={16} />
                      </button>
                      <button 
                        onClick={() => setIsEnrollingStudent(c.id)}
                        className="text-stone-600 text-sm font-bold hover:underline flex items-center gap-1"
                      >
                        Enroll <UserPlus size={16} />
                      </button>
                    </div>
                  </div>
                
                <div className="text-xs text-stone-400 flex items-center gap-2">
                  <span className="font-bold uppercase tracking-wider">Teacher:</span>
                  <span className="text-stone-600 font-medium">{c.teacherName}</span>
                </div>
              </motion.div>
            ))}
            {classrooms.length === 0 && (
              <div className="col-span-full bg-stone-50 p-12 rounded-[2rem] border-2 border-dashed border-stone-200 text-center space-y-4">
                <p className="text-stone-500">No classrooms created yet. Start by creating your first digital classroom.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats & Tools */}
        <div className="space-y-8">
          <div className="bg-stone-900 text-white p-8 rounded-[2.5rem] shadow-xl">
            <h3 className="text-xl font-bold mb-6">School Overview</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-emerald-400">
                    <Users size={20} />
                  </div>
                  <span className="text-stone-400 font-medium">Total Students</span>
                </div>
                <span className="text-2xl font-bold">{students.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-blue-400">
                    <Activity size={20} />
                  </div>
                  <span className="text-stone-400 font-medium">Total Teachers</span>
                </div>
                <span className="text-2xl font-bold">{teachers.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm space-y-6">
            <h3 className="text-xl font-bold">Recent Activity</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                  <CheckCircle size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold">New Enrollment</p>
                  <p className="text-xs text-stone-400">Sarah joined Math 101</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                  <Plus size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold">Class Created</p>
                  <p className="text-xs text-stone-400">Physics Advanced</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Class Modal */}
      <AnimatePresence>
        {isCreatingClass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreatingClass(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 space-y-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Create New Classroom</h2>
                <button onClick={() => setIsCreatingClass(false)} className="text-stone-400 hover:text-stone-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateClass} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Classroom Name</label>
                  <input 
                    type="text" 
                    required
                    value={newClass.name}
                    onChange={(e) => setNewClass({...newClass, name: e.target.value})}
                    className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    placeholder="e.g. Advanced Mathematics"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Subject</label>
                  <input 
                    type="text" 
                    required
                    value={newClass.subject}
                    onChange={(e) => setNewClass({...newClass, subject: e.target.value})}
                    className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    placeholder="e.g. Calculus"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Assign Teacher</label>
                  <select 
                    required
                    value={newClass.teacherId}
                    onChange={(e) => setNewClass({...newClass, teacherId: e.target.value})}
                    className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                  >
                    <option value="">Select a teacher</option>
                    {teachers.map(t => (
                      <option key={t.uid} value={t.uid}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Description</label>
                  <textarea 
                    value={newClass.description}
                    onChange={(e) => setNewClass({...newClass, description: e.target.value})}
                    className="w-full p-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all h-24 resize-none"
                    placeholder="Briefly describe the classroom goals..."
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Create Classroom
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Enroll Student Modal */}
      <AnimatePresence>
        {isEnrollingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEnrollingStudent(null)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl p-8 space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Enroll Students</h2>
                  <p className="text-stone-500 text-sm">Select students to add to {classrooms.find(c => c.id === isEnrollingStudent)?.name}</p>
                </div>
                <button onClick={() => setIsEnrollingStudent(null)} className="text-stone-400 hover:text-stone-600">
                  <X size={24} />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Search students by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                />
              </div>

              <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
                {students
                  .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.email.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(s => (
                    <div key={s.uid} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl hover:bg-stone-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-stone-400 font-bold">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-stone-900">{s.name}</p>
                          <p className="text-xs text-stone-500">{s.email}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleEnrollStudent(s.uid)}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
                      >
                        Enroll
                      </button>
                    </div>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Progress Modal */}
      <AnimatePresence>
        {viewingProgress && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingProgress(null)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl p-8 space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <GraduationCap className="text-emerald-600" size={28} />
                    Student Progress
                  </h2>
                  <p className="text-stone-500 text-sm">
                    Tracking performance for {classrooms.find(c => c.id === viewingProgress)?.name}
                  </p>
                </div>
                <button onClick={() => setViewingProgress(null)} className="text-stone-400 hover:text-stone-600">
                  <X size={24} />
                </button>
              </div>

              {loadingProgress ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
                  <p className="text-stone-500 font-medium">Calculating progress data...</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-stone-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50">
                        <th className="p-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Student</th>
                        <th className="p-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Completion</th>
                        <th className="p-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Avg. Grade</th>
                        <th className="p-4 text-xs font-bold text-stone-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {classroomProgress.map((p) => (
                        <tr key={p.studentId} className="hover:bg-stone-50/50 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-stone-900">{p.studentName}</div>
                            <div className="text-xs text-stone-400">{p.studentEmail}</div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden max-w-[100px]">
                                <div 
                                  className="h-full bg-emerald-500" 
                                  style={{ width: `${(p.completedCount / (p.totalCount || 1)) * 100}%` }}
                                />
                              </div>
                              <span className="text-sm font-bold text-stone-600">
                                {p.completedCount}/{p.totalCount}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                              p.averageGrade === 'N/A' ? 'bg-stone-100 text-stone-400' : 'bg-emerald-50 text-emerald-600'
                            }`}>
                              {p.averageGrade}
                            </span>
                          </td>
                          <td className="p-4">
                            {p.completedCount === p.totalCount && p.totalCount > 0 ? (
                              <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                                <CheckCircle size={14} />
                                Complete
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-amber-600 text-xs font-bold">
                                <ClipboardCheck size={14} />
                                In Progress
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {classroomProgress.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-stone-500 italic">
                            No students enrolled in this classroom yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
