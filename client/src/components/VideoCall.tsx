import React, { useEffect, useState, useRef } from 'react';
import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser, ILocalAudioTrack, ILocalVideoTrack } from 'agora-rtc-sdk-ng';
import { useLocation } from 'react-router-dom';

const APP_ID = '117a38a9cddd4c7fb7b0ccf57f914da3';
const DEFAULT_CHANNEL = 'test-channel';
const DEFAULT_TOKEN = '007eJxTYFBvYO01Sp2wT81uzslQBVfngpc7xLat235ff9NWJY4znFwKDIaG5onGFomWySkpKSbJ5mlJ5kkGyclppuZploYmKYnGmR8/pDcEMjJ0eOxmZGSAQBCfh6EktbhENzkjMS8vNYeBAQDq7CId';

const VideoCall: React.FC = () => {
  const [localTracks, setLocalTracks] = useState<(ILocalAudioTrack | ILocalVideoTrack)[]>([]);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [joined, setJoined] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
  const [joinWithoutDevices, setJoinWithoutDevices] = useState<boolean>(false);
  const [deviceError, setDeviceError] = useState<string>('');

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const channel = searchParams.get('channel') || DEFAULT_CHANNEL;
  const token = searchParams.get('token') || DEFAULT_TOKEN;

  const initTracks = async () => {
    try {
      const [micTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      setLocalTracks([micTrack, cameraTrack]);
    } catch (err) {
      console.error("🚨 Failed to init tracks:", err);
    }
  };
  
  useEffect(() => {
    initTracks();
  }, []);

  useEffect(() => {
    clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      await clientRef.current!.subscribe(user, mediaType);

      if (mediaType === 'video') {
        setRemoteUsers(prevUsers => {
          if (!prevUsers.find(u => u.uid === user.uid)) {
            return [...prevUsers, user];
          }
          return prevUsers;
        });
      }
    };

    const handleUserUnpublished = (user: IAgoraRTCRemoteUser) => {
      setRemoteUsers(prevUsers => prevUsers.filter(u => u.uid !== user.uid));
    };

    clientRef.current.on('user-published', handleUserPublished);
    clientRef.current.on('user-unpublished', handleUserUnpublished);

    return () => {
      clientRef.current!.off('user-published', handleUserPublished);
      clientRef.current!.off('user-unpublished', handleUserUnpublished);

      if (joined) {
        localTracks.forEach(track => track.close());
        clientRef.current!.leave();
      }
    };
  }, [joined, localTracks]);

 useEffect(() => {
  if (!localVideoRef.current) {
    console.warn("📭 localVideoRef is not assigned yet.");
    return;
  }

  if (localTracks.length === 0) {
    console.warn("🕐 Waiting for local tracks to be ready...");
    return;
  }

  const videoTrack = localTracks.find(track => track.trackMediaType === 'video') as ILocalVideoTrack;

  if (!videoTrack) {
    console.error("🎞️ No video track found in localTracks");
    return;
  }

  try {
    console.log("🎥 Playing local video track...");
    videoTrack.play(localVideoRef.current);
  } catch (err) {
    console.error("❌ Error playing video:", err);
  }
}, [localTracks]);


  // Join channel with camera and microphone
  const joinChannel = async () => {
    try {
      const client = clientRef.current;
      if (!client) return;
  
      let tracks: (ILocalAudioTrack | ILocalVideoTrack)[] = [];
  
      if (!joinWithoutDevices) {
        try {
          tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
          setIsMuted(false);
          setIsVideoEnabled(true);
        } catch (error) {
          console.error('Error accessing camera/microphone:', error);
          setDeviceError('Failed to access camera or microphone. They might be occupied.');
          return;
        }
      }
  
      const uid = await client.join(APP_ID, channel, token, null);
      console.log('Joined channel with UID:', uid);
  
      if (tracks.length > 0) {
        await client.publish(tracks);
      }
      
      setLocalTracks(tracks);
      setJoined(true);
      setDeviceError('');
    } catch (error) {
      console.error('Error joining channel:', error);
      setDeviceError('Failed to join channel. Please try again.');
    }
  };
  

  // Join without audio/video devices
  const joinWithoutMedia = async () => {
    try {
      const uid = await clientRef.current!.join(APP_ID, channel, token, null);
      console.log('Joined channel with UID (no media):', uid);
      setJoined(true);
      setIsMuted(true);
      setIsVideoEnabled(false);
      setLocalTracks([]);
      setDeviceError('');
    } catch (error) {
      console.error('Error joining channel:', error);
      setDeviceError('Failed to join channel. Please try again.');
    }
  };

  const leaveChannel = async () => {
    try {
      localTracks.forEach(track => track.close());
      await clientRef.current!.leave();
      setLocalTracks([]);
      setRemoteUsers([]);
      setJoined(false);
      console.log('Left channel successfully');
    } catch (error) {
      console.error('Error leaving channel:', error);
    }
  };

  const toggleMute = () => {
    if (localTracks.length > 0) {
      const audioTrack = localTracks.find(track => track.trackMediaType === 'audio') as ILocalAudioTrack;
      if (audioTrack) {
        audioTrack.setEnabled(!isMuted);
        setIsMuted(!isMuted);
      }
    }
  };

  const toggleVideo = () => {
    if (localTracks.length > 0) {
      const videoTrack = localTracks.find(track => track.trackMediaType === 'video') as ILocalVideoTrack;
  
      if (videoTrack && videoTrack.setEnabled) {
        try {
          videoTrack.setEnabled(!isVideoEnabled);
          setIsVideoEnabled(!isVideoEnabled);
  
          if (localVideoRef.current) {
            if (!isVideoEnabled) {
              videoTrack.play(localVideoRef.current);
            } else {
              videoTrack.stop();
            }
          }
        } catch (error) {
          console.error('Error toggling video:', error);
        }
      }
    }
  };
  

  // Enable/disable audio device
  const toggleAudioDevice = async () => {
    if (joined && !localTracks.some(track => track.trackMediaType === 'audio')) {
      try {
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        setLocalTracks(prev => [...prev, audioTrack]);
        await clientRef.current!.publish(audioTrack);
        setIsMuted(false);
      } catch (error) {
        console.error('Failed to add audio track:', error);
        setDeviceError('Failed to access microphone. It might be occupied.');
      }
    }
  };

  // Enable/disable video device
  const toggleVideoDevice = async () => {
    if (joined && !localTracks.some(track => track.trackMediaType === 'video')) {
      try {
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        setLocalTracks(prev => [...prev, videoTrack]);
        await clientRef.current!.publish(videoTrack);
        setIsVideoEnabled(true);
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }
      } catch (error) {
        console.error('Failed to add video track:', error);
        setDeviceError('Failed to access camera. It might be occupied.');
      }
    }
  };

  useEffect(() => {
    remoteUsers.forEach(user => {
      if (user.videoTrack) {
        user.videoTrack.play(`remote-video-${user.uid}`);
      }
    });
  }, [remoteUsers]);

  return (
    <div className="video-call-container p-4">
      <h1 className="text-2xl font-bold mb-4">Agora Video Call</h1>

      {!joined ? (
        <div className="join-options mb-4">
          <div className="mb-2">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                className="form-checkbox"
                checked={joinWithoutDevices}
                onChange={(e) => setJoinWithoutDevices(e.target.checked)}
              />
              <span className="ml-2">Join without camera and microphone</span>
            </label>
          </div>

          <button
            onClick={joinWithoutDevices ? joinWithoutMedia : joinChannel}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Join Call
          </button>

          {deviceError && (
            <div className="text-red-500 mt-2">
              {deviceError}
              <button
                onClick={joinWithoutMedia}
                className="ml-2 bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-sm"
              >
                Join without devices
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={leaveChannel}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mb-4"
        >
          Leave Call
        </button>
      )}

      <div className="flex flex-wrap gap-4">
        <div className="local-video-container">
          <div
            ref={localVideoRef}
            className="bg-gray-200 w-80 h-60 rounded border-white overflow-hidden relative"
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          >
            {!isVideoEnabled && (
        <img
          src="https://via.placeholder.com/150"
          alt="Silhouette"
          className="w-24 h-24"
        />
      )}
            <div className="absolute bottom-2 left-2 bg-gray-800 text-white px-2 py-1 text-sm rounded">
              You
            </div>
          </div>

          {joined && (
            <div className="controls flex gap-2 mt-2">
              {localTracks.some(track => track.trackMediaType === 'audio') ? (
                <button
                  onClick={toggleMute}
                  className={`px-3 py-1 rounded ${isMuted ? 'bg-red-500 text-white' : 'bg-gray-200'}`}
                >
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
              ) : (
                <button
                  onClick={toggleAudioDevice}
                  className="px-3 py-1 rounded bg-blue-500 text-white"
                >
                  Add Audio
                </button>
              )}

              {localTracks.some(track => track.trackMediaType === 'video') ? (
                <button
                  onClick={toggleVideo}
                  className={`px-3 py-1 rounded ${!isVideoEnabled ? 'bg-red-500 text-white' : 'bg-gray-200'}`}
                >
                  {isVideoEnabled ? 'Hide Video' : 'Show Video'}
                </button>
              ) : (
                <button
                  onClick={toggleVideoDevice}
                  className="px-3 py-1 rounded bg-blue-500 text-white"
                >
                  Add Video
                </button>
              )}
            </div>
          )}
        </div>
        {remoteUsers.map(user => (
          <div key={user.uid} className="remote-video-container">
            <div
              id={`remote-video-${user.uid}`}
              className="bg-gray-200 w-80 h-60 rounded overflow-hidden relative"
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              <video
                className="w-full h-full"
                autoPlay
                playsInline
                style={{ objectFit: 'cover' }}
              ></video>
              <div className="absolute bottom-2 left-2 bg-gray-800 text-white px-2 py-1 text-sm rounded">
                User {user.uid}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoCall;
