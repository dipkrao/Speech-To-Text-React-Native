import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import AudioRecord from 'react-native-audio-record';
import {Buffer} from 'buffer';

const DEEPGRAM_API_KEY = 'Add_YOUR_DEEPGRAM_KEY_HERE';

const App: React.FC = () => {
  const [transcript, setTranscript] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    requestPermissions();
  }, []);

  // 🔹 Request Microphone Permission
  const requestPermissions = async (): Promise<void> => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.error('❌ Microphone permission denied');
      }
    }
  };

  // 🔹 Connect to Deepgram WebSocket
  const connectWebSocket = (): void => {
    ws.current = new WebSocket(
      `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1`,
      [],
      {
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/x-raw',
        },
      },
    );

    ws.current.onopen = (): void => {
      console.log('✅ WebSocket Connected');
      startRecording();
    };

    ws.current.onmessage = (event: MessageEvent): void => {
      try {
        const response = JSON.parse(event.data);
        console.log('Deepgram Response:', response);

        // 🔹 Extract transcript from Deepgram's response
        if (response.channel?.alternatives) {
          const newTranscript: string | undefined =
            response.channel.alternatives[0]?.transcript;
          if (newTranscript) {
            setTranscript(prev => prev + ' ' + newTranscript); // Append new text
          }
        }
      } catch (error) {
        console.error('Failed to parse response:', error);
      }
    };

    ws.current.onerror = (error: Event): void =>
      console.error('❌ WebSocket Error:', error);
  };

  // 🔹 Start Recording
  const startRecording = async (): Promise<void> => {
    try {
      setIsRecording(true);
      const options = {
        sampleRate: 16000, // Matches Deepgram's supported rates
        channels: 1, // Mono channel
        bitsPerSample: 16, // 16-bit PCM
        format: 'pcm', // Ensure raw PCM format (no WAV headers)
      };

      AudioRecord.init(options);
      AudioRecord.start();

      AudioRecord.on('data', (data: string) => {
        if (data && ws.current?.readyState === WebSocket.OPEN) {
          const buffer = Buffer.from(data, 'base64'); // Convert to raw PCM buffer
          ws.current.send(buffer);
        }
      });

      console.log('🎙️ Recording Started');
    } catch (error) {
      console.error('❌ Recording Error:', error);
    }
  };

  // 🔹 Stop Recording
  const stopRecording = async (): Promise<void> => {
    try {
      const audioFile = await AudioRecord.stop();
      console.log('🎙️ Recording Stopped:', audioFile);
      setIsRecording(false);
      ws.current?.close();
    } catch (error) {
      console.error('❌ Stop Recording Error:', error);
    }
  };

  return (
    <SafeAreaView style={{flex: 1}}>
      <View style={styles.container}>
        <ScrollView style={{flex: 1}}>
          <Text style={styles.transcript}>
            {transcript || 'Press Start to Transcribe'}
          </Text>
        </ScrollView>
        <Button
          title={isRecording ? 'Stop Listening' : 'Start Listening'}
          onPress={isRecording ? stopRecording : connectWebSocket}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  transcript: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
});

export default App;
