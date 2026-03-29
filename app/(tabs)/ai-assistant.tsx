import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Config } from '@/constants/config';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  loading?: boolean;
}

export default function AIAssistantScreen() {
  const isDark = useColorScheme() === 'dark';
  const params = useLocalSearchParams<{ context?: string; sectionTitle?: string }>();

  const scrollRef = useRef<ScrollView>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);

  // Pre-fill summarise request if coming from ContentDetailScreen
  useEffect(() => {
    if (params.context && params.sectionTitle) {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: `"${params.sectionTitle}" хэсгийг хураангуйла`,
      };
      setMessages([userMsg]);
      sendToBackend(params.context);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.context]);

  const sendToBackend = async (text: string) => {
    const loadingId = `loading-${Date.now()}`;
    setThinking(true);
    setMessages((prev) => [
      ...prev,
      { id: loadingId, role: 'assistant', text: '', loading: true },
    ]);

    try {
      const res = await fetch(Config.SUMMARIZE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      const reply = data.summary ?? data.message ?? 'Хариу алдаа гарлаа.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId ? { ...m, text: reply, loading: false } : m,
        ),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                ...m,
                text: 'Серверт холбогдоход алдаа гарлаа. Backend ажиллаж байгаа эсэхийг шалгана уу.',
                loading: false,
              }
            : m,
        ),
      );
    } finally {
      setThinking(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || thinking) return;
    const text = input.trim();
    setInput('');
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    sendToBackend(text);
  };

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const inputBg = isDark ? '#1e293b' : '#f1f5f9';
  const inputColor = isDark ? '#f8fafc' : '#0f172a';

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: isDark ? '#0f172a' : '#fff' }}
    >
      {/* Header */}
      <View
        className="px-5 py-4 flex-row items-center border-b"
        style={{
          borderBottomColor: isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9',
        }}
      >
        <View
          className="w-9 h-9 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: '#0284c7' }}
        >
          <MaterialIcons name="auto-awesome" size={18} color="#fff" />
        </View>
        <View>
          <Text
            className="font-bold text-base"
            style={{ color: isDark ? '#f8fafc' : '#0f172a' }}
          >
            AI Туслах
          </Text>
          <Text
            className="text-xs"
            style={{ color: isDark ? '#64748b' : '#94a3b8' }}
          >
            ШУТИС гарын авлагын мэдээлэл
          </Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && <WelcomePrompts isDark={isDark} onPrompt={setInput} />}

        {messages.map((msg) => (
          <MotiView
            key={msg.id}
            from={{ opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 250 }}
          >
            <MessageBubble msg={msg} isDark={isDark} />
          </MotiView>
        ))}
      </ScrollView>

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View
          className="px-4 pb-6 pt-3 flex-row items-end gap-2"
          style={{
            borderTopWidth: 1,
            borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9',
            backgroundColor: isDark ? '#0f172a' : '#fff',
          }}
        >
          <View
            className="flex-1 rounded-2xl px-4 py-3"
            style={{ backgroundColor: inputBg, minHeight: 46 }}
          >
            <TextInput
              multiline
              value={input}
              onChangeText={setInput}
              placeholder="Асуулт бич..."
              placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
              style={{ color: inputColor, fontSize: 15, maxHeight: 120 }}
              returnKeyType="default"
            />
          </View>

          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || thinking}
            className="w-11 h-11 rounded-full items-center justify-center"
            style={{
              backgroundColor: input.trim() && !thinking ? '#0284c7' : (isDark ? '#1e293b' : '#e2e8f0'),
            }}
          >
            {thinking ? (
              <ActivityIndicator size="small" color="#0284c7" />
            ) : (
              <MaterialIcons
                name="send"
                size={18}
                color={input.trim() ? '#fff' : (isDark ? '#475569' : '#94a3b8')}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────

function MessageBubble({ msg, isDark }: { msg: Message; isDark: boolean }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <View className="items-end mb-3">
        <View
          className="rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]"
          style={{ backgroundColor: '#0284c7' }}
        >
          <Text className="text-white text-sm leading-5">{msg.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="items-start mb-3 flex-row">
      <View
        className="w-8 h-8 rounded-full items-center justify-center mr-2 mt-1"
        style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
      >
        <MaterialIcons
          name="auto-awesome"
          size={16}
          color="#0284c7"
        />
      </View>
      <View
        className="rounded-2xl rounded-tl-sm px-4 py-3 flex-1"
        style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc' }}
      >
        {msg.loading ? (
          <View className="flex-row items-center gap-1">
            {[0, 1, 2].map((i) => (
              <MotiView
                key={i}
                from={{ opacity: 0.3, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'timing', duration: 600, loop: true, delay: i * 180 }}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#0284c7',
                  marginRight: 4,
                }}
              />
            ))}
          </View>
        ) : (
          <Text
            className="text-sm leading-5"
            style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}
          >
            {msg.text}
          </Text>
        )}
      </View>
    </View>
  );
}

const PROMPTS = [
  'Тэтгэлэгт хэрхэн хамрагдах вэ?',
  'Кредит шууд тооцох шалгалт гэж юу вэ?',
  'Оюутны байрны бүртгэл хэрхэн хийх вэ?',
  'Эрүүл мэндийн даатгалаа хэрхэн төлөх вэ?',
];

function WelcomePrompts({ isDark, onPrompt }: { isDark: boolean; onPrompt: (s: string) => void }) {
  return (
    <View className="items-center mb-6">
      <View
        className="w-16 h-16 rounded-full items-center justify-center mb-3"
        style={{ backgroundColor: isDark ? '#1e293b' : '#eff6ff' }}
      >
        <MaterialIcons name="auto-awesome" size={32} color="#0284c7" />
      </View>
      <Text
        className="font-bold text-lg mb-1"
        style={{ color: isDark ? '#f8fafc' : '#0f172a' }}
      >
        AI Туслах
      </Text>
      <Text
        className="text-sm text-center mb-6 px-4"
        style={{ color: isDark ? '#64748b' : '#94a3b8' }}
      >
        ШУТИС-ийн гарын авлагаас мэдээлэл авах, тайлбарлуулах
      </Text>
      <View className="w-full gap-2">
        {PROMPTS.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => onPrompt(p)}
            className="rounded-xl px-4 py-3 flex-row items-center"
            style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc' }}
          >
            <MaterialIcons name="chat-bubble-outline" size={16} color="#0284c7" />
            <Text
              className="ml-2 text-sm flex-1"
              style={{ color: isDark ? '#94a3b8' : '#475569' }}
            >
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
