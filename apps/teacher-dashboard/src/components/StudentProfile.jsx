import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as faceapi from '@vladmandic/face-api';
import { updateStudent } from '../../../../shared/services/studentService.js';
import { getStudentSessions } from '../../../../shared/services/sessionService.js';

export function StudentProfile({ students, refreshData }) {
  const { studentId } = useParams();
  const student = students.find(s => s.studentId === studentId);
  
  const [sessions, setSessions] = useState([]);
  const [isReEnrolling, setIsReEnrolling] = useState(false);
  const [stream, setStream] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [extractedDescriptor, setExtractedDescriptor] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (student) {
      getStudentSessions(studentId).then(setSessions);
    }
  }, [student, studentId]);

  if (!student) {
    return <div style={{ color: '#f8fafc' }}>Student not found.</div>;
  }

  const startCamera = async () => {
    setIsReEnrolling(true);
    setCapturedPhoto(null);
    setExtractedDescriptor(null);
    setError(null);
    setSuccess(false);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError('Camera access denied or unavailable.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureAndExtract = async () => {
    if (!videoRef.current) return;
    setIsProcessing(true);
    setError(null);

    try {
      const video = videoRef.current;
      const detections = await faceapi
        .detectAllFaces(video)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) throw new Error("No face detected.");
      if (detections.length > 1) throw new Error("Multiple faces detected.");

      const descriptor = Array.from(detections[0].descriptor);
      setExtractedDescriptor(descriptor);

      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.8));
      
      stopCamera();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveReEnrollment = async () => {
    if (!extractedDescriptor || !capturedPhoto) return;
    setIsProcessing(true);
    try {
      await updateStudent(studentId, {
        descriptor: extractedDescriptor,
        photoBase64: capturedPhoto
      });
      setSuccess(true);
      setIsReEnrolling(false);
      if (refreshData) refreshData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const avgScore = sessions.length > 0 ? Math.round(sessions.reduce((acc, s) => acc + s.score, 0) / sessions.length) : 'N/A';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
      
      {/* Left Column: Profile Card */}
      <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px' }}>
          {student.photoUrl ? (
             <img src={student.photoUrl} alt={student.name} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', marginBottom: '16px', border: '4px solid rgba(255,255,255,0.1)' }} />
          ) : (
            <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', fontWeight: 800, marginBottom: '16px' }}>
              {student.name.charAt(0)}
            </div>
          )}
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>{student.name}</h2>
          <p style={{ margin: '4px 0 0 0', color: '#60a5fa', fontWeight: 600 }}>{student.studentId}</p>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <span style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' }}>{student.className}</span>
            <span style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px' }}>{student.section}</span>
          </div>
        </div>

        {/* Re-enrollment Section */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#94a3b8' }}>BIOMETRIC DATA</h3>
          
          {!isReEnrolling ? (
            <button onClick={startCamera} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer' }}>
              🔄 Re-enroll Face Descriptor
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: '#000', borderRadius: '8px', overflow: 'hidden', position: 'relative', width: '100%', aspectRatio: '4/3' }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ display: stream && !capturedPhoto ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'cover' }} />
                {capturedPhoto && <img src={capturedPhoto} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>
              
              {error && <div style={{ color: '#f87171', fontSize: '12px' }}>{error}</div>}
              
              {stream && !capturedPhoto && (
                <button onClick={captureAndExtract} disabled={isProcessing} style={{ padding: '8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  {isProcessing ? 'Analyzing...' : 'Capture'}
                </button>
              )}
              
              {capturedPhoto && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={saveReEnrollment} disabled={isProcessing} style={{ flex: 1, padding: '8px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    Save
                  </button>
                  <button onClick={startCamera} disabled={isProcessing} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    Retake
                  </button>
                </div>
              )}
            </div>
          )}
          {success && <div style={{ color: '#34d399', fontSize: '12px', marginTop: '8px' }}>Face updated successfully!</div>}
        </div>
      </div>

      {/* Right Column: Stats & Sessions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Average Score</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>{avgScore}</div>
          </div>
          <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Sessions</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#60a5fa', marginTop: '4px' }}>{sessions.length}</div>
          </div>
          <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Current Streak</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>{student.streak || 0}</div>
          </div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.08)', flex: 1 }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Session History</h3>
          {sessions.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Date</th>
                  <th style={{ padding: '12px' }}>Score</th>
                  <th style={{ padding: '12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px', color: '#cbd5e1' }}>{new Date(s.timestamp?.seconds ? s.timestamp.seconds * 1000 : s.timestamp).toLocaleDateString()}</td>
                    <td style={{ padding: '12px', fontWeight: 700, color: s.score >= 80 ? '#34d399' : '#fbbf24' }}>{s.score}</td>
                    <td style={{ padding: '12px' }}>{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '14px' }}>No sessions recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
