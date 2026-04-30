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
  Linking,
  StatusBar,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Markdown from 'react-native-markdown-display';

import { Config } from '@/constants/config';
import { EaseOutExpo } from '@/constants/Theme';

const EASE = Easing.bezier(...EaseOutExpo);

const BLUE   = '#08158F';
const BLUE2  = '#0A1DB8';
const BLUE3  = '#1833D6';
const GOLD   = '#FFC20D';
const BG     = '#F8F9FA';
const WHITE  = '#FFFFFF';
const BODY   = '#1A1A2E';
const MUTED  = '#6B7280';
const BORDER = 'rgba(8,21,143,0.09)';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  loading?: boolean;
  error?: boolean;
  fallback?: boolean;
  retryQuery?: string;
  sources?: ChatSource[];
  timestamp: Date;
}

interface ChatSource {
  section_title: string;
  excerpt: string;
  source_url?: string;
  category?: string;
  score?: number;
}

type ConnectionState = 'checking' | 'online' | 'offline';

const CATEGORIES = [
  { icon: 'search',    label: 'Хайлт',     color: '#6C4EF6', bg: '#F0EDFF' },
  { icon: 'summarize', label: 'Хураангуй', color: '#E53935', bg: '#FFF0F0' },
  { icon: 'translate', label: 'Тайлбар',   color: '#F57C00', bg: '#FFF8F0' },
];

const FILTER_CHIPS = ['Бүгд', 'Тэтгэлэг', 'Байр', 'Даатгал'];

const PROMPTS: { icon: string; text: string; color: string; category: string }[] = [
  { icon: 'school',         text: 'Кредит тооцох шалгалт гэж юу вэ?',      color: BLUE,      category: 'Бүгд' },
  { icon: 'emoji-events',   text: 'Тэтгэлэгт хэрхэн хамрагдах вэ?',        color: '#E53935', category: 'Тэтгэлэг' },
  { icon: 'apartment',      text: 'Оюутны байрны бүртгэл хэрхэн хийх вэ?', color: '#2E7D32', category: 'Байр' },
  { icon: 'local-hospital', text: 'Эрүүл мэндийн даатгалаа хэрхэн төлөх?', color: '#6A1B9A', category: 'Даатгал' },
];

function getChatErrorMessage(error: any) {
  if (error?.name === 'AbortError') {
    return 'Хүсэлт хугацаа хэтэрсэн. Дахин оролдоно уу.';
  }

  const message = String(error?.message ?? '');
  if (message.includes('GEMINI_API_KEY') || message.startsWith('503:')) {
    return 'AI API түлхүүр тохируулаагүй байна.';
  }
  if (message.startsWith('429:') || message.toLowerCase().includes('quota')) {
    return 'AI хүсэлтийн лимит хэтэрлээ. Түр хүлээгээд дахин оролдоно уу.';
  }
  if (message.startsWith('502:') || message.includes('AI үйлчилгээнд алдаа')) {
    return 'AI үйлчилгээ түр саатлаа. Дахин оролдоно уу.';
  }
  if (message.includes('Network request failed') || message.includes('Failed to fetch')) {
    return 'Сервертэй холбогдож чадсангүй. Backend асаалттай эсэхийг шалгаад дахин оролдоно уу.';
  }
  return message || 'Серверт холбогдоход алдаа гарлаа. Дахин оролдоно уу.';
}

// ─── Screen ───────────────────────────────────────────────────────

