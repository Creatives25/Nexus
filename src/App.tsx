import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './firebase';
import Layout from './components/Layout';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Marketplace from './pages/Marketplace';
import Dashboard from './pages/Dashboard';
import TutorProfile from './pages/TutorProfile';
import Classroom from './pages/Classroom';
import DigitalClassroom from './pages/DigitalClassroom';
import Library from './pages/Library';
import AdminLibrary from './pages/AdminLibrary';
import Forums from './pages/Forums';
import VirtualClassroom from './pages/VirtualClassroom';

export default function App() {
  const [user, loading] = useAuthState(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <Auth />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/library" element={<Library />} />
          <Route path="/forums" element={user ? <Forums /> : <Navigate to="/auth" />} />
          <Route path="/admin/library" element={user ? <AdminLibrary /> : <Navigate to="/auth" />} />
          <Route path="/tutor/:id" element={<TutorProfile />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/auth" />} />
          <Route path="/classroom/:id" element={user ? <Classroom /> : <Navigate to="/auth" />} />
          <Route path="/digital-classroom/:id" element={user ? <DigitalClassroom /> : <Navigate to="/auth" />} />
          <Route path="/virtual-classroom/:id" element={user ? <VirtualClassroom /> : <Navigate to="/auth" />} />
        </Routes>
      </Layout>
    </Router>
  );
}
