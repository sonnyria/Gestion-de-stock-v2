import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { readBarcodeFromImage, readBarcodeFromMediaElement } from '../services/barcodeService.ts';

interface ScannerProps {
  onScan: (barcode: string) => void;
  onCancel: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onCancel }) => {
  const webcamRef = useRef<Webcam>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const attemptsRef = useRef(0);
  const [detectionFails, setDetectionFails] = useState(0);
  
  // Torch / Flashlight state
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [barcodeDetectorAvailable, setBarcodeDetectorAvailable] = useState<boolean>(false);
  const [zxingAvailable, setZxingAvailable] = useState<boolean | null>(null);
  const zxingReaderRef = useRef<any | null>(null);
  const zxingDecodingRef = useRef<boolean>(false);

  // Camera selection state
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  // Initialize from localStorage
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(() => {
      return localStorage.getItem('scanner_device_id') || undefined;
  });

  // Load available devices
  const handleDevices = useCallback(async () => {
    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = mediaDevices.filter(({ kind }) => kind === "videoinput");
      setDevices(videoDevices);
    } catch (e) {
      console.error("Error enumerating devices:", e);
    }
  }, []);

  useEffect(() => {
    handleDevices();
    setBarcodeDetectorAvailable('BarcodeDetector' in window);
    // Try to test ZXing CDN presence asynchronously (do not fail on error)
    (async () => {
      try {
        let ZXing: any = null;
        try {
          ZXing = await import('@zxing/browser');
        } catch (localImportErr) {
          // fallback to CDN if local import fails (possible if library not installed)
          console.debug('Scanner: @zxing/browser local import failed, trying CDN', localImportErr);
          ZXing = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.18.6/dist/index.min.js');
        }
        const BrowserMultiFormatReader = ZXing?.BrowserMultiFormatReader || ZXing?.default?.BrowserMultiFormatReader;
        setZxingAvailable(!!BrowserMultiFormatReader);
      } catch (err) {
        console.warn('Scanner: ZXing import failed on mount', err);
        setZxingAvailable(false);
      }
    })();
  }, [handleDevices]);

  // Start continuous ZXing decode if available
  const startContinuousZxing = useCallback(async () => {
    // Only start ZXing continuous decode if the HTML5 BarcodeDetector API is not available
    if (barcodeDetectorAvailable) return;
    if (!zxingAvailable || zxingDecodingRef.current) return;
    const videoEl = webcamRef.current?.video as HTMLVideoElement | undefined;
    if (!videoEl) return;
    try {
      let ZXing: any = null;
      try { ZXing = await import('@zxing/browser'); } catch (local) { ZXing = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.18.6/dist/index.min.js'); }
      const BrowserMultiFormatReader = ZXing?.BrowserMultiFormatReader || ZXing?.default?.BrowserMultiFormatReader;
      if (!BrowserMultiFormatReader) return;
      const reader = new BrowserMultiFormatReader();
      zxingReaderRef.current = reader;
      zxingDecodingRef.current = true;
      console.debug('Scanner: starting continuous ZXing decode');
      // decodeFromVideoDevice can be given a deviceId and a video element
      reader.decodeFromVideoDevice(selectedDeviceId || null, videoEl, async (result, err) => {
        setAttempts(a => {
          const newA = a + 1;
          attemptsRef.current = newA;
          return newA;
        });
        if (result) {
          console.info('Scanner: ZXing continuous detection result', result?.getText ? result.getText() : result?.text || result);
          // Stop the continuous decode loop and call onScan
          try { reader.reset(); } catch (e) { console.warn('Scanner: reader.reset failed', e); }
          zxingDecodingRef.current = false;
          setScanning(true);
          stopContinuousZxing();
          onScanWrap(result.getText ? result.getText() : (result as any).text);
        } else if (err) {
          // Not always true error; ignore unless persistent
          // console.debug('Scanner: ZXing decode callback error', err);
        }
      });

      // Fallback monitor: if after some number of attempts no result, try canvas decode
      let fallbackIntervalId: number | null = null;
      const fallbackIntervalRef = { id: null as number | null };
      fallbackIntervalRef.id = window.setInterval(async () => {
        if (!zxingDecodingRef.current) {
          if (fallbackIntervalRef.id) { clearInterval(fallbackIntervalRef.id); fallbackIntervalRef.id = null; }
          return;
        }
        // If attempts exceed threshold and no lastResult, try explicit canvas decode using the same reader
        const currentAttempts = attemptsRef.current;
        if (currentAttempts > 0 && currentAttempts % 6 === 0) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = videoEl.videoWidth || 640;
            canvas.height = videoEl.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
              try {
                const canvasResult = await reader.decodeFromCanvas(canvas);
                if (canvasResult?.getText) {
                  console.info('Scanner: ZXing canvas fallback found', canvasResult.getText());
                  try { reader.reset(); } catch (err) { console.warn('Scanner: reader.reset failed', err); }
                  zxingDecodingRef.current = false;
                  setScanning(true);
                  stopContinuousZxing();
                  setLastResult(canvasResult.getText());
                  onScanWrap(canvasResult.getText());
                }
              } catch (err2) {
                // ignore; will retry next interval
                console.debug('Scanner: ZXing canvas fallback decode failed', err2);
              }
            }
          } catch (e) {
            console.warn('Scanner: fallback interval error', e);
          }
        }
      }, 1500);
      } catch (e) {
      console.warn('Scanner: startContinuousZxing error', e);
      zxingDecodingRef.current = false;
    }
    finally {
      // Ensure interval cleared if any on exit
      if (fallbackIntervalRef.id) { clearInterval(fallbackIntervalRef.id); fallbackIntervalRef.id = null; }
    }
  }, [zxingAvailable, selectedDeviceId, onScan]);

  const stopContinuousZxing = useCallback(() => {
    try {
      if (zxingReaderRef.current) {
        zxingReaderRef.current.reset();
        zxingReaderRef.current = null;
      }
    } catch (err) { console.warn('Scanner: stopContinuousZxing error', err); }
    zxingDecodingRef.current = false;
  }, []);
  // Ensure we also clear any fallback interval that might be running
  const stopContinuousZxingAndClear = useCallback(() => {
    try { stopContinuousZxing(); } catch (e) {}
    // fallbackIntervalRef handled inside startContinuousZxing's finally
    zxingDecodingRef.current = false;
  }, [stopContinuousZxing]);

  // Make sure we call stopContinuousZxing on unmount and on cancel
  useEffect(() => {
    return () => {
      stopContinuousZxing();
    };
  }, [stopContinuousZxing]);

  useEffect(() => {
    // Auto-start continuous decode when ZXing is available and video element present
    if (zxingAvailable && !zxingDecodingRef.current) {
      startContinuousZxing();
    }
    return () => stopContinuousZxing();
  }, [zxingAvailable, startContinuousZxing, stopContinuousZxing]);

  const exportDiagnostics = async () => {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      barcodeDetectorAvailable,
      zxingAvailable,
      selectedDeviceId,
      attempts,
      lastResult,
      detectionFails,
      videoConstraints,
    };
    try {
      const json = JSON.stringify(diagnostics, null, 2);
      // Try to copy to clipboard first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(json);
      }
      // Also trigger a download
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scanner_diagnostics_${new Date().toISOString().slice(0,19)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Failed to export diagnostics', e);
    }
  };

  // Handle camera selection change
  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    if (deviceId) {
      setSelectedDeviceId(deviceId);
      localStorage.setItem('scanner_device_id', deviceId);
    } else {
      setSelectedDeviceId(undefined);
      localStorage.removeItem('scanner_device_id');
    }
    // Reset torch state when changing camera
    setTorchOn(false);
    setTorchSupported(false);
  };

  // Check for torch support when camera loads
  const handleUserMedia = (stream: MediaStream) => {
      handleDevices(); // Update device list names
      
      const track = stream.getVideoTracks()[0];
      if (track) {
          // Use 'any' cast because 'torch' is not yet standard in all TS definitions
          const capabilities = track.getCapabilities() as any;
          if (capabilities.torch) {
              setTorchSupported(true);
          } else {
              setTorchSupported(false);
          }
      }
  };

  // Handle camera errors (e.g. saved device not found)
  const handleUserMediaError = useCallback(() => {
      if (selectedDeviceId) {
          console.warn("Selected camera failed, falling back to default.");
          setSelectedDeviceId(undefined);
          localStorage.removeItem('scanner_device_id');
          setError(null); // Retry immediately
      } else {
          setError("Impossible d'accéder à la caméra.");
      }
  }, [selectedDeviceId]);

  const toggleTorch = async () => {
      if (!webcamRef.current || !torchSupported) return;
      
      const stream = webcamRef.current.video?.srcObject as MediaStream;
      const track = stream?.getVideoTracks()[0];
      
      if (track) {
          try {
              await track.applyConstraints({
                  advanced: [{ torch: !torchOn } as any]
              });
              setTorchOn(!torchOn);
          } catch (err) {
              console.error("Failed to toggle torch", err);
          }
      }
  };

  const videoConstraints = {
    // Lower resolution on iOS for better performance and reliable canvas capture
    width: { min: 640, ideal: 1280 },
    height: { min: 480, ideal: 720 },
    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
    facingMode: selectedDeviceId ? undefined : "environment"
  };

  // wrap parent-provided onCancel and onScan to ensure stopContinuousZxing is called
  const onCancelWrap = useCallback(() => {
    try { stopContinuousZxing(); } catch (e) { }
    onCancel();
  }, [onCancel, stopContinuousZxing]);

  const onScanWrap = useCallback((barcode: string) => {
    try { stopContinuousZxing(); } catch (e) { }
    onScan(barcode);
  }, [onScan, stopContinuousZxing]);

  // Automatic Scanning Logic
  const captureAndScan = useCallback(async () => {
    if (!webcamRef.current || scanning) return;

    const imageSrc = webcamRef.current.getScreenshot({width: 1920, height: 1080});
    if (!imageSrc) return;

    // Start a scan cycle
    setScanning(true);
    console.debug('Scanner: captureAndScan start');
    // Don't clear error here to avoid flickering if there is a persistent hardware error
    
    try {
      setAttempts(a => a + 1);
    // Prefer detection directly from the live video element (more reliable on iOS), else fallback to the screenshot
    const videoEl = webcamRef.current?.video as HTMLVideoElement | undefined;
    let barcode: string | null = null;
    if (videoEl) {
      try {
        console.debug('Scanner: trying readBarcodeFromMediaElement (live video)');
        barcode = await readBarcodeFromMediaElement(videoEl);
        console.debug('Scanner: readBarcodeFromMediaElement returned', barcode);
      } catch (e) {
        console.warn('Scanner: readBarcodeFromMediaElement error', e);
      }
    }
    if (!barcode && imageSrc) {
      console.debug('Scanner: trying readBarcodeFromImage (screenshot)');
      barcode = await readBarcodeFromImage(imageSrc);
      console.debug('Scanner: readBarcodeFromImage returned', barcode);
    }
    console.debug('Scanner: readBarcodeFromImage returned', barcode);
      
      if (barcode) {
        console.info('Scanner: barcode detected:', barcode);
        // Persist last result for on-screen debug
        setLastResult(barcode);
        setDetectionFails(0);
        // Stop ZXing continuous decode if running
        try { stopContinuousZxing(); } catch (e) { }
        // Keep scanning 'true' to avoid immediate further detection cycles while parent handles the result
        setScanning(true);
        // Call the callback so the parent can handle the scan (e.g., open product details)
        onScanWrap(barcode);
        return; // Do not reset scanning here — parent should update view or unmount Scanner
      }
      setLastResult(null);
      setDetectionFails(prev => prev + 1);
      // If not found, we just finish this cycle silently and let the interval trigger again.
    } catch (e) {
      console.error("Scan cycle error", e);
    } finally {
      // Reset scanning state only when no barcode was found (we returned earlier on detection)
      // This avoids immediately triggering another scan cycle if the parent hasn't unmounted the component yet.
      console.debug('Scanner: captureAndScan no barcode; resetting scanning flag');
      setScanning(false);
    }
  }, [webcamRef, scanning, onScan]);

  // Trigger scan loop
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!scanning && !error) {
        captureAndScan();
      }
    }, 1500); // Scan every 1.5 seconds to balance responsiveness and API rate limits

    return () => clearInterval(intervalId);
  }, [scanning, error, captureAndScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1 overflow-hidden bg-black">
        
        {/* Top Controls - Added pt-safe and mt-safe for notch handling */}
        <div className="absolute top-0 left-0 right-0 z-30 flex justify-between items-start px-4 pt-safe mt-4">
            {/* Camera Selector */}
            <div className="flex-1 flex justify-center mr-10"> {/* mr-10 reserves space for the torch button */}
                <select
                className="bg-black/60 text-white border border-gray-500 rounded-full px-4 py-2 text-sm backdrop-blur-sm max-w-full outline-none focus:border-blue-500 appearance-none truncate shadow-lg"
                value={selectedDeviceId || ""}
                onChange={handleCameraChange}
                >
                <option value="">Caméra automatique</option>
                {devices.map((device, key) => (
                    <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Caméra ${key + 1}`}
                    </option>
                ))}
                </select>
            </div>

            {/* Torch Button (Only if supported) */}
            {torchSupported && (
                <button 
                    onClick={toggleTorch}
                    className={`absolute right-4 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm border transition-all shadow-lg ${
                        torchOn 
                        ? 'bg-yellow-500/80 border-yellow-400 text-white shadow-[0_0_15px_rgba(234,179,8,0.6)]' 
                        : 'bg-black/60 border-gray-500 text-gray-300'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={torchOn ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </button>
            )}
        </div>

        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          screenshotQuality={1}
          forceScreenshotSourceSize={true}
          videoProps={{ playsInline: true, muted: true }}
          videoConstraints={videoConstraints}
          onUserMedia={handleUserMedia} 
          onUserMediaError={handleUserMediaError}
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Scanner Overlay */}
        <div className="absolute inset-0 border-[40px] border-black/50 flex items-center justify-center pointer-events-none">
          <div className={`w-72 h-48 border-2 rounded-lg relative shadow-[0_0_50px_rgba(59,130,246,0.5)] transition-colors duration-300 ${scanning ? 'border-blue-500 bg-blue-500/10' : 'border-white/50'}`}>
             
             {/* Corner Markers */}
             <div className={`absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 -mt-1 -ml-1 ${scanning ? 'border-blue-400' : 'border-white'}`}></div>
             <div className={`absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 -mt-1 -mr-1 ${scanning ? 'border-blue-400' : 'border-white'}`}></div>
             <div className={`absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 -mb-1 -ml-1 ${scanning ? 'border-blue-400' : 'border-white'}`}></div>
             <div className={`absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 -mb-1 -mr-1 ${scanning ? 'border-blue-400' : 'border-white'}`}></div>
             
             {/* Scanning Line Animation */}
             <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-400 shadow-[0_0_10px_#60a5fa] animate-[scan_2s_ease-in-out_infinite]"></div>

             <div className="absolute inset-x-0 -bottom-10 text-center">
                <p className="text-white text-sm font-bold bg-black/60 px-3 py-1 rounded-full inline-block shadow-lg backdrop-blur-md">
                  {scanning ? 'Analyse en cours...' : 'Recherche automatique...'}
                </p>
             </div>
          </div>
        </div>

        {/* Simple debug overlay: attempts and last read value */}
        <div className="absolute top-24 right-4 z-40 text-xs text-gray-300 bg-black/60 px-3 py-2 rounded-lg border border-gray-700">
          <div className="text-gray-400">Tentatives : <span className="text-white font-mono">{attempts}</span></div>
          <div className="text-gray-400">Dernier : <span className="text-white font-mono">{lastResult || '—'}</span></div>
          <div className="text-gray-400 mt-1">Détecteur HTML5 : <span className="text-white font-mono">{barcodeDetectorAvailable ? 'Oui' : 'Non'}</span></div>
          <div className="text-gray-400">ZXing CDN : <span className="text-white font-mono">{zxingAvailable === null ? '...' : zxingAvailable ? 'OK' : 'NOK'}</span></div>
          <button onClick={exportDiagnostics} className="mt-2 w-full text-xs uppercase tracking-wide bg-gray-700/30 hover:bg-gray-700/50 text-white rounded p-1">Exporter diagnostics</button>
        </div>
        
        {/* Error Message (Only for hardware errors now) */}
        {error && (
          <div className="absolute top-24 left-4 right-4 bg-red-600/90 text-white p-4 rounded-xl text-center shadow-xl z-20 border border-red-400 animate-fade-in">
            <p className="font-bold text-lg">⚠️ {error}</p>
          </div>
        )}
        {detectionFails > 6 && (
          <div className="absolute top-40 left-4 right-4 bg-yellow-800/90 text-white p-3 rounded-xl text-center shadow-xl z-20 border border-yellow-600 animate-fade-in">
            <p className="font-bold">⚠️ Aucun code détecté</p>
            <p className="text-sm mt-1">Essayez d'éclairer la zone, rapprocher le produit, ou entrer le code manuellement.</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-24 bg-gray-900 flex items-center justify-center px-8 pb-safe border-t border-gray-800 relative">
        <button 
          onClick={onCancelWrap}
          className="absolute left-8 text-gray-400 hover:text-white font-medium py-3 px-6 rounded-full border border-gray-600 hover:bg-gray-800 transition"
        >
          Annuler
        </button>
        
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 text-blue-400 font-mono text-xs uppercase tracking-widest animate-pulse">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Auto-Scan Actif
            </div>
        </div>

        <div className="absolute right-8 w-24 text-right text-xs text-gray-500">
          <span className="block text-blue-400 font-bold text-lg">Lecteur</span>
          Détection HTML5
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
            0%, 100% { top: 0%; opacity: 0; }
            10% { opacity: 1; }
            50% { top: 100%; }
            90% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Scanner;