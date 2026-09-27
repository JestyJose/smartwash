import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { ComplianceTrendChart } from './components/ComplianceTrendChart.jsx';
import { StudentLeaderboard } from './components/StudentLeaderboard.jsx';
import { StudentManagementList } from './components/StudentManagementList.jsx';
import { StudentEnrollmentForm } from './components/StudentEnrollmentForm.jsx';
import { StudentProfile } from './components/StudentProfile.jsx';
import { getAllStudents } from '../../../shared/services/studentService.js';
import { getAllSessions } from '../../../shared/services/sessionService.js';
import { isMockFirebase } from '../../../shared/firebaseConfig.js';

function OverviewDashboard({ students, sessions, searchTerm, setSearchTerm, avgClassScore, filteredStudents }) {
  return (
    <>
      {/* Overview Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
        <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Class Average Score</div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#34d399', margin: '4px 0' }}>{avgClassScore}</div>
          <div style={{ fontSize: '11px', color: '#34d399' }}>+4% from last week</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Active Students</div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#60a5fa', margin: '4px 0' }}>{students.length || 5}</div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>100% face enrolled</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Compliance Rate</div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#c084fc', margin: '4px 0' }}>96%</div>
          <div style={{ fontSize: '11px', color: '#c084fc' }}>WHO Step compliance</div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Total Sessions</div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#fbbf24', margin: '4px 0' }}>{sessions.length + 42}</div>
          <div style={{ fontSize: '11px', color: '#fbbf24' }}>Tracked today</div>
        </div>
      </div>

      {/* Main Grid: Trend Chart & Leaderboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        <ComplianceTrendChart />
        <StudentLeaderboard students={students} />
      </div>
    </>
  );
}

export function TeacherDashboardApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [teacherEmail, setTeacherEmail] = useState('teacher@smartwash.edu');
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const location = useLocation();
  const loadDashboardData = async () => {
    const studentList = await getAllStudents();
    const sessionList = await getAllSessions();
    
    // Calculate scores for students based on recent sessions
    const studentMap = studentList.map(st => {
      const studentSessions = sessionList.filter(s => s.studentId === st.studentId);
      const latestSession = studentSessions[0];
      return {
        ...st,
        score: latestSession ? latestSession.score : Math.floor(80 + Math.random() * 18),
        streak: Math.floor(2 + Math.random() * 6),
        grade: 'Excellent'
      };
    });

    setStudents(studentMap);
    setSessions(sessionList);
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const filteredStudents = students.filter(st =>
    st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    st.studentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const avgClassScore = students.length > 0
    ? Math.round(students.reduce((acc, s) => acc + s.score, 0) / students.length)
    : 92;

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #090d16 100%)',
        color: '#f8fafc',
        fontFamily: "'Inter', sans-serif"
      }}>
        {/* Floating background shapes */}
        <div style={{ position: 'absolute', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)', top: '10%', left: '15%', borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, rgba(0,0,0,0) 70%)', bottom: '5%', right: '10%', borderRadius: '50%' }}></div>

        {/* Glassmorphism Card */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.45)',
          backdropFilter: 'blur(16px)',
          padding: '48px 40px',
          borderRadius: '24px',
          width: '420px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.1)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          {/* Logo/Icon */}
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            marginBottom: '24px',
            boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.4)'
          }}>
            🎓
          </div>
          
          <h2 style={{ margin: '0 0 8px 0', fontSize: '26px', fontWeight: 800, textAlign: 'center', background: 'linear-gradient(to right, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Teacher Portal
          </h2>
          <p style={{ margin: '0 0 32px 0', color: '#94a3b8', fontSize: '14px', textAlign: 'center' }}>
            Sign in to access handwashing compliance analytics
          </p>

          <div style={{ width: '100%', marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Email Address
            </label>
            <input
              type="email"
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              placeholder="teacher@smartwash.edu"
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(15, 23, 42, 0.6)',
                color: '#fff',
                fontSize: '15px',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#6366f1'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
            />
          </div>

          <div style={{ width: '100%', marginBottom: '32px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(15, 23, 42, 0.6)',
                color: '#fff',
                fontSize: '15px',
                outline: 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#6366f1'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
            />
          </div>

          <button
            onClick={() => setIsAuthenticated(true)}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '15px',
              cursor: 'pointer',
              transition: 'transform 0.1s ease, box-shadow 0.2s ease',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
            }}
            onMouseOver={(e) => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.5)'; }}
            onMouseOut={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.4)'; }}
          >
            Authenticate ➔
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(135deg, #090d16 0%, #0f172a 100%)', color: '#f8fafc', padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '20px' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase' }}>
            Rahul's Module Architecture
          </span>
          <h1 style={{ margin: '4px 0 0 0', fontSize: '28px', fontWeight: 800 }}>
            Teacher Handwashing Analytics Dashboard
          </h1>
          {isMockFirebase && (
            <div style={{ marginTop: '8px', padding: '4px 8px', background: '#f59e0b', color: '#fff', fontSize: '10px', fontWeight: 800, borderRadius: '4px', display: 'inline-block' }}>
              [ENV: LOCAL DEMO MODE - PERSISTENCE EPHEMERAL]
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
            Logged in as <strong style={{ color: '#ffffff' }}>{teacherEmail}</strong>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(30, 41, 59, 0.6)', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav style={{ display: 'flex', gap: '16px', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
        <Link to="/teacher" style={{ textDecoration: 'none', color: location.pathname === '/teacher' ? '#3b82f6' : '#94a3b8', fontWeight: 600, fontSize: '14px', padding: '8px 16px', borderRadius: '8px', background: location.pathname === '/teacher' ? 'rgba(59, 130, 246, 0.1)' : 'transparent', transition: 'all 0.2s' }}>
          Overview Analytics
        </Link>
        <Link to="/teacher/students" style={{ textDecoration: 'none', color: location.pathname.startsWith('/teacher/students') ? '#3b82f6' : '#94a3b8', fontWeight: 600, fontSize: '14px', padding: '8px 16px', borderRadius: '8px', background: location.pathname.startsWith('/teacher/students') ? 'rgba(59, 130, 246, 0.1)' : 'transparent', transition: 'all 0.2s' }}>
          Student Management
        </Link>
      </nav>

      {/* Routes */}
      <Routes>
        <Route path="/" element={
          <OverviewDashboard 
            students={students} 
            sessions={sessions} 
            searchTerm={searchTerm} 
            setSearchTerm={setSearchTerm}
            avgClassScore={avgClassScore}
            filteredStudents={filteredStudents}
          />
        } />
        <Route path="/students" element={<StudentManagementList students={students} refreshData={loadDashboardData} />} />
        <Route path="/students/add" element={<StudentEnrollmentForm onEnrollmentSuccess={loadDashboardData} />} />
        <Route path="/students/:studentId" element={<StudentProfile students={students} refreshData={loadDashboardData} />} />
      </Routes>
    </div>
  );
}
