import React, { useState, useEffect, useRef } from 'react';

const Popup = ({ text, onClose, onWordSelect }) => {
  const [selectedWords, setSelectedWords] = useState([]);

  const handleWordClick = (word) => {
    if (selectedWords.includes(word)) {
      setSelectedWords(selectedWords.filter(w => w !== word));
    } else {
      setSelectedWords([...selectedWords, word]);
    }
  };

  const words = text.split(/\s+/);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl w-full">
        <h3 className="text-xl font-bold mb-4">センテンスと単語選択</h3>
        <div className="mb-4">
          {words.map((word, index) => (
            <span
              key={index}
              className={`inline-block mr-1 mb-1 p-1 rounded cursor-pointer ${
                selectedWords.includes(word) ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
              onClick={() => handleWordClick(word)}
            >
              {word}
            </span>
          ))}
        </div>
        <div className="mb-4">
          <h4 className="font-bold mb-2">選択された単語:</h4>
          <p>{selectedWords.join(', ') || '未選択'}</p>
        </div>
        <div className="flex justify-end">
          <button 
            onClick={() => onWordSelect(selectedWords)}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mr-2"
          >
            単語を確定
          </button>
          <button 
            onClick={onClose}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

const YouTubeTranscription = () => {
  const [videoId, setVideoId] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [playerReady, setPlayerReady] = useState(false);
  const [selectedText, setSelectedText] = useState(null);
  const [selectedWords, setSelectedWords] = useState([]);
  const playerRef = useRef(null);

  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '360',
        width: '640',
        videoId: '',
        events: {
          'onReady': onPlayerReady,
        },
      });
    };

    return () => {
      window.onYouTubeIframeAPIReady = null;
    };
  }, []);

  useEffect(() => {
    if (playerReady && videoId) {
      playerRef.current.loadVideoById(videoId);
    }
  }, [videoId, playerReady]);

  const onPlayerReady = () => {
    setPlayerReady(true);
  };

  const handleVideoIdChange = (e) => {
    setVideoId(e.target.value);
  };

  const fetchTranscription = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/transcript?video_id=${videoId}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      setTranscript(data.transcript);
    } catch (error) {
      console.error('Error fetching transcript:', error);
      setTranscript([{ text: 'Error fetching transcript' }]);
    }
  };

  const formatTime = (seconds) => {
    const date = new Date(seconds * 1000);
    return date.toISOString().substr(11, 8);
  };

  const handleTimestampClick = (startTime) => {
    if (playerRef.current && playerReady) {
      playerRef.current.seekTo(startTime, true);
      playerRef.current.playVideo();
    }
  };


  const handleTextClick = (text) => {
    setSelectedText(text);
  };

  const handleClosePopup = () => {
    setSelectedText(null);
    setSelectedWords([]);
  };

  const handleWordSelect = (words) => {
    setSelectedWords(words);
    // ここで選択された単語を使って次のステップ（例：Ankiへの追加）を実行できます
    console.log('選択された単語:', words);
    // 今回はポップアップを閉じるだけにします
    handleClosePopup();
  };

  return (
    <div className="h-screen flex flex-col p-4">
      <div className="mb-4">
        <input
          type="text"
          value={videoId}
          onChange={handleVideoIdChange}
          placeholder="YouTube動画IDを入力"
          className="border p-2 mr-2"
        />
        <button
          onClick={fetchTranscription}
          className="bg-blue-500 text-white p-2 rounded"
        >
          文字起こしを取得
        </button>
      </div>
      <div className="flex-grow flex">
        <div className="w-1/2 pr-2">
          <div id="youtube-player"></div>
        </div>
        <div className="w-1/2 pl-2 flex flex-col">
          <h2 className="text-xl font-bold mb-2">文字起こし</h2>
          <ul className="flex-grow border-2 border-gray-300 rounded-lg p-4 overflow-y-auto bg-gray-50 shadow-inner" style={{maxHeight: "calc(100vh - 200px)"}}>
            {Array.isArray(transcript) ? (
              transcript.map((item, index) => (
                <li 
                  key={index} 
                  className="mb-2 p-2 rounded transition-colors duration-200 ease-in-out hover:bg-blue-100 focus:bg-blue-100 focus:outline-none"
                  tabIndex={0}
                >
                  <span 
                    className="font-bold cursor-pointer text-blue-600 hover:underline"
                    onClick={() => handleTimestampClick(item.start)}
                  >
                    {formatTime(item.start)}
                  </span>
                  : <span 
                      className="cursor-pointer hover:bg-yellow-200"
                      onClick={() => handleTextClick(item.text)}
                    >
                      {item.text}
                    </span>
                </li>
              ))
            ) : (
              <li>{transcript}</li>
            )}
          </ul>
        </div>
      </div>
      {selectedText && (<Popup text={selectedText} onClose={handleClosePopup} onWordSelect={handleWordSelect}/>)}
    </div>
  );
};

export default YouTubeTranscription;