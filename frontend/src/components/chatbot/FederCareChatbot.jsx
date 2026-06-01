import { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const FEDERCARE_CONTEXT = `
You are FederCare Assistant, a helpful medical AI chatbot for FederCare: AI Health Network platform built as MCA final year project at Mar Thoma Institute of Information Technology, Ayur, Kollam, Kerala.
Developer: Adithya M
Guide: Mrs. Princy Thomas

ABOUT FEDERCARE:
FederCare is a complete digital healthcare platform connecting hospitals, doctors, patients, pharmacists, lab techs, ambulance drivers and vendors. It uses Federated Learning to train AI models across hospitals without sharing patient data.

KEY FEATURES:
- Federated Learning with FedAvg algorithm
- AI models:
  1. Symptom Checker (Logistic Regression - 41 diseases)
  2. Clinical Diagnosis (Random Forest)
  3. Pneumonia Detection (MobileNetV2)
  4. Chest X-Ray 14 Conditions (MobileNetV2 - AUC 0.80)
  5. Brain Tumor MRI Detection (MobileNetV2 - 90.6% accuracy)
  6. AI Health Summary (Gemini API)
- Video Consultation via Jitsi Meet
- Emergency SOS with GPS tracking
- EHR Wallet with QR consent system
- Medicine ordering with prescription verification
- Lab test booking and reports
- Equipment ordering for hospitals
- Epidemic detection and alerts
- Razorpay payment integration
- Real-time WebSocket notifications

8 USER ROLES:
Super Admin, Hospital Admin, Doctor, Patient, Pharmacist, Lab Technician, Ambulance Driver, Equipment Vendor

TECH STACK:
Django 4.2, React 18, Tailwind CSS, Scikit-learn, TensorFlow 2.15, Flower FL, SQLite, Cloudinary, Jitsi Meet, Razorpay, Django Channels

INSTRUCTIONS:
- Answer FederCare questions using above info
- Answer general medical questions
- Keep responses short and clear
- If off-topic politely redirect to medical or FederCare topics
`;

const SUGGESTIONS = [
  'What is FederCare?',
  'How to book a consultation?',
  'What is Federated Learning?',
  'How does Emergency SOS work?',
  'What AI models are used?',
];

const formatTime = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function FederCareChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hello! 👋 I am FederCare Assistant. I can help you with:\n\n• Questions about FederCare platform\n• General medical information\n• How to use any feature\n\nHow can I help you today?',
      time: formatTime(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
  const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, isMinimized]);

  const sendMessage = async (overrideText) => {
    const userMessage = (overrideText ?? input).trim();
    if (!userMessage || loading) return;

    setInput('');
    const newUserMsg = { role: 'user', content: userMessage, time: formatTime() };
    const historySnapshot = messages;
    setMessages((prev) => [...prev, newUserMsg]);
    setLoading(true);

    try {
      if (!genAI) {
        throw new Error('Missing REACT_APP_GEMINI_API_KEY');
      }

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: FEDERCARE_CONTEXT,
      });

      const chat = model.startChat({
        history: historySnapshot.slice(1).map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.7,
        },
      });

      const result = await chat.sendMessage(userMessage);
      const response = await result.response;
      const text = response.text();

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: text, time: formatTime() },
      ]);
    } catch (error) {
      console.error('Gemini error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I am having trouble connecting right now. Please try again! 🔄',
          time: formatTime(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Strip Markdown `**bold**` (Gemini emits it freely) and normalise list markers
  // so the user sees clean prose with proper bullets — no raw `*` left behind.
  const cleanLine = (line) =>
    line
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/^\s*\*\s+/, '• ')
      .replace(/^\s*-\s+/, '• ')
      .trim();

  const formatMessage = (text) => {
    if (!text) return null;
    const lines = text.split('\n').map(cleanLine).filter((l) => l.length > 0);
    return lines.map((line, i) => (
      <p
        key={i}
        className={`leading-relaxed ${line.startsWith('•') ? 'pl-2' : ''} ${i > 0 ? 'mt-1' : ''}`}
      >
        {line}
      </p>
    ));
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-orange-500 text-white shadow-2xl hover:bg-orange-600 transition-all duration-300 hover:scale-110 flex items-center justify-center"
          title="Chat with FederCare Assistant"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <span className="absolute top-0 right-0 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
        </button>
      )}

      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden transition-all duration-300 ${isMinimized ? 'h-16' : 'h-[600px] max-h-[calc(100vh-3rem)]'
            }`}
        >
          {/* Header */}
          <div
            className="p-4 flex items-center justify-between flex-shrink-0"
            style={{ backgroundColor: '#FAF7F2', borderBottom: '1px solid #E5E5E5' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-xl text-white">
                ⚕️
              </div>
              <div>
                <p className="font-semibold text-sm text-black">FederCare Assistant</p>
                <p className="text-xs flex items-center gap-1" style={{ color: '#666666' }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#22C55E' }} />
                  Online • AI Powered
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-black/70 hover:text-black w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5"
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? '▲' : '▼'}
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsMinimized(false);
                }}
                className="text-black/70 hover:text-black w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-1">
                        ⚕️
                      </div>
                    )}

                    <div
                      className={`max-w-xs rounded-2xl px-4 py-3 text-sm ${msg.role === 'user'
                        ? 'bg-orange-500 text-white rounded-tr-sm'
                        : 'bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-200'
                        }`}
                    >
                      <div className="leading-relaxed">
                        {formatMessage(msg.content)}
                      </div>
                      <p
                        className={`text-xs mt-1 ${msg.role === 'user' ? 'text-orange-100' : 'text-gray-400'
                          } text-right`}
                      >
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm mr-2">
                      ⚕️
                    </div>
                    <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-200">
                      <div className="flex gap-1 items-center h-5">
                        <div
                          className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"
                          style={{ animationDelay: '0ms' }}
                        />
                        <div
                          className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        />
                        <div
                          className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {messages.length === 1 && (
                <div className="px-4 pb-2 bg-gray-50">
                  <p className="text-xs text-gray-400 mb-2">Quick questions:</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(s)}
                        className="text-xs bg-orange-50 text-orange-600 px-3 py-1.5 rounded-full hover:bg-orange-100 border border-orange-200 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 bg-white border-t border-gray-100">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Ask about FederCare or medical questions..."
                    rows={1}
                    className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 max-h-32"
                    style={{ minHeight: '44px' }}
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height =
                        Math.min(e.target.scrollHeight, 128) + 'px';
                    }}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${input.trim() && !loading
                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                  >
                    {loading ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Powered by Gemini AI • FederCare Assistant
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
