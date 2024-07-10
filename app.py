from flask import Flask, request, jsonify
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptAvailable, TranscriptsDisabled, VideoUnavailable
import os
from dotenv import load_dotenv
import deepl

load_dotenv()

app = Flask(__name__)
CORS(app)

DEEPL_API_KEY = os.getenv('DEEPL_API_KEY')
translator = deepl.Translator(DEEPL_API_KEY)

@app.route('/api/transcript', methods=['GET'])
def get_transcript():
    video_id = request.args.get('video_id')
    if not video_id:
        return jsonify({"error": "No video ID provided"}), 400
    
    transcript = get_video_transcript(video_id)
    return jsonify({"transcript": transcript})

@app.route('/api/translate', methods=['POST'])
def translate_text():
    data = request.json
    text = data.get('text')
    if not text:
        return jsonify({"error": "No text provided"}), 400

    try:
        translated_text = translate_to_japanese(text)
        return jsonify({"translated_text": translated_text})
    except deepl.DeepLException as e:
        return jsonify({"error": str(e)}), 500

def get_video_transcript(video_id):
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return transcript
    except (NoTranscriptAvailable, TranscriptsDisabled, VideoUnavailable) as e:
        return str(e)

def translate_to_japanese(text):
    # テキストサイズの制限をチェック
    if len(text.encode('utf-8')) > 128 * 1024:
        raise ValueError("Text size exceeds 128 KiB limit")

    try:
        result = translator.translate_text(text, 
                                           target_lang="JA", 
                                           formality="more")  # フォーマリティを「より丁寧」に設定
        return result.text
    except deepl.DeepLException as e:
        app.logger.error(f"DeepL API error: {str(e)}")
        raise

if __name__ == '__main__':
    app.run(debug=True)