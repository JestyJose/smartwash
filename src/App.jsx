import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StudentKioskApp } from '../apps/student-app/src/StudentApp.jsx';
import { TeacherDashboardApp } from '../apps/teacher-dashboard/src/TeacherDashboardApp.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[SMART WASH ErrorBoundary caught error]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          textAlign: 'center',
          color: '#f8fafc'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0', color: '#f87171' }}>
            Kiosk Vision Recovered
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '440px', marginBottom: '16px' }}>
            The AI engine encountered a temporary video frame glitch. Click below to restart your session smoothly.
          </p>
          {this.state.error && (
            <div style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', fontSize: '12px', marginBottom: '20px', fontFamily: 'monospace' }}>
              {this.state.error.message || String(this.state.error)}
            </div>
          )}
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              padding: '12px 28px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Restart Kiosk ➔
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0b0f19 0%, #111827 50%, #0f172a 100%)', color: '#f3f4f6' }}>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/student" element={<StudentKioskApp useMock={false} />} />
            <Route path="/teacher/*" element={<TeacherDashboardApp />} />
            <Route path="*" element={<Navigate to="/student" replace />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </div>
  );
}
