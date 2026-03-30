import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Config } from '@/constants/config';
import { EaseOutExpo } from '@/constants/Theme';

const EASE = Easing.bezier(...EaseOutExpo);

// ─── Design tokens (match Home screen) ───────────────────────────

const BLUE   = '#08158F';
const GOLD   = '#FFC20D';
const BG     = '#F8F9FA';
const WHITE  = '#FFFFFF';
const BODY   = '#1A1A2E';
const MUTED  = '#6B7280';
const BORDER = 'rgba(8,21,143,0.09)';

// ─── Types ────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  loading?: boolean;
  timestamp: Date;
}

// ─── Suggested prompts ────────────────────────────────────────────

const PROMPTS: { icon: string; text: string; color: string }[] = [
  { icon: 'school',               text: 'Кредит тооцох шалгалт гэж юу вэ?',      color: BLUE },
  { icon: 'emoji-events',         text: 'Тэтгэлэгт хэрхэн хамрагдах вэ?',        color: '#E53935' },
  { icon: 'apartment',            text: 'Оюутны байрны бүртгэл хэрхэн хийх вэ?', color: '#2E7D32' },
  { icon: 'local-hospital',       text: 'Эрүүл мэндийн даатгалаа хэрхэн төлөх?', color: '#6A1B9A' },
];

// ─── Screen ───────────────────────────────────────────────────────

