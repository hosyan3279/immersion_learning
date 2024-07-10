import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const MAX_TEXT_LENGTH = 128 * 1024; // 128 KiB in bytes

const getDefinition = async (word) => {
  try {
    // まずFree Dictionary APIで定義を取得
    const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    if (response.data && response.data.length > 0) {
      const entry = response.data[0];
      let definition = '';
      
      if (entry.meanings && entry.meanings.length > 0) {
        const meaning = entry.meanings[0];
        if (meaning.definitions && meaning.definitions.length > 0) {
          definition = meaning.definitions[0].definition;
        }
      }
      
      if (definition) {
        return definition;
      }
    }
    
    // 定義が見つからない場合、DeepLで単語を直接翻訳
    console.log(`定義が見つからないため、"${word}"をDeepLで直接翻訳します。`);
    const translatedWord = await translateToJapanese(word);
    return `直接翻訳: ${translatedWord}`;

  } catch (error) {
    console.error("Definition fetch error:", error);
    if (error.response && error.response.status === 404) {
      // 404エラーの場合も、DeepLで単語を直接翻訳
      console.log(`"${word}"が辞書にないため、DeepLで直接翻訳します。`);
      try {
        const translatedWord = await translateToJapanese(word);
        return `直接翻訳: ${translatedWord}`;
      } catch (deepLError) {
        console.error("DeepL translation error:", deepLError);
        return "定義の取得と翻訳に失敗しました。";
      }
    }
    return "定義の取得中にエラーが発生しました。";
  }
};

const translateToJapanese = async (text) => {
  try {
    // テキストが長すぎる場合は分割して送信
    if (new Blob([text]).size > MAX_TEXT_LENGTH) {
      const chunks = splitText(text);
      const translatedChunks = await Promise.all(chunks.map(async (chunk) => {
        const response = await axios.post('http://localhost:5000/api/translate', { text: chunk });
        return response.data.translated_text;
      }));
      return translatedChunks.join(' ');
    } else {
      const response = await axios.post('http://localhost:5000/api/translate', { text });
      return response.data.translated_text;
    }
  } catch (error) {
    console.error("Translation error:", error);
    if (error.response && error.response.data && error.response.data.error) {
      return `翻訳エラー: ${error.response.data.error}`;
    }
    return "翻訳中にエラーが発生しました。";
  }
};

// テキストを適切なサイズに分割する関数
const splitText = (text) => {
  const chunks = [];
  let currentChunk = "";

  text.split(".").forEach((sentence) => {
    if (new Blob([currentChunk + sentence]).size > MAX_TEXT_LENGTH) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }
    currentChunk += sentence + ".";
  });

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

const splitDefinitions = (text) => {
  return text.split(/[、。]/).filter(def => def.trim() !== '');
};

const Popup = ({ text, onClose, onWordSelect }) => {
  const [selectedWords, setSelectedWords] = useState([]);
  const [definitions, setDefinitions] = useState({});
  const [selectedDefinitions, setSelectedDefinitions] = useState({});
  const [customDefinitions, setCustomDefinitions] = useState({});
  const [translationInfo, setTranslationInfo] = useState("");
  const [editingWord, setEditingWord] = useState(null);

  const handleWordClick = (word) => {
    if (selectedWords.includes(word)) {
      setSelectedWords(selectedWords.filter(w => w !== word));
      setSelectedDefinitions(prev => {
        const newDefs = {...prev};
        delete newDefs[word];
        return newDefs;
      });
    } else {
      setSelectedWords([...selectedWords, word]);
    }
  };

  useEffect(() => {
    const fetchDefinitions = async () => {
      const newDefinitions = {};
      for (const word of selectedWords) {
        if (!definitions[word]) {
          const definition = await getDefinition(word);
          const translatedDefinition = await translateToJapanese(definition);
          newDefinitions[word] = splitDefinitions(translatedDefinition);
        }
      }
      setDefinitions(prev => ({...prev, ...newDefinitions}));
    };

    if (selectedWords.length > 0) {
      fetchDefinitions();
    }
  }, [selectedWords]);

  const handleDefinitionSelect = (word, definition) => {
    setSelectedDefinitions(prev => ({...prev, [word]: definition}));
  };

  const handleCustomDefinitionChange = (word, value) => {
    setCustomDefinitions(prev => ({...prev, [word]: value}));
  };

  const handleCustomDefinitionSave = (word) => {
    const customDef = customDefinitions[word];
    if (customDef && customDef.trim() !== '') {
      setDefinitions(prev => ({
        ...prev,
        [word]: [...(prev[word] || []), customDef]
      }));
      setSelectedDefinitions(prev => ({...prev, [word]: customDef}));
      setCustomDefinitions(prev => {
        const newDefs = {...prev};
        delete newDefs[word];
        return newDefs;
      });
    }
    setEditingWord(null);
  };

  const words = text.split(/\s+/);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">センテンスと単語選択</h3>
        <p className="mb-2 text-sm text-gray-600">{translationInfo}</p>
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
          <h4 className="font-bold mb-2">選択された単語と定義:</h4>
          {selectedWords.map(word => (
            <div key={word} className="mb-4 p-2 border rounded">
              <span className="font-semibold">{word}: </span>
              {definitions[word] ? (
                <div className="mt-2">
                  {definitions[word].length <= 10 ? (
                    <div className="flex flex-wrap mb-2">
                      {definitions[word].map((def, index) => (
                        <button
                          key={index}
                          onClick={() => handleDefinitionSelect(word, def)}
                          className={`mr-2 mb-2 px-2 py-1 rounded text-sm ${
                            selectedDefinitions[word] === def
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {def}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <select
                    value={selectedDefinitions[word] || ''}
                    onChange={(e) => handleDefinitionSelect(word, e.target.value)}
                    className="border p-1 mr-2 w-full mb-2"
                  >
                    <option value="">定義を選択 (または上のボタンから選択)</option>
                    {definitions[word].map((def, index) => (
                      <option key={index} value={def}>{def}</option>
                    ))}
                  </select>
                  {editingWord === word ? (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={customDefinitions[word] || ''}
                        onChange={(e) => handleCustomDefinitionChange(word, e.target.value)}
                        className="border p-1 mr-2 w-full mb-2"
                        placeholder="カスタム定義を入力"
                      />
                      <button
                        onClick={() => handleCustomDefinitionSave(word)}
                        className="bg-green-500 text-white px-2 py-1 rounded text-sm mr-2"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingWord(null)}
                        className="bg-gray-500 text-white px-2 py-1 rounded text-sm"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingWord(word)}
                      className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
                    >
                      カスタム定義を追加
                    </button>
                  )}
                </div>
              ) : (
                "定義を読み込み中..."
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button 
            onClick={() => onWordSelect(selectedWords, selectedDefinitions)}
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

  const handleWordSelect = (words, definitions) => {
    setSelectedWords(words);
    // ここで選択された単語と定義を使って次のステップ（例：Ankiへの追加）を実行できます
    console.log('選択された単語と定義:', words, definitions);
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