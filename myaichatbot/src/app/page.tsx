// Fixes TypeScript + TailwindCSS className conflicts and typing issues

'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [fileUploaded, setFileUploaded] = useState<string | null>(null);
  const [parsedPdfText, setParsedPdfText] = useState<string>('');

  const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const MODEL_ID = 'gemini-2.0-flash';

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    script.onload = () => {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    };
    document.body.appendChild(script);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    const typingMessage: Message = {
      id: crypto.randomUUID(),
      sender: 'ai',
      text: 'Typing...'
    };

    setMessages((prev) => [...prev, typingMessage]);
    setLoading(true);

    try {
      const combinedText = `${input.trim()}\n\n${parsedPdfText}`.trim();

      const contents = messages
        .map((msg) => ({
          role: msg.sender === 'ai' ? 'model' : 'user',
          parts: [{ text: msg.text }],
        }))
        .concat({
          role: 'user',
          parts: [{ text: combinedText }],
        });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents }),
        }
      );

      const data = await response.json();
      console.log('API Response:', data);

      const aiText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        JSON.stringify(data, null, 2) ||
        "Sorry, I couldn't understand that.";

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === typingMessage.id ? { ...msg, text: aiText } : msg
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === typingMessage.id
            ? { ...msg, text: 'Error fetching response.' }
            : msg
        )
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileUploaded(file.name);

    const reader = new FileReader();
    reader.onload = async () => {
      const typedArray = new Uint8Array(reader.result as ArrayBuffer);
      const pdfjsLib = (window as any).pdfjsLib;
      const pdf = await pdfjsLib.getDocument(typedArray).promise;
      let textContent = '';

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const text = await page.getTextContent();
        const pageText = text.items.map((item: any) => item.str).join(' ');
        textContent += pageText + '\n';
      }

      setParsedPdfText(textContent);
      console.log('Parsed PDF content:', textContent);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 flex items-center justify-center">
      <div className="w-full max-w-4xl h-[90vh] bg-white/80 backdrop-blur-sm shadow-2xl rounded-2xl border border-white/20 flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 p-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm"></div>
          <div className="relative z-10">
            <h1 className="text-2xl font-bold text-white mb-1 tracking-wide">AI Assistant</h1>
            <p className="text-blue-100 text-sm opacity-90">Powered by Gemini 2.0</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-gray-50/50 to-white/50">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              <div className="text-4xl mb-4">💬</div>
              <p className="text-lg font-medium mb-2">Start a conversation</p>
              <p className="text-sm opacity-75">Upload a PDF or type your message below</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id || msg.text}
              className={cn(
                'flex animate-in slide-in-from-bottom-2 duration-300',
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[70%] rounded-2xl p-4 shadow-lg border',
                  msg.sender === 'user'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-500/20 rounded-br-md'
                    : 'bg-white/90 text-gray-800 border-gray-200/50 rounded-bl-md backdrop-blur-sm'
                )}
              >
                {msg.sender === 'ai' ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.text}</p>
                )}
              </div>
            </div>
          ))}

          {fileUploaded && (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 mx-4 animate-in slide-in-from-left-2 duration-300">
              <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Uploaded: {fileUploaded}</span>
            </div>
          )}
        </div>

        <div className="p-6 bg-white/90 backdrop-blur-sm border-t border-gray-200/50">
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Input
                placeholder="Type your message here..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="pr-12 h-12 rounded-xl border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white/80 backdrop-blur-sm text-gray-800 placeholder-gray-500 shadow-sm"
              />
              {loading && (
                <div className="absolute right-3 top-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
                </div>
              )}
            </div>
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="h-12 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Send
            </Button>
          </div>

          <div className="relative">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              id="file-upload"
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="flex items-center justify-center gap-3 w-full p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200 cursor-pointer bg-gray-50/50"
            >
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div className="text-center">
                <p className="text-gray-600 font-medium">Upload PDF Document</p>
                <p className="text-gray-400 text-sm">Click to browse or drag and drop</p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