export default function AIAssistantScreen() {
  const params = useLocalSearchParams<{ context?: string; sectionTitle?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);
  const inputRef  = useRef<TextInput>(null);

  const [input, setInput]       = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinking, setThinking] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>('checking');

  // Pending query ref: when set, the next render triggers sendChat via useEffect
  const pendingQuery = useRef<string | null>(null);

  const checkHealth = useCallback(async () => {
    setConnection('checking');
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(Config.HEALTH, { signal: controller.signal })
        .finally(() => clearTimeout(timer));
      setConnection(res.ok ? 'online' : 'offline');
      return res.ok;
    } catch {
      setConnection('offline');
      return false;
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // ── Deep-link: summarise a handbook section ───────────────────
  useEffect(() => {
    if (params.context && params.sectionTitle) {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: `"${params.sectionTitle}" хэсгийг хураангуйла`,
        timestamp: new Date(),
      };
      setMessages([userMsg]);
      pendingQuery.current = `Дараах агуулгыг хураангуйла:\n\n${params.context}`;
    }
  }, [params.context]);

  // ── Fire sendChat after messages state has committed ──────────
  useEffect(() => {
    if (pendingQuery.current && !thinking) {
      const query = pendingQuery.current;
      pendingQuery.current = null;
      sendChat(query, messages);
    }
  }, [messages, thinking]);

  // ── Auto-scroll on new messages or keyboard ───────────────────
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(t);
  }, [messages]);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => sub.remove();
  }, []);

  // ── Chat logic ────────────────────────────────────────────────
  const sendChat = useCallback(async (query: string, currentMessages: Message[]) => {
    const loadingId = `loading-${Date.now()}`;
    setThinking(true);
    setMessages(prev => [
      ...prev,
      { id: loadingId, role: 'assistant', text: '', loading: true, timestamp: new Date() },
    ]);

    const history = currentMessages
      .filter(m => !m.loading && !m.error)
      .map(m => ({ role: m.role, content: m.text }));

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      const res = await fetch(Config.CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, history }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      setConnection('online');

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`${res.status}:${err.detail ?? `HTTP ${res.status}`}`);
      }

      const data = await res.json();
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingId
            ? {
                ...m,
                text: data.reply ?? 'Хариу авахад алдаа гарлаа.',
                loading: false,
                fallback: Boolean(data.fallback),
                sources: Array.isArray(data.sources) ? data.sources : [],
              }
            : m,
        ),
      );
    } catch (e: any) {
      const errorText = String(e?.message ?? '');
      if (errorText.includes('Network request failed') || errorText.includes('Failed to fetch')) {
        setConnection('offline');
      }
      const msg = getChatErrorMessage(e);
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingId
            ? { ...m, text: msg, loading: false, error: true, retryQuery: query }
            : m,
        ),
      );
    } finally {
      setThinking(false);
    }
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || thinking) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date(),
    };
    setInput('');
    pendingQuery.current = text;
    setMessages(prev => [...prev, userMsg]);
  }, [input, thinking]);

  const handlePrompt = useCallback((text: string) => {
    if (thinking) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date(),
    };
    pendingQuery.current = text;
    setMessages(prev => [...prev, userMsg]);
  }, [thinking]);

  const handleRetry = useCallback((query: string) => {
    if (thinking) return;
    pendingQuery.current = query;
    setMessages(prev => prev.filter(m => !(m.error && m.retryQuery === query)));
  }, [thinking]);

  const handleClear = () => setMessages([]);

  const canSend = input.trim().length > 0 && !thinking;
  const isChat  = messages.length > 0;
  const statusText =
    connection === 'online'
      ? 'ШУТИС гарын авлага холбогдсон'
      : connection === 'checking'
        ? 'Сервер шалгаж байна'
        : 'Сервер холбогдоогүй';
  const statusColor =
    connection === 'online'
      ? '#4ADE80'
      : connection === 'checking'
        ? GOLD
        : '#F87171';

  // Bottom padding: account for the absolutely-positioned tab bar (49pt) + safe area
  const bottomInset = insets.bottom + 49;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />

      {/* ── Header ─────────────────────────────────────────── */}
      <LinearGradient
        colors={[BLUE, BLUE2, BLUE3]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.hero}
      >
        <View style={s.orbGold} />
        <View style={s.orbBlue} />
        <View style={s.orbTiny} />
        <SafeAreaView edges={['top']}>
          <View style={s.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={s.headerBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="arrow-back" size={20} color={WHITE} />
            </TouchableOpacity>

            <View style={s.headerCenter}>
              <View style={s.headerTitleRow}>
                <Text style={s.headerTitle}>AI Туслах</Text>
                <View style={s.betaBadge}>
                  <Text style={s.betaText}>BETA</Text>
                </View>
              </View>
              <View style={s.statusRow}>
                <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                <Text style={s.statusText}>{statusText}</Text>
              </View>
            </View>

            {isChat ? (
              <TouchableOpacity
                onPress={handleClear}
                style={s.headerBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="delete-outline" size={19} color="rgba(255,255,255,0.75)" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 38 }} />
            )}
          </View>
        </SafeAreaView>
        {/* Rounded transition to content */}
        <View style={s.headerCurve} />
      </LinearGradient>

      {/* ── Messages / Welcome ─────────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 16,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {isChat
            ? messages.map(msg => <MessageBubble key={msg.id} msg={msg} onRetry={handleRetry} />)
            : <WelcomeView onPrompt={handlePrompt} />}
        </ScrollView>

        {/* ── Input bar ──────────────────────────────────────── */}
        <View style={[s.inputBar, { paddingBottom: Math.max(bottomInset, 16) }]}>
          {/* Suggestion chips (chat mode, empty input) */}
          {isChat && input.length === 0 && !thinking && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipRow}
            >
              {PROMPTS.map(p => (
                <TouchableOpacity
                  key={p.text}
                  onPress={() => handlePrompt(p.text)}
                  style={s.chip}
                >
                  <MaterialIcons name={p.icon as any} size={13} color={p.color} />
                  <Text style={s.chipText} numberOfLines={1}>
                    {p.text.length > 26 ? p.text.slice(0, 26) + '…' : p.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Pill input */}
          <View style={s.inputRow}>
            <TextInput
              ref={inputRef}
              multiline
              value={input}
              onChangeText={setInput}
              placeholder="Асуулт бичнэ үү..."
              placeholderTextColor={MUTED}
              style={s.textInput}
              editable={!thinking}
            />
            <SendButton canSend={canSend} thinking={thinking} onPress={handleSend} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Send button ──────────────────────────────────────────────────

function SendButton({ canSend, thinking, onPress }: { canSend: boolean; thinking: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.timing(scale, { toValue: 0.88, duration: 80,  easing: EASE, useNativeDriver: true }).start();
  const pressOut = () => Animated.timing(scale, { toValue: 1,    duration: 150, easing: EASE, useNativeDriver: true }).start();

  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (thinking) {
      Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
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
        disabled={!canSend}
        activeOpacity={1}
        style={[s.sendBtn, { backgroundColor: canSend ? BLUE : thinking ? 'rgba(8,21,143,0.10)' : 'rgba(8,21,143,0.10)' }]}
      >
        {thinking ? (
          <Animated.View style={{ transform: [{ rotate }] }}>
            <MaterialIcons name="autorenew" size={18} color={BLUE} />
          </Animated.View>
        ) : (
          <MaterialIcons name="arrow-upward" size={18} color={canSend ? WHITE : 'rgba(8,21,143,0.35)'} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Message bubble ───────────────────────────────────────────────

function MessageBubble({ msg, onRetry }: { msg: Message; onRetry: (query: string) => void }) {
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
      <Animated.View style={[s.userRow, { opacity: op, transform: [{ translateY: y }] }]}>
        <View style={s.userBubble}>
          <Text style={s.msgText}>{msg.text}</Text>
        </View>
        <Text style={s.timeRight}>{timeStr}</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[s.assistantRow, { opacity: op, transform: [{ translateY: y }] }]}>
      <View style={s.assistantLabel}>
        <View style={[s.aiIcon, msg.error && s.aiIconError]}>
          <MaterialIcons
            name={msg.error ? 'error-outline' : msg.fallback ? 'info-outline' : 'auto-awesome'}
            size={12}
            color={msg.error ? '#EF4444' : GOLD}
          />
        </View>
        <Text style={[s.aiName, msg.error && s.aiNameError]}>
          {msg.error ? 'Алдаа' : msg.fallback ? 'Гарын авлага' : 'AI Туслах'}
        </Text>
        <Text style={s.timeLeft}>{timeStr}</Text>
      </View>
      <View style={[s.assistantBubble, msg.error && s.errorBubble]}>
        {msg.loading ? (
          <TypingDots />
        ) : (
          <>
            <Markdown style={markdownStyles}>{msg.text}</Markdown>
            {msg.error && msg.retryQuery && (
              <TouchableOpacity style={s.retryBtn} onPress={() => onRetry(msg.retryQuery!)}>
                <MaterialIcons name="refresh" size={15} color={BLUE} />
                <Text style={s.retryText}>Дахин оролдох</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
      {!msg.loading && !msg.error && msg.sources && msg.sources.length > 0 && (
        <SourceList sources={msg.sources} />
      )}
    </Animated.View>
  );
}

function SourceList({ sources }: { sources: ChatSource[] }) {
  const visibleSources = sources.slice(0, 3);

  return (
    <View style={s.sourcesWrap}>
      {visibleSources.map((source, index) => {
        const url = source.source_url?.startsWith('http') ? source.source_url : undefined;
        const canOpen = Boolean(url);
        return (
          <TouchableOpacity
            key={`${source.section_title}-${index}`}
            disabled={!canOpen}
            onPress={() => url && Linking.openURL(url)}
            style={s.sourceChip}
          >
            <MaterialIcons name={canOpen ? 'open-in-new' : 'article'} size={12} color={BLUE} />
            <Text style={s.sourceText} numberOfLines={1}>
              {source.section_title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
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
        ]),
      ).start();
    });
  }, []);

  return (
    <View style={s.dotsRow}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[s.dot, { transform: [{ translateY: dot }] }]} />
      ))}
    </View>
  );
}

// ─── Welcome view ─────────────────────────────────────────────────

function WelcomeView({ onPrompt }: { onPrompt: (s: string) => void }) {
  const [activeFilter, setActiveFilter] = useState('Бүгд');

  const filteredPrompts =
    activeFilter === 'Бүгд' ? PROMPTS : PROMPTS.filter(p => p.category === activeFilter);

  return (
    <View>
      {/* ── Greeting ─────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: 24 }}>
        <Text style={s.greeting}>Сайн уу! 👋</Text>
        <Text style={s.greetingSub}>Танд юугаар туслах вэ?</Text>
      </View>

      {/* ── Hero card ────────────────────────────────────── */}
      <View style={s.heroCard}>
        <View style={s.heroIcon}>
          <Image
            source={require('@/assets/images/main_logo.png')}
            style={{ width: 44, height: 54 }}
            resizeMode="contain"
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <MaterialIcons name="auto-awesome" size={11} color={BLUE} />
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: BLUE, letterSpacing: 0.2 }}>
              ШУТИС-тай холбогдсон
            </Text>
          </View>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: BODY, lineHeight: 22, marginBottom: 10 }}>
            AI-аас мэдээлэл{'\n'}авна уу
          </Text>
          <TouchableOpacity
            onPress={() => onPrompt('Намайг юугаар туслах боломжтой вэ?')}
            style={s.heroCta}
          >
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: BLUE }}>Яриа эхлэх</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Category cards ───────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, marginBottom: 24, paddingRight: 4 }}
      >
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c.label}
            onPress={() =>
              onPrompt(
                c.label === 'Хайлт'
                  ? 'ШУТИС-ийн мэдээллийг хайхад туслаарай'
                  : c.label === 'Хураангуй'
                    ? 'Гарын авлагын агуулгыг хураангуйла'
                    : 'Нэр томьёог тайлбарлаарай',
              )
            }
            style={s.catCard}
          >
            <View style={[s.catIcon, { backgroundColor: c.bg }]}>
              <MaterialIcons name={c.icon as any} size={22} color={c.color} />
            </View>
            <Text style={s.catLabel}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Suggested section header ─────────────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 17, color: BODY }}>Санал болгох</Text>
      </View>

      {/* ── Filter chips ─────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, marginBottom: 14, paddingRight: 4 }}
      >
        {FILTER_CHIPS.map(chip => (
          <TouchableOpacity
            key={chip}
            onPress={() => setActiveFilter(chip)}
            style={[
              s.filterChip,
              { backgroundColor: activeFilter === chip ? BLUE : WHITE },
            ]}
          >
            <Text
              style={[
                s.filterChipText,
                { color: activeFilter === chip ? WHITE : MUTED },
              ]}
            >
              {chip}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Prompt list ──────────────────────────────────── */}
      <View style={{ gap: 10 }}>
        {filteredPrompts.map(p => (
          <PromptCard key={p.text} prompt={p} onPress={onPrompt} />
        ))}
      </View>
    </View>
  );
}

