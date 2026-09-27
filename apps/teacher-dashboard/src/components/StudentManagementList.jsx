import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export function StudentManagementList({ students, refreshData }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStudents = students.filter(st =>
    st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    st.studentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Student Roster</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="Search student by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)', color: '#fff', fontSize: '13px', width: '280px' }}
          />
          <Link to="/teacher/students/add" style={{ padding: '8px 16px', borderRadius: '8px', background: '#3b82f6', color: '#fff', textDecoration: 'none', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            + Enroll Student
          </Link>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
            <th style={{ padding: '16px 12px' }}>ID</th>
            <th style={{ padding: '16px 12px' }}>Name</th>
            <th style={{ padding: '16px 12px' }}>Class/Sec</th>
            <th style={{ padding: '16px 12px' }}>Status</th>
            <th style={{ padding: '16px 12px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredStudents.length > 0 ? filteredStudents.map(st => (
            <tr key={st.studentId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
              <td style={{ padding: '16px 12px', fontWeight: 600, color: '#60a5fa' }}>{st.studentId}</td>
              <td style={{ padding: '16px 12px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {st.photoUrl ? (
                  <img src={st.photoUrl} alt={st.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800 }}>
                    {st.name.charAt(0)}
                  </div>
                )}
                {st.name}
              </td>
              <td style={{ padding: '16px 12px', color: '#cbd5e1' }}>{st.className || 'N/A'} - {st.section || 'N/A'}</td>
              <td style={{ padding: '16px 12px' }}>
                <span style={{ background: st.isActive !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: st.isActive !== false ? '#34d399' : '#f87171', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                  {st.isActive !== false ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td style={{ padding: '16px 12px' }}>
                <Link to={`/teacher/students/${st.studentId}`} style={{ color: '#c084fc', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
                  View Profile ➔
                </Link>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                No students found matching your criteria.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
