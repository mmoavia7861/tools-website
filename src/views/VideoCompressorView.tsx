import React, { useState, useRef, useEffect } from 'react';
import {
  Video,
  UploadCloud,
  Download,
  Play,
  Pause,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  Sparkles,
  RotateCcw,
  Film,
  HardDrive,
  Clock,
  Ratio
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { AdSlot } from '../components/AdSlot';
import { formatBytes } from '../utils/pdf';
import {
  calculateTargetDimensions,
  estimateCompressedSize,
  formatVideoDuration,
  getPresetConfig,
  type CompressionPreset
} from '../utils/videoCompressorUtils';

export const VideoCompressorView: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0
  });

  // Settings
  const [preset, setPreset] = useState<CompressionPreset>('balanced');
  const [resolution, setResolution] = useState<number>(1280); // max dimension
  const [targetBitrateKbps, setTargetBitrateKbps] = useState<number>(1500);
  const [targetFps, setTargetFps] = useState<number>(30);

  // Processing state
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressedUrl, setCompressedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cancelRequestedRef = useRef<boolean>(false);

  // When preset changes, apply default parameters
  const applyPreset = (newPreset: CompressionPreset) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      const config = getPresetConfig(newPreset, videoDuration || 30);
      setResolution(config.maxDimension);
      setTargetBitrateKbps(config.targetBitrateKbps);
      setTargetFps(config.frameRate);
    }
  };

  const handleFileSelect = (file: File) => {
    setErrorMessage(null);
    setCompressedBlob(null);
    if (compressedUrl) {
      URL.revokeObjectURL(compressedUrl);
      setCompressedUrl(null);
    }

    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|mov|mkv|avi)$/i)) {
      setErrorMessage('Please select a valid video file (MP4, WebM, MOV, or MKV).');
      return;
    }

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setVideoUrl(url);

    // Read metadata
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = url;
    tempVideo.onloadedmetadata = () => {
      setVideoDuration(tempVideo.duration);
      setVideoDimensions({
        width: tempVideo.videoWidth || 1280,
        height: tempVideo.videoHeight || 720
      });

      // Update preset bitrate based on real duration
      const config = getPresetConfig('balanced', tempVideo.duration);
      setTargetBitrateKbps(config.targetBitrateKbps);
    };
    tempVideo.onerror = () => {
      setErrorMessage('Could not load video metadata. Format may not be supported by this browser.');
    };
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Compression Pipeline
  const startCompression = async () => {
    if (!selectedFile || !videoUrl) return;

    setIsCompressing(true);
    setProgressPercent(0);
    setStatusText('Preparing hardware video encoder...');
    setErrorMessage(null);
    cancelRequestedRef.current = false;

    try {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = false; // need audio track
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video source for encoding'));
      });

      const { width: targetW, height: targetH } = calculateTargetDimensions(
        video.videoWidth,
        video.videoHeight,
        resolution
      );

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        throw new Error('Failed to create canvas rendering context');
      }

      // Check supported MIME types for MediaRecorder
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4';
      }

      // Setup audio mixing
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);

      // Canvas stream
      const canvasStream = canvas.captureStream(targetFps);
      // Combine video track + audio track
      const combinedTracks = [
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ];
      const combinedStream = new MediaStream(combinedTracks);

      const recordedChunks: Blob[] = [];
      const bitsPerSecond = targetBitrateKbps * 1000;

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: bitsPerSecond
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      const compressionPromise = new Promise<Blob>((resolve, reject) => {
        mediaRecorder.onstop = () => {
          const finalBlob = new Blob(recordedChunks, { type: mimeType });
          resolve(finalBlob);
        };
        mediaRecorder.onerror = (err) => reject(err);
      });

      mediaRecorder.start(100); // 100ms chunks

      // Play through video while drawing frames
      video.currentTime = 0;
      await video.play();

      const duration = video.duration || 1;
      let animFrameId: number;

      const renderLoop = () => {
        if (cancelRequestedRef.current) {
          video.pause();
          mediaRecorder.stop();
          audioCtx.close();
          return;
        }

        ctx.drawImage(video, 0, 0, targetW, targetH);

        const progress = Math.min(99, Math.round((video.currentTime / duration) * 100));
        setProgressPercent(progress);
        setStatusText(`Compressing stream: ${progress}% • Rescaling to ${targetW}×${targetH}`);

        if (!video.ended && !video.paused) {
          animFrameId = requestAnimationFrame(renderLoop);
        }
      };

      animFrameId = requestAnimationFrame(renderLoop);

      await new Promise<void>((resolve) => {
        video.onended = () => {
          cancelAnimationFrame(animFrameId);
          resolve();
        };
      });

      setStatusText('Finalizing video container and audio tracks...');
      setProgressPercent(100);

      mediaRecorder.stop();
      audioCtx.close();

      const resultBlob = await compressionPromise;
      const resultUrl = URL.createObjectURL(resultBlob);

      setCompressedBlob(resultBlob);
      setCompressedUrl(resultUrl);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Video compression encountered an unexpected issue.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleCancel = () => {
    cancelRequestedRef.current = true;
    setIsCompressing(false);
    setStatusText('');
    setProgressPercent(0);
  };

  const handleDownload = () => {
    if (!compressedBlob || !selectedFile) return;

    const ext = compressedBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const originalName = selectedFile.name.replace(/\.[^/.]+$/, '');
    const filename = `${originalName}-compressed.${ext}`;

    const a = document.createElement('a');
    a.href = compressedUrl || '';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (compressedUrl) URL.revokeObjectURL(compressedUrl);
    setSelectedFile(null);
    setVideoUrl(null);
    setCompressedBlob(null);
    setCompressedUrl(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const estimatedBytes = estimateCompressedSize(videoDuration, targetBitrateKbps);

  // Compute reduction metrics
  const originalSize = selectedFile?.size || 0;
  const newSize = compressedBlob?.size || 0;
  const sizeDiff = originalSize - newSize;
  const reductionPercent = originalSize > 0 && newSize > 0
    ? Math.max(0, Math.round(((originalSize - newSize) / originalSize) * 100))
    : 0;

  return (
    <>
      <SEOHead
        title="Free Video Compressor Online — Reduce Video Size Fast | RankNova"
        description="Compress MP4, WebM, and MOV videos online for free. Shrink video file sizes for Discord, WhatsApp, and email without uploading files to cloud servers. 100% on-device."
        canonicalPath="/compress-video"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'RankNova Video Compressor',
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
        }}
      />

      <div className="py-10 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80 mb-3">
              <Film className="h-3.5 w-3.5" />
              <span>Hardware-Accelerated Client Video Compression • 100% On-Device Privacy</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Free Video Compressor
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Reduce video size for Discord, WhatsApp, and email. Downscale resolution, tune bitrate,
              and compress MP4, WebM, or MOV files directly on your computer with zero server uploads.
            </p>
          </div>

          {!selectedFile ? (
            /* Upload Zone */
            <div className="max-w-3xl mx-auto">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:border-blue-500 hover:bg-blue-50/20 transition group bg-white shadow-xs"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-105 transition">
                  <Video className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">
                  Select or drag &amp; drop your video to compress
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Supports MP4, WebM, MOV, and MKV files. Processed entirely within your browser memory.
                </p>
              </div>

              {errorMessage && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          ) : (
            /* Compression Workspace */
            <div className="space-y-8">
              {/* Top Video Summary */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shrink-0">
                    <Film className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                      {selectedFile.name}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3 text-slate-400" />
                        {formatBytes(selectedFile.size)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {formatVideoDuration(videoDuration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Ratio className="h-3 w-3 text-slate-400" />
                        {videoDimensions.width}×{videoDimensions.height}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                >
                  Choose Different Video
                </button>
              </div>

              {/* Main Layout: Video Preview (Left) vs Settings & Compression (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left 7 Cols: Video Preview Player */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-md border border-slate-800">
                    <div className="p-3 bg-slate-950 flex items-center justify-between border-b border-slate-800 text-xs text-slate-300">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Video className="h-3.5 w-3.5 text-blue-400" />
                        <span>Source Video Preview</span>
                      </span>
                      <span className="font-mono text-slate-400">
                        {videoDimensions.width}×{videoDimensions.height} • {formatVideoDuration(videoDuration)}
                      </span>
                    </div>
                    {videoUrl && (
                      <video
                        src={videoUrl}
                        controls
                        className="w-full max-h-[420px] bg-black object-contain"
                      />
                    )}
                  </div>

                  {/* Compressed Output Preview (When available) */}
                  {compressedUrl && compressedBlob && (
                    <div className="bg-white rounded-2xl border-2 border-emerald-500/80 shadow-md p-5 space-y-4 animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                        <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          <span>Compression Complete!</span>
                        </div>
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full">
                          -{reductionPercent}% Smaller
                        </span>
                      </div>

                      {/* Comparison Stats */}
                      <div className="grid grid-cols-3 gap-3 bg-emerald-50/60 rounded-xl p-3 text-center border border-emerald-100">
                        <div>
                          <p className="text-[11px] text-slate-500 uppercase font-semibold">Original</p>
                          <p className="text-sm font-bold text-slate-800">{formatBytes(originalSize)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-500 uppercase font-semibold">Compressed</p>
                          <p className="text-sm font-bold text-emerald-700">{formatBytes(newSize)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-500 uppercase font-semibold">Storage Saved</p>
                          <p className="text-sm font-bold text-emerald-800">
                            {sizeDiff > 0 ? formatBytes(sizeDiff) : '0 Bytes'}
                          </p>
                        </div>
                      </div>

                      {/* Compressed Video Player */}
                      <video
                        src={compressedUrl}
                        controls
                        className="w-full rounded-xl max-h-[360px] bg-black object-contain shadow-xs"
                      />

                      {/* Download Button */}
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 px-6 font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 transition"
                      >
                        <Download className="h-5 w-5" />
                        <span>Download Compressed Video ({formatBytes(newSize)})</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Right 5 Cols: Presets & Encoding Controls */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Sliders className="h-4 w-4 text-blue-600" />
                      <span>Compression Target</span>
                    </h3>

                    {/* Presets Grid */}
                    <div className="grid grid-cols-1 gap-2.5">
                      {[
                        {
                          id: 'discord',
                          title: 'Discord & Email (< 25 MB)',
                          desc: 'Fits email and chat attachment limits'
                        },
                        {
                          id: 'whatsapp',
                          title: 'WhatsApp & Messenger (< 16 MB)',
                          desc: 'Rapid mobile sharing and streaming'
                        },
                        {
                          id: 'balanced',
                          title: 'Balanced 720p (~50% smaller)',
                          desc: 'Crisp picture quality with great savings'
                        },
                        {
                          id: 'extreme',
                          title: 'Maximum Archival (480p, ~75% smaller)',
                          desc: 'Smallest file size for archiving'
                        },
                        {
                          id: 'custom',
                          title: 'Custom Bitrate & Resolution',
                          desc: 'Manual control over resolution and kbps'
                        }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => applyPreset(item.id as CompressionPreset)}
                          className={`rounded-xl border p-3 text-left transition flex items-start justify-between ${
                            preset === item.id
                              ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-900">{item.title}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                          </div>
                          {preset === item.id && (
                            <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Detailed Fine-Tuning */}
                    <div className="pt-3 border-t border-slate-100 space-y-4">
                      {/* Resolution Selector */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Max Resolution Limit
                        </label>
                        <select
                          value={resolution}
                          onChange={(e) => {
                            setResolution(parseInt(e.target.value));
                            setPreset('custom');
                          }}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                        >
                          <option value={1920}>Original / 1080p Full HD (1920 max)</option>
                          <option value={1280}>720p HD Ready (1280 max - Recommended)</option>
                          <option value={854}>480p Standard Definition (854 max)</option>
                          <option value={640}>360p Compact Web (640 max)</option>
                        </select>
                      </div>

                      {/* Video Bitrate */}
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                          <span>Target Bitrate:</span>
                          <span className="font-mono text-blue-600">{targetBitrateKbps} kbps</span>
                        </div>
                        <input
                          type="range"
                          min={300}
                          max={6000}
                          step={100}
                          value={targetBitrateKbps}
                          onChange={(e) => {
                            setTargetBitrateKbps(parseInt(e.target.value));
                            setPreset('custom');
                          }}
                          className="w-full accent-blue-600"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                          <span>300 kbps (High Compression)</span>
                          <span>6000 kbps (Near Lossless)</span>
                        </div>
                      </div>

                      {/* Estimated Size Card */}
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Estimated Output Size:</span>
                        <span className="font-bold text-slate-900 font-mono">
                          ~{formatBytes(estimatedBytes)}
                        </span>
                      </div>
                    </div>

                    {/* Compression Action Button / Progress */}
                    {isCompressing ? (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-blue-700">{statusText}</span>
                          <span className="font-mono font-bold text-blue-900">{progressPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-150 ease-out"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="w-full py-2 rounded-xl border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 transition"
                        >
                          Cancel Compression
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={startCompression}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-6 font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
                      >
                        <Zap className="h-4 w-4" />
                        <span>Compress Video Now</span>
                      </button>
                    )}
                  </div>

                  {/* Privacy Badge */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900 flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Pure Client-Side Video Processing</p>
                      <p className="mt-0.5 text-emerald-800">
                        Video stream decoding, canvas scaling, and audio tracks are re-encoded locally using your computer&apos;s GPU and CPU. No video is ever uploaded to any cloud server.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reserved Ad */}
          <div className="mt-12">
            <AdSlot slotId="video-compressor-bottom" format="horizontal" />
          </div>

          {/* Educational Guide */}
          <div className="mt-16 bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-12 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                How to Compress Video Files Without Losing Quality
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Video files from phones and screen recorders often have excessive bitrates that exceed message limits.
                RankNova uses hardware-accelerated MediaRecorder encoding to reduce storage while keeping text and movement sharp.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Target File Limits</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Easily fit large videos under Discord&apos;s 25 MB limit or WhatsApp&apos;s 16 MB limit with dedicated one-click presets.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Resolution Downscaling</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Downscale 4K or 1080p clips to 720p HD with proportional aspect ratio preservation, cutting file sizes by up to 60%.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Zero Data Uploads</h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Your confidential family clips, video recordings, and presentations never touch an external server or CDN.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