export default function AIAssistantScreen() {
  const params = useLocalSearchParams<{ context?: string; sectionTitle?: string }>();

  const scrollRef  = useRef<ScrollView>(null);
  const inputRef   = useRef<TextInput>(null);
  const [input, setInput]       = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [focused, setFocused]   = useState(false);

  // Auto-send from section context
  useEffect(() => {
    if (params.context && params.sectionTitle) {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: `"${params.sectionTitle}" хэсгийг хураангуйла`,
        timestamp: new Date(),
      };
      setMessages([userMsg]);
      // Section context is already rich text — summarize directly, skip search
      sendSectionSummary(params.context);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.context]);

  // Shared chat call — used for both normal questions and section summaries
  const sendChat = useCallback(async (query: string, currentMessages: Message[]) => {
    const loadingId = `loading-${Date.now()}`;
    setThinking(true);
    setMessages(prev => [
      ...prev,
      { id: loadingId, role: 'assistant', text: '', loading: true, timestamp: new Date() },
    ]);

    // Build history from settled messages (exclude the loading placeholder)
    const history = currentMessages
      .filter(m => !m.loading)
      .map(m => ({ role: m.role, content: m.text }));

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(Config.CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setMessages(prev =>
        prev.map(m => m.id === loadingId
          ? { ...m, text: data.reply ?? 'Хариу авахад алдаа гарлаа.', loading: false }
          : m
        )
      );
    } catch (e: any) {
      const msg = e?.message?.includes('GEMINI_API_KEY')
        ? 'API түлхүүр тохируулаагүй байна. Серверт GEMINI_API_KEY нэмнэ үү.'
        : 'Серверт холбогдоход алдаа гарлаа. Дахин оролдоно уу.';
      setMessages(prev =>
        prev.map(m => m.id === loadingId ? { ...m, text: msg, loading: false } : m)
      );
    } finally {
      setThinking(false);
    }
  }, []);

  const sendToBackend  = useCallback((query: string) => {
    setMessages(prev => {
      sendChat(query, prev);
      return prev;
    });
  }, [sendChat]);

  const sendSectionSummary = useCallback((sectionText: string) => {
    const query = `Дараах агуулгыг хураангуйла:\n\n${sectionText}`;
    setMessages(prev => {
      sendChat(query, prev);
      return prev;
    });
  }, [sendChat]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text, timestamp: new Date() }]);
    sendToBackend(text);
  };

  const handlePrompt = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const handleClear = () => setMessages([]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages]);

  const canSend = input.trim().length > 0 && !thinking;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />

      {/* ── Blue header ────────────────────────────────────── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: BLUE }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 }}>
          {/* Top row: logo + clear button */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Image
              source={require('@/assets/images/main_logo.png')}
              style={{ width: 36, height: 36, borderRadius: 8 }}
              resizeMode="contain"
            />
            {messages.length > 0 ? (
              <TouchableOpacity
                onPress={handleClear}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: 'rgba(255,255,255,0.13)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <MaterialIcons name="delete-outline" size={19} color="rgba(255,255,255,0.80)" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 36 }} />
            )}
          </View>

          {/* Title + BETA badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 26, color: WHITE, letterSpacing: -0.5 }}>
              AI Туслах
            </Text>
            <View style={{ backgroundColor: GOLD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 10, color: BODY, letterSpacing: 0.5 }}>
                BETA
              </Text>
            </View>
          </View>

          {/* Status indicator */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' }} />
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.60)' }}>
              ШУТИС гарын авлага холбогдсон
            </Text>
          </View>
        </View>
        {/* Rounded bottom edge */}
        <View style={{ height: 22, backgroundColor: BG, borderTopLeftRadius: 22, borderTopRightRadius: 22, marginTop: -1 }} />
      </SafeAreaView>

      {/* ── Message list ───────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0
          ? <WelcomeView onPrompt={handlePrompt} />
          : messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
        }
      </ScrollView>

      {/* ── Input bar ──────────────────────────────────────── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={{
          backgroundColor: WHITE,
          borderTopWidth: 1,
          borderTopColor: BORDER,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: Platform.OS === 'ios' ? 28 : 16,
        }}>
          {/* Quick suggestion chips (shown only when empty input + no messages) */}
          {messages.length === 0 && input.length === 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, marginBottom: 10 }}
            >
              {PROMPTS.map(p => (
                <TouchableOpacity
                  key={p.text}
                  onPress={() => handlePrompt(p.text)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: BG,
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderWidth: 1,
                    borderColor: BORDER,
                    gap: 6,
                  }}
                >
                  <MaterialIcons name={p.icon as any} size={14} color={p.color} />
                  <Text style={{
                    fontFamily: 'Inter_500Medium',
                    fontSize: 12,
                    color: BODY,
                  }} numberOfLines={1}>
                    {p.text.length > 26 ? p.text.slice(0, 26) + '…' : p.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Text input + send */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <View style={{
              flex: 1,
              backgroundColor: BG,
              borderRadius: 22,
              borderWidth: 1.5,
              borderColor: focused ? BLUE : BORDER,
              paddingHorizontal: 16,
              paddingVertical: 10,
              minHeight: 46,
            }}>
              <TextInput
                ref={inputRef}
                multiline
                value={input}
                onChangeText={setInput}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Асуулт бичнэ үү..."
                placeholderTextColor={MUTED}
                style={{
                  fontFamily: 'Inter_400Regular',
                  fontSize: 15,
                  color: BODY,
                  maxHeight: 110,
                  lineHeight: 22,
                }}
              />
            </View>

            <SendButton canSend={canSend} thinking={thinking} onPress={handleSend} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Send button ──────────────────────────────────────────────────

function SendButton({
  canSend, thinking, onPress,
}: { canSend: boolean; thinking: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn  = () => Animated.timing(scale, { toValue: 0.88, duration: 80,  easing: EASE, useNativeDriver: true }).start();
  const pressOut = () => Animated.timing(scale, { toValue: 1,    duration: 150, easing: EASE, useNativeDriver: true }).start();

  // Spin animation for thinking
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (thinking) {
      Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
      ).start();
    } else {
      spin.stopAnimation();
      spin.setValue(0);
    }
  }, [thinking]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={!canSend && !thinking}
        activeOpacity={1}
        style={{
          width: 46, height: 46, borderRadius: 23,
          backgroundColor: canSend ? BLUE : 'rgba(8,21,143,0.10)',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {thinking ? (
          <Animated.View style={{ transform: [{ rotate }] }}>
            <MaterialIcons name="autorenew" size={20} color={BLUE} />
          </Animated.View>
        ) : (
          <MaterialIcons
            name="arrow-upward"
            size={20}
            color={canSend ? WHITE : 'rgba(8,21,143,0.35)'}
          />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Message bubble ───────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const op = useRef(new Animated.Value(0)).current;
  const y  = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 260, easing: EASE, useNativeDriver: true }),
      Animated.timing(y,  { toValue: 0, duration: 260, easing: EASE, useNativeDriver: true }),
    ]).start();
  }, []);

  const timeStr = msg.timestamp.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });

  if (msg.role === 'user') {
    return (
      <Animated.View style={{
        alignItems: 'flex-end',
        marginBottom: 16,
        opacity: op,
        transform: [{ translateY: y }],
      }}>
        <View style={{
          maxWidth: '78%',
          backgroundColor: BLUE,
          borderRadius: 20,
          borderBottomRightRadius: 5,
          paddingHorizontal: 16,
          paddingVertical: 11,
          shadowColor: 'rgba(8,21,143,0.30)',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 1,
          shadowRadius: 8,
          elevation: 4,
        }}>
          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            color: WHITE,
            lineHeight: 22,
          }}>
            {msg.text}
          </Text>
        </View>
        <Text style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 10,
          color: MUTED,
          marginTop: 4,
          marginRight: 4,
        }}>
          {timeStr}
        </Text>
      </Animated.View>
    );
  }

  // Assistant bubble
  return (
    <Animated.View style={{
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
      opacity: op,
      transform: [{ translateY: y }],
    }}>
      {/* AI avatar */}
      <View style={{
        width: 32, height: 32, borderRadius: 10,
        backgroundColor: BLUE,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 10, marginTop: 2,
        flexShrink: 0,
      }}>
        <MaterialIcons name="auto-awesome" size={16} color={GOLD} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={{
          backgroundColor: WHITE,
          borderRadius: 20,
          borderTopLeftRadius: 5,
          borderWidth: 1,
          borderColor: BORDER,
          paddingHorizontal: 16,
          paddingVertical: 12,
          shadowColor: 'rgba(0,0,0,0.06)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 8,
          elevation: 2,
        }}>
          {msg.loading ? (
            <TypingDots />
          ) : (
            <Text style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 14,
              color: BODY,
              lineHeight: 23,
            }}>
              {msg.text}
            </Text>
          )}
        </View>
        {!msg.loading && (
          <Text style={{
            fontFamily: 'Inter_400Regular',
            fontSize: 10,
            color: MUTED,
            marginTop: 4,
            marginLeft: 4,
          }}>
            {timeStr}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Typing dots ──────────────────────────────────────────────────

function TypingDots() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    dots.forEach((dot, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(dot, { toValue: -5, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0,  duration: 320, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
          Animated.delay(280),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 2 }}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: BLUE,
          opacity: 0.6,
          transform: [{ translateY: dot }],
        }} />
      ))}
    </View>
  );
}

