import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import API from '../../api/axios';

const now = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const wsBase = (API.defaults.baseURL || 'http://localhost:8000').replace(/^http/, 'ws');

/**
 * Live consultation chat shared by doctor and patient. Both sides connect to
 * `ws/consultation/<id>/chat/`; messages and images are relayed through the
 * channel layer. X-rays shared in chat can be analysed in place — the result
 * is posted back as its own chat bubble, never to any side panel.
 *
 * Self-contained (its own WebSocket + local state) so it never disturbs the
 * memoized Jitsi call rendered alongside it.
 */
const ConsultationChat = ({ consultationId, sender = 'patient', senderName = '' }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(null);

  const wsRef = useRef(null);
  const endRef = useRef(null);
  const fileRef = useRef(null);

  const scrollToEnd = () =>
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);

  // ── WebSocket lifecycle ─────────────────────────────────────
  useEffect(() => {
    if (!consultationId) return undefined;

    const ws = new WebSocket(`${wsBase}/ws/consultation/${consultationId}/chat/`);
    wsRef.current = ws;

    ws.onopen = () => {
      setMessages([
        {
          type: 'system',
          text: 'Consultation chat started. Share messages and images here.',
          time: now(),
        },
      ]);
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setMessages((prev) => [...prev, msg]);
        scrollToEnd();
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onerror = () => { /* surfaced via send-time readyState checks */ };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
    };
  }, [consultationId]);

  const push = (msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
    setMessages((prev) => [...prev, msg]);
    scrollToEnd();
  };

  // ── Send text ───────────────────────────────────────────────
  const sendMessage = () => {
    if (!input.trim()) return;
    push({
      type: 'message',
      sender,
      sender_name: senderName,
      text: input.trim(),
      time: now(),
    });
    setInput('');
  };

  // ── Send image ──────────────────────────────────────────────
  const sendImage = (imgFile) => {
    if (!imgFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      push({
        type: 'image',
        sender,
        sender_name: senderName,
        image_data: e.target.result,
        image_name: imgFile.name,
        time: now(),
        message_id: `${Date.now()}`,
      });
    };
    reader.onerror = () => toast.error('Failed to send image');
    reader.readAsDataURL(imgFile);
    setFile(null);
    setFilePreview(null);
  };

  // ── Analyse a shared X-ray in place ─────────────────────────
  const analyzeXray = async (imageData, messageId) => {
    setAnalyzing(messageId);
    try {
      const resp = await fetch(imageData);
      const blob = await resp.blob();
      const fd = new FormData();
      fd.append('image', new File([blob], 'xray.jpg', { type: blob.type || 'image/jpeg' }));

      const { data } = await API.post('/api/ai/xray-predict/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data?.success) {
        push({ type: 'xray_result', sender: 'system', result: data.data, time: now() });
      }
    } catch {
      toast.error('X-Ray analysis failed!');
    } finally {
      setAnalyzing(null);
    }
  };

  const onPickFile = (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    const reader = new FileReader();
    reader.onload = (ev) => setFilePreview(ev.target.result);
    reader.readAsDataURL(picked);
  };

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white mt-3">
      {/* Header */}
      <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>💬</span>
          <span className="font-medium text-sm">Consultation Chat</span>
        </div>
        <span className="text-xs text-gray-400">Share messages &amp; X-Rays here</span>
      </div>

      {/* Messages */}
      <div className="h-48 overflow-y-auto p-3 space-y-2 bg-gray-50">
        {messages.map((msg, idx) => {
          const mine = msg.sender === sender;
          return (
            <div key={idx}>
              {msg.type === 'system' && (
                <p className="text-xs text-center text-gray-400 py-1">{msg.text}</p>
              )}

              {msg.type === 'message' && (
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-xs rounded-2xl px-3 py-2 text-sm ${
                      mine
                        ? 'bg-orange-500 text-white rounded-tr-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                    }`}
                  >
                    <p className={`text-xs font-medium mb-1 ${mine ? 'text-primary-200' : 'text-gray-500'}`}>
                      {msg.sender_name || msg.sender}
                    </p>
                    <p className="break-words">{msg.text}</p>
                    <p className={`text-xs mt-1 text-right ${mine ? 'text-primary-200' : 'text-gray-400'}`}>
                      {msg.time}
                    </p>
                  </div>
                </div>
              )}

              {msg.type === 'image' && (
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-xs bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <img src={msg.image_data} alt="Shared" className="w-full max-h-40 object-cover" />
                    <div className="p-2">
                      <p className="text-xs text-gray-500">
                        {(msg.sender_name || msg.sender)} • {msg.time}
                      </p>
                      <button
                        onClick={() => analyzeXray(msg.image_data, msg.message_id || `${idx}`)}
                        disabled={analyzing === (msg.message_id || `${idx}`)}
                        className="mt-1 bg-orange-500 text-white text-xs px-3 py-1.5 rounded-lg w-full hover:bg-orange-600 disabled:opacity-50"
                      >
                        {analyzing === (msg.message_id || `${idx}`)
                          ? '⏳ Analyzing…'
                          : '🔬 Analyze as X-Ray'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {msg.type === 'xray_result' && (
                <div
                  className={`mx-auto max-w-xs p-3 rounded-xl border-2 text-sm ${
                    msg.result?.predicted_class === 'NORMAL'
                      ? 'border-green-200 bg-green-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <p
                    className={`font-bold ${
                      msg.result?.predicted_class === 'NORMAL' ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    🔬 X-Ray Result:
                    {msg.result?.predicted_class === 'NORMAL' ? ' ✅ NORMAL' : ' ⚠️ PNEUMONIA'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Confidence: {msg.result?.confidence}%</p>
                  <p className="text-xs text-gray-400 mt-1">{msg.time}</p>
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* File preview */}
      {filePreview && (
        <div className="px-3 pt-2 bg-gray-50 border-t border-gray-100 flex items-center">
          <div className="relative inline-block">
            <img src={filePreview} alt="preview" className="h-16 w-16 object-cover rounded-lg" />
            <button
              onClick={() => { setFile(null); setFilePreview(null); }}
              className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center"
            >
              ✕
            </button>
          </div>
          <button
            onClick={() => sendImage(file)}
            className="ml-2 bg-orange-500 text-white text-xs px-3 py-1 rounded-lg"
          >
            Send Image
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
        <label className="cursor-pointer flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
            📎
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
        </label>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type a message…"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />

        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
            input.trim() ? 'bg-orange-500 text-white hover:bg-primary-700' : 'bg-gray-100 text-gray-400'
          }`}
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default ConsultationChat;
