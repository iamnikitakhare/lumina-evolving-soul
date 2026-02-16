
import React, { useRef, useState, useEffect } from 'react';

interface CameraFeedProps {
  onCapture: (base64: string) => void;
  isProcessing: boolean;
}

const CameraFeed: React.FC<CameraFeedProps> = ({ onCapture, isProcessing }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsActive(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsActive(false);
    }
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        const base64 = dataUrl.split(',')[1];
        onCapture(base64);
      }
    }
  };

  return (
    <div className="glass rounded-3xl overflow-hidden border border-slate-700/50 shadow-2xl group flex flex-col h-full">
      <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/30">
        <h3 className="font-semibold text-slate-300 flex items-center gap-2">
          <i className="fas fa-eye text-cyan-400"></i> Visual Perception
        </h3>
        <button 
          onClick={isActive ? stopCamera : startCamera}
          className={`text-xs font-bold uppercase tracking-tighter px-3 py-1 rounded-full border transition-all ${
            isActive 
              ? 'border-red-500 text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white' 
              : 'border-cyan-500 text-cyan-500 bg-cyan-500/10 hover:bg-cyan-500 hover:text-white'
          }`}
        >
          {isActive ? 'Off' : 'On'}
        </button>
      </div>

      <div className="flex-1 relative bg-black/40 min-h-[200px]">
        {isActive ? (
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" 
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-4">
            <i className="fas fa-camera-slash text-4xl"></i>
            <p className="text-sm">Camera inactive</p>
          </div>
        )}
        
        {isActive && (
          <button 
            onClick={captureFrame}
            disabled={isProcessing}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white text-slate-900 w-12 h-12 rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
          >
            {isProcessing ? (
               <i className="fas fa-circle-notch animate-spin"></i>
            ) : (
              <i className="fas fa-shutter-speed text-xl"></i>
            )}
          </button>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default CameraFeed;