// ─── Welcome view ─────────────────────────────────────────────────

function WelcomeView({ onPrompt }: { onPrompt: (s: string) => void }) {
  const op = useRef(new Animated.Value(0)).current;
  const y  = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 440, easing: EASE, useNativeDriver: true }),
      Animated.timing(y,  { toValue: 0, duration: 440, easing: EASE, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: op, transform: [{ translateY: y }] }}>

      {/* Hero area */}
      <View style={{ alignItems: 'center', paddingVertical: 32 }}>
        {/* Outer glow ring */}
        <View style={{
          width: 88, height: 88, borderRadius: 26,
          backgroundColor: 'rgba(8,21,143,0.06)',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 18,
        }}>
          <View style={{
            width: 68, height: 68, borderRadius: 20,
            backgroundColor: BLUE,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: 'rgba(8,21,143,0.40)',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 1,
            shadowRadius: 16,
            elevation: 8,
          }}>
            <MaterialIcons name="auto-awesome" size={32} color={GOLD} />
          </View>
        </View>

        <Text style={{
          fontFamily: 'Inter_700Bold',
          fontSize: 22,
          color: BLUE,
          letterSpacing: -0.4,
          marginBottom: 8,
        }}>
          AI Туслах
        </Text>
        <Text style={{
          fontFamily: 'Inter_400Regular',
          fontSize: 14,
          color: MUTED,
          textAlign: 'center',
          lineHeight: 21,
          paddingHorizontal: 28,
        }}>
          ШУТИС-ийн гарын авлагаас мэдээлэл авах, хураангуйлах, тайлбарлах
        </Text>
      </View>

      {/* Capability chips */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
        {[
          { icon: 'search',      label: 'Хайлт' },
          { icon: 'summarize',   label: 'Хураангуй' },
          { icon: 'translate',   label: 'Тайлбар' },
        ].map(c => (
          <View key={c.label} style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            backgroundColor: WHITE,
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderWidth: 1,
            borderColor: BORDER,
          }}>
            <MaterialIcons name={c.icon as any} size={13} color={BLUE} />
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: BLUE }}>
              {c.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Suggested question cards */}
      <Text style={{
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
        color: MUTED,
        letterSpacing: 1.2,
        marginBottom: 12,
        paddingHorizontal: 2,
      }}>
        САНАЛ БОЛГОХ АСУУЛТ
      </Text>

      <View style={{ gap: 10 }}>
        {PROMPTS.map((p, i) => (
          <PromptCard key={p.text} prompt={p} index={i} onPress={onPrompt} />
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Prompt card ──────────────────────────────────────────────────

function PromptCard({
  prompt, index, onPress,
}: {
  prompt: typeof PROMPTS[0];
  index: number;
  onPress: (s: string) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.timing(scale, { toValue: 0.97, duration: 80,  easing: EASE, useNativeDriver: true }).start();
  const pressOut = () => Animated.timing(scale, { toValue: 1,    duration: 150, easing: EASE, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={() => onPress(prompt.text)}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
        style={{
          backgroundColor: WHITE,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: BORDER,
          shadowColor: 'rgba(0,0,0,0.05)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 6,
          elevation: 1,
          gap: 14,
        }}
      >
        {/* Colored icon badge */}
        <View style={{
          width: 38, height: 38, borderRadius: 11,
          backgroundColor: prompt.color + '15',
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <MaterialIcons name={prompt.icon as any} size={19} color={prompt.color} />
        </View>

        <Text style={{
          flex: 1,
          fontFamily: 'Inter_400Regular',
          fontSize: 13,
          color: BODY,
          lineHeight: 19,
        }}>
          {prompt.text}
        </Text>

        <MaterialIcons name="north-west" size={15} color="rgba(8,21,143,0.25)" />
      </TouchableOpacity>
    </Animated.View>
  );
}