// ─── Prompt card ──────────────────────────────────────────────────

function PromptCard({ prompt, onPress }: { prompt: (typeof PROMPTS)[0]; onPress: (s: string) => void }) {
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
        style={s.promptCard}
      >
        <View style={[s.promptIcon, { backgroundColor: prompt.color + '15' }]}>
          <MaterialIcons name={prompt.icon as any} size={19} color={prompt.color} />
        </View>
        <Text style={s.promptText}>{prompt.text}</Text>
        <MaterialIcons name="north-west" size={15} color="rgba(8,21,143,0.25)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // Hero
  hero: { paddingBottom: 38, overflow: 'hidden' },
  orbGold: {
    position: 'absolute',
    top: -60, right: -50,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: GOLD, opacity: 0.12,
  },
  orbBlue: {
    position: 'absolute',
    top: 40, left: -80,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: '#FFFFFF', opacity: 0.05,
  },
  orbTiny: {
    position: 'absolute',
    top: 90, right: 60,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: GOLD, opacity: 0.8,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
    gap: 12,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 19,
    color: WHITE,
    letterSpacing: -0.2,
  },
  betaBadge: {
    backgroundColor: GOLD,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  betaText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: BODY,
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  statusText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  headerCurve: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 40, backgroundColor: BG,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
  },

  // Input bar
  inputBar: {
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  chipRow: {
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BLUE + '0D',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
  },
  chipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: BODY,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F3F4F6',
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  textInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: BODY,
    maxHeight: 110,
    lineHeight: 22,
    paddingTop: 4,
    paddingBottom: 4,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Messages
  userRow: {
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  userBubble: {
    maxWidth: '78%',
    backgroundColor: '#F0F1F6',
    borderRadius: 20,
    borderBottomRightRadius: 5,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  msgText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: BODY,
    lineHeight: 22,
  },
  timeRight: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: MUTED,
    marginTop: 3,
    marginRight: 4,
  },
  assistantRow: {
    marginBottom: 14,
  },
  assistantLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingLeft: 2,
  },
  aiIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiIconError: {
    backgroundColor: '#FEE2E2',
  },
  aiName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: BLUE,
  },
  aiNameError: {
    color: '#B91C1C',
  },
  timeLeft: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: MUTED,
  },
  assistantBubble: {
    backgroundColor: WHITE,
    borderRadius: 20,
    borderTopLeftRadius: 5,
    paddingHorizontal: 15,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  errorBubble: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FECACA',
    shadowOpacity: 0.03,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: BLUE + '0D',
  },
  retryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: BLUE,
  },
  sourcesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    paddingLeft: 2,
  },
  sourceChip: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: BLUE + '0D',
  },
  sourceText: {
    maxWidth: 220,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: BLUE,
  },

  // Typing dots
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BLUE,
    opacity: 0.6,
  },

  // Welcome
  greeting: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: BODY,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  greetingSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: MUTED,
    lineHeight: 21,
  },
  heroCard: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: BLUE + '10',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroCta: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: BLUE,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  catCard: {
    width: 100,
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  catIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: BODY,
    textAlign: 'center',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  filterChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  promptCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  promptIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  promptText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: BODY,
    lineHeight: 19,
  },
});

const markdownStyles = StyleSheet.create({
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: BODY,
    lineHeight: 22,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },
  bullet_list: {
    marginBottom: 6,
  },
  ordered_list: {
    marginBottom: 6,
  },
  list_item: {
    marginBottom: 4,
  },
  strong: {
    fontFamily: 'Inter_700Bold',
    color: BODY,
  },
});
