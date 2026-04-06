import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { FiUpload } from "react-icons/fi";
import axios from "axios";
import AudioPlayer from "./AudioPlayer";
import { IoImageOutline, IoPlay, IoPause, IoVolumeHigh, IoVolumeMute, IoTrashOutline } from "react-icons/io5";

const UploadNode = ({ id, data, formValues, setFormValues, selectedModel, loading, uploadType, acceptType }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageMetadata, setImageMetadata] = useState({ width: 0, height: 0, size: null });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);
  const prevFormValues = useRef(formValues);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileUpload(e);
  };

  const handleFileUpload = (e) => {
    let file = null;

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      file = e.dataTransfer.files[0];
    } else if (e.target.files && e.target.files.length > 0) {
      file = e.target.files[0];
    } else {
      return;
    }

    let acceptedTypes = [];

    if (acceptType === "image") {
      acceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    } else if (acceptType === "video") {
      acceptedTypes = ["video/mp4", "video/webm"];
    } else if (acceptType === "audio") {
      acceptedTypes = ["audio/mpeg", "audio/wav", "audio/webm"];
    }

    const type = file.type.startsWith("video") ? "video_url" : file.type.startsWith("image") ? "image_url": "audio_url";
    
    if (!acceptedTypes.includes(file.type)) {
      toast.error(`Please upload a valid ${acceptType} file`);
      return;
    };

    setUploading(true);
    axios.get("/api/app/get_file_upload_url", {
      params: { filename: file.name }
    })
    .then((response) => {
      const { url, fields } = response.data;

      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append("file", file);
      axios.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      })
      .then(() => {
        const prefix = "https://cdn.muapi.ai/";
        const uploadedUrl = prefix + fields.key;
        setFormValues(prev => ({ ...prev, [type]: uploadedUrl }));

        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
        }, 500);
      })
    })
    .catch((error) => {
      console.error("Upload failed", error);
      toast.error("Upload failed.", error?.response?.data);
      setUploading(false);
      setUploadProgress(0);
    })  
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  }; 

  const handleTextChange = (e) => {
    const textValue = e.target.value;
    setFormValues(prev => ({ ...prev, prompt: textValue }));
  };

  const handleWorkflowInputChange = (e) => {
    const workflowInputValue = e.target.checked;
    setFormValues(prev => ({ ...prev, is_workflow_input: workflowInputValue }));
  };

  const removeData = () => {
    const key = acceptType === "image" ? "image_url": acceptType === "video" ? "video_url": "audio_url";
    setFormValues(prev => ({ ...prev, [key]: null }))
  };

  useEffect(() => {
    let outputs = [{
      type: "",
      value: null
    }];
    let resultUrl;

    if (acceptType === "image") {
      outputs = [{ 
        type: "image_url", 
        value: formValues.image_url ? formValues.image_url: null,
      }];
      resultUrl = formValues.image_url ? formValues.image_url: null;
    } else if (acceptType === "video") {
      outputs = [{ 
        type: "video_url", 
        value: formValues.video_url ? formValues.video_url: null,
      }];
      resultUrl = formValues.video_url ? formValues.video_url: null;
    } else if (acceptType === "audio") {
      outputs = [{ 
        type: "audio_url", 
        value: formValues.audio_url ? formValues.audio_url: null,
      }];
      resultUrl = formValues.audio_url ? formValues.audio_url: null;
    } else {
      outputs = [{ 
        type: "text", 
        value: formValues.prompt ? formValues.prompt: "",
      }];
      resultUrl = formValues.prompt ? formValues.prompt: "";
    };

    if (acceptType === "image" && resultUrl) {
      const img = new Image();
      img.onload = () => {
        setImageMetadata(prev => ({ 
          ...prev, 
          width: img.naturalWidth, 
          height: img.naturalHeight 
        }));
      };
      img.src = resultUrl;
      
      fetch(resultUrl, { method: 'HEAD' })
        .then(res => {
          const size = res.headers.get('content-length');
          if (size) {
            const sizeInMB = (parseInt(size) / (1024 * 1024)).toFixed(2);
            setImageMetadata(prev => ({ ...prev, size: sizeInMB + ' MB' }));
          } else {
            setImageMetadata(prev => ({ ...prev, size: null }));
          }
        })
        .catch(() => {
          setImageMetadata(prev => ({ ...prev, size: null }));
        });
    } else if (acceptType === "image") {
      setImageMetadata({ width: 0, height: 0, size: null });
    }
    
    // if (!data.formValues) return;
    const incoming = JSON.stringify(prevFormValues.current);
    const current = JSON.stringify(formValues);
    if (incoming === current) return;
    prevFormValues.current = formValues;

    if (data?.onDataChange) {
      data?.onDataChange(id, {
        selectedModel,
        formValues,
        loading,
        outputs: outputs,
        resultUrl: resultUrl,
      });
    }
  }, [formValues, selectedModel, loading, id, data, acceptType]);

  const hasFileUrl = formValues?.image_url || formValues?.video_url || formValues?.audio_url;
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "0px";
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.max(scrollHeight, 220)}px`;
    }
  }, [formValues?.prompt]);

  return (
    <div className="flex flex-col w-full flex-1 overflow-hidden rounded-b-2xl h-full">
      <div className="flex flex-col items-center justify-center w-full h-full flex-1">
        {uploadType === "text" ? (
          <textarea
            ref={textareaRef}
            className="bg-transparent border border-gray-800 w-full h-full max-h-96 p-2 text-xs text-white resize-none overflow-y-auto custom-scrollbar"
            placeholder="Enter your text prompt here..."
            value={formValues?.prompt || ""}
            onChange={handleTextChange}
          />
        ) : uploadType === "upload" && (
          <div 
            style={{ minHeight: 220 }} 
            className="flex flex-col items-center justify-center w-full h-full bg-[#151618] relative" 
            onDragOver={handleDragOver} onDrop={handleDrop}
          >
            {uploading ? (
              <div className="flex flex-col justify-center gap-2 w-full h-full max-w-[95%]">
                <h4 className="text-xs text-white">Uploading... {uploadProgress}%</h4>
                <div className="w-full bg-gray-100 rounded h-1 overflow-hidden">
                  <div className="bg-blue-500 h-full" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            ) : hasFileUrl ? (
              <div className="flex w-full h-full group z-0">
                {formValues?.video_url ? (
                  <div className="relative w-full h-full group/video">
                    <video
                      ref={videoRef}
                      src={formValues?.video_url}
                      autoPlay
                      muted={isMuted}
                      loop
                      playsInline
                      onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                      onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (videoRef.current.paused) {
                          videoRef.current.play();
                        } else {
                          videoRef.current.pause();
                        }
                      }}
                      className="w-full h-full object-contain cursor-pointer"
                    />
                    
                    {/* Center Play Icon */}
                    {!isPlaying && (
                      <div 
                        className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover/video:opacity-100 transition-opacity duration-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          videoRef.current.play();
                          setIsPlaying(true);
                        }}
                      >
                        <div className="w-14 h-14 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 shadow-2xl transform group-hover/video:scale-110 transition-transform pointer-events-auto cursor-pointer">
                          <IoPlay size={28} className="ml-1" />
                        </div>
                      </div>
                    )}

                    {/* Custom Controls */}
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover/video:opacity-100 transition-opacity duration-300 rounded-b-xl flex flex-col gap-2">
                      <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={(e) => {
                          const time = parseFloat(e.target.value);
                          videoRef.current.currentTime = time;
                          setCurrentTime(time);
                        }}
                        className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer hover:h-1.5 transition-all seek-bar"
                        style={{
                          background: `linear-gradient(to right, #f97316 0%, #f97316 ${(currentTime / duration) * 100}%, rgba(255, 255, 255, 0.2) ${(currentTime / duration) * 100}%, rgba(255, 255, 255, 0.2) 100%)`
                        }}
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            suppressHydrationWarning={true}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (videoRef.current.paused) {
                                videoRef.current.play();
                                setIsPlaying(true);
                              } else {
                                videoRef.current.pause();
                                setIsPlaying(false);
                              }
                            }}
                            className="text-white/90 hover:text-white transition-colors"
                          >
                            {videoRef.current?.paused === false ? <IoPause size={16} /> : <IoPlay size={16} />}
                          </button>
                          <div className="flex items-center gap-2 group/volume">
                            <button
                              type="button"
                              suppressHydrationWarning={true}
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsMuted(!isMuted);
                              }}
                              className="text-white/90 hover:text-white transition-colors"
                            >
                              {isMuted ? <IoVolumeMute size={16} /> : <IoVolumeHigh size={16} />}
                            </button>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={isMuted ? 0 : volume}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                setVolume(val);
                                videoRef.current.volume = val;
                                if (val > 0) setIsMuted(false);
                              }}
                              className="w-0 group-hover/volume:w-16 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white transition-all overflow-hidden"
                            />
                          </div>
                          <span className="text-[10px] text-white/70 font-medium tabular-nums">
                            {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')} / {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : formValues?.image_url ? (
                  <div className="relative w-full h-full group/image">
                    <img
                      src={formValues?.image_url}
                      alt="Uploaded"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 pointer-events-none flex flex-col justify-end">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-white/50 uppercase tracking-tighter font-semibold">Dimensions</span>
                          <span className="text-xs text-white font-medium tabular-nums">
                            {imageMetadata.width} × {imageMetadata.height}
                          </span>
                        </div>
                        {imageMetadata.size && (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[10px] text-white/50 uppercase tracking-tighter font-semibold">File Size</span>
                            <span className="text-xs text-white font-medium tabular-nums">{imageMetadata.size}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-40 relative">
                    <AudioPlayer src={formValues?.audio_url} />
                  </div>
                )}
                <button
                  type="button"
                  suppressHydrationWarning={true}
                  className="text-white hover:text-red-500 bg-black/40 hover:bg-black cursor-pointer absolute left-4 top-4 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-all duration-300"
                  onClick={removeData}
                >
                  &#10005;
                </button>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center justify-center gap-2 text-gray-400 border border-dashed border-gray-600 rounded-lg p-4 w-full flex-1 hover:bg-gray-700/50 h-full">
                <FiUpload size={20} />
                <span className="text-xs capitalize">Upload {acceptType}</span>
                <span className="text-xs text-gray-500">Hint: drag and drop file(s) here.</span>
                <input
                  type="file"
                  accept={acceptType === "image" ? "image/*": acceptType === "video" ? "video/*": "audio/*"}
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadNode;
