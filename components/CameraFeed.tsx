
import React, { useRef, useState, useCallback } from 'react';

interface CameraFeedProps {
  onCapture: (base64: string) => void;
  isProcessing: boolean;
}

const CameraFeed: React.FC<CameraFeedProps> = ({ onCapture, isProcessing }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = async () => {
    setError(null);
    try {
      // Constraints optimized for quality and typical webcams
      const constraints = { 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        } 
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video metadata to load to ensure it's ready for display/capture
        videoRef.current.onloadedmetadata = () => {
          setIsActive(true);
        };
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("Camera access was denied. Please check your browser's site settings and grant permission to this page.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError("No camera device was found on this system. Please connect a webcam.");
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError("Your camera is already in use by another application or tab.");
      } else {
        setError("An unexpected error occurred while accessing the camera feed.");
      }
      setIsActive(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsActive(false);
      setError(null);
    }
  }, []);

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current && isActive) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Set canvas to video's actual resolution
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Horizontal flip for "mirror" effect to match video feed UI
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Reset transformation matrix
        context.setTransform(1, 0, 0, 1, 0, 0);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.split(',')[1];
        onCapture(base64);
      }
    }
  };

  return (
    <section 
      className="glass rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl group flex flex-col h-full transition-all duration-500"
      aria-labelledby="camera-heading"
    >
      <header className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
        <h3 id="camera-heading" className="font-bold text-slate-300 flex items-center gap-3 text-xs tracking-widest uppercase">
          <i className="fas fa-eye text-cyan-400"></i> Visual Perception
        </h3>
        <button 
          onClick={isActive ? stopCamera : startCamera}
          className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border transition-all ${
            isActive 
              ? 'border-red-500/50 text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white' 
              : 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500 hover:text-white'
          }`}
          aria-pressed={isActive}
        >
          {isActive ? 'Disconnect' : 'Connect'}
        </button>
      </header>

      <div className="flex-1 relative bg-slate-950 overflow-hidden min-h-[250px]">
        {isActive ? (
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000 transform -scale-x-100" 
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center gap-4">
            {error ? (
              <>
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500 mb-2">
                  <i className="fas fa-exclamation-triangle text-2xl"></i>
                </div>
                <p className="text-red-400 text-xs font-semibold max-w-[240px] leading-relaxed">
                  {error}
                </p>
                <button 
                  onClick={startCamera}
                  className="mt-2 text-[10px] font-bold text-white bg-red-500/20 hover:bg-red-500/40 border border-red-500/50 px-5 py-2 rounded-xl transition-all"
                >
                  Retry Connection
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-cyan-500/5 flex items-center justify-center border border-white/5 text-slate-600 mb-2">
                  <i className="fas fa-video-slash text-2xl"></i>
                </div>
                <p className="text-slate-500 text-xs font-medium">Camera offline. Connect to enable real-time visual perception.</p>
              </>
            )}
          </div>
        )}
        
        {isActive && (
          <button 
            onClick={captureFrame}
            disabled={isProcessing}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white text-slate-900 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all disabled:opacity-30 z-20"
            aria-label="Capture Visual Input"
          >
            {isProcessing ? (
               <i className="fas fa-sync animate-spin text-lg"></i>
            ) : (
              <i className="fas fa-camera text-xl"></i>
            )}
          </button>
        )}
        
        {isActive && (
          <div className="absolute top-4 right-4 text-[8px] font-bold text-white/40 uppercase tracking-widest bg-black/20 px-2 py-0.5 rounded backdrop-blur-sm">
            Mirror Mode Active
          </div>
        )}
        
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </section>
  );
};

export default CameraFeed;
