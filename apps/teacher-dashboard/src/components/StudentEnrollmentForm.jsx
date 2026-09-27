import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as faceapi from '@vladmandic/face-api';
import { enrollStudent } from '../../../../shared/services/studentService.js';

export function StudentEnrollmentForm({ onEnrollmentSuccess }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [formData, setFormData] = useState({
    studentId: '',
    name: '',
    className: '',
    section: '',
    rollNumber: ''
  });

  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [stream, setStream] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [extractedDescriptor, setExtractedDescriptor] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setIsModelLoaded(true);
      } catch (err) {
        console.error('Failed to load face models:', err);
        setError('Failed to load face recognition models.');
      }
    };
    loadModels();
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCapturedPhoto(null);
      setExtractedDescriptor(null);
      setError(null);
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

  useEffect(() => {
    return () => stopCamera();
  }, [stream]);

  const captureAndExtract = async () => {
    if (!videoRef.current || !isModelLoaded) return;
    setIsProcessing(true);
    setError(null);

    try {
      const video = videoRef.current;
      const detections = await faceapi
        .detectAllFaces(video)
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        throw new Error("No face detected. Please look clearly at the camera.");
      }
      if (detections.length > 1) {
        throw new Error("Multiple faces detected! Please ensure only the student is in frame.");
      }

      // We have exactly one face
      const descriptor = Array.from(detections[0].descriptor);
      setExtractedDescriptor(descriptor);

      // Capture photo to canvas
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photoBase64 = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(photoBase64);
      
      stopCamera();

    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.studentId || !formData.name) {
      setError("Student ID and Name are required.");
      return;
    }
    if (!extractedDescriptor || !capturedPhoto) {
      setError("You must capture a valid face photo first.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      await enrollStudent({
        ...formData,
        descriptor: extractedDescriptor,
        photoBase64: capturedPhoto
      });
      setSuccess(true);
      if (onEnrollmentSuccess) {
        onEnrollmentSuccess();
      }
      setTimeout(() => navigate('/teacher/students'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px', padding: '32px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>Enroll New Student</h2>
        <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>Register a student profile and capture their biometric face descriptor for kiosk authentication.</p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: '12px 16px', borderRadius: '8px', color: '#fca5a5', marginBottom: '24px', fontSize: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '12px 16px', borderRadius: '8px', color: '#6ee7b7', marginBottom: '24px', fontSize: '14px' }}>
          ✅ Student enrolled successfully! Redirecting...
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {/* Left Column: Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>STUDENT ID *</label>
            <input type="text" value={formData.studentId} onChange={e => setFormData({...formData, studentId: e.target.value})} placeholder="e.g. STU_205" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.6)', color: '#fff', fontSize: '14px' }} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>FULL NAME *</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. John Doe" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.6)', color: '#fff', fontSize: '14px' }} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>CLASS</label>
              <input type="text" value={formData.className} onChange={e => setFormData({...formData, className: e.target.value})} placeholder="e.g. S5" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.6)', color: '#fff', fontSize: '14px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>SECTION</label>
              <input type="text" value={formData.section} onChange={e => setFormData({...formData, section: e.target.value})} placeholder="e.g. CSE" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.6)', color: '#fff', fontSize: '14px' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>ROLL NUMBER</label>
            <input type="text" value={formData.rollNumber} onChange={e => setFormData({...formData, rollNumber: e.target.value})} placeholder="e.g. 12" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.6)', color: '#fff', fontSize: '14px' }} />
          </div>
        </div>

        {/* Right Column: Camera & Capture */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>BIOMETRIC PHOTO CAPTURE *</label>
          
          <div style={{ background: '#000', borderRadius: '12px', overflow: 'hidden', position: 'relative', width: '100%', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!stream && !capturedPhoto && (
              <button type="button" onClick={startCamera} style={{ padding: '12px 24px', borderRadius: '8px', background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                📷 Start Camera
              </button>
            )}
            
            <video ref={videoRef} autoPlay playsInline muted style={{ display: stream && !capturedPhoto ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'cover' }} />
            
            {capturedPhoto && (
              <img src={capturedPhoto} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          {stream && !capturedPhoto && (
            <button type="button" onClick={captureAndExtract} disabled={isProcessing || !isModelLoaded} style={{ padding: '14px', borderRadius: '8px', background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
              {isProcessing ? 'Analyzing Face...' : '📸 Capture & Extract Descriptor'}
            </button>
          )}

          {capturedPhoto && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1, padding: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '8px', color: '#34d399', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✓ Face Descriptor Generated
              </div>
              <button type="button" onClick={startCamera} style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Retake
              </button>
            </div>
          )}
        </div>

        {/* Full width save button */}
        <div style={{ gridColumn: '1 / -1', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px' }}>
          <button type="submit" disabled={isProcessing || success} style={{ padding: '16px 32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '15px', width: '100%' }}>
            Save & Enroll Student
          </button>
        </div>
      </form>
    </div>
  );
}
