import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sparkles, Users, Video, ShieldCheck, ArrowRight, Star, BookOpen } from 'lucide-react';

export default function Home() {
  return (
    <div className="space-y-24 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12">
        <div className="flex flex-col md:flex-row items-center gap-12">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-semibold border border-emerald-100">
              <Sparkles size={16} />
              AI-Powered Learning
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]">
              Master Any Subject with <span className="text-emerald-600">EduNexus</span>
            </h1>
            <p className="text-xl text-stone-500 max-w-xl leading-relaxed">
              Connect with world-class tutors, experience immersive virtual classrooms, and accelerate your learning with personalized AI assistance.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link 
                to="/auth?mode=signup&role=student" 
                className="bg-emerald-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg hover:shadow-emerald-200 flex items-center gap-2 group"
              >
                Find a Tutor
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                to="/auth?mode=signup&role=teacher" 
                className="bg-white text-stone-900 border-2 border-stone-200 px-8 py-4 rounded-full font-bold text-lg hover:border-emerald-600 transition-all"
              >
                Become a Tutor
              </Link>
            </div>
            <div className="flex items-center gap-4 pt-4">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <img 
                    key={i}
                    src={`https://picsum.photos/seed/user${i}/100/100`}
                    className="w-10 h-10 rounded-full border-2 border-white"
                    referrerPolicy="no-referrer"
                    alt="User"
                  />
                ))}
              </div>
              <div className="text-sm text-stone-500">
                <span className="font-bold text-stone-900">10,000+</span> students already learning
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 relative"
          >
            <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl border-8 border-white">
              <img 
                src="https://picsum.photos/seed/learning/1200/800"
                className="w-full h-auto"
                referrerPolicy="no-referrer"
                alt="Learning Platform"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <Video size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Live Math Class</p>
                    <p className="text-xs text-stone-500">Dr. Sarah Johnson</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-bold">
                  <Star size={16} fill="currentColor" />
                  4.9
                </div>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-emerald-100 rounded-full blur-3xl opacity-50" />
            <div className="absolute -bottom-6 -left-6 w-48 h-48 bg-emerald-200 rounded-full blur-3xl opacity-50" />
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            icon: <Users className="text-emerald-600" size={32} />,
            title: "Expert Tutors",
            description: "Learn from certified professionals and industry experts across 500+ subjects."
          },
          {
            icon: <Video className="text-emerald-600" size={32} />,
            title: "Virtual Classroom",
            description: "Interactive tools including digital whiteboards, screen sharing, and real-time chat."
          },
          {
            icon: <Sparkles className="text-emerald-600" size={32} />,
            title: "AI Assistant",
            description: "24/7 AI-powered study buddy to help with homework, summaries, and practice quizzes."
          }
        ].map((feature, idx) => (
          <motion.div 
            key={idx}
            whileHover={{ y: -5 }}
            className="p-8 bg-white rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-all"
          >
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">
              {feature.icon}
            </div>
            <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
            <p className="text-stone-500 leading-relaxed">{feature.description}</p>
          </motion.div>
        ))}
      </section>

      {/* Social Proof */}
      <section className="bg-emerald-900 rounded-[3rem] p-12 md:p-20 text-white relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
            Join the future of global education today.
          </h2>
          <p className="text-emerald-100 text-lg mb-12 leading-relaxed">
            Whether you're a student looking to excel or a teacher wanting to reach a global audience, EduNexus provides the tools you need to succeed.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link 
              to="/auth?mode=signup&role=student" 
              className="bg-white text-emerald-900 px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-50 transition-all"
            >
              Get Started for Free
            </Link>
            <Link 
              to="/auth?mode=signup&role=school_admin" 
              className="bg-emerald-800 text-white border border-emerald-700 px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-700 transition-all"
            >
              Register Your School
            </Link>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
          <BookOpen size={400} className="translate-x-1/4 -translate-y-1/4" />
        </div>
      </section>
    </div>
  );
}
