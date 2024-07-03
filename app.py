from flask import Flask, request, jsonify
from flask_cors import CORS
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptAvailable, TranscriptsDisabled, VideoUnavailable

app = Flask(__name__)
CORS(app)

def get_video_transcript(video_id):
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return transcript
    except VideoUnavailable:
        return "Error: The video is unavailable."
    except TranscriptsDisabled:
        return "Error: Transcripts are disabled for this video."
    except NoTranscriptAvailable:
        return "Error: No transcript is available for this video."
    except Exception as e:
        return f"An error occurred: {str(e)}"

@app.route('/api/transcript', methods=['GET'])
def get_transcript():
    video_id = request.args.get('video_id')
    if not video_id:
        return jsonify({"error": "No video ID provided"}), 400
    
    transcript = get_video_transcript(video_id)
    return jsonify({"transcript": transcript})

if __name__ == '__main__':
    app.run(debug=True)